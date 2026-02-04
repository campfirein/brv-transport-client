import type {ITransportClient} from './i-client.js'
import type {RegistrationOptions} from './i-client-factory-config.js'

/**
 * Result of connection attempt.
 */
export type ConnectionResult = {
  /** The connected client */
  readonly client: ITransportClient
  /** Project root where instance was found */
  readonly projectRoot: string
}

/**
 * Interface for transport client factory.
 * Abstracts the creation and connection of transport clients.
 *
 * @remarks
 * Follows Dependency Inversion Principle - high-level modules can depend
 * on this abstraction rather than concrete factory implementations.
 *
 * @example
 * ```typescript
 * // Inject factory abstraction
 * class MyService {
 *   constructor(private readonly factory: IClientFactory) {}
 *
 *   async connect(): Promise<ITransportClient> {
 *     const { client } = await this.factory.connect()
 *     return client
 *   }
 * }
 * ```
 */
export interface IClientFactory {
  /**
   * Discovers a running instance and connects to it.
   *
   * @param fromDir - Directory to start discovery from (default: cwd)
   * @param options - Optional registration options (autoRegister defaults to true)
   * @returns Connected client and project root
   * @throws NoInstanceRunningError - No daemon instance found
   * @throws InstanceCrashedError - Instance found but process dead
   * @throws ConnectionFailedError - Instance found but connection failed
   */
  connect(fromDir?: string, options?: RegistrationOptions): Promise<ConnectionResult>
}
