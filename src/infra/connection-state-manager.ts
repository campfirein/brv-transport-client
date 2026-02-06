import type {
  ConnectionState,
  ConnectionStateHandler,
  IConnectionStateManager,
} from '../core/interfaces/i-connection-state.js'
import type {IClientLogger} from '../core/interfaces/i-client-logger.js'
import {InvalidStateTransitionError} from '../core/domain/errors/transport-error.js'
import {NoOpClientLogger} from './no-op-client-logger.js'

/**
 * Valid state transitions for the connection state machine.
 * Each state can only transition to specific next states.
 */
const VALID_TRANSITIONS: Record<ConnectionState, ConnectionState[]> = {
  disconnected: ['connecting'],
  connecting: ['connected', 'disconnected'],
  connected: ['reconnecting', 'disconnected'],
  reconnecting: ['connected', 'disconnected'],
}

/**
 * Configuration for ConnectionStateManager.
 */
export type ConnectionStateManagerConfig = {
  /** Initial connection state (default: 'disconnected') */
  readonly initialState?: ConnectionState
  /** Logger for debugging (default: NoOpClientLogger) */
  readonly logger?: IClientLogger
}

/**
 * Manages connection state and notifies subscribers of state changes.
 * Implements Observer Pattern for state change notifications.
 *
 * @remarks
 * - State handlers persist across state changes until explicitly unsubscribed
 * - Each handler receives the new state when it changes
 * - Handlers are called synchronously in registration order
 *
 * @example
 * ```typescript
 * const stateManager = new ConnectionStateManager()
 *
 * const unsubscribe = stateManager.onStateChange((state) => {
 *   console.log('State changed to:', state)
 * })
 *
 * stateManager.setState('connecting') // Logs: "State changed to: connecting"
 * stateManager.setState('connected')   // Logs: "State changed to: connected"
 *
 * unsubscribe()
 * stateManager.setState('disconnected') // No log (unsubscribed)
 * ```
 */
export class ConnectionStateManager implements IConnectionStateManager {
  readonly #handlers: Set<ConnectionStateHandler> = new Set()
  readonly #logger: IClientLogger
  #state: ConnectionState

  constructor(config?: ConnectionStateManagerConfig) {
    this.#state = config?.initialState ?? 'disconnected'
    this.#logger = config?.logger ?? new NoOpClientLogger()
  }

  /**
   * Gets the current connection state.
   * @returns Current connection state
   */
  public getState(): ConnectionState {
    return this.#state
  }

  /**
   * Updates the connection state and notifies handlers.
   * Only notifies if the state actually changed.
   * @throws {InvalidStateTransitionError} If the transition is not allowed
   */
  public setState(newState: ConnectionState): void {
    if (this.#state === newState) {
      return
    }

    // Validate transition
    const validNext = VALID_TRANSITIONS[this.#state]
    if (!validNext.includes(newState)) {
      const error = new InvalidStateTransitionError(this.#state, newState)
      this.#logger.error(`[ConnectionStateManager] Invalid transition: ${this.#state} -> ${newState}`)
      throw error
    }

    const previousState = this.#state
    this.#state = newState
    this.#logger.debug(`[ConnectionStateManager] State change: ${previousState} -> ${newState}`)

    this.notifyHandlers(newState)
  }

  /**
   * Registers a handler for connection state changes.
   * @returns Unsubscribe function
   */
  public onStateChange(handler: ConnectionStateHandler): () => void {
    this.#handlers.add(handler)
    return () => {
      this.#handlers.delete(handler)
    }
  }

  /**
   * Clears all state handlers.
   */
  public clearHandlers(): void {
    this.#handlers.clear()
  }

  /**
   * Checks if transition to a new state is valid from current state.
   * @param newState - The target state
   * @returns True if transition is allowed
   */
  public canTransitionTo(newState: ConnectionState): boolean {
    const validNext = VALID_TRANSITIONS[this.#state]
    return validNext.includes(newState)
  }

  /**
   * Checks if currently connected.
   * @returns True if state is 'connected'
   */
  public isConnected(): boolean {
    return this.#state === 'connected'
  }

  /**
   * Checks if currently connecting.
   * @returns True if state is 'connecting'
   */
  public isConnecting(): boolean {
    return this.#state === 'connecting'
  }

  /**
   * Checks if currently disconnected.
   * @returns True if state is 'disconnected'
   */
  public isDisconnected(): boolean {
    return this.#state === 'disconnected'
  }

  /**
   * Checks if currently reconnecting.
   * @returns True if state is 'reconnecting'
   */
  public isReconnecting(): boolean {
    return this.#state === 'reconnecting'
  }

  /**
   * Notifies all handlers of the state change.
   */
  private notifyHandlers(newState: ConnectionState): void {
    for (const handler of this.#handlers) {
      try {
        handler(newState)
      } catch (error) {
        // Log but don't throw - one handler failing shouldn't break others
        const errorMsg = error instanceof Error ? error.message : String(error)
        this.#logger.debug(`[ConnectionStateManager] Handler error: ${errorMsg}`)
      }
    }
  }
}
