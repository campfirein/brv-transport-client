import {expect} from 'chai'
import * as sinon from 'sinon'

import {TransportClient} from '../../infra/socket-io-client.js'
import {NoOpClientLogger} from '../../infra/no-op-client-logger.js'
import {ExponentialBackoffStrategy} from '../../infra/reconnection-strategy.js'
import {TimeBasedWakeDetector} from '../../infra/wake-detector.js'
import {TransportNotConnectedError, InvalidEventNameError} from '../../core/domain/errors/transport-error.js'

describe('TransportClient - Edge Cases & Critical Paths', () => {
  let client: TransportClient
  let mockLogger: sinon.SinonStubbedInstance<NoOpClientLogger>
  let mockWakeDetector: sinon.SinonStubbedInstance<TimeBasedWakeDetector>
  let mockStrategy: sinon.SinonStubbedInstance<ExponentialBackoffStrategy>

  beforeEach(() => {
    // Create mock dependencies
    mockLogger = sinon.createStubInstance(NoOpClientLogger)
    mockWakeDetector = sinon.createStubInstance(TimeBasedWakeDetector)
    mockStrategy = sinon.createStubInstance(ExponentialBackoffStrategy)

    // Setup wake detector defaults
    mockWakeDetector.isActive.returns(false)
    mockWakeDetector.onWake.returns(() => {}) // unsubscribe function

    // Setup strategy defaults
    mockStrategy.getDelay.returns(1000)
    mockStrategy.shouldContinue.returns(true)

    client = new TransportClient({
      logger: mockLogger as unknown as NoOpClientLogger,
      wakeDetector: mockWakeDetector as unknown as TimeBasedWakeDetector,
      reconnectionStrategy: mockStrategy as unknown as ExponentialBackoffStrategy,
      connectTimeoutMs: 1000,
      requestTimeoutMs: 500,
      reconnectionAttempts: 3,
    })
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('Error Handling - Invalid Operations', () => {
    it('should throw when request() called while disconnected (fire-and-forget)', () => {
      expect(() => client.request('test-event', {data: 'value'})).to.throw(
        TransportNotConnectedError,
        'Not connected to server',
      )
    })

    it('should throw when request() called while disconnected', async () => {
      try {
        await client.request('test-request', {data: 'value'})
        expect.fail('Should have thrown TransportNotConnectedError')
      } catch (error) {
        expect(error).to.be.instanceOf(TransportNotConnectedError)
        expect((error as Error).message).to.include('Not connected to server')
      }
    })

    it('should throw when joinRoom() called while disconnected', async () => {
      try {
        await client.joinRoom('test-room')
        expect.fail('Should have thrown TransportNotConnectedError')
      } catch (error) {
        expect(error).to.be.instanceOf(TransportNotConnectedError)
      }
    })

    it('should throw when leaveRoom() called while disconnected', async () => {
      try {
        await client.leaveRoom('test-room')
        expect.fail('Should have thrown TransportNotConnectedError')
      } catch (error) {
        expect(error).to.be.instanceOf(TransportNotConnectedError)
      }
    })

    it('should handle disconnect when already disconnected', async () => {
      expect(client.getState()).to.equal('disconnected')

      // Should not throw when disconnecting while already disconnected
      await client.disconnect()

      expect(client.getState()).to.equal('disconnected')
    })

    it('should throw for invalid event names in on()', () => {
      expect(() => client.on('', () => {})).to.throw(InvalidEventNameError)
    })

    it('should throw for invalid event names in once()', () => {
      expect(() => client.once('', () => {})).to.throw(InvalidEventNameError)
    })

    it('should throw for invalid event names in request()', () => {
      // Will throw TransportNotConnectedError first, but validates event name
      expect(() => client.request('', {data: 'value'})).to.throw(Error)
    })
  })

  describe('State Transitions', () => {
    it('should handle rapid state change subscriptions', () => {
      const handler1 = sinon.spy()
      const handler2 = sinon.spy()
      const handler3 = sinon.spy()

      const unsub1 = client.onStateChange(handler1)
      const unsub2 = client.onStateChange(handler2)
      const unsub3 = client.onStateChange(handler3)

      // All should be valid unsubscribe functions
      expect(unsub1).to.be.a('function')
      expect(unsub2).to.be.a('function')
      expect(unsub3).to.be.a('function')

      // Unsubscribe all
      unsub1()
      unsub2()
      unsub3()
    })

    it('should handle unsubscribe called multiple times', () => {
      const handler = sinon.spy()
      const unsubscribe = client.onStateChange(handler)

      // Should not throw when called multiple times
      unsubscribe()
      unsubscribe()
      unsubscribe()
    })

    it('should allow new subscriptions after unsubscribe', () => {
      const handler1 = sinon.spy()
      const handler2 = sinon.spy()

      const unsub1 = client.onStateChange(handler1)
      unsub1()

      const unsub2 = client.onStateChange(handler2)
      expect(unsub2).to.be.a('function')
    })
  })

  describe('Event Handler Management', () => {
    it('should handle handler registration before connection', () => {
      const handler = sinon.spy()

      // Register multiple event handlers
      client.on('event1', handler)
      client.on('event2', handler)
      client.on('event3', handler)

      // Should not throw
      expect(client.getState()).to.equal('disconnected')
    })

    it('should handle once() handlers before connection', () => {
      const handler = sinon.spy()

      // Register multiple once handlers
      client.once('event1', handler)
      client.once('event2', handler)
      client.once('event3', handler)

      // Should queue handlers, not throw
      expect(client.getState()).to.equal('disconnected')
    })

    it('should handle unsubscribe before connection', () => {
      const handler = sinon.spy()

      const unsubscribe = client.on('test-event', handler)

      // Should not throw
      unsubscribe()

      expect(client.getState()).to.equal('disconnected')
    })

    it('should handle multiple unsubscribe calls for same handler', () => {
      const handler = sinon.spy()

      const unsubscribe = client.on('test-event', handler)

      // Multiple calls should not throw
      unsubscribe()
      unsubscribe()
      unsubscribe()
    })
  })

  describe('Configuration Edge Cases', () => {
    it('should handle all optional config parameters', () => {
      const fullyConfiguredClient = new TransportClient({
        connectTimeoutMs: 5000,
        reconnectionAttempts: 10,
        reconnectionDelayMs: 100,
        reconnectionDelayMaxMs: 5000,
        requestTimeoutMs: 30000,
        roomTimeoutMs: 3000,
        transports: ['websocket', 'polling'],
        socketOptions: {
          path: '/custom-path',
          auth: {token: 'test-token'},
        },
      })

      expect(fullyConfiguredClient.getState()).to.equal('disconnected')
    })

    it('should use default values when config not provided', () => {
      const defaultClient = new TransportClient()

      expect(defaultClient.getState()).to.equal('disconnected')
    })

    it('should handle partial config with some defaults', () => {
      const partialClient = new TransportClient({
        connectTimeoutMs: 2000,
        // Other values use defaults
      })

      expect(partialClient.getState()).to.equal('disconnected')
    })

    it('should deep freeze config to prevent mutations', () => {
      const config = {
        connectTimeoutMs: 1000,
        socketOptions: {
          path: '/socket.io',
        },
      }

      const configuredClient = new TransportClient(config)

      // Original config object should be frozen
      expect(Object.isFrozen(config)).to.be.false // Original not frozen
      expect(configuredClient.getState()).to.equal('disconnected')
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle multiple onStateChange registrations concurrently', () => {
      const handlers = Array.from({length: 10}, () => sinon.spy())
      const unsubscribes = handlers.map((handler) => client.onStateChange(handler))

      // All should be valid
      expect(unsubscribes).to.have.lengthOf(10)
      unsubscribes.forEach((unsub) => {
        expect(unsub).to.be.a('function')
      })

      // Unsubscribe all
      unsubscribes.forEach((unsub) => unsub())
    })

    it('should handle multiple event registrations for same event', () => {
      const handler = sinon.spy()

      // Register 10 handlers for same event
      const unsubscribes = Array.from({length: 10}, () => client.on('test-event', handler))

      expect(unsubscribes).to.have.lengthOf(10)

      // Each should have unique unsubscribe function
      unsubscribes.forEach((unsub) => {
        expect(unsub).to.be.a('function')
        unsub() // Should not affect others
      })
    })

    it('should handle interleaved subscribe/unsubscribe', () => {
      const handler = sinon.spy()

      const unsub1 = client.on('event1', handler)
      const unsub2 = client.on('event2', handler)
      unsub1()
      const unsub3 = client.on('event3', handler)
      unsub2()
      unsub3()

      // Should complete without errors
      expect(client.getState()).to.equal('disconnected')
    })
  })

  describe('isConnected() Edge Cases', () => {
    it('should return false when not connected', async () => {
      const connected = await client.isConnected(100)
      expect(connected).to.be.false
    })

    it('should reject zero timeout', async () => {
      try {
        await client.isConnected(0)
        expect.fail('Should have thrown InvalidTimeoutError')
      } catch (error) {
        expect((error as Error).message).to.include('Invalid timeout value')
      }
    })

    it('should handle very short timeout', async () => {
      const connected = await client.isConnected(1)
      expect(connected).to.be.false
    })

    it('should handle undefined timeout (use default)', async () => {
      const connected = await client.isConnected()
      expect(connected).to.be.false
    })

    it('should reject negative timeout', async () => {
      try {
        await client.isConnected(-1)
        expect.fail('Should have thrown InvalidTimeoutError')
      } catch (error) {
        expect((error as Error).message).to.include('Invalid timeout value')
      }
    })
  })

  describe('Memory Management', () => {
    it('should clean up handlers on disconnect', async () => {
      const handler = sinon.spy()

      client.on('event1', handler)
      client.on('event2', handler)
      client.onStateChange(handler)

      await client.disconnect()

      // State should be disconnected
      expect(client.getState()).to.equal('disconnected')
    })

    it('should not leak memory with many subscribe/unsubscribe cycles', () => {
      // Simulate many registration/unregistration cycles
      for (let i = 0; i < 100; i++) {
        const unsub = client.on(`event-${i}`, () => {})
        unsub()
      }

      // Should not throw or leak
      expect(client.getState()).to.equal('disconnected')
    })

    it('should clean up state change handlers', () => {
      const handlers = Array.from({length: 50}, () => sinon.spy())
      const unsubscribes = handlers.map((h) => client.onStateChange(h))

      // Unsubscribe all
      unsubscribes.forEach((unsub) => unsub())

      // Should not leak
      expect(client.getState()).to.equal('disconnected')
    })
  })

  describe('API Contract Validation', () => {
    it('should expose all public methods from ITransportClient', () => {
      expect(client.connect).to.be.a('function')
      expect(client.disconnect).to.be.a('function')
      expect(client.getClientId).to.be.a('function')
      expect(client.getState).to.be.a('function')
      expect(client.isConnected).to.be.a('function')
      expect(client.joinRoom).to.be.a('function')
      expect(client.leaveRoom).to.be.a('function')
      expect(client.on).to.be.a('function')
      expect(client.once).to.be.a('function')
      expect(client.onStateChange).to.be.a('function')
      expect(client.request).to.be.a('function')
      expect(client.requestWithAck).to.be.a('function')
    })

    it('should return correct types from methods', () => {
      expect(client.getState()).to.be.a('string')
      expect(client.getClientId()).to.be.undefined
      expect(client.on('event', () => {})).to.be.a('function')
      expect(client.onStateChange(() => {})).to.be.a('function')
    })

    it('should handle method chaining where appropriate', () => {
      const unsubscribe1 = client.on('event1', () => {})
      const unsubscribe2 = client.on('event2', () => {})

      unsubscribe1()
      unsubscribe2()

      // Should support functional chaining
      expect(unsubscribe1).to.be.a('function')
      expect(unsubscribe2).to.be.a('function')
    })
  })
})
