import type {ISocket} from '../core/interfaces/i-socket.js'
import type {IRoomManager} from '../core/interfaces/i-room-manager.js'
import type {IClientLogger} from '../core/interfaces/i-client-logger.js'
import type {ISocketProvider} from '../core/interfaces/i-socket-provider.js'
import {NoOpClientLogger} from './no-op-client-logger.js'
import {
  TransportNotConnectedError,
  TransportRoomError,
  TransportRoomTimeoutError,
} from '../core/domain/errors/transport-error.js'
import {validateRoomName} from '../core/domain/validators/index.js'
import {ROOM_MAX_REJOIN_ATTEMPTS, ROOM_REJOIN_BASE_DELAY_MS, TRANSPORT_ROOM_TIMEOUT_MS} from '../constants.js'

/**
 * Public configuration for RoomManager.
 * Follows Interface Segregation Principle - exposes only necessary options.
 */
export type RoomManagerConfig = {
  /** Timeout for room operations in milliseconds (default: 2000) */
  readonly roomTimeoutMs?: number
  /** Logger for debugging (default: NoOpClientLogger) */
  readonly logger?: IClientLogger
  /** Socket provider for accessing the socket instance (required) */
  readonly socketProvider: ISocketProvider
}

/**
 * Internal tuning parameters for rejoin behavior.
 * Not exposed in public API - implementation detail.
 * @internal
 */
type InternalRejoinConfig = {
  /** Maximum rejoin attempts after reconnect (default: 5) */
  readonly maxRejoinAttempts?: number
  /** Base delay for rejoin retry in milliseconds (default: 50) */
  readonly rejoinBaseDelayMs?: number
}

/**
 * Full internal configuration type.
 * @internal
 */
type InternalRoomManagerConfig = RoomManagerConfig & InternalRejoinConfig

/**
 * Manages room subscriptions for targeted broadcasts.
 * Handles join, leave, and auto-rejoin on reconnect.
 *
 * @remarks
 * - Tracks joined rooms for auto-rejoin after reconnect
 * - Uses exponential backoff for rejoin retries
 * - All operations have timeout protection
 * - Uses AbortController for clean cancellation of rejoin operations
 *
 * @example
 * ```typescript
 * const roomManager = new RoomManager()
 * roomManager.setSocket(socket)
 *
 * await roomManager.joinRoom('my-room')
 * console.log(roomManager.getJoinedRooms()) // Set { 'my-room' }
 *
 * // After reconnect
 * roomManager.rejoinRooms()
 *
 * await roomManager.leaveRoom('my-room')
 * ```
 */
export class RoomManager implements IRoomManager {
  readonly #logger: IClientLogger
  readonly #socketProvider: ISocketProvider
  readonly #roomTimeoutMs: number
  readonly #maxRejoinAttempts: number
  readonly #rejoinBaseDelayMs: number
  readonly #joinedRooms: Set<string> = new Set()

  /**
   * AbortControllers for each room's rejoin operation.
   * Using AbortController provides clean cancellation semantics
   * and avoids timer reference overwriting issues.
   */
  readonly #rejoinControllers: Map<string, AbortController> = new Map()

  constructor(config: InternalRoomManagerConfig) {
    this.#logger = config.logger ?? new NoOpClientLogger()
    this.#socketProvider = config.socketProvider
    this.#roomTimeoutMs = config.roomTimeoutMs ?? TRANSPORT_ROOM_TIMEOUT_MS
    this.#maxRejoinAttempts = config.maxRejoinAttempts ?? ROOM_MAX_REJOIN_ATTEMPTS
    this.#rejoinBaseDelayMs = config.rejoinBaseDelayMs ?? ROOM_REJOIN_BASE_DELAY_MS
  }

  /**
   * Gets the current socket from the provider.
   * @returns Socket instance or undefined if not connected
   */
  private get socket(): ISocket | undefined {
    return this.#socketProvider.getSocket()
  }

  /**
   * Gets the set of currently joined rooms.
   * Returns a defensive copy to prevent external mutation.
   * @returns Set of room identifiers (immutable copy)
   */
  public getJoinedRooms(): ReadonlySet<string> {
    return new Set(this.#joinedRooms)
  }

  /**
   * Joins a room for targeted broadcasts.
   * @throws InvalidRoomNameError if room name is invalid
   * @throws TransportNotConnectedError if not connected
   * @throws TransportRoomTimeoutError if join times out
   * @throws TransportRoomError if join fails
   */
  public async joinRoom(room: string): Promise<void> {
    validateRoomName(room)

    const socket = this.socket
    if (!socket?.connected) {
      throw new TransportNotConnectedError('joinRoom')
    }

    return new Promise((resolve, reject) => {
      let handled = false

      const timer = setTimeout(() => {
        if (handled) return
        handled = true
        reject(new TransportRoomTimeoutError(room, 'join', this.#roomTimeoutMs))
      }, this.#roomTimeoutMs)

      socket.emit('room:join', room, (response: {success: boolean}) => {
        if (handled) return
        handled = true
        clearTimeout(timer)

        if (response?.success) {
          this.#joinedRooms.add(room)
          this.log(`Joined room '${room}'`)
          resolve()
        } else {
          reject(new TransportRoomError(room, 'join'))
        }
      })
    })
  }

  /**
   * Leaves a previously joined room.
   * @throws InvalidRoomNameError if room name is invalid
   * @throws TransportNotConnectedError if not connected
   * @throws TransportRoomTimeoutError if leave times out
   * @throws TransportRoomError if leave fails
   */
  public async leaveRoom(room: string): Promise<void> {
    validateRoomName(room)

    const socket = this.socket
    if (!socket?.connected) {
      throw new TransportNotConnectedError('leaveRoom')
    }

    // Always remove from tracked rooms to prevent infinite rejoin loops
    this.#joinedRooms.delete(room)

    // Cancel any pending rejoin for this room
    this.cancelRejoin(room)

    return new Promise((resolve, reject) => {
      let handled = false

      const timer = setTimeout(() => {
        if (handled) return
        handled = true
        reject(new TransportRoomTimeoutError(room, 'leave', this.#roomTimeoutMs))
      }, this.#roomTimeoutMs)

      socket.emit('room:leave', room, (response: {success: boolean}) => {
        if (handled) return
        handled = true
        clearTimeout(timer)

        if (response?.success) {
          this.log(`Left room '${room}'`)
          resolve()
        } else {
          reject(new TransportRoomError(room, 'leave'))
        }
      })
    })
  }

  /**
   * Rejoins all tracked rooms after reconnect.
   * Skips rooms that already have an active rejoin operation in progress.
   */
  public rejoinRooms(): void {
    const rooms = [...this.#joinedRooms]
    const roomsToRejoin = rooms.filter((room) => !this.#rejoinControllers.has(room))

    if (roomsToRejoin.length === 0 && rooms.length > 0) {
      this.log(`Skipping rejoin - all ${rooms.length} rooms already have active rejoin operations`)
      return
    }

    this.log(`Rejoining ${roomsToRejoin.length} rooms: [${roomsToRejoin.join(', ')}]`)

    for (const room of roomsToRejoin) {
      // Start new rejoin operation
      const controller = new AbortController()
      this.#rejoinControllers.set(room, controller)
      void this.rejoinRoomWithRetry(room, controller.signal)
    }
  }

  /**
   * Clears all tracked rooms and cancels pending rejoin operations.
   */
  public clearRooms(): void {
    // Cancel all pending rejoin operations
    for (const controller of this.#rejoinControllers.values()) {
      controller.abort()
    }
    this.#rejoinControllers.clear()
    this.#joinedRooms.clear()
  }

  /**
   * Cancels rejoin operation for a specific room.
   */
  private cancelRejoin(room: string): void {
    const controller = this.#rejoinControllers.get(room)
    if (controller) {
      controller.abort()
      this.#rejoinControllers.delete(room)
    }
  }

  /**
   * Creates a cancellable delay using AbortSignal.
   * @returns Promise that resolves after delay or rejects if aborted
   */
  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('Aborted'))
        return
      }

      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort)
        resolve()
      }, ms)

      const onAbort = (): void => {
        clearTimeout(timer)
        reject(new Error('Aborted'))
      }

      signal.addEventListener('abort', onAbort, {once: true})
    })
  }

  /**
   * Rejoins a single room with retry logic and timeout protection.
   * Uses exponential backoff: 50ms, 100ms, 200ms, 400ms, 800ms (max 5 attempts).
   * Cancellable via AbortSignal for clean cleanup.
   */
  private async rejoinRoomWithRetry(room: string, signal: AbortSignal): Promise<void> {
    for (let attempt = 0; attempt < this.#maxRejoinAttempts; attempt++) {
      // Check if cancelled
      if (signal.aborted) {
        this.log(`Rejoin cancelled for '${room}'`)
        return
      }

      this.log(`Attempting to rejoin '${room}' (attempt ${attempt + 1}/${this.#maxRejoinAttempts})`)

      try {
        const success = await this.attemptRoomJoin(room, signal)
        if (success) {
          this.log(`Successfully rejoined '${room}'`)
          this.#rejoinControllers.delete(room)
          return
        }

        // attemptRoomJoin returned false (socket not connected or join failed)
        // Log appropriate message for retry
        if (!this.socket?.connected) {
          this.log(`Socket not connected, will retry '${room}'`)
        } else {
          this.log(`Join failed for '${room}', will retry`)
        }
      } catch (error) {
        // Check if it was an abort
        if (signal.aborted) {
          this.log(`Rejoin cancelled for '${room}'`)
          return
        }
        // Timeout or other error - continue to retry
        const errorMsg = error instanceof Error ? error.message : String(error)
        this.log(`Rejoin attempt failed for '${room}': ${errorMsg}`)
      }

      // Retry with backoff (unless it's the last attempt)
      if (attempt < this.#maxRejoinAttempts - 1) {
        const delayMs = this.#rejoinBaseDelayMs * 2 ** attempt
        this.log(`Retrying '${room}' in ${delayMs}ms`)
        try {
          await this.delay(delayMs, signal)
        } catch {
          // Aborted
          this.log(`Rejoin cancelled for '${room}' during retry delay`)
          return
        }
      }
    }

    this.log(`Gave up rejoining '${room}' after ${this.#maxRejoinAttempts} attempts`)
    this.#rejoinControllers.delete(room)
  }

  /**
   * Attempts to join a room with timeout protection.
   * @returns true if join succeeded, false if failed
   * @throws Error if aborted or timed out
   */
  private attemptRoomJoin(room: string, signal: AbortSignal): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const socket = this.socket
      if (!socket?.connected) {
        resolve(false)
        return
      }

      let handled = false

      // Setup abort handler
      const onAbort = (): void => {
        if (handled) return
        handled = true
        clearTimeout(timer)
        reject(new Error('Aborted'))
      }
      signal.addEventListener('abort', onAbort, {once: true})

      // Setup timeout
      const timer = setTimeout(() => {
        if (handled) return
        handled = true
        signal.removeEventListener('abort', onAbort)
        reject(new Error('Timeout'))
      }, this.#roomTimeoutMs)

      // Attempt join
      socket.emit('room:join', room, (response: {success: boolean}) => {
        if (handled) return
        handled = true
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        resolve(response?.success ?? false)
      })
    })
  }

  /**
   * Logs a message with prefix.
   */
  private log(message: string): void {
    this.#logger.debug(`[RoomManager] ${message}`)
  }
}
