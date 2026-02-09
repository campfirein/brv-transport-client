import {closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {z} from 'zod'

import type {ISpawnLock, SpawnLockAcquireResult} from '../core/interfaces/i-spawn-lock.js'

import {SPAWN_LOCK_FILE, SPAWN_LOCK_STALE_THRESHOLD_MS} from '../constants.js'
import {getGlobalDataDir} from './global-data-path.js'
import {isProcessAlive} from './process-utils.js'

export type {SpawnLockAcquireResult} from '../core/interfaces/i-spawn-lock.js'

const SpawnLockDataSchema = z.object({
  pid: z.number(),
  timestamp: z.number(),
})

type SpawnLockData = z.infer<typeof SpawnLockDataSchema>

function isValidSpawnLockData(value: unknown): value is SpawnLockData {
  return SpawnLockDataSchema.safeParse(value).success
}

/**
 * File-based spawn lock to prevent multiple clients from
 * spawning multiple daemon processes simultaneously.
 *
 * Uses O_EXCL (exclusive create) for truly atomic cross-process locking.
 * openSync('wx') fails with EEXIST if the file already exists, guaranteeing
 * that only one process can create the lock file.
 *
 * Lock is considered stale (can be overwritten) if:
 * - PID is dead
 * - Timestamp is older than 30s
 * - File is corrupted or missing
 */
export class SpawnLock implements ISpawnLock {
  #acquired = false
  readonly #lockPath: string

  constructor(options?: {dataDir?: string}) {
    const dataDir = options?.dataDir ?? getGlobalDataDir()
    this.#lockPath = join(dataDir, SPAWN_LOCK_FILE)
  }

  acquire(): SpawnLockAcquireResult {
    mkdirSync(dirname(this.#lockPath), {recursive: true})

    // First attempt: exclusive create (O_CREAT | O_EXCL) — truly atomic across processes.
    // Unlike rename (which overwrites silently), openSync('wx') fails with EEXIST
    // if another process created the file first.
    const firstAttempt = this.tryExclusiveCreate()
    if (firstAttempt.acquired || firstAttempt.reason === 'write_failed') {
      return firstAttempt
    }

    // Lock file exists — check if held by an active process
    if (this.isLockHeld()) {
      return {acquired: false, reason: 'held_by_another_process'}
    }

    // Lock is stale (dead PID or expired timestamp) — remove and retry once.
    // If two processes both remove the stale lock, only one will win the
    // exclusive create on retry (O_EXCL guarantees this).
    try {
      unlinkSync(this.#lockPath)
    } catch {
      // File may have been removed by another process — that's fine
    }

    return this.tryExclusiveCreate()
  }

  release(): void {
    if (!this.#acquired) return
    try {
      if (!this.verifyOwnership()) {
        this.#acquired = false
        return
      }

      unlinkSync(this.#lockPath)
    } catch {
      // Best-effort delete
    }

    this.#acquired = false
  }

  private tryExclusiveCreate(): SpawnLockAcquireResult {
    try {
      const data: SpawnLockData = {pid: process.pid, timestamp: Date.now()}
      // 'wx' = O_WRONLY | O_CREAT | O_EXCL — fails with EEXIST if file exists
      const fd = openSync(this.#lockPath, 'wx')
      writeSync(fd, JSON.stringify(data))
      closeSync(fd)

      this.#acquired = true
      return {acquired: true}
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
        return {acquired: false, reason: 'held_by_another_process'}
      }

      return {acquired: false, reason: 'write_failed'}
    }
  }

  private isLockHeld(): boolean {
    try {
      const content = readFileSync(this.#lockPath, 'utf8')
      const parsed: unknown = JSON.parse(content)
      if (!isValidSpawnLockData(parsed)) return false

      // Stale if PID is dead
      if (!isProcessAlive(parsed.pid)) return false

      // Stale if older than threshold.
      // Note: Unlike isHeartbeatStale(), future timestamps (clock skew) are NOT
      // treated as stale here. The PID alive check above is the primary guard;
      // the timestamp is secondary (prevents indefinitely held locks from crashed processes).
      if (Date.now() - parsed.timestamp > SPAWN_LOCK_STALE_THRESHOLD_MS) return false

      return true
    } catch {
      return false
    }
  }

  private verifyOwnership(): boolean {
    try {
      const content = readFileSync(this.#lockPath, 'utf8')
      const parsed: unknown = JSON.parse(content)
      if (!isValidSpawnLockData(parsed)) return false
      return parsed.pid === process.pid
    } catch {
      return false
    }
  }
}
