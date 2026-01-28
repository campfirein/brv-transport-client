import {expect} from 'chai'
import * as sinon from 'sinon'

import {ConnectionStateManager} from '../../infra/connection-state-manager.js'
import type {ConnectionState} from '../../core/interfaces/i-connection-state.js'
import {InvalidStateTransitionError} from '../../core/domain/errors/transport-error.js'

describe('ConnectionStateManager', () => {
  let stateManager: ConnectionStateManager

  beforeEach(() => {
    stateManager = new ConnectionStateManager()
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('constructor', () => {
    it('should default to disconnected state', () => {
      expect(stateManager.getState()).to.equal('disconnected')
    })

    it('should accept custom initial state', () => {
      const manager = new ConnectionStateManager({initialState: 'connected'})
      expect(manager.getState()).to.equal('connected')
    })

    it('should accept custom logger', () => {
      const logger = {debug: sinon.spy()}
      const manager = new ConnectionStateManager({logger})
      manager.setState('connecting')
      expect(logger.debug.called).to.be.true
    })
  })

  describe('getState()', () => {
    it('should return current state', () => {
      expect(stateManager.getState()).to.equal('disconnected')
    })

    it('should return updated state after setState', () => {
      stateManager.setState('connecting')
      expect(stateManager.getState()).to.equal('connecting')
    })
  })

  describe('setState()', () => {
    it('should update state', () => {
      stateManager.setState('connecting')
      expect(stateManager.getState()).to.equal('connecting')
    })

    it('should notify handlers on state change', () => {
      const handler = sinon.spy()
      stateManager.onStateChange(handler)

      stateManager.setState('connecting')

      expect(handler.calledOnce).to.be.true
      expect(handler.calledWith('connecting')).to.be.true
    })

    it('should not notify handlers if state unchanged', () => {
      const handler = sinon.spy()
      stateManager.onStateChange(handler)

      stateManager.setState('disconnected') // Same as initial state

      expect(handler.called).to.be.false
    })

    it('should notify all handlers in registration order', () => {
      const callOrder: number[] = []
      const handler1 = () => callOrder.push(1)
      const handler2 = () => callOrder.push(2)
      const handler3 = () => callOrder.push(3)

      stateManager.onStateChange(handler1)
      stateManager.onStateChange(handler2)
      stateManager.onStateChange(handler3)

      stateManager.setState('connecting')

      expect(callOrder).to.deep.equal([1, 2, 3])
    })

    it('should continue notifying handlers even if one throws', () => {
      const handler1 = sinon.spy()
      const handler2 = sinon.stub().throws(new Error('Handler error'))
      const handler3 = sinon.spy()

      stateManager.onStateChange(handler1)
      stateManager.onStateChange(handler2)
      stateManager.onStateChange(handler3)

      stateManager.setState('connecting')

      expect(handler1.calledOnce).to.be.true
      expect(handler2.calledOnce).to.be.true
      expect(handler3.calledOnce).to.be.true
    })

    it('should handle all connection states', () => {
      const states: ConnectionState[] = ['disconnected', 'connecting', 'connected', 'reconnecting']

      for (const state of states) {
        stateManager.setState(state)
        expect(stateManager.getState()).to.equal(state)
      }
    })
  })

  describe('onStateChange()', () => {
    it('should return unsubscribe function', () => {
      const handler = sinon.spy()
      const unsubscribe = stateManager.onStateChange(handler)

      expect(unsubscribe).to.be.a('function')
    })

    it('should stop receiving notifications after unsubscribe', () => {
      const handler = sinon.spy()
      const unsubscribe = stateManager.onStateChange(handler)

      stateManager.setState('connecting')
      expect(handler.callCount).to.equal(1)

      unsubscribe()

      stateManager.setState('connected')
      expect(handler.callCount).to.equal(1) // Still 1, not notified
    })

    it('should allow re-subscribing after unsubscribe', () => {
      const handler = sinon.spy()
      const unsubscribe1 = stateManager.onStateChange(handler)

      unsubscribe1()

      const unsubscribe2 = stateManager.onStateChange(handler)
      stateManager.setState('connecting')

      expect(handler.calledOnce).to.be.true
      unsubscribe2()
    })

    it('should handle unsubscribe called multiple times', () => {
      const handler = sinon.spy()
      const unsubscribe = stateManager.onStateChange(handler)

      unsubscribe()
      unsubscribe() // Should not throw

      stateManager.setState('connecting')
      expect(handler.called).to.be.false
    })

    it('should allow same handler to be registered multiple times', () => {
      const handler = sinon.spy()
      stateManager.onStateChange(handler)
      stateManager.onStateChange(handler)

      stateManager.setState('connecting')

      // Set only stores unique values, so handler is called once
      expect(handler.callCount).to.equal(1)
    })
  })

  describe('clearHandlers()', () => {
    it('should remove all handlers', () => {
      const handler1 = sinon.spy()
      const handler2 = sinon.spy()

      stateManager.onStateChange(handler1)
      stateManager.onStateChange(handler2)

      stateManager.clearHandlers()

      stateManager.setState('connecting')

      expect(handler1.called).to.be.false
      expect(handler2.called).to.be.false
    })

    it('should allow adding new handlers after clear', () => {
      const handler1 = sinon.spy()
      const handler2 = sinon.spy()

      stateManager.onStateChange(handler1)
      stateManager.clearHandlers()
      stateManager.onStateChange(handler2)

      stateManager.setState('connecting')

      expect(handler1.called).to.be.false
      expect(handler2.calledOnce).to.be.true
    })
  })

  describe('state transitions', () => {
    it('should handle typical connection flow', () => {
      const states: ConnectionState[] = []
      stateManager.onStateChange((state) => states.push(state))

      stateManager.setState('connecting')
      stateManager.setState('connected')
      stateManager.setState('disconnected')

      expect(states).to.deep.equal(['connecting', 'connected', 'disconnected'])
    })

    it('should handle reconnection flow', () => {
      const states: ConnectionState[] = []
      stateManager.onStateChange((state) => states.push(state))

      stateManager.setState('connecting')
      stateManager.setState('connected')
      stateManager.setState('reconnecting')
      stateManager.setState('connected')

      expect(states).to.deep.equal(['connecting', 'connected', 'reconnecting', 'connected'])
    })
  })

  describe('state transition validation', () => {
    describe('valid transitions', () => {
      it('should allow disconnected → connecting', () => {
        expect(() => stateManager.setState('connecting')).not.to.throw()
        expect(stateManager.getState()).to.equal('connecting')
      })

      it('should allow connecting → connected', () => {
        stateManager.setState('connecting')
        expect(() => stateManager.setState('connected')).not.to.throw()
        expect(stateManager.getState()).to.equal('connected')
      })

      it('should allow connecting → disconnected', () => {
        stateManager.setState('connecting')
        expect(() => stateManager.setState('disconnected')).not.to.throw()
        expect(stateManager.getState()).to.equal('disconnected')
      })

      it('should allow connected → reconnecting', () => {
        stateManager.setState('connecting')
        stateManager.setState('connected')
        expect(() => stateManager.setState('reconnecting')).not.to.throw()
        expect(stateManager.getState()).to.equal('reconnecting')
      })

      it('should allow connected → disconnected', () => {
        stateManager.setState('connecting')
        stateManager.setState('connected')
        expect(() => stateManager.setState('disconnected')).not.to.throw()
        expect(stateManager.getState()).to.equal('disconnected')
      })

      it('should allow reconnecting → connected', () => {
        stateManager.setState('connecting')
        stateManager.setState('connected')
        stateManager.setState('reconnecting')
        expect(() => stateManager.setState('connected')).not.to.throw()
        expect(stateManager.getState()).to.equal('connected')
      })

      it('should allow reconnecting → disconnected', () => {
        stateManager.setState('connecting')
        stateManager.setState('connected')
        stateManager.setState('reconnecting')
        expect(() => stateManager.setState('disconnected')).not.to.throw()
        expect(stateManager.getState()).to.equal('disconnected')
      })
    })

    describe('invalid transitions', () => {
      it('should reject disconnected → connected', () => {
        expect(() => stateManager.setState('connected')).to.throw(InvalidStateTransitionError)
        expect(stateManager.getState()).to.equal('disconnected')
      })

      it('should reject disconnected → reconnecting', () => {
        expect(() => stateManager.setState('reconnecting')).to.throw(InvalidStateTransitionError)
        expect(stateManager.getState()).to.equal('disconnected')
      })

      it('should reject connecting → reconnecting', () => {
        stateManager.setState('connecting')
        expect(() => stateManager.setState('reconnecting')).to.throw(InvalidStateTransitionError)
        expect(stateManager.getState()).to.equal('connecting')
      })

      it('should reject connected → connecting', () => {
        stateManager.setState('connecting')
        stateManager.setState('connected')
        expect(() => stateManager.setState('connecting')).to.throw(InvalidStateTransitionError)
        expect(stateManager.getState()).to.equal('connected')
      })

      it('should reject reconnecting → connecting', () => {
        stateManager.setState('connecting')
        stateManager.setState('connected')
        stateManager.setState('reconnecting')
        expect(() => stateManager.setState('connecting')).to.throw(InvalidStateTransitionError)
        expect(stateManager.getState()).to.equal('reconnecting')
      })
    })
  })

  describe('guard methods', () => {
    it('canTransitionTo should return true for valid transitions', () => {
      expect(stateManager.canTransitionTo('connecting')).to.be.true
      expect(stateManager.canTransitionTo('connected')).to.be.false
      expect(stateManager.canTransitionTo('reconnecting')).to.be.false
    })

    it('canTransitionTo should update after state changes', () => {
      stateManager.setState('connecting')
      expect(stateManager.canTransitionTo('connected')).to.be.true
      expect(stateManager.canTransitionTo('disconnected')).to.be.true
      expect(stateManager.canTransitionTo('connecting')).to.be.false
      expect(stateManager.canTransitionTo('reconnecting')).to.be.false
    })

    it('isConnected should return correct value', () => {
      expect(stateManager.isConnected()).to.be.false
      stateManager.setState('connecting')
      expect(stateManager.isConnected()).to.be.false
      stateManager.setState('connected')
      expect(stateManager.isConnected()).to.be.true
    })

    it('isConnecting should return correct value', () => {
      expect(stateManager.isConnecting()).to.be.false
      stateManager.setState('connecting')
      expect(stateManager.isConnecting()).to.be.true
      stateManager.setState('connected')
      expect(stateManager.isConnecting()).to.be.false
    })

    it('isDisconnected should return correct value', () => {
      expect(stateManager.isDisconnected()).to.be.true
      stateManager.setState('connecting')
      expect(stateManager.isDisconnected()).to.be.false
    })

    it('isReconnecting should return correct value', () => {
      expect(stateManager.isReconnecting()).to.be.false
      stateManager.setState('connecting')
      stateManager.setState('connected')
      stateManager.setState('reconnecting')
      expect(stateManager.isReconnecting()).to.be.true
    })
  })
})
