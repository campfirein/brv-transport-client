/**
 * Transport Schemas Module (Infrastructure Layer)
 *
 * Contains Zod validation schemas and TypeScript types for Socket.IO transport payloads.
 * Located in the infrastructure layer because:
 * 1. Zod is an external validation library (infrastructure concern)
 * 2. Runtime validation is an infrastructure responsibility
 *
 * Types derived from schemas (via z.infer) are co-located for maintainability
 * as they form a "single source of truth" pattern.
 */

// Zod schemas (for runtime validation)
export {
  // Enums and base types
  AgentTerminationReasonSchema,
  ChunkTypeSchema,
  LogLevelSchema,
  TaskTypeSchema,
  TodoStatusSchema,
  ToolErrorTypeSchema,
  UIEventTypeSchema,
  // Shared structures
  TaskErrorDataSchema,
  TodoItemSchema,
  TokenUsageSchema,
  // Task event schemas
  TaskAckSchema,
  TaskCancelledSchema,
  TaskCancelRequestSchema,
  TaskCancelResponseSchema,
  TaskCompletedSchema,
  TaskCreatedSchema,
  TaskCreateRequestSchema,
  TaskErrorSchema,
  TaskExecuteSchema,
  TaskStartedSchema,
  // LLM event schemas
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
  // Cipher event schemas
  CipherConversationResetSchema,
  CipherExecutionStartedSchema,
  CipherExecutionTerminatedSchema,
  CipherLogSchema,
  CipherStateChangedSchema,
  CipherStateResetSchema,
  CipherUISchema,
  // Session event schemas
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
  // Agent event schemas
  AgentNewSessionRequestSchema,
  AgentNewSessionResponseSchema,
  AgentRestartRequestSchema,
  AgentRestartResponseSchema,
  AgentStatusSchema,
} from './schemas.js'

// TypeScript types (inferred from schemas)
export type {
  // Enum types
  AgentTerminationReason,
  ChunkType,
  LogLevel,
  TaskType,
  TodoStatus,
  ToolErrorType,
  UIEventType,
  // Shared structure types
  TaskErrorData,
  TodoItem,
  TokenUsage,
  // Task event types
  TaskAck,
  TaskCancelled,
  TaskCancelRequest,
  TaskCancelResponse,
  TaskCompleted,
  TaskCreated,
  TaskCreateRequest,
  TaskError,
  TaskExecute,
  TaskStarted,
  // LLM event types
  LlmChunk,
  LlmError,
  LlmOutputTruncated,
  LlmResponse,
  LlmThinking,
  LlmThought,
  LlmTodoUpdated,
  LlmToolCall,
  LlmToolResult,
  LlmUnsupportedInput,
  LlmWarning,
  // Cipher event types
  CipherConversationReset,
  CipherExecutionStarted,
  CipherExecutionTerminated,
  CipherLog,
  CipherStateChanged,
  CipherStateReset,
  CipherUI,
  // Session event types
  SessionCreateRequest,
  SessionCreateResponse,
  SessionInfo,
  SessionInfoRequest,
  SessionInfoResponse,
  SessionListRequest,
  SessionListResponse,
  SessionStats,
  SessionSwitchedBroadcast,
  SessionSwitchRequest,
  SessionSwitchResponse,
  // Agent event types
  AgentNewSessionRequest,
  AgentNewSessionResponse,
  AgentRestartRequest,
  AgentRestartResponse,
  AgentStatus,
  // Event maps (for typed handlers)
  CipherEventPayloadMap,
  LlmEventPayloadMap,
  RequestResponseMap,
  SessionEventPayloadMap,
  TaskEventPayloadMap,
  TransportEventPayloadMap,
} from './types.js'
