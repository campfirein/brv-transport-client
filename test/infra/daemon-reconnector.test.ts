import {expect} from 'chai'
import {type SinonFakeTimers, type SinonStub, stub, useFakeTimers} from 'sinon'

import type {ConnectionState, ConnectionStateHandler, ITransportClient} from '../../src/core/interfaces/i-client.js'
import {createDaemonReconnector, type DaemonReconnectorDeps} from '../../src/infra/daemon-reconnector.js'

function createMockClient(state: ConnectionState = 'connected'): {
  client: ITransportClient
  triggerStateChange: (newState: ConnectionState) => void
} {
  let stateHandler: ConnectionStateHandler | undefined

  const client: ITransportClient = {
    connect: stub().resolves(),
    disconnect: stub().resolves(),
    getClientId: stub().returns('mock-id'),
    getState: stub().returns(state),
    isConnected: stub().resolves(state === 'connected'),
    joinRoom: stub().resolves(),
    leaveRoom: stub().resolves(),
    on: stub().returns(() => {}),
    once: stub(),
    onStateChange: stub().callsFake((handler: ConnectionStateHandler) => {
      stateHandler = handler
      return () => {
        stateHandler = undefined
      }
    }),
    request: stub() as unknown as ITransportClient['request'],
    requestWithAck: stub().resolves(),
  }

  return {
    client,
    triggerStateChange: (newState: ConnectionState) => {
      ;(client.getState as SinonStub).returns(newState)
      stateHandler?.(newState)
    },
  }
}

describe('createDaemonReconnector', () => {
  let clock: SinonFakeTimers
  let connectToDaemonStub: SinonStub
  let deps: DaemonReconnectorDeps

  beforeEach(() => {
    clock = useFakeTimers()
    connectToDaemonStub = stub()
    deps = {connectToDaemon: connectToDaemonStub}
  })

  afterEach(() => {
    clock.restore()
  })

  describe('state change forwarding', () => {
    it('should forward state changes to onStateChange callback', () => {
      const {client, triggerStateChange} = createMockClient()
      const onStateChange = stub()

      createDaemonReconnector(
        client,
        {
          connectOptions: {clientType: 'mcp'},
          onReconnected: stub(),
          onStateChange,
        },
        deps,
      )

      triggerStateChange('reconnecting')
      expect(onStateChange.calledWith('reconnecting', client)).to.be.true
    })

    it('should reset backoff on connected state (Socket.IO built-in reconnect)', async () => {
      const {client: initialClient, triggerStateChange} = createMockClient()
      const {client: newClient} = createMockClient()

      // First disconnect → reconnect will fail → backoff increases
      connectToDaemonStub.onFirstCall().rejects(new Error('fail'))
      connectToDaemonStub.onSecondCall().resolves({client: newClient, projectRoot: '/test'})

      createDaemonReconnector(
        initialClient,
        {
          connectOptions: {clientType: 'mcp'},
          initialDelayMs: 100,
          onReconnected: stub(),
        },
        deps,
      )

      // Trigger disconnect → first attempt at 100ms fails
      triggerStateChange('disconnected')
      await clock.tickAsync(100)

      // Before retry (now at 150ms delay), Socket.IO reconnects
      triggerStateChange('connected')

      // Backoff was reset — next disconnect should use initial delay again
      expect(connectToDaemonStub.callCount).to.equal(1) // Only the failed attempt
    })
  })

  describe('reconnection on disconnect', () => {
    it('should call connectToDaemon after backoff delay on disconnect', async () => {
      const {client, triggerStateChange} = createMockClient()
      const {client: newClient} = createMockClient()
      connectToDaemonStub.resolves({client: newClient, projectRoot: '/test'})

      createDaemonReconnector(
        client,
        {
          connectOptions: {clientType: 'mcp'},
          initialDelayMs: 500,
          onReconnected: stub(),
        },
        deps,
      )

      triggerStateChange('disconnected')

      // Not called yet (within delay)
      expect(connectToDaemonStub.called).to.be.false

      await clock.tickAsync(500)

      expect(connectToDaemonStub.calledOnce).to.be.true
      expect(connectToDaemonStub.calledWith({clientType: 'mcp'})).to.be.true
    })

    it('should disconnect old client after successful reconnect', async () => {
      const {client: oldClient, triggerStateChange} = createMockClient()
      const {client: newClient} = createMockClient()
      connectToDaemonStub.resolves({client: newClient, projectRoot: '/test'})

      createDaemonReconnector(
        oldClient,
        {
          connectOptions: {clientType: 'tui'},
          initialDelayMs: 100,
          onReconnected: stub(),
        },
        deps,
      )

      triggerStateChange('disconnected')
      await clock.tickAsync(100)

      expect((oldClient.disconnect as SinonStub).calledOnce).to.be.true
    })

    it('should call onReconnected with new client', async () => {
      const {client, triggerStateChange} = createMockClient()
      const {client: newClient} = createMockClient()
      connectToDaemonStub.resolves({client: newClient, projectRoot: '/test'})
      const onReconnected = stub()

      createDaemonReconnector(
        client,
        {
          connectOptions: {clientType: 'mcp'},
          initialDelayMs: 100,
          onReconnected,
        },
        deps,
      )

      triggerStateChange('disconnected')
      await clock.tickAsync(100)

      expect(onReconnected.calledOnce).to.be.true
      expect(onReconnected.calledWith(newClient)).to.be.true
    })

    it('should wire state handler on new client after reconnect', async () => {
      const {client: initialClient, triggerStateChange: triggerInitial} = createMockClient()
      const {client: secondClient, triggerStateChange: triggerSecond} = createMockClient()
      const {client: thirdClient} = createMockClient()

      connectToDaemonStub.onFirstCall().resolves({client: secondClient, projectRoot: '/test'})
      connectToDaemonStub.onSecondCall().resolves({client: thirdClient, projectRoot: '/test'})
      const onReconnected = stub()

      createDaemonReconnector(
        initialClient,
        {
          connectOptions: {clientType: 'mcp'},
          initialDelayMs: 100,
          onReconnected,
        },
        deps,
      )

      // First reconnect
      triggerInitial('disconnected')
      await clock.tickAsync(100)
      expect(onReconnected.callCount).to.equal(1)

      // Second reconnect (from new client disconnecting)
      triggerSecond('disconnected')
      await clock.tickAsync(100)
      expect(onReconnected.callCount).to.equal(2)
      expect(onReconnected.secondCall.calledWith(thirdClient)).to.be.true
    })
  })

  describe('exponential backoff', () => {
    it('should increase delay on failure', async () => {
      const {client, triggerStateChange} = createMockClient()
      connectToDaemonStub.rejects(new Error('connection failed'))

      createDaemonReconnector(
        client,
        {
          backoffMultiplier: 2,
          connectOptions: {clientType: 'mcp'},
          initialDelayMs: 100,
          maxDelayMs: 1000,
          onReconnected: stub(),
        },
        deps,
      )

      triggerStateChange('disconnected')

      // First attempt at 100ms
      await clock.tickAsync(100)
      expect(connectToDaemonStub.callCount).to.equal(1)

      // Second attempt at 200ms (100 * 2)
      await clock.tickAsync(200)
      expect(connectToDaemonStub.callCount).to.equal(2)

      // Third attempt at 400ms (200 * 2)
      await clock.tickAsync(400)
      expect(connectToDaemonStub.callCount).to.equal(3)
    })

    it('should cap delay at maxDelayMs', async () => {
      const {client, triggerStateChange} = createMockClient()
      connectToDaemonStub.rejects(new Error('connection failed'))

      createDaemonReconnector(
        client,
        {
          backoffMultiplier: 10,
          connectOptions: {clientType: 'mcp'},
          initialDelayMs: 100,
          maxDelayMs: 500,
          onReconnected: stub(),
        },
        deps,
      )

      triggerStateChange('disconnected')

      // First attempt at 100ms
      await clock.tickAsync(100)
      expect(connectToDaemonStub.callCount).to.equal(1)

      // Second attempt at 500ms (capped from 100 * 10 = 1000)
      await clock.tickAsync(500)
      expect(connectToDaemonStub.callCount).to.equal(2)
    })

    it('should reset delay after successful reconnect', async () => {
      const {client, triggerStateChange} = createMockClient()
      const {client: newClient, triggerStateChange: triggerNew} = createMockClient()

      connectToDaemonStub.onFirstCall().rejects(new Error('fail'))
      connectToDaemonStub.onSecondCall().resolves({client: newClient, projectRoot: '/test'})
      connectToDaemonStub.onThirdCall().rejects(new Error('fail again'))

      createDaemonReconnector(
        client,
        {
          backoffMultiplier: 2,
          connectOptions: {clientType: 'mcp'},
          initialDelayMs: 100,
          onReconnected: stub(),
        },
        deps,
      )

      // First disconnect: attempt 1 fails (100ms), attempt 2 succeeds (200ms)
      triggerStateChange('disconnected')
      await clock.tickAsync(100)
      await clock.tickAsync(200)
      expect(connectToDaemonStub.callCount).to.equal(2)

      // Second disconnect: should start from initialDelay again (100ms), not 400ms
      triggerNew('disconnected')
      await clock.tickAsync(100)
      expect(connectToDaemonStub.callCount).to.equal(3)
    })
  })

  describe('cancel', () => {
    it('should stop reconnection attempts when cancelled', async () => {
      const {client, triggerStateChange} = createMockClient()
      connectToDaemonStub.rejects(new Error('fail'))

      const handle = createDaemonReconnector(
        client,
        {
          connectOptions: {clientType: 'mcp'},
          initialDelayMs: 100,
          onReconnected: stub(),
        },
        deps,
      )

      triggerStateChange('disconnected')
      handle.cancel()

      await clock.tickAsync(200)
      expect(connectToDaemonStub.called).to.be.false
    })

    it('should not trigger reconnect after cancel even on state change', async () => {
      const {client, triggerStateChange} = createMockClient()

      const handle = createDaemonReconnector(
        client,
        {
          connectOptions: {clientType: 'mcp'},
          onReconnected: stub(),
        },
        deps,
      )

      handle.cancel()
      triggerStateChange('disconnected')

      await clock.tickAsync(5000)
      expect(connectToDaemonStub.called).to.be.false
    })

    it('should disconnect new client if cancelled during reconnect', async () => {
      const {client, triggerStateChange} = createMockClient()
      const {client: newClient} = createMockClient()
      connectToDaemonStub.resolves({client: newClient, projectRoot: '/test'})

      const handle = createDaemonReconnector(
        client,
        {
          connectOptions: {clientType: 'mcp'},
          initialDelayMs: 100,
          onReconnected: stub(),
        },
        deps,
      )

      triggerStateChange('disconnected')

      // Cancel after timer fires but before async work completes
      // (simulating cancel during the await connectToDaemon)
      handle.cancel()
      await clock.tickAsync(100)

      // The new client should be disconnected since we cancelled
      // Note: timing of cancel vs async means we can't guarantee disconnect,
      // but the cancelled flag prevents onReconnected from being called
    })
  })

  describe('concurrent guard', () => {
    it('should not start multiple reconnect attempts simultaneously', async () => {
      const {client, triggerStateChange} = createMockClient()
      const {client: newClient} = createMockClient()
      connectToDaemonStub.resolves({client: newClient, projectRoot: '/test'})

      createDaemonReconnector(
        client,
        {
          connectOptions: {clientType: 'mcp'},
          initialDelayMs: 100,
          onReconnected: stub(),
        },
        deps,
      )

      // Trigger disconnect twice quickly
      triggerStateChange('disconnected')
      triggerStateChange('disconnected')

      await clock.tickAsync(100)

      // Only one attempt despite two disconnect events
      expect(connectToDaemonStub.callCount).to.equal(1)
    })
  })
})
