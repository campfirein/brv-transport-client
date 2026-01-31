import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

import type {DiscoveryResult, IInstanceDiscovery} from '../core/interfaces/i-instance-discovery.js'

import {DAEMON_INSTANCE_FILE, HEARTBEAT_FILE, HEARTBEAT_STALE_THRESHOLD_MS} from '../constants.js'
import {InstanceInfo, type InstanceInfoJson} from '../core/domain/entities/instance-info.js'
import {getGlobalDataDir} from './global-data-path.js'
import {isProcessAlive} from './process-utils.js'

/**
 * Daemon-based implementation of IInstanceDiscovery.
 *
 * Unlike FileInstanceDiscovery which walks up the directory tree looking for
 * project-local .brv/instance.json, this reads from the global daemon data
 * directory (~/.local/share/brv/instance.json).
 *
 * Health checks (all must pass for found=true):
 * 1. instance.json exists and is valid JSON with pid, port, startedAt
 * 2. Process with recorded PID is alive
 * 3. Heartbeat file exists and timestamp is within threshold (default 15s)
 */
export class DaemonInstanceDiscovery implements IInstanceDiscovery {
  readonly #dataDir: string
  readonly #heartbeatThresholdMs: number

  constructor(options?: {dataDir?: string; heartbeatThresholdMs?: number}) {
    this.#dataDir = options?.dataDir ?? getGlobalDataDir()
    this.#heartbeatThresholdMs = options?.heartbeatThresholdMs ?? HEARTBEAT_STALE_THRESHOLD_MS
  }

  async discover(fromDir: string): Promise<DiscoveryResult> {
    const instance = await this.#readInstanceFile()
    if (!instance) {
      return {found: false, reason: 'no_instance'}
    }

    if (!isProcessAlive(instance.pid)) {
      return {found: false, reason: 'no_instance'}
    }

    const heartbeatFresh = await this.#isHeartbeatFresh()
    if (!heartbeatFresh) {
      return {found: false, reason: 'no_instance'}
    }

    return {
      found: true,
      instance,
      projectRoot: fromDir,
    }
  }

  /**
   * Daemon is global — projectRoot is the caller's directory.
   */
  async findProjectRoot(fromDir: string): Promise<string | undefined> {
    return fromDir
  }

  async #readInstanceFile(): Promise<InstanceInfo | undefined> {
    const filePath = join(this.#dataDir, DAEMON_INSTANCE_FILE)

    try {
      const content = await readFile(filePath, 'utf8')
      const json: unknown = JSON.parse(content)

      if (!this.#isValidDaemonJson(json)) {
        return undefined
      }

      // Daemon instance.json lacks currentSessionId — default to null
      const instanceJson: InstanceInfoJson = {
        ...(json as {pid: number; port: number; startedAt: number}),
        currentSessionId: null,
      }

      return InstanceInfo.fromJson(instanceJson)
    } catch {
      return undefined
    }
  }

  async #isHeartbeatFresh(): Promise<boolean> {
    const heartbeatPath = join(this.#dataDir, HEARTBEAT_FILE)

    try {
      const content = await readFile(heartbeatPath, 'utf8')
      const timestamp = Number(content.trim())

      if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return false
      }

      const age = Date.now() - timestamp
      return age >= 0 && age < this.#heartbeatThresholdMs
    } catch {
      return false
    }
  }

  #isValidDaemonJson(value: unknown): value is {pid: number; port: number; startedAt: number} {
    if (typeof value !== 'object' || value === null) {
      return false
    }

    const obj = value as Record<string, unknown>

    return (
      typeof obj.pid === 'number' &&
      typeof obj.port === 'number' &&
      typeof obj.startedAt === 'number'
    )
  }
}
