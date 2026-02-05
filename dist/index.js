/**
 * ByteRover Transport Client
 *
 * A self-contained leaf component for transport client functionality.
 * This component has NO dependencies on other brv modules.
 *
 * @example
 * ```typescript
 * import {
 *   createTransportClientFactory,
 *   NoInstanceRunningError,
 *   ConnectionFailedError
 * } from '@campfirein/brv-transport-client'
 *
 * const factory = createTransportClientFactory()
 * try {
 *   const { client, projectRoot } = await factory.connect()
 *   // Use the connected client...
 * } catch (error) {
 *   if (error instanceof NoInstanceRunningError) {
 *     console.log('No instance running')
 *   }
 * }
 * ```
 */
// Constants (for advanced configuration)
export { BRV_DIR, INSTANCE_FILE, TRANSPORT_CONNECT_TIMEOUT_MS, TRANSPORT_DEFAULT_TRANSPORTS, TRANSPORT_HOST, TRANSPORT_RECONNECTION_ATTEMPTS, TRANSPORT_RECONNECTION_DELAY_MAX_MS, TRANSPORT_RECONNECTION_DELAY_MS, TRANSPORT_REQUEST_TIMEOUT_MS, TRANSPORT_ROOM_TIMEOUT_MS, } from './constants.js';
export { InstanceInfo } from './core/domain/entities/instance-info.js';
// Errors
export { ConnectionError, ConnectionFailedError, ConnectionTimeoutError, InstanceCrashedError, InvalidInstanceDataError, NoInstanceRunningError, } from './core/domain/errors/connection-error.js';
export { ConcurrentConnectionError, InvalidEventNameError, InvalidOperationError, InvalidResponseError, InvalidRoomNameError, InvalidStateTransitionError, InvalidTimeoutError, InvalidTransportUrlError, MaxPendingOnceHandlersExceededError, TransportConnectionError, TransportError, TransportNotConnectedError, TransportRequestError, TransportRequestTimeoutError, TransportRoomError, TransportRoomTimeoutError, } from './core/domain/errors/transport-error.js';
// Validators
export { validateEventName, validateRoomName } from './core/domain/validators/index.js';
// ============================================================================
// Events Module - Event names (domain layer, pure TypeScript)
// ============================================================================
export { 
// Event name constants
AgentEventNames, CipherEventNames, EventNames, LlmEventList, LlmEventNames, SessionEventNames, TaskEventNames, TaskTerminalStates, } from './core/domain/events/index.js';
// ============================================================================
// Schemas Module - Zod schemas and derived types (infra layer)
// ============================================================================
export { 
// Zod schemas (for runtime validation)
AgentNewSessionRequestSchema, AgentNewSessionResponseSchema, AgentRestartRequestSchema, AgentRestartResponseSchema, AgentStatusSchema, AgentTerminationReasonSchema, ChunkTypeSchema, CipherConversationResetSchema, CipherExecutionStartedSchema, CipherExecutionTerminatedSchema, CipherLogSchema, CipherStateChangedSchema, CipherStateResetSchema, CipherUISchema, LlmChunkSchema, LlmErrorSchema, LlmOutputTruncatedSchema, LlmResponseSchema, LlmThinkingSchema, LlmThoughtSchema, LlmTodoUpdatedSchema, LlmToolCallSchema, LlmToolResultSchema, LlmUnsupportedInputSchema, LlmWarningSchema, LogLevelSchema, SessionCreateRequestSchema, SessionCreateResponseSchema, SessionInfoRequestSchema, SessionInfoResponseSchema, SessionInfoSchema, SessionListRequestSchema, SessionListResponseSchema, SessionStatsSchema, SessionSwitchedBroadcastSchema, SessionSwitchRequestSchema, SessionSwitchResponseSchema, TaskAckSchema, TaskCancelledSchema, TaskCancelRequestSchema, TaskCancelResponseSchema, TaskCompletedSchema, TaskCreatedSchema, TaskCreateRequestSchema, TaskErrorDataSchema, TaskErrorSchema, TaskExecuteSchema, TaskStartedSchema, TaskTypeSchema, TodoItemSchema, TodoStatusSchema, TokenUsageSchema, ToolErrorTypeSchema, UIEventTypeSchema, } from './infra/schemas/index.js';
export { NoOpClientLogger } from './infra/no-op-client-logger.js';
// Connection management (public API)
export { checkServerStatus, // Check if server is running (non-throwing)
connectToTransport, // Simplified API: discover + connect in one call (RECOMMENDED)
 } from './infra/client-factory.js';
// Legacy factory pattern (deprecated, but kept for backward compatibility)
export { createTransportClientFactory, // @deprecated Use connectToTransport() instead
TransportClientFactory, // Factory class
 } from './infra/client-factory.js';
// NOTE: Removed from public API (dead code, not used in byterover-cli):
// - getTransportClientFactory() - 0 usage
// - getConnectedClient() - Not used by CLI
// - disconnectClient() - Not used by CLI
// - SingletonClientManager - Internal implementation detail
export { FileInstanceDiscovery } from './infra/file-instance-discovery.js';
export { FileInstanceReader } from './infra/file-instance-reader.js';
// Utilities
export { isProcessAlive } from './infra/process-utils.js';
// Infrastructure implementations - Main client
export { TransportClient, } from './infra/socket-io-client.js';
// Infrastructure implementations - Component implementations (SRP)
export { ConnectionStateManager } from './infra/connection-state-manager.js';
export { EventDispatcher, } from './infra/event-dispatcher.js';
export { ForceReconnectManager, } from './infra/force-reconnect-manager.js';
export { createDefaultReconnectionStrategy, ExponentialBackoffStrategy, } from './infra/reconnection-strategy.js';
export { RoomManager } from './infra/room-manager.js';
export { createDefaultWakeDetector, TimeBasedWakeDetector } from './infra/wake-detector.js';
//# sourceMappingURL=index.js.map