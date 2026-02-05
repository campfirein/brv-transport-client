/**
 * Transport Event Types
 *
 * TypeScript types inferred from Zod schemas.
 * Single source of truth: schemas.ts → types.ts
 *
 * Usage:
 * ```typescript
 * import type { TaskCreateRequest, LlmChunk, SessionInfo } from '@campfirein/brv-transport-client'
 *
 * const request: TaskCreateRequest = {
 *   taskId: '...',
 *   type: 'query',
 *   content: 'What is the weather?',
 * }
 * ```
 */
import { z } from 'zod';
import { AgentTerminationReasonSchema, ChunkTypeSchema, LogLevelSchema, TaskTypeSchema, TodoStatusSchema, ToolErrorTypeSchema, UIEventTypeSchema, TaskErrorDataSchema, TodoItemSchema, TokenUsageSchema, TaskAckSchema, TaskCancelledSchema, TaskCancelRequestSchema, TaskCancelResponseSchema, TaskCompletedSchema, TaskCreatedSchema, TaskCreateRequestSchema, TaskErrorSchema, TaskExecuteSchema, TaskStartedSchema, LlmChunkSchema, LlmErrorSchema, LlmOutputTruncatedSchema, LlmResponseSchema, LlmThinkingSchema, LlmThoughtSchema, LlmTodoUpdatedSchema, LlmToolCallSchema, LlmToolResultSchema, LlmUnsupportedInputSchema, LlmWarningSchema, CipherConversationResetSchema, CipherExecutionStartedSchema, CipherExecutionTerminatedSchema, CipherLogSchema, CipherStateChangedSchema, CipherStateResetSchema, CipherUISchema, SessionCreateRequestSchema, SessionCreateResponseSchema, SessionInfoRequestSchema, SessionInfoResponseSchema, SessionInfoSchema, SessionListRequestSchema, SessionListResponseSchema, SessionStatsSchema, SessionSwitchedBroadcastSchema, SessionSwitchRequestSchema, SessionSwitchResponseSchema, AgentNewSessionRequestSchema, AgentNewSessionResponseSchema, AgentRestartRequestSchema, AgentRestartResponseSchema, AgentStatusSchema } from './schemas.js';
/** Token usage statistics from LLM */
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
/** Log levels for agent logging */
export type LogLevel = z.infer<typeof LogLevelSchema>;
/** UI event types for terminal output */
export type UIEventType = z.infer<typeof UIEventTypeSchema>;
/** Chunk content types for streaming */
export type ChunkType = z.infer<typeof ChunkTypeSchema>;
/** Task types supported by the system */
export type TaskType = z.infer<typeof TaskTypeSchema>;
/** Todo item status */
export type TodoStatus = z.infer<typeof TodoStatusSchema>;
/** Tool execution error types */
export type ToolErrorType = z.infer<typeof ToolErrorTypeSchema>;
/** Reasons for agent execution termination */
export type AgentTerminationReason = z.infer<typeof AgentTerminationReasonSchema>;
/** Todo item structure */
export type TodoItem = z.infer<typeof TodoItemSchema>;
/** Structured error data */
export type TaskErrorData = z.infer<typeof TaskErrorDataSchema>;
/** task:create - Request to create a new task */
export type TaskCreateRequest = z.infer<typeof TaskCreateRequestSchema>;
/** task:ack - Server acknowledges task creation */
export type TaskAck = z.infer<typeof TaskAckSchema>;
/** task:created - Broadcast when new task is created */
export type TaskCreated = z.infer<typeof TaskCreatedSchema>;
/** task:execute - Internal: Transport → Agent */
export type TaskExecute = z.infer<typeof TaskExecuteSchema>;
/** task:started - Agent began processing */
export type TaskStarted = z.infer<typeof TaskStartedSchema>;
/** task:completed - Task finished successfully */
export type TaskCompleted = z.infer<typeof TaskCompletedSchema>;
/** task:error - Task failed with error */
export type TaskError = z.infer<typeof TaskErrorSchema>;
/** task:cancel - Request to cancel a task */
export type TaskCancelRequest = z.infer<typeof TaskCancelRequestSchema>;
/** task:cancel response */
export type TaskCancelResponse = z.infer<typeof TaskCancelResponseSchema>;
/** task:cancelled - Task was cancelled */
export type TaskCancelled = z.infer<typeof TaskCancelledSchema>;
/** llmservice:thinking - Agent started thinking */
export type LlmThinking = z.infer<typeof LlmThinkingSchema>;
/** llmservice:chunk - Streaming content chunk */
export type LlmChunk = z.infer<typeof LlmChunkSchema>;
/** llmservice:response - Complete LLM response */
export type LlmResponse = z.infer<typeof LlmResponseSchema>;
/** llmservice:toolCall - Agent invokes a tool */
export type LlmToolCall = z.infer<typeof LlmToolCallSchema>;
/** llmservice:toolResult - Tool execution result */
export type LlmToolResult = z.infer<typeof LlmToolResultSchema>;
/** llmservice:error - LLM service error */
export type LlmError = z.infer<typeof LlmErrorSchema>;
/** llmservice:unsupportedInput - Input not supported */
export type LlmUnsupportedInput = z.infer<typeof LlmUnsupportedInputSchema>;
/** llmservice:warning - Non-fatal warning */
export type LlmWarning = z.infer<typeof LlmWarningSchema>;
/** llmservice:outputTruncated - Output was truncated */
export type LlmOutputTruncated = z.infer<typeof LlmOutputTruncatedSchema>;
/** llmservice:thought - Agent reasoning thought */
export type LlmThought = z.infer<typeof LlmThoughtSchema>;
/** llmservice:todoUpdated - Todo list was updated */
export type LlmTodoUpdated = z.infer<typeof LlmTodoUpdatedSchema>;
/** cipher:executionStarted - Agent execution started */
export type CipherExecutionStarted = z.infer<typeof CipherExecutionStartedSchema>;
/** cipher:executionTerminated - Agent execution ended */
export type CipherExecutionTerminated = z.infer<typeof CipherExecutionTerminatedSchema>;
/** cipher:conversationReset - Conversation was reset */
export type CipherConversationReset = z.infer<typeof CipherConversationResetSchema>;
/** cipher:stateChanged - Agent state changed */
export type CipherStateChanged = z.infer<typeof CipherStateChangedSchema>;
/** cipher:stateReset - Agent state was reset */
export type CipherStateReset = z.infer<typeof CipherStateResetSchema>;
/** cipher:log - Agent log message */
export type CipherLog = z.infer<typeof CipherLogSchema>;
/** cipher:ui - UI event */
export type CipherUI = z.infer<typeof CipherUISchema>;
/** Session information structure */
export type SessionInfo = z.infer<typeof SessionInfoSchema>;
/** Session statistics */
export type SessionStats = z.infer<typeof SessionStatsSchema>;
/** session:info request */
export type SessionInfoRequest = z.infer<typeof SessionInfoRequestSchema>;
/** session:info response */
export type SessionInfoResponse = z.infer<typeof SessionInfoResponseSchema>;
/** session:list request */
export type SessionListRequest = z.infer<typeof SessionListRequestSchema>;
/** session:list response */
export type SessionListResponse = z.infer<typeof SessionListResponseSchema>;
/** session:create request */
export type SessionCreateRequest = z.infer<typeof SessionCreateRequestSchema>;
/** session:create response */
export type SessionCreateResponse = z.infer<typeof SessionCreateResponseSchema>;
/** session:switch request */
export type SessionSwitchRequest = z.infer<typeof SessionSwitchRequestSchema>;
/** session:switch response */
export type SessionSwitchResponse = z.infer<typeof SessionSwitchResponseSchema>;
/** session:switched broadcast */
export type SessionSwitchedBroadcast = z.infer<typeof SessionSwitchedBroadcastSchema>;
/** agent:restart request */
export type AgentRestartRequest = z.infer<typeof AgentRestartRequestSchema>;
/** agent:restart response */
export type AgentRestartResponse = z.infer<typeof AgentRestartResponseSchema>;
/** agent:newSession request */
export type AgentNewSessionRequest = z.infer<typeof AgentNewSessionRequestSchema>;
/** agent:newSession response */
export type AgentNewSessionResponse = z.infer<typeof AgentNewSessionResponseSchema>;
/** agent:status payload (health check) */
export type AgentStatus = z.infer<typeof AgentStatusSchema>;
/**
 * Map of task event names to their payload types.
 * Use with typed event handlers.
 */
export type TaskEventPayloadMap = {
    'task:ack': TaskAck;
    'task:cancelled': TaskCancelled;
    'task:completed': TaskCompleted;
    'task:create': TaskCreateRequest;
    'task:created': TaskCreated;
    'task:error': TaskError;
    'task:execute': TaskExecute;
    'task:started': TaskStarted;
};
/**
 * Map of LLM event names to their payload types.
 */
export type LlmEventPayloadMap = {
    'llmservice:chunk': LlmChunk;
    'llmservice:error': LlmError;
    'llmservice:outputTruncated': LlmOutputTruncated;
    'llmservice:response': LlmResponse;
    'llmservice:thinking': LlmThinking;
    'llmservice:thought': LlmThought;
    'llmservice:todoUpdated': LlmTodoUpdated;
    'llmservice:toolCall': LlmToolCall;
    'llmservice:toolResult': LlmToolResult;
    'llmservice:unsupportedInput': LlmUnsupportedInput;
    'llmservice:warning': LlmWarning;
};
/**
 * Map of cipher event names to their payload types.
 */
export type CipherEventPayloadMap = {
    'cipher:conversationReset': CipherConversationReset;
    'cipher:executionStarted': CipherExecutionStarted;
    'cipher:executionTerminated': CipherExecutionTerminated;
    'cipher:log': CipherLog;
    'cipher:stateChanged': CipherStateChanged;
    'cipher:stateReset': CipherStateReset;
    'cipher:ui': CipherUI;
};
/**
 * Map of session event names to their payload types.
 */
export type SessionEventPayloadMap = {
    'session:create': SessionCreateRequest;
    'session:info': SessionInfoRequest;
    'session:list': SessionListRequest;
    'session:switch': SessionSwitchRequest;
    'session:switched': SessionSwitchedBroadcast;
};
/**
 * Map of all transport event names to their payload types.
 */
export type TransportEventPayloadMap = TaskEventPayloadMap & LlmEventPayloadMap & CipherEventPayloadMap & SessionEventPayloadMap;
/**
 * Map of request/response pairs for client.request() calls.
 */
export type RequestResponseMap = {
    'agent:newSession': {
        request: AgentNewSessionRequest;
        response: AgentNewSessionResponse;
    };
    'agent:restart': {
        request: AgentRestartRequest;
        response: AgentRestartResponse;
    };
    'session:create': {
        request: SessionCreateRequest;
        response: SessionCreateResponse;
    };
    'session:info': {
        request: SessionInfoRequest;
        response: SessionInfoResponse;
    };
    'session:list': {
        request: SessionListRequest;
        response: SessionListResponse;
    };
    'session:switch': {
        request: SessionSwitchRequest;
        response: SessionSwitchResponse;
    };
    'task:cancel': {
        request: TaskCancelRequest;
        response: TaskCancelResponse;
    };
    'task:create': {
        request: TaskCreateRequest;
        response: TaskAck;
    };
};
//# sourceMappingURL=types.d.ts.map