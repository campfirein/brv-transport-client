import {expect} from 'chai'

import {InstanceInfo} from '../../../../src/core/domain/entities/instance-info.js'
import {InvalidInstanceDataError} from '../../../../src/core/domain/errors/connection-error.js'

describe('InstanceInfo', () => {
  describe('create()', () => {
    it('should create instance with required fields', () => {
      const info = InstanceInfo.create({pid: 1234, port: 9847})

      expect(info.pid).to.equal(1234)
      expect(info.port).to.equal(9847)
      expect(info.getStartedAt()).to.be.instanceOf(Date)
    })

    it('should set startedAt to current time', () => {
      const before = Date.now()
      const info = InstanceInfo.create({pid: 1234, port: 9847})
      const after = Date.now()

      expect(info.getStartedAt().getTime()).to.be.at.least(before)
      expect(info.getStartedAt().getTime()).to.be.at.most(after)
    })

    it('should return defensive copy of startedAt to prevent mutation', () => {
      const info = InstanceInfo.create({pid: 1234, port: 9847})
      const originalTime = info.getStartedAt().getTime()

      // Attempt to mutate the returned Date
      const date = info.getStartedAt()
      date.setTime(0)

      // Verify internal state is unchanged
      expect(info.getStartedAt().getTime()).to.equal(originalTime)
    })
  })

  describe('getTransportUrl()', () => {
    it('should return correct URL with 127.0.0.1', () => {
      const info = InstanceInfo.create({pid: 1234, port: 9847})

      expect(info.getTransportUrl()).to.equal('http://127.0.0.1:9847')
    })

    it('should use the correct port', () => {
      const info = InstanceInfo.create({pid: 1234, port: 3000})

      expect(info.getTransportUrl()).to.equal('http://127.0.0.1:3000')
    })
  })

  describe('fromJson()', () => {
    it('should create instance from valid JSON', () => {
      const json = {
        pid: 1234,
        port: 9847,
        startedAt: 1704067200000, // 2024-01-01T00:00:00Z
      }

      const info = InstanceInfo.fromJson(json)

      expect(info.pid).to.equal(1234)
      expect(info.port).to.equal(9847)
      expect(info.getStartedAt().getTime()).to.equal(1704067200000)
    })

    describe('validation', () => {
      it('should throw InvalidInstanceDataError for null input', () => {
        expect(() => InstanceInfo.fromJson(null as never)).to.throw(InvalidInstanceDataError)
      })

      it('should throw InvalidInstanceDataError for non-object input', () => {
        expect(() => InstanceInfo.fromJson('string' as never)).to.throw(InvalidInstanceDataError)
      })

      it('should throw InvalidInstanceDataError for missing pid', () => {
        const json = {port: 9847, startedAt: 1704067200000}
        expect(() => InstanceInfo.fromJson(json as never)).to.throw(InvalidInstanceDataError, 'pid')
      })

      it('should throw InvalidInstanceDataError for non-number pid', () => {
        const json = {pid: 'abc', port: 9847, startedAt: 1704067200000}
        expect(() => InstanceInfo.fromJson(json as never)).to.throw(InvalidInstanceDataError, 'pid')
      })

      it('should throw InvalidInstanceDataError for negative pid', () => {
        const json = {pid: -1, port: 9847, startedAt: 1704067200000}
        expect(() => InstanceInfo.fromJson(json as never)).to.throw(InvalidInstanceDataError, 'pid')
      })

      it('should throw InvalidInstanceDataError for invalid port', () => {
        const json = {pid: 1234, port: 99999, startedAt: 1704067200000}
        expect(() => InstanceInfo.fromJson(json as never)).to.throw(InvalidInstanceDataError, 'port')
      })

      it('should throw InvalidInstanceDataError for zero port', () => {
        const json = {pid: 1234, port: 0, startedAt: 1704067200000}
        expect(() => InstanceInfo.fromJson(json as never)).to.throw(InvalidInstanceDataError, 'port')
      })

      // Boundary value tests for port
      it('should accept port 1 (minimum valid port)', () => {
        const json = {pid: 1234, port: 1, startedAt: 1704067200000}
        const info = InstanceInfo.fromJson(json)
        expect(info.port).to.equal(1)
      })

      it('should accept port 65535 (maximum valid port)', () => {
        const json = {pid: 1234, port: 65535, startedAt: 1704067200000}
        const info = InstanceInfo.fromJson(json)
        expect(info.port).to.equal(65535)
      })

      it('should throw InvalidInstanceDataError for port 65536 (above maximum)', () => {
        const json = {pid: 1234, port: 65536, startedAt: 1704067200000}
        expect(() => InstanceInfo.fromJson(json as never)).to.throw(InvalidInstanceDataError, 'port')
      })

      it('should throw InvalidInstanceDataError for negative port', () => {
        const json = {pid: 1234, port: -1, startedAt: 1704067200000}
        expect(() => InstanceInfo.fromJson(json as never)).to.throw(InvalidInstanceDataError, 'port')
      })

      it('should throw InvalidInstanceDataError for non-number startedAt', () => {
        const json = {pid: 1234, port: 9847, startedAt: 'invalid'}
        expect(() => InstanceInfo.fromJson(json as never)).to.throw(InvalidInstanceDataError, 'startedAt')
      })

      it('should include field name and value in error', () => {
        const json = {pid: 'invalid', port: 9847, startedAt: 1704067200000}
        try {
          InstanceInfo.fromJson(json as never)
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).to.be.instanceOf(InvalidInstanceDataError)
          const invalidError = error as InvalidInstanceDataError
          expect(invalidError.field).to.equal('pid')
          expect(invalidError.value).to.equal('invalid')
        }
      })
    })
  })

  describe('toJson()', () => {
    it('should serialize to correct JSON format', () => {
      const info = InstanceInfo.fromJson({
        pid: 1234,
        port: 9847,
        startedAt: 1704067200000,
      })

      const json = info.toJson()

      expect(json).to.deep.equal({
        pid: 1234,
        port: 9847,
        startedAt: 1704067200000,
      })
    })
  })

  describe('fromJson() / toJson() roundtrip', () => {
    it('should preserve all data through serialization cycle', () => {
      const original = InstanceInfo.create({
        pid: 1234,
        port: 9847,
      })

      const json = original.toJson()
      const restored = InstanceInfo.fromJson(json)

      expect(restored.pid).to.equal(original.pid)
      expect(restored.port).to.equal(original.port)
      expect(restored.getStartedAt().getTime()).to.equal(original.getStartedAt().getTime())
    })
  })
})
