import {isHeartbeatStale} from './heartbeat-utils.js'
import {isProcessAlive} from './process-utils.js'
import {compareSemver} from './version-utils.js'

/**
 * Result of a daemon health check.
 *
 * `daemon_outdated` only fires when the *client* is strictly newer than the
 * running daemon (asymmetric). Older clients connecting to a newer daemon
 * are treated as healthy — this is what prevents the SIGTERM ping-pong loop
 * that two peer clients at different versions used to trigger.
 */
export type DaemonHealthResult =
  | {healthy: false; reason: 'heartbeat_stale'}
  | {healthy: false; reason: 'pid_dead'}
  | {
      /**
       * Version reported by the running daemon (read from daemon.json).
       *
       * Required, not optional: the producer guards on
       * `options.daemonVersion &&` before returning this branch (see
       * `checkDaemonHealth` below), so consumers can rely on a non-empty
       * string here without a presence check.
       */
      daemonVersion: string
      /** Version of the client that called the health check. */
      clientVersion: string
      healthy: false
      reason: 'daemon_outdated'
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
 * 3. Daemon version is at least as new as expected (if both provided).
 *    Asymmetric: only `client > daemon` returns `daemon_outdated`. The
 *    older-client direction returns healthy so it can connect to a newer
 *    daemon spawned by a peer, instead of SIGTERMing it back into a loop.
 *
 * @param pid - Daemon process ID to check
 * @param heartbeatPath - Path to heartbeat file
 * @param options - Optional version check parameters
 */
export function checkDaemonHealth(
  pid: number,
  heartbeatPath: string,
  options?: {clientVersion?: string; daemonVersion?: string},
): DaemonHealthResult {
  if (!isProcessAlive(pid)) {
    return {healthy: false, reason: 'pid_dead'}
  }

  if (isHeartbeatStale(heartbeatPath)) {
    return {healthy: false, reason: 'heartbeat_stale'}
  }

  if (
    options?.clientVersion &&
    options.daemonVersion &&
    compareSemver(options.clientVersion, options.daemonVersion) > 0
  ) {
    return {
      clientVersion: options.clientVersion,
      daemonVersion: options.daemonVersion,
      healthy: false,
      reason: 'daemon_outdated',
    }
  }

  return {healthy: true}
}
