/**
 * ByteRover Transport Client
 *
 * A self-contained leaf component for transport client functionality.
 * This component has NO dependencies on other brv modules.
 *
 * @example
 * ```typescript
 * import {
 *   connectToTransport,
 *   NoInstanceRunningError,
 *   ConnectionFailedError
 * } from '@campfirein/brv-transport-client'
 *
 * try {
 *   const { client, projectRoot } = await connectToTransport()
 *   // Use the connected client...
 * } catch (error) {
 *   if (error instanceof NoInstanceRunningError) {
 *     console.log('No instance running')
 *   }
 * }
 * ```
 */

// Constants (for advanced configuration)
export {
  DAEMON_INSTANCE_FILE,
  DAEMON_READY_POLL_INTERVAL_MS,
  DAEMON_READY_TIMEOUT_MS,
  DAEMON_STOP_BUDGET_MS,
  DAEMON_STOP_POLL_INTERVAL_MS,
  GLOBAL_DATA_DIR,
  HEARTBEAT_FILE,
  HEARTBEAT_STALE_THRESHOLD_MS,
  SPAWN_LOCK_FILE,
  SPAWN_LOCK_STALE_THRESHOLD_MS,
  TRANSPORT_CONNECT_TIMEOUT_MS,
  TRANSPORT_DEFAULT_TRANSPORTS,
  TRANSPORT_RECONNECTION_ATTEMPTS,
  TRANSPORT_RECONNECTION_DELAY_MAX_MS,
  TRANSPORT_RECONNECTION_DELAY_MS,
  TRANSPORT_REQUEST_TIMEOUT_MS,
  TRANSPORT_ROOM_TIMEOUT_MS,
} from './constants.js'

export {InstanceInfo, type InstanceInfoJson} from './core/domain/entities/instance-info.js'

// Errors
export {
  ConnectionError,
  ConnectionFailedError,
  ConnectionTimeoutError,
  DaemonSpawnError,
  InstanceCrashedError,
  InstanceStaleError,
  InvalidInstanceDataError,
  NoInstanceRunningError,
} from './core/domain/errors/connection-error.js'
export {
  ConcurrentConnectionError,
  InvalidEventNameError,
  InvalidOperationError,
  InvalidResponseError,
  InvalidRoomNameError,
  InvalidStateTransitionError,
  InvalidTimeoutError,
  InvalidTransportUrlError,
  MaxPendingOnceHandlersExceededError,
  TransportConnectionError,
  TransportError,
  TransportNotConnectedError,
  TransportRequestError,
  TransportRequestTimeoutError,
  TransportRoomError,
  TransportRoomTimeoutError,
} from './core/domain/errors/transport-error.js'

// Validators
export {validateEventName, validateRoomName} from './core/domain/validators/index.js'

// ============================================================================
// Events Module - Event names (domain layer, pure TypeScript)
// ============================================================================
export {
  // Event name constants
  AgentEventNames,
  CipherEventNames,
  ClientEventNames,
  EventNames,
  LlmEventList,
  LlmEventNames,
  SessionEventNames,
  TaskEventNames,
  TaskTerminalStates,
  // Event name types
  type AgentEventName,
  type CipherEventName,
  type ClientEventName,
  type LlmEventName,
  type SessionEventName,
  type TaskEventName,
  type TransportEventName,
} from './core/domain/events/index.js'

// ============================================================================
// Schemas Module - Zod schemas and derived types (infra layer)
// ============================================================================
export {
  // Zod schemas (for runtime validation)
  AgentNewSessionRequestSchema,
  AgentNewSessionResponseSchema,
  AgentRestartRequestSchema,
  AgentRestartResponseSchema,
  AgentStatusSchema,
  AgentTerminationReasonSchema,
  ChunkTypeSchema,
  CipherConversationResetSchema,
  CipherExecutionStartedSchema,
  CipherExecutionTerminatedSchema,
  CipherLogSchema,
  CipherStateChangedSchema,
  CipherStateResetSchema,
  CipherUISchema,
  ClientRegisterRequestSchema,
  ClientRegisterResponseSchema,
  ClientTypeSchema,
  DaemonInstanceSchema,
  LlmChunkSchema,
  LlmErrorSchema,
  LlmOutputTruncatedSchema,
  LlmResponseSchema,
  LlmThinkingSchema,
  LlmThoughtSchema,
  LlmTodoUpdatedSchema,
  LlmToolCallSchema,
  LlmToolResultSchema,
  LlmUnsupportedInputSchema,
  LlmWarningSchema,
  LogLevelSchema,
  SessionCreateRequestSchema,
  SessionCreateResponseSchema,
  SessionInfoRequestSchema,
  SessionInfoResponseSchema,
  SessionInfoSchema,
  SessionListRequestSchema,
  SessionListResponseSchema,
  SessionStatsSchema,
  SessionSwitchedBroadcastSchema,
  SessionSwitchRequestSchema,
  SessionSwitchResponseSchema,
  TaskAckSchema,
  TaskCancelledSchema,
  TaskCancelRequestSchema,
  TaskCancelResponseSchema,
  TaskCompletedSchema,
  TaskCreatedSchema,
  TaskCreateRequestSchema,
  TaskErrorDataSchema,
  TaskErrorSchema,
  TaskExecuteSchema,
  TaskStartedSchema,
  TaskTypeSchema,
  TodoItemSchema,
  TodoStatusSchema,
  TokenUsageSchema,
  ToolErrorTypeSchema,
  UIEventTypeSchema,
} from './infra/schemas/index.js'
// Event type exports (inferred from Zod schemas)
export type {
  // Agent event types
  AgentNewSessionRequest,
  AgentNewSessionResponse,
  AgentRestartRequest,
  AgentRestartResponse,
  AgentStatus,
  // Enum types
  AgentTerminationReason,
  ChunkType,
  // Cipher event types
  CipherConversationReset,
  CipherEventPayloadMap,
  CipherExecutionStarted,
  CipherExecutionTerminated,
  CipherLog,
  CipherStateChanged,
  CipherStateReset,
  CipherUI,
  // Client registration types
  ClientRegisterRequest,
  ClientRegisterResponse,
  // Daemon types
  DaemonInstance,
  // LLM event types
  LlmChunk,
  LlmError,
  LlmEventPayloadMap,
  LlmOutputTruncated,
  LlmResponse,
  LlmThinking,
  LlmThought,
  LlmTodoUpdated,
  LlmToolCall,
  LlmToolResult,
  LlmUnsupportedInput,
  LlmWarning,
  LogLevel,
  RequestResponseMap,
  // Session event types
  SessionCreateRequest,
  SessionCreateResponse,
  SessionEventPayloadMap,
  SessionInfo,
  SessionInfoRequest,
  SessionInfoResponse,
  SessionListRequest,
  SessionListResponse,
  SessionStats,
  SessionSwitchedBroadcast,
  SessionSwitchRequest,
  SessionSwitchResponse,
  // Task event types
  TaskAck,
  TaskCancelled,
  TaskCancelRequest,
  TaskCancelResponse,
  TaskCompleted,
  TaskCreated,
  TaskCreateRequest,
  TaskError,
  // Shared structure types
  TaskErrorData,
  TaskEventPayloadMap,
  TaskExecute,
  TaskStarted,
  TaskType,
  TodoItem,
  TodoStatus,
  TokenUsage,
  ToolErrorType,
  TransportEventPayloadMap,
  UIEventType,
} from './infra/schemas/index.js'
// Domain types
export type {ClientConfig, ClientType, SocketTransport} from './core/domain/types.js'

export type {IClientLogger} from './core/interfaces/i-client-logger.js'
export {NoOpClientLogger} from './infra/no-op-client-logger.js'

// Core interfaces - Main client
export type {
  ConnectionState,
  ConnectionStateHandler,
  EventHandler,
  ITransportClient,
  RequestOptions,
} from './core/interfaces/i-client.js'

// Core interfaces - Component interfaces (ISP)
export type {IConnectionStateManager, IConnectionStateReader} from './core/interfaces/i-connection-state.js'
export type {IEventDispatcher} from './core/interfaces/i-event-dispatcher.js'
export type {IForceReconnectManager} from './core/interfaces/i-force-reconnect-manager.js'
export type {IReconnectionStrategy} from './core/interfaces/i-reconnection-strategy.js'
export type {IRoomManager} from './core/interfaces/i-room-manager.js'
// Note: ISocketProvider is intentionally NOT exported - it's internal-only
export type {IWakeDetector, WakeHandler} from './core/interfaces/i-wake-detector.js'

// Core interfaces - Discovery
export type {DiscoveryResult, IInstanceDiscovery} from './core/interfaces/i-instance-discovery.js'

// Core interfaces - Instance management
export type {
  DaemonAcquireResult,
  DaemonInstanceInfo,
  IGlobalInstanceManager,
} from './core/interfaces/i-instance-manager.js'

// Core interfaces - Spawn lock
export type {ISpawnLock, SpawnLockAcquireResult} from './core/interfaces/i-spawn-lock.js'

// Core interfaces - Factory
export type {IClientFactory, ConnectionResult} from './core/interfaces/i-client-factory.js'
export type {
  ConnectOptions,
  RegistrationOptions,
  TransportClientFactoryConfig,
} from './core/interfaces/i-client-factory-config.js'

// Connection management (public API)
export {
  checkServerStatus, // Check if server is running (non-throwing)
  connectToTransport, // Simplified API: discover + connect in one call (RECOMMENDED)
  type ServerStatus, // Server status type
  type ServerStatusNotRunning, // Server not running status
  type ServerStatusRunning, // Server running status
} from './infra/client-factory.js'

// Factory (for advanced configuration / custom discovery)
export {TransportClientFactory} from './infra/client-factory.js'

// Daemon lifecycle - PRIMARY API
export {connectToDaemon, type ConnectToDaemonDeps, type ConnectToDaemonOptions} from './infra/daemon-connector.js'

// Daemon lifecycle - Auto-reconnection
export {
  createDaemonReconnector,
  type DaemonReconnectorDeps,
  type DaemonReconnectorHandle,
  type DaemonReconnectorOptions,
} from './infra/daemon-reconnector.js'

// Daemon lifecycle - Spawner
export {ensureDaemonRunning, type EnsureDaemonResult} from './infra/daemon-spawner.js'

// Daemon lifecycle - Sync discovery (health check)
export {discoverDaemon, type DaemonStatus} from './infra/daemon-discovery-sync.js'

// Daemon lifecycle - Health check
export {checkDaemonHealth, type DaemonHealthResult} from './infra/daemon-health.js'

// Daemon lifecycle - Infrastructure
export {GlobalInstanceManager} from './infra/global-instance-manager.js'
export {isHeartbeatStale} from './infra/heartbeat-utils.js'
export {resolveServerPath} from './infra/resolve-server-path.js'
export {SpawnLock} from './infra/spawn-lock.js'

// Discovery implementations
export {DaemonInstanceDiscovery} from './infra/daemon-instance-discovery.js'
export {findProjectRoot} from './infra/find-project-root.js'
export {getGlobalDataDir} from './infra/global-data-path.js'

// Utilities
export {isProcessAlive} from './infra/process-utils.js'
export {waitForConnectedClient} from './infra/wait-for-connected-client.js'

// Infrastructure implementations - Main client
export {
  TransportClient,
  type TransportClientConfig,
  type TransportClientDependencies,
  type TransportClientOptions,
} from './infra/socket-io-client.js'

// Infrastructure implementations - Component implementations (SRP)
export {ConnectionStateManager, type ConnectionStateManagerConfig} from './infra/connection-state-manager.js'
export {
  type CallbackErrorCallback,
  EventDispatcher,
  type EventDispatcherConfig,
  type HandlerErrorCallback,
} from './infra/event-dispatcher.js'
export {
  ForceReconnectManager,
  type ForceReconnectManagerConfig,
  type ReconnectAttemptCallback,
  type ReconnectErrorCallback,
} from './infra/force-reconnect-manager.js'
export {
  createDefaultReconnectionStrategy,
  ExponentialBackoffStrategy,
  type ExponentialBackoffConfig,
} from './infra/reconnection-strategy.js'
export {RoomManager, type RoomManagerConfig} from './infra/room-manager.js'
export {createDefaultWakeDetector, TimeBasedWakeDetector, type WakeDetectorConfig} from './infra/wake-detector.js'
