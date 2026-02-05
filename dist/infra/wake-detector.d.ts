import type { IClientLogger } from '../core/interfaces/i-client-logger.js';
import type { IWakeDetector, WakeHandler } from '../core/interfaces/i-wake-detector.js';
/**
 * Configuration for time-based wake detection.
 */
export type WakeDetectorConfig = {
    /** Interval for checking time jumps in milliseconds (default: 5000) */
    readonly checkIntervalMs?: number;
    /** Time jump threshold to detect wake in milliseconds (default: 10000) */
    readonly thresholdMs?: number;
    /** Optional logger for error reporting (default: NoOpClientLogger) */
    readonly logger?: IClientLogger;
};
/**
 * Time-based wake detector implementation.
 * Detects system wake from sleep/hibernate by monitoring time jumps.
 *
 * @remarks
 * This detector periodically checks if the elapsed time since the last check
 * exceeds the expected interval by more than the threshold. If so, it indicates
 * the system likely woke from sleep.
 *
 * @example
 * ```typescript
 * const detector = new TimeBasedWakeDetector()
 *
 * const unsubscribe = detector.onWake(() => {
 *   console.log('System woke from sleep!')
 * })
 *
 * detector.start()
 * // ... later ...
 * detector.stop()
 * unsubscribe()
 * ```
 */
export declare class TimeBasedWakeDetector implements IWakeDetector {
    #private;
    constructor(config?: WakeDetectorConfig);
    /**
     * Checks if wake detection is currently active.
     * @returns true if active, false otherwise
     */
    isActive(): boolean;
    /**
     * Starts wake detection monitoring.
     * @throws Error if already started
     */
    start(): void;
    /**
     * Stops wake detection and cleans up resources.
     */
    stop(): void;
    /**
     * Registers a handler to be called on wake detection.
     * @returns Unsubscribe function
     */
    onWake(handler: WakeHandler): () => void;
    /**
     * Checks for time jump indicating wake from sleep.
     */
    private checkForWake;
    /**
     * Notifies all registered handlers of wake event.
     */
    private notifyHandlers;
}
/**
 * Creates a default wake detector.
 */
export declare function createDefaultWakeDetector(): IWakeDetector;
//# sourceMappingURL=wake-detector.d.ts.map