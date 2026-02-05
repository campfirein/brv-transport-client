import {expect} from 'chai'
import {mkdtempSync, realpathSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {DAEMON_INSTANCE_FILE, HEARTBEAT_FILE} from '../../src/constants.js'
import {discoverDaemon} from '../../src/infra/daemon-discovery-sync.js'

describe('daemon-discovery-sync', () => {
  let testDir: string

  beforeEach(() => {
    testDir = realpathSync(mkdtempSync(join(tmpdir(), 'brv-discovery-sync-test-')))
  })

  afterEach(() => {
    rmSync(testDir, {force: true, recursive: true})
  })

  describe('discoverDaemon()', () => {
    it('should return running=true when daemon is healthy', () => {
      writeFileSync(
        join(testDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({pid: process.pid, port: 37_847, startedAt: Date.now(), version: '1.6.0'}),
      )
      writeFileSync(join(testDir, HEARTBEAT_FILE), String(Date.now()))

      const status = discoverDaemon({dataDir: testDir})

      expect(status.running).to.be.true
      if (status.running) {
        expect(status.pid).to.equal(process.pid)
        expect(status.port).to.equal(37_847)
      }
    })

    it('should return no_instance when daemon.json is missing', () => {
      const status = discoverDaemon({dataDir: testDir})

      expect(status.running).to.be.false
      if (!status.running) {
        expect(status.reason).to.equal('no_instance')
      }
    })

    it('should return pid_dead when PID is not alive', () => {
      writeFileSync(
        join(testDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({pid: 999_999_999, port: 37_847, startedAt: Date.now(), version: '1.6.0'}),
      )

      const status = discoverDaemon({dataDir: testDir})

      expect(status.running).to.be.false
      if (!status.running) {
        expect(status.reason).to.equal('pid_dead')
      }
    })

    it('should return heartbeat_stale when heartbeat is missing', () => {
      writeFileSync(
        join(testDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({pid: process.pid, port: 37_847, startedAt: Date.now(), version: '1.6.0'}),
      )
      // No heartbeat file written

      const status = discoverDaemon({dataDir: testDir})

      expect(status.running).to.be.false
      if (!status.running) {
        expect(status.reason).to.equal('heartbeat_stale')
      }
    })

    it('should return heartbeat_stale when heartbeat is old', () => {
      writeFileSync(
        join(testDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({pid: process.pid, port: 37_847, startedAt: Date.now(), version: '1.6.0'}),
      )
      writeFileSync(join(testDir, HEARTBEAT_FILE), String(Date.now() - 20_000))

      const status = discoverDaemon({dataDir: testDir})

      expect(status.running).to.be.false
      if (!status.running) {
        expect(status.reason).to.equal('heartbeat_stale')
      }
    })

    it('should return version_mismatch when expectedVersion differs', () => {
      writeFileSync(
        join(testDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({pid: process.pid, port: 37_847, startedAt: Date.now(), version: '1.5.0'}),
      )
      writeFileSync(join(testDir, HEARTBEAT_FILE), String(Date.now()))

      const status = discoverDaemon({dataDir: testDir, expectedVersion: '1.6.0'})

      expect(status.running).to.be.false
      if (!status.running && status.reason === 'version_mismatch') {
        expect(status.actualVersion).to.equal('1.5.0')
        expect(status.expectedVersion).to.equal('1.6.0')
      }
    })

    it('should return running when expectedVersion matches', () => {
      writeFileSync(
        join(testDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({pid: process.pid, port: 37_847, startedAt: Date.now(), version: '1.6.0'}),
      )
      writeFileSync(join(testDir, HEARTBEAT_FILE), String(Date.now()))

      const status = discoverDaemon({dataDir: testDir, expectedVersion: '1.6.0'})

      expect(status.running).to.be.true
    })

    it('should skip version check when expectedVersion is not provided', () => {
      writeFileSync(
        join(testDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({pid: process.pid, port: 37_847, startedAt: Date.now(), version: '1.5.0'}),
      )
      writeFileSync(join(testDir, HEARTBEAT_FILE), String(Date.now()))

      const status = discoverDaemon({dataDir: testDir})

      expect(status.running).to.be.true
    })

    it('should return no_instance for corrupted daemon.json', () => {
      writeFileSync(join(testDir, DAEMON_INSTANCE_FILE), 'not-json')

      const status = discoverDaemon({dataDir: testDir})

      expect(status.running).to.be.false
      if (!status.running) {
        expect(status.reason).to.equal('no_instance')
      }
    })

    it('should return no_instance for invalid schema', () => {
      writeFileSync(join(testDir, DAEMON_INSTANCE_FILE), JSON.stringify({foo: 'bar'}))

      const status = discoverDaemon({dataDir: testDir})

      expect(status.running).to.be.false
      if (!status.running) {
        expect(status.reason).to.equal('no_instance')
      }
    })
  })
})
