import type { ConnectionState, ConnectionStateHandler, IConnectionStateManager } from '../core/interfaces/i-connection-state.js';
import type { IClientLogger } from '../core/interfaces/i-client-logger.js';
/**
 * Configuration for ConnectionStateManager.
 */
export type ConnectionStateManagerConfig = {
    /** Initial connection state (default: 'disconnected') */
    readonly initialState?: ConnectionState;
    /** Logger for debugging (default: NoOpClientLogger) */
    readonly logger?: IClientLogger;
};
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
export declare class ConnectionStateManager implements IConnectionStateManager {
    #private;
    constructor(config?: ConnectionStateManagerConfig);
    /**
     * Gets the current connection state.
     * @returns Current connection state
     */
    getState(): ConnectionState;
    /**
     * Updates the connection state and notifies handlers.
     * Only notifies if the state actually changed.
     * @throws {InvalidStateTransitionError} If the transition is not allowed
     */
    setState(newState: ConnectionState): void;
    /**
     * Registers a handler for connection state changes.
     * @returns Unsubscribe function
     */
    onStateChange(handler: ConnectionStateHandler): () => void;
    /**
     * Clears all state handlers.
     */
    clearHandlers(): void;
    /**
     * Checks if transition to a new state is valid from current state.
     * @param newState - The target state
     * @returns True if transition is allowed
     */
    canTransitionTo(newState: ConnectionState): boolean;
    /**
     * Checks if currently connected.
     * @returns True if state is 'connected'
     */
    isConnected(): boolean;
    /**
     * Checks if currently connecting.
     * @returns True if state is 'connecting'
     */
    isConnecting(): boolean;
    /**
     * Checks if currently disconnected.
     * @returns True if state is 'disconnected'
     */
    isDisconnected(): boolean;
    /**
     * Checks if currently reconnecting.
     * @returns True if state is 'reconnecting'
     */
    isReconnecting(): boolean;
    /**
     * Notifies all handlers of the state change.
     */
    private notifyHandlers;
}
//# sourceMappingURL=connection-state-manager.d.ts.map