import {expect} from 'chai'
import {
  // Task schemas
  TaskCreateRequestSchema,
  TaskAckSchema,
  TaskCreatedSchema,
  TaskExecuteSchema,
  TaskStartedSchema,
  TaskCompletedSchema,
  TaskErrorSchema,
  TaskCancelRequestSchema,
  TaskCancelResponseSchema,
  TaskCancelledSchema,
  // LLM schemas
  LlmThinkingSchema,
  LlmChunkSchema,
  LlmResponseSchema,
  LlmToolCallSchema,
  LlmToolResultSchema,
  LlmErrorSchema,
  LlmUnsupportedInputSchema,
  LlmWarningSchema,
  LlmOutputTruncatedSchema,
  LlmThoughtSchema,
  LlmTodoUpdatedSchema,
  // Cipher schemas
  CipherExecutionStartedSchema,
  CipherExecutionTerminatedSchema,
  CipherConversationResetSchema,
  CipherStateChangedSchema,
  CipherStateResetSchema,
  CipherLogSchema,
  CipherUISchema,
  // Session schemas
  SessionInfoSchema,
  SessionStatsSchema,
  SessionInfoRequestSchema,
  SessionInfoResponseSchema,
  SessionListRequestSchema,
  SessionListResponseSchema,
  SessionCreateRequestSchema,
  SessionCreateResponseSchema,
  SessionSwitchRequestSchema,
  SessionSwitchResponseSchema,
  SessionSwitchedBroadcastSchema,
  // Agent schemas
  AgentRestartRequestSchema,
  AgentRestartResponseSchema,
  AgentNewSessionRequestSchema,
  AgentNewSessionResponseSchema,
  AgentStatusSchema,
  // Common schemas
  TokenUsageSchema,
  TodoItemSchema,
  TaskErrorDataSchema,
} from '../../../infra/schemas/schemas.js'

describe('Transport Schemas', () => {
  describe('Common Schemas', () => {
    describe('TokenUsageSchema', () => {
      it('should validate valid token usage', () => {
        const valid = {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        }
        const result = TokenUsageSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should reject negative values', () => {
        const invalid = {
          inputTokens: -1,
          outputTokens: 50,
          totalTokens: 49,
        }
        const result = TokenUsageSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })

      it('should reject non-integer values', () => {
        const invalid = {
          inputTokens: 100.5,
          outputTokens: 50,
          totalTokens: 150.5,
        }
        const result = TokenUsageSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })

      it('should reject missing required fields', () => {
        const invalid = {
          inputTokens: 100,
        }
        const result = TokenUsageSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })
    })

    describe('TodoItemSchema', () => {
      it('should validate valid todo item', () => {
        const valid = {
          content: 'Fix bug',
          status: 'pending',
          activeForm: 'Fixing bug',
        }
        const result = TodoItemSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should reject empty content', () => {
        const invalid = {
          content: '',
          status: 'pending',
          activeForm: 'Fixing',
        }
        const result = TodoItemSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })

      it('should reject invalid status', () => {
        const invalid = {
          content: 'Fix bug',
          status: 'invalid_status',
          activeForm: 'Fixing',
        }
        const result = TodoItemSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })

      it('should accept all valid statuses', () => {
        const statuses = ['pending', 'in_progress', 'completed', 'cancelled']
        statuses.forEach((status) => {
          const valid = {
            content: 'Task',
            status,
            activeForm: 'Doing task',
          }
          const result = TodoItemSchema.safeParse(valid)
          expect(result.success).to.be.true
        })
      })
    })

    describe('TaskErrorDataSchema', () => {
      it('should validate minimal error data', () => {
        const valid = {
          name: 'Error',
          message: 'Something went wrong',
        }
        const result = TaskErrorDataSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should validate full error data', () => {
        const valid = {
          name: 'ValidationError',
          message: 'Invalid input',
          code: 'ERR_VALIDATION',
          details: {field: 'email', reason: 'invalid format'},
        }
        const result = TaskErrorDataSchema.safeParse(valid)
        expect(result.success).to.be.true
      })
    })
  })

  describe('Task Event Schemas', () => {
    describe('TaskCreateRequestSchema', () => {
      it('should validate valid task creation request', () => {
        const valid = {
          taskId: '123e4567-e89b-12d3-a456-426614174000',
          type: 'curate',
          content: 'Test content',
        }
        const result = TaskCreateRequestSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should validate with optional files', () => {
        const valid = {
          taskId: '123e4567-e89b-12d3-a456-426614174000',
          type: 'query',
          content: 'Test',
          files: ['file1.ts', 'file2.ts'],
          clientCwd: '/home/user/project',
        }
        const result = TaskCreateRequestSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should reject invalid UUID format', () => {
        const invalid = {
          taskId: 'not-a-uuid',
          type: 'curate',
          content: 'Test',
        }
        const result = TaskCreateRequestSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })

      it('should reject empty content', () => {
        const invalid = {
          taskId: '123e4567-e89b-12d3-a456-426614174000',
          type: 'curate',
          content: '',
        }
        const result = TaskCreateRequestSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })

      it('should reject more than 5 files', () => {
        const invalid = {
          taskId: '123e4567-e89b-12d3-a456-426614174000',
          type: 'curate',
          content: 'Test',
          files: ['1.ts', '2.ts', '3.ts', '4.ts', '5.ts', '6.ts'],
        }
        const result = TaskCreateRequestSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })

      it('should reject invalid task type', () => {
        const invalid = {
          taskId: '123e4567-e89b-12d3-a456-426614174000',
          type: 'invalid_type',
          content: 'Test',
        }
        const result = TaskCreateRequestSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })
    })

    describe('TaskCompletedSchema', () => {
      it('should validate task completion', () => {
        const valid = {
          taskId: 'task-123',
          result: 'Task completed successfully',
        }
        const result = TaskCompletedSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should reject missing result', () => {
        const invalid = {
          taskId: 'task-123',
        }
        const result = TaskCompletedSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })
    })

    describe('TaskErrorSchema', () => {
      it('should validate task error', () => {
        const valid = {
          taskId: 'task-123',
          error: {
            name: 'Error',
            message: 'Failed',
          },
        }
        const result = TaskErrorSchema.safeParse(valid)
        expect(result.success).to.be.true
      })
    })

    describe('TaskCancelResponseSchema', () => {
      it('should validate success response', () => {
        const valid = {
          success: true,
        }
        const result = TaskCancelResponseSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should validate failure response with error', () => {
        const valid = {
          success: false,
          error: 'Task not found',
        }
        const result = TaskCancelResponseSchema.safeParse(valid)
        expect(result.success).to.be.true
      })
    })
  })

  describe('LLM Event Schemas', () => {
    describe('LlmChunkSchema', () => {
      it('should validate text chunk', () => {
        const valid = {
          sessionId: 'session-123',
          type: 'text',
          content: 'Hello world',
        }
        const result = LlmChunkSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should validate reasoning chunk', () => {
        const valid = {
          sessionId: 'session-123',
          taskId: 'task-456',
          type: 'reasoning',
          content: 'Let me think...',
          isComplete: false,
        }
        const result = LlmChunkSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should reject invalid chunk type', () => {
        const invalid = {
          sessionId: 'session-123',
          type: 'invalid',
          content: 'Test',
        }
        const result = LlmChunkSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })
    })

    describe('LlmResponseSchema', () => {
      it('should validate minimal response', () => {
        const valid = {
          sessionId: 'session-123',
          content: 'Response content',
        }
        const result = LlmResponseSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should validate full response', () => {
        const valid = {
          sessionId: 'session-123',
          taskId: 'task-456',
          content: 'Full response',
          reasoning: 'My reasoning',
          model: 'claude-3',
          provider: 'anthropic',
          partial: false,
          tokenUsage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
          },
        }
        const result = LlmResponseSchema.safeParse(valid)
        expect(result.success).to.be.true
      })
    })

    describe('LlmToolCallSchema', () => {
      it('should validate tool call', () => {
        const valid = {
          sessionId: 'session-123',
          toolName: 'ReadFile',
          args: {path: '/test.ts'},
        }
        const result = LlmToolCallSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should validate with call ID', () => {
        const valid = {
          sessionId: 'session-123',
          taskId: 'task-456',
          toolName: 'WriteFile',
          args: {path: '/test.ts', content: 'test'},
          callId: 'call-789',
        }
        const result = LlmToolCallSchema.safeParse(valid)
        expect(result.success).to.be.true
      })
    })

    describe('LlmToolResultSchema', () => {
      it('should validate successful result', () => {
        const valid = {
          sessionId: 'session-123',
          toolName: 'ReadFile',
          success: true,
          result: {content: 'file content'},
        }
        const result = LlmToolResultSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should validate error result', () => {
        const valid = {
          sessionId: 'session-123',
          toolName: 'WriteFile',
          success: false,
          error: 'Permission denied',
          errorType: 'PERMISSION_DENIED',
        }
        const result = LlmToolResultSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should reject invalid error type', () => {
        const invalid = {
          sessionId: 'session-123',
          toolName: 'Tool',
          success: false,
          errorType: 'INVALID_ERROR_TYPE',
        }
        const result = LlmToolResultSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })
    })

    describe('LlmOutputTruncatedSchema', () => {
      it('should validate truncation event', () => {
        const valid = {
          sessionId: 'session-123',
          toolName: 'ReadFile',
          originalLength: 100000,
          savedToFile: '/tmp/output.txt',
        }
        const result = LlmOutputTruncatedSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should reject non-positive originalLength', () => {
        const invalid = {
          sessionId: 'session-123',
          toolName: 'Tool',
          originalLength: 0,
          savedToFile: '/tmp/out.txt',
        }
        const result = LlmOutputTruncatedSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })
    })

    describe('LlmTodoUpdatedSchema', () => {
      it('should validate todo update', () => {
        const valid = {
          sessionId: 'session-123',
          todos: [
            {
              content: 'Fix bug',
              status: 'in_progress',
              activeForm: 'Fixing bug',
            },
            {
              content: 'Write tests',
              status: 'pending',
              activeForm: 'Writing tests',
            },
          ],
        }
        const result = LlmTodoUpdatedSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should validate empty todos array', () => {
        const valid = {
          sessionId: 'session-123',
          todos: [],
        }
        const result = LlmTodoUpdatedSchema.safeParse(valid)
        expect(result.success).to.be.true
      })
    })
  })

  describe('Cipher Agent Schemas', () => {
    describe('CipherExecutionStartedSchema', () => {
      it('should validate execution start', () => {
        const valid = {
          sessionId: 'session-123',
          startTime: new Date(),
          maxIterations: 10,
        }
        const result = CipherExecutionStartedSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should coerce string dates', () => {
        const valid = {
          sessionId: 'session-123',
          startTime: '2026-01-28T00:00:00Z',
          maxIterations: 5,
          maxTimeMs: 30000,
        }
        const result = CipherExecutionStartedSchema.safeParse(valid)
        expect(result.success).to.be.true
        if (result.success) {
          expect(result.data.startTime).to.be.instanceOf(Date)
        }
      })

      it('should reject zero or negative iterations', () => {
        const invalid = {
          sessionId: 'session-123',
          startTime: new Date(),
          maxIterations: 0,
        }
        const result = CipherExecutionStartedSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })
    })

    describe('CipherExecutionTerminatedSchema', () => {
      it('should validate execution termination', () => {
        const valid = {
          sessionId: 'session-123',
          endTime: new Date(),
          reason: 'GOAL',
          turnCount: 5,
          toolCallsExecuted: 10,
          durationMs: 5000,
        }
        const result = CipherExecutionTerminatedSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should accept all valid termination reasons', () => {
        const reasons = ['GOAL', 'MAX_TURNS', 'TIMEOUT', 'ABORTED', 'ERROR', 'PROTOCOL_VIOLATION']
        reasons.forEach((reason) => {
          const valid = {
            sessionId: 'session-123',
            endTime: new Date(),
            reason,
            turnCount: 1,
            toolCallsExecuted: 0,
          }
          const result = CipherExecutionTerminatedSchema.safeParse(valid)
          expect(result.success).to.be.true
        })
      })

      it('should reject invalid termination reason', () => {
        const invalid = {
          sessionId: 'session-123',
          endTime: new Date(),
          reason: 'INVALID_REASON',
          turnCount: 1,
          toolCallsExecuted: 0,
        }
        const result = CipherExecutionTerminatedSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })
    })

    describe('CipherLogSchema', () => {
      it('should validate minimal log', () => {
        const valid = {
          level: 'info',
          message: 'Test log',
        }
        const result = CipherLogSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should validate full log with context', () => {
        const valid = {
          sessionId: 'session-123',
          level: 'error',
          message: 'Error occurred',
          source: 'agent',
          context: {errorCode: 500, details: 'Server error'},
        }
        const result = CipherLogSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should accept all valid log levels', () => {
        const levels = ['debug', 'info', 'warn', 'error']
        levels.forEach((level) => {
          const valid = {
            level,
            message: 'Test',
          }
          const result = CipherLogSchema.safeParse(valid)
          expect(result.success).to.be.true
        })
      })
    })

    describe('CipherUISchema', () => {
      it('should validate UI event', () => {
        const valid = {
          type: 'banner',
          message: 'Welcome!',
        }
        const result = CipherUISchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should accept all valid UI event types', () => {
        const types = ['banner', 'help', 'prompt', 'response', 'separator', 'shutdown']
        types.forEach((type) => {
          const valid = {
            type,
          }
          const result = CipherUISchema.safeParse(valid)
          expect(result.success).to.be.true
        })
      })
    })
  })

  describe('Session Schemas', () => {
    describe('SessionInfoSchema', () => {
      it('should validate session info', () => {
        const valid = {
          id: 'session-123',
          name: 'My Session',
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        }
        const result = SessionInfoSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should validate without name', () => {
        const valid = {
          id: 'session-123',
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        }
        const result = SessionInfoSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should reject non-positive timestamps', () => {
        const invalid = {
          id: 'session-123',
          createdAt: 0,
          lastActiveAt: Date.now(),
        }
        const result = SessionInfoSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })
    })

    describe('SessionStatsSchema', () => {
      it('should validate stats', () => {
        const valid = {
          totalTasks: 10,
          completedTasks: 7,
          failedTasks: 3,
        }
        const result = SessionStatsSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should reject negative values', () => {
        const invalid = {
          totalTasks: 10,
          completedTasks: -1,
          failedTasks: 3,
        }
        const result = SessionStatsSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })
    })

    describe('SessionListResponseSchema', () => {
      it('should validate session list', () => {
        const valid = {
          sessions: [
            {
              id: 'session-1',
              createdAt: Date.now(),
              lastActiveAt: Date.now(),
            },
            {
              id: 'session-2',
              name: 'Test',
              createdAt: Date.now(),
              lastActiveAt: Date.now(),
            },
          ],
        }
        const result = SessionListResponseSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should validate empty list', () => {
        const valid = {
          sessions: [],
        }
        const result = SessionListResponseSchema.safeParse(valid)
        expect(result.success).to.be.true
      })
    })
  })

  describe('Agent Control Schemas', () => {
    describe('AgentStatusSchema', () => {
      it('should validate agent status', () => {
        const valid = {
          isInitialized: true,
          hasAuth: true,
          hasConfig: true,
          activeTasks: 2,
          queuedTasks: 5,
        }
        const result = AgentStatusSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should validate with error', () => {
        const valid = {
          isInitialized: false,
          hasAuth: false,
          hasConfig: false,
          activeTasks: 0,
          queuedTasks: 0,
          lastError: 'Configuration not found',
        }
        const result = AgentStatusSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should reject negative task counts', () => {
        const invalid = {
          isInitialized: true,
          hasAuth: true,
          hasConfig: true,
          activeTasks: -1,
          queuedTasks: 0,
        }
        const result = AgentStatusSchema.safeParse(invalid)
        expect(result.success).to.be.false
      })
    })

    describe('AgentRestartResponseSchema', () => {
      it('should validate success response', () => {
        const valid = {
          success: true,
        }
        const result = AgentRestartResponseSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should validate error response', () => {
        const valid = {
          success: false,
          error: 'Agent is busy',
        }
        const result = AgentRestartResponseSchema.safeParse(valid)
        expect(result.success).to.be.true
      })
    })

    describe('AgentNewSessionResponseSchema', () => {
      it('should validate success with session ID', () => {
        const valid = {
          success: true,
          sessionId: 'session-new-123',
        }
        const result = AgentNewSessionResponseSchema.safeParse(valid)
        expect(result.success).to.be.true
      })

      it('should validate failure', () => {
        const valid = {
          success: false,
          error: 'Cannot create session',
        }
        const result = AgentNewSessionResponseSchema.safeParse(valid)
        expect(result.success).to.be.true
      })
    })
  })

  describe('Security and Edge Cases', () => {
    it('should reject null values for required fields', () => {
      const invalid = {
        taskId: null,
        type: 'curate',
        content: 'Test',
      }
      const result = TaskCreateRequestSchema.safeParse(invalid)
      expect(result.success).to.be.false
    })

    it('should reject undefined values for required fields', () => {
      const invalid = {
        taskId: undefined,
        type: 'curate',
        content: 'Test',
      }
      const result = TaskCreateRequestSchema.safeParse(invalid)
      expect(result.success).to.be.false
    })

    it('should handle extra unknown fields appropriately', () => {
      const withExtra = {
        sessionId: 'session-123',
        content: 'Response',
        unknownField: 'should be ignored',
      }
      const result = LlmResponseSchema.safeParse(withExtra)
      // Zod strips unknown fields by default
      expect(result.success).to.be.true
    })
  })
})
