import type {InstanceInfo} from '../domain/entities/instance-info.js'

/**
 * Result of instance discovery.
 *
 * - no_instance: No daemon.json found in global data directory
 * - instance_crashed: Found instance but process (pid) is dead
 * - instance_stale: Found instance but heartbeat expired
 */
export type DiscoveryResult =
  | {found: false; reason: 'instance_crashed' | 'instance_stale' | 'no_instance'}
  | {found: true; instance: InstanceInfo; projectRoot?: string}

/**
 * Interface for discovering running ByteRover instances.
 *
 * Default implementation: DaemonInstanceDiscovery
 * Reads from platform-specific global data directory (daemon.json + heartbeat).
 */
export interface IInstanceDiscovery {
  /**
   * Discovers a running instance starting from the given directory.
   *
   * @param fromDir - Starting directory (usually cwd), used as the client's project context.
   * @returns DiscoveryResult with instance info and project root if found
   */
  discover: (fromDir: string) => Promise<DiscoveryResult>
}
