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
export declare function validateRoomName(room: string): void;
//# sourceMappingURL=room-name-validator.d.ts.map