import {readFileSync} from 'node:fs'

import {HEARTBEAT_STALE_THRESHOLD_MS} from '../constants.js'

/**
 * Checks whether the heartbeat file is stale (or missing).
 *
 * Returns true if:
 * - File does not exist
 * - File cannot be read
 * - File content is not a valid timestamp
 * - Timestamp is in the future (clock skew)
 * - Timestamp is older than thresholdMs (default 15s)
 */
export function isHeartbeatStale(filePath: string, thresholdMs?: number): boolean {
  const threshold = thresholdMs ?? HEARTBEAT_STALE_THRESHOLD_MS
  try {
    const content = readFileSync(filePath, 'utf8')
    const timestamp = Number(content.trim())
    if (!Number.isFinite(timestamp) || timestamp <= 0) return true
    const age = Date.now() - timestamp
    // Future timestamps (age < 0) are treated as stale — clock skew should not
    // trick us into thinking the daemon is healthy.
    return age < 0 || age > threshold
  } catch {
    return true
  }
}
