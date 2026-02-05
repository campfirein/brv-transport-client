/**
 * Handler function for wake events.
 */
export type WakeHandler = () => void;
/**
 * Interface for detecting system wake from sleep/hibernate.
 * Follows Observer Pattern for notifying subscribers of wake events.
 *
 * @remarks
 * Implementations should detect time jumps that indicate the system
 * has woken from sleep and notify registered handlers.
 */
export interface IWakeDetector {
    /**
     * Starts wake detection monitoring.
     * @throws Error if already started
     */
    start(): void;
    /**
     * Stops wake detection monitoring and cleans up resources.
     */
    stop(): void;
    /**
     * Registers a handler to be called when system wake is detected.
     * @param handler - Function to call on wake detection
     * @returns Unsubscribe function to remove the handler
     */
    onWake(handler: WakeHandler): () => void;
    /**
     * Checks if wake detection is currently active.
     * @returns true if active, false otherwise
     */
    isActive(): boolean;
}
//# sourceMappingURL=i-wake-detector.d.ts.map