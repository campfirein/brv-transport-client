import type { EventHandler, IEventDispatcher } from '../core/interfaces/i-event-dispatcher.js';
import type { IClientLogger } from '../core/interfaces/i-client-logger.js';
import type { ISocketProvider } from '../core/interfaces/i-socket-provider.js';
/**
 * Callback for handler errors.
 * Called when an event handler throws an exception.
 */
export type HandlerErrorCallback = (event: string, error: Error, data: unknown) => void;
/**
 * Callback for callback errors (meta-error handler).
 * Called when onHandlerError callback itself throws an exception.
 */
export type CallbackErrorCallback = (callbackError: Error, originalEvent: string, originalError: Error) => void;
/**
 * Configuration for EventDispatcher.
 */
export type EventDispatcherConfig = {
    /** Logger for debugging (default: NoOpClientLogger) */
    readonly logger?: IClientLogger;
    /** Socket provider for accessing the socket instance (required) */
    readonly socketProvider: ISocketProvider;
    /**
     * Callback for handler errors.
     * Called when an event handler throws an exception, providing observability
     * for production debugging. Errors are still logged but this callback
     * allows custom error handling (e.g., reporting to error tracking service).
     */
    readonly onHandlerError?: HandlerErrorCallback;
    /**
     * Callback for callback errors (meta-error handler).
     * Called when onHandlerError callback itself throws an exception.
     * Provides visibility into error tracking service failures.
     */
    readonly onCallbackError?: CallbackErrorCallback;
    /**
     * Maximum number of pending once handlers to queue before connection.
     * Prevents memory leaks when connection never succeeds.
     * Default: 100
     */
    readonly maxPendingOnceHandlers?: number;
};
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
export declare class EventDispatcher implements IEventDispatcher {
    #private;
    private static readonly DEFAULT_MAX_PENDING_ONCE_HANDLERS;
    constructor(config: EventDispatcherConfig);
    /**
     * Gets the current socket from the provider.
     * @returns Socket instance or undefined if not connected
     */
    private get socket();
    /**
     * Gets the count of registered event types.
     * @returns Number of registered event types
     */
    getEventCount(): number;
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
    on<T = unknown>(event: string, handler: EventHandler<T>): () => void;
    /**
     * Registers a one-time event handler.
     * Handler is removed after first invocation.
     *
     * @param event - Event name to listen for
     * @param handler - Function to call when event is received
     * @throws InvalidEventNameError if event name is invalid
     */
    once<T = unknown>(event: string, handler: EventHandler<T>): void;
    /**
     * Registers all pending handlers on the socket.
     * Called after successful connection.
     */
    registerPendingHandlers(): void;
    /**
     * Clears all socket event listeners.
     * Used before re-registering to prevent listener accumulation.
     */
    clearSocketListeners(): void;
    /**
     * Clears all handlers and pending handlers.
     * Used during disconnect cleanup.
     */
    clearAllHandlers(): void;
    /**
     * Clears only pending once handlers.
     * Useful for explicit cleanup when connection attempts fail repeatedly.
     */
    clearPendingOnceHandlers(): void;
    /**
     * Gets the count of pending once handlers.
     */
    get pendingOnceHandlerCount(): number;
    /**
     * Registers a socket listener for an event if not already registered.
     */
    private registerSocketEventIfNeeded;
    /**
     * Wraps a handler with error handling.
     * Centralized wrapper to ensure consistent error handling across all handler types.
     *
     * @param event - Event name for error reporting
     * @param handler - Original handler to wrap
     * @param handlerType - Type of handler for error reporting
     * @returns Wrapped handler with try/catch error handling
     */
    private wrapHandlerWithErrorHandling;
    /**
     * Creates a wrapped once handler with error handling.
     * Ensures consistent error handling behavior between on() and once() handlers.
     *
     * @param event - Event name for error reporting
     * @param handler - Original handler to wrap
     * @returns Wrapped handler with try/catch error handling
     */
    private createWrappedOnceHandler;
    /**
     * Handles errors thrown by event handlers.
     * Centralizes error handling logic for both persistent and once handlers.
     *
     * @param event - Event name for error reporting
     * @param error - The error thrown by the handler
     * @param data - The event data that was passed to the handler
     * @param handlerType - Type of handler ('persistent' or 'once') for logging
     */
    private handleHandlerError;
    /**
     * Removes socket listener for an event.
     */
    private removeSocketEventListener;
}
//# sourceMappingURL=event-dispatcher.d.ts.map