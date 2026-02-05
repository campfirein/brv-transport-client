import { NoOpClientLogger } from './no-op-client-logger.js';
/**
 * Default check interval (5 seconds).
 */
const DEFAULT_CHECK_INTERVAL_MS = 5000;
/**
 * Default threshold for detecting wake (10 seconds).
 */
const DEFAULT_THRESHOLD_MS = 10_000;
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
export class TimeBasedWakeDetector {
    #checkIntervalMs;
    #thresholdMs;
    #logger;
    #handlers = new Set();
    #timer;
    #lastCheckTime = 0;
    #isActive = false;
    constructor(config) {
        this.#checkIntervalMs = config?.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;
        this.#thresholdMs = config?.thresholdMs ?? DEFAULT_THRESHOLD_MS;
        this.#logger = config?.logger ?? new NoOpClientLogger();
        // Validate configuration
        if (this.#checkIntervalMs <= 0) {
            throw new Error('WakeDetector: checkIntervalMs must be positive');
        }
        if (this.#thresholdMs <= 0) {
            throw new Error('WakeDetector: thresholdMs must be positive');
        }
    }
    /**
     * Checks if wake detection is currently active.
     * @returns true if active, false otherwise
     */
    isActive() {
        return this.#isActive;
    }
    /**
     * Starts wake detection monitoring.
     * @throws Error if already started
     */
    start() {
        if (this.#isActive) {
            throw new Error('WakeDetector: already started');
        }
        this.#isActive = true;
        this.#lastCheckTime = Date.now();
        this.#timer = setInterval(() => {
            this.checkForWake();
        }, this.#checkIntervalMs);
    }
    /**
     * Stops wake detection and cleans up resources.
     */
    stop() {
        if (this.#timer) {
            clearInterval(this.#timer);
            this.#timer = undefined;
        }
        this.#isActive = false;
        this.#lastCheckTime = 0;
    }
    /**
     * Registers a handler to be called on wake detection.
     * @returns Unsubscribe function
     */
    onWake(handler) {
        this.#handlers.add(handler);
        return () => {
            this.#handlers.delete(handler);
        };
    }
    /**
     * Checks for time jump indicating wake from sleep.
     */
    checkForWake() {
        const now = Date.now();
        const elapsed = now - this.#lastCheckTime;
        this.#lastCheckTime = now;
        // If elapsed time exceeds expected interval + threshold, system likely woke from sleep
        const expectedMax = this.#checkIntervalMs + this.#thresholdMs;
        if (elapsed > expectedMax) {
            this.notifyHandlers();
        }
    }
    /**
     * Notifies all registered handlers of wake event.
     */
    notifyHandlers() {
        for (const handler of this.#handlers) {
            try {
                handler();
            }
            catch (error) {
                // Log handler errors for observability, but continue with other handlers
                const errorObj = error instanceof Error ? error : new Error(String(error));
                this.#logger.error(`[WakeDetector] Handler failed: ${errorObj.message}`, errorObj);
            }
        }
    }
}
/**
 * Creates a default wake detector.
 */
export function createDefaultWakeDetector() {
    return new TimeBasedWakeDetector();
}
//# sourceMappingURL=wake-detector.js.map