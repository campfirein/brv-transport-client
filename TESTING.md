# Testing Strategy

This document outlines the testing approach for the brv-transport-client library.

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Types](#test-types)
- [Test Structure](#test-structure)
- [Coverage Goals](#coverage-goals)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)

## Testing Philosophy

Our testing strategy follows these principles:

1. **Test Behavior, Not Implementation**: Tests should verify what the code does, not how it does it
2. **Comprehensive Coverage**: Aim for ~85% line coverage with focus on critical paths
3. **Fast Feedback**: Unit tests should run quickly (<5 seconds total)
4. **Isolated Tests**: Each test should be independent and not rely on other tests
5. **Clear Test Names**: Test names should describe the expected behavior
6. **Boundary Testing**: Explicitly test edge cases and boundary values

## Test Types

### 1. Unit Tests

**Location**: `test/core/domain/`, `test/infra/`

**Purpose**: Test individual components in isolation

**Characteristics**:
- Fast execution (<1ms per test)
- Use mocks/stubs for external dependencies
- Test single responsibility
- Focus on business logic and edge cases

**Examples**:
```typescript
// Domain entity tests
test/core/domain/entities/instance-info.test.ts

// Infrastructure component tests
test/infra/connection-state-manager.test.ts
test/infra/event-dispatcher.test.ts
test/infra/room-manager.test.ts
```

**Coverage**:
- ✓ Domain entities and value objects
- ✓ Validators (with boundary value tests)
- ✓ Error classes
- ✓ Infrastructure components (with mocked dependencies)

### 2. Integration Tests

**Location**: `test/integration/`

**Purpose**: Test multiple components working together with real dependencies

**Characteristics**:
- Slower execution (100-1000ms per test)
- Require running Socket.IO server
- Test end-to-end workflows
- Verify component interactions

**Examples**:
```typescript
// Full connection lifecycle
test/integration/end-to-end.test.ts
```

**Coverage**:
- ✓ Connection → Event → Room → Disconnect flows
- ✓ Reconnection behavior
- ✓ Room auto-rejoin
- ✓ Error handling with real server

**Note**: Integration tests are **skipped by default**. Set `TEST_INTEGRATION=1` to run them.

### 3. Validator Tests

**Location**: `test/core/domain/validators/`

**Purpose**: Comprehensive boundary value testing for all validators

**Characteristics**:
- Test valid inputs
- Test boundary values (0, 1, 254, 255, 256, 65535, 65536)
- Test invalid types (null, undefined, object, array)
- Test edge cases (empty strings, whitespace)

**Examples**:
```typescript
test/core/domain/validators/event-name-validator.test.ts
test/core/domain/validators/room-name-validator.test.ts
test/core/domain/validators/url-validator.test.ts
```

## Test Structure

### Directory Structure

```
test/
├── core/
│   └── domain/
│       ├── entities/           # Domain entity tests
│       ├── errors/             # Error class tests
│       └── validators/         # Validator tests (with boundary values)
├── infra/                      # Infrastructure layer tests
│   ├── socket-io-client.test.ts
│   ├── event-dispatcher.test.ts
│   ├── room-manager.test.ts
│   └── ...
└── integration/                # End-to-end tests
    ├── end-to-end.test.ts
    └── README.md
```

This mirrors the source structure for easy navigation.

### Test File Naming

- **Pattern**: `{component-name}.test.ts`
- **Examples**:
  - `instance-info.test.ts` for `instance-info.ts`
  - `event-name-validator.test.ts` for `event-name-validator.ts`

### Test Case Organization

```typescript
describe('ComponentName', () => {
  describe('methodName()', () => {
    describe('valid inputs', () => {
      it('should handle standard case')
      it('should handle edge case X')
    })

    describe('boundary values', () => {
      it('should accept minimum value')
      it('should accept maximum value')
      it('should reject below minimum')
      it('should reject above maximum')
    })

    describe('invalid inputs', () => {
      it('should reject null')
      it('should reject undefined')
      it('should reject wrong type')
    })
  })
})
```

## Coverage Goals

### Overall Target: ~85% Line Coverage

**Rationale**: Balances thoroughness with pragmatism. Some unreachable error paths and framework code don't need coverage.

### Per-Layer Goals:

| Layer | Target | Priority |
|-------|--------|----------|
| Domain | 95% | High - Business logic must be well-tested |
| Interfaces | N/A | Type definitions only |
| Infrastructure | 85% | Medium - Implementation details |
| Integration | N/A | Workflow coverage, not line coverage |

### Current Status

- **Source LOC**: ~3,500
- **Test LOC**: ~3,800
- **Test-to-Source Ratio**: 1.09:1 ✓
- **Coverage**: ~85%

## Running Tests

### All Tests (Unit Only)

```bash
npm test
```

### Integration Tests

```bash
# Start test server first
node test-server.js

# In another terminal
TEST_INTEGRATION=1 npm test test/integration/
```

### With Coverage Report

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

### Watch Mode (during development)

```bash
npm test -- --watch
```

### Specific Test File

```bash
npm test test/core/domain/validators/event-name-validator.test.ts
```

## Writing Tests

### Unit Test Template

```typescript
import {describe, it, beforeEach, afterEach} from 'mocha'
import {expect} from 'chai'
import * as sinon from 'sinon'
import {ComponentUnderTest} from '../../path/to/component.js'

describe('ComponentUnderTest', () => {
  let component: ComponentUnderTest
  let mockDependency: sinon.SinonStubbedInstance<DependencyType>

  beforeEach(() => {
    // Fresh state for each test
    mockDependency = sinon.createStubInstance(DependencyClass)
    component = new ComponentUnderTest(mockDependency)
  })

  afterEach(() => {
    // Cleanup
    sinon.restore()
  })

  describe('methodName()', () => {
    it('should do expected behavior', () => {
      // Arrange
      mockDependency.someMethod.returns(42)

      // Act
      const result = component.methodName()

      // Assert
      expect(result).to.equal(42)
      expect(mockDependency.someMethod).to.have.been.calledOnce
    })
  })
})
```

### Mocking Strategy

**External Dependencies**: Always mock
- Socket.IO socket
- File system operations
- Network calls
- Timers (use `sinon.useFakeTimers()`)

**Internal Components**: Mock at boundaries
- Mock composed components when testing facade
- Use real implementations for simple utilities

**Example**:
```typescript
// Mock Socket.IO socket
const mockSocket = {
  id: 'socket-123',
  connected: true,
  emit: sinon.stub(),
  on: sinon.stub(),
  off: sinon.stub(),
  removeAllListeners: sinon.stub(),
} as unknown as Socket

// Mock logger
const mockLogger = {
  debug: sinon.stub(),
  info: sinon.stub(),
  warn: sinon.stub(),
  error: sinon.stub(),
}
```

### Boundary Value Test Template

```typescript
describe('boundary values', () => {
  it('should accept minimum valid value (1)', () => {
    expect(() => validate(1)).to.not.throw()
  })

  it('should accept value just below maximum (254)', () => {
    expect(() => validate(254)).to.not.throw()
  })

  it('should accept maximum valid value (255)', () => {
    expect(() => validate(255)).to.not.throw()
  })

  it('should reject value just above maximum (256)', () => {
    expect(() => validate(256)).to.throw(ValidationError)
  })

  it('should reject zero (below minimum)', () => {
    expect(() => validate(0)).to.throw(ValidationError)
  })

  it('should reject negative value', () => {
    expect(() => validate(-1)).to.throw(ValidationError)
  })
})
```

## Best Practices

### 1. Test Independence

❌ **Bad** (tests depend on execution order):
```typescript
let sharedState: string

it('should set state', () => {
  sharedState = 'value'
})

it('should use state', () => {
  expect(sharedState).to.equal('value') // Fails if run alone
})
```

✅ **Good** (each test is independent):
```typescript
beforeEach(() => {
  // Fresh state for each test
})

it('should handle state correctly', () => {
  const state = 'value'
  expect(state).to.equal('value')
})
```

### 2. Descriptive Test Names

❌ **Bad**:
```typescript
it('works')
it('test event handler')
it('should not throw')
```

✅ **Good**:
```typescript
it('should emit event when handler is registered')
it('should throw InvalidEventNameError for empty string')
it('should clean up listeners on disconnect')
```

### 3. Arrange-Act-Assert Pattern

```typescript
it('should calculate total correctly', () => {
  // Arrange: Set up test data
  const calculator = new Calculator()
  const input = [1, 2, 3]

  // Act: Execute the behavior
  const result = calculator.sum(input)

  // Assert: Verify the outcome
  expect(result).to.equal(6)
})
```

### 4. Test Error Messages

```typescript
// Good: Verify error type AND message
expect(() => validate('')).to.throw(
  InvalidEventNameError,
  'event name cannot be empty'
)

// Also good: Check error properties
try {
  validate('')
  expect.fail('Should have thrown')
} catch (error) {
  expect(error).to.be.instanceOf(InvalidEventNameError)
  expect(error.message).to.include('cannot be empty')
}
```

### 5. Avoid Magic Numbers

❌ **Bad**:
```typescript
it('should handle port 65536', () => {
  expect(() => validate(65536)).to.throw()
})
```

✅ **Good**:
```typescript
const MAX_PORT = 65535
const ABOVE_MAX_PORT = 65536

it('should reject port above maximum (65536)', () => {
  expect(() => validate(ABOVE_MAX_PORT)).to.throw(
    InvalidInstanceDataError,
    'port must be a valid port number (1-65535)'
  )
})
```

### 6. Clean Up Resources

```typescript
describe('with timers', () => {
  let clock: sinon.SinonFakeTimers

  beforeEach(() => {
    clock = sinon.useFakeTimers()
  })

  afterEach(() => {
    clock.restore()      // ✓ Clean up fake timers
    sinon.restore()      // ✓ Clean up all stubs
  })

  it('should handle timeout', () => {
    // Test using fake timers
    clock.tick(1000)
  })
})
```

## Continuous Integration

Tests run automatically on:
- Every commit (via pre-commit hook)
- Pull requests (GitHub Actions)
- Before releases

### CI Test Script

```bash
# Run linter
npm run lint

# Run type checking
npm run type-check

# Run unit tests with coverage
npm run test:coverage

# Integration tests (if server available)
if [ "$TEST_INTEGRATION" = "1" ]; then
  npm test test/integration/
fi
```

## Troubleshooting

### Tests Timeout

**Cause**: Async operations not completing
**Solution**:
- Increase timeout: `this.timeout(5000)`
- Check for missing async/await
- Verify all promises resolve/reject

### Flaky Tests

**Cause**: Race conditions, timing issues, shared state
**Solution**:
- Use `sinon.useFakeTimers()` for time-dependent tests
- Ensure test isolation with `beforeEach`
- Check for unhandled promise rejections

### Coverage Gaps

**Cause**: Missing test cases for error paths
**Solution**:
- Review coverage report: `npm run test:coverage`
- Focus on untested branches
- Add tests for error handling

## Resources

- [Mocha Documentation](https://mochajs.org/)
- [Chai Assertions](https://www.chaijs.com/api/)
- [Sinon Mocking](https://sinonjs.org/releases/latest/)
- [Istanbul Coverage](https://istanbul.js.org/)

## Contributing

When adding new features:

1. Write tests FIRST (TDD approach)
2. Ensure all tests pass: `npm test`
3. Verify coverage: `npm run test:coverage`
4. Add integration tests if workflow changes
5. Update this document if testing strategy changes
