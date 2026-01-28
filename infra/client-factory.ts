import type {InstanceInfo} from '../core/domain/entities/instance-info.js'
import type {IClientLogger} from '../core/interfaces/i-client-logger.js'
import type {ITransportClient} from '../core/interfaces/i-client.js'
import type {IClientFactory, ConnectionResult} from '../core/interfaces/i-client-factory.js'
import type {IInstanceDiscovery} from '../core/interfaces/i-instance-discovery.js'

import {
  ConnectionFailedError,
  InstanceCrashedError,
  NoInstanceRunningError,
} from '../core/domain/errors/connection-error.js'
import {NoOpClientLogger} from './no-op-client-logger.js'
import {FileInstanceDiscovery} from './file-instance-discovery.js'
import {TransportClient} from './socket-io-client.js'

// ============================================================================
// Types (Immutable interfaces)
// ============================================================================

// Re-export from interface for backward compatibility
export type {ConnectionResult} from '../core/interfaces/i-client-factory.js'

/**
 * Server status when running.
 */
export type ServerStatusRunning = {
  /** Instance information (pid, port, etc.) */
  readonly instance: InstanceInfo
  /** Project root where instance was found */
  readonly projectRoot: string
  /** Server is running and ready */
  readonly running: true
}

/**
 * Server status when not running.
 */
export type ServerStatusNotRunning = {
  /** Reason why server is not running */
  readonly reason: 'instance_crashed' | 'no_instance'
  /** Server is not running */
  readonly running: false
}

/**
 * Server status result from checkServerStatus().
 */
export type ServerStatus = ServerStatusNotRunning | ServerStatusRunning

/**
 * Configuration for TransportClientFactory.
 * All properties are optional and readonly.
 */
export type TransportClientFactoryConfig = {
  /** Instance discovery service (DIP - injectable) */
  readonly discovery?: IInstanceDiscovery
  /** Logger instance (DIP - injectable) */
  readonly logger?: IClientLogger
  /** Maximum retry attempts (default: 8 for sandbox environments) */
  readonly maxRetries?: number
  /** Delay between retries in ms (default: 150 for faster sandbox warm-up) */
  readonly retryDelayMs?: number
  /** Timeout for HTTP warm-up request in ms (default: 1000) */
  readonly warmUpTimeoutMs?: number
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_RETRIES = 8
const DEFAULT_RETRY_DELAY_MS = 150
const DEFAULT_WARMUP_TIMEOUT_MS = 1000
const WARMUP_SETTLE_DELAY_MS = 100
const SANDBOX_ERROR_MULTIPLIER = 2

// ============================================================================
// TransportClientFactory
// ============================================================================

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
export class TransportClientFactory implements IClientFactory {
  readonly #discovery: IInstanceDiscovery
  readonly #logger: IClientLogger
  readonly #maxRetries: number
  readonly #retryDelayMs: number
  readonly #warmUpTimeoutMs: number

  constructor(config?: TransportClientFactoryConfig) {
    // Inject dependencies or use defaults (DIP)
    this.#discovery = config?.discovery ?? new FileInstanceDiscovery()
    this.#logger = config?.logger ?? new NoOpClientLogger()

    // Configuration with defaults
    this.#maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES
    this.#retryDelayMs = config?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
    this.#warmUpTimeoutMs = config?.warmUpTimeoutMs ?? DEFAULT_WARMUP_TIMEOUT_MS
  }

  /**
   * Discovers a running instance and connects to it.
   *
   * @param fromDir - Directory to start discovery from (default: cwd)
   * @returns Connected client and project root
   * @throws NoInstanceRunningError - No .brv directory found
   * @throws InstanceCrashedError - Instance found but process dead
   * @throws ConnectionFailedError - Instance found but connection failed
   */
  public async connect(fromDir: string = process.cwd()): Promise<ConnectionResult> {
    this.log(`Discovering instance from ${fromDir}`)
    const result = await this.#discovery.discover(fromDir)

    if (!result.found) {
      throw result.reason === 'instance_crashed' ? new InstanceCrashedError() : new NoInstanceRunningError()
    }

    const {instance, projectRoot} = result
    const url = instance.getTransportUrl()

    this.log(`Instance discovered: pid=${instance.pid}, port=${instance.port}, projectRoot=${projectRoot}`)

    const client = await this.connectWithRetry(url, instance.port)

    return Object.freeze({client, projectRoot})
  }

  /**
   * Connects to the instance with retry logic.
   * Includes HTTP warm-up to trigger sandbox permission requests.
   */
  private async connectWithRetry(url: string, port: number): Promise<ITransportClient> {
    let lastError: Error | undefined

    // HTTP warm-up for sandbox environments
    this.log(`Attempting HTTP warm-up to ${url}`)
    await this.httpWarmUp(url)
    await this.delay(WARMUP_SETTLE_DELAY_MS)

    // Connection retry loop
    for (let attempt = 1; attempt <= this.#maxRetries; attempt++) {
      const client = new TransportClient({logger: this.#logger})

      try {
        this.log(`Connection attempt ${attempt}/${this.#maxRetries} to ${url}`)
        await client.connect(url)
        this.log(`Connected to instance, clientId=${client.getClientId()}`)
        return client
      } catch (error) {
        // Cleanup on failure
        await this.safeDisconnect(client)

        lastError = error instanceof Error ? error : new Error(String(error))
        const isSandboxError = this.isSandboxError(lastError)

        this.log(`Connection attempt ${attempt} failed: ${lastError.message}, isSandboxError=${isSandboxError}`)

        // Wait before retry (except on last attempt)
        if (attempt < this.#maxRetries) {
          const delayMs = this.calculateRetryDelay(attempt, isSandboxError)
          await this.delay(delayMs)
        }
      }
    }

    throw new ConnectionFailedError(port, lastError)
  }

  /**
   * Attempts HTTP warm-up to trigger sandbox network permission.
   * Returns true if warm-up succeeded (status 2xx), false otherwise.
   */
  private async httpWarmUp(url: string): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.#warmUpTimeoutMs)

      const response = await fetch(`${url}/socket.io/?EIO=4&transport=polling`, {
        method: 'GET',
        signal: controller.signal,
      }).catch((error: Error) => {
        this.log(`HTTP warm-up fetch error: ${error.message}`)
        return null
      })

      clearTimeout(timeoutId)

      if (response?.ok) {
        this.log(`HTTP warm-up succeeded with status: ${response.status}`)
        return true
      }

      if (response) {
        this.log(`HTTP warm-up completed with non-OK status: ${response.status}`)
      }

      return false
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.log(`HTTP warm-up failed: ${errorMessage}`)
      return false
    }
  }

  /**
   * Safely disconnects a client, ignoring errors.
   */
  private async safeDisconnect(client: ITransportClient): Promise<void> {
    try {
      await client.disconnect()
    } catch {
      // Ignore disconnect errors during cleanup
    }
  }

  /**
   * Checks if an error is likely a sandbox-related network error.
   */
  private isSandboxError(error: Error): boolean {
    const message = error.message.toLowerCase()
    return (
      message.includes('websocket error') ||
      message.includes('network') ||
      message.includes('connection failed') ||
      message.includes('econnrefused')
    )
  }

  /**
   * Calculates retry delay with exponential backoff for sandbox errors.
   */
  private calculateRetryDelay(attempt: number, isSandboxError: boolean): number {
    const baseDelay = isSandboxError ? this.#retryDelayMs * SANDBOX_ERROR_MULTIPLIER : this.#retryDelayMs
    return baseDelay * attempt
  }

  /**
   * Promise-based delay.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Logs a debug message.
   */
  private log(message: string): void {
    this.#logger.debug(`[TransportClientFactory] ${message}`)
  }
}

// ============================================================================
// Singleton Client Manager (Encapsulated Global State)
// ============================================================================

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
export class SingletonClientManager {
  static #instance: SingletonClientManager | undefined

  #factory: TransportClientFactory | undefined
  #discovery: IInstanceDiscovery | undefined
  #cachedConnection: ConnectionResult | undefined
  #connectingPromise: Promise<ConnectionResult> | undefined
  readonly #factoryConfig: TransportClientFactoryConfig | undefined

  /**
   * Creates a new singleton manager instance.
   * @param factoryConfig - Optional configuration for the factory
   */
  public constructor(factoryConfig?: TransportClientFactoryConfig) {
    this.#factoryConfig = factoryConfig
  }

  /**
   * Gets the global singleton instance.
   * Creates one if it doesn't exist.
   */
  public static getInstance(): SingletonClientManager {
    if (!SingletonClientManager.#instance) {
      SingletonClientManager.#instance = new SingletonClientManager()
    }
    return SingletonClientManager.#instance
  }

  /**
   * Resets the global singleton instance.
   * Primarily for testing.
   */
  public static resetInstance(): void {
    SingletonClientManager.#instance = undefined
  }

  /**
   * Gets or creates the singleton factory.
   * @param config - Configuration (only used on first call)
   */
  public getFactory(config?: TransportClientFactoryConfig): TransportClientFactory {
    if (!this.#factory) {
      this.#factory = new TransportClientFactory(config ?? this.#factoryConfig)
    }
    return this.#factory
  }

  /**
   * Gets or creates the singleton discovery.
   */
  public getDiscovery(): IInstanceDiscovery {
    if (!this.#discovery) {
      this.#discovery = new FileInstanceDiscovery()
    }
    return this.#discovery
  }

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
  public async getConnectedClient(fromDir: string = process.cwd()): Promise<ConnectionResult> {
    // Return cached if connected
    if (this.#cachedConnection?.client.getState() === 'connected') {
      return this.#cachedConnection
    }

    // Wait for in-progress connection (race condition prevention)
    if (this.#connectingPromise) {
      return this.#connectingPromise
    }

    // Start new connection
    this.#connectingPromise = (async () => {
      try {
        this.#cachedConnection = undefined
        const factory = this.getFactory()
        this.#cachedConnection = await factory.connect(fromDir)
        return this.#cachedConnection
      } finally {
        this.#connectingPromise = undefined
      }
    })()

    return this.#connectingPromise
  }

  /**
   * Disconnects and clears the singleton client.
   */
  public async disconnectClient(): Promise<void> {
    if (this.#cachedConnection) {
      await this.#cachedConnection.client.disconnect()
      this.#cachedConnection = undefined
    }
  }

  /**
   * Checks if the transport server is running without attempting to connect.
   * Non-throwing alternative to connect().
   *
   * @param fromDir - Directory to start discovery from (default: cwd)
   * @returns ServerStatus indicating whether server is running and why if not
   */
  public async checkServerStatus(fromDir: string = process.cwd()): Promise<ServerStatus> {
    const discovery = this.getDiscovery()
    const result = await discovery.discover(fromDir)

    if (!result.found) {
      return Object.freeze({
        reason: result.reason === 'instance_crashed' ? 'instance_crashed' : 'no_instance',
        running: false as const,
      })
    }

    return Object.freeze({
      instance: result.instance,
      projectRoot: result.projectRoot,
      running: true as const,
    })
  }

  /**
   * Resets all singleton state.
   * Primarily for testing.
   */
  public reset(): void {
    this.#cachedConnection = undefined
    this.#connectingPromise = undefined
    this.#factory = undefined
    this.#discovery = undefined
  }

  /**
   * Gets the cached connection if available.
   * Returns undefined if not connected.
   */
  public get cachedConnection(): ConnectionResult | undefined {
    return this.#cachedConnection
  }

  /**
   * Checks if a connection attempt is in progress.
   */
  public get isConnecting(): boolean {
    return this.#connectingPromise !== undefined
  }
}

// ============================================================================
// Backward-Compatible Module Functions
// ============================================================================

/**
 * Gets or creates the singleton factory.
 * @param config - Configuration (only used on first call)
 */
export function getTransportClientFactory(config?: TransportClientFactoryConfig): TransportClientFactory {
  return SingletonClientManager.getInstance().getFactory(config)
}

/**
 * Creates a new factory instance (non-singleton).
 * @deprecated Use connectToTransport() for simpler API
 */
export function createTransportClientFactory(config?: TransportClientFactoryConfig): TransportClientFactory {
  return new TransportClientFactory(config)
}

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
export async function connectToTransport(
  fromDir?: string,
  config?: TransportClientFactoryConfig
): Promise<ConnectionResult> {
  const factory = new TransportClientFactory(config)
  return factory.connect(fromDir)
}

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
export async function checkServerStatus(fromDir: string = process.cwd()): Promise<ServerStatus> {
  return SingletonClientManager.getInstance().checkServerStatus(fromDir)
}

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
export async function getConnectedClient(fromDir: string = process.cwd()): Promise<ConnectionResult> {
  return SingletonClientManager.getInstance().getConnectedClient(fromDir)
}

/**
 * Disconnects and clears the singleton client.
 */
export async function disconnectClient(): Promise<void> {
  return SingletonClientManager.getInstance().disconnectClient()
}

/**
 * Resets all singleton instances. Primarily for testing.
 */
export function resetSingletons(): void {
  SingletonClientManager.getInstance().reset()
  SingletonClientManager.resetInstance()
}
