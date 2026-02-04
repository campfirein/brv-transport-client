/**
 * Test-only dependencies for TransportClient.
 *
 * This module exposes internal components for testing purposes only.
 * These dependencies should NOT be used in production code.
 *
 * @internal
 * @packageDocumentation
 */

import type {TransportClientDependencies} from '../../src/infra/socket-io-client.js'
import type {ConnectionStateManager} from '../../src/infra/connection-state-manager.js'
import type {EventDispatcher} from '../../src/infra/event-dispatcher.js'
import type {RoomManager} from '../../src/infra/room-manager.js'

/**
 * Extended dependencies type that includes internal components for testing.
 * Use this type only in test files, never in production code.
 *
 * @internal
 */
export type TransportClientTestDependencies = TransportClientDependencies & {
  /**
   * Connection state manager (internal, for testing).
   * @internal
   */
  readonly stateManager?: ConnectionStateManager
  /**
   * Event dispatcher (internal, for testing).
   * @internal
   */
  readonly eventDispatcher?: EventDispatcher
  /**
   * Room manager (internal, for testing).
   * @internal
   */
  readonly roomManager?: RoomManager
}
