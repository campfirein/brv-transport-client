import type { IRoomManager } from '../core/interfaces/i-room-manager.js';
import type { IClientLogger } from '../core/interfaces/i-client-logger.js';
import type { ISocketProvider } from '../core/interfaces/i-socket-provider.js';
/**
 * Public configuration for RoomManager.
 * Follows Interface Segregation Principle - exposes only necessary options.
 */
export type RoomManagerConfig = {
    /** Timeout for room operations in milliseconds (default: 2000) */
    readonly roomTimeoutMs?: number;
    /** Logger for debugging (default: NoOpClientLogger) */
    readonly logger?: IClientLogger;
    /** Socket provider for accessing the socket instance (required) */
    readonly socketProvider: ISocketProvider;
};
/**
 * Internal tuning parameters for rejoin behavior.
 * Not exposed in public API - implementation detail.
 * @internal
 */
type InternalRejoinConfig = {
    /** Maximum rejoin attempts after reconnect (default: 5) */
    readonly maxRejoinAttempts?: number;
    /** Base delay for rejoin retry in milliseconds (default: 50) */
    readonly rejoinBaseDelayMs?: number;
};
/**
 * Full internal configuration type.
 * @internal
 */
type InternalRoomManagerConfig = RoomManagerConfig & InternalRejoinConfig;
/**
 * Manages room subscriptions for targeted broadcasts.
 * Handles join, leave, and auto-rejoin on reconnect.
 *
 * @remarks
 * - Tracks joined rooms for auto-rejoin after reconnect
 * - Uses exponential backoff for rejoin retries
 * - All operations have timeout protection
 * - Uses AbortController for clean cancellation of rejoin operations
 *
 * @example
 * ```typescript
 * const roomManager = new RoomManager()
 * roomManager.setSocket(socket)
 *
 * await roomManager.joinRoom('my-room')
 * console.log(roomManager.getJoinedRooms()) // Set { 'my-room' }
 *
 * // After reconnect
 * roomManager.rejoinRooms()
 *
 * await roomManager.leaveRoom('my-room')
 * ```
 */
export declare class RoomManager implements IRoomManager {
    #private;
    constructor(config: InternalRoomManagerConfig);
    /**
     * Gets the current socket from the provider.
     * @returns Socket instance or undefined if not connected
     */
    private get socket();
    /**
     * Gets the set of currently joined rooms.
     * Returns a defensive copy to prevent external mutation.
     * @returns Set of room identifiers (immutable copy)
     */
    getJoinedRooms(): ReadonlySet<string>;
    /**
     * Joins a room for targeted broadcasts.
     * @throws InvalidRoomNameError if room name is invalid
     * @throws TransportNotConnectedError if not connected
     * @throws TransportRoomTimeoutError if join times out
     * @throws TransportRoomError if join fails
     */
    joinRoom(room: string): Promise<void>;
    /**
     * Leaves a previously joined room.
     * @throws InvalidRoomNameError if room name is invalid
     * @throws TransportNotConnectedError if not connected
     * @throws TransportRoomTimeoutError if leave times out
     * @throws TransportRoomError if leave fails
     */
    leaveRoom(room: string): Promise<void>;
    /**
     * Rejoins all tracked rooms after reconnect.
     * Skips rooms that already have an active rejoin operation in progress.
     */
    rejoinRooms(): void;
    /**
     * Clears all tracked rooms and cancels pending rejoin operations.
     */
    clearRooms(): void;
    /**
     * Cancels rejoin operation for a specific room.
     */
    private cancelRejoin;
    /**
     * Creates a cancellable delay using AbortSignal.
     * @returns Promise that resolves after delay or rejects if aborted
     */
    private delay;
    /**
     * Rejoins a single room with retry logic and timeout protection.
     * Uses exponential backoff: 50ms, 100ms, 200ms, 400ms, 800ms (max 5 attempts).
     * Cancellable via AbortSignal for clean cleanup.
     */
    private rejoinRoomWithRetry;
    /**
     * Attempts to join a room with timeout protection.
     * @returns true if join succeeded, false if failed
     * @throws Error if aborted or timed out
     */
    private attemptRoomJoin;
    /**
     * Logs a message with prefix.
     */
    private log;
}
export {};
//# sourceMappingURL=room-manager.d.ts.map