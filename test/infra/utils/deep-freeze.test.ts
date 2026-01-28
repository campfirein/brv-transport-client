import {describe, it} from 'mocha'
import {expect} from 'chai'
import {deepFreeze} from '../../../infra/utils/deep-freeze.js'

describe('deepFreeze', () => {
  describe('basic functionality', () => {
    it('should freeze top-level object', () => {
      const obj = {a: 1, b: 2}
      const frozen = deepFreeze(obj)
      expect(Object.isFrozen(frozen)).to.be.true
    })

    it('should freeze nested objects', () => {
      const obj = {
        top: 1,
        nested: {
          inner: 2,
        },
      }
      const frozen = deepFreeze(obj)
      expect(Object.isFrozen(frozen)).to.be.true
      expect(Object.isFrozen(frozen.nested)).to.be.true
    })

    it('should freeze deeply nested objects', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              value: 42,
            },
          },
        },
      }
      const frozen = deepFreeze(obj)
      expect(Object.isFrozen(frozen.level1)).to.be.true
      expect(Object.isFrozen(frozen.level1.level2)).to.be.true
      expect(Object.isFrozen(frozen.level1.level2.level3)).to.be.true
    })

    it('should freeze arrays', () => {
      const obj = {
        items: [1, 2, 3],
      }
      const frozen = deepFreeze(obj)
      expect(Object.isFrozen(frozen.items)).to.be.true
    })

    it('should freeze nested arrays', () => {
      const obj = {
        matrix: [[1, 2], [3, 4]],
      }
      const frozen = deepFreeze(obj)
      expect(Object.isFrozen(frozen.matrix)).to.be.true
      expect(Object.isFrozen(frozen.matrix[0])).to.be.true
      expect(Object.isFrozen(frozen.matrix[1])).to.be.true
    })
  })

  describe('edge cases', () => {
    it('should handle null', () => {
      const frozen = deepFreeze(null)
      expect(frozen).to.be.null
    })

    it('should handle undefined', () => {
      const frozen = deepFreeze(undefined)
      expect(frozen).to.be.undefined
    })

    it('should handle primitives', () => {
      expect(deepFreeze(42)).to.equal(42)
      expect(deepFreeze('string')).to.equal('string')
      expect(deepFreeze(true)).to.equal(true)
    })

    it('should handle objects with null values', () => {
      const obj = {a: null, b: undefined}
      const frozen = deepFreeze(obj)
      expect(Object.isFrozen(frozen)).to.be.true
      expect(frozen.a).to.be.null
      expect(frozen.b).to.be.undefined
    })

    it('should handle circular references', () => {
      type CircularObj = {a: number; self?: CircularObj}
      const obj: CircularObj = {a: 1}
      obj.self = obj
      const frozen = deepFreeze(obj)
      expect(Object.isFrozen(frozen)).to.be.true
      expect(frozen.self).to.equal(frozen)
    })

    it('should return same reference', () => {
      const obj = {a: 1}
      const frozen = deepFreeze(obj)
      expect(frozen).to.equal(obj)
    })
  })

  describe('immutability verification', () => {
    it('should prevent modification of top-level properties', () => {
      const obj = {a: 1}
      const frozen = deepFreeze(obj)

      // In strict mode, this throws TypeError
      expect(() => {
        ;(frozen as {a: number}).a = 999
      }).to.throw(TypeError, /Cannot assign to read only property/)
      expect(frozen.a).to.equal(1) // Value unchanged
    })

    it('should prevent modification of nested properties', () => {
      const obj = {
        nested: {
          value: 42,
        },
      }
      const frozen = deepFreeze(obj)

      // Attempt to modify nested value throws TypeError
      expect(() => {
        ;(frozen.nested as {value: number}).value = 999
      }).to.throw(TypeError, /Cannot assign to read only property/)
      expect(frozen.nested.value).to.equal(42) // Value unchanged
    })

    it('should prevent adding new properties', () => {
      const obj: {a: number; b?: number} = {a: 1}
      const frozen = deepFreeze(obj)

      // Attempt to add property throws TypeError
      expect(() => {
        frozen.b = 2
      }).to.throw(TypeError, /Cannot add property/)
      expect(frozen.b).to.be.undefined // Property not added
    })

    it('should prevent array mutation', () => {
      const obj = {
        items: [1, 2, 3],
      }
      const frozen = deepFreeze(obj)

      // Attempt to push throws TypeError
      const originalLength = frozen.items.length
      expect(() => {
        frozen.items.push(4)
      }).to.throw(TypeError)
      expect(frozen.items.length).to.equal(originalLength)
    })
  })

  describe('real-world use case: socketOptions', () => {
    it('should deeply freeze Socket.IO options', () => {
      const config = {
        timeout: 5000,
        socketOptions: {
          path: '/socket.io',
          auth: {
            token: 'secret',
          },
          extraHeaders: {
            'X-Custom': 'value',
          },
        },
      }

      const frozen = deepFreeze(config)

      // Verify all levels are frozen
      expect(Object.isFrozen(frozen)).to.be.true
      expect(Object.isFrozen(frozen.socketOptions)).to.be.true
      expect(Object.isFrozen(frozen.socketOptions.auth)).to.be.true
      expect(Object.isFrozen(frozen.socketOptions.extraHeaders)).to.be.true

      // Attempt modifications throw TypeErrors
      expect(() => {
        ;(frozen.socketOptions as {path: string}).path = '/evil'
      }).to.throw(TypeError, /Cannot assign to read only property/)
      expect(frozen.socketOptions.path).to.equal('/socket.io')

      expect(() => {
        ;(frozen.socketOptions.auth as {token: string}).token = 'hacked'
      }).to.throw(TypeError, /Cannot assign to read only property/)
      expect(frozen.socketOptions.auth.token).to.equal('secret')
    })
  })
})
