/**
 * Connection Errors
 *
 * Errors related to discovering and connecting to running instances.
 */
/**
 * Base error for client connection failures.
 */
export class ConnectionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConnectionError';
    }
}
/**
 * Error thrown when no running instance is found.
 */
export class NoInstanceRunningError extends ConnectionError {
    constructor(options) {
        const defaultMessage = 'No ByteRover instance is running. Start one with: brv';
        super(options?.message ?? defaultMessage);
        this.name = 'NoInstanceRunningError';
    }
}
/**
 * Error thrown when instance is found but process has crashed.
 */
export class InstanceCrashedError extends ConnectionError {
    projectRoot;
    constructor(projectRootOrOptions) {
        if (typeof projectRootOrOptions === 'object' && projectRootOrOptions !== null) {
            // Custom message override
            super(projectRootOrOptions.message);
        }
        else {
            // Auto-generate message
            const details = projectRootOrOptions ? ` in ${projectRootOrOptions}` : '';
            super(`ByteRover instance${details} has crashed. Please restart with: brv`);
            this.projectRoot = projectRootOrOptions;
        }
        this.name = 'InstanceCrashedError';
    }
}
/**
 * Error thrown when connection to instance fails.
 */
export class ConnectionFailedError extends ConnectionError {
    originalError;
    port;
    constructor(portOrOptions, originalError) {
        if (typeof portOrOptions === 'object' && portOrOptions !== null) {
            // Custom message override
            super(portOrOptions.message);
        }
        else {
            // Auto-generate message
            const portInfo = portOrOptions ? ` on port ${portOrOptions}` : '';
            const errorInfo = originalError ? `: ${originalError.message}` : '';
            super(`Failed to connect to ByteRover instance${portInfo}${errorInfo}`);
            this.port = portOrOptions;
            this.originalError = originalError;
        }
        this.name = 'ConnectionFailedError';
    }
}
/**
 * Error thrown when connection times out.
 */
export class ConnectionTimeoutError extends ConnectionError {
    timeoutMs;
    constructor(timeoutMsOrOptions) {
        if (typeof timeoutMsOrOptions === 'object' && timeoutMsOrOptions !== null) {
            // Custom message override
            super(timeoutMsOrOptions.message);
        }
        else {
            // Auto-generate message
            super(`Connection timed out after ${timeoutMsOrOptions}ms`);
            this.timeoutMs = timeoutMsOrOptions;
        }
        this.name = 'ConnectionTimeoutError';
    }
}
/**
 * Error thrown when instance data is invalid or malformed.
 */
export class InvalidInstanceDataError extends ConnectionError {
    field;
    value;
    constructor(messageOrOptions, field, value) {
        if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
            // Custom message override
            super(messageOrOptions.message);
        }
        else {
            // Auto-generate message
            super(`Invalid instance data: ${messageOrOptions}`);
            this.field = field;
            this.value = value;
        }
        this.name = 'InvalidInstanceDataError';
    }
}
//# sourceMappingURL=connection-error.js.map