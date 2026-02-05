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
export { BRV_DIR, INSTANCE_FILE, TRANSPORT_CONNECT_TIMEOUT_MS, TRANSPORT_DEFAULT_TRANSPORTS, TRANSPORT_HOST, TRANSPORT_RECONNECTION_ATTEMPTS, TRANSPORT_RECONNECTION_DELAY_MAX_MS, TRANSPORT_RECONNECTION_DELAY_MS, TRANSPORT_REQUEST_TIMEOUT_MS, TRANSPORT_ROOM_TIMEOUT_MS, } from './constants.js';
export { InstanceInfo, type InstanceInfoJson } from './core/domain/entities/instance-info.js';
export { ConnectionError, ConnectionFailedError, ConnectionTimeoutError, InstanceCrashedError, InvalidInstanceDataError, NoInstanceRunningError, } from './core/domain/errors/connection-error.js';
export { ConcurrentConnectionError, InvalidEventNameError, InvalidOperationError, InvalidResponseError, InvalidRoomNameError, InvalidStateTransitionError, InvalidTimeoutError, InvalidTransportUrlError, MaxPendingOnceHandlersExceededError, TransportConnectionError, TransportError, TransportNotConnectedError, TransportRequestError, TransportRequestTimeoutError, TransportRoomError, TransportRoomTimeoutError, } from './core/domain/errors/transport-error.js';
export { validateEventName, validateRoomName } from './core/domain/validators/index.js';
export { AgentEventNames, CipherEventNames, EventNames, LlmEventList, LlmEventNames, SessionEventNames, TaskEventNames, TaskTerminalStates, type AgentEventName, type CipherEventName, type LlmEventName, type SessionEventName, type TaskEventName, type TransportEventName, } from './core/domain/events/index.js';
export { AgentNewSessionRequestSchema, AgentNewSessionResponseSchema, AgentRestartRequestSchema, AgentRestartResponseSchema, AgentStatusSchema, AgentTerminationReasonSchema, ChunkTypeSchema, CipherConversationResetSchema, CipherExecutionStartedSchema, CipherExecutionTerminatedSchema, CipherLogSchema, CipherStateChangedSchema, CipherStateResetSchema, CipherUISchema, LlmChunkSchema, LlmErrorSchema, LlmOutputTruncatedSchema, LlmResponseSchema, LlmThinkingSchema, LlmThoughtSchema, LlmTodoUpdatedSchema, LlmToolCallSchema, LlmToolResultSchema, LlmUnsupportedInputSchema, LlmWarningSchema, LogLevelSchema, SessionCreateRequestSchema, SessionCreateResponseSchema, SessionInfoRequestSchema, SessionInfoResponseSchema, SessionInfoSchema, SessionListRequestSchema, SessionListResponseSchema, SessionStatsSchema, SessionSwitchedBroadcastSchema, SessionSwitchRequestSchema, SessionSwitchResponseSchema, TaskAckSchema, TaskCancelledSchema, TaskCancelRequestSchema, TaskCancelResponseSchema, TaskCompletedSchema, TaskCreatedSchema, TaskCreateRequestSchema, TaskErrorDataSchema, TaskErrorSchema, TaskExecuteSchema, TaskStartedSchema, TaskTypeSchema, TodoItemSchema, TodoStatusSchema, TokenUsageSchema, ToolErrorTypeSchema, UIEventTypeSchema, } from './infra/schemas/index.js';
export type { AgentNewSessionRequest, AgentNewSessionResponse, AgentRestartRequest, AgentRestartResponse, AgentStatus, AgentTerminationReason, ChunkType, CipherConversationReset, CipherEventPayloadMap, CipherExecutionStarted, CipherExecutionTerminated, CipherLog, CipherStateChanged, CipherStateReset, CipherUI, LlmChunk, LlmError, LlmEventPayloadMap, LlmOutputTruncated, LlmResponse, LlmThinking, LlmThought, LlmTodoUpdated, LlmToolCall, LlmToolResult, LlmUnsupportedInput, LlmWarning, LogLevel, RequestResponseMap, SessionCreateRequest, SessionCreateResponse, SessionEventPayloadMap, SessionInfo, SessionInfoRequest, SessionInfoResponse, SessionListRequest, SessionListResponse, SessionStats, SessionSwitchedBroadcast, SessionSwitchRequest, SessionSwitchResponse, TaskAck, TaskCancelled, TaskCancelRequest, TaskCancelResponse, TaskCompleted, TaskCreated, TaskCreateRequest, TaskError, TaskErrorData, TaskEventPayloadMap, TaskExecute, TaskStarted, TaskType, TodoItem, TodoStatus, TokenUsage, ToolErrorType, TransportEventPayloadMap, UIEventType, } from './infra/schemas/index.js';
export type { ClientConfig, SocketTransport } from './core/domain/types.js';
export type { IClientLogger } from './core/interfaces/i-client-logger.js';
export { NoOpClientLogger } from './infra/no-op-client-logger.js';
export type { ConnectionState, ConnectionStateHandler, EventHandler, ITransportClient, RequestOptions, } from './core/interfaces/i-client.js';
export type { IConnectionStateManager, IConnectionStateReader } from './core/interfaces/i-connection-state.js';
export type { IEventDispatcher } from './core/interfaces/i-event-dispatcher.js';
export type { IForceReconnectManager } from './core/interfaces/i-force-reconnect-manager.js';
export type { IReconnectionStrategy } from './core/interfaces/i-reconnection-strategy.js';
export type { IRoomManager } from './core/interfaces/i-room-manager.js';
export type { IWakeDetector, WakeHandler } from './core/interfaces/i-wake-detector.js';
export type { DiscoveryResult, IInstanceDiscovery } from './core/interfaces/i-instance-discovery.js';
export type { IInstanceReader } from './core/interfaces/i-instance-reader.js';
export type { IClientFactory, ConnectionResult } from './core/interfaces/i-client-factory.js';
export { checkServerStatus, // Check if server is running (non-throwing)
connectToTransport, // Simplified API: discover + connect in one call (RECOMMENDED)
type ServerStatus, // Server status type
type ServerStatusNotRunning, // Server not running status
type ServerStatusRunning, } from './infra/client-factory.js';
export { createTransportClientFactory, // @deprecated Use connectToTransport() instead
TransportClientFactory, // Factory class
type TransportClientFactoryConfig, } from './infra/client-factory.js';
export { FileInstanceDiscovery } from './infra/file-instance-discovery.js';
export { FileInstanceReader } from './infra/file-instance-reader.js';
export { isProcessAlive } from './infra/process-utils.js';
export { type ClientConfigWithLogger, TransportClient, type TransportClientConfig, type TransportClientDependencies, type TransportClientOptions, } from './infra/socket-io-client.js';
export { ConnectionStateManager, type ConnectionStateManagerConfig } from './infra/connection-state-manager.js';
export { type CallbackErrorCallback, EventDispatcher, type EventDispatcherConfig, type HandlerErrorCallback, } from './infra/event-dispatcher.js';
export { ForceReconnectManager, type ForceReconnectManagerConfig, type ReconnectAttemptCallback, type ReconnectErrorCallback, } from './infra/force-reconnect-manager.js';
export { createDefaultReconnectionStrategy, ExponentialBackoffStrategy, type ExponentialBackoffConfig, } from './infra/reconnection-strategy.js';
export { RoomManager, type RoomManagerConfig } from './infra/room-manager.js';
export { createDefaultWakeDetector, TimeBasedWakeDetector, type WakeDetectorConfig } from './infra/wake-detector.js';
//# sourceMappingURL=index.d.ts.map