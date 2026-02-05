import {expect} from 'chai'
import {type SinonStub, stub} from 'sinon'

import {connectToDaemon, type ConnectToDaemonDeps} from '../../src/infra/daemon-connector.js'

describe('daemon-connector', () => {
  let deps: ConnectToDaemonDeps
  let ensureDaemonRunningStub: SinonStub
  let connectToTransportStub: SinonStub

  const fakeClient = {getClientId: () => 'fake-id', getState: () => 'connected'} as never
  const fakeConnectionResult = Object.freeze({client: fakeClient, projectRoot: '/fake/project'})

  beforeEach(() => {
    ensureDaemonRunningStub = stub().resolves({
      info: {pid: 1234, port: 37_847},
      started: false,
      success: true,
    })
    connectToTransportStub = stub().resolves(fakeConnectionResult)
    deps = {
      connectToTransport: connectToTransportStub,
      ensureDaemonRunning: ensureDaemonRunningStub,
    }
  })

  describe('connectToDaemon()', () => {
    it('should call ensureDaemonRunning then connectToTransport', async () => {
      const result = await connectToDaemon({clientType: 'cli'}, deps)

      expect(result).to.equal(fakeConnectionResult)
      expect(ensureDaemonRunningStub.calledOnce).to.be.true
      expect(connectToTransportStub.calledOnce).to.be.true

      // ensureDaemonRunning called before connectToTransport
      expect(ensureDaemonRunningStub.calledBefore(connectToTransportStub)).to.be.true
    })

    it('should pass version and serverPath to ensureDaemonRunning when provided', async () => {
      await connectToDaemon({clientType: 'cli', serverPath: '/custom/brv-server.js', version: '1.6.0'}, deps)

      expect(ensureDaemonRunningStub.calledWith({serverPath: '/custom/brv-server.js', version: '1.6.0'})).to.be.true
    })

    it('should not pass options to ensureDaemonRunning when omitted', async () => {
      await connectToDaemon({clientType: 'cli'}, deps)

      const callArg = ensureDaemonRunningStub.firstCall.args[0]
      expect(callArg).to.be.undefined
    })

    it('should throw when daemon fails to start', async () => {
      ensureDaemonRunningStub.resolves({reason: 'timeout', success: false})

      try {
        await connectToDaemon({clientType: 'cli'}, deps)
        expect.fail('should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
        expect((error as Error).message).to.include('Failed to start daemon')
      }
    })

    it('should include spawnError detail in error message when available', async () => {
      ensureDaemonRunningStub.resolves({
        reason: 'timeout',
        spawnError: 'ENOENT',
        success: false,
      })

      try {
        await connectToDaemon({clientType: 'cli'}, deps)
        expect.fail('should have thrown')
      } catch (error) {
        expect((error as Error).message).to.include('ENOENT')
      }
    })

    it('should not call connectToTransport when daemon fails', async () => {
      ensureDaemonRunningStub.resolves({reason: 'timeout', success: false})

      try {
        await connectToDaemon({clientType: 'cli'}, deps)
      } catch {
        // expected
      }

      expect(connectToTransportStub.notCalled).to.be.true
    })

    // --- CLI path ---

    it('should pass clientType and projectPath for CLI clients', async () => {
      await connectToDaemon({clientType: 'cli', fromDir: '/my/project', projectPath: '/my/project'}, deps)

      const [fromDir, options] = connectToTransportStub.firstCall.args
      expect(fromDir).to.equal('/my/project')
      expect(options.clientType).to.equal('cli')
      expect(options.projectPath).to.equal('/my/project')
      expect(options.autoRegister).to.be.true
    })

    // --- TUI path ---

    it('should pass joinRooms for TUI clients', async () => {
      await connectToDaemon({
        clientType: 'tui',
        joinRooms: ['broadcast-room'],
        projectPath: '/my/project',
      }, deps)

      const [, options] = connectToTransportStub.firstCall.args
      expect(options.clientType).to.equal('tui')
      expect(options.joinRooms).to.deep.equal(['broadcast-room'])
      expect(options.projectPath).to.equal('/my/project')
    })

    // --- MCP project mode ---

    it('should pass projectPath for MCP project mode', async () => {
      await connectToDaemon({
        clientType: 'mcp',
        fromDir: '/my/project',
        projectPath: '/my/project',
        version: '1.6.0',
      }, deps)

      const [fromDir, options] = connectToTransportStub.firstCall.args
      expect(fromDir).to.equal('/my/project')
      expect(options.clientType).to.equal('mcp')
      expect(options.projectPath).to.equal('/my/project')
    })

    // --- MCP global mode ---

    it('should omit projectPath for MCP global mode', async () => {
      await connectToDaemon({
        clientType: 'mcp',
        fromDir: '/some/dir',
        version: '1.6.0',
      }, deps)

      const [, options] = connectToTransportStub.firstCall.args
      expect(options.clientType).to.equal('mcp')
      expect(options.projectPath).to.be.undefined
    })

    // --- skipRegistration ---

    it('should set autoRegister=false when skipRegistration=true', async () => {
      await connectToDaemon({clientType: 'cli', skipRegistration: true}, deps)

      const [, options] = connectToTransportStub.firstCall.args
      expect(options.autoRegister).to.be.false
    })

    it('should set autoRegister=true by default', async () => {
      await connectToDaemon({clientType: 'cli'}, deps)

      const [, options] = connectToTransportStub.firstCall.args
      expect(options.autoRegister).to.be.true
    })

    // --- DaemonInstanceDiscovery ---

    it('should pass a DaemonInstanceDiscovery instance', async () => {
      await connectToDaemon({clientType: 'cli'}, deps)

      const [, options] = connectToTransportStub.firstCall.args
      expect(options.discovery).to.exist
      expect(options.discovery.constructor.name).to.equal('DaemonInstanceDiscovery')
    })
  })
})
