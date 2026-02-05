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
export declare function deepFreeze<T>(obj: T): T;
//# sourceMappingURL=deep-freeze.d.ts.map