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

  it('should return daemon_outdated when client is newer than daemon', () => {
    writeFileSync(heartbeatPath, String(Date.now()))

    const result = checkDaemonHealth(process.pid, heartbeatPath, {
      daemonVersion: '1.5.0',
      clientVersion: '1.6.0',
    })

    expect(result.healthy).to.be.false
    if (!result.healthy && result.reason === 'daemon_outdated') {
      expect(result.daemonVersion).to.equal('1.5.0')
      expect(result.clientVersion).to.equal('1.6.0')
    } else {
      expect.fail(`expected daemon_outdated, got ${result.healthy ? 'healthy' : result.reason}`)
    }
  })

  it('should return healthy when client is older than daemon (loop-prevention regression)', () => {
    // Customer-bug regression: an old MCP child holding pre-upgrade version must
    // tolerate a newer daemon spawned by a peer client, instead of SIGTERMing it
    // back. Symmetric mismatch was the root cause of issue #583's ping-pong.
    writeFileSync(heartbeatPath, String(Date.now()))

    const result = checkDaemonHealth(process.pid, heartbeatPath, {
      daemonVersion: '1.6.0',
      clientVersion: '1.5.0',
    })

    expect(result.healthy).to.be.true
  })

  it('should return healthy when versions match', () => {
    writeFileSync(heartbeatPath, String(Date.now()))

    const result = checkDaemonHealth(process.pid, heartbeatPath, {
      daemonVersion: '1.6.0',
      clientVersion: '1.6.0',
    })

    expect(result.healthy).to.be.true
  })

  it('should skip version check when clientVersion is not provided', () => {
    writeFileSync(heartbeatPath, String(Date.now()))

    const result = checkDaemonHealth(process.pid, heartbeatPath, {
      daemonVersion: '1.5.0',
    })

    expect(result.healthy).to.be.true
  })

  it('should compare versions by semver, not lexicographic order', () => {
    // Lexicographic compare puts '10' < '9'. Semver puts 9 < 10. The fix must use
    // numeric component comparison so a 3.10.0 client correctly beats a 3.9.0 daemon.
    writeFileSync(heartbeatPath, String(Date.now()))

    const result = checkDaemonHealth(process.pid, heartbeatPath, {
      daemonVersion: '3.9.0',
      clientVersion: '3.10.0',
    })

    expect(result.healthy).to.be.false
    if (!result.healthy) {
      expect(result.reason).to.equal('daemon_outdated')
    }
  })

  it('should ignore prerelease tags when comparing for daemon-outdated gate', () => {
    // Prerelease tags must not drive SIGTERMs: a 3.10.0-beta.1 client and a 3.10.0
    // daemon are functionally compatible. Treating them as different would
    // re-introduce the loop scenario for prerelease releases.
    writeFileSync(heartbeatPath, String(Date.now()))

    const result = checkDaemonHealth(process.pid, heartbeatPath, {
      daemonVersion: '3.10.0',
      clientVersion: '3.10.0-beta.1',
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

  it('should check heartbeat before version (heartbeat_stale takes priority over daemon_outdated)', () => {
    // Stale heartbeat + daemon outdated → should return heartbeat_stale
    writeFileSync(heartbeatPath, String(Date.now() - 20_000))

    const result = checkDaemonHealth(process.pid, heartbeatPath, {
      daemonVersion: '1.5.0',
      clientVersion: '1.6.0',
    })

    expect(result.healthy).to.be.false
    if (!result.healthy) {
      expect(result.reason).to.equal('heartbeat_stale')
    }
  })
})
