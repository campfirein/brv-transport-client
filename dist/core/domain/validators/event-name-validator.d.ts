/**
 * Validates that an event name is non-empty and properly formatted.
 *
 * @param event - The event name to validate
 * @throws InvalidEventNameError if event name is invalid
 *
 * @remarks
 * Validation rules:
 * - Must be a string (not null, undefined, or other types)
 * - Must not be empty or whitespace-only
 * - Must not exceed 255 characters
 *
 * @example
 * ```typescript
 * validateEventName('task:create')  // OK
 * validateEventName('')              // Throws InvalidEventNameError
 * validateEventName(null as any)     // Throws InvalidEventNameError
 * ```
 */
export declare function validateEventName(event: string): void;
//# sourceMappingURL=event-name-validator.d.ts.map