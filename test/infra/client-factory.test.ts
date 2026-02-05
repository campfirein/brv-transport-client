import {expect} from 'chai'
import * as sinon from 'sinon'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {tmpdir} from 'node:os'

import {TransportClientFactory, checkServerStatus} from '../../src/infra/client-factory.js'
import {
  ConnectionFailedError,
  InstanceCrashedError,
  InstanceStaleError,
  NoInstanceRunningError,
} from '../../src/core/domain/errors/connection-error.js'
import type {IInstanceDiscovery} from '../../src/core/interfaces/i-instance-discovery.js'
import {InstanceInfo} from '../../src/core/domain/entities/instance-info.js'
import {DaemonInstanceDiscovery} from '../../src/infra/daemon-instance-discovery.js'
import {DAEMON_INSTANCE_FILE, HEARTBEAT_FILE} from '../../src/constants.js'

describe('TransportClientFactory', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'client-factory-test-'))
  })

  afterEach(async () => {
    await fs.rm(testDir, {recursive: true, force: true})
    sinon.restore()
  })

  describe('constructor', () => {
    it('should use default config when none provided', () => {
      const factory = new TransportClientFactory()
      expect(factory).to.be.instanceOf(TransportClientFactory)
    })

    it('should accept custom discovery service', () => {
      const mockDiscovery: IInstanceDiscovery = {
        discover: async () => ({found: false, reason: 'no_instance'}),
      }

      const factory = new TransportClientFactory({discovery: mockDiscovery})
      expect(factory).to.be.instanceOf(TransportClientFactory)
    })

    it('should accept custom logger', () => {
      const mockLogger = {debug: sinon.spy()}

      const factory = new TransportClientFactory({logger: mockLogger})
      expect(factory).to.be.instanceOf(TransportClientFactory)
    })

    it('should accept custom retry settings', () => {
      const factory = new TransportClientFactory({
        maxRetries: 3,
        retryDelayMs: 100,
      })
      expect(factory).to.be.instanceOf(TransportClientFactory)
    })
  })

  describe('connect()', () => {
    it('should throw NoInstanceRunningError when no instance found', async () => {
      const mockDiscovery: IInstanceDiscovery = {
        discover: async () => ({found: false, reason: 'no_instance'}),
      }

      const factory = new TransportClientFactory({discovery: mockDiscovery})

      try {
        await factory.connect(testDir)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(NoInstanceRunningError)
      }
    })

    it('should throw InstanceCrashedError when instance crashed', async () => {
      const mockDiscovery: IInstanceDiscovery = {
        discover: async () => ({found: false, reason: 'instance_crashed'}),
      }

      const factory = new TransportClientFactory({discovery: mockDiscovery})

      try {
        await factory.connect(testDir)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(InstanceCrashedError)
      }
    })

    it('should throw InstanceStaleError when instance heartbeat expired', async () => {
      const mockDiscovery: IInstanceDiscovery = {
        discover: async () => ({found: false, reason: 'instance_stale'}),
      }

      const factory = new TransportClientFactory({discovery: mockDiscovery})

      try {
        await factory.connect(testDir)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(InstanceStaleError)
      }
    })

    it('should throw ConnectionFailedError after all retries fail', async () => {
      const instance = InstanceInfo.create({
        pid: process.pid,
        port: 99999, // Invalid port that won't connect
      })

      const mockDiscovery: IInstanceDiscovery = {
        discover: async () => ({
          found: true,
          instance,
          projectRoot: testDir,
        }),
      }

      const factory = new TransportClientFactory({
        discovery: mockDiscovery,
        maxRetries: 1,
        retryDelayMs: 1,
        warmUpTimeoutMs: 1,
        warmUpSettleDelayMs: 1,
        connectTimeoutMs: 10, // Fast timeout for test
      })

      try {
        await factory.connect(testDir)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(ConnectionFailedError)
        expect((error as ConnectionFailedError).port).to.equal(99999)
      }
    })

    it('should use cwd as default fromDir', async () => {
      const mockDiscovery: IInstanceDiscovery = {
        discover: sinon.stub().resolves({found: false, reason: 'no_instance'}),
      }

      const factory = new TransportClientFactory({discovery: mockDiscovery})

      try {
        await factory.connect()
      } catch {
        // Expected to fail
      }

      expect((mockDiscovery.discover as sinon.SinonStub).calledWith(process.cwd())).to.be.true
    })
  })
})

describe('checkServerStatus()', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'server-status-test-'))
  })

  afterEach(async () => {
    await fs.rm(testDir, {recursive: true, force: true})
  })

  it('should return not running when no daemon.json exists', async () => {
    const discovery = new DaemonInstanceDiscovery({dataDir: testDir})
    const status = await checkServerStatus(testDir, discovery)

    expect(status.running).to.be.false
    if (!status.running) {
      expect(status.reason).to.equal('no_instance')
    }
  })

  it('should return instance_crashed when process is dead', async () => {
    await fs.writeFile(
      path.join(testDir, DAEMON_INSTANCE_FILE),
      JSON.stringify({
        pid: 999999999, // Non-existent PID
        port: 49_847,
        startedAt: Date.now(),
      }),
    )
    // Write fresh heartbeat
    await fs.writeFile(path.join(testDir, HEARTBEAT_FILE), String(Date.now()))

    const discovery = new DaemonInstanceDiscovery({dataDir: testDir})
    const status = await checkServerStatus(testDir, discovery)

    expect(status.running).to.be.false
    if (!status.running) {
      expect(status.reason).to.equal('instance_crashed')
    }
  })

  it('should return running when instance is alive', async () => {
    await fs.writeFile(
      path.join(testDir, DAEMON_INSTANCE_FILE),
      JSON.stringify({
        pid: process.pid, // Current process is alive
        port: 49_847,
        startedAt: Date.now(),
      }),
    )
    // Write fresh heartbeat
    await fs.writeFile(path.join(testDir, HEARTBEAT_FILE), String(Date.now()))

    const discovery = new DaemonInstanceDiscovery({dataDir: testDir})
    const status = await checkServerStatus(testDir, discovery)

    expect(status.running).to.be.true
    if (status.running) {
      expect(status.instance.pid).to.equal(process.pid)
      expect(status.instance.port).to.equal(49_847)
      // testDir has no .brv/ directory, so projectRoot is undefined
      expect(status.projectRoot).to.be.undefined
    }
  })

  it('should accept custom discovery service', async () => {
    const mockDiscovery: IInstanceDiscovery = {
      discover: sinon.stub().resolves({found: false, reason: 'no_instance'}),
    }

    const status = await checkServerStatus(testDir, mockDiscovery)

    expect(status.running).to.be.false
    expect((mockDiscovery.discover as sinon.SinonStub).calledWith(testDir)).to.be.true
  })
})

describe('TransportClientFactory - Logger Integration', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'logger-test-'))
  })

  afterEach(async () => {
    await fs.rm(testDir, {recursive: true, force: true})
    sinon.restore()
  })

  it('should log discovery attempts', async () => {
    const mockLogger = {debug: sinon.spy()}
    const mockDiscovery: IInstanceDiscovery = {
      discover: async () => ({found: false, reason: 'no_instance'}),
    }

    const factory = new TransportClientFactory({
      discovery: mockDiscovery,
      logger: mockLogger,
    })

    try {
      await factory.connect(testDir)
    } catch {
      // Expected to fail
    }

    expect(mockLogger.debug.called).to.be.true
    expect(mockLogger.debug.args[0][0]).to.include('Discovering instance')
  })

  it('should log connection attempts', async () => {
    const mockLogger = {debug: sinon.spy()}
    const instance = InstanceInfo.create({
      pid: process.pid,
      port: 99999,
    })

    const mockDiscovery: IInstanceDiscovery = {
      discover: async () => ({
        found: true,
        instance,
        projectRoot: testDir,
      }),
    }

    const factory = new TransportClientFactory({
      discovery: mockDiscovery,
      logger: mockLogger,
      maxRetries: 1,
      retryDelayMs: 1,
      warmUpTimeoutMs: 1,
      warmUpSettleDelayMs: 1,
      connectTimeoutMs: 10, // Fast timeout for test
    })

    try {
      await factory.connect(testDir)
    } catch {
      // Expected to fail
    }

    // Should have logged multiple messages
    expect(mockLogger.debug.callCount).to.be.greaterThan(1)
  })
})
