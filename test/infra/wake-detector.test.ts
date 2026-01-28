import {expect} from 'chai'
import * as sinon from 'sinon'

import {TimeBasedWakeDetector, createDefaultWakeDetector} from '../../infra/wake-detector.js'

describe('TimeBasedWakeDetector', () => {
  let clock: sinon.SinonFakeTimers
  let detector: TimeBasedWakeDetector

  beforeEach(() => {
    clock = sinon.useFakeTimers()
    detector = new TimeBasedWakeDetector({
      checkIntervalMs: 1000,
      thresholdMs: 2000,
    })
  })

  afterEach(() => {
    detector.stop()
    clock.restore()
    sinon.restore()
  })

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const d = new TimeBasedWakeDetector()
      expect(d).to.be.instanceOf(TimeBasedWakeDetector)
    })

    it('should accept custom checkIntervalMs', () => {
      const d = new TimeBasedWakeDetector({checkIntervalMs: 10000})
      expect(d).to.be.instanceOf(TimeBasedWakeDetector)
    })

    it('should accept custom thresholdMs', () => {
      const d = new TimeBasedWakeDetector({thresholdMs: 30000})
      expect(d).to.be.instanceOf(TimeBasedWakeDetector)
    })

    it('should throw on non-positive checkIntervalMs', () => {
      expect(() => new TimeBasedWakeDetector({checkIntervalMs: 0})).to.throw(
        'WakeDetector: checkIntervalMs must be positive',
      )
      expect(() => new TimeBasedWakeDetector({checkIntervalMs: -1})).to.throw(
        'WakeDetector: checkIntervalMs must be positive',
      )
    })

    it('should throw on non-positive thresholdMs', () => {
      expect(() => new TimeBasedWakeDetector({thresholdMs: 0})).to.throw('WakeDetector: thresholdMs must be positive')
      expect(() => new TimeBasedWakeDetector({thresholdMs: -1})).to.throw('WakeDetector: thresholdMs must be positive')
    })
  })

  describe('isActive()', () => {
    it('should return false initially', () => {
      expect(detector.isActive()).to.be.false
    })

    it('should return true after start()', () => {
      detector.start()
      expect(detector.isActive()).to.be.true
    })

    it('should return false after stop()', () => {
      detector.start()
      detector.stop()
      expect(detector.isActive()).to.be.false
    })
  })

  describe('start()', () => {
    it('should start wake detection', () => {
      detector.start()
      expect(detector.isActive()).to.be.true
    })

    it('should throw if already started', () => {
      detector.start()
      expect(() => detector.start()).to.throw('WakeDetector: already started')
    })
  })

  describe('stop()', () => {
    it('should stop wake detection', () => {
      detector.start()
      detector.stop()
      expect(detector.isActive()).to.be.false
    })

    it('should be safe to call multiple times', () => {
      detector.start()
      detector.stop()
      detector.stop() // Should not throw
      expect(detector.isActive()).to.be.false
    })

    it('should be safe to call without start', () => {
      detector.stop() // Should not throw
      expect(detector.isActive()).to.be.false
    })
  })

  describe('onWake()', () => {
    it('should return unsubscribe function', () => {
      const handler = sinon.spy()
      const unsubscribe = detector.onWake(handler)
      expect(unsubscribe).to.be.a('function')
    })

    it('should allow multiple handlers', () => {
      const handler1 = sinon.spy()
      const handler2 = sinon.spy()

      detector.onWake(handler1)
      detector.onWake(handler2)

      detector.start()

      // Simulate wake: advance system time without firing interval, then tick
      // This simulates system sleep where time passes but intervals don't fire
      clock.tick(500) // Partial interval
      clock.setSystemTime(Date.now() + 5000) // Jump time forward (simulates sleep)
      clock.tick(500) // Fire the interval - now elapsed will be ~5500ms > threshold

      expect(handler1.called).to.be.true
      expect(handler2.called).to.be.true
    })

    it('should not call handler after unsubscribe', () => {
      const handler = sinon.spy()
      const unsubscribe = detector.onWake(handler)

      unsubscribe()

      detector.start()
      // Simulate wake
      clock.tick(500)
      clock.setSystemTime(Date.now() + 5000)
      clock.tick(500)

      expect(handler.called).to.be.false
    })
  })

  describe('wake detection', () => {
    it('should not trigger on normal interval', () => {
      const handler = sinon.spy()
      detector.onWake(handler)
      detector.start()

      // Normal tick within interval
      clock.tick(1000)

      expect(handler.called).to.be.false
    })

    it('should trigger when time jump exceeds threshold', () => {
      const handler = sinon.spy()
      detector.onWake(handler)
      detector.start()

      // Simulate system wake - time jumps beyond interval + threshold
      // checkInterval = 1000, threshold = 2000, so > 3000 should trigger
      clock.tick(500) // Partial interval
      clock.setSystemTime(Date.now() + 5000) // Jump time forward (simulates sleep)
      clock.tick(500) // Fire the interval

      expect(handler.calledOnce).to.be.true
    })

    it('should continue detecting after wake event', () => {
      const handler = sinon.spy()
      detector.onWake(handler)
      detector.start()

      // First wake
      clock.tick(500)
      clock.setSystemTime(Date.now() + 5000)
      clock.tick(500)
      expect(handler.callCount).to.equal(1)

      // Second wake
      clock.tick(500)
      clock.setSystemTime(Date.now() + 5000)
      clock.tick(500)
      expect(handler.callCount).to.equal(2)
    })

    it('should handle handler errors gracefully', () => {
      const errorHandler = sinon.stub().throws(new Error('Handler error'))
      const goodHandler = sinon.spy()

      detector.onWake(errorHandler)
      detector.onWake(goodHandler)
      detector.start()

      clock.tick(500)
      clock.setSystemTime(Date.now() + 5000)
      clock.tick(500)

      expect(errorHandler.calledOnce).to.be.true
      expect(goodHandler.calledOnce).to.be.true // Should still be called
    })
  })

  describe('restart behavior', () => {
    it('should allow restart after stop', () => {
      detector.start()
      detector.stop()
      detector.start() // Should not throw
      expect(detector.isActive()).to.be.true
    })

    it('should reset time tracking on restart', () => {
      const handler = sinon.spy()
      detector.onWake(handler)

      detector.start()
      clock.tick(2000) // Partial interval

      detector.stop()
      detector.start() // Restart resets last check time

      clock.tick(1000) // Normal interval from new start
      expect(handler.called).to.be.false // Should not trigger
    })
  })
})

describe('createDefaultWakeDetector()', () => {
  it('should create TimeBasedWakeDetector instance', () => {
    const detector = createDefaultWakeDetector()
    expect(detector).to.be.instanceOf(TimeBasedWakeDetector)
  })
})
