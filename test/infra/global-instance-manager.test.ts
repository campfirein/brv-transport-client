import {expect} from 'chai'
import {existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {DAEMON_INSTANCE_FILE} from '../../src/constants.js'
import {GlobalInstanceManager} from '../../src/infra/global-instance-manager.js'

describe('GlobalInstanceManager', () => {
  let testDir: string

  beforeEach(() => {
    testDir = realpathSync(mkdtempSync(join(tmpdir(), 'brv-gim-test-')))
  })

  afterEach(() => {
    rmSync(testDir, {force: true, recursive: true})
  })

  describe('acquire()', () => {
    it('should acquire when no instance exists', () => {
      const manager = new GlobalInstanceManager({dataDir: testDir})
      const result = manager.acquire(37_847, '1.6.0')

      expect(result.acquired).to.be.true
      if (result.acquired) {
        expect(result.instance.pid).to.equal(process.pid)
        expect(result.instance.port).to.equal(37_847)
        expect(result.instance.version).to.equal('1.6.0')
      }
    })

    it('should write daemon.json atomically', () => {
      const manager = new GlobalInstanceManager({dataDir: testDir})
      manager.acquire(37_847, '1.6.0')

      expect(existsSync(join(testDir, DAEMON_INSTANCE_FILE))).to.be.true
    })

    it('should fail when PID is alive', () => {
      const manager = new GlobalInstanceManager({dataDir: testDir})
      // First acquire succeeds
      manager.acquire(37_847, '1.6.0')

      // Second acquire should fail (current process PID is alive)
      const result = manager.acquire(37_848, '1.6.0')
      expect(result.acquired).to.be.false
      if (!result.acquired) {
        expect(result.reason).to.equal('already_running')
      }
    })

    it('should succeed when existing PID is dead', () => {
      // Write stale instance with dead PID
      writeFileSync(
        join(testDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({pid: 999_999_999, port: 37_847, startedAt: Date.now(), version: '1.5.0'}),
      )

      const manager = new GlobalInstanceManager({dataDir: testDir})
      const result = manager.acquire(37_848, '1.6.0')

      expect(result.acquired).to.be.true
      if (result.acquired) {
        expect(result.instance.port).to.equal(37_848)
      }
    })
  })

  describe('load()', () => {
    it('should return undefined when no file exists', () => {
      const manager = new GlobalInstanceManager({dataDir: testDir})
      expect(manager.load()).to.be.undefined
    })

    it('should return instance info when file is valid', () => {
      const data = {pid: process.pid, port: 37_847, startedAt: Date.now(), version: '1.6.0'}
      writeFileSync(join(testDir, DAEMON_INSTANCE_FILE), JSON.stringify(data))

      const manager = new GlobalInstanceManager({dataDir: testDir})
      const loaded = manager.load()

      expect(loaded).to.not.be.undefined
      expect(loaded!.pid).to.equal(process.pid)
      expect(loaded!.port).to.equal(37_847)
      expect(loaded!.version).to.equal('1.6.0')
    })

    it('should return undefined for corrupted JSON', () => {
      writeFileSync(join(testDir, DAEMON_INSTANCE_FILE), 'not-json')

      const manager = new GlobalInstanceManager({dataDir: testDir})
      expect(manager.load()).to.be.undefined
    })

    it('should return undefined for invalid schema', () => {
      writeFileSync(join(testDir, DAEMON_INSTANCE_FILE), JSON.stringify({foo: 'bar'}))

      const manager = new GlobalInstanceManager({dataDir: testDir})
      expect(manager.load()).to.be.undefined
    })
  })

  describe('release()', () => {
    it('should delete daemon.json when PID matches', () => {
      const manager = new GlobalInstanceManager({dataDir: testDir})
      manager.acquire(37_847, '1.6.0')

      expect(existsSync(join(testDir, DAEMON_INSTANCE_FILE))).to.be.true

      manager.release()

      expect(existsSync(join(testDir, DAEMON_INSTANCE_FILE))).to.be.false
    })

    it('should not delete daemon.json when PID does not match', () => {
      // Write instance with different PID
      writeFileSync(
        join(testDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({pid: 999_999_999, port: 37_847, startedAt: Date.now(), version: '1.6.0'}),
      )

      const manager = new GlobalInstanceManager({dataDir: testDir})
      manager.release()

      // File should still exist (different PID)
      expect(existsSync(join(testDir, DAEMON_INSTANCE_FILE))).to.be.true
    })

    it('should not throw when file does not exist', () => {
      const manager = new GlobalInstanceManager({dataDir: testDir})
      expect(() => manager.release()).to.not.throw()
    })
  })
})
