/**
 * Client Factory Configuration Types
 *
 * Configuration contracts for transport client factory and connection options.
 * Moved to interface layer to enable proper dependency flow following Clean Architecture.
 */

import type {IClientLogger} from './i-client-logger.js'
import type {IInstanceDiscovery} from './i-instance-discovery.js'
import type {ClientType} from '../domain/types.js'

/**
 * Configuration for transport client factory.
 * All properties are optional with sensible defaults.
 */
export type TransportClientFactoryConfig = {
  // === Dependency Injection ===

  /**
   * Instance discovery service (dependency injection).
   * Default: DaemonInstanceDiscovery (discovers daemon from global data directory)
   */
  readonly discovery?: IInstanceDiscovery

  /**
   * Logger instance (dependency injection).
   * Default: NoOpClientLogger (silent)
   */
  readonly logger?: IClientLogger

  // === Connection Configuration ===

  /**
   * Maximum number of connection retry attempts.
   * Default: 8 (optimized for sandbox environments)
   */
  readonly maxRetries?: number

  /**
   * Delay between retry attempts in milliseconds.
   * Default: 150ms (faster for sandbox warm-up)
   */
  readonly retryDelayMs?: number

  /**
   * Timeout for HTTP warm-up request in milliseconds.
   * Used to trigger sandbox network permissions before Socket.IO connection.
   * Default: 1000ms
   */
  readonly warmUpTimeoutMs?: number

  /**
   * Timeout for Socket.IO connection in milliseconds.
   * Default: 5000ms
   */
  readonly connectTimeoutMs?: number

  /**
   * Delay after HTTP warm-up before connecting in milliseconds.
   * Gives sandbox time to settle after permission prompt.
   * Default: 100ms
   */
  readonly warmUpSettleDelayMs?: number
}

/**
 * Registration options for client identification.
 * Used to identify client type to the server for monitoring and lifecycle management.
 */
export type RegistrationOptions = {
  /**
   * Whether to automatically register after successful connection.
   * Default: true
   *
   * Set to false for debug/monitoring commands that shouldn't affect daemon lifecycle.
   *
   * @example
   * ```typescript
   * // Default: auto-register as 'cli'
   * connectToTransport()
   *
   * // Debug command: opt-out
   * connectToTransport(undefined, { autoRegister: false })
   * ```
   */
  readonly autoRegister?: boolean

  /**
   * Client type for server categorization.
   * Default: 'cli'
   *
   * Types:
   * - 'cli': Command-line interface commands
   * - 'agent': Background agent process
   * - 'mcp': Model Context Protocol server
   * - 'tui': Text-based user interface (REPL)
   * - 'extension': IDE extension (VSCode, JetBrains, etc.)
   *
   * @example
   * ```typescript
   * // Register as TUI
   * connectToTransport(undefined, { clientType: 'tui' })
   *
   * // Register as IDE extension
   * connectToTransport(undefined, { clientType: 'extension' })
   *
   * // Opt-out of registration
   * connectToTransport(undefined, { autoRegister: false })
   * ```
   */
  readonly clientType?: ClientType

  /**
   * Rooms to join after successful connection and registration.
   * Rooms are joined in order after registration completes.
   *
   * @example
   * ```typescript
   * // TUI joins broadcast room for event monitoring
   * connectToTransport(undefined, { clientType: 'tui', joinRooms: ['broadcast-room'] })
   * ```
   */
  readonly joinRooms?: readonly string[]

  /**
   * Project path for server-side project tracking.
   * Included in the client:register payload alongside clientType.
   *
   * When set, the server associates this client with the specified project
   * for lifecycle management (e.g., agent pool routing, idle timeout).
   *
   * @example
   * ```typescript
   * // Register CLI with project path
   * connectToTransport(undefined, { clientType: 'cli', projectPath: '/path/to/project' })
   *
   * // MCP global mode: no projectPath (serves multiple projects)
   * connectToTransport(undefined, { clientType: 'mcp' })
   * ```
   */
  readonly projectPath?: string
}

/**
 * Extended configuration combining factory config and registration options.
 * Used by connectToTransport() and TransportClientFactory.connect().
 *
 * @example
 * ```typescript
 * // With factory config + registration
 * const {client} = await connectToTransport(undefined, {
 *   logger: myLogger,
 *   maxRetries: 5,
 *   autoRegister: true,
 *   clientType: 'agent',
 * })
 * ```
 */
export type ConnectOptions = TransportClientFactoryConfig & RegistrationOptions
