import {io, Socket} from 'socket.io-client'
import type {ManagerOptions, SocketOptions} from 'socket.io-client'

import type {SocketTransport} from '../core/domain/types.js'
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
  TRANSPORT_IS_CONNECTED_TIMEOUT_MS,
  TRANSPORT_RECONNECT_POLL_INTERVAL_MS,
  TRANSPORT_RECONNECT_WAIT_CONNECTED_MS,
  TRANSPORT_RECONNECTION_ATTEMPTS,
  TRANSPORT_RECONNECTION_DELAY_MAX_MS,
  TRANSPORT_RECONNECTION_DELAY_MS,
  TRANSPORT_REQUEST_TIMEOUT_MS,
  TRANSPORT_ROOM_REJOIN_SETTLE_MS,
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
   * Client's working directory. Sent to the server during connection handshake.
   * Transport-agnostic — the implementation decides how to transmit it
   * (e.g., Socket.IO query param, WebSocket header, etc.).
   */
  readonly cwd?: string
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
 * Used only within constructor via type assertion - not part of public API.
 * @internal
 */
type InternalTransportClientOptions = TransportClientOptions & {
  readonly stateManager?: ConnectionStateManager
  readonly eventDispatcher?: EventDispatcher
  readonly roomManager?: RoomManager
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Resolved (non-optional) configuration.
 */
type ResolvedConfig = {
  readonly connectTimeoutMs: number
  readonly cwd?: string
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

  // Daemon version captured from the most recent client:register ack.
  // Refreshed on every successful registration, including post-reconnect.
  #daemonVersion: string | undefined

  // Server URL resolver fallback (Tier 3 reconnection — daemon-aware)
  #serverUrlResolver: (() => Promise<string | undefined>) | undefined
  #urlResolveTimer: ReturnType<typeof setTimeout> | undefined
  #urlResolveAttempt: number = 0

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

  constructor(options?: TransportClientOptions) {
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
      cwd: options?.cwd,
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
    // Injection is for testing only — cast to internal type to access test deps
    // The public constructor signature hides these fields from consumers
    const internalOpts = options as InternalTransportClientOptions | undefined
    this.#stateManager = internalOpts?.stateManager ?? new ConnectionStateManager({logger: this.#logger})
    this.#eventDispatcher =
      internalOpts?.eventDispatcher ??
      new EventDispatcher({
        logger: this.#logger,
        socketProvider: internalSocketProvider,
        onHandlerError: options?.onHandlerError,
      })
    this.#roomManager =
      internalOpts?.roomManager ??
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
      onExhausted: () => {
        void this.handleServerUrlResolve()
      },
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

    // Reset URL resolve state on successful manual connect
    clearTimeout(this.#urlResolveTimer)
    this.#urlResolveTimer = undefined
    this.#urlResolveAttempt = 0

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

    // Clear URL resolve state (keep resolver — set once by connectToDaemon)
    clearTimeout(this.#urlResolveTimer)
    this.#urlResolveTimer = undefined
    this.#urlResolveAttempt = 0

    // Stop wake detection
    this.stopWakeDetection()

    const socket = this.socket
    if (!socket) {
      // Edge case: state not disconnected but socket doesn't exist
      // Fix state to match reality
      this.#stateManager.setState('disconnected')
      return
    }

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
  }

  public getState(): ConnectionState {
    return this.#stateManager.getState()
  }

  public getClientId(): string | undefined {
    return this.socket?.id
  }

  public getDaemonVersion(): string | undefined {
    return this.#daemonVersion
  }

  /**
   * Stores the daemon version reported in a `client:register` ack.
   * Called by the factory after parsing the ack; surfaced to consumers via
   * {@link getDaemonVersion}. Pass `undefined` to clear (e.g. when an older
   * daemon ack omits the field).
   */
  public setDaemonVersion(version: string | undefined): void {
    this.#daemonVersion = version
  }

  public async isConnected(timeoutMs: number = TRANSPORT_IS_CONNECTED_TIMEOUT_MS): Promise<boolean> {
    // Validate timeout if explicitly provided (non-default)
    if (timeoutMs !== TRANSPORT_IS_CONNECTED_TIMEOUT_MS) {
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
          reject(new TransportRequestError(event, response.error, response.code))
        }
      })
    })
  }

  /**
   * Type guard to validate server response structure.
   */
  private isValidResponse(
    response: unknown,
  ): response is {code?: string; data?: unknown; error?: string; success: boolean} {
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

    // code must be undefined or string
    if (obj.code !== undefined && typeof obj.code !== 'string') {
      return false
    }

    return true
  }

  // ==========================================================================
  // Public: Server URL Resolver (Tier 3 Reconnection)
  // ==========================================================================

  /**
   * Sets a fallback URL resolver for when all reconnection attempts are exhausted.
   * Called by connectToDaemon() to enable daemon-aware reconnection.
   *
   * When ForceReconnectManager exhausts all attempts (Tier 2), the resolver is
   * invoked to discover (and optionally spawn) the daemon on a new port.
   * If a new URL is returned, ForceReconnectManager restarts with fresh attempts.
   *
   * @param resolver - Async function that returns a new server URL, or undefined to give up
   */
  public setServerUrlResolver(resolver: () => Promise<string | undefined>): void {
    this.#serverUrlResolver = resolver
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

      // Build query: merge cwd (default) with user-provided query params.
      // WARNING: userQuery can override cwd. This is intentional for advanced use cases
      // (e.g., MCP server handling specific projects). See CLAUDE.md "Directory & Path Concepts".
      const baseQuery: Record<string, string> = {}
      if (this.#config.cwd) {
        baseQuery.cwd = this.#config.cwd
      }

      const userQuery = this.#config.socketOptions?.query
      const mergedQuery = userQuery ? {...baseQuery, ...userQuery} : baseQuery

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

        // Merged query (cwd + user query) — applied last to ensure query is set correctly
        query: mergedQuery,
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

      // Helper: Wait for socket.connected to be true
      // Socket.IO may fire 'reconnect' event before socket is fully ready
      const waitForSocketConnected = (): Promise<boolean> => {
        return new Promise((resolve) => {
          if (socket.connected) {
            resolve(true)
            return
          }
          this.log('Reconnect event fired but socket not yet connected, waiting...')
          const startTime = Date.now()
          const checkInterval = setInterval(() => {
            if (socket.connected) {
              clearInterval(checkInterval)
              this.log('Socket now connected after waiting')
              resolve(true)
            } else if (Date.now() - startTime > TRANSPORT_RECONNECT_WAIT_CONNECTED_MS) {
              clearInterval(checkInterval)
              this.log(
                `Timeout waiting for socket.connected (${TRANSPORT_RECONNECT_WAIT_CONNECTED_MS}ms), proceeding anyway`,
              )
              resolve(false)
            }
          }, TRANSPORT_RECONNECT_POLL_INTERVAL_MS)
        })
      }

      // Wait for socket to be actually connected before proceeding
      void waitForSocketConnected()
        .then((isConnected) => {
          // Verify socket is still current after waiting
          if (this.socket !== currentSocket) {
            this.log('Socket superseded during wait, aborting reconnect handler')
            return
          }

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

          // Rejoin rooms - only if socket is confirmed connected
          if (isConnected && currentSocket?.connected && this.socket === currentSocket) {
            this.#roomManager.rejoinRooms()
          }
        })
        .finally(() => {
          // Always reset flag to allow future reconnect handlers
          this.#reconnectHandlerInProgress = false
        })
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
      }, TRANSPORT_ROOM_REJOIN_SETTLE_MS)
    }
  }

  // ==========================================================================
  // Private: Server URL Resolution (Tier 3 Reconnection)
  // ==========================================================================

  /**
   * Attempts to resolve a new server URL after ForceReconnectManager exhausts.
   * Called via onExhausted callback when all Tier 2 reconnect attempts fail.
   *
   * On success: updates #serverUrl and restarts ForceReconnectManager.
   * On failure: retries with exponential backoff (2s → 30s cap).
   */
  private async handleServerUrlResolve(): Promise<void> {
    if (!this.#serverUrlResolver) return
    if (!this.#stateManager.isDisconnected()) return

    this.#urlResolveAttempt++
    this.log(`Server URL resolve attempt ${this.#urlResolveAttempt}`)

    try {
      const newUrl = await this.#serverUrlResolver()
      if (!newUrl) {
        this.log('Server URL resolver returned no URL')
        this.scheduleUrlResolveRetry()
        return
      }

      this.log(`Resolved new server URL: ${newUrl}`)
      this.#serverUrl = newUrl
      this.#urlResolveAttempt = 0
      this.#forceReconnectManager.restart()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.log(`Server URL resolve failed: ${message}`)
      this.scheduleUrlResolveRetry()
    }
  }

  /**
   * Schedules the next URL resolve retry with exponential backoff.
   */
  private scheduleUrlResolveRetry(): void {
    if (!this.#stateManager.isDisconnected()) return

    const baseDelay = 2000
    const maxDelay = 30_000
    const backoff = 1.5
    const delay = Math.min(baseDelay * Math.pow(backoff, this.#urlResolveAttempt - 1), maxDelay)
    this.log(`Scheduling URL resolve retry in ${Math.round(delay)}ms`)
    this.#urlResolveTimer = setTimeout(() => {
      void this.handleServerUrlResolve()
    }, delay)
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
