/**
 * Internal test dependencies for TransportClient testing.
 * This module is not part of the public API and should only be used in tests.
 *
 * @internal
 * @packageDocumentation
 */

import type {ConnectionStateManager} from '../connection-state-manager.js'
import type {EventDispatcher} from '../event-dispatcher.js'
import type {RoomManager} from '../room-manager.js'

/**
 * Internal dependencies for testing purposes only.
 * Allows injection of mock components for unit testing.
 *
 * @internal
 *
 * @remarks
 * **DO NOT USE IN PRODUCTION CODE**
 *
 * This type exists solely for testing purposes and allows tests to inject
 * mock implementations of internal components. Using this in production
 * code violates the encapsulation guarantees of TransportClient.
 *
 * @example
 * ```typescript
 * // In test files only
 * import { TransportClient } from './socket-io-client.js'
 * import type { InternalTestDependencies } from './testing/test-dependencies.js'
 *
 * const mockStateManager = createMockStateManager()
 * const client = new TransportClient({
 *   stateManager: mockStateManager
 * } as InternalTestDependencies)
 * ```
 */
export type InternalTestDependencies = {
  /** Connection state manager (internal, for testing only) */
  readonly stateManager?: ConnectionStateManager
  /** Event dispatcher (internal, for testing only) */
  readonly eventDispatcher?: EventDispatcher
  /** Room manager (internal, for testing only) */
  readonly roomManager?: RoomManager
}
