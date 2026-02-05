import { InvalidEventNameError } from '../errors/transport-error.js';
import { validateNonEmptyString } from './common.js';
/**
 * Maximum allowed length for event names.
 * Prevents excessively long event names that could cause issues.
 */
const MAX_EVENT_NAME_LENGTH = 255;
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
export function validateEventName(event) {
    validateNonEmptyString(event, 'event name', MAX_EVENT_NAME_LENGTH, (value, message) => new InvalidEventNameError(value, message));
}
//# sourceMappingURL=event-name-validator.js.map