import type {IReconnectionStrategy} from '../core/interfaces/i-reconnection-strategy.js'

/**
 * Configuration for exponential backoff reconnection strategy.
 */
export type ExponentialBackoffConfig = {
  /** Base delay in milliseconds (default: 5000) */
  readonly baseDelayMs?: number
  /** Maximum delay in milliseconds (default: 60000) */
  readonly maxDelayMs?: number
  /** Maximum number of attempts before giving up (default: 10) */
  readonly maxAttempts?: number
  /** Predefined delays array (overrides baseDelayMs/maxDelayMs if provided) */
  readonly delays?: readonly number[]
  /**
   * Maximum total time in milliseconds before giving up.
   * This provides an overall timeout regardless of attempt count.
   * Default: undefined (no total time limit)
   *
   * @remarks
   * When set, the strategy will stop reconnection attempts once
   * the total elapsed time since the first attempt exceeds this value.
   * This prevents users from waiting excessively long for reconnection.
   *
   * @example
   * ```typescript
   * // Give up after 5 minutes total, regardless of attempts
   * const strategy = new ExponentialBackoffStrategy({
   *   maxTotalTimeMs: 5 * 60 * 1000,
   * })
   * ```
   */
  readonly maxTotalTimeMs?: number
  /**
   * Jitter factor to randomize delays and prevent thundering herd.
   * Value between 0 and 1. Default: 0.5
   *
   * @remarks
   * When multiple clients disconnect simultaneously (e.g., server restart),
   * they would all reconnect at exactly the same times without jitter,
   * potentially overwhelming the server. Jitter randomizes the delay:
   * - jitterFactor = 0: No randomization (delay is exact)
   * - jitterFactor = 0.5: Delay varies from 50% to 100% of base delay
   * - jitterFactor = 1: Delay varies from 0% to 100% of base delay
   *
   * Formula: actualDelay = baseDelay * (1 - jitterFactor + Math.random() * jitterFactor)
   *
   * @example
   * ```typescript
   * // With jitterFactor = 0.5 and baseDelay = 5000ms:
   * // actualDelay will be between 2500ms and 5000ms
   * const strategy = new ExponentialBackoffStrategy({
   *   jitterFactor: 0.5,
   * })
   * ```
   */
  readonly jitterFactor?: number
}

/**
 * Default delays for force reconnection (exponential backoff).
 */
const DEFAULT_DELAYS: readonly number[] = [5000, 10_000, 20_000, 30_000, 60_000] as const

/**
 * Default maximum attempts.
 */
const DEFAULT_MAX_ATTEMPTS = 10

/**
 * Default jitter factor to prevent thundering herd.
 * 0.5 means delays vary from 50% to 100% of base delay.
 */
const DEFAULT_JITTER_FACTOR = 0.5

/**
 * Exponential backoff reconnection strategy.
 * Implements IReconnectionStrategy with configurable delays.
 *
 * @remarks
 * This strategy uses exponential backoff with configurable delays.
 * Once max attempts is reached or max total time exceeded, shouldContinue() returns false.
 *
 * @example
 * ```typescript
 * const strategy = new ExponentialBackoffStrategy({
 *   delays: [1000, 2000, 4000, 8000],
 *   maxAttempts: 5,
 * })
 *
 * strategy.getDelay(0) // 1000
 * strategy.getDelay(3) // 8000
 * strategy.getDelay(4) // 8000 (capped at last delay)
 * strategy.shouldContinue(5) // false (exceeded maxAttempts)
 * ```
 *
 * @example With total time limit
 * ```typescript
 * const strategy = new ExponentialBackoffStrategy({
 *   maxAttempts: 100,
 *   maxTotalTimeMs: 2 * 60 * 1000, // 2 minutes max
 * })
 *
 * // Will stop after 2 minutes regardless of attempt count
 * ```
 */
export class ExponentialBackoffStrategy implements IReconnectionStrategy {
  readonly #delays: readonly number[]
  readonly #maxAttempts: number
  readonly #maxTotalTimeMs: number | undefined
  readonly #jitterFactor: number

  /**
   * Timestamp when reconnection attempts started.
   * Set on first call to shouldContinue() or getDelay().
   * Reset by reset().
   */
  #startedAt: number | undefined

  constructor(config?: ExponentialBackoffConfig) {
    this.#delays = config?.delays ?? DEFAULT_DELAYS
    this.#maxAttempts = config?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
    this.#maxTotalTimeMs = config?.maxTotalTimeMs
    this.#jitterFactor = config?.jitterFactor ?? DEFAULT_JITTER_FACTOR

    // Validate configuration
    if (this.#delays.length === 0) {
      throw new Error('ExponentialBackoffStrategy: delays array cannot be empty')
    }

    // Validate each delay value is a positive finite number
    for (let i = 0; i < this.#delays.length; i++) {
      const delay = this.#delays[i]
      if (typeof delay !== 'number' || !Number.isFinite(delay) || delay <= 0) {
        throw new Error(`ExponentialBackoffStrategy: delays[${i}]=${delay} must be a positive finite number`)
      }
    }

    if (this.#maxAttempts <= 0) {
      throw new Error('ExponentialBackoffStrategy: maxAttempts must be positive')
    }
    if (this.#maxTotalTimeMs !== undefined && this.#maxTotalTimeMs <= 0) {
      throw new Error('ExponentialBackoffStrategy: maxTotalTimeMs must be positive')
    }
    if (this.#jitterFactor < 0 || this.#jitterFactor > 1) {
      throw new Error('ExponentialBackoffStrategy: jitterFactor must be between 0 and 1')
    }
  }

  /**
   * Ensures the strategy timer is started.
   * Initializes #startedAt on first call to any strategy method.
   *
   * @remarks
   * This provides a single initialization point to ensure accurate
   * maxTotalTimeMs tracking regardless of which method is called first.
   */
  private ensureStarted(): void {
    if (this.#startedAt === undefined) {
      this.#startedAt = Date.now()
    }
  }

  /**
   * Gets the delay for the given attempt with jitter applied.
   * Returns undefined if max attempts exceeded or max total time exceeded.
   *
   * @remarks
   * Jitter is applied to prevent thundering herd when multiple clients
   * reconnect simultaneously. The actual delay is randomized:
   * actualDelay = baseDelay * (1 - jitterFactor + Math.random() * jitterFactor)
   */
  public getDelay(attempt: number): number | undefined {
    // Ensure timer started before checking shouldContinue
    this.ensureStarted()

    if (!this.shouldContinue(attempt)) {
      return undefined
    }
    // Cap at last delay value
    const index = Math.min(attempt, this.#delays.length - 1)
    const baseDelay = this.#delays[index]

    // Apply jitter to prevent thundering herd
    // Formula: delay * (1 - jitter + random * jitter)
    // With jitter=0.5: delay varies from 0.5*base to 1.0*base
    const jitterMultiplier = 1 - this.#jitterFactor + Math.random() * this.#jitterFactor
    return Math.floor(baseDelay * jitterMultiplier)
  }

  /**
   * Resets the strategy state.
   * Clears the start timestamp for total time tracking.
   */
  public reset(): void {
    this.#startedAt = undefined
  }

  /**
   * Checks if reconnection should continue for the given attempt.
   * Returns false if max attempts exceeded or max total time exceeded.
   */
  public shouldContinue(attempt: number): boolean {
    // Ensure timer started (delegated to ensureStarted for consistency)
    this.ensureStarted()

    // Check max attempts
    if (attempt >= this.#maxAttempts) {
      return false
    }

    // Check max total time
    if (this.#maxTotalTimeMs !== undefined) {
      const elapsed = Date.now() - this.#startedAt!
      if (elapsed >= this.#maxTotalTimeMs) {
        return false
      }
    }

    return true
  }

  /**
   * Gets the elapsed time since reconnection attempts started.
   * Returns undefined if no attempts have been made yet.
   */
  public getElapsedTime(): number | undefined {
    if (this.#startedAt === undefined) {
      return undefined
    }
    return Date.now() - this.#startedAt
  }

  /**
   * Gets the remaining time before max total time is exceeded.
   * Returns undefined if no max total time is configured or no attempts have been made.
   */
  public getRemainingTime(): number | undefined {
    if (this.#maxTotalTimeMs === undefined || this.#startedAt === undefined) {
      return undefined
    }
    const elapsed = Date.now() - this.#startedAt
    return Math.max(0, this.#maxTotalTimeMs - elapsed)
  }
}

/**
 * Creates a default reconnection strategy for force reconnect scenarios.
 */
export function createDefaultReconnectionStrategy(): IReconnectionStrategy {
  return new ExponentialBackoffStrategy()
}
