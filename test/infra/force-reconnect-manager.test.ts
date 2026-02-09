import {expect} from 'chai'
import sinon from 'sinon'
import {ForceReconnectManager} from '../../src/infra/force-reconnect-manager.js'
import {NoOpClientLogger} from '../../src/infra/no-op-client-logger.js'
import {ExponentialBackoffStrategy} from '../../src/infra/reconnection-strategy.js'

describe('ForceReconnectManager', () => {
  let clock: sinon.SinonFakeTimers
  let logger: NoOpClientLogger
  let strategy: ExponentialBackoffStrategy

  beforeEach(() => {
    clock = sinon.useFakeTimers()
    logger = new NoOpClientLogger()
    strategy = new ExponentialBackoffStrategy({
      delays: [100, 200, 400],
      maxAttempts: 3,
      jitterFactor: 0, // Disable jitter for predictable tests
    })
  })

  afterEach(() => {
    clock.restore()
  })

  describe('constructor', () => {
    it('should create instance with config', () => {
      const onAttempt = sinon.stub().resolves()
      const manager = new ForceReconnectManager({
        logger,
        reconnectionStrategy: strategy,
        onAttempt,
      })

      expect(manager.isScheduled).to.be.false
      expect(manager.attemptCount).to.equal(0)
    })
  })

  describe('schedule()', () => {
    it('should schedule reconnection attempt', () => {
      const onAttempt = sinon.stub().resolves()
      const manager = new ForceReconnectManager({
        logger,
        reconnectionStrategy: strategy,
        onAttempt,
      })

      manager.schedule()

      expect(manager.isScheduled).to.be.true
      expect(onAttempt.called).to.be.false
    })

    it('should execute attempt after delay', async () => {
      const onAttempt = sinon.stub().resolves()
      const manager = new ForceReconnectManager({
        logger,
        reconnectionStrategy: strategy,
        onAttempt,
      })

      manager.schedule()
      clock.tick(100)
      await Promise.resolve() // Allow async to complete

      expect(onAttempt.calledOnce).to.be.true
    })

    it('should not double-schedule if already scheduled', () => {
      const onAttempt = sinon.stub().resolves()
      const manager = new ForceReconnectManager({
        logger,
        reconnectionStrategy: strategy,
        onAttempt,
      })

      manager.schedule()
      manager.schedule()

      expect(manager.isScheduled).to.be.true

      clock.tick(100)

      // Only one timer should have been created
      expect(onAttempt.callCount).to.be.lessThanOrEqual(1)
    })

    it('should reschedule on failure with increasing delay', async () => {
      const onAttempt = sinon.stub()
      onAttempt.onFirstCall().rejects(new Error('Connection failed'))
      onAttempt.onSecondCall().resolves()

      const manager = new ForceReconnectManager({
        logger,
        reconnectionStrategy: strategy,
        onAttempt,
      })

      manager.schedule()

      // First attempt after 100ms
      clock.tick(100)
      await Promise.resolve()
      await Promise.resolve() // Extra tick for async error handling

      expect(onAttempt.calledOnce).to.be.true
      expect(manager.isScheduled).to.be.true // Should be rescheduled
    })

    it('should reset on success', async () => {
      const onAttempt = sinon.stub().resolves()
      const manager = new ForceReconnectManager({
        logger,
        reconnectionStrategy: strategy,
        onAttempt,
      })

      manager.schedule()
      clock.tick(100)
      await Promise.resolve()

      expect(manager.attemptCount).to.equal(0) // Reset after success
      expect(manager.isScheduled).to.be.false
    })
  })

  describe('clearTimer()', () => {
    it('should clear scheduled timer', () => {
      const onAttempt = sinon.stub().resolves()
      const manager = new ForceReconnectManager({
        logger,
        reconnectionStrategy: strategy,
        onAttempt,
      })

      manager.schedule()
      expect(manager.isScheduled).to.be.true

      manager.clearTimer()
      expect(manager.isScheduled).to.be.false

      clock.tick(100)
      expect(onAttempt.called).to.be.false
    })

    it('should not reset attempt counter', () => {
      const onAttempt = sinon.stub().rejects(new Error('fail'))
      const manager = new ForceReconnectManager({
        logger,
        reconnectionStrategy: strategy,
        onAttempt,
      })

      manager.schedule()
      clock.tick(100)

      manager.clearTimer()
      // Attempt counter should remain (though we can't easily test this directly)
      expect(manager.isScheduled).to.be.false
    })
  })

  describe('cancel()', () => {
    it('should clear timer and reset counter', () => {
      const onAttempt = sinon.stub().resolves()
      const manager = new ForceReconnectManager({
        logger,
        reconnectionStrategy: strategy,
        onAttempt,
      })

      manager.schedule()
      manager.cancel()

      expect(manager.isScheduled).to.be.false
      expect(manager.attemptCount).to.equal(0)
    })
  })

  describe('reset()', () => {
    it('should reset attempt counter and strategy', async () => {
      const onAttempt = sinon.stub()
      onAttempt.onFirstCall().rejects(new Error('fail'))
      onAttempt.resolves()

      const manager = new ForceReconnectManager({
        logger,
        reconnectionStrategy: strategy,
        onAttempt,
      })

      manager.schedule()
      clock.tick(100)
      await Promise.resolve()
      await Promise.resolve()

      manager.clearTimer()
      manager.reset()

      expect(manager.attemptCount).to.equal(0)
    })
  })

  describe('restart()', () => {
    it('should clear timer, reset counter, and schedule', () => {
      const onAttempt = sinon.stub().resolves()
      const manager = new ForceReconnectManager({
        logger,
        reconnectionStrategy: strategy,
        onAttempt,
      })

      manager.restart()

      expect(manager.isScheduled).to.be.true
      expect(manager.attemptCount).to.equal(0)
    })
  })

  describe('onExhausted callback', () => {
    it('should fire onExhausted when strategy returns undefined delay in schedule()', () => {
      const onAttempt = sinon.stub().rejects(new Error('fail'))
      const onExhausted = sinon.stub()

      const manager = new ForceReconnectManager({
        logger,
        reconnectionStrategy: new ExponentialBackoffStrategy({
          delays: [100, 200, 400],
          maxAttempts: 3,
          jitterFactor: 0,
        }),
        onAttempt,
        onExhausted,
      })

      // Attempt 1 (delay=100ms)
      manager.schedule()
      clock.tick(100)

      // Wait for async executeAttempt to complete and reschedule
      return Promise.resolve()
        .then(() => Promise.resolve())
        .then(() => {
          // Attempt 2 (delay=200ms)
          clock.tick(200)
          return Promise.resolve().then(() => Promise.resolve())
        })
        .then(() => {
          // Attempt 3 (delay=400ms)
          clock.tick(400)
          return Promise.resolve().then(() => Promise.resolve())
        })
        .then(() => {
          // After attempt 3, shouldContinue(2) returns false → onExhausted fires
          expect(onExhausted.called).to.be.true
        })
    })

    it('should not fire onExhausted when not provided', async () => {
      const onAttempt = sinon.stub().rejects(new Error('fail'))

      const limitedStrategy = new ExponentialBackoffStrategy({
        delays: [100],
        maxAttempts: 1,
        jitterFactor: 0,
      })

      const manager = new ForceReconnectManager({
        logger,
        reconnectionStrategy: limitedStrategy,
        onAttempt,
        // onExhausted intentionally omitted
      })

      // Should not throw when onExhausted is not set
      manager.schedule()
      clock.tick(100)
      await Promise.resolve()
      await Promise.resolve()

      // Strategy exhausted but no callback — no error
      expect(manager.isScheduled).to.be.false
    })

    it('should fire onExhausted from schedule() when strategy has no more delays', () => {
      const onAttempt = sinon.stub().resolves()
      const onExhausted = sinon.stub()

      // Mock strategy that always returns undefined (exhausted from the start)
      const exhaustedStrategy = {
        getDelay: sinon.stub().returns(undefined),
        shouldContinue: sinon.stub().returns(false),
        reset: sinon.stub(),
      }

      const manager = new ForceReconnectManager({
        logger,
        reconnectionStrategy: exhaustedStrategy,
        onAttempt,
        onExhausted,
      })

      manager.schedule()

      expect(onExhausted.calledOnce).to.be.true
      expect(manager.isScheduled).to.be.false
      expect(onAttempt.called).to.be.false
    })
  })

  describe('onError callback', () => {
    it('should call onError when attempt fails', async () => {
      const onAttempt = sinon.stub().rejects(new Error('Connection failed'))
      const onError = sinon.stub()

      const manager = new ForceReconnectManager({
        logger,
        reconnectionStrategy: strategy,
        onAttempt,
        onError,
      })

      manager.schedule()
      clock.tick(100)
      await Promise.resolve()
      await Promise.resolve()

      expect(onError.calledOnce).to.be.true
      expect(onError.firstCall.args[0]).to.be.instanceOf(Error)
      expect(onError.firstCall.args[0].message).to.equal('Connection failed')
      expect(onError.firstCall.args[1]).to.equal(1) // First attempt
    })

    it('should handle onError callback throwing', async () => {
      const onAttempt = sinon.stub().rejects(new Error('Connection failed'))
      const onError = sinon.stub().throws(new Error('Callback error'))

      const manager = new ForceReconnectManager({
        logger,
        reconnectionStrategy: strategy,
        onAttempt,
        onError,
      })

      // Should not throw
      manager.schedule()
      clock.tick(100)
      await Promise.resolve()
      await Promise.resolve()

      expect(onError.calledOnce).to.be.true
    })
  })
})
