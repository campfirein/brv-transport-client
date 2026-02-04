import {expect} from 'chai'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {tmpdir} from 'node:os'

import {DaemonInstanceDiscovery} from '../../src/infra/daemon-instance-discovery.js'
import {BRV_DIR, DAEMON_INSTANCE_FILE, HEARTBEAT_FILE} from '../../src/constants.js'

describe('DaemonInstanceDiscovery', () => {
  let testDataDir: string

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDataDir = await fs.mkdtemp(path.join(tmpdir(), 'daemon-discovery-test-'))
  })

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(testDataDir, {recursive: true, force: true})
  })

  describe('discover()', () => {
    it('should discover healthy daemon (valid file + alive PID + fresh heartbeat)', async () => {
      const discovery = new DaemonInstanceDiscovery({dataDir: testDataDir})

      // Create valid daemon.json with current process PID
      await fs.writeFile(
        path.join(testDataDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({
          pid: process.pid,
          port: 9847,
          startedAt: Date.now(),
        }),
      )

      // Create fresh heartbeat
      await fs.writeFile(path.join(testDataDir, HEARTBEAT_FILE), String(Date.now()))

      // Discover from a dir without .brv/ → projectRoot should be undefined
      const result = await discovery.discover('/some/project')

      expect(result.found).to.be.true
      if (result.found) {
        expect(result.instance.pid).to.equal(process.pid)
        expect(result.instance.port).to.equal(9847)
        expect(result.projectRoot).to.be.undefined
      }
    })

    it('should find projectRoot by walking up to .brv/ directory', async () => {
      const discovery = new DaemonInstanceDiscovery({dataDir: testDataDir})

      // Create valid daemon.json + heartbeat
      await fs.writeFile(
        path.join(testDataDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({pid: process.pid, port: 9847, startedAt: Date.now()}),
      )
      await fs.writeFile(path.join(testDataDir, HEARTBEAT_FILE), String(Date.now()))

      // Create project structure: projectDir/.brv/ and projectDir/sub/deep/
      const projectDir = await fs.mkdtemp(path.join(testDataDir, 'project-'))
      await fs.mkdir(path.join(projectDir, BRV_DIR))
      const subDir = path.join(projectDir, 'sub', 'deep')
      await fs.mkdir(subDir, {recursive: true})

      // Discover from deep subdirectory → should walk up and find .brv/
      const result = await discovery.discover(subDir)

      expect(result.found).to.be.true
      if (result.found) {
        expect(result.projectRoot).to.equal(projectDir)
      }
    })

    it('should find projectRoot when .brv/ is in fromDir itself', async () => {
      const discovery = new DaemonInstanceDiscovery({dataDir: testDataDir})

      // Create valid daemon.json + heartbeat
      await fs.writeFile(
        path.join(testDataDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({pid: process.pid, port: 9847, startedAt: Date.now()}),
      )
      await fs.writeFile(path.join(testDataDir, HEARTBEAT_FILE), String(Date.now()))

      // Create .brv/ in testDataDir itself
      await fs.mkdir(path.join(testDataDir, BRV_DIR))

      const result = await discovery.discover(testDataDir)

      expect(result.found).to.be.true
      if (result.found) {
        expect(result.projectRoot).to.equal(testDataDir)
      }
    })

    it('should return undefined projectRoot when no .brv/ found (MCP global)', async () => {
      const discovery = new DaemonInstanceDiscovery({dataDir: testDataDir})

      // Create valid daemon.json + heartbeat
      await fs.writeFile(
        path.join(testDataDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({pid: process.pid, port: 9847, startedAt: Date.now()}),
      )
      await fs.writeFile(path.join(testDataDir, HEARTBEAT_FILE), String(Date.now()))

      // No .brv/ anywhere in the temp directory tree
      const noProjectDir = await fs.mkdtemp(path.join(testDataDir, 'no-project-'))

      const result = await discovery.discover(noProjectDir)

      expect(result.found).to.be.true
      if (result.found) {
        expect(result.projectRoot).to.be.undefined
      }
    })

    it('should return no_instance when daemon.json missing', async () => {
      const discovery = new DaemonInstanceDiscovery({dataDir: testDataDir})

      const result = await discovery.discover('/some/project')

      expect(result.found).to.be.false
      if (!result.found) {
        expect(result.reason).to.equal('no_instance')
      }
    })

    it('should return instance_crashed when PID is dead', async () => {
      const discovery = new DaemonInstanceDiscovery({dataDir: testDataDir})

      // Create daemon.json with dead PID
      await fs.writeFile(
        path.join(testDataDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({
          pid: 999999999, // Very unlikely to exist
          port: 9847,
          startedAt: Date.now(),
        }),
      )

      // Create fresh heartbeat (won't matter since PID is dead)
      await fs.writeFile(path.join(testDataDir, HEARTBEAT_FILE), String(Date.now()))

      const result = await discovery.discover('/some/project')

      expect(result.found).to.be.false
      if (!result.found) {
        expect(result.reason).to.equal('instance_crashed')
      }
    })

    it('should return instance_stale when heartbeat is stale', async () => {
      const discovery = new DaemonInstanceDiscovery({
        dataDir: testDataDir,
        heartbeatThresholdMs: 1000, // 1 second threshold
      })

      // Create valid daemon.json with current process PID
      await fs.writeFile(
        path.join(testDataDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({
          pid: process.pid,
          port: 9847,
          startedAt: Date.now(),
        }),
      )

      // Create stale heartbeat (2 seconds old)
      const staleTimestamp = Date.now() - 2000
      await fs.writeFile(path.join(testDataDir, HEARTBEAT_FILE), String(staleTimestamp))

      const result = await discovery.discover('/some/project')

      expect(result.found).to.be.false
      if (!result.found) {
        expect(result.reason).to.equal('instance_stale')
      }
    })

    it('should return instance_stale when heartbeat file missing', async () => {
      const discovery = new DaemonInstanceDiscovery({dataDir: testDataDir})

      // Create valid daemon.json with current process PID
      await fs.writeFile(
        path.join(testDataDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({
          pid: process.pid,
          port: 9847,
          startedAt: Date.now(),
        }),
      )

      // No heartbeat file created

      const result = await discovery.discover('/some/project')

      expect(result.found).to.be.false
      if (!result.found) {
        expect(result.reason).to.equal('instance_stale')
      }
    })

    it('should return no_instance when daemon.json has invalid JSON', async () => {
      const discovery = new DaemonInstanceDiscovery({dataDir: testDataDir})

      // Create invalid JSON
      await fs.writeFile(path.join(testDataDir, DAEMON_INSTANCE_FILE), 'not valid json{')

      const result = await discovery.discover('/some/project')

      expect(result.found).to.be.false
      if (!result.found) {
        expect(result.reason).to.equal('no_instance')
      }
    })

    it('should return no_instance when daemon.json missing required fields', async () => {
      const discovery = new DaemonInstanceDiscovery({dataDir: testDataDir})

      // Create daemon.json missing port field
      await fs.writeFile(
        path.join(testDataDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({
          pid: process.pid,
          startedAt: Date.now(),
          // Missing port
        }),
      )

      const result = await discovery.discover('/some/project')

      expect(result.found).to.be.false
      if (!result.found) {
        expect(result.reason).to.equal('no_instance')
      }
    })

    it('should return no_instance when daemon.json has invalid field types', async () => {
      const discovery = new DaemonInstanceDiscovery({dataDir: testDataDir})

      // Create daemon.json with invalid types (string instead of number)
      await fs.writeFile(
        path.join(testDataDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({
          pid: 'not-a-number',
          port: 9847,
          startedAt: Date.now(),
        }),
      )

      const result = await discovery.discover('/some/project')

      expect(result.found).to.be.false
      if (!result.found) {
        expect(result.reason).to.equal('no_instance')
      }
    })

    it('should return no_instance when daemon.json has invalid port range', async () => {
      const discovery = new DaemonInstanceDiscovery({dataDir: testDataDir})

      // Create daemon.json with port out of valid range
      await fs.writeFile(
        path.join(testDataDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({
          pid: process.pid,
          port: 70000, // > 65535
          startedAt: Date.now(),
        }),
      )

      const result = await discovery.discover('/some/project')

      expect(result.found).to.be.false
      if (!result.found) {
        expect(result.reason).to.equal('no_instance')
      }
    })

    it('should return instance_stale when heartbeat is invalid (non-numeric)', async () => {
      const discovery = new DaemonInstanceDiscovery({dataDir: testDataDir})

      // Create valid daemon.json
      await fs.writeFile(
        path.join(testDataDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({
          pid: process.pid,
          port: 9847,
          startedAt: Date.now(),
        }),
      )

      // Create invalid heartbeat (non-numeric)
      await fs.writeFile(path.join(testDataDir, HEARTBEAT_FILE), 'not-a-number')

      const result = await discovery.discover('/some/project')

      expect(result.found).to.be.false
      if (!result.found) {
        expect(result.reason).to.equal('instance_stale')
      }
    })

    it('should return instance_stale when heartbeat is invalid (negative timestamp)', async () => {
      const discovery = new DaemonInstanceDiscovery({dataDir: testDataDir})

      // Create valid daemon.json
      await fs.writeFile(
        path.join(testDataDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({
          pid: process.pid,
          port: 9847,
          startedAt: Date.now(),
        }),
      )

      // Create invalid heartbeat (negative)
      await fs.writeFile(path.join(testDataDir, HEARTBEAT_FILE), '-1000')

      const result = await discovery.discover('/some/project')

      expect(result.found).to.be.false
      if (!result.found) {
        expect(result.reason).to.equal('instance_stale')
      }
    })

    it('should handle clock skew gracefully (future timestamp)', async () => {
      const discovery = new DaemonInstanceDiscovery({dataDir: testDataDir})

      // Create valid daemon.json
      await fs.writeFile(
        path.join(testDataDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({
          pid: process.pid,
          port: 9847,
          startedAt: Date.now(),
        }),
      )

      // Create future heartbeat (1 second in the future)
      const futureTimestamp = Date.now() + 1000
      await fs.writeFile(path.join(testDataDir, HEARTBEAT_FILE), String(futureTimestamp))

      const result = await discovery.discover('/some/project')

      // Should be rejected as stale due to age < 0 check
      expect(result.found).to.be.false
      if (!result.found) {
        expect(result.reason).to.equal('instance_stale')
      }
    })

    it('should respect custom heartbeatThresholdMs option', async () => {
      const discovery = new DaemonInstanceDiscovery({
        dataDir: testDataDir,
        heartbeatThresholdMs: 5000, // 5 seconds
      })

      // Create valid daemon.json
      await fs.writeFile(
        path.join(testDataDir, DAEMON_INSTANCE_FILE),
        JSON.stringify({
          pid: process.pid,
          port: 9847,
          startedAt: Date.now(),
        }),
      )

      // Create heartbeat 3 seconds old (should pass with 5s threshold)
      const timestamp = Date.now() - 3000
      await fs.writeFile(path.join(testDataDir, HEARTBEAT_FILE), String(timestamp))

      const result = await discovery.discover('/some/project')

      expect(result.found).to.be.true
      if (result.found) {
        expect(result.instance.pid).to.equal(process.pid)
      }
    })
  })

  describe('constructor', () => {
    it('should use default dataDir when not provided', () => {
      const discovery = new DaemonInstanceDiscovery()

      // Just verify it doesn't throw
      expect(discovery).to.be.instanceOf(DaemonInstanceDiscovery)
    })

    it('should use custom dataDir when provided', async () => {
      const customDir = await fs.mkdtemp(path.join(tmpdir(), 'custom-daemon-'))

      try {
        const discovery = new DaemonInstanceDiscovery({dataDir: customDir})

        // Create daemon.json in custom directory
        await fs.writeFile(
          path.join(customDir, DAEMON_INSTANCE_FILE),
          JSON.stringify({
            pid: process.pid,
            port: 9847,
            startedAt: Date.now(),
          }),
        )

        await fs.writeFile(path.join(customDir, HEARTBEAT_FILE), String(Date.now()))

        const result = await discovery.discover('/project')

        expect(result.found).to.be.true
      } finally {
        await fs.rm(customDir, {recursive: true, force: true})
      }
    })
  })
})
