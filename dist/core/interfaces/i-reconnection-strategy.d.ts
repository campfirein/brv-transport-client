/**
 * Strategy interface for handling reconnection logic.
 * Follows Strategy Pattern for flexibility in reconnection behavior.
 *
 * @remarks
 * Implementations should be stateless or manage their own state.
 * The TransportClient delegates reconnection decisions to this strategy.
 */
export interface IReconnectionStrategy {
    /**
     * Gets the delay before the next reconnection attempt.
     * @param attempt - Current attempt number (0-based)
     * @returns Delay in milliseconds, or undefined to stop retrying
     */
    getDelay(attempt: number): number | undefined;
    /**
     * Resets the strategy state (e.g., attempt counter).
     */
    reset(): void;
    /**
     * Checks if reconnection should continue.
     * @param attempt - Current attempt number
     * @returns true if should continue, false to give up
     */
    shouldContinue(attempt: number): boolean;
}
//# sourceMappingURL=i-reconnection-strategy.d.ts.map