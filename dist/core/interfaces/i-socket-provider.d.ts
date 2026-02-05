import type { ISocket } from './i-socket.js';
/**
 * Provides readonly access to a socket instance.
 *
 * This interface enables dependency injection of socket access without exposing
 * mutable state. Components that need socket access receive an ISocketProvider
 * in their constructor rather than the socket directly, eliminating the need
 * for public setter methods.
 *
 * @remarks
 * The socket may be undefined when not connected. Components should check
 * socket availability before use via the getSocket() method.
 *
 * Uses the abstract ISocket interface to maintain Clean Architecture principles.
 * Core interfaces should not depend on infrastructure libraries (Socket.IO).
 *
 * @internal
 * This interface is internal to the transport client module.
 * It is NOT exported from the package's public API.
 * External consumers should use ITransportClient methods instead.
 *
 * @example
 * ```typescript
 * class MyComponent {
 *   private readonly socketProvider: ISocketProvider
 *
 *   constructor(socketProvider: ISocketProvider) {
 *     this.socketProvider = socketProvider
 *   }
 *
 *   private getSocket(): ISocket | undefined {
 *     return this.socketProvider.getSocket()
 *   }
 * }
 * ```
 */
export interface ISocketProvider {
    /**
     * Gets the current socket instance.
     * Returns undefined when not connected.
     * @returns Socket instance or undefined
     */
    getSocket(): ISocket | undefined;
}
//# sourceMappingURL=i-socket-provider.d.ts.map