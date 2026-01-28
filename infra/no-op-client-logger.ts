import type {IClientLogger} from '../core/interfaces/i-client-logger.js'

/**
 * No-op logger implementation that discards all log messages.
 * Used as default when no logger is provided.
 *
 * @remarks
 * This implementation exists in the infrastructure layer as it is a
 * concrete implementation of the IClientLogger interface. The interface
 * remains in core/interfaces for proper dependency inversion.
 */
export class NoOpClientLogger implements IClientLogger {
  debug(_message: string): void {
    // No-op - intentionally empty
  }

  info(_message: string): void {
    // No-op - intentionally empty
  }

  warn(_message: string): void {
    // No-op - intentionally empty
  }

  error(_message: string, _error?: Error): void {
    // No-op - intentionally empty
  }
}
