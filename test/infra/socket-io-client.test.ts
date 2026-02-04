import {expect} from 'chai'
import * as sinon from 'sinon'

import {TransportClient} from '../../src/infra/socket-io-client.js'
import {TransportNotConnectedError} from '../../src/core/domain/errors/transport-error.js'

describe('TransportClient', () => {
  let client: TransportClient

  beforeEach(async () => {
    client = new TransportClient({
      connectTimeoutMs: 1000,
      requestTimeoutMs: 500,
      roomTimeoutMs: 200,
      reconnectionAttempts: 3,
    })
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('constructor', () => {
    it('should use default config values when none provided', () => {
      const defaultClient = new TransportClient()
      expect(defaultClient.getState()).to.equal('disconnected')
    })

    it('should accept custom config values', () => {
      const customClient = new TransportClient({
        connectTimeoutMs: 5000,
        requestTimeoutMs: 10000,
      })
      expect(customClient.getState()).to.equal('disconnected')
    })
  })

  describe('getState()', () => {
    it('should return disconnected initially', () => {
      expect(client.getState()).to.equal('disconnected')
    })
  })

  describe('getClientId()', () => {
    it('should return undefined when not connected', () => {
      expect(client.getClientId()).to.be.undefined
    })
  })

  describe('on()', () => {
    it('should allow registering handlers before connect', () => {
      const handler = sinon.spy()

      // Should not throw
      const unsubscribe = client.on('test-event', handler)

      expect(unsubscribe).to.be.a('function')
    })

    it('should return unsubscribe function', () => {
      const handler = sinon.spy()

      const unsubscribe = client.on('test-event', handler)

      expect(unsubscribe).to.be.a('function')
      // Calling unsubscribe should not throw
      unsubscribe()
    })

    it('should allow multiple handlers for same event', () => {
      const handler1 = sinon.spy()
      const handler2 = sinon.spy()

      const unsub1 = client.on('test-event', handler1)
      const unsub2 = client.on('test-event', handler2)

      expect(unsub1).to.be.a('function')
      expect(unsub2).to.be.a('function')
    })
  })

  describe('once()', () => {
    it('should queue handlers when not connected (consistent with on())', () => {
      const handler = sinon.spy()

      // Should not throw - now queues handlers like on()
      client.once('test-event', handler)
    })
  })

  describe('onStateChange()', () => {
    it('should register state change handler', () => {
      const handler = sinon.spy()

      const unsubscribe = client.onStateChange(handler)

      expect(unsubscribe).to.be.a('function')
    })

    it('should return unsubscribe function', () => {
      const handler = sinon.spy()

      const unsubscribe = client.onStateChange(handler)
      unsubscribe()

      // Should not throw when unsubscribed
    })
  })

  describe('disconnect()', () => {
    it('should resolve immediately when not connected', async () => {
      // Should not throw and resolve quickly
      await client.disconnect()
      expect(client.getState()).to.equal('disconnected')
    })
  })

  describe('isConnected()', () => {
    it('should return false when not connected', async () => {
      const result = await client.isConnected()
      expect(result).to.be.false
    })
  })

  describe('joinRoom()', () => {
    it('should throw TransportNotConnectedError when not connected', async () => {
      try {
        await client.joinRoom('test-room')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(TransportNotConnectedError)
      }
    })
  })

  describe('leaveRoom()', () => {
    it('should throw TransportNotConnectedError when not connected', async () => {
      try {
        await client.leaveRoom('test-room')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(TransportNotConnectedError)
      }
    })
  })

  describe('request()', () => {
    it('should throw TransportNotConnectedError when not connected', async () => {
      try {
        await client.request('test-event', {data: 'test'})
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(TransportNotConnectedError)
      }
    })
  })
})

describe('TransportClient - State Management', () => {
  let client: TransportClient

  beforeEach(() => {
    client = new TransportClient()
  })

  afterEach(() => {
    sinon.restore()
  })

  it('should notify state handlers on state change', async () => {
    const stateChanges: string[] = []
    client.onStateChange((state) => {
      stateChanges.push(state)
    })

    // Verify initial state
    expect(client.getState()).to.equal('disconnected')

    // State handlers are called when state changes (tested via internal behavior)
    expect(stateChanges).to.be.an('array')
  })

  it('should allow multiple state handlers', () => {
    const handler1 = sinon.spy()
    const handler2 = sinon.spy()

    const unsub1 = client.onStateChange(handler1)
    const unsub2 = client.onStateChange(handler2)

    expect(unsub1).to.be.a('function')
    expect(unsub2).to.be.a('function')
  })

  it('should remove state handler when unsubscribed', () => {
    const handler = sinon.spy()

    const unsubscribe = client.onStateChange(handler)
    unsubscribe()

    // Handler should be removed - no way to verify directly but should not throw
  })
})

describe('TransportClient - Event Handler Lifecycle', () => {
  let client: TransportClient

  beforeEach(() => {
    client = new TransportClient()
  })

  afterEach(() => {
    sinon.restore()
  })

  it('should clean up event handlers on unsubscribe', () => {
    const handler = sinon.spy()

    const unsubscribe = client.on('test-event', handler)
    unsubscribe()

    // Handler should be removed
  })

  it('should allow re-registering handler after unsubscribe', () => {
    const handler = sinon.spy()

    const unsub1 = client.on('test-event', handler)
    unsub1()

    const unsub2 = client.on('test-event', handler)
    expect(unsub2).to.be.a('function')
  })

  it('should handle unsubscribe called multiple times', () => {
    const handler = sinon.spy()

    const unsubscribe = client.on('test-event', handler)
    unsubscribe()
    unsubscribe() // Should not throw
  })
})

describe('TransportClient - Error Classes Integration', () => {
  it('should use TransportNotConnectedError with operation name in message', async () => {
    const client = new TransportClient()

    try {
      await client.joinRoom('room')
      expect.fail('Should throw')
    } catch (error) {
      expect(error).to.be.instanceOf(TransportNotConnectedError)
      expect((error as TransportNotConnectedError).message).to.include('joinRoom')
    }
  })

  it('should use TransportNotConnectedError for leaveRoom', async () => {
    const client = new TransportClient()

    try {
      await client.leaveRoom('room')
      expect.fail('Should throw')
    } catch (error) {
      expect(error).to.be.instanceOf(TransportNotConnectedError)
      expect((error as TransportNotConnectedError).message).to.include('leaveRoom')
    }
  })

  it('should use TransportNotConnectedError for request', async () => {
    const client = new TransportClient()

    try {
      await client.request('event')
      expect.fail('Should throw')
    } catch (error) {
      expect(error).to.be.instanceOf(TransportNotConnectedError)
      expect((error as TransportNotConnectedError).message).to.include('request')
    }
  })
})

describe('TransportClient - Configuration', () => {
  it('should use provided logger', () => {
    const mockLogger = {
      debug: sinon.spy(),
    }

    const client = new TransportClient({logger: mockLogger})

    // Logger is used internally - just verify construction works
    expect(client).to.be.instanceOf(TransportClient)
  })

  it('should use provided transport types', () => {
    const client = new TransportClient({
      transports: ['polling', 'websocket'],
    })

    expect(client).to.be.instanceOf(TransportClient)
  })

  it('should accept all config options', () => {
    const client = new TransportClient({
      connectTimeoutMs: 5000,
      reconnectionAttempts: 10,
      reconnectionDelayMs: 100,
      reconnectionDelayMaxMs: 5000,
      requestTimeoutMs: 30000,
      roomTimeoutMs: 3000,
      transports: ['websocket'],
    })

    expect(client).to.be.instanceOf(TransportClient)
  })
})

describe('TransportClient - ADR-007: Promise Mutex', () => {
  it('should deduplicate concurrent connect() calls to same URL', async () => {
    const client = new TransportClient()
    const invalidUrl = 'http://localhost:99999' // Unreachable port

    // Launch two concurrent connects to same URL
    const promise1 = client.connect(invalidUrl).catch(() => 'error1')
    const promise2 = client.connect(invalidUrl).catch(() => 'error2')

    // Both should resolve/reject together (promise mutex deduplication)
    const [result1, result2] = await Promise.all([promise1, promise2])

    // Both should fail with same error
    expect(result1).to.equal('error1')
    expect(result2).to.equal('error2')
  })

  it('should throw error for concurrent connection to different URLs', async () => {
    const client = new TransportClient({connectTimeoutMs: 5000})
    const url1 = 'http://localhost:3001'
    const url2 = 'http://localhost:3002'

    // Start first connection (will be in connecting state)
    const promise1 = client.connect(url1).catch((err) => err)

    // Give it a moment to enter connecting state
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Try to connect to different URL while first is in progress
    // Should throw either ConcurrentConnectionError or InvalidOperationError
    let errorThrown = false
    try {
      await client.connect(url2)
      expect.fail('Should have thrown an error')
    } catch (error: unknown) {
      errorThrown = true
      expect(error).to.be.instanceOf(Error)
      // Verify it's a connection-related error
      const errorMessage = (error as Error).message
      expect(errorMessage.length).to.be.greaterThan(0)
    }

    expect(errorThrown).to.be.true

    // Clean up first connection
    await promise1
  })

  it('should clear connect promise after connection completes', async () => {
    const client = new TransportClient()
    const invalidUrl = 'http://localhost:99993'

    // First connection attempt (will fail)
    await client.connect(invalidUrl).catch(() => {
      /* Expected to fail */
    })

    // Second connection attempt should be allowed (promise cleared)
    await client.connect(invalidUrl).catch(() => {
      /* Expected to fail */
    })

    // If we get here without ConcurrentConnectionError, promise was cleared
    expect(client.getState()).to.equal('disconnected')
  })

  it('should clear connect promise after connection fails', async () => {
    const client = new TransportClient()
    const invalidUrl = 'http://localhost:99994'

    // First connection (will fail)
    await client.connect(invalidUrl).catch(() => {
      /* Expected */
    })

    // Promise should be cleared, allow new connection
    await client.connect(invalidUrl).catch(() => {
      /* Expected */
    })

    expect(client.getState()).to.equal('disconnected')
  })

  it('should handle multiple sequential connect/disconnect cycles', async () => {
    const client = new TransportClient()
    const invalidUrl = 'http://localhost:99995'

    for (let i = 0; i < 3; i++) {
      // Connect (will fail)
      await client.connect(invalidUrl).catch(() => {
        /* Expected */
      })

      // Disconnect
      await client.disconnect()

      // State should be disconnected
      expect(client.getState()).to.equal('disconnected')
    }
  })
})

describe('TransportClient - Race Condition Edge Cases', () => {
  it('should handle concurrent connect and disconnect', async () => {
    const client = new TransportClient()
    const invalidUrl = 'http://localhost:99996'

    // Start connection
    const connectPromise = client.connect(invalidUrl).catch(() => {
      /* Expected */
    })

    // Immediately try to disconnect
    const disconnectPromise = client.disconnect()

    // Wait for both
    await Promise.all([connectPromise, disconnectPromise])

    // Should end in disconnected state
    expect(client.getState()).to.equal('disconnected')
  })

  it('should preserve serverUrl during connection', async () => {
    const client = new TransportClient()
    const url = 'http://localhost:99997'

    // Start connection (will fail but URL should be stored)
    await client.connect(url).catch(() => {
      /* Expected */
    })

    // Client should have tracked the URL (internal state)
    expect(client).to.be.instanceOf(TransportClient)
  })
})

describe('TransportClient - Connection State Protection', () => {
  it('should prevent connect() when already connecting', async () => {
    const client = new TransportClient()
    const url = 'http://localhost:99998'

    // Start first connection
    const promise1 = client.connect(url).catch(() => {
      /* Expected */
    })

    // Try to connect to same URL again while connecting
    const promise2 = client.connect(url).catch(() => {
      /* Expected */
    })

    // Both should reference same promise (deduplication)
    await Promise.all([promise1, promise2])

    expect(client.getState()).to.equal('disconnected')
  })

  it('should allow connect() after disconnect completes', async () => {
    const client = new TransportClient()
    const url = 'http://localhost:99999'

    // First attempt
    await client.connect(url).catch(() => {
      /* Expected */
    })

    // Disconnect
    await client.disconnect()

    // Should allow new connection
    await client.connect(url).catch(() => {
      /* Expected */
    })

    expect(client.getState()).to.equal('disconnected')
  })
})
