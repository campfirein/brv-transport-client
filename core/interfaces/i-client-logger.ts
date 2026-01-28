/**
 * Logger interface for the Socket.IO client component.
 *
 * This interface allows optional logging injection without creating
 * dependencies on the main codebase's logging utilities.
 *
 * @remarks
 * Follows Interface Segregation Principle - provides standard log levels
 * without requiring complex logging infrastructure.
 *
 * The default implementation (NoOpClientLogger) is located in the
 * infrastructure layer at `infra/no-op-client-logger.ts`.
 */
export interface IClientLogger {
  /**
   * Log a debug message.
   * Used for connection state changes, reconnection attempts, etc.
   *
   * @param message - The message to log
   */
  debug(message: string): void

  /**
   * Log an informational message.
   * Used for significant events that are part of normal operation.
   *
   * @param message - The message to log
   */
  info(message: string): void

  /**
   * Log a warning message.
   * Used for potentially problematic situations that don't prevent operation.
   *
   * @param message - The message to log
   */
  warn(message: string): void

  /**
   * Log an error message.
   * Used for error conditions that may affect operation.
   *
   * @param message - The message to log
   * @param error - Optional error object for stack trace
   */
  error(message: string, error?: Error): void
}
