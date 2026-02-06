import type {InstanceInfo} from '../core/domain/entities/instance-info.js'
import type {IClientLogger} from '../core/interfaces/i-client-logger.js'
import type {ITransportClient} from '../core/interfaces/i-client.js'
import type {IClientFactory, ConnectionResult} from '../core/interfaces/i-client-factory.js'
import type {
  ConnectOptions,
  RegistrationOptions,
  TransportClientFactoryConfig,
} from '../core/interfaces/i-client-factory-config.js'
import type {DiscoveryResult, IInstanceDiscovery} from '../core/interfaces/i-instance-discovery.js'

import {
  ConnectionFailedError,
  InstanceCrashedError,
  InstanceStaleError,
  NoInstanceRunningError,
} from '../core/domain/errors/connection-error.js'
import {TRANSPORT_REGISTRATION_TIMEOUT_MS} from '../constants.js'
import {ClientEventNames} from '../core/domain/events/event-names.js'
import {NoOpClientLogger} from './no-op-client-logger.js'
import {DaemonInstanceDiscovery} from './daemon-instance-discovery.js'
import {TransportClient} from './socket-io-client.js'
import type {ClientRegisterRequest, ClientRegisterResponse} from './schemas/types.js'
import {ClientRegisterResponseSchema} from './schemas/schemas.js'

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
  /** Project root (directory containing .brv/). Undefined if not in a brv project (e.g., MCP global). */
  readonly projectRoot?: string
  /** Server is running and ready */
  readonly running: true
}

/**
 * Server status when not running.
 */
export type ServerStatusNotRunning = {
  /** Reason why server is not running */
  readonly reason: 'instance_crashed' | 'instance_stale' | 'no_instance'
  /** Server is not running */
  readonly running: false
}

/**
 * Server status result from checkServerStatus().
 */
export type ServerStatus = ServerStatusNotRunning | ServerStatusRunning

// Re-export for backward compatibility
export type {TransportClientFactoryConfig} from '../core/interfaces/i-client-factory-config.js'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Maps a DiscoveryResult to a frozen ServerStatus.
 */
function toServerStatus(result: DiscoveryResult): ServerStatus {
  if (!result.found) {
    return Object.freeze({
      reason: result.reason,
      running: false as const,
    })
  }
  return Object.freeze({
    instance: result.instance,
    ...(result.projectRoot !== undefined && {projectRoot: result.projectRoot}),
    running: true as const,
  })
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_RETRIES = 8
const DEFAULT_RETRY_DELAY_MS = 150
const DEFAULT_WARMUP_TIMEOUT_MS = 1000
const DEFAULT_CONNECT_TIMEOUT_MS = 5000
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
  readonly #connectTimeoutMs: number
  readonly #warmUpSettleDelayMs: number

  constructor(config?: TransportClientFactoryConfig) {
    // Inject dependencies or use defaults (DIP)
    this.#discovery = config?.discovery ?? new DaemonInstanceDiscovery()
    this.#logger = config?.logger ?? new NoOpClientLogger()

    // Configuration with defaults
    this.#maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES
    this.#retryDelayMs = config?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
    this.#warmUpTimeoutMs = config?.warmUpTimeoutMs ?? DEFAULT_WARMUP_TIMEOUT_MS
    this.#connectTimeoutMs = config?.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS
    this.#warmUpSettleDelayMs = config?.warmUpSettleDelayMs ?? WARMUP_SETTLE_DELAY_MS
  }

  /**
   * Discovers a running instance and connects to it.
   *
   * @param fromDir - Starting directory for project root discovery (walks up to find .brv/).
   *                  Also used as the client's working directory (cwd) for Socket.IO handshake.
   *                  Default: process.cwd()
   * @param options - Optional registration options (autoRegister defaults to true)
   * @returns Connected client and project root (undefined if no .brv/ found)
   * @throws NoInstanceRunningError - No daemon instance found
   * @throws InstanceCrashedError - Instance found but process dead
   * @throws InstanceStaleError - Instance found but heartbeat expired
   * @throws ConnectionFailedError - Instance found but connection failed
   */
  public async connect(fromDir: string = process.cwd(), options?: RegistrationOptions): Promise<ConnectionResult> {
    this.log(`Discovering instance from ${fromDir}`)
    const result = await this.#discovery.discover(fromDir)

    if (!result.found) {
      if (result.reason === 'instance_crashed') {
        throw new InstanceCrashedError()
      }
      if (result.reason === 'instance_stale') {
        throw new InstanceStaleError()
      }
      throw new NoInstanceRunningError()
    }

    const {instance, projectRoot} = result
    const url = instance.getTransportUrl()

    this.log(`Instance discovered: pid=${instance.pid}, port=${instance.port}, projectRoot=${projectRoot}`)

    const client = await this.connectWithRetry(url, instance.port, fromDir)

    // Auto-registration after successful connection (non-fatal)
    await this.performRegistration(client, options)

    // Join requested rooms after registration (e.g., broadcast-room for TUI)
    if (options?.joinRooms?.length) {
      for (const room of options.joinRooms) {
        this.log(`Joining room: ${room}`)
        await client.joinRoom(room)
      }
    }

    return Object.freeze({client, projectRoot})
  }

  /**
   * Connects to the instance with retry logic.
   * Includes HTTP warm-up to trigger sandbox permission requests.
   */
  private async connectWithRetry(url: string, port: number, cwd: string): Promise<ITransportClient> {
    let lastError: Error | undefined

    // HTTP warm-up for sandbox environments
    this.log(`Attempting HTTP warm-up to ${url}`)
    await this.httpWarmUp(url)
    await this.delay(this.#warmUpSettleDelayMs)

    // Connection retry loop
    for (let attempt = 1; attempt <= this.#maxRetries; attempt++) {
      const client = new TransportClient({
        logger: this.#logger,
        connectTimeoutMs: this.#connectTimeoutMs,
        cwd,
      })

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
   * Uses hardcoded /socket.io/ path — the actual path doesn't matter since
   * any HTTP request to host:port triggers the sandbox permission prompt.
   * Returns true if warm-up received a 2xx response, false otherwise.
   */
  private async httpWarmUp(url: string): Promise<boolean> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.#warmUpTimeoutMs)

    // Path intentionally hardcoded — we only need to trigger the sandbox
    // network permission prompt, not hit the actual Socket.IO endpoint.
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
   * Calculates retry delay with linear backoff. Sandbox errors use double base delay.
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
   * Performs client registration after successful connection (non-fatal).
   * Registration failures are logged but never thrown - connection remains usable.
   *
   * @param client - Connected transport client
   * @param options - Registration options (autoRegister defaults to true)
   */
  private async performRegistration(client: ITransportClient, options?: RegistrationOptions): Promise<void> {
    // Default: autoRegister = true
    const shouldRegister = options?.autoRegister ?? true
    if (!shouldRegister) {
      this.log('Registration skipped (autoRegister=false)')
      return
    }

    const clientType = options?.clientType ?? 'cli'
    const payload: ClientRegisterRequest = {
      clientType,
      ...(options?.projectPath && {projectPath: options.projectPath}),
    }

    try {
      this.log(`Registering as ${clientType}${options?.projectPath ? ` (project=${options.projectPath})` : ''}`)

      const response = await client.requestWithAck<ClientRegisterResponse>(ClientEventNames.REGISTER, payload, {
        timeout: TRANSPORT_REGISTRATION_TIMEOUT_MS,
      })

      // Validate response with Zod
      const validated = ClientRegisterResponseSchema.safeParse(response)
      if (!validated.success) {
        this.log(`Registration response validation failed: ${validated.error.message}`)
        return
      }

      if (!validated.data.success) {
        this.log(`Registration failed: ${validated.data.error ?? 'Unknown error'}`)
        return
      }

      this.log('Registration successful')
    } catch (error) {
      // Non-fatal: registration failure doesn't prevent usage
      const message = error instanceof Error ? error.message : String(error)
      this.log(`Registration error (non-fatal): ${message}`)
    }
  }

  /**
   * Logs a debug message.
   */
  private log(message: string): void {
    this.#logger.debug(`[TransportClientFactory] ${message}`)
  }
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Connects to ByteRover transport server (simplified API).
 * Discovers daemon instance from global data directory.
 * Auto-registers client by default (set autoRegister: false to opt-out).
 *
 * @param fromDir - Directory to use as project context (default: cwd)
 * @param options - Optional connection and registration options
 * @returns Connected client and project root
 * @throws NoInstanceRunningError - No daemon instance found
 * @throws InstanceCrashedError - Instance found but process dead
 * @throws InstanceStaleError - Instance found but heartbeat expired
 * @throws ConnectionFailedError - Instance found but connection failed
 *
 * @example
 * ```typescript
 * // Simple connection (auto-registers as 'cli')
 * const {client, projectRoot} = await connectToTransport()
 *
 * // With custom client type
 * const {client} = await connectToTransport(undefined, { clientType: 'tui' })
 *
 * // Debug command (opt-out of registration)
 * const {client} = await connectToTransport(undefined, { autoRegister: false })
 *
 * // With factory config + registration
 * const {client} = await connectToTransport(undefined, {
 *   logger: myLogger,
 *   maxRetries: 5,
 *   clientType: 'agent'
 * })
 * ```
 */
export async function connectToTransport(fromDir?: string, options?: ConnectOptions): Promise<ConnectionResult> {
  const {
    // Extract registration options
    autoRegister,
    clientType,
    joinRooms,
    projectPath,
    // Rest are factory config
    ...factoryConfig
  } = options ?? {}

  const factory = new TransportClientFactory(factoryConfig)

  // Pass registration options separately
  const registrationOptions = {autoRegister, clientType, joinRooms, projectPath}

  return factory.connect(fromDir, registrationOptions)
}

/**
 * Checks if the transport server is running without attempting to connect.
 * Non-throwing alternative to connectToTransport().
 *
 * @param fromDir - Directory to use as project context (default: cwd)
 * @param discovery - Optional instance discovery service (default: DaemonInstanceDiscovery)
 * @returns ServerStatus indicating whether server is running and why if not
 *
 * @example
 * ```typescript
 * const status = await checkServerStatus()
 * if (status.running) {
 *   const { client } = await connectToTransport()
 * } else {
 *   console.log(`Server not running: ${status.reason}`)
 * }
 * ```
 */
export async function checkServerStatus(
  fromDir: string = process.cwd(),
  discovery?: IInstanceDiscovery,
): Promise<ServerStatus> {
  const disc = discovery ?? new DaemonInstanceDiscovery()
  const result = await disc.discover(fromDir)
  return toServerStatus(result)
}
