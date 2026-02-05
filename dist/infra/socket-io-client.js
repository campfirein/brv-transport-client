import { io } from 'socket.io-client';
import { TRANSPORT_CONNECT_TIMEOUT_MS, TRANSPORT_DEFAULT_TRANSPORTS, TRANSPORT_RECONNECTION_ATTEMPTS, TRANSPORT_RECONNECTION_DELAY_MAX_MS, TRANSPORT_RECONNECTION_DELAY_MS, TRANSPORT_REQUEST_TIMEOUT_MS, TRANSPORT_ROOM_TIMEOUT_MS, } from '../constants.js';
import { ConcurrentConnectionError, InvalidOperationError, InvalidResponseError, InvalidTimeoutError, TransportConnectionError, TransportNotConnectedError, TransportRequestError, TransportRequestTimeoutError, } from '../core/domain/errors/transport-error.js';
import { validateEventName, validateTransportUrl } from '../core/domain/validators/index.js';
import { NoOpClientLogger } from './no-op-client-logger.js';
import { ConnectionStateManager } from './connection-state-manager.js';
import { EventDispatcher } from './event-dispatcher.js';
import { ExponentialBackoffStrategy } from './reconnection-strategy.js';
import { ForceReconnectManager } from './force-reconnect-manager.js';
import { RoomManager } from './room-manager.js';
import { TimeBasedWakeDetector } from './wake-detector.js';
import { deepFreeze } from './utils/deep-freeze.js';
// ============================================================================
// TransportClient Implementation
// ============================================================================
/**
 * Socket.IO implementation of ITransportClient.
 * Uses composition and dependency injection for testability and flexibility.
 *
 * Architecture:
 * - ConnectionStateManager: Manages connection state and notifications
 * - EventDispatcher: Handles event subscriptions and dispatching
 * - RoomManager: Manages room join/leave/rejoin
 * - IReconnectionStrategy: Configurable reconnection behavior
 * - IWakeDetector: Detects system wake from sleep
 *
 * @remarks
 * This class acts as a facade/coordinator for the specialized components.
 * Each component follows Single Responsibility Principle.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const client = new TransportClient()
 * await client.connect('http://localhost:3000')
 *
 * // With custom dependencies (DIP)
 * const client = new TransportClient({
 *   logger: myLogger,
 *   reconnectionStrategy: new CustomReconnectionStrategy(),
 * })
 * ```
 */
export class TransportClient {
    // Immutable configuration (ES2022 private fields for true encapsulation)
    #config;
    #logger;
    #reconnectionStrategy;
    #wakeDetector;
    // Composed components (ES2022 private fields, injectable for testing)
    #stateManager;
    #eventDispatcher;
    #roomManager;
    // Mutable socket state (ES2022 private fields)
    #socket;
    #serverUrl;
    /**
     * Internal getter for socket access within this class.
     * Provides convenient syntax for internal use.
     */
    get socket() {
        return this.#socket;
    }
    // Force reconnect manager (SRP - extracted to separate class)
    #forceReconnectManager;
    // Connection lifecycle flags (ES2022 private fields)
    #initialConnectInProgress = false;
    #persistentHandlersRegistered = false;
    #reconnectHandlerInProgress = false;
    // Connection ID for detecting superseded connections (race condition fix)
    #connectionId = 0;
    // Connection mutex to prevent concurrent connect() calls (race condition fix)
    #connectPromise;
    // Wake detector subscription (ES2022 private field)
    #wakeUnsubscribe;
    // Callbacks for observability
    #onHandlersCleared;
    constructor(options) {
        // Validate timeout options if provided
        if (options?.connectTimeoutMs !== undefined) {
            this.validateTimeout(options.connectTimeoutMs, 'connectTimeoutMs');
        }
        if (options?.reconnectionDelayMs !== undefined) {
            this.validateTimeout(options.reconnectionDelayMs, 'reconnectionDelayMs');
        }
        if (options?.reconnectionDelayMaxMs !== undefined) {
            this.validateTimeout(options.reconnectionDelayMaxMs, 'reconnectionDelayMaxMs');
        }
        if (options?.requestTimeoutMs !== undefined) {
            this.validateTimeout(options.requestTimeoutMs, 'requestTimeoutMs');
        }
        if (options?.roomTimeoutMs !== undefined) {
            this.validateTimeout(options.roomTimeoutMs, 'roomTimeoutMs');
        }
        // Resolve configuration with defaults and deep freeze for immutability
        // Deep freeze prevents mutation of nested objects (e.g., socketOptions)
        this.#config = deepFreeze({
            connectTimeoutMs: options?.connectTimeoutMs ?? TRANSPORT_CONNECT_TIMEOUT_MS,
            reconnectionAttempts: options?.reconnectionAttempts ?? TRANSPORT_RECONNECTION_ATTEMPTS,
            reconnectionDelayMs: options?.reconnectionDelayMs ?? TRANSPORT_RECONNECTION_DELAY_MS,
            reconnectionDelayMaxMs: options?.reconnectionDelayMaxMs ?? TRANSPORT_RECONNECTION_DELAY_MAX_MS,
            requestTimeoutMs: options?.requestTimeoutMs ?? TRANSPORT_REQUEST_TIMEOUT_MS,
            roomTimeoutMs: options?.roomTimeoutMs ?? TRANSPORT_ROOM_TIMEOUT_MS,
            transports: options?.transports ?? TRANSPORT_DEFAULT_TRANSPORTS,
            socketOptions: options?.socketOptions,
        });
        // Inject or create dependencies
        this.#logger = options?.logger ?? new NoOpClientLogger();
        this.#reconnectionStrategy = options?.reconnectionStrategy ?? new ExponentialBackoffStrategy();
        this.#wakeDetector = options?.wakeDetector ?? new TimeBasedWakeDetector({ logger: this.#logger });
        // Store optional callbacks for observability
        this.#onHandlersCleared = options?.onHandlersCleared;
        // Internal socket provider for composed components
        // Uses closure to access private #socket field
        const internalSocketProvider = {
            getSocket: () => this.#socket,
        };
        // Use injected components or create defaults
        // Injection is primarily for testing purposes
        this.#stateManager = options?.stateManager ?? new ConnectionStateManager({ logger: this.#logger });
        this.#eventDispatcher =
            options?.eventDispatcher ??
                new EventDispatcher({
                    logger: this.#logger,
                    socketProvider: internalSocketProvider,
                    onHandlerError: options?.onHandlerError,
                });
        this.#roomManager =
            options?.roomManager ??
                new RoomManager({
                    logger: this.#logger,
                    roomTimeoutMs: this.#config.roomTimeoutMs,
                    socketProvider: internalSocketProvider,
                });
        // Create force reconnect manager (SRP - handles reconnection orchestration)
        this.#forceReconnectManager = new ForceReconnectManager({
            logger: this.#logger,
            reconnectionStrategy: this.#reconnectionStrategy,
            onAttempt: () => this.handleForceReconnectAttempt(),
            onError: options?.onReconnectError,
        });
    }
    // ==========================================================================
    // Private: State Guards
    // ==========================================================================
    /**
     * Checks if connect() operation is allowed in current state.
     * @returns True if can connect (state is 'disconnected')
     */
    canConnect() {
        return this.#stateManager.isDisconnected();
    }
    /**
     * Checks if disconnect() operation is allowed in current state.
     * @returns True if can disconnect (state is not 'disconnected')
     */
    canDisconnect() {
        return !this.#stateManager.isDisconnected();
    }
    // ==========================================================================
    // ITransportClient Implementation
    // ==========================================================================
    async connect(url) {
        // Validate URL before attempting connection (delegated to domain validator)
        validateTransportUrl(url);
        // Guard: Can only connect from disconnected state
        if (!this.canConnect()) {
            const state = this.#stateManager.getState();
            throw new InvalidOperationError(`Cannot connect from state '${state}'. Must be 'disconnected'.`);
        }
        // Already connected - no-op
        if (this.socket?.connected) {
            return;
        }
        // If connection is already in progress, check for URL mismatch (race condition fix)
        if (this.#connectPromise) {
            if (this.#serverUrl && this.#serverUrl !== url) {
                throw new ConcurrentConnectionError(this.#serverUrl, url);
            }
            return this.#connectPromise;
        }
        // Cleanup existing socket if present but not connected
        this.cleanupExistingSocket();
        // Store URL BEFORE creating promise (order matters for race condition check)
        this.#serverUrl = url;
        // Reset force reconnect state on manual connect
        this.#forceReconnectManager.cancel();
        // Create mutex promise to deduplicate concurrent calls
        this.#connectPromise = this.establishConnection(url).finally(() => {
            this.#connectPromise = undefined;
        });
        return this.#connectPromise;
    }
    /**
     * Validates that a timeout value is a positive number.
     * @throws InvalidTimeoutError if timeout is invalid
     */
    validateTimeout(value, parameterName) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
            throw new InvalidTimeoutError(value, parameterName);
        }
    }
    /**
     * Disconnects from the server.
     *
     * @remarks
     * WARNING: This clears ALL event handlers including pending once() handlers.
     * Use onHandlersCleared callback to be notified when handlers are dropped.
     */
    async disconnect() {
        // No-op if already disconnected
        if (this.#stateManager.isDisconnected()) {
            this.log('Already disconnected');
            return;
        }
        // Cancel force reconnect and reset strategy state
        this.#forceReconnectManager.cancel();
        // Stop wake detection
        this.stopWakeDetection();
        const socket = this.socket;
        if (!socket) {
            // Edge case: state not disconnected but socket doesn't exist
            // Fix state to match reality
            this.#stateManager.setState('disconnected');
            return;
        }
        return new Promise((resolve) => {
            // Socket.IO handles its own internal listeners - we only clear application listeners
            // via EventDispatcher.clearAllHandlers() and RoomManager.clearRooms() below
            socket.disconnect();
            // Reset state
            this.#socket = undefined;
            this.#stateManager.setState('disconnected');
            // Capture handler counts before clearing for notification
            const pendingCount = this.#eventDispatcher.pendingOnceHandlerCount;
            const persistentCount = this.#eventDispatcher.getEventCount();
            // Clear component state
            this.#eventDispatcher.clearAllHandlers();
            this.#roomManager.clearRooms();
            this.#persistentHandlersRegistered = false;
            // Notify if handlers were dropped
            if ((pendingCount > 0 || persistentCount > 0) && this.#onHandlersCleared) {
                try {
                    this.#onHandlersCleared(pendingCount, persistentCount);
                }
                catch (error) {
                    const errMsg = error instanceof Error ? error.message : String(error);
                    this.log(`onHandlersCleared callback threw: ${errMsg}`);
                }
            }
            resolve();
        });
    }
    getState() {
        return this.#stateManager.getState();
    }
    getClientId() {
        return this.socket?.id;
    }
    async isConnected(timeoutMs = 2000) {
        // Validate timeout if explicitly provided (non-default)
        if (timeoutMs !== 2000) {
            this.validateTimeout(timeoutMs, 'timeoutMs');
        }
        const socket = this.socket;
        if (!socket?.connected) {
            return false;
        }
        // Verify bidirectional communication with ping
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), timeoutMs);
            socket.volatile.emit('ping', { timestamp: Date.now() }, () => {
                clearTimeout(timeout);
                resolve(true);
            });
        });
    }
    onStateChange(handler) {
        return this.#stateManager.onStateChange(handler);
    }
    on(event, handler) {
        return this.#eventDispatcher.on(event, handler);
    }
    once(event, handler) {
        this.#eventDispatcher.once(event, handler);
    }
    async joinRoom(room) {
        return this.#roomManager.joinRoom(room);
    }
    async leaveRoom(room) {
        return this.#roomManager.leaveRoom(room);
    }
    // Implementation
    request(event, data, ack) {
        // Validate event name
        validateEventName(event);
        const socket = this.socket;
        if (!socket?.connected) {
            throw new TransportNotConnectedError('request');
        }
        // Fire-and-forget (no callback)
        if (ack === undefined) {
            socket.emit(event, data);
            return;
        }
        // With callback
        socket.emit(event, data, ack);
    }
    requestWithAck(event, data, options) {
        // Validate event name
        validateEventName(event);
        const socket = this.socket;
        if (!socket?.connected) {
            throw new TransportNotConnectedError('requestWithAck');
        }
        // Validate timeout if explicitly provided
        if (options?.timeout !== undefined) {
            this.validateTimeout(options.timeout, 'timeout');
        }
        const timeout = options?.timeout ?? this.#config.requestTimeoutMs;
        return new Promise((resolve, reject) => {
            let handled = false;
            const timer = setTimeout(() => {
                if (handled)
                    return;
                handled = true;
                reject(new TransportRequestTimeoutError(event, timeout));
            }, timeout);
            socket.emit(event, data, (response) => {
                if (handled)
                    return;
                handled = true;
                clearTimeout(timer);
                // Validate response structure
                if (!this.isValidResponse(response)) {
                    reject(new InvalidResponseError(event, 'response must be an object with a boolean "success" property'));
                    return;
                }
                if (response.success && response.data !== undefined) {
                    resolve(response.data);
                }
                else if (response.success) {
                    // Server returned success without data (void response)
                    resolve(undefined);
                }
                else {
                    reject(new TransportRequestError(event, response.error));
                }
            });
        });
    }
    /**
     * Type guard to validate server response structure.
     */
    isValidResponse(response) {
        if (typeof response !== 'object' || response === null) {
            return false;
        }
        const obj = response;
        if (typeof obj.success !== 'boolean') {
            return false;
        }
        // error must be undefined or string
        if (obj.error !== undefined && typeof obj.error !== 'string') {
            return false;
        }
        return true;
    }
    // ==========================================================================
    // Private: Connection Management
    // ==========================================================================
    /**
     * Establishes a new socket connection.
     */
    establishConnection(url) {
        return new Promise((resolve, reject) => {
            // Increment connection ID to detect superseded connections
            this.#connectionId++;
            const thisConnectionId = this.#connectionId;
            this.#stateManager.setState('connecting');
            this.#initialConnectInProgress = true;
            this.#socket = io(url, {
                // Default options (can be overridden by user's socketOptions)
                randomizationFactor: 0,
                reconnection: true,
                reconnectionAttempts: this.#config.reconnectionAttempts,
                reconnectionDelay: this.#config.reconnectionDelayMs,
                reconnectionDelayMax: this.#config.reconnectionDelayMaxMs,
                timeout: this.#config.connectTimeoutMs,
                transports: [...this.#config.transports],
                // User-provided options override defaults
                ...this.#config.socketOptions,
            });
            const onConnect = () => {
                // Verify this is still the current connection
                if (this.#connectionId !== thisConnectionId) {
                    this.log('Connection superseded, ignoring connect event');
                    return;
                }
                this.#stateManager.setState('connected');
                this.#initialConnectInProgress = false;
                cleanup();
                // Register pending handlers
                this.#eventDispatcher.registerPendingHandlers();
                // Start wake detection
                this.startWakeDetection();
                resolve();
            };
            const onConnectError = (error) => {
                // Verify this is still the current connection
                if (this.#connectionId !== thisConnectionId) {
                    this.log('Connection superseded, ignoring connect_error event');
                    return;
                }
                this.#stateManager.setState('disconnected');
                this.#initialConnectInProgress = false;
                cleanup();
                // Cleanup socket and Manager listeners
                if (this.#socket) {
                    // Remove Manager listeners to prevent duplicates on retry
                    this.#socket.io.off('reconnect');
                    this.#socket.io.off('reconnect_failed');
                    this.#socket.disconnect();
                    this.#socket = undefined;
                }
                // Reset flag so next connect() will setup handlers again
                this.#persistentHandlersRegistered = false;
                reject(new TransportConnectionError(url, error));
            };
            const cleanup = () => {
                this.#socket?.off('connect', onConnect);
                this.#socket?.off('connect_error', onConnectError);
            };
            this.#socket.on('connect', onConnect);
            this.#socket.once('connect_error', onConnectError);
            // Setup persistent handlers (only once per socket)
            if (!this.#persistentHandlersRegistered) {
                this.setupPersistentHandlers();
                this.#persistentHandlersRegistered = true;
            }
        });
    }
    /**
     * Sets up persistent socket handlers for disconnect, reconnect, etc.
     */
    setupPersistentHandlers() {
        const socket = this.socket;
        if (!socket)
            return;
        // Handle disconnect
        socket.on('disconnect', (reason) => {
            // Verify socket is still current
            if (this.socket !== socket) {
                this.log('Socket superseded, ignoring disconnect event');
                return;
            }
            this.log(`Socket disconnected, reason: ${reason}, active: ${socket.active}`);
            this.#stateManager.setState(socket.active ? 'reconnecting' : 'disconnected');
        });
        // Handle successful reconnect
        socket.io.on('reconnect', (attemptNumber) => {
            // Capture current socket reference to avoid race conditions
            const currentSocket = this.socket;
            // Verify socket is still current
            if (currentSocket !== socket) {
                this.log('Socket superseded, ignoring reconnect event');
                return;
            }
            // Guard against concurrent reconnect handler execution
            if (this.#reconnectHandlerInProgress) {
                this.log('Reconnect handler already in progress, skipping duplicate execution');
                return;
            }
            this.#reconnectHandlerInProgress = true;
            // Helper: Wait for socket.connected to be true
            // Socket.IO may fire 'reconnect' event before socket is fully ready
            const waitForSocketConnected = () => {
                return new Promise((resolve) => {
                    if (socket.connected) {
                        resolve(true);
                        return;
                    }
                    this.log('Reconnect event fired but socket not yet connected, waiting...');
                    const startTime = Date.now();
                    const checkInterval = setInterval(() => {
                        if (socket.connected) {
                            clearInterval(checkInterval);
                            this.log('Socket now connected after waiting');
                            resolve(true);
                        }
                        else if (Date.now() - startTime > 5000) {
                            clearInterval(checkInterval);
                            this.log('Timeout waiting for socket.connected (5s), proceeding anyway');
                            resolve(false);
                        }
                    }, 10);
                });
            };
            // Wait for socket to be actually connected before proceeding
            void waitForSocketConnected()
                .then((isConnected) => {
                // Verify socket is still current after waiting
                if (this.socket !== currentSocket) {
                    this.log('Socket superseded during wait, aborting reconnect handler');
                    return;
                }
                this.log(`Built-in reconnect succeeded after ${attemptNumber} attempts`);
                this.#stateManager.setState('connected');
                // Skip re-registration during initial connect
                if (this.#initialConnectInProgress) {
                    this.log('Skipping handler re-registration - initial connect in progress');
                    return;
                }
                // Re-register handlers (prevents listener accumulation)
                this.#eventDispatcher.clearSocketListeners();
                this.#eventDispatcher.registerPendingHandlers();
                // Rejoin rooms - only if socket is confirmed connected
                if (isConnected && currentSocket?.connected && this.socket === currentSocket) {
                    this.#roomManager.rejoinRooms();
                }
            })
                .finally(() => {
                // Always reset flag to allow future reconnect handlers
                this.#reconnectHandlerInProgress = false;
            });
        });
        // Handle reconnection failure
        socket.io.on('reconnect_failed', () => {
            // Verify socket is still current
            if (this.socket !== socket) {
                this.log('Socket superseded, ignoring reconnect_failed event');
                return;
            }
            this.log('Built-in reconnection failed, starting force reconnect');
            this.#stateManager.setState('disconnected');
            this.#forceReconnectManager.schedule();
        });
    }
    /**
     * Cleans up existing socket if present.
     */
    cleanupExistingSocket() {
        if (!this.#socket)
            return;
        // Remove all persistent handlers to prevent duplicates on reconnect
        // Socket-level listener
        this.#socket.off('disconnect');
        // Manager-level listeners
        this.#socket.io.off('reconnect');
        this.#socket.io.off('reconnect_failed');
        this.#socket.disconnect();
        this.#socket = undefined;
        this.#eventDispatcher.clearSocketListeners();
        this.#persistentHandlersRegistered = false;
    }
    // ==========================================================================
    // Private: Force Reconnection (delegated to ForceReconnectManager)
    // ==========================================================================
    /**
     * Handles a force reconnection attempt.
     * Called by ForceReconnectManager when it's time to attempt reconnection.
     */
    async handleForceReconnectAttempt() {
        // Skip if already connected/connecting/reconnecting
        const currentState = this.#stateManager.getState();
        if (!this.#serverUrl ||
            currentState === 'connected' ||
            currentState === 'connecting' ||
            currentState === 'reconnecting') {
            this.log(`Force reconnect skipped (state=${currentState})`);
            return;
        }
        // Cleanup old socket
        this.cleanupExistingSocket();
        // Attempt connection (throws on failure)
        await this.connect(this.#serverUrl);
        // Rejoin rooms on success - capture socket reference to prevent race conditions
        this.log(`Force reconnect succeeded, rejoining ${this.#roomManager.getJoinedRooms().size} rooms`);
        const reconnectedSocket = this.socket;
        if (reconnectedSocket?.connected) {
            this.#roomManager.rejoinRooms();
        }
        else {
            // Retry after short delay if not yet connected
            setTimeout(() => {
                // Verify socket is still current and connected
                if (reconnectedSocket?.connected && this.socket === reconnectedSocket) {
                    this.#roomManager.rejoinRooms();
                }
            }, 50);
        }
    }
    // ==========================================================================
    // Private: Wake Detection
    // ==========================================================================
    /**
     * Starts wake detection to handle sleep/hibernate recovery.
     */
    startWakeDetection() {
        // Unsubscribe from previous if any
        this.stopWakeDetection();
        // Subscribe to wake events
        this.#wakeUnsubscribe = this.#wakeDetector.onWake(() => {
            this.handleWakeFromSleep();
        });
        // Start detection if not already active
        if (!this.#wakeDetector.isActive()) {
            this.#wakeDetector.start();
        }
    }
    /**
     * Stops wake detection.
     */
    stopWakeDetection() {
        if (this.#wakeUnsubscribe) {
            this.#wakeUnsubscribe();
            this.#wakeUnsubscribe = undefined;
        }
        if (this.#wakeDetector.isActive()) {
            this.#wakeDetector.stop();
        }
    }
    /**
     * Handles system wake from sleep.
     */
    handleWakeFromSleep() {
        const state = this.#stateManager.getState();
        const socketConnected = this.socket?.connected ?? false;
        // Only act if in disconnected or mismatched state
        if (state === 'disconnected' && this.#serverUrl) {
            this.log('Wake detected: state disconnected, restarting force reconnect');
            this.#forceReconnectManager.restart();
        }
        else if (state === 'connected' && !socketConnected) {
            this.log('Wake detected: state mismatch, triggering reconnect');
            // Validate before transition
            if (this.#stateManager.canTransitionTo('disconnected')) {
                try {
                    // TOCTOU mitigation: State could change between check and set due to concurrent socket events
                    this.#stateManager.setState('disconnected');
                    this.#forceReconnectManager.restart();
                }
                catch (error) {
                    // If state transition fails due to race condition, log and skip wake reconnect
                    const errMsg = error instanceof Error ? error.message : String(error);
                    this.log(`Wake reconnect failed due to state transition error: ${errMsg}`);
                }
            }
            else {
                this.log('Cannot transition to disconnected, skipping wake reconnect');
            }
        }
        else if (state === 'connecting' || state === 'reconnecting') {
            // Skip wake reconnect if already in progress
            this.log(`Skip wake reconnect: already in state '${state}'`);
        }
    }
    // ==========================================================================
    // Private: Utilities
    // ==========================================================================
    /**
     * Logs a debug message.
     */
    log(message) {
        this.#logger.debug(`[TransportClient] ${message}`);
    }
}
//# sourceMappingURL=socket-io-client.js.map