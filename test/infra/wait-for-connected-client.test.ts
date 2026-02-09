import {expect} from 'chai'
import {type SinonFakeTimers, stub, useFakeTimers} from 'sinon'

import type {ITransportClient} from '../../src/core/interfaces/i-client.js'
import {waitForConnectedClient} from '../../src/infra/wait-for-connected-client.js'

/** Returns undefined — named constant avoids inline `() => undefined` triggering unicorn/no-useless-undefined. */
const noClient = (): ITransportClient | undefined => undefined

function createMockClient(state: string): ITransportClient {
  return {
    connect: stub().resolves(),
    disconnect: stub().resolves(),
    getClientId: stub().returns('mock-id'),
    getState: stub().returns(state),
    isConnected: stub().resolves(state === 'connected'),
    joinRoom: stub().resolves(),
    leaveRoom: stub().resolves(),
    on: stub().returns(() => {}),
    once: stub(),
    onStateChange: stub().returns(() => {}),
    request: stub() as unknown as ITransportClient['request'],
    requestWithAck: stub().resolves(),
  }
}

describe('waitForConnectedClient', () => {
  let clock: SinonFakeTimers

  beforeEach(() => {
    clock = useFakeTimers()
  })

  afterEach(() => {
    clock.restore()
  })

  it('should resolve immediately when client is already connected', async () => {
    const client = createMockClient('connected')
    const result = await waitForConnectedClient(() => client)
    expect(result).to.equal(client)
  })

  it('should resolve when client becomes connected during polling', async () => {
    const client = createMockClient('reconnecting')
    const getState = client.getState as ReturnType<typeof stub>

    const promise = waitForConnectedClient(() => client, 10_000)

    // After 1.5s, client reconnects
    await clock.tickAsync(1500)
    getState.returns('connected')
    await clock.tickAsync(500)

    const result = await promise
    expect(result).to.equal(client)
  })

  it('should resolve undefined when timeout expires with no connected client', async () => {
    const client = createMockClient('disconnected')

    const promise = waitForConnectedClient(() => client, 5000)
    await clock.tickAsync(6000)

    const result = await promise
    expect(result).to.be.undefined
  })

  it('should resolve undefined when getClient always returns undefined', async () => {
    const promise = waitForConnectedClient(noClient, 2000)
    await clock.tickAsync(3000)

    const result = await promise
    expect(result).to.be.undefined
  })

  it('should detect when getClient returns a new connected client', async () => {
    const disconnectedClient = createMockClient('disconnected')
    const connectedClient = createMockClient('connected')
    let currentClient: ITransportClient | undefined = disconnectedClient

    const promise = waitForConnectedClient(() => currentClient, 10_000)

    // Swap to connected client after 2s
    await clock.tickAsync(2000)
    currentClient = connectedClient
    await clock.tickAsync(500)

    const result = await promise
    expect(result).to.equal(connectedClient)
  })
})
