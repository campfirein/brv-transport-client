import type { IClientLogger } from '../core/interfaces/i-client-logger.js';
import type { IForceReconnectManager } from '../core/interfaces/i-force-reconnect-manager.js';
import type { IReconnectionStrategy } from '../core/interfaces/i-reconnection-strategy.js';
/**
 * Callback invoked when a reconnection attempt should be made.
 * @returns Promise that resolves on success, rejects on failure
 */
export type ReconnectAttemptCallback = () => Promise<void>;
/**
 * Callback invoked when force reconnect fails.
 * @param error - The error that caused the reconnect failure
 * @param attemptNumber - The attempt number (1-based)
 */
export type ReconnectErrorCallback = (error: Error, attemptNumber: number) => void;
/**
 * Configuration for ForceReconnectManager.
 */
export type ForceReconnectManagerConfig = {
    readonly logger: IClientLogger;
    readonly reconnectionStrategy: IReconnectionStrategy;
    readonly onAttempt: ReconnectAttemptCallback;
    readonly onError?: ReconnectErrorCallback;
};
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
export declare class ForceReconnectManager implements IForceReconnectManager {
    #private;
    constructor(config: ForceReconnectManagerConfig);
    /**
     * Returns whether a reconnection is currently scheduled.
     */
    get isScheduled(): boolean;
    /**
     * Returns the current attempt count.
     */
    get attemptCount(): number;
    /**
     * Schedules the next force reconnect attempt.
     * If already scheduled, this is a no-op.
     */
    schedule(): void;
    /**
     * Clears the scheduled timer without resetting the attempt counter.
     * Useful when connection succeeds externally.
     */
    clearTimer(): void;
    /**
     * Cancels force reconnection completely (timer + counter).
     * Resets the reconnection strategy state.
     */
    cancel(): void;
    /**
     * Resets the attempt counter and strategy state.
     * Call this after a successful connection.
     */
    reset(): void;
    /**
     * Restarts force reconnection from attempt 0.
     * Useful after wake from sleep.
     */
    restart(): void;
    /**
     * Executes the reconnection attempt.
     */
    private executeAttempt;
    /**
     * Logs a debug message.
     */
    private log;
}
//# sourceMappingURL=force-reconnect-manager.d.ts.map