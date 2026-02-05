/**
 * No-op logger implementation that discards all log messages.
 * Used as default when no logger is provided.
 *
 * @remarks
 * This implementation exists in the infrastructure layer as it is a
 * concrete implementation of the IClientLogger interface. The interface
 * remains in core/interfaces for proper dependency inversion.
 */
export class NoOpClientLogger {
    debug(_message) {
        // No-op - intentionally empty
    }
    info(_message) {
        // No-op - intentionally empty
    }
    warn(_message) {
        // No-op - intentionally empty
    }
    error(_message, _error) {
        // No-op - intentionally empty
    }
}
//# sourceMappingURL=no-op-client-logger.js.map