# Integration Tests

This directory contains integration tests for the Transport Client. Unlike unit tests, these tests require a running Socket.IO server and test the full end-to-end functionality.

## Prerequisites

To run integration tests, you need:

1. A Socket.IO server running on port 9847 (or custom port via `TEST_SERVER_URL`)
2. The server should support:
   - Basic connection/disconnection
   - Event echo/broadcast
   - Room join/leave operations
   - Request/response pattern

## Running Integration Tests

### Set up test server

```bash
# Example using Socket.IO (Node.js)
# Create a file test-server.js:

const { Server } = require('socket.io')
const server = new Server(9847, {
  cors: { origin: '*' }
})

server.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  // Echo events back
  socket.onAny((event, ...args) => {
    socket.emit(event, ...args)
  })

  // Room management
  socket.on('room:join', (room, callback) => {
    socket.join(room)
    callback({ success: true })
  })

  socket.on('room:leave', (room, callback) => {
    socket.leave(room)
    callback({ success: true })
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

console.log('Test server running on port 9847')
```

### Run tests

```bash
# Run integration tests with environment variable
TEST_INTEGRATION=1 npm test test/integration/

# Or with custom server URL
TEST_INTEGRATION=1 TEST_SERVER_URL=http://localhost:3000 npm test test/integration/
```

## Test Coverage

The integration tests cover:

- **Connection Lifecycle**: Connect, disconnect, reconnect
- **Event Handling**: Register handlers, receive events, unsubscribe
- **Request/Response**: Send requests with acknowledgments
- **Room Management**: Join/leave rooms, receive room-targeted events
- **State Management**: Track connection state changes
- **Error Handling**: Invalid URLs, connection failures, operations when disconnected

## Continuous Integration

Integration tests are **skipped by default** in CI environments because they require a running server. To run them in CI:

1. Set up a test server in your CI pipeline
2. Set `TEST_INTEGRATION=1` environment variable
3. Ensure the server is running before tests execute

Example GitHub Actions workflow:

```yaml
- name: Start test server
  run: node test-server.js &

- name: Wait for server
  run: sleep 2

- name: Run integration tests
  run: TEST_INTEGRATION=1 npm test test/integration/
  env:
    TEST_SERVER_URL: http://localhost:9847
```

## Troubleshooting

### Tests are skipped

If you see "0 passing" or tests are marked as "pending", ensure:
- `TEST_INTEGRATION=1` is set
- Test server is running
- Port 9847 is not blocked by firewall

### Connection errors

If tests fail with connection errors:
- Verify server is running: `curl http://localhost:9847/socket.io/`
- Check server logs for errors
- Ensure correct port and protocol (http vs https)

### Timeout errors

If tests timeout:
- Increase test timeout in individual tests (`this.timeout(10000)`)
- Check server response times
- Verify server implements required event handlers
