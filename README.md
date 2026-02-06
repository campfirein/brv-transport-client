# @campfirein/brv-transport-client

Real-time transport client for ByteRover. Connects CLI/TUI/REPL clients to the ByteRover daemon over Socket.IO.

## Installation

```bash
npm install @campfirein/brv-transport-client
```

Requires `.npmrc` configured for GitHub Packages.

## Quick Start

```typescript
import { connectToTransport, checkServerStatus } from '@campfirein/brv-transport-client'

// 1. Check if daemon is running
const status = await checkServerStatus()
if (!status.running) {
  console.log('Daemon not running:', status.reason)
  // Start daemon (your responsibility)
}

// 2. Connect (discovers daemon from global data dir, auto-registers as 'cli')
const { client, projectRoot } = await connectToTransport()

// 3. Listen for events
client.on('llmservice:chunk', (data) => {
  process.stdout.write(data.content)
})

// 4. Send requests
await client.requestWithAck('task:create', {
  taskId: crypto.randomUUID(),
  type: 'query',
  content: 'What files handle authentication?',
})

// 5. Cleanup
await client.disconnect()
```

## API

### Functions

| Function | Description |
|----------|-------------|
| `connectToTransport(fromDir?, options?)` | Discover daemon + connect + register. Returns `{client, projectRoot}` |
| `checkServerStatus(fromDir?, discovery?)` | Check if daemon is running. Non-throwing. Returns `ServerStatus` |

### Client Methods

| Method | Description |
|--------|-------------|
| `client.on(event, handler)` | Subscribe to server events |
| `client.once(event, handler)` | Subscribe once |
| `client.request(event, data)` | Fire-and-forget |
| `client.requestWithAck(event, data, opts?)` | Request-response (returns promise) |
| `client.joinRoom(room)` | Join a broadcast room |
| `client.leaveRoom(room)` | Leave a room |
| `client.disconnect()` | Close connection |

### Connection Options

```typescript
const { client } = await connectToTransport(undefined, {
  // Factory config
  logger: myLogger,
  maxRetries: 5,
  connectTimeoutMs: 10000,

  // Registration (auto-registers by default)
  clientType: 'tui',          // 'cli' | 'tui' | 'agent' | ...
  autoRegister: true,         // set false to skip registration
  projectPath: '/my/project',
  joinRooms: ['broadcast'],   // rooms to join after registration
})
```

### Error Handling

```typescript
import {
  NoInstanceRunningError,
  InstanceCrashedError,
  InstanceStaleError,
  ConnectionFailedError,
} from '@campfirein/brv-transport-client'

try {
  const { client } = await connectToTransport()
} catch (error) {
  if (error instanceof NoInstanceRunningError) {
    // No daemon.json found
  } else if (error instanceof InstanceCrashedError) {
    // Daemon process is dead
  } else if (error instanceof InstanceStaleError) {
    // Heartbeat expired
  } else if (error instanceof ConnectionFailedError) {
    // Socket.IO connection failed after retries
  }
}
```

### Directory & Path Concepts

`connectToTransport(fromDir)` uses several path concepts internally:

- **`fromDir`** — Starting directory (default: `process.cwd()`). Used for two things:
  1. Walk up directory tree to find `.brv/` and determine `projectRoot`
  2. Sent as `cwd` in Socket.IO handshake so the server knows the client's working directory

- **`projectRoot`** — Returned in the result. The directory *containing* `.brv/`, found by walking up from `fromDir`. `undefined` when no `.brv/` exists (e.g. MCP server running globally).

- **`projectPath`** — Set explicitly in `options.projectPath`. Sent to server in `client:register` for room routing and lifecycle management. Independent of `projectRoot`.

```typescript
// CLI in a project directory
const { client, projectRoot } = await connectToTransport('/home/user/my-project/src')
// projectRoot = '/home/user/my-project' (found .brv/ there)

// MCP server (no .brv/ anywhere)
const { client, projectRoot } = await connectToTransport()
// projectRoot = undefined
```

### Event Names

Import typed event name constants:

```typescript
import {
  TaskEventNames,
  LlmEventNames,
  SessionEventNames,
  AgentEventNames,
  CipherEventNames,
  ClientEventNames,
} from '@campfirein/brv-transport-client'
```

## Architecture

3-layer Clean Architecture. See [CLAUDE.md](./CLAUDE.md) for details.

## License

UNLICENSED - Private package for ByteRover ecosystem
