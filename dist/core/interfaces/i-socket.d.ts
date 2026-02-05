/**
 * Abstract socket interface for transport client components.
 *
 * This interface abstracts the Socket.IO socket type to maintain Clean Architecture
 * principles. Core interfaces should not depend on infrastructure libraries.
 *
 * @remarks
 * The concrete Socket.IO implementation is adapted to this interface in the
 * infrastructure layer. This allows components in the core layer to depend
 * on abstractions rather than the concrete Socket.IO library.
 *
 * @internal
 * This interface is internal to the transport client module.
 * It is NOT exported from the package's public API.
 * External consumers should use ITransportClient methods instead.
 */
export interface ISocket {
    /**
     * Whether the socket is currently connected.
     */
    readonly connected: boolean;
    /**
     * The unique socket ID assigned by the server.
     * May be undefined before connection is established.
     */
    readonly id?: string;
    /**
     * Emits an event to the server.
     *
     * @param event - The event name
     * @param args - Arguments to send with the event
     */
    emit(event: string, ...args: unknown[]): void;
    /**
     * Registers a persistent event listener.
     *
     * @param event - The event name to listen for
     * @param handler - Function to call when event is received
     */
    on(event: string, handler: (data: unknown) => void): void;
    /**
     * Removes event listener(s) for an event.
     *
     * @param event - The event name to stop listening for
     */
    off(event: string): void;
    /**
     * Registers a one-time event listener.
     * Handler is automatically removed after first invocation.
     *
     * @param event - The event name to listen for
     * @param handler - Function to call when event is received
     */
    once(event: string, handler: (data: unknown) => void): void;
}
//# sourceMappingURL=i-socket.d.ts.map