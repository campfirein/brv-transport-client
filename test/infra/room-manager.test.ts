import {expect} from 'chai'
import * as sinon from 'sinon'

import {RoomManager} from '../../infra/room-manager.js'
import type {ISocketProvider} from '../../core/interfaces/i-socket-provider.js'
import type {ISocket} from '../../core/interfaces/i-socket.js'
import {
  TransportNotConnectedError,
  TransportRoomError,
  TransportRoomTimeoutError,
  InvalidRoomNameError,
} from '../../core/domain/errors/transport-error.js'

describe('RoomManager', () => {
  let roomManager: RoomManager
  let mockSocketProvider: ISocketProvider
  let mockSocket: sinon.SinonStubbedInstance<ISocket>

  beforeEach(() => {
    mockSocket = {
      connected: true,
      id: 'test-socket-id',
      on: sinon.stub(),
      once: sinon.stub(),
      off: sinon.stub(),
      emit: sinon.stub(),
      disconnect: sinon.stub(),
    } as unknown as sinon.SinonStubbedInstance<ISocket>

    mockSocketProvider = {
      getSocket: () => (mockSocket.connected ? (mockSocket as unknown as ISocket) : undefined),
    }

    roomManager = new RoomManager({
      socketProvider: mockSocketProvider,
      roomTimeoutMs: 1000,
    })
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const rm = new RoomManager({socketProvider: mockSocketProvider})
      expect(rm).to.be.instanceOf(RoomManager)
    })

    it('should accept custom roomTimeoutMs', () => {
      const rm = new RoomManager({
        socketProvider: mockSocketProvider,
        roomTimeoutMs: 5000,
      })
      expect(rm).to.be.instanceOf(RoomManager)
    })

    it('should accept custom logger', () => {
      const logger = {debug: sinon.spy()}
      const rm = new RoomManager({
        socketProvider: mockSocketProvider,
        logger,
      })
      expect(rm).to.be.instanceOf(RoomManager)
    })
  })

  describe('getJoinedRooms()', () => {
    it('should return empty set initially', () => {
      const rooms = roomManager.getJoinedRooms()
      expect(rooms.size).to.equal(0)
    })

    it('should return defensive copy', () => {
      const rooms1 = roomManager.getJoinedRooms()
      const rooms2 = roomManager.getJoinedRooms()
      expect(rooms1).to.not.equal(rooms2) // Different references
    })
  })

  describe('joinRoom()', () => {
    it('should validate room name', async () => {
      try {
        await roomManager.joinRoom('')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(InvalidRoomNameError)
      }
    })

    it('should throw when not connected', async () => {
      mockSocket.connected = false

      try {
        await roomManager.joinRoom('test-room')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(TransportNotConnectedError)
      }
    })

    it('should emit room:join event', async () => {
      mockSocket.emit.callsFake((_event, _room, callback) => {
        callback({success: true})
      })

      await roomManager.joinRoom('test-room')

      expect(mockSocket.emit.calledOnce).to.be.true
      expect(mockSocket.emit.firstCall.args[0]).to.equal('room:join')
      expect(mockSocket.emit.firstCall.args[1]).to.equal('test-room')
    })

    it('should add room to joined rooms on success', async () => {
      mockSocket.emit.callsFake((_event, _room, callback) => {
        callback({success: true})
      })

      await roomManager.joinRoom('test-room')

      const rooms = roomManager.getJoinedRooms()
      expect(rooms.has('test-room')).to.be.true
    })

    it('should throw TransportRoomError on failure', async () => {
      mockSocket.emit.callsFake((_event, _room, callback) => {
        callback({success: false})
      })

      try {
        await roomManager.joinRoom('test-room')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(TransportRoomError)
      }
    })

    it('should throw TransportRoomTimeoutError on timeout', async () => {
      const clock = sinon.useFakeTimers()

      // Don't call callback - simulate timeout
      mockSocket.emit.callsFake(() => {})

      const promise = roomManager.joinRoom('test-room')

      clock.tick(1500) // Past timeout

      try {
        await promise
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(TransportRoomTimeoutError)
      }

      clock.restore()
    })
  })

  describe('leaveRoom()', () => {
    it('should validate room name', async () => {
      try {
        await roomManager.leaveRoom('')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(InvalidRoomNameError)
      }
    })

    it('should throw when not connected', async () => {
      mockSocket.connected = false

      try {
        await roomManager.leaveRoom('test-room')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(TransportNotConnectedError)
      }
    })

    it('should emit room:leave event', async () => {
      mockSocket.emit.callsFake((_event, _room, callback) => {
        callback({success: true})
      })

      await roomManager.leaveRoom('test-room')

      expect(mockSocket.emit.calledOnce).to.be.true
      expect(mockSocket.emit.firstCall.args[0]).to.equal('room:leave')
    })

    it('should remove room from joined rooms immediately', async () => {
      // First join
      mockSocket.emit.callsFake((_event, _room, callback) => {
        callback({success: true})
      })
      await roomManager.joinRoom('test-room')
      expect(roomManager.getJoinedRooms().has('test-room')).to.be.true

      // Then leave
      await roomManager.leaveRoom('test-room')
      expect(roomManager.getJoinedRooms().has('test-room')).to.be.false
    })

    it('should throw TransportRoomTimeoutError on timeout', async () => {
      const clock = sinon.useFakeTimers()

      mockSocket.emit.callsFake(() => {})

      const promise = roomManager.leaveRoom('test-room')

      clock.tick(1500)

      try {
        await promise
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(TransportRoomTimeoutError)
      }

      clock.restore()
    })
  })

  describe('rejoinRooms()', () => {
    it('should attempt to rejoin all tracked rooms', async () => {
      const clock = sinon.useFakeTimers()

      // Join some rooms first
      mockSocket.emit.callsFake((_event, _room, callback) => {
        callback({success: true})
      })
      await roomManager.joinRoom('room1')
      await roomManager.joinRoom('room2')

      // Reset emit stub to track rejoin calls
      mockSocket.emit.resetHistory()

      // Trigger rejoin
      roomManager.rejoinRooms()

      // Need to advance timers for async operations
      await clock.tickAsync(100)

      // Should have emitted join for both rooms
      expect(mockSocket.emit.callCount).to.be.at.least(2)

      clock.restore()
    })
  })

  describe('clearRooms()', () => {
    it('should clear all tracked rooms', async () => {
      mockSocket.emit.callsFake((_event, _room, callback) => {
        callback({success: true})
      })
      await roomManager.joinRoom('room1')
      await roomManager.joinRoom('room2')

      roomManager.clearRooms()

      expect(roomManager.getJoinedRooms().size).to.equal(0)
    })
  })

  describe('handled flag pattern', () => {
    it('should not add room if timeout fires first', async () => {
      const clock = sinon.useFakeTimers()

      // Simulate delayed response that arrives after timeout
      let capturedCallback: ((response: {success: boolean}) => void) | null = null
      mockSocket.emit.callsFake((_event, _room, callback) => {
        capturedCallback = callback
      })

      const promise = roomManager.joinRoom('test-room')

      // Timeout fires
      clock.tick(1500)

      // Now server responds (too late)
      if (capturedCallback) {
        capturedCallback({success: true})
      }

      try {
        await promise
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).to.be.instanceOf(TransportRoomTimeoutError)
      }

      // Room should NOT be added because timeout won
      expect(roomManager.getJoinedRooms().has('test-room')).to.be.false

      clock.restore()
    })
  })
})
