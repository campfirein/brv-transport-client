/**
 * Interface for force reconnection management.
 *
 * Manages reconnection attempts after the built-in reconnection mechanism gives up.
 * Follows Interface Segregation Principle (ISP) by exposing only essential operations.
 */
export interface IForceReconnectManager {
    /**
     * Returns whether a reconnection is currently scheduled.
     */
    readonly isScheduled: boolean;
    /**
     * Returns the current attempt count.
     */
    readonly attemptCount: number;
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
}
//# sourceMappingURL=i-force-reconnect-manager.d.ts.map