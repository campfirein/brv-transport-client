/**
 * Integration tests for TransportClient.
 * These tests require a real Socket.IO server to be running.
 *
 * To run integration tests:
 * 1. Start a test server on port 9847
 * 2. Run: npm run test:integration
 *
 * Note: These tests are skipped by default in CI to avoid requiring a running server.
 */

import {describe, it, beforeEach, afterEach} from 'mocha'
import {expect} from 'chai'
import {TransportClient} from '../../infra/socket-io-client.js'

// Skip integration tests if TEST_INTEGRATION environment variable is not set
const describeIntegration = process.env.TEST_INTEGRATION ? describe : describe.skip

describeIntegration('TransportClient Integration Tests', () => {
  const TEST_SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:9847'
  let client: TransportClient

  beforeEach(() => {
    client = new TransportClient()
  })

  afterEach(async () => {
    if (client) {
      await client.disconnect()
    }
  })

  describe('connection lifecycle', () => {
    it('should connect to server', async function () {
      this.timeout(5000)
      await client.connect(TEST_SERVER_URL)
      expect(client.getState()).to.equal('connected')
      expect(client.getClientId()).to.be.a('string')
    })

    it('should disconnect from server', async function () {
      this.timeout(5000)
      await client.connect(TEST_SERVER_URL)
      await client.disconnect()
      expect(client.getState()).to.equal('disconnected')
    })

    it('should reconnect after disconnect', async function () {
      this.timeout(10000)
      await client.connect(TEST_SERVER_URL)
      const firstClientId = client.getClientId()

      await client.disconnect()
      expect(client.getState()).to.equal('disconnected')

      await client.connect(TEST_SERVER_URL)
      expect(client.getState()).to.equal('connected')
      // Client ID changes after reconnect
      expect(client.getClientId()).to.not.equal(firstClientId)
    })

    it('should verify bidirectional communication with isConnected', async function () {
      this.timeout(5000)
      await client.connect(TEST_SERVER_URL)
      const isConnected = await client.isConnected(2000)
      expect(isConnected).to.be.true
    })
  })

  describe('event handling', () => {
    beforeEach(async function () {
      this.timeout(5000)
      await client.connect(TEST_SERVER_URL)
    })

    it('should register and receive event', async function () {
      this.timeout(5000)

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Event not received')), 4000)

        client.on('test:event', (data: any) => {
          clearTimeout(timeout)
          try {
            expect(data).to.deep.equal({message: 'hello'})
            resolve()
          } catch (error) {
            reject(error)
          }
        })

        // Trigger event emission (assumes server echoes events)
        client.emit('test:event', {message: 'hello'})
      })
    })

    it('should unsubscribe event handler', async function () {
      this.timeout(5000)

      let callCount = 0
      const unsubscribe = client.on('test:event', () => {
        callCount++
      })

      // First emission
      client.emit('test:event', {count: 1})
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(callCount).to.equal(1)

      // Unsubscribe
      unsubscribe()

      // Second emission (should not trigger handler)
      client.emit('test:event', {count: 2})
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(callCount).to.equal(1) // Still 1, not incremented
    })

    it('should handle once() event correctly', async function () {
      this.timeout(5000)

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Event not received')), 4000)
        let callCount = 0

        client.once('test:once', (data: any) => {
          callCount++
          clearTimeout(timeout)
          try {
            expect(data).to.deep.equal({message: 'once'})
            expect(callCount).to.equal(1)
            resolve()
          } catch (error) {
            reject(error)
          }
        })

        client.emit('test:once', {message: 'once'})
      })
    })
  })

  describe('request/response pattern', () => {
    beforeEach(async function () {
      this.timeout(5000)
      await client.connect(TEST_SERVER_URL)
    })

    it('should send request and receive response', async function () {
      this.timeout(5000)

      // Assumes server responds to 'echo' event with same data
      const response = await client.request<{echo: string}>('echo', {message: 'test'})
      expect(response).to.have.property('echo')
    })

    it('should handle request timeout', async function () {
      this.timeout(5000)

      try {
        // Request to an endpoint that never responds
        await client.request('never:responds', {}, {timeout: 500})
        expect.fail('Should have thrown timeout error')
      } catch (error: any) {
        expect(error.name).to.include('Timeout')
      }
    })
  })

  describe('room management', () => {
    beforeEach(async function () {
      this.timeout(5000)
      await client.connect(TEST_SERVER_URL)
    })

    it('should join and leave rooms', async function () {
      this.timeout(5000)

      await client.joinRoom('test-room')
      // Assumes server tracks joined rooms

      await client.leaveRoom('test-room')
      // Room should be left
    })

    it('should receive room-targeted events', async function () {
      this.timeout(5000)

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Room event not received')), 4000)

        client.on('room:message', (data: any) => {
          clearTimeout(timeout)
          try {
            expect(data).to.have.property('roomName', 'test-room')
            resolve()
          } catch (error) {
            reject(error)
          }
        })

        // Join room first
        client
          .joinRoom('test-room')
          .then(() => {
            // Emit to room (assumes server broadcasts back)
            client.emit('broadcast:room', {roomName: 'test-room', message: 'hello'})
          })
          .catch(reject)
      })
    })

    it('should auto-rejoin rooms after reconnect', async function () {
      this.timeout(10000)

      // Join a room
      await client.joinRoom('persistent-room')

      // Force disconnect/reconnect (simulates network interruption)
      // Note: This requires server to support reconnection testing
      await client.disconnect()
      await client.connect(TEST_SERVER_URL)

      // Room should be automatically rejoined
      // Verification would require server to confirm room membership
    })
  })

  describe('state management', () => {
    it('should track connection state changes', async function () {
      this.timeout(5000)

      const states: string[] = []
      client.onStateChange((state) => {
        states.push(state)
      })

      await client.connect(TEST_SERVER_URL)
      expect(states).to.include('connecting')
      expect(states).to.include('connected')

      await client.disconnect()
      expect(states).to.include('disconnected')
    })
  })

  describe('error handling', () => {
    it('should handle connection to invalid server', async function () {
      this.timeout(5000)

      try {
        await client.connect('http://localhost:99999') // Invalid port
        expect.fail('Should have thrown connection error')
      } catch (error: any) {
        expect(error.name).to.include('ConnectionError')
      }
    })

    it('should handle invalid URL', async function () {
      try {
        await client.connect('not-a-url')
        expect.fail('Should have thrown validation error')
      } catch (error: any) {
        expect(error.name).to.include('InvalidTransportUrlError')
      }
    })

    it('should handle operations when not connected', async function () {
      try {
        await client.joinRoom('test-room')
        expect.fail('Should have thrown not connected error')
      } catch (error: any) {
        expect(error.name).to.include('NotConnectedError')
      }
    })
  })
})
