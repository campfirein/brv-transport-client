import type { IReconnectionStrategy } from '../core/interfaces/i-reconnection-strategy.js';
/**
 * Configuration for exponential backoff reconnection strategy.
 */
export type ExponentialBackoffConfig = {
    /** Base delay in milliseconds (default: 5000) */
    readonly baseDelayMs?: number;
    /** Maximum delay in milliseconds (default: 60000) */
    readonly maxDelayMs?: number;
    /** Maximum number of attempts before giving up (default: 10) */
    readonly maxAttempts?: number;
    /** Predefined delays array (overrides baseDelayMs/maxDelayMs if provided) */
    readonly delays?: readonly number[];
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
    readonly maxTotalTimeMs?: number;
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
    readonly jitterFactor?: number;
};
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
export declare class ExponentialBackoffStrategy implements IReconnectionStrategy {
    #private;
    constructor(config?: ExponentialBackoffConfig);
    /**
     * Ensures the strategy timer is started.
     * Initializes #startedAt on first call to any strategy method.
     *
     * @remarks
     * This provides a single initialization point to ensure accurate
     * maxTotalTimeMs tracking regardless of which method is called first.
     */
    private ensureStarted;
    /**
     * Gets the delay for the given attempt with jitter applied.
     * Returns undefined if max attempts exceeded or max total time exceeded.
     *
     * @remarks
     * Jitter is applied to prevent thundering herd when multiple clients
     * reconnect simultaneously. The actual delay is randomized:
     * actualDelay = baseDelay * (1 - jitterFactor + Math.random() * jitterFactor)
     */
    getDelay(attempt: number): number | undefined;
    /**
     * Resets the strategy state.
     * Clears the start timestamp for total time tracking.
     */
    reset(): void;
    /**
     * Checks if reconnection should continue for the given attempt.
     * Returns false if max attempts exceeded or max total time exceeded.
     */
    shouldContinue(attempt: number): boolean;
    /**
     * Gets the elapsed time since reconnection attempts started.
     * Returns undefined if no attempts have been made yet.
     */
    getElapsedTime(): number | undefined;
    /**
     * Gets the remaining time before max total time is exceeded.
     * Returns undefined if no max total time is configured or no attempts have been made.
     */
    getRemainingTime(): number | undefined;
}
/**
 * Creates a default reconnection strategy for force reconnect scenarios.
 */
export declare function createDefaultReconnectionStrategy(): IReconnectionStrategy;
//# sourceMappingURL=reconnection-strategy.d.ts.map