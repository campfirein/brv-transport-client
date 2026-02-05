# Testing

## Running Tests

```bash
npm test                    # all tests
```

Run a single file:

```bash
npm test test/infra/client-factory.test.ts
```

## Stack

- **Mocha** — test runner
- **Chai** — assertions (`expect` style)
- **Sinon** — mocks, stubs, spies, fake timers
- **tsx** — TypeScript loader (no pre-compilation)
- **c8** — coverage (Istanbul-compatible)

## Test Structure

Tests mirror the source layout:

```
test/
├── core/domain/
│   ├── entities/          # InstanceInfo
│   ├── errors/            # ConnectionError, TransportError classes
│   └── validators/        # event-name, room-name, url (boundary value tests)
└── infra/
    ├── socket-io-client.test.ts
    ├── socket-io-client-edge-cases.test.ts
    ├── client-factory.test.ts
    ├── daemon-connector.test.ts
    ├── daemon-discovery-sync.test.ts
    ├── daemon-health.test.ts
    ├── daemon-instance-discovery.test.ts
    ├── daemon-spawner.test.ts
    ├── connection-state-manager.test.ts
    ├── event-dispatcher.test.ts
    ├── room-manager.test.ts
    ├── force-reconnect-manager.test.ts
    ├── global-data-path.test.ts
    ├── global-instance-manager.test.ts
    ├── heartbeat-utils.test.ts
    ├── process-utils.test.ts
    ├── reconnection-strategy.test.ts
    ├── resolve-server-path.test.ts
    ├── spawn-lock.test.ts
    ├── wake-detector.test.ts
    ├── schemas/schemas.test.ts
    └── utils/deep-freeze.test.ts
```

28 test files.

## Conventions

- **Mocking**: Always mock Socket.IO, file system, network. Use real implementations for simple utilities.
- **Naming**: `describe('ClassName')` > `describe('methodName()')` > `it('should ...')`.
- **Isolation**: Fresh state in `beforeEach`, cleanup in `afterEach` with `sinon.restore()`.
- **Validators**: Boundary value tests (min, max, off-by-one, invalid types).
- **Errors**: Verify both error type (`instanceOf`) and message content.

## Writing a Test

```typescript
import { expect } from 'chai'
import * as sinon from 'sinon'
import { MyComponent } from '../../src/infra/my-component.js'

describe('MyComponent', () => {
  afterEach(() => sinon.restore())

  describe('myMethod()', () => {
    it('should return expected result', () => {
      const component = new MyComponent()
      const result = component.myMethod()
      expect(result).to.equal(42)
    })
  })
})
```
