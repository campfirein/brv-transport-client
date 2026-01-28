import {describe, it} from 'mocha'
import {expect} from 'chai'
import {validateRoomName} from '../../../../core/domain/validators/room-name-validator.js'
import {InvalidRoomNameError} from '../../../../core/domain/errors/transport-error.js'

describe('validateRoomName', () => {
  describe('valid room names', () => {
    it('should accept valid room name', () => {
      expect(() => validateRoomName('my-room')).to.not.throw()
    })

    it('should accept room name with spaces', () => {
      expect(() => validateRoomName('  my-room  ')).to.not.throw()
    })

    it('should accept single character room name', () => {
      expect(() => validateRoomName('r')).to.not.throw()
    })

    it('should accept room name with special characters', () => {
      expect(() => validateRoomName('room:123:sub')).to.not.throw()
    })
  })

  describe('boundary values', () => {
    it('should accept room name with exactly 255 characters', () => {
      const roomName = 'r'.repeat(255)
      expect(() => validateRoomName(roomName)).to.not.throw()
    })

    it('should accept room name with exactly 254 characters', () => {
      const roomName = 'r'.repeat(254)
      expect(() => validateRoomName(roomName)).to.not.throw()
    })

    it('should reject room name with exactly 256 characters', () => {
      const roomName = 'r'.repeat(256)
      expect(() => validateRoomName(roomName)).to.throw(InvalidRoomNameError, 'room name cannot exceed 255 characters')
    })

    it('should reject room name with 257 characters', () => {
      const roomName = 'r'.repeat(257)
      expect(() => validateRoomName(roomName)).to.throw(InvalidRoomNameError, 'room name cannot exceed 255 characters')
    })
  })

  describe('invalid room names', () => {
    it('should reject empty string', () => {
      expect(() => validateRoomName('')).to.throw(InvalidRoomNameError, 'room name cannot be empty')
    })

    it('should reject whitespace-only string', () => {
      expect(() => validateRoomName('   ')).to.throw(InvalidRoomNameError, 'room name cannot be empty')
    })

    it('should reject null', () => {
      expect(() => validateRoomName(null as any)).to.throw(InvalidRoomNameError, 'room name must be a string')
    })

    it('should reject undefined', () => {
      expect(() => validateRoomName(undefined as any)).to.throw(InvalidRoomNameError, 'room name must be a string')
    })

    it('should reject number', () => {
      expect(() => validateRoomName(123 as any)).to.throw(InvalidRoomNameError, 'room name must be a string')
    })

    it('should reject object', () => {
      expect(() => validateRoomName({} as any)).to.throw(InvalidRoomNameError, 'room name must be a string')
    })

    it('should reject array', () => {
      expect(() => validateRoomName([] as any)).to.throw(InvalidRoomNameError, 'room name must be a string')
    })
  })
})
