import {expect} from 'chai'
import {existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {SPAWN_LOCK_FILE} from '../../src/constants.js'
import {SpawnLock} from '../../src/infra/spawn-lock.js'

describe('SpawnLock', () => {
  let testDir: string

  beforeEach(() => {
    testDir = realpathSync(mkdtempSync(join(tmpdir(), 'brv-spawn-lock-test-')))
  })

  afterEach(() => {
    rmSync(testDir, {force: true, recursive: true})
  })

  describe('acquire()', () => {
    it('should acquire when no lock exists', () => {
      const lock = new SpawnLock({dataDir: testDir})
      const result = lock.acquire()

      expect(result.acquired).to.be.true
    })

    it('should write lock file on acquire', () => {
      const lock = new SpawnLock({dataDir: testDir})
      lock.acquire()

      expect(existsSync(join(testDir, SPAWN_LOCK_FILE))).to.be.true
    })

    it('should fail when lock is held by alive process', () => {
      // Write a lock held by current process
      writeFileSync(
        join(testDir, SPAWN_LOCK_FILE),
        JSON.stringify({pid: process.pid, timestamp: Date.now()}),
      )

      const lock = new SpawnLock({dataDir: testDir})
      const result = lock.acquire()

      expect(result.acquired).to.be.false
      if (!result.acquired) {
        expect(result.reason).to.equal('held_by_another_process')
      }
    })

    it('should succeed when lock is held by dead process', () => {
      writeFileSync(
        join(testDir, SPAWN_LOCK_FILE),
        JSON.stringify({pid: 999_999_999, timestamp: Date.now()}),
      )

      const lock = new SpawnLock({dataDir: testDir})
      const result = lock.acquire()

      expect(result.acquired).to.be.true
    })

    it('should succeed when lock timestamp is stale (>30s)', () => {
      writeFileSync(
        join(testDir, SPAWN_LOCK_FILE),
        JSON.stringify({pid: process.pid, timestamp: Date.now() - 31_000}),
      )

      const lock = new SpawnLock({dataDir: testDir})
      const result = lock.acquire()

      expect(result.acquired).to.be.true
    })

    it('should succeed when lock file is corrupted', () => {
      writeFileSync(join(testDir, SPAWN_LOCK_FILE), 'not-json')

      const lock = new SpawnLock({dataDir: testDir})
      const result = lock.acquire()

      expect(result.acquired).to.be.true
    })
  })

  describe('release()', () => {
    it('should delete lock file on release', () => {
      const lock = new SpawnLock({dataDir: testDir})
      lock.acquire()

      expect(existsSync(join(testDir, SPAWN_LOCK_FILE))).to.be.true

      lock.release()

      expect(existsSync(join(testDir, SPAWN_LOCK_FILE))).to.be.false
    })

    it('should be safe to call without acquiring', () => {
      const lock = new SpawnLock({dataDir: testDir})
      expect(() => lock.release()).to.not.throw()
    })

    it('should be safe to call multiple times', () => {
      const lock = new SpawnLock({dataDir: testDir})
      lock.acquire()
      lock.release()
      expect(() => lock.release()).to.not.throw()
    })
  })
})
