import type {IClientLogger} from '../core/interfaces/i-client-logger.js'
import type {IWakeDetector, WakeHandler} from '../core/interfaces/i-wake-detector.js'
import {NoOpClientLogger} from './no-op-client-logger.js'

/**
 * Configuration for time-based wake detection.
 */
export type WakeDetectorConfig = {
  /** Interval for checking time jumps in milliseconds (default: 5000) */
  readonly checkIntervalMs?: number
  /** Time jump threshold to detect wake in milliseconds (default: 10000) */
  readonly thresholdMs?: number
  /** Optional logger for error reporting (default: NoOpClientLogger) */
  readonly logger?: IClientLogger
}

/**
 * Default check interval (5 seconds).
 */
const DEFAULT_CHECK_INTERVAL_MS = 5000

/**
 * Default threshold for detecting wake (10 seconds).
 */
const DEFAULT_THRESHOLD_MS = 10_000

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
export class TimeBasedWakeDetector implements IWakeDetector {
  readonly #checkIntervalMs: number
  readonly #thresholdMs: number
  readonly #logger: IClientLogger
  readonly #handlers: Set<WakeHandler> = new Set()
  #timer?: NodeJS.Timeout
  #lastCheckTime: number = 0
  #isActive: boolean = false

  constructor(config?: WakeDetectorConfig) {
    this.#checkIntervalMs = config?.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS
    this.#thresholdMs = config?.thresholdMs ?? DEFAULT_THRESHOLD_MS
    this.#logger = config?.logger ?? new NoOpClientLogger()

    // Validate configuration
    if (this.#checkIntervalMs <= 0) {
      throw new Error('WakeDetector: checkIntervalMs must be positive')
    }
    if (this.#thresholdMs <= 0) {
      throw new Error('WakeDetector: thresholdMs must be positive')
    }
  }

  /**
   * Checks if wake detection is currently active.
   * @returns true if active, false otherwise
   */
  public isActive(): boolean {
    return this.#isActive
  }

  /**
   * Starts wake detection monitoring.
   * @throws Error if already started
   */
  public start(): void {
    if (this.#isActive) {
      throw new Error('WakeDetector: already started')
    }

    this.#isActive = true
    this.#lastCheckTime = Date.now()

    this.#timer = setInterval(() => {
      this.checkForWake()
    }, this.#checkIntervalMs)
  }

  /**
   * Stops wake detection and cleans up resources.
   */
  public stop(): void {
    if (this.#timer) {
      clearInterval(this.#timer)
      this.#timer = undefined
    }
    this.#isActive = false
    this.#lastCheckTime = 0
  }

  /**
   * Registers a handler to be called on wake detection.
   * @returns Unsubscribe function
   */
  public onWake(handler: WakeHandler): () => void {
    this.#handlers.add(handler)
    return () => {
      this.#handlers.delete(handler)
    }
  }

  /**
   * Checks for time jump indicating wake from sleep.
   */
  private checkForWake(): void {
    const now = Date.now()
    const elapsed = now - this.#lastCheckTime
    this.#lastCheckTime = now

    // If elapsed time exceeds expected interval + threshold, system likely woke from sleep
    const expectedMax = this.#checkIntervalMs + this.#thresholdMs
    if (elapsed > expectedMax) {
      this.notifyHandlers()
    }
  }

  /**
   * Notifies all registered handlers of wake event.
   */
  private notifyHandlers(): void {
    for (const handler of this.#handlers) {
      try {
        handler()
      } catch (error) {
        // Log handler errors for observability, but continue with other handlers
        const errorObj = error instanceof Error ? error : new Error(String(error))
        this.#logger.error(`[WakeDetector] Handler failed: ${errorObj.message}`, errorObj)
      }
    }
  }
}

/**
 * Creates a default wake detector.
 */
export function createDefaultWakeDetector(): IWakeDetector {
  return new TimeBasedWakeDetector()
}
