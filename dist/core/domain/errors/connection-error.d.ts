/**
 * Connection Errors
 *
 * Errors related to discovering and connecting to running instances.
 */
/**
 * Base error for client connection failures.
 */
export declare class ConnectionError extends Error {
    constructor(message: string);
}
/**
 * Error thrown when no running instance is found.
 */
export declare class NoInstanceRunningError extends ConnectionError {
    constructor();
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when instance is found but process has crashed.
 */
export declare class InstanceCrashedError extends ConnectionError {
    readonly projectRoot?: string;
    constructor(projectRoot?: string);
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when connection to instance fails.
 */
export declare class ConnectionFailedError extends ConnectionError {
    readonly originalError?: Error;
    readonly port?: number;
    constructor(port?: number, originalError?: Error);
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when connection times out.
 */
export declare class ConnectionTimeoutError extends ConnectionError {
    readonly timeoutMs?: number;
    constructor(timeoutMs: number);
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when instance data is invalid or malformed.
 */
export declare class InvalidInstanceDataError extends ConnectionError {
    readonly field?: string;
    readonly value?: unknown;
    constructor(message: string, field?: string, value?: unknown);
    constructor(options: {
        message: string;
    });
}
//# sourceMappingURL=connection-error.d.ts.map