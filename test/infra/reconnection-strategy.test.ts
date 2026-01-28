import {expect} from 'chai'
import * as sinon from 'sinon'

import {ExponentialBackoffStrategy, createDefaultReconnectionStrategy} from '../../infra/reconnection-strategy.js'

describe('ExponentialBackoffStrategy', () => {
  let clock: sinon.SinonFakeTimers

  beforeEach(() => {
    clock = sinon.useFakeTimers()
  })

  afterEach(() => {
    clock.restore()
    sinon.restore()
  })

  describe('constructor', () => {
    it('should use default configuration', () => {
      const strategy = new ExponentialBackoffStrategy()
      expect(strategy).to.be.instanceOf(ExponentialBackoffStrategy)
    })

    it('should accept custom delays', () => {
      const strategy = new ExponentialBackoffStrategy({
        delays: [100, 200, 400],
      })
      // With jitter, delay is randomized but within range
      const delay = strategy.getDelay(0)
      expect(delay).to.be.at.least(50) // 100 * 0.5
      expect(delay).to.be.at.most(100) // 100 * 1.0
    })

    it('should accept custom maxAttempts', () => {
      const strategy = new ExponentialBackoffStrategy({
        maxAttempts: 3,
      })
      expect(strategy.shouldContinue(2)).to.be.true
      expect(strategy.shouldContinue(3)).to.be.false
    })

    it('should accept custom maxTotalTimeMs', () => {
      const strategy = new ExponentialBackoffStrategy({
        maxTotalTimeMs: 10000,
      })
      expect(strategy).to.be.instanceOf(ExponentialBackoffStrategy)
    })

    it('should accept custom jitterFactor', () => {
      const strategy = new ExponentialBackoffStrategy({
        delays: [1000],
        jitterFactor: 0, // No jitter
      })
      const delay = strategy.getDelay(0)
      expect(delay).to.equal(1000) // Exact value with no jitter
    })

    it('should throw on empty delays array', () => {
      expect(() => new ExponentialBackoffStrategy({delays: []})).to.throw(
        'ExponentialBackoffStrategy: delays array cannot be empty',
      )
    })

    it('should throw on non-positive maxAttempts', () => {
      expect(() => new ExponentialBackoffStrategy({maxAttempts: 0})).to.throw(
        'ExponentialBackoffStrategy: maxAttempts must be positive',
      )
      expect(() => new ExponentialBackoffStrategy({maxAttempts: -1})).to.throw(
        'ExponentialBackoffStrategy: maxAttempts must be positive',
      )
    })

    it('should throw on non-positive maxTotalTimeMs', () => {
      expect(() => new ExponentialBackoffStrategy({maxTotalTimeMs: 0})).to.throw(
        'ExponentialBackoffStrategy: maxTotalTimeMs must be positive',
      )
    })

    it('should throw on invalid jitterFactor', () => {
      expect(() => new ExponentialBackoffStrategy({jitterFactor: -0.1})).to.throw(
        'ExponentialBackoffStrategy: jitterFactor must be between 0 and 1',
      )
      expect(() => new ExponentialBackoffStrategy({jitterFactor: 1.1})).to.throw(
        'ExponentialBackoffStrategy: jitterFactor must be between 0 and 1',
      )
    })
  })

  describe('getDelay()', () => {
    it('should return delay for attempt with jitter', () => {
      const strategy = new ExponentialBackoffStrategy({
        delays: [1000, 2000, 4000],
        jitterFactor: 0.5,
      })

      // Multiple calls should return values in expected range
      for (let i = 0; i < 10; i++) {
        strategy.reset()
        const delay = strategy.getDelay(0)
        expect(delay).to.be.at.least(500) // 1000 * 0.5
        expect(delay).to.be.at.most(1000) // 1000 * 1.0
      }
    })

    it('should cap delay at last value in delays array', () => {
      const strategy = new ExponentialBackoffStrategy({
        delays: [100, 200, 400],
        jitterFactor: 0,
        maxAttempts: 200, // Allow many attempts for this test
      })

      // All calls use the same strategy instance without reset
      // to test the delay capping behavior
      expect(strategy.getDelay(0)).to.equal(100)
      expect(strategy.getDelay(1)).to.equal(200)
      expect(strategy.getDelay(2)).to.equal(400)
      expect(strategy.getDelay(3)).to.equal(400) // Capped at last
      expect(strategy.getDelay(100)).to.equal(400) // Still capped
    })

    it('should return undefined when max attempts exceeded', () => {
      const strategy = new ExponentialBackoffStrategy({
        maxAttempts: 3,
        jitterFactor: 0,
      })

      expect(strategy.getDelay(3)).to.be.undefined
    })

    it('should return undefined when max total time exceeded', () => {
      const strategy = new ExponentialBackoffStrategy({
        maxTotalTimeMs: 5000,
        jitterFactor: 0,
      })

      // First call starts the timer
      strategy.getDelay(0)

      // Advance past max time
      clock.tick(6000)

      expect(strategy.getDelay(1)).to.be.undefined
    })

    it('should apply jitter to prevent thundering herd', () => {
      const strategy = new ExponentialBackoffStrategy({
        delays: [10000],
        jitterFactor: 0.5,
      })

      // Collect multiple delay values
      const delays: number[] = []
      for (let i = 0; i < 20; i++) {
        strategy.reset()
        const delay = strategy.getDelay(0)
        if (delay !== undefined) {
          delays.push(delay)
        }
      }

      // Check that delays are randomized (not all the same)
      const uniqueDelays = new Set(delays)
      expect(uniqueDelays.size).to.be.greaterThan(1)

      // Check all delays are within expected range
      for (const delay of delays) {
        expect(delay).to.be.at.least(5000) // 10000 * 0.5
        expect(delay).to.be.at.most(10000) // 10000 * 1.0
      }
    })
  })

  describe('shouldContinue()', () => {
    it('should return true when under max attempts', () => {
      const strategy = new ExponentialBackoffStrategy({maxAttempts: 5})

      expect(strategy.shouldContinue(0)).to.be.true
      expect(strategy.shouldContinue(4)).to.be.true
    })

    it('should return false when at or over max attempts', () => {
      const strategy = new ExponentialBackoffStrategy({maxAttempts: 5})

      expect(strategy.shouldContinue(5)).to.be.false
      expect(strategy.shouldContinue(10)).to.be.false
    })

    it('should return false when max total time exceeded', () => {
      const strategy = new ExponentialBackoffStrategy({
        maxTotalTimeMs: 5000,
      })

      // First call starts the timer
      expect(strategy.shouldContinue(0)).to.be.true

      // Advance past max time
      clock.tick(6000)

      expect(strategy.shouldContinue(1)).to.be.false
    })

    it('should start timing on first call', () => {
      const strategy = new ExponentialBackoffStrategy({
        maxTotalTimeMs: 5000,
      })

      expect(strategy.getElapsedTime()).to.be.undefined

      strategy.shouldContinue(0)

      expect(strategy.getElapsedTime()).to.equal(0)
    })
  })

  describe('reset()', () => {
    it('should reset elapsed time tracking', () => {
      const strategy = new ExponentialBackoffStrategy({
        maxTotalTimeMs: 10000,
      })

      strategy.getDelay(0)
      clock.tick(5000)
      expect(strategy.getElapsedTime()).to.equal(5000)

      strategy.reset()

      expect(strategy.getElapsedTime()).to.be.undefined
    })

    it('should allow reconnection attempts after reset', () => {
      const strategy = new ExponentialBackoffStrategy({
        maxTotalTimeMs: 5000,
      })

      strategy.getDelay(0)
      clock.tick(6000)
      expect(strategy.shouldContinue(1)).to.be.false

      strategy.reset()

      expect(strategy.shouldContinue(0)).to.be.true
    })
  })

  describe('getElapsedTime()', () => {
    it('should return undefined before first attempt', () => {
      const strategy = new ExponentialBackoffStrategy()
      expect(strategy.getElapsedTime()).to.be.undefined
    })

    it('should return elapsed time after attempts started', () => {
      const strategy = new ExponentialBackoffStrategy()

      strategy.getDelay(0)
      expect(strategy.getElapsedTime()).to.equal(0)

      clock.tick(1000)
      expect(strategy.getElapsedTime()).to.equal(1000)

      clock.tick(2000)
      expect(strategy.getElapsedTime()).to.equal(3000)
    })
  })

  describe('getRemainingTime()', () => {
    it('should return undefined when no maxTotalTimeMs configured', () => {
      const strategy = new ExponentialBackoffStrategy()
      strategy.getDelay(0)
      expect(strategy.getRemainingTime()).to.be.undefined
    })

    it('should return undefined before first attempt', () => {
      const strategy = new ExponentialBackoffStrategy({
        maxTotalTimeMs: 10000,
      })
      expect(strategy.getRemainingTime()).to.be.undefined
    })

    it('should return remaining time', () => {
      const strategy = new ExponentialBackoffStrategy({
        maxTotalTimeMs: 10000,
      })

      strategy.getDelay(0)
      expect(strategy.getRemainingTime()).to.equal(10000)

      clock.tick(3000)
      expect(strategy.getRemainingTime()).to.equal(7000)

      clock.tick(7000)
      expect(strategy.getRemainingTime()).to.equal(0)

      clock.tick(5000) // Past the limit
      expect(strategy.getRemainingTime()).to.equal(0) // Clamped to 0
    })
  })
})

describe('createDefaultReconnectionStrategy()', () => {
  it('should create ExponentialBackoffStrategy instance', () => {
    const strategy = createDefaultReconnectionStrategy()
    expect(strategy).to.be.instanceOf(ExponentialBackoffStrategy)
  })
})
