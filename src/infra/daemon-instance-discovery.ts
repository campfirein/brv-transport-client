import {access, readFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'

import type {DiscoveryResult, IInstanceDiscovery} from '../core/interfaces/i-instance-discovery.js'
import type {IClientLogger} from '../core/interfaces/i-client-logger.js'

import {BRV_DIR, DAEMON_INSTANCE_FILE, HEARTBEAT_FILE} from '../constants.js'
import {InstanceInfo} from '../core/domain/entities/instance-info.js'
import {checkDaemonHealth} from './daemon-health.js'
import {getGlobalDataDir} from './global-data-path.js'
import {NoOpClientLogger} from './no-op-client-logger.js'
import {DaemonInstanceSchema} from './schemas/schemas.js'

/**
 * Default implementation of IInstanceDiscovery.
 *
 * Reads from the platform-specific global data directory (see getGlobalDataDir()).
 * Single daemon per machine — no project-local discovery.
 *
 * Health checks (all must pass for found=true):
 * 1. daemon.json exists and is valid JSON with pid, port, startedAt
 * 2. Process with recorded PID is alive
 * 3. Heartbeat file exists and timestamp is within threshold (default 15s)
 */
export class DaemonInstanceDiscovery implements IInstanceDiscovery {
  readonly #dataDir: string
  readonly #logger: IClientLogger

  constructor(options?: {dataDir?: string; logger?: IClientLogger}) {
    this.#dataDir = options?.dataDir ?? getGlobalDataDir()
    this.#logger = options?.logger ?? new NoOpClientLogger()
  }

  async discover(fromDir: string): Promise<DiscoveryResult> {
    const instance = await this.#readInstanceFile()
    if (!instance) {
      return {found: false, reason: 'no_instance'}
    }

    const heartbeatPath = join(this.#dataDir, HEARTBEAT_FILE)
    const health = checkDaemonHealth(instance.pid, heartbeatPath)

    if (!health.healthy) {
      const reason = health.reason === 'pid_dead' ? 'instance_crashed' : 'instance_stale'
      return {found: false, reason}
    }

    const projectRoot = await this.#findProjectRoot(fromDir)

    return {
      found: true,
      instance,
      ...(projectRoot !== undefined && {projectRoot}),
    }
  }

  async #findProjectRoot(fromDir: string): Promise<string | undefined> {
    let currentDir = fromDir

    while (true) {
      try {
        await access(join(currentDir, BRV_DIR))
        return currentDir
      } catch {
        // .brv/ not found at this level, walk up
      }

      const parentDir = dirname(currentDir)
      if (parentDir === currentDir) {
        // Reached filesystem root
        return undefined
      }
      currentDir = parentDir
    }
  }

  async #readInstanceFile(): Promise<InstanceInfo | undefined> {
    const filePath = join(this.#dataDir, DAEMON_INSTANCE_FILE)

    try {
      const content = await readFile(filePath, 'utf8')
      const json: unknown = JSON.parse(content)

      // Use Zod schema for validation instead of manual type guard
      const parsed = DaemonInstanceSchema.safeParse(json)
      if (!parsed.success) {
        this.#logger.debug(`Invalid daemon.json schema: ${parsed.error.message}`)
        return undefined
      }

      return InstanceInfo.fromJson(parsed.data)
    } catch (error) {
      // Log specific error types for debugging
      if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as {code?: string}).code
        if (code === 'ENOENT') {
          this.#logger.debug('Daemon instance file not found')
        } else if (code === 'EACCES') {
          this.#logger.warn(`Permission denied reading daemon instance: ${filePath}`)
        } else {
          this.#logger.error(`Failed to read daemon instance: ${error}`)
        }
      } else if (error instanceof SyntaxError) {
        this.#logger.error(`Invalid JSON in daemon.json: ${error.message}`)
      } else {
        this.#logger.error(`Failed to read daemon instance: ${error}`)
      }
      return undefined
    }
  }

}
