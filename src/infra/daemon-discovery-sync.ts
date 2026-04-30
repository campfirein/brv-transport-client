import {join} from 'node:path'

import type {IGlobalInstanceManager} from '../core/interfaces/i-instance-manager.js'

import {HEARTBEAT_FILE} from '../constants.js'
import {checkDaemonHealth} from './daemon-health.js'
import {getGlobalDataDir} from './global-data-path.js'
import {GlobalInstanceManager} from './global-instance-manager.js'

export type DaemonStatus =
  | {clientVersion: string; daemonVersion: string; pid: number; reason: 'daemon_outdated'; running: false}
  | {pid: number; port: number; running: true}
  | {pid: number; reason: 'heartbeat_stale' | 'pid_dead'; running: false}
  | {reason: 'no_instance'; running: false}

/**
 * Checks whether the global daemon is running and healthy.
 *
 * Health checks (all must pass):
 * 1. daemon.json exists at <global-data-dir>/ and is valid
 * 2. PID is alive
 * 3. Heartbeat is fresh (<15s)
 * 4. Daemon version is at least as new as the calling client's (if provided).
 *    Asymmetric: only a strictly-newer client triggers `daemon_outdated`.
 *
 * @param options - Discovery options.
 * @param options.dataDir - Custom data directory (defaults to global).
 * @param options.clientVersion - The calling client's own version. If provided,
 *   the daemon must be at least this version. If the daemon is older returns
 *   `{running: false, reason: 'daemon_outdated', pid}`.
 * @param options.instanceManager - Injectable for testing and caller reuse.
 *   Defaults to a new GlobalInstanceManager if not provided.
 */
export function discoverDaemon(options?: {
  clientVersion?: string
  dataDir?: string
  instanceManager?: IGlobalInstanceManager
}): DaemonStatus {
  const dataDir = options?.dataDir ?? getGlobalDataDir()

  const instanceManager = options?.instanceManager ?? new GlobalInstanceManager({dataDir})
  const instance = instanceManager.load()

  if (!instance) {
    return {reason: 'no_instance', running: false}
  }

  const heartbeatPath = join(dataDir, HEARTBEAT_FILE)
  const health = checkDaemonHealth(instance.pid, heartbeatPath, {
    clientVersion: options?.clientVersion,
    daemonVersion: instance.version,
  })

  if (!health.healthy) {
    if (health.reason === 'daemon_outdated') {
      return {
        clientVersion: health.clientVersion,
        daemonVersion: health.daemonVersion,
        pid: instance.pid,
        reason: 'daemon_outdated',
        running: false,
      }
    }

    return {pid: instance.pid, reason: health.reason, running: false}
  }

  return {pid: instance.pid, port: instance.port, running: true}
}
