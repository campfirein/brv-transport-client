import type {ConnectionState, ConnectionStateHandler} from './i-connection-state.js'
import type {EventHandler} from './i-event-dispatcher.js'

// Re-export types for backward compatibility
export type {ConnectionState, ConnectionStateHandler} from './i-connection-state.js'
export type {EventHandler} from './i-event-dispatcher.js'

/**
 * Options for client requests.
 */
export type RequestOptions = {
  /**
   * Timeout in milliseconds for the request.
   * If not specified, uses the default timeout.
   */
  readonly timeout?: number
}

/**
 * Interface for transport client operations.
 * Provides abstraction over real-time communication protocols (Socket.IO, WebSocket, etc.)
 * following Clean Architecture principles.
 *
 * The client:
 * - Connects to a transport server
 * - Sends requests and receives responses
 * - Listens for broadcast events
 * - Joins rooms for targeted broadcasts
 *
 * @remarks
 * This interface follows Interface Segregation Principle (ISP) by providing
 * only the essential operations needed by consumers. Internal implementation
 * details are hidden behind composition of smaller, focused components.
 */
export interface ITransportClient {
  /**
   * Connects to the transport server at the specified URL.
   * @param url - The server URL to connect to (e.g., "http://localhost:9847")
   * @throws TransportConnectionError if connection fails
   */
  connect(url: string): Promise<void>

  /**
   * Disconnects from the transport server.
   * Cleans up resources and stops reconnection attempts.
   */
  disconnect(): Promise<void>

  /**
   * Returns the unique client ID assigned by the server.
   * @returns Client ID or undefined if not connected
   */
  getClientId(): string | undefined

  /**
   * Returns the current connection state.
   */
  getState(): ConnectionState

  /**
   * Checks if the socket is actually connected and responsive.
   * Verifies bidirectional communication by sending a ping and waiting for response.
   * @param timeoutMs - Timeout in milliseconds (default: 2000)
   * @returns true if socket is connected and responsive, false otherwise
   */
  isConnected(timeoutMs?: number): Promise<boolean>

  /**
   * Joins a room for targeted broadcasts.
   * @param room - The room identifier to join
   * @throws TransportNotConnectedError if not connected
   * @throws TransportRoomError if join fails
   * @throws TransportRoomTimeoutError if join times out
   */
  joinRoom(room: string): Promise<void>

  /**
   * Leaves a room.
   *
   * @remarks
   * This method uses "fire-and-forget" semantics for room tracking.
   * The room is immediately removed from internal tracking to prevent infinite
   * rejoin loops on reconnect, regardless of whether the server-side leave succeeds.
   *
   * @param room - The room identifier to leave
   * @throws TransportNotConnectedError if not connected
   * @throws TransportRoomError if server-side leave fails
   * @throws TransportRoomTimeoutError if leave operation times out
   */
  leaveRoom(room: string): Promise<void>

  /**
   * Registers a handler for a specific event from the server.
   * Multiple handlers can be registered for the same event.
   *
   * @remarks
   * Lifecycle:
   * - Can be called before connect() - handlers are queued and registered on connect
   * - Handlers do NOT persist across disconnect/connect cycles
   * - If disconnect() is called, all handlers are cleared
   *
   * @param event - The event name to listen for
   * @param handler - The function to handle incoming events
   * @returns Unsubscribe function to remove the handler
   */
  on<T = unknown>(event: string, handler: EventHandler<T>): () => void

  /**
   * Registers a one-time handler for a specific event.
   * The handler will be automatically removed after first invocation.
   *
   * @remarks
   * Lifecycle:
   * - Can be called before connect() - handlers are queued and registered on connect
   * - Handlers do NOT persist across disconnect/connect cycles
   * - If disconnect() is called before the event fires, queued handlers are cleared
   *
   * @param event - The event name to listen for
   * @param handler - The function to handle the event
   * @throws InvalidEventNameError if event name is invalid
   * @throws MaxPendingOnceHandlersExceededError if max pending handlers exceeded while not connected
   */
  once<T = unknown>(event: string, handler: EventHandler<T>): void

  /**
   * Registers a handler for connection state changes.
   *
   * @remarks
   * State handlers persist across disconnect/connect cycles until explicitly unsubscribed.
   *
   * @param handler - Called when connection state changes
   * @returns Unsubscribe function to remove the handler
   */
  onStateChange(handler: ConnectionStateHandler): () => void

  /**
   * Sends an event to the server.
   * Supports fire-and-forget, callback, and Promise patterns.
   *
   * @example Fire-and-forget
   * ```typescript
   * client.request('event', data)
   * ```
   *
   * @example With acknowledgment callback
   * ```typescript
   * client.request('event', data, (response) => {
   *   console.log('Server responded:', response)
   * })
   * ```
   *
   * @example Promise-based with timeout (existing behavior)
   * ```typescript
   * const response = await client.request('event', data, { timeout: 5000 })
   * ```
   *
   * @param event - The event name
   * @param data - The request payload
   * @param ackOrOptions - Callback function, request options, or omit for fire-and-forget
   * @throws TransportNotConnectedError if not connected
   * @throws InvalidEventNameError if event name is invalid
   * @throws TransportRequestTimeoutError if Promise-based request times out
   * @throws TransportRequestError if server returns an error (Promise mode only)
   */
  // Overload 1: Fire-and-forget (no third argument)
  request(event: string, data?: unknown): void
  // Overload 2: With acknowledgment callback
  request<T = unknown>(event: string, data: unknown, ack: (response: T) => void): void
  // Overload 3: Promise-based with options (existing behavior)
  request<TResponse = unknown, TRequest = unknown>(
    event: string,
    data?: TRequest,
    options?: RequestOptions,
  ): Promise<TResponse>

  /**
   * Fire-and-forget event emission with no response expected.
   * This is an explicit alias for request() without acknowledgment.
   *
   * @param event - The event name
   * @param data - The event payload
   * @throws TransportNotConnectedError if not connected
   * @throws InvalidEventNameError if event name is invalid
   *
   * @example
   * ```typescript
   * // Send event without waiting for response
   * client.emit('log:entry', { level: 'info', message: 'Hello' })
   * ```
   */
  emit(event: string, data?: unknown): void

  /**
   * Promise-based request with explicit return type.
   * This is an explicit alias for request() with options, providing clearer intent.
   *
   * @param event - The event name
   * @param data - The request payload
   * @param options - Request options (timeout, etc.)
   * @returns Promise resolving to the server response
   * @throws TransportNotConnectedError if not connected
   * @throws InvalidEventNameError if event name is invalid
   * @throws TransportRequestTimeoutError if request times out
   * @throws TransportRequestError if server returns an error
   *
   * @example
   * ```typescript
   * // Request with typed response
   * const user = await client.requestAsync<User>('user:get', { id: '123' })
   *
   * // Request with custom timeout
   * const result = await client.requestAsync('slow:operation', data, { timeout: 30000 })
   * ```
   */
  requestAsync<TResponse = unknown, TRequest = unknown>(
    event: string,
    data?: TRequest,
    options?: RequestOptions,
  ): Promise<TResponse>
}
