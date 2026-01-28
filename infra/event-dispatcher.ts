import type {ISocket} from '../core/interfaces/i-socket.js'
import type {EventHandler, IEventDispatcher} from '../core/interfaces/i-event-dispatcher.js'
import type {IClientLogger} from '../core/interfaces/i-client-logger.js'
import type {ISocketProvider} from '../core/interfaces/i-socket-provider.js'
import {NoOpClientLogger} from './no-op-client-logger.js'
import {MaxPendingOnceHandlersExceededError} from '../core/domain/errors/transport-error.js'
import {validateEventName} from '../core/domain/validators/index.js'

/**
 * Wrapper type for storing event handlers with unknown types.
 */
type StoredEventHandler = (data: unknown) => void

/**
 * Stored once handler with event name for deferred registration.
 */
type StoredOnceHandler = {
  readonly event: string
  readonly handler: StoredEventHandler
}

/**
 * Callback for handler errors.
 * Called when an event handler throws an exception.
 */
export type HandlerErrorCallback = (event: string, error: Error, data: unknown) => void

/**
 * Callback for callback errors (meta-error handler).
 * Called when onHandlerError callback itself throws an exception.
 */
export type CallbackErrorCallback = (callbackError: Error, originalEvent: string, originalError: Error) => void

/**
 * Configuration for EventDispatcher.
 */
export type EventDispatcherConfig = {
  /** Logger for debugging (default: NoOpClientLogger) */
  readonly logger?: IClientLogger
  /** Socket provider for accessing the socket instance (required) */
  readonly socketProvider: ISocketProvider
  /**
   * Callback for handler errors.
   * Called when an event handler throws an exception, providing observability
   * for production debugging. Errors are still logged but this callback
   * allows custom error handling (e.g., reporting to error tracking service).
   */
  readonly onHandlerError?: HandlerErrorCallback
  /**
   * Callback for callback errors (meta-error handler).
   * Called when onHandlerError callback itself throws an exception.
   * Provides visibility into error tracking service failures.
   */
  readonly onCallbackError?: CallbackErrorCallback
  /**
   * Maximum number of pending once handlers to queue before connection.
   * Prevents memory leaks when connection never succeeds.
   * Default: 100
   */
  readonly maxPendingOnceHandlers?: number
}

/**
 * Manages event subscriptions and dispatching.
 * Implements Observer Pattern with support for persistent and one-time handlers.
 *
 * @remarks
 * - Handlers can be registered before socket connection is established
 * - Pending handlers are queued and registered when setSocket() is called
 * - Persistent handlers survive reconnects until explicitly unsubscribed
 * - One-time handlers are removed after first invocation
 *
 * @example
 * ```typescript
 * const dispatcher = new EventDispatcher()
 *
 * // Register handler before connection
 * const unsubscribe = dispatcher.on('message', (data) => {
 *   console.log('Received:', data)
 * })
 *
 * // Later, after connection established
 * dispatcher.setSocket(socket)
 * dispatcher.registerPendingHandlers()
 *
 * // Cleanup
 * unsubscribe()
 * ```
 */
export class EventDispatcher implements IEventDispatcher {
  private static readonly DEFAULT_MAX_PENDING_ONCE_HANDLERS = 100

  readonly #logger: IClientLogger
  readonly #socketProvider: ISocketProvider
  readonly #onHandlerError?: HandlerErrorCallback
  readonly #onCallbackError?: CallbackErrorCallback
  readonly #maxPendingOnceHandlers: number
  readonly #eventHandlers: Map<string, Set<StoredEventHandler>> = new Map()
  readonly #registeredSocketEvents: Set<string> = new Set()
  #pendingOnceHandlers: StoredOnceHandler[] = []

  constructor(config: EventDispatcherConfig) {
    this.#logger = config.logger ?? new NoOpClientLogger()
    this.#socketProvider = config.socketProvider
    this.#onHandlerError = config.onHandlerError
    this.#onCallbackError = config.onCallbackError
    this.#maxPendingOnceHandlers = config.maxPendingOnceHandlers ?? EventDispatcher.DEFAULT_MAX_PENDING_ONCE_HANDLERS
  }

  /**
   * Gets the current socket from the provider.
   * @returns Socket instance or undefined if not connected
   */
  private get socket(): ISocket | undefined {
    return this.#socketProvider.getSocket()
  }

  /**
   * Gets the count of registered event types.
   * @returns Number of registered event types
   */
  public getEventCount(): number {
    return this.#eventHandlers.size
  }

  /**
   * Registers a persistent event handler.
   * Handler persists until explicitly unsubscribed.
   *
   * @param event - Event name to listen for
   * @param handler - Function to call when event is received
   * @returns Unsubscribe function
   * @throws InvalidEventNameError if event name is invalid
   *
   * @remarks
   * BOUNDARY CAST: Socket.IO delivers unknown data; caller specifies T via generic.
   * Type guard not possible for generic T at runtime.
   */
  public on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    validateEventName(event)

    // Get or create handler set for this event
    if (!this.#eventHandlers.has(event)) {
      this.#eventHandlers.set(event, new Set())
    }

    // Wrap handler to match StoredEventHandler signature
    const wrappedHandler: StoredEventHandler = (data) => handler(data as T)
    const handlers = this.#eventHandlers.get(event)!
    handlers.add(wrappedHandler)

    // Register socket listener if connected and not already registered
    this.registerSocketEventIfNeeded(event)

    // Return unsubscribe function
    return () => {
      handlers.delete(wrappedHandler)
      // Clean up if no handlers remain for this event
      if (handlers.size === 0) {
        this.#eventHandlers.delete(event)
        this.removeSocketEventListener(event)
      }
    }
  }

  /**
   * Registers a one-time event handler.
   * Handler is removed after first invocation.
   *
   * @param event - Event name to listen for
   * @param handler - Function to call when event is received
   * @throws InvalidEventNameError if event name is invalid
   */
  public once<T = unknown>(event: string, handler: EventHandler<T>): void {
    validateEventName(event)

    const wrappedHandler: StoredEventHandler = (data) => handler(data as T)

    if (!this.socket?.connected) {
      // Queue for registration after connect, respecting max limit to prevent memory leaks
      if (this.#pendingOnceHandlers.length >= this.#maxPendingOnceHandlers) {
        throw new MaxPendingOnceHandlersExceededError(event, this.#maxPendingOnceHandlers)
      }
      this.#pendingOnceHandlers.push({event, handler: wrappedHandler})
      return
    }

    this.socket.once(event, this.createWrappedOnceHandler(event, wrappedHandler))
  }

  /**
   * Registers all pending handlers on the socket.
   * Called after successful connection.
   */
  public registerPendingHandlers(): void {
    // Register persistent handlers
    for (const event of this.#eventHandlers.keys()) {
      this.registerSocketEventIfNeeded(event)
    }

    // Register and clear once handlers
    if (this.socket && this.#pendingOnceHandlers.length > 0) {
      for (const {event, handler} of this.#pendingOnceHandlers) {
        this.socket.once(event, this.createWrappedOnceHandler(event, handler))
      }
      this.#pendingOnceHandlers.length = 0
    }
  }

  /**
   * Clears all socket event listeners.
   * Used before re-registering to prevent listener accumulation.
   */
  public clearSocketListeners(): void {
    if (!this.socket) return

    for (const event of this.#registeredSocketEvents) {
      this.socket.off(event)
    }

    this.#registeredSocketEvents.clear()
  }

  /**
   * Clears all handlers and pending handlers.
   * Used during disconnect cleanup.
   */
  public clearAllHandlers(): void {
    this.#eventHandlers.clear()
    this.#pendingOnceHandlers.length = 0
    this.#registeredSocketEvents.clear()
  }

  /**
   * Clears only pending once handlers.
   * Useful for explicit cleanup when connection attempts fail repeatedly.
   */
  public clearPendingOnceHandlers(): void {
    this.#pendingOnceHandlers.length = 0
  }

  /**
   * Gets the count of pending once handlers.
   */
  public get pendingOnceHandlerCount(): number {
    return this.#pendingOnceHandlers.length
  }

  /**
   * Registers a socket listener for an event if not already registered.
   */
  private registerSocketEventIfNeeded(event: string): void {
    if (!this.socket || this.#registeredSocketEvents.has(event)) {
      return
    }

    // Register dispatch listener on socket
    this.socket.on(event, (data: unknown) => {
      const handlers = this.#eventHandlers.get(event)
      if (handlers) {
        // Execute all persistent handlers with consistent error handling
        for (const h of handlers) {
          // Use centralized error handling wrapper for consistency
          this.wrapHandlerWithErrorHandling(event, h, 'persistent')(data)
        }
      }
    })

    this.#registeredSocketEvents.add(event)
  }

  /**
   * Wraps a handler with error handling.
   * Centralized wrapper to ensure consistent error handling across all handler types.
   *
   * @param event - Event name for error reporting
   * @param handler - Original handler to wrap
   * @param handlerType - Type of handler for error reporting
   * @returns Wrapped handler with try/catch error handling
   */
  private wrapHandlerWithErrorHandling(
    event: string,
    handler: StoredEventHandler,
    handlerType: 'once' | 'persistent',
  ): StoredEventHandler {
    return (data: unknown): void => {
      try {
        handler(data)
      } catch (error) {
        this.handleHandlerError(event, error, data, handlerType)
      }
    }
  }

  /**
   * Creates a wrapped once handler with error handling.
   * Ensures consistent error handling behavior between on() and once() handlers.
   *
   * @param event - Event name for error reporting
   * @param handler - Original handler to wrap
   * @returns Wrapped handler with try/catch error handling
   */
  private createWrappedOnceHandler(event: string, handler: StoredEventHandler): StoredEventHandler {
    return this.wrapHandlerWithErrorHandling(event, handler, 'once')
  }

  /**
   * Handles errors thrown by event handlers.
   * Centralizes error handling logic for both persistent and once handlers.
   *
   * @param event - Event name for error reporting
   * @param error - The error thrown by the handler
   * @param data - The event data that was passed to the handler
   * @param handlerType - Type of handler ('persistent' or 'once') for logging
   */
  private handleHandlerError(event: string, error: unknown, data: unknown, handlerType: 'once' | 'persistent'): void {
    const err = error instanceof Error ? error : new Error(String(error))
    const typeLabel = handlerType === 'once' ? 'Once handler' : 'Handler'
    this.#logger.debug(`[EventDispatcher] ${typeLabel} error for '${event}': ${err.message}`)

    // Call error callback if provided (for observability/error tracking)
    if (this.#onHandlerError) {
      try {
        this.#onHandlerError(event, err, data)
      } catch (callbackError) {
        // Prevent callback errors from breaking the event loop
        const callbackErr = callbackError instanceof Error ? callbackError : new Error(String(callbackError))
        this.#logger.warn(`[EventDispatcher] onHandlerError callback threw: ${callbackErr.message}`)

        // Notify via meta-callback for visibility into callback failures
        if (this.#onCallbackError) {
          try {
            this.#onCallbackError(callbackErr, event, err)
          } catch (metaCallbackError) {
            // Last resort - log the error so it's not completely silent
            const metaErr =
              metaCallbackError instanceof Error ? metaCallbackError : new Error(String(metaCallbackError))
            this.#logger.warn(`[EventDispatcher] onCallbackError callback also threw: ${metaErr.message}`)
          }
        }
      }
    }
  }

  /**
   * Removes socket listener for an event.
   */
  private removeSocketEventListener(event: string): void {
    if (this.socket && this.#registeredSocketEvents.has(event)) {
      this.socket.off(event)
      this.#registeredSocketEvents.delete(event)
    }
  }
}
