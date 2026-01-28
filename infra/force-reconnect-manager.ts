import type {IClientLogger} from '../core/interfaces/i-client-logger.js'
import type {IForceReconnectManager} from '../core/interfaces/i-force-reconnect-manager.js'
import type {IReconnectionStrategy} from '../core/interfaces/i-reconnection-strategy.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Callback invoked when a reconnection attempt should be made.
 * @returns Promise that resolves on success, rejects on failure
 */
export type ReconnectAttemptCallback = () => Promise<void>

/**
 * Callback invoked when force reconnect fails.
 * @param error - The error that caused the reconnect failure
 * @param attemptNumber - The attempt number (1-based)
 */
export type ReconnectErrorCallback = (error: Error, attemptNumber: number) => void

/**
 * Configuration for ForceReconnectManager.
 */
export type ForceReconnectManagerConfig = {
  readonly logger: IClientLogger
  readonly reconnectionStrategy: IReconnectionStrategy
  readonly onAttempt: ReconnectAttemptCallback
  readonly onError?: ReconnectErrorCallback
}

// ============================================================================
// ForceReconnectManager
// ============================================================================

/**
 * Manages force reconnection after Socket.IO's built-in reconnection gives up.
 *
 * Responsibilities:
 * - Schedule reconnection attempts with exponential backoff
 * - Track attempt count
 * - Invoke callbacks for reconnection attempts and errors
 * - Provide clean cancellation
 *
 * @remarks
 * This class follows Single Responsibility Principle (SRP) by focusing
 * solely on force reconnection orchestration.
 *
 * @example
 * ```typescript
 * const manager = new ForceReconnectManager({
 *   logger: myLogger,
 *   reconnectionStrategy: new ExponentialBackoffStrategy(),
 *   onAttempt: async () => {
 *     await client.connect(url)
 *   },
 *   onError: (error, attempt) => {
 *     console.error(`Reconnect attempt ${attempt} failed:`, error)
 *   },
 * })
 *
 * // Start force reconnection
 * manager.schedule()
 *
 * // Cancel if needed
 * manager.cancel()
 * ```
 */
export class ForceReconnectManager implements IForceReconnectManager {
  readonly #logger: IClientLogger
  readonly #reconnectionStrategy: IReconnectionStrategy
  readonly #onAttempt: ReconnectAttemptCallback
  readonly #onError?: ReconnectErrorCallback

  #attempt: number = 0
  #timer: NodeJS.Timeout | undefined
  #isScheduled: boolean = false

  constructor(config: ForceReconnectManagerConfig) {
    this.#logger = config.logger
    this.#reconnectionStrategy = config.reconnectionStrategy
    this.#onAttempt = config.onAttempt
    this.#onError = config.onError
  }

  /**
   * Returns whether a reconnection is currently scheduled.
   */
  public get isScheduled(): boolean {
    return this.#isScheduled
  }

  /**
   * Returns the current attempt count.
   */
  public get attemptCount(): number {
    return this.#attempt
  }

  /**
   * Schedules the next force reconnect attempt.
   * If already scheduled, this is a no-op.
   */
  public schedule(): void {
    if (this.#isScheduled) {
      this.log('Already scheduled, skipping')
      return
    }

    const delay = this.#reconnectionStrategy.getDelay(this.#attempt)
    if (delay === undefined) {
      this.log('Reconnection strategy returned no delay, giving up')
      return
    }

    this.log(`Scheduling force reconnect attempt ${this.#attempt + 1} in ${delay}ms`)
    this.#isScheduled = true

    this.#timer = setTimeout(() => {
      this.#isScheduled = false
      this.#attempt++
      void this.executeAttempt()
    }, delay)
  }

  /**
   * Clears the scheduled timer without resetting the attempt counter.
   * Useful when connection succeeds externally.
   */
  public clearTimer(): void {
    if (this.#timer) {
      clearTimeout(this.#timer)
      this.#timer = undefined
    }
    this.#isScheduled = false
  }

  /**
   * Cancels force reconnection completely (timer + counter).
   * Resets the reconnection strategy state.
   */
  public cancel(): void {
    this.clearTimer()
    this.#attempt = 0
    this.#reconnectionStrategy.reset()
  }

  /**
   * Resets the attempt counter and strategy state.
   * Call this after a successful connection.
   */
  public reset(): void {
    this.#attempt = 0
    this.#reconnectionStrategy.reset()
  }

  /**
   * Restarts force reconnection from attempt 0.
   * Useful after wake from sleep.
   */
  public restart(): void {
    this.clearTimer()
    this.reset()
    this.schedule()
  }

  /**
   * Executes the reconnection attempt.
   */
  private async executeAttempt(): Promise<void> {
    // Check if should continue
    if (!this.#reconnectionStrategy.shouldContinue(this.#attempt - 1)) {
      this.log('Force reconnect gave up after max attempts')
      return
    }

    this.log(`Force reconnect attempt ${this.#attempt}`)

    try {
      await this.#onAttempt()
      // Success - reset counter
      this.reset()
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.log(`Force reconnect failed: ${err.message}`)

      // Notify via callback for observability
      if (this.#onError) {
        try {
          this.#onError(err, this.#attempt)
        } catch (callbackError) {
          const callbackErrMsg = callbackError instanceof Error ? callbackError.message : String(callbackError)
          this.log(`onError callback threw: ${callbackErrMsg}`)
        }
      }

      // Schedule next attempt
      this.schedule()
    }
  }

  /**
   * Logs a debug message.
   */
  private log(message: string): void {
    this.#logger.debug(`[ForceReconnectManager] ${message}`)
  }
}
