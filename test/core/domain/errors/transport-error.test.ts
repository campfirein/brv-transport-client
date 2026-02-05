import {expect} from 'chai'

import {
  TransportConnectionError,
  TransportError,
  TransportNotConnectedError,
  TransportRequestError,
  TransportRequestTimeoutError,
  TransportRoomError,
  TransportRoomTimeoutError,
} from '../../../../src/core/domain/errors/transport-error.js'

describe('Transport Errors', () => {
  describe('TransportError', () => {
    it('should create error with correct message', () => {
      const error = new TransportError('Test error message')

      expect(error.message).to.equal('Test error message')
    })

    it('should have correct name', () => {
      const error = new TransportError('Test')

      expect(error.name).to.equal('TransportError')
    })

    it('should be an instance of Error', () => {
      const error = new TransportError('Test')

      expect(error).to.be.instanceOf(Error)
    })
  })

  describe('TransportConnectionError', () => {
    it('should have message with URL', () => {
      const error = new TransportConnectionError('http://127.0.0.1:49847')

      expect(error.message).to.equal('Connection failed to http://127.0.0.1:49847')
    })

    it('should include original error message when provided', () => {
      const originalError = new Error('ECONNREFUSED')
      const error = new TransportConnectionError('http://127.0.0.1:49847', originalError)

      expect(error.message).to.equal('Connection failed to http://127.0.0.1:49847: ECONNREFUSED')
    })

    it('should store url property', () => {
      const error = new TransportConnectionError('http://127.0.0.1:49847')

      expect(error.url).to.equal('http://127.0.0.1:49847')
    })

    it('should store originalError property', () => {
      const originalError = new Error('ECONNREFUSED')
      const error = new TransportConnectionError('http://127.0.0.1:49847', originalError)

      expect(error.originalError).to.equal(originalError)
    })

    it('should have correct name', () => {
      const error = new TransportConnectionError('http://127.0.0.1:49847')

      expect(error.name).to.equal('TransportConnectionError')
    })

    it('should be an instance of TransportError', () => {
      const error = new TransportConnectionError('http://127.0.0.1:49847')

      expect(error).to.be.instanceOf(TransportError)
    })

    it('should accept custom message via options', () => {
      const error = new TransportConnectionError({message: 'Custom transport connection error'})

      expect(error.message).to.equal('Custom transport connection error')
      expect(error.name).to.equal('TransportConnectionError')
      expect(error.url).to.be.undefined
      expect(error.originalError).to.be.undefined
    })
  })

  describe('TransportNotConnectedError', () => {
    it('should have default message', () => {
      const error = new TransportNotConnectedError()

      expect(error.message).to.equal('Not connected to server. Cannot perform: operation')
    })

    it('should include custom operation in message', () => {
      const error = new TransportNotConnectedError('emit event')

      expect(error.message).to.equal('Not connected to server. Cannot perform: emit event')
    })

    it('should have correct name', () => {
      const error = new TransportNotConnectedError()

      expect(error.name).to.equal('TransportNotConnectedError')
    })

    it('should be an instance of TransportError', () => {
      const error = new TransportNotConnectedError()

      expect(error).to.be.instanceOf(TransportError)
    })

    it('should accept custom message via options', () => {
      const error = new TransportNotConnectedError({message: 'Custom not connected error'})

      expect(error.message).to.equal('Custom not connected error')
      expect(error.name).to.equal('TransportNotConnectedError')
      expect(error.operation).to.be.undefined
    })
  })

  describe('TransportRequestTimeoutError', () => {
    it('should have message with event and timeout', () => {
      const error = new TransportRequestTimeoutError('task:create', 10000)

      expect(error.message).to.equal("Request timeout for event 'task:create' after 10000ms")
    })

    it('should store event property', () => {
      const error = new TransportRequestTimeoutError('task:create', 10000)

      expect(error.event).to.equal('task:create')
    })

    it('should store timeoutMs property', () => {
      const error = new TransportRequestTimeoutError('task:create', 10000)

      expect(error.timeoutMs).to.equal(10000)
    })

    it('should have correct name', () => {
      const error = new TransportRequestTimeoutError('task:create', 10000)

      expect(error.name).to.equal('TransportRequestTimeoutError')
    })

    it('should be an instance of TransportError', () => {
      const error = new TransportRequestTimeoutError('task:create', 10000)

      expect(error).to.be.instanceOf(TransportError)
    })

    it('should accept custom message via options', () => {
      const error = new TransportRequestTimeoutError({message: 'Custom request timeout error'})

      expect(error.message).to.equal('Custom request timeout error')
      expect(error.name).to.equal('TransportRequestTimeoutError')
      expect(error.event).to.be.undefined
      expect(error.timeoutMs).to.be.undefined
    })
  })

  describe('TransportRequestError', () => {
    it('should have default message with event', () => {
      const error = new TransportRequestError('task:create')

      expect(error.message).to.equal("Request failed for event 'task:create'")
    })

    it('should include custom message', () => {
      const error = new TransportRequestError('task:create', 'Server error')

      expect(error.message).to.equal("Server error for event 'task:create'")
    })

    it('should store event property', () => {
      const error = new TransportRequestError('task:create')

      expect(error.event).to.equal('task:create')
    })

    it('should have correct name', () => {
      const error = new TransportRequestError('task:create')

      expect(error.name).to.equal('TransportRequestError')
    })

    it('should be an instance of TransportError', () => {
      const error = new TransportRequestError('task:create')

      expect(error).to.be.instanceOf(TransportError)
    })

    it('should accept custom message via options', () => {
      const error = new TransportRequestError({message: 'Custom request error'})

      expect(error.message).to.equal('Custom request error')
      expect(error.name).to.equal('TransportRequestError')
      expect(error.event).to.be.undefined
    })
  })

  describe('TransportRoomError', () => {
    it('should have message for join operation', () => {
      const error = new TransportRoomError('task-room-123', 'join')

      expect(error.message).to.equal("Failed to join room 'task-room-123'")
    })

    it('should have message for leave operation', () => {
      const error = new TransportRoomError('task-room-123', 'leave')

      expect(error.message).to.equal("Failed to leave room 'task-room-123'")
    })

    it('should store room property', () => {
      const error = new TransportRoomError('task-room-123', 'join')

      expect(error.room).to.equal('task-room-123')
    })

    it('should store operation property', () => {
      const error = new TransportRoomError('task-room-123', 'join')

      expect(error.operation).to.equal('join')
    })

    it('should have correct name', () => {
      const error = new TransportRoomError('task-room-123', 'join')

      expect(error.name).to.equal('TransportRoomError')
    })

    it('should be an instance of TransportError', () => {
      const error = new TransportRoomError('task-room-123', 'join')

      expect(error).to.be.instanceOf(TransportError)
    })

    it('should accept custom message via options', () => {
      const error = new TransportRoomError({message: 'Custom room error'})

      expect(error.message).to.equal('Custom room error')
      expect(error.name).to.equal('TransportRoomError')
      expect(error.room).to.be.undefined
      expect(error.operation).to.be.undefined
    })
  })

  describe('TransportRoomTimeoutError', () => {
    it('should have message for join timeout', () => {
      const error = new TransportRoomTimeoutError('task-room-123', 'join', 2000)

      expect(error.message).to.equal("Join room 'task-room-123' timed out after 2000ms")
    })

    it('should have message for leave timeout', () => {
      const error = new TransportRoomTimeoutError('task-room-123', 'leave', 2000)

      expect(error.message).to.equal("Leave room 'task-room-123' timed out after 2000ms")
    })

    it('should store room property', () => {
      const error = new TransportRoomTimeoutError('task-room-123', 'join', 2000)

      expect(error.room).to.equal('task-room-123')
    })

    it('should store operation property', () => {
      const error = new TransportRoomTimeoutError('task-room-123', 'join', 2000)

      expect(error.operation).to.equal('join')
    })

    it('should store timeoutMs property', () => {
      const error = new TransportRoomTimeoutError('task-room-123', 'join', 2000)

      expect(error.timeoutMs).to.equal(2000)
    })

    it('should have correct name', () => {
      const error = new TransportRoomTimeoutError('task-room-123', 'join', 2000)

      expect(error.name).to.equal('TransportRoomTimeoutError')
    })

    it('should be an instance of TransportError', () => {
      const error = new TransportRoomTimeoutError('task-room-123', 'join', 2000)

      expect(error).to.be.instanceOf(TransportError)
    })

    it('should accept custom message via options', () => {
      const error = new TransportRoomTimeoutError({message: 'Custom room timeout error'})

      expect(error.message).to.equal('Custom room timeout error')
      expect(error.name).to.equal('TransportRoomTimeoutError')
      expect(error.room).to.be.undefined
      expect(error.operation).to.be.undefined
      expect(error.timeoutMs).to.be.undefined
    })
  })
})
