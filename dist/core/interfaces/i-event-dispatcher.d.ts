/**
 * Handler function for events.
 */
export type EventHandler<T = unknown> = (data: T) => void;
/**
 * Public interface for managing event subscriptions.
 * Follows Observer Pattern for event handling.
 *
 * @remarks
 * This interface exposes only what consumers need.
 * Handlers can be registered before connection is established.
 * Implementations should queue handlers and register them on connect.
 */
export interface IEventDispatcher {
    /**
     * Registers a persistent event handler.
     * Handler persists across reconnects until explicitly unsubscribed.
     *
     * @param event - Event name to listen for
     * @param handler - Function to call when event is received
     * @returns Unsubscribe function to remove the handler
     */
    on<T = unknown>(event: string, handler: EventHandler<T>): () => void;
    /**
     * Registers a one-time event handler.
     * Handler is automatically removed after first invocation.
     *
     * @param event - Event name to listen for
     * @param handler - Function to call when event is received
     */
    once<T = unknown>(event: string, handler: EventHandler<T>): void;
}
//# sourceMappingURL=i-event-dispatcher.d.ts.map