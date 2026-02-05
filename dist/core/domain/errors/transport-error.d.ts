/**
 * Transport Client Errors
 *
 * These are client-side transport errors only.
 * Server-side errors (TransportServerNotStartedError, etc.) remain in the main codebase.
 */
/**
 * Base error for transport layer failures.
 */
export declare class TransportError extends Error {
    constructor(message: string);
}
/**
 * Error thrown when a concurrent connection attempt is made with a different URL.
 */
export declare class ConcurrentConnectionError extends TransportError {
    readonly currentUrl?: string;
    readonly requestedUrl?: string;
    constructor(currentUrl: string, requestedUrl: string);
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when connection to server fails.
 */
export declare class TransportConnectionError extends TransportError {
    readonly originalError?: Error;
    readonly url?: string;
    constructor(url: string, originalError?: Error);
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when client is not connected to server.
 */
export declare class TransportNotConnectedError extends TransportError {
    readonly operation?: string;
    constructor(operation?: string);
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when a request times out.
 */
export declare class TransportRequestTimeoutError extends TransportError {
    readonly event?: string;
    readonly timeoutMs?: number;
    constructor(event: string, timeoutMs: number);
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when a request fails with server error.
 */
export declare class TransportRequestError extends TransportError {
    readonly event?: string;
    constructor(event: string, message?: string);
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when room operations fail.
 */
export declare class TransportRoomError extends TransportError {
    readonly operation?: 'join' | 'leave';
    readonly room?: string;
    constructor(room: string, operation: 'join' | 'leave');
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when room operation times out.
 */
export declare class TransportRoomTimeoutError extends TransportError {
    readonly operation?: 'join' | 'leave';
    readonly room?: string;
    readonly timeoutMs?: number;
    constructor(room: string, operation: 'join' | 'leave', timeoutMs: number);
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when the URL provided to connect() is invalid.
 */
export declare class InvalidTransportUrlError extends TransportError {
    readonly url?: string;
    readonly reason?: string;
    constructor(url: string, reason: string);
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when an invalid room name is provided.
 */
export declare class InvalidRoomNameError extends TransportError {
    readonly room?: string;
    readonly reason?: string;
    constructor(room: string, reason: string);
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when an invalid event name is provided.
 */
export declare class InvalidEventNameError extends TransportError {
    readonly event?: string;
    readonly reason?: string;
    constructor(event: string, reason: string);
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when server response has invalid structure.
 */
export declare class InvalidResponseError extends TransportError {
    readonly event?: string;
    readonly reason?: string;
    constructor(event: string, reason: string);
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when an invalid timeout value is provided.
 */
export declare class InvalidTimeoutError extends TransportError {
    readonly value?: number;
    readonly parameterName?: string;
    constructor(value: number, parameterName: string);
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when maximum pending once handlers limit is exceeded.
 * This occurs when `once()` is called before connection and the queue is full.
 */
export declare class MaxPendingOnceHandlersExceededError extends TransportError {
    readonly event?: string;
    readonly maxPendingHandlers?: number;
    constructor(event: string, maxPendingHandlers: number);
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when an invalid state transition is attempted.
 * State transitions must follow the defined state machine rules.
 */
export declare class InvalidStateTransitionError extends TransportError {
    readonly fromState?: string;
    readonly toState?: string;
    constructor(fromState: string, toState: string);
    constructor(options: {
        message: string;
    });
}
/**
 * Error thrown when an operation is attempted in an invalid state.
 */
export declare class InvalidOperationError extends TransportError {
    readonly operation?: string;
    readonly currentState?: string;
    constructor(message: string);
    constructor(operation: string, currentState: string);
}
//# sourceMappingURL=transport-error.d.ts.map