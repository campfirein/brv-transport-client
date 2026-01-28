import {expect} from 'chai'
import * as sinon from 'sinon'

import {EventDispatcher} from '../../infra/event-dispatcher.js'
import type {ISocketProvider} from '../../core/interfaces/i-socket-provider.js'
import type {ISocket} from '../../core/interfaces/i-socket.js'
import {InvalidEventNameError, MaxPendingOnceHandlersExceededError} from '../../core/domain/errors/transport-error.js'

describe('EventDispatcher', () => {
  let dispatcher: EventDispatcher
  let mockSocketProvider: ISocketProvider
  let mockSocket: sinon.SinonStubbedInstance<ISocket>

  beforeEach(() => {
    mockSocket = {
      connected: false,
      id: 'test-socket-id',
      on: sinon.stub(),
      once: sinon.stub(),
      off: sinon.stub(),
      emit: sinon.stub(),
      disconnect: sinon.stub(),
    } as unknown as sinon.SinonStubbedInstance<ISocket>

    mockSocketProvider = {
      getSocket: () => (mockSocket.connected ? (mockSocket as unknown as ISocket) : undefined),
    }

    dispatcher = new EventDispatcher({
      socketProvider: mockSocketProvider,
    })
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('constructor', () => {
    it('should create instance with default config', () => {
      expect(dispatcher).to.be.instanceOf(EventDispatcher)
    })

    it('should accept custom logger', () => {
      const logger = {debug: sinon.spy()}
      const d = new EventDispatcher({
        socketProvider: mockSocketProvider,
        logger,
      })
      expect(d).to.be.instanceOf(EventDispatcher)
    })

    it('should accept custom maxPendingOnceHandlers', () => {
      const d = new EventDispatcher({
        socketProvider: mockSocketProvider,
        maxPendingOnceHandlers: 5,
      })
      expect(d).to.be.instanceOf(EventDispatcher)
    })
  })

  describe('on()', () => {
    it('should return unsubscribe function', () => {
      const handler = sinon.spy()
      const unsubscribe = dispatcher.on('test-event', handler)
      expect(unsubscribe).to.be.a('function')
    })

    it('should validate event name', () => {
      const handler = sinon.spy()
      expect(() => dispatcher.on('', handler)).to.throw(InvalidEventNameError)
    })

    it('should queue handler when socket not connected', () => {
      const handler = sinon.spy()
      dispatcher.on('test-event', handler)
      expect(dispatcher.getEventCount()).to.equal(1)
    })

    it('should register socket listener when connected', () => {
      mockSocket.connected = true
      const handler = sinon.spy()

      dispatcher.on('test-event', handler)

      expect(mockSocket.on.calledOnce).to.be.true
      expect(mockSocket.on.firstCall.args[0]).to.equal('test-event')
    })

    it('should allow multiple handlers for same event', () => {
      const handler1 = sinon.spy()
      const handler2 = sinon.spy()

      dispatcher.on('test-event', handler1)
      dispatcher.on('test-event', handler2)

      expect(dispatcher.getEventCount()).to.equal(1) // Same event, one entry
    })

    it('should remove handler on unsubscribe', () => {
      const handler = sinon.spy()
      const unsubscribe = dispatcher.on('test-event', handler)

      unsubscribe()

      expect(dispatcher.getEventCount()).to.equal(0)
    })

    it('should handle unsubscribe when other handlers exist for same event', () => {
      const handler1 = sinon.spy()
      const handler2 = sinon.spy()

      const unsubscribe1 = dispatcher.on('test-event', handler1)
      dispatcher.on('test-event', handler2)

      unsubscribe1()

      expect(dispatcher.getEventCount()).to.equal(1) // handler2 still registered
    })
  })

  describe('once()', () => {
    it('should validate event name', () => {
      const handler = sinon.spy()
      expect(() => dispatcher.once('', handler)).to.throw(InvalidEventNameError)
    })

    it('should queue handler when socket not connected', () => {
      const handler = sinon.spy()
      dispatcher.once('test-event', handler)
      expect(dispatcher.pendingOnceHandlerCount).to.equal(1)
    })

    it('should register directly on socket when connected', () => {
      mockSocket.connected = true
      const handler = sinon.spy()

      dispatcher.once('test-event', handler)

      expect(mockSocket.once.calledOnce).to.be.true
    })

    it('should throw when max pending handlers exceeded', () => {
      const d = new EventDispatcher({
        socketProvider: mockSocketProvider,
        maxPendingOnceHandlers: 2,
      })

      d.once('event1', () => {})
      d.once('event2', () => {})

      expect(() => d.once('event3', () => {})).to.throw(MaxPendingOnceHandlersExceededError)
    })
  })

  describe('registerPendingHandlers()', () => {
    it('should register all pending handlers on socket', () => {
      // Queue handlers before connection
      dispatcher.on('event1', () => {})
      dispatcher.on('event2', () => {})
      dispatcher.once('event3', () => {})

      // Simulate connection
      mockSocket.connected = true
      ;(mockSocketProvider as {getSocket: () => ISocket | undefined}).getSocket = () => mockSocket as unknown as ISocket

      dispatcher.registerPendingHandlers()

      // on() handlers register socket listeners
      expect(mockSocket.on.callCount).to.equal(2) // event1, event2
      // once() handlers also registered
      expect(mockSocket.once.callCount).to.equal(1) // event3
    })

    it('should clear pending once handlers after registration', () => {
      dispatcher.once('event1', () => {})
      expect(dispatcher.pendingOnceHandlerCount).to.equal(1)

      mockSocket.connected = true
      ;(mockSocketProvider as {getSocket: () => ISocket | undefined}).getSocket = () => mockSocket as unknown as ISocket

      dispatcher.registerPendingHandlers()

      expect(dispatcher.pendingOnceHandlerCount).to.equal(0)
    })
  })

  describe('clearSocketListeners()', () => {
    it('should remove all registered socket listeners', () => {
      mockSocket.connected = true
      ;(mockSocketProvider as {getSocket: () => ISocket | undefined}).getSocket = () => mockSocket as unknown as ISocket

      dispatcher.on('event1', () => {})
      dispatcher.on('event2', () => {})

      dispatcher.clearSocketListeners()

      expect(mockSocket.off.callCount).to.equal(2)
    })
  })

  describe('clearAllHandlers()', () => {
    it('should clear all handlers and pending handlers', () => {
      dispatcher.on('event1', () => {})
      dispatcher.once('event2', () => {})

      dispatcher.clearAllHandlers()

      expect(dispatcher.getEventCount()).to.equal(0)
      expect(dispatcher.pendingOnceHandlerCount).to.equal(0)
    })
  })

  describe('clearPendingOnceHandlers()', () => {
    it('should clear only pending once handlers', () => {
      dispatcher.on('event1', () => {})
      dispatcher.once('event2', () => {})

      dispatcher.clearPendingOnceHandlers()

      expect(dispatcher.getEventCount()).to.equal(1) // on() handler still there
      expect(dispatcher.pendingOnceHandlerCount).to.equal(0)
    })
  })

  describe('error handling', () => {
    it('should call onHandlerError callback when handler throws', () => {
      const onHandlerError = sinon.spy()
      const d = new EventDispatcher({
        socketProvider: mockSocketProvider,
        onHandlerError,
      })

      mockSocket.connected = true
      ;(mockSocketProvider as {getSocket: () => ISocket | undefined}).getSocket = () => mockSocket as unknown as ISocket

      const errorHandler = sinon.stub().throws(new Error('Handler error'))
      d.on('test-event', errorHandler)

      // Simulate socket event by calling the registered callback
      const socketCallback = mockSocket.on.firstCall.args[1] as (data: unknown) => void
      socketCallback({test: 'data'})

      expect(onHandlerError.calledOnce).to.be.true
      expect(onHandlerError.firstCall.args[0]).to.equal('test-event')
      expect(onHandlerError.firstCall.args[1]).to.be.instanceOf(Error)
    })

    it('should continue dispatching to other handlers when one throws', () => {
      mockSocket.connected = true
      ;(mockSocketProvider as {getSocket: () => ISocket | undefined}).getSocket = () => mockSocket as unknown as ISocket

      const handler1 = sinon.stub().throws(new Error('Error'))
      const handler2 = sinon.spy()

      dispatcher.on('test-event', handler1)
      dispatcher.on('test-event', handler2)

      // Simulate socket event
      const socketCallback = mockSocket.on.firstCall.args[1] as (data: unknown) => void
      socketCallback({test: 'data'})

      expect(handler1.calledOnce).to.be.true
      expect(handler2.calledOnce).to.be.true
    })
  })
})
