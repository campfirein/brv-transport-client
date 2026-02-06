import {expect} from 'chai'

import {
  ConnectionError,
  ConnectionFailedError,
  ConnectionTimeoutError,
  InstanceCrashedError,
  NoInstanceRunningError,
} from '../../../../src/core/domain/errors/connection-error.js'

describe('Connection Errors', () => {
  describe('ConnectionError', () => {
    it('should create error with correct message', () => {
      const error = new ConnectionError('Test error message')

      expect(error.message).to.equal('Test error message')
    })

    it('should have correct name', () => {
      const error = new ConnectionError('Test')

      expect(error.name).to.equal('ConnectionError')
    })

    it('should be an instance of Error', () => {
      const error = new ConnectionError('Test')

      expect(error).to.be.instanceOf(Error)
    })
  })

  describe('NoInstanceRunningError', () => {
    it('should have predefined message', () => {
      const error = new NoInstanceRunningError()

      expect(error.message).to.equal('No ByteRover instance is running. Start one with: brv')
    })

    it('should have correct name', () => {
      const error = new NoInstanceRunningError()

      expect(error.name).to.equal('NoInstanceRunningError')
    })

    it('should be an instance of ConnectionError', () => {
      const error = new NoInstanceRunningError()

      expect(error).to.be.instanceOf(ConnectionError)
    })

    it('should accept custom message via options', () => {
      const error = new NoInstanceRunningError({message: 'Custom no instance error'})

      expect(error.message).to.equal('Custom no instance error')
      expect(error.name).to.equal('NoInstanceRunningError')
    })
  })

  describe('InstanceCrashedError', () => {
    it('should have message without project root', () => {
      const error = new InstanceCrashedError()

      expect(error.message).to.equal('ByteRover instance has crashed. Please restart with: brv')
    })

    it('should include project root in message when provided', () => {
      const error = new InstanceCrashedError('/home/user/project')

      expect(error.message).to.equal('ByteRover instance in /home/user/project has crashed. Please restart with: brv')
    })

    it('should have correct name', () => {
      const error = new InstanceCrashedError()

      expect(error.name).to.equal('InstanceCrashedError')
    })

    it('should be an instance of ConnectionError', () => {
      const error = new InstanceCrashedError()

      expect(error).to.be.instanceOf(ConnectionError)
    })

    it('should accept custom message via options', () => {
      const error = new InstanceCrashedError({message: 'Custom instance crashed message'})

      expect(error.message).to.equal('Custom instance crashed message')
      expect(error.name).to.equal('InstanceCrashedError')
      expect(error.projectRoot).to.be.undefined
    })
  })

  describe('ConnectionFailedError', () => {
    it('should have message without port or original error', () => {
      const error = new ConnectionFailedError()

      expect(error.message).to.equal('Failed to connect to ByteRover instance')
    })

    it('should include port in message when provided', () => {
      const error = new ConnectionFailedError(49_847)

      expect(error.message).to.equal('Failed to connect to ByteRover instance on port 49847')
    })

    it('should include original error message when provided', () => {
      const originalError = new Error('Connection refused')
      const error = new ConnectionFailedError(49_847, originalError)

      expect(error.message).to.equal('Failed to connect to ByteRover instance on port 49847: Connection refused')
    })

    it('should store port property', () => {
      const error = new ConnectionFailedError(49_847)

      expect(error.port).to.equal(49_847)
    })

    it('should store originalError property', () => {
      const originalError = new Error('Connection refused')
      const error = new ConnectionFailedError(49_847, originalError)

      expect(error.originalError).to.equal(originalError)
    })

    it('should have correct name', () => {
      const error = new ConnectionFailedError()

      expect(error.name).to.equal('ConnectionFailedError')
    })

    it('should be an instance of ConnectionError', () => {
      const error = new ConnectionFailedError()

      expect(error).to.be.instanceOf(ConnectionError)
    })

    it('should accept custom message via options', () => {
      const error = new ConnectionFailedError({message: 'Custom connection failed message'})

      expect(error.message).to.equal('Custom connection failed message')
      expect(error.name).to.equal('ConnectionFailedError')
      expect(error.port).to.be.undefined
      expect(error.originalError).to.be.undefined
    })
  })

  describe('ConnectionTimeoutError', () => {
    it('should have message with timeout value', () => {
      const error = new ConnectionTimeoutError(5000)

      expect(error.message).to.equal('Connection timed out after 5000ms')
    })

    it('should store timeoutMs property', () => {
      const error = new ConnectionTimeoutError(5000)

      expect(error.timeoutMs).to.equal(5000)
    })

    it('should have correct name', () => {
      const error = new ConnectionTimeoutError(5000)

      expect(error.name).to.equal('ConnectionTimeoutError')
    })

    it('should be an instance of ConnectionError', () => {
      const error = new ConnectionTimeoutError(5000)

      expect(error).to.be.instanceOf(ConnectionError)
    })

    it('should accept custom message via options', () => {
      const error = new ConnectionTimeoutError({message: 'Custom timeout message'})

      expect(error.message).to.equal('Custom timeout message')
      expect(error.name).to.equal('ConnectionTimeoutError')
      expect(error.timeoutMs).to.be.undefined
    })
  })
})
