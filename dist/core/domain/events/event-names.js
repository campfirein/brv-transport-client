/**
 * Transport Event Names
 *
 * Centralized constants for all Socket.IO event names used in the transport layer.
 * Using constants ensures type-safety, autocomplete, and prevents typos.
 *
 * Event naming conventions:
 * - `task:*` - Task lifecycle events (create, execute, complete, error)
 * - `llmservice:*` - LLM streaming events (chunks, responses, tool calls)
 * - `cipher:*` - Agent execution events (started, terminated, state changes)
 * - `session:*` - Session management events
 * - `agent:*` - Agent lifecycle/control events
 */
// ============================================================================
// Task Events (task:*)
//
// Task lifecycle from creation to completion/error.
// Flow: create → ack → started → [llm events] → completed/error/cancelled
// ============================================================================
export const TaskEventNames = {
    /** Server → Client: Acknowledges task creation with taskId */
    ACK: 'task:ack',
    /** Client → Server: Request to cancel a running task */
    CANCEL: 'task:cancel',
    /** Server → Client: Task was cancelled */
    CANCELLED: 'task:cancelled',
    /** Server → Client: Task completed successfully */
    COMPLETED: 'task:completed',
    /** Client → Server: Request to create a new task */
    CREATE: 'task:create',
    /** Server → Broadcast: New task was created (for monitoring) */
    CREATED: 'task:created',
    /** Server → Client: Task failed with error */
    ERROR: 'task:error',
    /** Internal: Transport → Agent to execute task */
    EXECUTE: 'task:execute',
    /** Server → Client: Agent started processing the task */
    STARTED: 'task:started',
};
// ============================================================================
// LLM Service Events (llmservice:*)
//
// Events from LLM during task processing.
// Forwarded from Agent with original names for consistency.
// ============================================================================
export const LlmEventNames = {
    /** Streaming content chunk (text or reasoning) */
    CHUNK: 'llmservice:chunk',
    /** LLM service error */
    ERROR: 'llmservice:error',
    /** Tool output was truncated and saved to file */
    OUTPUT_TRUNCATED: 'llmservice:outputTruncated',
    /** Complete LLM response (final output) */
    RESPONSE: 'llmservice:response',
    /** Agent is processing (shows thinking indicator) */
    THINKING: 'llmservice:thinking',
    /** Thought/description from agent reasoning */
    THOUGHT: 'llmservice:thought',
    /** Todo list was updated */
    TODO_UPDATED: 'llmservice:todoUpdated',
    /** Agent invokes a tool */
    TOOL_CALL: 'llmservice:toolCall',
    /** Tool execution result */
    TOOL_RESULT: 'llmservice:toolResult',
    /** Input type not supported */
    UNSUPPORTED_INPUT: 'llmservice:unsupportedInput',
    /** Warning from LLM (non-fatal) */
    WARNING: 'llmservice:warning',
};
// ============================================================================
// Cipher Agent Events (cipher:*)
//
// Agent execution lifecycle and state management.
// ============================================================================
export const CipherEventNames = {
    /** Conversation was reset */
    CONVERSATION_RESET: 'cipher:conversationReset',
    /** Agent execution started */
    EXECUTION_STARTED: 'cipher:executionStarted',
    /** Agent execution terminated (completed/aborted/error) */
    EXECUTION_TERMINATED: 'cipher:executionTerminated',
    /** Agent log message */
    LOG: 'cipher:log',
    /** Agent state changed */
    STATE_CHANGED: 'cipher:stateChanged',
    /** Agent state was reset */
    STATE_RESET: 'cipher:stateReset',
    /** UI event (banner, help, prompt, etc.) */
    UI: 'cipher:ui',
};
// ============================================================================
// Session Events (session:*)
//
// Session management for multi-conversation support.
// ============================================================================
export const SessionEventNames = {
    /** Request to create new session */
    CREATE: 'session:create',
    /** Request current session info */
    INFO: 'session:info',
    /** Request list of all sessions */
    LIST: 'session:list',
    /** Request to switch to another session */
    SWITCH: 'session:switch',
    /** Broadcast: Session was switched */
    SWITCHED: 'session:switched',
};
// ============================================================================
// Agent Control Events (agent:*)
//
// Agent lifecycle and control commands.
// ============================================================================
export const AgentEventNames = {
    /** Agent connected to transport */
    CONNECTED: 'agent:connected',
    /** Agent disconnected from transport */
    DISCONNECTED: 'agent:disconnected',
    /** Request new session (clears conversation) */
    NEW_SESSION: 'agent:newSession',
    /** New session created successfully */
    NEW_SESSION_CREATED: 'agent:newSessionCreated',
    /** Register agent with transport */
    REGISTER: 'agent:register',
    /** Request to restart agent */
    RESTART: 'agent:restart',
    /** Agent restarted successfully */
    RESTARTED: 'agent:restarted',
    /** Agent is restarting */
    RESTARTING: 'agent:restarting',
    /** Agent status changed */
    STATUS_CHANGED: 'agent:status:changed',
};
// ============================================================================
// Aggregated Event Names
//
// Convenience object containing all event names.
// ============================================================================
export const EventNames = {
    Agent: AgentEventNames,
    Cipher: CipherEventNames,
    Llm: LlmEventNames,
    Session: SessionEventNames,
    Task: TaskEventNames,
};
// ============================================================================
// Event Lists (for iteration)
//
// Explicit arrays for iterating over events.
// Avoids Object.values() for better readability and type inference.
// ============================================================================
/**
 * All LLM events that should be forwarded to clients.
 * Order: thinking → chunks → response → tool interactions → errors
 */
export const LlmEventList = [
    LlmEventNames.THINKING,
    LlmEventNames.CHUNK,
    LlmEventNames.RESPONSE,
    LlmEventNames.TOOL_CALL,
    LlmEventNames.TOOL_RESULT,
    LlmEventNames.ERROR,
    LlmEventNames.UNSUPPORTED_INPUT,
    LlmEventNames.WARNING,
    LlmEventNames.OUTPUT_TRUNCATED,
    LlmEventNames.THOUGHT,
    LlmEventNames.TODO_UPDATED,
];
/**
 * Task terminal states (no more events after these).
 */
export const TaskTerminalStates = [TaskEventNames.COMPLETED, TaskEventNames.ERROR, TaskEventNames.CANCELLED];
//# sourceMappingURL=event-names.js.map