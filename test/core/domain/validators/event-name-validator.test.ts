import {describe, it} from 'mocha'
import {expect} from 'chai'
import {validateEventName} from '../../../../src/core/domain/validators/event-name-validator.js'
import {InvalidEventNameError} from '../../../../src/core/domain/errors/transport-error.js'

describe('validateEventName', () => {
  describe('valid event names', () => {
    it('should accept valid event name', () => {
      expect(() => validateEventName('task:create')).to.not.throw()
    })

    it('should accept event name with spaces', () => {
      expect(() => validateEventName('  task:create  ')).to.not.throw()
    })

    it('should accept single character event name', () => {
      expect(() => validateEventName('a')).to.not.throw()
    })

    it('should accept event name with special characters', () => {
      expect(() => validateEventName('task:create:sub-task')).to.not.throw()
    })
  })

  describe('boundary values', () => {
    it('should accept event name with exactly 255 characters', () => {
      const eventName = 'a'.repeat(255)
      expect(() => validateEventName(eventName)).to.not.throw()
    })

    it('should accept event name with exactly 254 characters', () => {
      const eventName = 'a'.repeat(254)
      expect(() => validateEventName(eventName)).to.not.throw()
    })

    it('should reject event name with exactly 256 characters', () => {
      const eventName = 'a'.repeat(256)
      expect(() => validateEventName(eventName)).to.throw(
        InvalidEventNameError,
        'event name cannot exceed 255 characters',
      )
    })

    it('should reject event name with 257 characters', () => {
      const eventName = 'a'.repeat(257)
      expect(() => validateEventName(eventName)).to.throw(
        InvalidEventNameError,
        'event name cannot exceed 255 characters',
      )
    })
  })

  describe('invalid event names', () => {
    it('should reject empty string', () => {
      expect(() => validateEventName('')).to.throw(InvalidEventNameError, 'event name cannot be empty')
    })

    it('should reject whitespace-only string', () => {
      expect(() => validateEventName('   ')).to.throw(InvalidEventNameError, 'event name cannot be empty')
    })

    it('should reject null', () => {
      expect(() => validateEventName(null as any)).to.throw(InvalidEventNameError, 'event name must be a string')
    })

    it('should reject undefined', () => {
      expect(() => validateEventName(undefined as any)).to.throw(InvalidEventNameError, 'event name must be a string')
    })

    it('should reject number', () => {
      expect(() => validateEventName(123 as any)).to.throw(InvalidEventNameError, 'event name must be a string')
    })

    it('should reject object', () => {
      expect(() => validateEventName({} as any)).to.throw(InvalidEventNameError, 'event name must be a string')
    })

    it('should reject array', () => {
      expect(() => validateEventName([] as any)).to.throw(InvalidEventNameError, 'event name must be a string')
    })
  })
})
