import {isHeartbeatStale} from './heartbeat-utils.js'
import {isProcessAlive} from './process-utils.js'

/**
 * Result of a daemon health check.
 */
export type DaemonHealthResult =
  | {healthy: false; reason: 'heartbeat_stale'}
  | {healthy: false; reason: 'pid_dead'}
  | {
      actualVersion?: string
      expectedVersion: string
      healthy: false
      reason: 'version_mismatch'
    }
  | {healthy: true}

/**
 * Checks daemon health (synchronous).
 *
 * Single source of truth for all daemon health checks.
 * Used by both discoverDaemon (sync) and DaemonInstanceDiscovery (async).
 *
 * Health checks (in order):
 * 1. PID is alive (process.kill(pid, 0))
 * 2. Heartbeat is fresh (< threshold)
 * 3. Version matches expected (if provided)
 *
 * @param pid - Daemon process ID to check
 * @param heartbeatPath - Path to heartbeat file
 * @param options - Optional version check parameters
 */
export function checkDaemonHealth(
  pid: number,
  heartbeatPath: string,
  options?: {actualVersion?: string; expectedVersion?: string},
): DaemonHealthResult {
  if (!isProcessAlive(pid)) {
    return {healthy: false, reason: 'pid_dead'}
  }

  if (isHeartbeatStale(heartbeatPath)) {
    return {healthy: false, reason: 'heartbeat_stale'}
  }

  if (options?.expectedVersion && options.actualVersion !== options.expectedVersion) {
    return {
      actualVersion: options.actualVersion,
      expectedVersion: options.expectedVersion,
      healthy: false,
      reason: 'version_mismatch',
    }
  }

  return {healthy: true}
}
