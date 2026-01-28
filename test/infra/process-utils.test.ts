import {expect} from 'chai'

import {isProcessAlive} from '../../infra/process-utils.js'

describe('process-utils', () => {
  describe('isProcessAlive()', () => {
    it('should return true for current process', () => {
      const result = isProcessAlive(process.pid)

      expect(result).to.be.true
    })

    it('should return false for non-existent PID', () => {
      // Use a very high PID that is unlikely to exist
      const result = isProcessAlive(999999999)

      expect(result).to.be.false
    })

    it('should handle PID 0', () => {
      // PID 0 is the kernel scheduler, behavior varies by OS
      const result = isProcessAlive(0)

      // Just verify it returns a boolean without throwing
      expect(typeof result).to.equal('boolean')
    })

    it('should handle negative PID', () => {
      // On Unix, negative PIDs refer to process groups
      // The behavior varies by OS, so we just verify it doesn't throw
      const result = isProcessAlive(-1)

      // Just verify it returns a boolean without throwing
      expect(typeof result).to.equal('boolean')
    })

    it('should handle PID 1 (init process)', () => {
      // PID 1 is always running but may require elevated permissions
      const result = isProcessAlive(1)

      // Just verify it returns a boolean without throwing
      expect(typeof result).to.equal('boolean')
    })
  })
})
