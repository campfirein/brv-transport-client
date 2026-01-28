/**
 * Deep freeze utility for immutable object creation.
 * Recursively freezes an object and all nested objects/arrays.
 *
 * @param obj - The object to deep freeze
 * @returns The deeply frozen object
 *
 * @remarks
 * - Handles circular references (won't freeze same object twice)
 * - Freezes arrays and nested objects
 * - Skips primitive values and null
 * - Returns the same reference (mutates in place)
 *
 * @example
 * ```typescript
 * const config = deepFreeze({
 *   timeout: 5000,
 *   options: { path: '/socket' }
 * })
 * config.timeout = 10000 // TypeError in strict mode
 * config.options.path = '/evil' // TypeError in strict mode
 * ```
 */
export function deepFreeze<T>(obj: T): T {
  // Handle primitives and null
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  // Track frozen objects to handle circular references
  const frozen = new WeakSet<object>()

  function freezeRecursive(value: unknown): unknown {
    // Skip if already frozen or primitive
    if (value === null || typeof value !== 'object') {
      return value
    }

    // Skip if already processed (circular reference)
    if (frozen.has(value as object)) {
      return value
    }

    // Mark as frozen
    frozen.add(value as object)

    // Freeze all properties recursively
    Object.getOwnPropertyNames(value).forEach((prop) => {
      const propValue = (value as Record<string, unknown>)[prop]
      if (propValue && typeof propValue === 'object') {
        freezeRecursive(propValue)
      }
    })

    // Freeze the object itself
    return Object.freeze(value)
  }

  return freezeRecursive(obj) as T
}
