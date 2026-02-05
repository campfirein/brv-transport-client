/**
 * Possible connection states.
 */
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
/**
 * Handler function for connection state changes.
 */
export type ConnectionStateHandler = (state: ConnectionState) => void;
/**
 * Read-only interface for observing connection state.
 * Use this interface for components that only need to read state,
 * following Interface Segregation Principle (ISP).
 *
 * @remarks
 * State handlers persist across disconnect/connect cycles.
 * Use the returned unsubscribe function to remove handlers.
 */
export interface IConnectionStateReader {
    /**
     * Gets the current connection state.
     * @returns Current connection state
     */
    getState(): ConnectionState;
    /**
     * Registers a handler for connection state changes.
     * @param handler - Function to call when state changes
     * @returns Unsubscribe function to remove the handler
     */
    onStateChange(handler: ConnectionStateHandler): () => void;
}
/**
 * Interface for managing connection state.
 * Extends IConnectionStateReader with mutation capabilities.
 * Follows Observer Pattern for state change notifications.
 *
 * @remarks
 * Use IConnectionStateReader for components that only observe state.
 * Use IConnectionStateManager for components that control state.
 */
export interface IConnectionStateManager extends IConnectionStateReader {
    /**
     * Updates the connection state and notifies handlers.
     * @param newState - The new connection state
     * @throws {InvalidStateTransitionError} If the transition is not allowed
     */
    setState(newState: ConnectionState): void;
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
}
//# sourceMappingURL=i-connection-state.d.ts.map