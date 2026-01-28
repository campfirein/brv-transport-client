import type {InstanceInfo} from '../domain/entities/instance-info.js'

/**
 * Read-only interface for loading instance information.
 *
 * This is a subset of IInstanceManager that only exposes the load() method,
 * following the Interface Segregation Principle. The socket-io-client component
 * only needs to READ instance.json, not write or manage it.
 */
export interface IInstanceReader {
  /**
   * Reads instance info from the project root.
   * Returns undefined if instance.json doesn't exist or is invalid.
   *
   * @param projectRoot - Root directory containing .brv/
   * @returns Instance info or undefined if not found/invalid
   */
  load(projectRoot: string): Promise<InstanceInfo | undefined>
}
