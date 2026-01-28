# @campfirein/brv-transport-client

Real-time transport client for ByteRover - connects UI/REPL/CLI clients to ByteRover Core server.

## Installation

```bash
npm install @campfirein/brv-transport-client
```

**Note:** Requires `.npmrc` configured for GitHub Packages authentication.

## Integration Checklist

How to integrate with your CLI/TUI/REPL application:

**1. Check if ByteRover server is running:**
```typescript
import { checkServerStatus } from '@campfirein/brv-transport-client'

const status = await checkServerStatus()
if (!status.running) {
  console.log('Server not running:', status.reason)
}
```

**2. Start server if needed (your responsibility):**
```typescript
if (!status.running) {
  await startByteRoverServer() // Your server start logic
}
```

**3. Connect to transport server:**
```typescript
import { connectToTransport } from '@campfirein/brv-transport-client'

const {client, projectRoot} = await connectToTransport()
// Auto-discovers .brv directory by walking up from current directory
```

**4. Listen for events:**
```typescript
client.on('llmservice:chunk', (data) => {
  process.stdout.write(data.content) // Stream LLM output
})

client.on('task:completed', (data) => {
  console.log('Task completed:', data.result)
})
```

**5. Send tasks:**
```typescript
await client.request('task:create', {
  taskId: crypto.randomUUID(),
  type: 'query',
  content: 'What files handle authentication?'
})
```

**6. Cleanup when done:**
```typescript
await client.disconnect()
```

## Quick Start

```typescript
import { connectToTransport } from '@campfirein/brv-transport-client'

// Connect to ByteRover Core (auto-discovers .brv directory)
const {client, projectRoot} = await connectToTransport()

// Listen for LLM streaming
client.on('llmservice:chunk', (data) => {
  process.stdout.write(data.content)
})

// Send task request
await client.request('task:create', {
  taskId: crypto.randomUUID(),
  type: 'query',
  content: 'Explain the authentication flow'
})

// Cleanup when done
await client.disconnect()
```

## Integration Patterns

### Pattern 1: CLI Command (Short-Lived)

For one-off commands that connect, execute, and exit:

```typescript
export class QueryUseCase {
  async execute(query: string) {
    const {client} = await connectToTransport()

    try {
      // Send query as task
      await client.request('task:create', {
        taskId: crypto.randomUUID(),
        type: 'query',
        content: query
      })

      // Wait for completion
      return new Promise((resolve, reject) => {
        client.on('task:completed', (data) => resolve(data.result))
        client.on('task:error', (data) => reject(data.error))
      })
    } finally {
      await client.disconnect()
    }
  }
}
```

### Pattern 2: TUI Integration (Long-Running)

For Terminal UI applications that maintain connection:

```typescript
class TransportClientHelper {
  #client?: ITransportClient

  async connect() {
    const {client} = await connectToTransport()
    this.#client = client
    this.registerEventHandlers()
  }

  private registerEventHandlers() {
    this.#client!.on('llmservice:chunk', (data) => {
      // Stream to TUI display
      this.ui.appendChunk(data.content)
    })

    this.#client!.on('task:completed', (data) => {
      this.ui.showCompletion(data.result)
    })

    this.#client!.on('task:error', (data) => {
      this.ui.showError(data.error)
    })
  }

  async disconnect() {
    await this.#client?.disconnect()
  }
}
```

### Pattern 3: React Integration

For web UI applications:

```typescript
const TransportContext = createContext<ITransportClient | null>(null)

export const TransportProvider = ({children}) => {
  const [client, setClient] = useState<ITransportClient | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    connectToTransport()
      .then(({client}) => setClient(client))
      .catch(setError)

    return () => {
      client?.disconnect()
    }
  }, [])

  return (
    <TransportContext.Provider value={client}>
      {error ? <ErrorDisplay error={error} /> : children}
    </TransportContext.Provider>
  )
}
```

## API Reference

### Core Functions

| Function | Description | Example |
|----------|-------------|---------|
| `connectToTransport(fromDir?, config?)` | Connect to server (auto-discovery) | `const {client} = await connectToTransport()` |
| `checkServerStatus(fromDir?)` | Check if server is running (non-throwing) | `const status = await checkServerStatus()` |

**Return types:**
- `connectToTransport()` → `{client: ITransportClient, projectRoot: string}`
- `checkServerStatus()` → `{running: true, instanceInfo: InstanceInfo} | {running: false, reason: string}`

### Client Methods

| Method | Description | Example |
|--------|-------------|---------|
| `client.on(event, handler)` | Listen for server events | `client.on('llmservice:chunk', handler)` |
| `client.once(event, handler)` | Listen for event (one-time) | `client.once('task:completed', handler)` |
| `client.request(event, data, opts?)` | Send request, wait for response | `await client.request('task:create', data)` |
| `client.emit(event, data)` | Send fire-and-forget event | `client.emit('custom:event', data)` |
| `client.disconnect()` | Close connection & cleanup | `await client.disconnect()` |

### When to use `on()` vs `request()`?

- **Use `client.on()`** for server broadcasts (LLM chunks, task status updates)
- **Use `client.request()`** for request-response (task creation, session switching)

## Common Events for CLI Integration

### Task Lifecycle Events

| Event | Type | When to Use |
|-------|------|-------------|
| `task:create` | Request | Send query/task to ByteRover server |
| `task:started` | Broadcast | Task execution began (optional: show loading) |
| `task:completed` | Broadcast | Task finished successfully |
| `task:error` | Broadcast | Task failed with error |

**Example:**
```typescript
// Send task
await client.request('task:create', {
  taskId: crypto.randomUUID(),
  type: 'query',
  content: 'Explain authentication flow'
})

// Listen for completion
client.on('task:completed', (data) => {
  console.log('Result:', data.result)
})

client.on('task:error', (data) => {
  console.error('Error:', data.error)
})
```

### LLM Streaming Events

| Event | When to Use |
|-------|-------------|
| `llmservice:chunk` | Stream LLM output to console/UI in real-time |
| `llmservice:toolCall` | Show tool execution (e.g., "Reading file...") |
| `llmservice:response` | Get final response with token usage |

**Example:**
```typescript
// Stream LLM output to console
client.on('llmservice:chunk', (data) => {
  process.stdout.write(data.content)
})

// Show tool execution
client.on('llmservice:toolCall', (data) => {
  console.log(`\n[Tool: ${data.toolName}]`)
})

// Final response
client.on('llmservice:response', (data) => {
  console.log(`\nTokens used: ${data.tokenUsage.total}`)
})
```

### Session Events

| Event | Type | When to Use |
|-------|------|-------------|
| `session:info` | Request | Get current session details |
| `session:switch` | Request | Switch to different session |
| `session:switched` | Broadcast | Session changed (update UI) |

**Full event reference:** Import `TaskEventNames`, `LlmEventNames`, `SessionEventNames`, `AgentEventNames`, `CipherEventNames` from the package.

## Error Handling

Handle connection errors specific to CLI integration:

```typescript
import {
  checkServerStatus,
  connectToTransport,
  NoInstanceRunningError,
  InstanceCrashedError,
  ConnectionFailedError,
  ConnectionTimeoutError
} from '@campfirein/brv-transport-client'

async function connectSafely() {
  // Step 1: Check server status first
  const status = await checkServerStatus()

  if (!status.running) {
    console.log('ByteRover server not running. Starting...')
    await startByteRoverServer() // Your server start logic
  }

  // Step 2: Connect with error handling
  try {
    const {client, projectRoot} = await connectToTransport()
    return {client, projectRoot}
  } catch (error) {
    if (error instanceof NoInstanceRunningError) {
      console.error('No ByteRover instance found. Run: brv')
      process.exit(1)
    } else if (error instanceof InstanceCrashedError) {
      console.error(`Instance crashed (PID ${error.pid}). Restart server.`)
      process.exit(1)
    } else if (error instanceof ConnectionFailedError) {
      console.error('Connection failed:', error.message)
      process.exit(1)
    } else if (error instanceof ConnectionTimeoutError) {
      console.error('Connection timeout. Server may be unresponsive.')
      process.exit(1)
    }
    throw error
  }
}
```

**Built-in Resilience:**
- Automatic reconnection with exponential backoff (5s, 10s, 20s, 30s, 60s)
- Auto-rejoin rooms after reconnect
- Max 30 connection attempts (configurable)

## Configuration

### Custom Directory

```typescript
// Start discovery from specific directory
const {client} = await connectToTransport('/path/to/project')
```

### Custom Logger

```typescript
import { type IClientLogger } from '@campfirein/brv-transport-client'

const logger: IClientLogger = {
  debug: (msg) => console.debug('[Transport]', msg),
  info: (msg) => console.info('[Transport]', msg),
  warn: (msg) => console.warn('[Transport]', msg),
  error: (msg) => console.error('[Transport]', msg)
}

const {client} = await connectToTransport(undefined, {
  logger,
  maxRetries: 10 // Override default discovery retries
})
```

### Custom Request Timeout

```typescript
// Per-request timeout override
await client.request('task:create', data, {
  timeout: 30000 // 30 seconds (default: 10s)
})
```

## Typical Integration Flow

The recommended workflow for CLI/TUI/REPL clients:

```typescript
import {
  checkServerStatus,
  connectToTransport,
  NoInstanceRunningError
} from '@campfirein/brv-transport-client'

async function main() {
  // Step 1: Check if server is running
  const status = await checkServerStatus()

  // Step 2: Start server if needed (your responsibility)
  if (!status.running) {
    console.log('Starting ByteRover server...')
    await startByteRoverServer() // Your server start logic
  }

  // Step 3: Connect (auto walk-up to find .brv directory)
  const {client, projectRoot} = await connectToTransport()
  console.log('Connected to:', projectRoot)

  // Step 4: Use the client
  // ... your application logic ...

  // Step 5: Cleanup
  await client.disconnect()
}
```

## Resources

- **[CLAUDE.md](./CLAUDE.md)** - Full architecture documentation & design patterns
- **[TESTING.md](./TESTING.md)** - Testing strategy and patterns
- **[Socket.IO Docs](https://socket.io/docs/v4/)** - Underlying transport layer

## License

UNLICENSED - Private package for ByteRover ecosystem
