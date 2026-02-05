/**
 * Client Configuration Types
 *
 * These are configuration types for Socket.IO client setup.
 */
/**
 * Socket.IO transport types.
 * 'websocket' is preferred for sandboxed environments (like IDE terminals).
 * 'polling' uses HTTP long-polling which may be blocked by some sandboxes.
 */
export type SocketTransport = 'polling' | 'websocket';
/**
 * Configuration for Socket.IO client.
 */
export type ClientConfig = {
    /**
     * Connection timeout in milliseconds.
     */
    connectTimeoutMs?: number;
    /**
     * Number of reconnection attempts before giving up.
     */
    reconnectionAttempts?: number;
    /**
     * Maximum reconnection delay in milliseconds.
     */
    reconnectionDelayMaxMs?: number;
    /**
     * Initial reconnection delay in milliseconds.
     */
    reconnectionDelayMs?: number;
    /**
     * Default request timeout in milliseconds.
     */
    requestTimeoutMs?: number;
    /**
     * Room operation timeout in milliseconds.
     */
    roomTimeoutMs?: number;
    /**
     * Socket.IO transport types to use.
     * Defaults to ['websocket'] to avoid HTTP polling issues in sandboxed environments.
     * Set to ['polling', 'websocket'] for default Socket.IO behavior.
     */
    transports?: SocketTransport[];
};
//# sourceMappingURL=types.d.ts.map