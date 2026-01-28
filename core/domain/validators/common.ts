/**
 * Common validation utilities for string-based identifiers.
 * Provides reusable validation logic to reduce duplication across validators.
 */

/**
 * Validates that a value is a non-empty string within a maximum length.
 *
 * @param value - The value to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @param maxLength - Maximum allowed length
 * @param createError - Factory function to create the appropriate error type
 * @throws Error created by createError factory if validation fails
 *
 * @remarks
 * Validation rules:
 * - Must be a string (not null, undefined, or other types)
 * - Must not be empty or whitespace-only
 * - Must not exceed maxLength characters
 *
 * @example
 * ```typescript
 * validateNonEmptyString(
 *   'my-value',
 *   'event name',
 *   255,
 *   (val, msg) => new InvalidEventNameError(val, msg)
 * )
 * ```
 */
export function validateNonEmptyString(
  value: string,
  fieldName: string,
  maxLength: number,
  createError: (value: string, message: string) => Error,
): void {
  // Check for null/undefined first
  if (value === undefined || value === null) {
    throw createError(String(value), `${fieldName} must be a string`)
  }

  // Check type
  if (typeof value !== 'string') {
    throw createError(String(value), `${fieldName} must be a string`)
  }

  // Check for empty or whitespace-only
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw createError(value, `${fieldName} cannot be empty`)
  }

  // Check maximum length
  if (trimmed.length > maxLength) {
    throw createError(value, `${fieldName} cannot exceed ${maxLength} characters`)
  }
}
