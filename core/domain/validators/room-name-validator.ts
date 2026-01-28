import {InvalidRoomNameError} from '../errors/transport-error.js'
import {validateNonEmptyString} from './common.js'

/**
 * Maximum allowed length for room names.
 * Socket.IO has no hard limit, but 255 is sensible.
 */
const MAX_ROOM_NAME_LENGTH = 255

/**
 * Validates that a room name is non-empty and properly formatted.
 *
 * @param room - The room name to validate
 * @throws InvalidRoomNameError if room name is invalid
 *
 * @remarks
 * Validation rules:
 * - Must be a string (not null, undefined, or other types)
 * - Must not be empty or whitespace-only
 * - Must not exceed 255 characters
 *
 * @example
 * ```typescript
 * validateRoomName('my-room')        // OK
 * validateRoomName('')               // Throws InvalidRoomNameError
 * validateRoomName(null as any)      // Throws InvalidRoomNameError
 * ```
 */
export function validateRoomName(room: string): void {
  validateNonEmptyString(
    room,
    'room name',
    MAX_ROOM_NAME_LENGTH,
    (value, message) => new InvalidRoomNameError(value, message),
  )
}
