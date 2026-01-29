import {expect} from 'chai'
import * as sinon from 'sinon'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {tmpdir} from 'node:os'

import {
  TransportClientFactory,
  createTransportClientFactory,
  getTransportClientFactory,
  checkServerStatus,
  getConnectedClient,
  disconnectClient,
  resetSingletons,
} from '../../infra/client-factory.js'
import {
  ConnectionFailedError,
  InstanceCrashedError,
  NoInstanceRunningError,
} from '../../core/domain/errors/connection-error.js'
import type {IInstanceDiscovery} from '../../core/interfaces/i-instance-discovery.js'
import {InstanceInfo} from '../../core/domain/entities/instance-info.js'

describe('TransportClientFactory', () => {
  let testDir: string

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'client-factory-test-'))
    // Reset singletons before each test
    resetSingletons()
  })

  afterEach(async () => {
    // Clean up
    await fs.rm(testDir, {recursive: true, force: true})
    resetSingletons()
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
        findProjectRoot: async () => undefined,
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
        findProjectRoot: async () => undefined,
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
        findProjectRoot: async () => undefined,
      }

      const factory = new TransportClientFactory({discovery: mockDiscovery})

      try {
        await factory.connect(testDir)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(InstanceCrashedError)
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
        findProjectRoot: async () => testDir,
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
        findProjectRoot: async () => undefined,
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

describe('createTransportClientFactory()', () => {
  it('should create a new factory instance', () => {
    const factory = createTransportClientFactory()
    expect(factory).to.be.instanceOf(TransportClientFactory)
  })

  it('should create a new instance each time', () => {
    const factory1 = createTransportClientFactory()
    const factory2 = createTransportClientFactory()
    expect(factory1).to.not.equal(factory2)
  })
})

describe('getTransportClientFactory()', () => {
  beforeEach(() => {
    resetSingletons()
  })

  afterEach(() => {
    resetSingletons()
  })

  it('should return singleton factory', () => {
    const factory1 = getTransportClientFactory()
    const factory2 = getTransportClientFactory()
    expect(factory1).to.equal(factory2)
  })

  it('should use config only on first call', () => {
    const factory1 = getTransportClientFactory({maxRetries: 5})
    const factory2 = getTransportClientFactory({maxRetries: 10}) // This should be ignored
    expect(factory1).to.equal(factory2)
  })
})

describe('checkServerStatus()', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'server-status-test-'))
    resetSingletons()
  })

  afterEach(async () => {
    await fs.rm(testDir, {recursive: true, force: true})
    resetSingletons()
  })

  it('should return not running when no .brv directory', async () => {
    const status = await checkServerStatus(testDir)

    expect(status.running).to.be.false
    if (!status.running) {
      expect(status.reason).to.equal('no_instance')
    }
  })

  it('should return instance_crashed when process is dead', async () => {
    const brvDir = path.join(testDir, '.brv')
    await fs.mkdir(brvDir, {recursive: true})
    await fs.writeFile(
      path.join(brvDir, 'instance.json'),
      JSON.stringify({
        pid: 999999999, // Non-existent PID
        port: 9847,
        currentSessionId: null,
        startedAt: Date.now(),
      }),
    )

    const status = await checkServerStatus(testDir)

    expect(status.running).to.be.false
    if (!status.running) {
      expect(status.reason).to.equal('instance_crashed')
    }
  })

  it('should return running when instance is alive', async () => {
    const brvDir = path.join(testDir, '.brv')
    await fs.mkdir(brvDir, {recursive: true})
    await fs.writeFile(
      path.join(brvDir, 'instance.json'),
      JSON.stringify({
        pid: process.pid, // Current process is alive
        port: 9847,
        currentSessionId: 'session-123',
        startedAt: Date.now(),
      }),
    )

    const status = await checkServerStatus(testDir)

    expect(status.running).to.be.true
    if (status.running) {
      expect(status.instance.pid).to.equal(process.pid)
      expect(status.instance.port).to.equal(9847)
      expect(status.projectRoot).to.equal(testDir)
    }
  })

  it('should use cwd as default', async () => {
    // This will check in cwd which likely doesn't have .brv
    const status = await checkServerStatus()

    // Just verify it doesn't throw and returns a valid status
    expect(status).to.have.property('running')
  })
})

describe('getConnectedClient()', () => {
  beforeEach(() => {
    resetSingletons()
  })

  afterEach(() => {
    resetSingletons()
  })

  it('should throw NoInstanceRunningError when no instance', async () => {
    try {
      await getConnectedClient('/nonexistent/path')
      expect.fail('Should have thrown')
    } catch (error) {
      expect(error).to.be.instanceOf(NoInstanceRunningError)
    }
  })
})

describe('disconnectClient()', () => {
  beforeEach(() => {
    resetSingletons()
  })

  afterEach(() => {
    resetSingletons()
  })

  it('should resolve without error when no client connected', async () => {
    await disconnectClient()
    // Should not throw
  })
})

describe('resetSingletons()', () => {
  it('should clear all singleton instances', () => {
    // Get singleton to create it
    getTransportClientFactory()

    // Reset
    resetSingletons()

    // Get new singleton - should be a different instance
    const factory1 = getTransportClientFactory()
    resetSingletons()
    const factory2 = getTransportClientFactory()

    // They should be different because we reset between calls
    expect(factory1).to.not.equal(factory2)
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
      findProjectRoot: async () => undefined,
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
      findProjectRoot: async () => testDir,
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
