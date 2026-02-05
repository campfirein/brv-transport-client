/**
 * Transport Client Errors
 *
 * These are client-side transport errors only.
 * Server-side errors (TransportServerNotStartedError, etc.) remain in the main codebase.
 */
/**
 * Base error for transport layer failures.
 */
export class TransportError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TransportError';
    }
}
/**
 * Error thrown when a concurrent connection attempt is made with a different URL.
 */
export class ConcurrentConnectionError extends TransportError {
    currentUrl;
    requestedUrl;
    constructor(currentUrlOrOptions, requestedUrl) {
        if (typeof currentUrlOrOptions === 'object' && currentUrlOrOptions !== null) {
            // Custom message override
            super(currentUrlOrOptions.message);
        }
        else {
            // Auto-generate message
            super(`Connection already in progress to ${currentUrlOrOptions}. Cannot connect to ${requestedUrl} concurrently.`);
            this.currentUrl = currentUrlOrOptions;
            this.requestedUrl = requestedUrl;
        }
        this.name = 'ConcurrentConnectionError';
    }
}
/**
 * Error thrown when connection to server fails.
 */
export class TransportConnectionError extends TransportError {
    originalError;
    url;
    constructor(urlOrOptions, originalError) {
        if (typeof urlOrOptions === 'object' && urlOrOptions !== null) {
            // Custom message override
            super(urlOrOptions.message);
        }
        else {
            // Auto-generate message
            super(`Connection failed to ${urlOrOptions}${originalError ? `: ${originalError.message}` : ''}`);
            this.url = urlOrOptions;
            this.originalError = originalError;
        }
        this.name = 'TransportConnectionError';
    }
}
/**
 * Error thrown when client is not connected to server.
 */
export class TransportNotConnectedError extends TransportError {
    operation;
    constructor(operationOrOptions) {
        if (typeof operationOrOptions === 'object' && operationOrOptions !== null) {
            // Custom message override
            super(operationOrOptions.message);
        }
        else {
            // Auto-generate message
            const operation = operationOrOptions ?? 'operation';
            super(`Not connected to server. Cannot perform: ${operation}`);
            this.operation = operationOrOptions;
        }
        this.name = 'TransportNotConnectedError';
    }
}
/**
 * Error thrown when a request times out.
 */
export class TransportRequestTimeoutError extends TransportError {
    event;
    timeoutMs;
    constructor(eventOrOptions, timeoutMs) {
        if (typeof eventOrOptions === 'object' && eventOrOptions !== null) {
            // Custom message override
            super(eventOrOptions.message);
        }
        else {
            // Auto-generate message
            super(`Request timeout for event '${eventOrOptions}' after ${timeoutMs}ms`);
            this.event = eventOrOptions;
            this.timeoutMs = timeoutMs;
        }
        this.name = 'TransportRequestTimeoutError';
    }
}
/**
 * Error thrown when a request fails with server error.
 */
export class TransportRequestError extends TransportError {
    event;
    constructor(eventOrOptions, message) {
        if (typeof eventOrOptions === 'object' && eventOrOptions !== null) {
            // Custom message override
            super(eventOrOptions.message);
        }
        else {
            // Auto-generate message
            const errorMessage = message ?? 'Request failed';
            super(`${errorMessage} for event '${eventOrOptions}'`);
            this.event = eventOrOptions;
        }
        this.name = 'TransportRequestError';
    }
}
/**
 * Error thrown when room operations fail.
 */
export class TransportRoomError extends TransportError {
    operation;
    room;
    constructor(roomOrOptions, operation) {
        if (typeof roomOrOptions === 'object' && roomOrOptions !== null) {
            // Custom message override
            super(roomOrOptions.message);
        }
        else {
            // Auto-generate message
            super(`Failed to ${operation} room '${roomOrOptions}'`);
            this.room = roomOrOptions;
            this.operation = operation;
        }
        this.name = 'TransportRoomError';
    }
}
/**
 * Error thrown when room operation times out.
 */
export class TransportRoomTimeoutError extends TransportError {
    operation;
    room;
    timeoutMs;
    constructor(roomOrOptions, operation, timeoutMs) {
        if (typeof roomOrOptions === 'object' && roomOrOptions !== null) {
            // Custom message override
            super(roomOrOptions.message);
        }
        else {
            // Auto-generate message
            super(`${operation === 'join' ? 'Join' : 'Leave'} room '${roomOrOptions}' timed out after ${timeoutMs}ms`);
            this.room = roomOrOptions;
            this.operation = operation;
            this.timeoutMs = timeoutMs;
        }
        this.name = 'TransportRoomTimeoutError';
    }
}
/**
 * Error thrown when the URL provided to connect() is invalid.
 */
export class InvalidTransportUrlError extends TransportError {
    url;
    reason;
    constructor(urlOrOptions, reason) {
        if (typeof urlOrOptions === 'object' && urlOrOptions !== null) {
            // Custom message override
            super(urlOrOptions.message);
        }
        else {
            // Auto-generate message
            super(`Invalid transport URL '${urlOrOptions}': ${reason}`);
            this.url = urlOrOptions;
            this.reason = reason;
        }
        this.name = 'InvalidTransportUrlError';
    }
}
/**
 * Error thrown when an invalid room name is provided.
 */
export class InvalidRoomNameError extends TransportError {
    room;
    reason;
    constructor(roomOrOptions, reason) {
        if (typeof roomOrOptions === 'object' && roomOrOptions !== null) {
            // Custom message override
            super(roomOrOptions.message);
        }
        else {
            // Auto-generate message
            super(`Invalid room name '${roomOrOptions}': ${reason}`);
            this.room = roomOrOptions;
            this.reason = reason;
        }
        this.name = 'InvalidRoomNameError';
    }
}
/**
 * Error thrown when an invalid event name is provided.
 */
export class InvalidEventNameError extends TransportError {
    event;
    reason;
    constructor(eventOrOptions, reason) {
        if (typeof eventOrOptions === 'object' && eventOrOptions !== null) {
            // Custom message override
            super(eventOrOptions.message);
        }
        else {
            // Auto-generate message
            super(`Invalid event name '${eventOrOptions}': ${reason}`);
            this.event = eventOrOptions;
            this.reason = reason;
        }
        this.name = 'InvalidEventNameError';
    }
}
/**
 * Error thrown when server response has invalid structure.
 */
export class InvalidResponseError extends TransportError {
    event;
    reason;
    constructor(eventOrOptions, reason) {
        if (typeof eventOrOptions === 'object' && eventOrOptions !== null) {
            // Custom message override
            super(eventOrOptions.message);
        }
        else {
            // Auto-generate message
            super(`Invalid response for event '${eventOrOptions}': ${reason}`);
            this.event = eventOrOptions;
            this.reason = reason;
        }
        this.name = 'InvalidResponseError';
    }
}
/**
 * Error thrown when an invalid timeout value is provided.
 */
export class InvalidTimeoutError extends TransportError {
    value;
    parameterName;
    constructor(valueOrOptions, parameterName) {
        if (typeof valueOrOptions === 'object' && valueOrOptions !== null) {
            // Custom message override
            super(valueOrOptions.message);
        }
        else {
            // Auto-generate message
            super(`Invalid timeout value ${valueOrOptions} for '${parameterName}': must be a positive number`);
            this.value = valueOrOptions;
            this.parameterName = parameterName;
        }
        this.name = 'InvalidTimeoutError';
    }
}
/**
 * Error thrown when maximum pending once handlers limit is exceeded.
 * This occurs when `once()` is called before connection and the queue is full.
 */
export class MaxPendingOnceHandlersExceededError extends TransportError {
    event;
    maxPendingHandlers;
    constructor(eventOrOptions, maxPendingHandlers) {
        if (typeof eventOrOptions === 'object' && eventOrOptions !== null) {
            // Custom message override
            super(eventOrOptions.message);
        }
        else {
            // Auto-generate message
            super(`Cannot queue once handler for '${eventOrOptions}': maximum pending handlers (${maxPendingHandlers}) exceeded. ` +
                `Either establish connection first, or increase maxPendingOnceHandlers configuration.`);
            this.event = eventOrOptions;
            this.maxPendingHandlers = maxPendingHandlers;
        }
        this.name = 'MaxPendingOnceHandlersExceededError';
    }
}
/**
 * Error thrown when an invalid state transition is attempted.
 * State transitions must follow the defined state machine rules.
 */
export class InvalidStateTransitionError extends TransportError {
    fromState;
    toState;
    constructor(fromStateOrOptions, toState) {
        if (typeof fromStateOrOptions === 'object' && fromStateOrOptions !== null) {
            // Custom message override
            super(fromStateOrOptions.message);
        }
        else {
            // Auto-generate message
            super(`Invalid state transition: ${fromStateOrOptions} → ${toState}`);
            this.fromState = fromStateOrOptions;
            this.toState = toState;
        }
        this.name = 'InvalidStateTransitionError';
    }
}
/**
 * Error thrown when an operation is attempted in an invalid state.
 */
export class InvalidOperationError extends TransportError {
    operation;
    currentState;
    constructor(messageOrOperation, currentState) {
        if (currentState) {
            // Auto-generate message from operation + state
            super(`Operation '${messageOrOperation}' not allowed in state '${currentState}'`);
            this.operation = messageOrOperation;
            this.currentState = currentState;
        }
        else {
            // Custom message
            super(messageOrOperation);
        }
        this.name = 'InvalidOperationError';
    }
}
//# sourceMappingURL=transport-error.js.map