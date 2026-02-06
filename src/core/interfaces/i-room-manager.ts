/**
 * Public interface for managing room subscriptions.
 * Handles join and leave operations.
 *
 * @remarks
 * Room operations require an active connection.
 * This interface exposes only what consumers need.
 */
export interface IRoomManager {
  /**
   * Joins a room for targeted broadcasts.
   * @param room - Room identifier to join
   * @throws TransportNotConnectedError if not connected
   * @throws TransportRoomError if join fails
   * @throws TransportRoomTimeoutError if join times out
   */
  joinRoom(room: string): Promise<void>

  /**
   * Leaves a previously joined room.
   * @param room - Room identifier to leave
   * @throws TransportNotConnectedError if not connected
   * @throws TransportRoomError if leave fails
   * @throws TransportRoomTimeoutError if leave times out
   */
  leaveRoom(room: string): Promise<void>

  /**
   * Gets the set of currently joined rooms.
   * @returns Set of room identifiers
   */
  getJoinedRooms(): ReadonlySet<string>
}
