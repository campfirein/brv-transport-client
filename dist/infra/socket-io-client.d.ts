import type { ManagerOptions, SocketOptions } from 'socket.io-client';
import type { ClientConfig, SocketTransport } from '../core/domain/types.js';
import type { IClientLogger } from '../core/interfaces/i-client-logger.js';
import type { ConnectionState, ConnectionStateHandler } from '../core/interfaces/i-connection-state.js';
import type { EventHandler } from '../core/interfaces/i-event-dispatcher.js';
import type { ITransportClient, RequestOptions } from '../core/interfaces/i-client.js';
import type { IReconnectionStrategy } from '../core/interfaces/i-reconnection-strategy.js';
import type { IWakeDetector } from '../core/interfaces/i-wake-detector.js';
import { ConnectionStateManager } from './connection-state-manager.js';
import { EventDispatcher, type HandlerErrorCallback } from './event-dispatcher.js';
import { RoomManager } from './room-manager.js';
/**
 * Immutable configuration for TransportClient.
 */
export type TransportClientConfig = {
    readonly connectTimeoutMs?: number;
    readonly reconnectionAttempts?: number;
    readonly reconnectionDelayMs?: number;
    readonly reconnectionDelayMaxMs?: number;
    readonly requestTimeoutMs?: number;
    readonly roomTimeoutMs?: number;
    readonly transports?: readonly SocketTransport[];
    /**
     * Advanced Socket.IO client options for custom configurations.
     * These options are merged with defaults and can override them.
     *
     * @remarks
     * Common use cases:
     * - `path`: Custom Socket.IO server path (default: '/socket.io')
     * - `auth`: Authentication tokens or credentials
     * - `query`: Query parameters for connection
     * - `extraHeaders`: Custom HTTP headers
     * - `withCredentials`: Enable CORS credentials
     *
     * @example
     * ```typescript
     * const client = new TransportClient({
     *   socketOptions: {
     *     path: '/custom-socket-path',
     *     auth: { token: 'secret' },
     *     extraHeaders: { 'X-Custom': 'value' }
     *   }
     * })
     * ```
     */
    readonly socketOptions?: Partial<ManagerOptions & SocketOptions>;
};
/**
 * Dependencies that can be injected into TransportClient.
 * Follows Dependency Inversion Principle (DIP) and Interface Segregation Principle (ISP).
 *
 * @remarks
 * All dependencies use interfaces for proper inversion of control.
 * Internal components for testing are available via separate testing module.
 */
export type TransportClientDependencies = {
    /** Logger for debug output (DIP - injectable) */
    readonly logger?: IClientLogger;
    /** Reconnection strategy (DIP - injectable) */
    readonly reconnectionStrategy?: IReconnectionStrategy;
    /** Wake detector for sleep recovery (DIP - injectable) */
    readonly wakeDetector?: IWakeDetector;
    /**
     * Callback for event handler errors.
     * Provides observability when event handlers throw exceptions.
     * Useful for error tracking services.
     *
     * @remarks
     * **IMPORTANT:** This callback must not throw errors or block the event loop.
     * - Throwing errors: Will be caught and logged, but degrades observability
     * - Blocking operations: Will delay event processing and can cause performance issues
     * - Use async operations (promises) without awaiting if needed
     *
     * @example
     * ```typescript
     * // Good: Non-blocking error reporting
     * onHandlerError: (event, error, data) => {
     *   void errorTracker.report(error) // Fire-and-forget
     * }
     *
     * // Bad: Blocking or throwing
     * onHandlerError: (event, error, data) => {
     *   throw new Error('Bad!') // Don't do this
     *   while(true) {} // Never do this
     * }
     * ```
     */
    readonly onHandlerError?: HandlerErrorCallback;
    /**
     * Callback invoked when handlers are cleared during disconnect.
     * Provides observability when pending once() handlers and persistent handlers are dropped.
     *
     * @param pendingCount - Number of pending once handlers that were cleared
     * @param persistentCount - Number of persistent event types that were cleared
     *
     * @remarks
     * **IMPORTANT:** This callback must not throw errors or block the event loop.
     * Throwing errors will be caught and logged but may hide important cleanup issues.
     */
    readonly onHandlersCleared?: (pendingCount: number, persistentCount: number) => void;
    /**
     * Callback invoked when force reconnect fails.
     * Provides observability for persistent connection failures.
     *
     * @param error - The error that caused the reconnect failure
     * @param attemptNumber - The attempt number (1-based)
     *
     * @remarks
     * **IMPORTANT:** This callback must not throw errors or block the event loop.
     * Throwing errors will be caught and logged but may interfere with reconnection logic.
     */
    readonly onReconnectError?: (error: Error, attemptNumber: number) => void;
};
/**
 * Full options combining config and dependencies for public API.
 */
export type TransportClientOptions = TransportClientConfig & TransportClientDependencies;
/**
 * Internal dependencies for testing purposes only.
 * Allows injection of mock components for unit testing.
 *
 * @internal
 *
 * @remarks
 * **DO NOT USE IN PRODUCTION CODE**
 *
 * This type exists solely for testing purposes and allows tests to inject
 * mock implementations of internal components. Using this in production
 * code violates the encapsulation guarantees of TransportClient.
 */
export type InternalTestDependencies = {
    /** Connection state manager (internal, for testing only) */
    readonly stateManager?: ConnectionStateManager;
    /** Event dispatcher (internal, for testing only) */
    readonly eventDispatcher?: EventDispatcher;
    /** Room manager (internal, for testing only) */
    readonly roomManager?: RoomManager;
};
/**
 * Internal options type that includes test dependencies.
 * Used only within constructor - not exported.
 * @internal
 */
type InternalTransportClientOptions = TransportClientOptions & InternalTestDependencies;
/**
 * Socket.IO implementation of ITransportClient.
 * Uses composition and dependency injection for testability and flexibility.
 *
 * Architecture:
 * - ConnectionStateManager: Manages connection state and notifications
 * - EventDispatcher: Handles event subscriptions and dispatching
 * - RoomManager: Manages room join/leave/rejoin
 * - IReconnectionStrategy: Configurable reconnection behavior
 * - IWakeDetector: Detects system wake from sleep
 *
 * @remarks
 * This class acts as a facade/coordinator for the specialized components.
 * Each component follows Single Responsibility Principle.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const client = new TransportClient()
 * await client.connect('http://localhost:3000')
 *
 * // With custom dependencies (DIP)
 * const client = new TransportClient({
 *   logger: myLogger,
 *   reconnectionStrategy: new CustomReconnectionStrategy(),
 * })
 * ```
 */
export declare class TransportClient implements ITransportClient {
    #private;
    /**
     * Internal getter for socket access within this class.
     * Provides convenient syntax for internal use.
     */
    private get socket();
    constructor(options?: InternalTransportClientOptions);
    /**
     * Checks if connect() operation is allowed in current state.
     * @returns True if can connect (state is 'disconnected')
     */
    private canConnect;
    /**
     * Checks if disconnect() operation is allowed in current state.
     * @returns True if can disconnect (state is not 'disconnected')
     */
    private canDisconnect;
    connect(url: string): Promise<void>;
    /**
     * Validates that a timeout value is a positive number.
     * @throws InvalidTimeoutError if timeout is invalid
     */
    private validateTimeout;
    /**
     * Disconnects from the server.
     *
     * @remarks
     * WARNING: This clears ALL event handlers including pending once() handlers.
     * Use onHandlersCleared callback to be notified when handlers are dropped.
     */
    disconnect(): Promise<void>;
    getState(): ConnectionState;
    getClientId(): string | undefined;
    isConnected(timeoutMs?: number): Promise<boolean>;
    onStateChange(handler: ConnectionStateHandler): () => void;
    on<T = unknown>(event: string, handler: EventHandler<T>): () => void;
    once<T = unknown>(event: string, handler: EventHandler<T>): void;
    joinRoom(room: string): Promise<void>;
    leaveRoom(room: string): Promise<void>;
    request(event: string, data?: unknown): void;
    request<T = unknown>(event: string, data: unknown, ack: (response: T) => void): void;
    requestWithAck<TResponse = unknown, TRequest = unknown>(event: string, data?: TRequest, options?: RequestOptions): Promise<TResponse>;
    /**
     * Type guard to validate server response structure.
     */
    private isValidResponse;
    /**
     * Establishes a new socket connection.
     */
    private establishConnection;
    /**
     * Sets up persistent socket handlers for disconnect, reconnect, etc.
     */
    private setupPersistentHandlers;
    /**
     * Cleans up existing socket if present.
     */
    private cleanupExistingSocket;
    /**
     * Handles a force reconnection attempt.
     * Called by ForceReconnectManager when it's time to attempt reconnection.
     */
    private handleForceReconnectAttempt;
    /**
     * Starts wake detection to handle sleep/hibernate recovery.
     */
    private startWakeDetection;
    /**
     * Stops wake detection.
     */
    private stopWakeDetection;
    /**
     * Handles system wake from sleep.
     */
    private handleWakeFromSleep;
    /**
     * Logs a debug message.
     */
    private log;
}
/**
 * Configuration with logger for backward compatibility.
 *
 * @deprecated Use {@link TransportClientOptions} instead.
 * This type will be removed in a future major version.
 *
 * @example Migration
 * ```typescript
 * // Before (deprecated):
 * const config: ClientConfigWithLogger = {
 *   connectTimeoutMs: 5000,
 *   logger: myLogger,
 * }
 *
 * // After (recommended):
 * const options: TransportClientOptions = {
 *   connectTimeoutMs: 5000,
 *   logger: myLogger,
 * }
 * ```
 *
 * @see {@link TransportClientOptions} for the new configuration type
 * @see {@link TransportClientConfig} for config-only options (no dependencies)
 * @see {@link TransportClientDependencies} for dependency injection options
 */
export type ClientConfigWithLogger = ClientConfig & {
    logger?: IClientLogger;
};
export {};
//# sourceMappingURL=socket-io-client.d.ts.map