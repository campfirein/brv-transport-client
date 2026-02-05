import {expect} from 'chai'
import {mkdtempSync, realpathSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {isHeartbeatStale} from '../../src/infra/heartbeat-utils.js'

describe('heartbeat-utils', () => {
  let testDir: string

  beforeEach(() => {
    testDir = realpathSync(mkdtempSync(join(tmpdir(), 'brv-heartbeat-test-')))
  })

  afterEach(() => {
    rmSync(testDir, {force: true, recursive: true})
  })

  describe('isHeartbeatStale()', () => {
    it('should return false for a fresh heartbeat', () => {
      const filePath = join(testDir, 'heartbeat')
      writeFileSync(filePath, String(Date.now()))

      expect(isHeartbeatStale(filePath)).to.be.false
    })

    it('should return true for a stale heartbeat (older than default threshold)', () => {
      const filePath = join(testDir, 'heartbeat')
      writeFileSync(filePath, String(Date.now() - 20_000))

      expect(isHeartbeatStale(filePath)).to.be.true
    })

    it('should return true when file does not exist', () => {
      expect(isHeartbeatStale(join(testDir, 'nonexistent'))).to.be.true
    })

    it('should return true for non-numeric content', () => {
      const filePath = join(testDir, 'heartbeat')
      writeFileSync(filePath, 'not-a-number')

      expect(isHeartbeatStale(filePath)).to.be.true
    })

    it('should return true for negative timestamp', () => {
      const filePath = join(testDir, 'heartbeat')
      writeFileSync(filePath, '-1')

      expect(isHeartbeatStale(filePath)).to.be.true
    })

    it('should return true for empty file', () => {
      const filePath = join(testDir, 'heartbeat')
      writeFileSync(filePath, '')

      expect(isHeartbeatStale(filePath)).to.be.true
    })

    it('should respect custom threshold', () => {
      const filePath = join(testDir, 'heartbeat')
      // 5 seconds ago
      writeFileSync(filePath, String(Date.now() - 5000))

      // Default 15s threshold → not stale
      expect(isHeartbeatStale(filePath)).to.be.false

      // Custom 3s threshold → stale
      expect(isHeartbeatStale(filePath, 3000)).to.be.true
    })

    it('should handle future timestamp (clock skew) as stale', () => {
      const filePath = join(testDir, 'heartbeat')
      writeFileSync(filePath, String(Date.now() + 5000))

      expect(isHeartbeatStale(filePath)).to.be.true
    })
  })
})
