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
export declare const TaskEventNames: {
    /** Server → Client: Acknowledges task creation with taskId */
    readonly ACK: "task:ack";
    /** Client → Server: Request to cancel a running task */
    readonly CANCEL: "task:cancel";
    /** Server → Client: Task was cancelled */
    readonly CANCELLED: "task:cancelled";
    /** Server → Client: Task completed successfully */
    readonly COMPLETED: "task:completed";
    /** Client → Server: Request to create a new task */
    readonly CREATE: "task:create";
    /** Server → Broadcast: New task was created (for monitoring) */
    readonly CREATED: "task:created";
    /** Server → Client: Task failed with error */
    readonly ERROR: "task:error";
    /** Internal: Transport → Agent to execute task */
    readonly EXECUTE: "task:execute";
    /** Server → Client: Agent started processing the task */
    readonly STARTED: "task:started";
};
export declare const LlmEventNames: {
    /** Streaming content chunk (text or reasoning) */
    readonly CHUNK: "llmservice:chunk";
    /** LLM service error */
    readonly ERROR: "llmservice:error";
    /** Tool output was truncated and saved to file */
    readonly OUTPUT_TRUNCATED: "llmservice:outputTruncated";
    /** Complete LLM response (final output) */
    readonly RESPONSE: "llmservice:response";
    /** Agent is processing (shows thinking indicator) */
    readonly THINKING: "llmservice:thinking";
    /** Thought/description from agent reasoning */
    readonly THOUGHT: "llmservice:thought";
    /** Todo list was updated */
    readonly TODO_UPDATED: "llmservice:todoUpdated";
    /** Agent invokes a tool */
    readonly TOOL_CALL: "llmservice:toolCall";
    /** Tool execution result */
    readonly TOOL_RESULT: "llmservice:toolResult";
    /** Input type not supported */
    readonly UNSUPPORTED_INPUT: "llmservice:unsupportedInput";
    /** Warning from LLM (non-fatal) */
    readonly WARNING: "llmservice:warning";
};
export declare const CipherEventNames: {
    /** Conversation was reset */
    readonly CONVERSATION_RESET: "cipher:conversationReset";
    /** Agent execution started */
    readonly EXECUTION_STARTED: "cipher:executionStarted";
    /** Agent execution terminated (completed/aborted/error) */
    readonly EXECUTION_TERMINATED: "cipher:executionTerminated";
    /** Agent log message */
    readonly LOG: "cipher:log";
    /** Agent state changed */
    readonly STATE_CHANGED: "cipher:stateChanged";
    /** Agent state was reset */
    readonly STATE_RESET: "cipher:stateReset";
    /** UI event (banner, help, prompt, etc.) */
    readonly UI: "cipher:ui";
};
export declare const SessionEventNames: {
    /** Request to create new session */
    readonly CREATE: "session:create";
    /** Request current session info */
    readonly INFO: "session:info";
    /** Request list of all sessions */
    readonly LIST: "session:list";
    /** Request to switch to another session */
    readonly SWITCH: "session:switch";
    /** Broadcast: Session was switched */
    readonly SWITCHED: "session:switched";
};
export declare const AgentEventNames: {
    /** Agent connected to transport */
    readonly CONNECTED: "agent:connected";
    /** Agent disconnected from transport */
    readonly DISCONNECTED: "agent:disconnected";
    /** Request new session (clears conversation) */
    readonly NEW_SESSION: "agent:newSession";
    /** New session created successfully */
    readonly NEW_SESSION_CREATED: "agent:newSessionCreated";
    /** Register agent with transport */
    readonly REGISTER: "agent:register";
    /** Request to restart agent */
    readonly RESTART: "agent:restart";
    /** Agent restarted successfully */
    readonly RESTARTED: "agent:restarted";
    /** Agent is restarting */
    readonly RESTARTING: "agent:restarting";
    /** Agent status changed */
    readonly STATUS_CHANGED: "agent:status:changed";
};
export declare const EventNames: {
    readonly Agent: {
        /** Agent connected to transport */
        readonly CONNECTED: "agent:connected";
        /** Agent disconnected from transport */
        readonly DISCONNECTED: "agent:disconnected";
        /** Request new session (clears conversation) */
        readonly NEW_SESSION: "agent:newSession";
        /** New session created successfully */
        readonly NEW_SESSION_CREATED: "agent:newSessionCreated";
        /** Register agent with transport */
        readonly REGISTER: "agent:register";
        /** Request to restart agent */
        readonly RESTART: "agent:restart";
        /** Agent restarted successfully */
        readonly RESTARTED: "agent:restarted";
        /** Agent is restarting */
        readonly RESTARTING: "agent:restarting";
        /** Agent status changed */
        readonly STATUS_CHANGED: "agent:status:changed";
    };
    readonly Cipher: {
        /** Conversation was reset */
        readonly CONVERSATION_RESET: "cipher:conversationReset";
        /** Agent execution started */
        readonly EXECUTION_STARTED: "cipher:executionStarted";
        /** Agent execution terminated (completed/aborted/error) */
        readonly EXECUTION_TERMINATED: "cipher:executionTerminated";
        /** Agent log message */
        readonly LOG: "cipher:log";
        /** Agent state changed */
        readonly STATE_CHANGED: "cipher:stateChanged";
        /** Agent state was reset */
        readonly STATE_RESET: "cipher:stateReset";
        /** UI event (banner, help, prompt, etc.) */
        readonly UI: "cipher:ui";
    };
    readonly Llm: {
        /** Streaming content chunk (text or reasoning) */
        readonly CHUNK: "llmservice:chunk";
        /** LLM service error */
        readonly ERROR: "llmservice:error";
        /** Tool output was truncated and saved to file */
        readonly OUTPUT_TRUNCATED: "llmservice:outputTruncated";
        /** Complete LLM response (final output) */
        readonly RESPONSE: "llmservice:response";
        /** Agent is processing (shows thinking indicator) */
        readonly THINKING: "llmservice:thinking";
        /** Thought/description from agent reasoning */
        readonly THOUGHT: "llmservice:thought";
        /** Todo list was updated */
        readonly TODO_UPDATED: "llmservice:todoUpdated";
        /** Agent invokes a tool */
        readonly TOOL_CALL: "llmservice:toolCall";
        /** Tool execution result */
        readonly TOOL_RESULT: "llmservice:toolResult";
        /** Input type not supported */
        readonly UNSUPPORTED_INPUT: "llmservice:unsupportedInput";
        /** Warning from LLM (non-fatal) */
        readonly WARNING: "llmservice:warning";
    };
    readonly Session: {
        /** Request to create new session */
        readonly CREATE: "session:create";
        /** Request current session info */
        readonly INFO: "session:info";
        /** Request list of all sessions */
        readonly LIST: "session:list";
        /** Request to switch to another session */
        readonly SWITCH: "session:switch";
        /** Broadcast: Session was switched */
        readonly SWITCHED: "session:switched";
    };
    readonly Task: {
        /** Server → Client: Acknowledges task creation with taskId */
        readonly ACK: "task:ack";
        /** Client → Server: Request to cancel a running task */
        readonly CANCEL: "task:cancel";
        /** Server → Client: Task was cancelled */
        readonly CANCELLED: "task:cancelled";
        /** Server → Client: Task completed successfully */
        readonly COMPLETED: "task:completed";
        /** Client → Server: Request to create a new task */
        readonly CREATE: "task:create";
        /** Server → Broadcast: New task was created (for monitoring) */
        readonly CREATED: "task:created";
        /** Server → Client: Task failed with error */
        readonly ERROR: "task:error";
        /** Internal: Transport → Agent to execute task */
        readonly EXECUTE: "task:execute";
        /** Server → Client: Agent started processing the task */
        readonly STARTED: "task:started";
    };
};
/**
 * All LLM events that should be forwarded to clients.
 * Order: thinking → chunks → response → tool interactions → errors
 */
export declare const LlmEventList: readonly ["llmservice:thinking", "llmservice:chunk", "llmservice:response", "llmservice:toolCall", "llmservice:toolResult", "llmservice:error", "llmservice:unsupportedInput", "llmservice:warning", "llmservice:outputTruncated", "llmservice:thought", "llmservice:todoUpdated"];
/**
 * Task terminal states (no more events after these).
 */
export declare const TaskTerminalStates: readonly ["task:completed", "task:error", "task:cancelled"];
export type TaskEventName = (typeof TaskEventNames)[keyof typeof TaskEventNames];
export type LlmEventName = (typeof LlmEventNames)[keyof typeof LlmEventNames];
export type CipherEventName = (typeof CipherEventNames)[keyof typeof CipherEventNames];
export type SessionEventName = (typeof SessionEventNames)[keyof typeof SessionEventNames];
export type AgentEventName = (typeof AgentEventNames)[keyof typeof AgentEventNames];
/** Union of all event names */
export type TransportEventName = AgentEventName | CipherEventName | LlmEventName | SessionEventName | TaskEventName;
//# sourceMappingURL=event-names.d.ts.map