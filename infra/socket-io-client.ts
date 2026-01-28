import {io, Socket} from 'socket.io-client'
import type {ManagerOptions, SocketOptions} from 'socket.io-client'

import type {ClientConfig, SocketTransport} from '../core/domain/types.js'
import type {IClientLogger} from '../core/interfaces/i-client-logger.js'
import type {ConnectionState, ConnectionStateHandler} from '../core/interfaces/i-connection-state.js'
import type {EventHandler} from '../core/interfaces/i-event-dispatcher.js'
import type {ITransportClient, RequestOptions} from '../core/interfaces/i-client.js'
import type {IReconnectionStrategy} from '../core/interfaces/i-reconnection-strategy.js'
import type {ISocketProvider} from '../core/interfaces/i-socket-provider.js'
import type {IWakeDetector} from '../core/interfaces/i-wake-detector.js'

import {
  TRANSPORT_CONNECT_TIMEOUT_MS,
  TRANSPORT_DEFAULT_TRANSPORTS,
  TRANSPORT_RECONNECTION_ATTEMPTS,
  TRANSPORT_RECONNECTION_DELAY_MAX_MS,
  TRANSPORT_RECONNECTION_DELAY_MS,
  TRANSPORT_REQUEST_TIMEOUT_MS,
  TRANSPORT_ROOM_TIMEOUT_MS,
} from '../constants.js'
import {
  ConcurrentConnectionError,
  InvalidOperationError,
  InvalidResponseError,
  InvalidTimeoutError,
  TransportConnectionError,
  TransportNotConnectedError,
  TransportRequestError,
  TransportRequestTimeoutError,
} from '../core/domain/errors/transport-error.js'
import {validateEventName, validateTransportUrl} from '../core/domain/validators/index.js'
import {NoOpClientLogger} from './no-op-client-logger.js'
import {ConnectionStateManager} from './connection-state-manager.js'
import {EventDispatcher, type HandlerErrorCallback} from './event-dispatcher.js'
import {ExponentialBackoffStrategy} from './reconnection-strategy.js'
import {ForceReconnectManager} from './force-reconnect-manager.js'
import {RoomManager} from './room-manager.js'
import {TimeBasedWakeDetector} from './wake-detector.js'
import {deepFreeze} from './utils/deep-freeze.js'
import type {InternalTestDependencies} from './testing/test-dependencies.js'

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Immutable configuration for TransportClient.
 */
export type TransportClientConfig = {
  readonly connectTimeoutMs?: number
  readonly reconnectionAttempts?: number
  readonly reconnectionDelayMs?: number
  readonly reconnectionDelayMaxMs?: number
  readonly requestTimeoutMs?: number
  readonly roomTimeoutMs?: number
  readonly transports?: readonly SocketTransport[]
  /**
   * Advanced Socket.IO client options for custom configurations.
   * These options are merged with defaults and can override them.
   *
   * @remarks
   * Common use cases:
   * - `path`: Custom Socket.IO server path (default: '/socket.io')
   * - `auth`: Authentication tokens or credentials
   * - `query`: Query parameters for connection
   * - `extraHeaders`: Custom HTTP headers
   * - `withCredentials`: Enable CORS credentials
   *
   * @example
   * ```typescript
   * const client = new TransportClient({
   *   socketOptions: {
   *     path: '/custom-socket-path',
   *     auth: { token: 'secret' },
   *     extraHeaders: { 'X-Custom': 'value' }
   *   }
   * })
   * ```
   */
  readonly socketOptions?: Partial<ManagerOptions & SocketOptions>
}

/**
 * Dependencies that can be injected into TransportClient.
 * Follows Dependency Inversion Principle (DIP) and Interface Segregation Principle (ISP).
 *
 * @remarks
 * All dependencies use interfaces for proper inversion of control.
 * Internal components for testing are available via separate testing module.
 */
export type TransportClientDependencies = {
  /** Logger for debug output (DIP - injectable) */
  readonly logger?: IClientLogger
  /** Reconnection strategy (DIP - injectable) */
  readonly reconnectionStrategy?: IReconnectionStrategy
  /** Wake detector for sleep recovery (DIP - injectable) */
  readonly wakeDetector?: IWakeDetector
  /**
   * Callback for event handler errors.
   * Provides observability when event handlers throw exceptions.
   * Useful for error tracking services.
   *
   * @remarks
   * **IMPORTANT:** This callback must not throw errors or block the event loop.
   * - Throwing errors: Will be caught and logged, but degrades observability
   * - Blocking operations: Will delay event processing and can cause performance issues
   * - Use async operations (promises) without awaiting if needed
   *
   * @example
   * ```typescript
   * // Good: Non-blocking error reporting
   * onHandlerError: (event, error, data) => {
   *   void errorTracker.report(error) // Fire-and-forget
   * }
   *
   * // Bad: Blocking or throwing
   * onHandlerError: (event, error, data) => {
   *   throw new Error('Bad!') // Don't do this
   *   while(true) {} // Never do this
   * }
   * ```
   */
  readonly onHandlerError?: HandlerErrorCallback
  /**
   * Callback invoked when handlers are cleared during disconnect.
   * Provides observability when pending once() handlers and persistent handlers are dropped.
   *
   * @param pendingCount - Number of pending once handlers that were cleared
   * @param persistentCount - Number of persistent event types that were cleared
   *
   * @remarks
   * **IMPORTANT:** This callback must not throw errors or block the event loop.
   * Throwing errors will be caught and logged but may hide important cleanup issues.
   */
  readonly onHandlersCleared?: (pendingCount: number, persistentCount: number) => void
  /**
   * Callback invoked when force reconnect fails.
   * Provides observability for persistent connection failures.
   *
   * @param error - The error that caused the reconnect failure
   * @param attemptNumber - The attempt number (1-based)
   *
   * @remarks
   * **IMPORTANT:** This callback must not throw errors or block the event loop.
   * Throwing errors will be caught and logged but may interfere with reconnection logic.
   */
  readonly onReconnectError?: (error: Error, attemptNumber: number) => void
}

/**
 * Full options combining config and dependencies for public API.
 */
export type TransportClientOptions = TransportClientConfig & TransportClientDependencies

/**
 * Internal options type that includes test dependencies.
 * Used only within constructor - not exported.
 * @internal
 */
type InternalTransportClientOptions = TransportClientOptions & InternalTestDependencies

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Resolved (non-optional) configuration.
 */
type ResolvedConfig = {
  readonly connectTimeoutMs: number
  readonly reconnectionAttempts: number
  readonly reconnectionDelayMs: number
  readonly reconnectionDelayMaxMs: number
  readonly requestTimeoutMs: number
  readonly roomTimeoutMs: number
  readonly transports: readonly SocketTransport[]
  readonly socketOptions?: Partial<ManagerOptions & SocketOptions>
}

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
export class TransportClient implements ITransportClient {
  // Immutable configuration (ES2022 private fields for true encapsulation)
  readonly #config: ResolvedConfig
  readonly #logger: IClientLogger
  readonly #reconnectionStrategy: IReconnectionStrategy
  readonly #wakeDetector: IWakeDetector

  // Composed components (ES2022 private fields, injectable for testing)
  readonly #stateManager: ConnectionStateManager
  readonly #eventDispatcher: EventDispatcher
  readonly #roomManager: RoomManager

  // Mutable socket state (ES2022 private fields)
  #socket: Socket | undefined
  #serverUrl: string | undefined

  /**
   * Internal getter for socket access within this class.
   * Provides convenient syntax for internal use.
   */
  private get socket(): Socket | undefined {
    return this.#socket
  }

  // Force reconnect manager (SRP - extracted to separate class)
  readonly #forceReconnectManager: ForceReconnectManager

  // Connection lifecycle flags (ES2022 private fields)
  #initialConnectInProgress: boolean = false
  #persistentHandlersRegistered: boolean = false
  #reconnectHandlerInProgress: boolean = false

  // Connection ID for detecting superseded connections (race condition fix)
  #connectionId: number = 0

  // Connection mutex to prevent concurrent connect() calls (race condition fix)
  #connectPromise: Promise<void> | undefined

  // Wake detector subscription (ES2022 private field)
  #wakeUnsubscribe: (() => void) | undefined

  // Callbacks for observability
  readonly #onHandlersCleared?: (pendingCount: number, persistentCount: number) => void

  constructor(options?: InternalTransportClientOptions) {
    // Validate timeout options if provided
    if (options?.connectTimeoutMs !== undefined) {
      this.validateTimeout(options.connectTimeoutMs, 'connectTimeoutMs')
    }
    if (options?.reconnectionDelayMs !== undefined) {
      this.validateTimeout(options.reconnectionDelayMs, 'reconnectionDelayMs')
    }
    if (options?.reconnectionDelayMaxMs !== undefined) {
      this.validateTimeout(options.reconnectionDelayMaxMs, 'reconnectionDelayMaxMs')
    }
    if (options?.requestTimeoutMs !== undefined) {
      this.validateTimeout(options.requestTimeoutMs, 'requestTimeoutMs')
    }
    if (options?.roomTimeoutMs !== undefined) {
      this.validateTimeout(options.roomTimeoutMs, 'roomTimeoutMs')
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
    })

    // Inject or create dependencies
    this.#logger = options?.logger ?? new NoOpClientLogger()
    this.#reconnectionStrategy = options?.reconnectionStrategy ?? new ExponentialBackoffStrategy()
    this.#wakeDetector = options?.wakeDetector ?? new TimeBasedWakeDetector({logger: this.#logger})

    // Store optional callbacks for observability
    this.#onHandlersCleared = options?.onHandlersCleared

    // Internal socket provider for composed components
    // Uses closure to access private #socket field
    const internalSocketProvider: ISocketProvider = {
      getSocket: () => this.#socket,
    }

    // Use injected components or create defaults
    // Injection is primarily for testing purposes
    this.#stateManager = options?.stateManager ?? new ConnectionStateManager({logger: this.#logger})
    this.#eventDispatcher =
      options?.eventDispatcher ??
      new EventDispatcher({
        logger: this.#logger,
        socketProvider: internalSocketProvider,
        onHandlerError: options?.onHandlerError,
      })
    this.#roomManager =
      options?.roomManager ??
      new RoomManager({
        logger: this.#logger,
        roomTimeoutMs: this.#config.roomTimeoutMs,
        socketProvider: internalSocketProvider,
      })

    // Create force reconnect manager (SRP - handles reconnection orchestration)
    this.#forceReconnectManager = new ForceReconnectManager({
      logger: this.#logger,
      reconnectionStrategy: this.#reconnectionStrategy,
      onAttempt: () => this.handleForceReconnectAttempt(),
      onError: options?.onReconnectError,
    })
  }

  // ==========================================================================
  // Private: State Guards
  // ==========================================================================

  /**
   * Checks if connect() operation is allowed in current state.
   * @returns True if can connect (state is 'disconnected')
   */
  private canConnect(): boolean {
    return this.#stateManager.isDisconnected()
  }

  /**
   * Checks if disconnect() operation is allowed in current state.
   * @returns True if can disconnect (state is not 'disconnected')
   */
  private canDisconnect(): boolean {
    return !this.#stateManager.isDisconnected()
  }

  // ==========================================================================
  // ITransportClient Implementation
  // ==========================================================================

  public async connect(url: string): Promise<void> {
    // Validate URL before attempting connection (delegated to domain validator)
    validateTransportUrl(url)

    // Guard: Can only connect from disconnected state
    if (!this.canConnect()) {
      const state = this.#stateManager.getState()
      throw new InvalidOperationError(`Cannot connect from state '${state}'. Must be 'disconnected'.`)
    }

    // Already connected - no-op
    if (this.socket?.connected) {
      return
    }

    // If connection is already in progress, check for URL mismatch (race condition fix)
    if (this.#connectPromise) {
      if (this.#serverUrl && this.#serverUrl !== url) {
        throw new ConcurrentConnectionError(this.#serverUrl, url)
      }
      return this.#connectPromise
    }

    // Cleanup existing socket if present but not connected
    this.cleanupExistingSocket()

    // Store URL BEFORE creating promise (order matters for race condition check)
    this.#serverUrl = url

    // Reset force reconnect state on manual connect
    this.#forceReconnectManager.cancel()

    // Create mutex promise to deduplicate concurrent calls
    this.#connectPromise = this.establishConnection(url).finally(() => {
      this.#connectPromise = undefined
    })

    return this.#connectPromise
  }

  /**
   * Validates that a timeout value is a positive number.
   * @throws InvalidTimeoutError if timeout is invalid
   */
  private validateTimeout(value: number, parameterName: string): void {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new InvalidTimeoutError(value, parameterName)
    }
  }

  /**
   * Disconnects from the server.
   *
   * @remarks
   * WARNING: This clears ALL event handlers including pending once() handlers.
   * Use onHandlersCleared callback to be notified when handlers are dropped.
   */
  public async disconnect(): Promise<void> {
    // No-op if already disconnected
    if (this.#stateManager.isDisconnected()) {
      this.log('Already disconnected')
      return
    }

    // Cancel force reconnect and reset strategy state
    this.#forceReconnectManager.cancel()

    // Stop wake detection
    this.stopWakeDetection()

    const socket = this.socket
    if (!socket) {
      // Edge case: state not disconnected but socket doesn't exist
      // Fix state to match reality
      this.#stateManager.setState('disconnected')
      return
    }

    return new Promise((resolve) => {
      // Socket.IO handles its own internal listeners - we only clear application listeners
      // via EventDispatcher.clearAllHandlers() and RoomManager.clearRooms() below
      socket.disconnect()

      // Reset state
      this.#socket = undefined
      this.#stateManager.setState('disconnected')

      // Capture handler counts before clearing for notification
      const pendingCount = this.#eventDispatcher.pendingOnceHandlerCount
      const persistentCount = this.#eventDispatcher.getEventCount()

      // Clear component state
      this.#eventDispatcher.clearAllHandlers()
      this.#roomManager.clearRooms()
      this.#persistentHandlersRegistered = false

      // Notify if handlers were dropped
      if ((pendingCount > 0 || persistentCount > 0) && this.#onHandlersCleared) {
        try {
          this.#onHandlersCleared(pendingCount, persistentCount)
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error)
          this.log(`onHandlersCleared callback threw: ${errMsg}`)
        }
      }

      resolve()
    })
  }

  public getState(): ConnectionState {
    return this.#stateManager.getState()
  }

  public getClientId(): string | undefined {
    return this.socket?.id
  }

  public async isConnected(timeoutMs: number = 2000): Promise<boolean> {
    // Validate timeout if explicitly provided (non-default)
    if (timeoutMs !== 2000) {
      this.validateTimeout(timeoutMs, 'timeoutMs')
    }

    const socket = this.socket
    if (!socket?.connected) {
      return false
    }

    // Verify bidirectional communication with ping
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), timeoutMs)

      socket.volatile.emit('ping', {timestamp: Date.now()}, () => {
        clearTimeout(timeout)
        resolve(true)
      })
    })
  }

  public onStateChange(handler: ConnectionStateHandler): () => void {
    return this.#stateManager.onStateChange(handler)
  }

  public on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    return this.#eventDispatcher.on(event, handler)
  }

  public once<T = unknown>(event: string, handler: EventHandler<T>): void {
    this.#eventDispatcher.once(event, handler)
  }

  public async joinRoom(room: string): Promise<void> {
    return this.#roomManager.joinRoom(room)
  }

  public async leaveRoom(room: string): Promise<void> {
    return this.#roomManager.leaveRoom(room)
  }

  // Overload 1: Fire-and-forget (no third argument)
  public request(event: string, data?: unknown): void
  // Overload 2: With acknowledgment callback
  public request<T = unknown>(event: string, data: unknown, ack: (response: T) => void): void
  // Implementation
  public request<T = unknown>(event: string, data?: unknown, ack?: (response: T) => void): void {
    // Validate event name
    validateEventName(event)

    const socket = this.socket
    if (!socket?.connected) {
      throw new TransportNotConnectedError('request')
    }

    // Fire-and-forget (no callback)
    if (ack === undefined) {
      socket.emit(event, data)
      return
    }

    // With callback
    socket.emit(event, data, ack)
  }

  public requestWithAck<TResponse = unknown, TRequest = unknown>(
    event: string,
    data?: TRequest,
    options?: RequestOptions,
  ): Promise<TResponse> {
    // Validate event name
    validateEventName(event)

    const socket = this.socket
    if (!socket?.connected) {
      throw new TransportNotConnectedError('requestWithAck')
    }

    // Validate timeout if explicitly provided
    if (options?.timeout !== undefined) {
      this.validateTimeout(options.timeout, 'timeout')
    }

    const timeout = options?.timeout ?? this.#config.requestTimeoutMs

    return new Promise((resolve, reject) => {
      let handled = false

      const timer = setTimeout(() => {
        if (handled) return
        handled = true
        reject(new TransportRequestTimeoutError(event, timeout))
      }, timeout)

      socket.emit(event, data, (response: unknown) => {
        if (handled) return
        handled = true
        clearTimeout(timer)

        // Validate response structure
        if (!this.isValidResponse(response)) {
          reject(new InvalidResponseError(event, 'response must be an object with a boolean "success" property'))
          return
        }

        if (response.success && response.data !== undefined) {
          resolve(response.data as TResponse)
        } else if (response.success) {
          // Server returned success without data (void response)
          resolve(undefined as TResponse)
        } else {
          reject(new TransportRequestError(event, response.error))
        }
      })
    })
  }

  /**
   * Type guard to validate server response structure.
   */
  private isValidResponse(response: unknown): response is {data?: unknown; error?: string; success: boolean} {
    if (typeof response !== 'object' || response === null) {
      return false
    }

    const obj = response as Record<string, unknown>

    if (typeof obj.success !== 'boolean') {
      return false
    }

    // error must be undefined or string
    if (obj.error !== undefined && typeof obj.error !== 'string') {
      return false
    }

    return true
  }

  // ==========================================================================
  // Private: Connection Management
  // ==========================================================================

  /**
   * Establishes a new socket connection.
   */
  private establishConnection(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Increment connection ID to detect superseded connections
      this.#connectionId++
      const thisConnectionId = this.#connectionId

      this.#stateManager.setState('connecting')
      this.#initialConnectInProgress = true

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
      })

      const onConnect = (): void => {
        // Verify this is still the current connection
        if (this.#connectionId !== thisConnectionId) {
          this.log('Connection superseded, ignoring connect event')
          return
        }

        this.#stateManager.setState('connected')
        this.#initialConnectInProgress = false
        cleanup()

        // Register pending handlers
        this.#eventDispatcher.registerPendingHandlers()

        // Start wake detection
        this.startWakeDetection()

        resolve()
      }

      const onConnectError = (error: Error): void => {
        // Verify this is still the current connection
        if (this.#connectionId !== thisConnectionId) {
          this.log('Connection superseded, ignoring connect_error event')
          return
        }

        this.#stateManager.setState('disconnected')
        this.#initialConnectInProgress = false
        cleanup()

        // Cleanup socket and Manager listeners
        if (this.#socket) {
          // Remove Manager listeners to prevent duplicates on retry
          this.#socket.io.off('reconnect')
          this.#socket.io.off('reconnect_failed')

          this.#socket.disconnect()
          this.#socket = undefined
        }

        // Reset flag so next connect() will setup handlers again
        this.#persistentHandlersRegistered = false

        reject(new TransportConnectionError(url, error))
      }

      const cleanup = (): void => {
        this.#socket?.off('connect', onConnect)
        this.#socket?.off('connect_error', onConnectError)
      }

      this.#socket.on('connect', onConnect)
      this.#socket.once('connect_error', onConnectError)

      // Setup persistent handlers (only once per socket)
      if (!this.#persistentHandlersRegistered) {
        this.setupPersistentHandlers()
        this.#persistentHandlersRegistered = true
      }
    })
  }

  /**
   * Sets up persistent socket handlers for disconnect, reconnect, etc.
   */
  private setupPersistentHandlers(): void {
    const socket = this.socket
    if (!socket) return

    // Handle disconnect
    socket.on('disconnect', (reason: string) => {
      // Verify socket is still current
      if (this.socket !== socket) {
        this.log('Socket superseded, ignoring disconnect event')
        return
      }
      this.log(`Socket disconnected, reason: ${reason}, active: ${socket.active}`)
      this.#stateManager.setState(socket.active ? 'reconnecting' : 'disconnected')
    })

    // Handle successful reconnect
    socket.io.on('reconnect', (attemptNumber: number) => {
      // Capture current socket reference to avoid race conditions
      const currentSocket = this.socket

      // Verify socket is still current
      if (currentSocket !== socket) {
        this.log('Socket superseded, ignoring reconnect event')
        return
      }

      // Guard against concurrent reconnect handler execution
      if (this.#reconnectHandlerInProgress) {
        this.log('Reconnect handler already in progress, skipping duplicate execution')
        return
      }

      this.#reconnectHandlerInProgress = true
      try {
        this.log(`Built-in reconnect succeeded after ${attemptNumber} attempts`)
        this.#stateManager.setState('connected')

        // Skip re-registration during initial connect
        if (this.#initialConnectInProgress) {
          this.log('Skipping handler re-registration - initial connect in progress')
          return
        }

        // Re-register handlers (prevents listener accumulation)
        this.#eventDispatcher.clearSocketListeners()
        this.#eventDispatcher.registerPendingHandlers()

        // Rejoin rooms - verify socket is still current before rejoining
        if (currentSocket?.connected && this.socket === currentSocket) {
          this.#roomManager.rejoinRooms()
        } else if (!currentSocket?.connected) {
          // Retry after short delay if not yet connected
          setTimeout(() => {
            // Re-check socket is still current and connected
            if (currentSocket?.connected && this.socket === currentSocket) {
              this.#roomManager.rejoinRooms()
            }
          }, 50)
        }
      } finally {
        // Always reset flag to allow future reconnect handlers
        this.#reconnectHandlerInProgress = false
      }
    })

    // Handle reconnection failure
    socket.io.on('reconnect_failed', () => {
      // Verify socket is still current
      if (this.socket !== socket) {
        this.log('Socket superseded, ignoring reconnect_failed event')
        return
      }
      this.log('Built-in reconnection failed, starting force reconnect')
      this.#stateManager.setState('disconnected')
      this.#forceReconnectManager.schedule()
    })
  }

  /**
   * Cleans up existing socket if present.
   */
  private cleanupExistingSocket(): void {
    if (!this.#socket) return

    // Remove all persistent handlers to prevent duplicates on reconnect
    // Socket-level listener
    this.#socket.off('disconnect')

    // Manager-level listeners
    this.#socket.io.off('reconnect')
    this.#socket.io.off('reconnect_failed')

    this.#socket.disconnect()
    this.#socket = undefined

    this.#eventDispatcher.clearSocketListeners()
    this.#persistentHandlersRegistered = false
  }

  // ==========================================================================
  // Private: Force Reconnection (delegated to ForceReconnectManager)
  // ==========================================================================

  /**
   * Handles a force reconnection attempt.
   * Called by ForceReconnectManager when it's time to attempt reconnection.
   */
  private async handleForceReconnectAttempt(): Promise<void> {
    // Skip if already connected/connecting/reconnecting
    const currentState = this.#stateManager.getState()
    if (
      !this.#serverUrl ||
      currentState === 'connected' ||
      currentState === 'connecting' ||
      currentState === 'reconnecting'
    ) {
      this.log(`Force reconnect skipped (state=${currentState})`)
      return
    }

    // Cleanup old socket
    this.cleanupExistingSocket()

    // Attempt connection (throws on failure)
    await this.connect(this.#serverUrl)

    // Rejoin rooms on success - capture socket reference to prevent race conditions
    this.log(`Force reconnect succeeded, rejoining ${this.#roomManager.getJoinedRooms().size} rooms`)
    const reconnectedSocket = this.socket
    if (reconnectedSocket?.connected) {
      this.#roomManager.rejoinRooms()
    } else {
      // Retry after short delay if not yet connected
      setTimeout(() => {
        // Verify socket is still current and connected
        if (reconnectedSocket?.connected && this.socket === reconnectedSocket) {
          this.#roomManager.rejoinRooms()
        }
      }, 50)
    }
  }

  // ==========================================================================
  // Private: Wake Detection
  // ==========================================================================

  /**
   * Starts wake detection to handle sleep/hibernate recovery.
   */
  private startWakeDetection(): void {
    // Unsubscribe from previous if any
    this.stopWakeDetection()

    // Subscribe to wake events
    this.#wakeUnsubscribe = this.#wakeDetector.onWake(() => {
      this.handleWakeFromSleep()
    })

    // Start detection if not already active
    if (!this.#wakeDetector.isActive()) {
      this.#wakeDetector.start()
    }
  }

  /**
   * Stops wake detection.
   */
  private stopWakeDetection(): void {
    if (this.#wakeUnsubscribe) {
      this.#wakeUnsubscribe()
      this.#wakeUnsubscribe = undefined
    }

    if (this.#wakeDetector.isActive()) {
      this.#wakeDetector.stop()
    }
  }

  /**
   * Handles system wake from sleep.
   */
  private handleWakeFromSleep(): void {
    const state = this.#stateManager.getState()
    const socketConnected = this.socket?.connected ?? false

    // Only act if in disconnected or mismatched state
    if (state === 'disconnected' && this.#serverUrl) {
      this.log('Wake detected: state disconnected, restarting force reconnect')
      this.#forceReconnectManager.restart()
    } else if (state === 'connected' && !socketConnected) {
      this.log('Wake detected: state mismatch, triggering reconnect')

      // Validate before transition
      if (this.#stateManager.canTransitionTo('disconnected')) {
        try {
          // TOCTOU mitigation: State could change between check and set due to concurrent socket events
          this.#stateManager.setState('disconnected')
          this.#forceReconnectManager.restart()
        } catch (error) {
          // If state transition fails due to race condition, log and skip wake reconnect
          const errMsg = error instanceof Error ? error.message : String(error)
          this.log(`Wake reconnect failed due to state transition error: ${errMsg}`)
        }
      } else {
        this.log('Cannot transition to disconnected, skipping wake reconnect')
      }
    } else if (state === 'connecting' || state === 'reconnecting') {
      // Skip wake reconnect if already in progress
      this.log(`Skip wake reconnect: already in state '${state}'`)
    }
  }

  // ==========================================================================
  // Private: Utilities
  // ==========================================================================

  /**
   * Logs a debug message.
   */
  private log(message: string): void {
    this.#logger.debug(`[TransportClient] ${message}`)
  }
}

// ==========================================================================
// Backward Compatibility Export
// ==========================================================================

/**
 * Configuration with logger for backward compatibility.
 *
 * @deprecated Use {@link TransportClientOptions} instead.
 * This type will be removed in a future major version.
 *
 * @example Migration
 * ```typescript
 * // Before (deprecated):
 * const config: ClientConfigWithLogger = {
 *   connectTimeoutMs: 5000,
 *   logger: myLogger,
 * }
 *
 * // After (recommended):
 * const options: TransportClientOptions = {
 *   connectTimeoutMs: 5000,
 *   logger: myLogger,
 * }
 * ```
 *
 * @see {@link TransportClientOptions} for the new configuration type
 * @see {@link TransportClientConfig} for config-only options (no dependencies)
 * @see {@link TransportClientDependencies} for dependency injection options
 */
export type ClientConfigWithLogger = ClientConfig & {
  logger?: IClientLogger
}
