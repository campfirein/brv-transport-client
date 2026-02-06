import {expect} from 'chai'
import {mkdtempSync, realpathSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {checkDaemonHealth} from '../../src/infra/daemon-health.js'

describe('checkDaemonHealth()', () => {
  let testDir: string
  let heartbeatPath: string

  beforeEach(() => {
    testDir = realpathSync(mkdtempSync(join(tmpdir(), 'brv-daemon-health-test-')))
    heartbeatPath = join(testDir, 'heartbeat')
  })

  afterEach(() => {
    rmSync(testDir, {force: true, recursive: true})
  })

  it('should return healthy when PID is alive and heartbeat is fresh', () => {
    writeFileSync(heartbeatPath, String(Date.now()))

    const result = checkDaemonHealth(process.pid, heartbeatPath)

    expect(result.healthy).to.be.true
  })

  it('should return pid_dead when PID is not alive', () => {
    writeFileSync(heartbeatPath, String(Date.now()))

    const result = checkDaemonHealth(999_999_999, heartbeatPath)

    expect(result.healthy).to.be.false
    if (!result.healthy) {
      expect(result.reason).to.equal('pid_dead')
    }
  })

  it('should return heartbeat_stale when heartbeat is missing', () => {
    // No heartbeat file written
    const result = checkDaemonHealth(process.pid, heartbeatPath)

    expect(result.healthy).to.be.false
    if (!result.healthy) {
      expect(result.reason).to.equal('heartbeat_stale')
    }
  })

  it('should return heartbeat_stale when heartbeat is old', () => {
    writeFileSync(heartbeatPath, String(Date.now() - 20_000))

    const result = checkDaemonHealth(process.pid, heartbeatPath)

    expect(result.healthy).to.be.false
    if (!result.healthy) {
      expect(result.reason).to.equal('heartbeat_stale')
    }
  })

  it('should return version_mismatch when versions differ', () => {
    writeFileSync(heartbeatPath, String(Date.now()))

    const result = checkDaemonHealth(process.pid, heartbeatPath, {
      actualVersion: '1.5.0',
      expectedVersion: '1.6.0',
    })

    expect(result.healthy).to.be.false
    if (!result.healthy && result.reason === 'version_mismatch') {
      expect(result.actualVersion).to.equal('1.5.0')
      expect(result.expectedVersion).to.equal('1.6.0')
    }
  })

  it('should return healthy when versions match', () => {
    writeFileSync(heartbeatPath, String(Date.now()))

    const result = checkDaemonHealth(process.pid, heartbeatPath, {
      actualVersion: '1.6.0',
      expectedVersion: '1.6.0',
    })

    expect(result.healthy).to.be.true
  })

  it('should skip version check when expectedVersion is not provided', () => {
    writeFileSync(heartbeatPath, String(Date.now()))

    const result = checkDaemonHealth(process.pid, heartbeatPath, {
      actualVersion: '1.5.0',
    })

    expect(result.healthy).to.be.true
  })

  it('should check PID before heartbeat (pid_dead takes priority)', () => {
    // No heartbeat file + dead PID → should return pid_dead, not heartbeat_stale
    const result = checkDaemonHealth(999_999_999, heartbeatPath)

    expect(result.healthy).to.be.false
    if (!result.healthy) {
      expect(result.reason).to.equal('pid_dead')
    }
  })

  it('should check heartbeat before version (heartbeat_stale takes priority)', () => {
    // Stale heartbeat + version mismatch → should return heartbeat_stale
    writeFileSync(heartbeatPath, String(Date.now() - 20_000))

    const result = checkDaemonHealth(process.pid, heartbeatPath, {
      actualVersion: '1.5.0',
      expectedVersion: '1.6.0',
    })

    expect(result.healthy).to.be.false
    if (!result.healthy) {
      expect(result.reason).to.equal('heartbeat_stale')
    }
  })
})
