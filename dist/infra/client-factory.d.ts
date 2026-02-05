import type { InstanceInfo } from '../core/domain/entities/instance-info.js';
import type { IClientLogger } from '../core/interfaces/i-client-logger.js';
import type { IClientFactory, ConnectionResult } from '../core/interfaces/i-client-factory.js';
import type { IInstanceDiscovery } from '../core/interfaces/i-instance-discovery.js';
export type { ConnectionResult } from '../core/interfaces/i-client-factory.js';
/**
 * Server status when running.
 */
export type ServerStatusRunning = {
    /** Instance information (pid, port, etc.) */
    readonly instance: InstanceInfo;
    /** Project root where instance was found */
    readonly projectRoot: string;
    /** Server is running and ready */
    readonly running: true;
};
/**
 * Server status when not running.
 */
export type ServerStatusNotRunning = {
    /** Reason why server is not running */
    readonly reason: 'instance_crashed' | 'no_instance';
    /** Server is not running */
    readonly running: false;
};
/**
 * Server status result from checkServerStatus().
 */
export type ServerStatus = ServerStatusNotRunning | ServerStatusRunning;
/**
 * Configuration for TransportClientFactory.
 * All properties are optional and readonly.
 */
export type TransportClientFactoryConfig = {
    /** Instance discovery service (DIP - injectable) */
    readonly discovery?: IInstanceDiscovery;
    /** Logger instance (DIP - injectable) */
    readonly logger?: IClientLogger;
    /** Maximum retry attempts (default: 8 for sandbox environments) */
    readonly maxRetries?: number;
    /** Delay between retries in ms (default: 150 for faster sandbox warm-up) */
    readonly retryDelayMs?: number;
    /** Timeout for HTTP warm-up request in ms (default: 1000) */
    readonly warmUpTimeoutMs?: number;
    /** Timeout for Socket.IO connect in ms (default: 5000) */
    readonly connectTimeoutMs?: number;
    /** Delay after warm-up before connecting in ms (default: 100) */
    readonly warmUpSettleDelayMs?: number;
};
/**
 * Factory for creating connected Socket.IO clients.
 * Follows Dependency Inversion Principle - depends on abstractions (IInstanceDiscovery, IClientLogger).
 *
 * Responsibilities:
 * - Instance discovery (via injected IInstanceDiscovery)
 * - Connection establishment with retry logic
 * - HTTP warm-up for sandbox environments
 * - Error translation to user-friendly messages
 *
 * @example
 * ```typescript
 * // Basic usage
 * const factory = new TransportClientFactory()
 * const { client, projectRoot } = await factory.connect()
 *
 * // With custom dependencies (DIP)
 * const factory = new TransportClientFactory({
 *   discovery: new CustomDiscovery(),
 *   logger: myLogger,
 * })
 * ```
 */
export declare class TransportClientFactory implements IClientFactory {
    #private;
    constructor(config?: TransportClientFactoryConfig);
    /**
     * Discovers a running instance and connects to it.
     *
     * @param fromDir - Directory to start discovery from (default: cwd)
     * @returns Connected client and project root
     * @throws NoInstanceRunningError - No .brv directory found
     * @throws InstanceCrashedError - Instance found but process dead
     * @throws ConnectionFailedError - Instance found but connection failed
     */
    connect(fromDir?: string): Promise<ConnectionResult>;
    /**
     * Connects to the instance with retry logic.
     * Includes HTTP warm-up to trigger sandbox permission requests.
     */
    private connectWithRetry;
    /**
     * Attempts HTTP warm-up to trigger sandbox network permission.
     * Returns true if warm-up succeeded (status 2xx), false otherwise.
     */
    private httpWarmUp;
    /**
     * Safely disconnects a client, ignoring errors.
     */
    private safeDisconnect;
    /**
     * Checks if an error is likely a sandbox-related network error.
     */
    private isSandboxError;
    /**
     * Calculates retry delay with exponential backoff for sandbox errors.
     */
    private calculateRetryDelay;
    /**
     * Promise-based delay.
     */
    private delay;
    /**
     * Logs a debug message.
     */
    private log;
}
/**
 * Manages singleton instances for transport client.
 * Encapsulates global state following OOP principles.
 *
 * @remarks
 * This class provides explicit dependency management instead of hidden module-level state.
 * - All state is encapsulated within the class instance
 * - Supports multiple instances for testing scenarios
 * - Thread-safe connection management via promise deduplication
 *
 * @example
 * ```typescript
 * // Default singleton usage
 * const manager = SingletonClientManager.getInstance()
 * const { client } = await manager.getConnectedClient()
 *
 * // Testing with isolated instance
 * const testManager = new SingletonClientManager()
 * testManager.reset()
 * ```
 */
export declare class SingletonClientManager {
    #private;
    /**
     * Creates a new singleton manager instance.
     * @param factoryConfig - Optional configuration for the factory
     */
    constructor(factoryConfig?: TransportClientFactoryConfig);
    /**
     * Gets the global singleton instance.
     * Creates one if it doesn't exist.
     */
    static getInstance(): SingletonClientManager;
    /**
     * Resets the global singleton instance.
     * Primarily for testing.
     */
    static resetInstance(): void;
    /**
     * Gets or creates the singleton factory.
     * @param config - Configuration (only used on first call)
     */
    getFactory(config?: TransportClientFactoryConfig): TransportClientFactory;
    /**
     * Gets or creates the singleton discovery.
     */
    getDiscovery(): IInstanceDiscovery;
    /**
     * Gets the singleton connected client, connecting if necessary.
     * Thread-safe: concurrent calls share the same connection attempt.
     *
     * @param fromDir - Directory to start discovery from (default: cwd)
     * @returns Connected client and project root
     * @throws NoInstanceRunningError - No .brv directory found
     * @throws InstanceCrashedError - Instance found but process dead
     * @throws ConnectionFailedError - Instance found but connection failed
     */
    getConnectedClient(fromDir?: string): Promise<ConnectionResult>;
    /**
     * Disconnects and clears the singleton client.
     */
    disconnectClient(): Promise<void>;
    /**
     * Checks if the transport server is running without attempting to connect.
     * Non-throwing alternative to connect().
     *
     * @param fromDir - Directory to start discovery from (default: cwd)
     * @returns ServerStatus indicating whether server is running and why if not
     */
    checkServerStatus(fromDir?: string): Promise<ServerStatus>;
    /**
     * Resets all singleton state.
     * Primarily for testing.
     */
    reset(): void;
    /**
     * Gets the cached connection if available.
     * Returns undefined if not connected.
     */
    get cachedConnection(): ConnectionResult | undefined;
    /**
     * Checks if a connection attempt is in progress.
     */
    get isConnecting(): boolean;
}
/**
 * Gets or creates the singleton factory.
 * @param config - Configuration (only used on first call)
 */
export declare function getTransportClientFactory(config?: TransportClientFactoryConfig): TransportClientFactory;
/**
 * Creates a new factory instance (non-singleton).
 * @deprecated Use connectToTransport() for simpler API
 */
export declare function createTransportClientFactory(config?: TransportClientFactoryConfig): TransportClientFactory;
/**
 * Connects to ByteRover transport server (simplified API).
 * Auto-discovers .brv directory by walking up from fromDir.
 *
 * @param fromDir - Directory to start discovery from (default: cwd)
 * @param config - Optional factory configuration
 * @returns Connected client and project root
 * @throws NoInstanceRunningError - No .brv directory found
 * @throws InstanceCrashedError - Instance found but process dead
 * @throws ConnectionFailedError - Instance found but connection failed
 *
 * @example
 * ```typescript
 * // Simple connection
 * const {client, projectRoot} = await connectToTransport()
 *
 * // With custom directory
 * const {client} = await connectToTransport('/path/to/project')
 *
 * // With custom config
 * const {client} = await connectToTransport(undefined, { logger: myLogger })
 * ```
 */
export declare function connectToTransport(fromDir?: string, config?: TransportClientFactoryConfig): Promise<ConnectionResult>;
/**
 * Checks if the transport server is running without attempting to connect.
 * Non-throwing alternative to connectToTransport().
 *
 * @param fromDir - Directory to start discovery from (default: cwd)
 * @returns ServerStatus indicating whether server is running and why if not
 *
 * @example
 * ```typescript
 * const status = await checkServerStatus()
 * if (status.running) {
 *   const { client } = await getConnectedClient()
 * } else {
 *   console.log(`Server not running: ${status.reason}`)
 * }
 * ```
 */
export declare function checkServerStatus(fromDir?: string): Promise<ServerStatus>;
/**
 * Gets the singleton connected client, connecting if necessary.
 * Thread-safe: concurrent calls share the same connection attempt.
 *
 * @param fromDir - Directory to start discovery from (default: cwd)
 * @returns Connected client and project root
 * @throws NoInstanceRunningError - No .brv directory found
 * @throws InstanceCrashedError - Instance found but process dead
 * @throws ConnectionFailedError - Instance found but connection failed
 *
 * @example
 * ```typescript
 * // Concurrent calls share the same connection
 * const [result1, result2] = await Promise.all([
 *   getConnectedClient(),
 *   getConnectedClient(),
 * ])
 * console.log(result1.client === result2.client) // true
 * ```
 */
export declare function getConnectedClient(fromDir?: string): Promise<ConnectionResult>;
/**
 * Disconnects and clears the singleton client.
 */
export declare function disconnectClient(): Promise<void>;
/**
 * Resets all singleton instances. Primarily for testing.
 */
export declare function resetSingletons(): void;
//# sourceMappingURL=client-factory.d.ts.map