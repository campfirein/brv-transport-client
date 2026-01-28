/**
 * Transport Client Errors
 *
 * These are client-side transport errors only.
 * Server-side errors (TransportServerNotStartedError, etc.) remain in the main codebase.
 */

/**
 * Base error for transport layer failures.
 */
export class TransportError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = 'TransportError'
  }
}

/**
 * Error thrown when a concurrent connection attempt is made with a different URL.
 */
export class ConcurrentConnectionError extends TransportError {
  public readonly currentUrl?: string
  public readonly requestedUrl?: string

  public constructor(currentUrl: string, requestedUrl: string)
  public constructor(options: {message: string})
  public constructor(currentUrlOrOptions: string | {message: string}, requestedUrl?: string) {
    if (typeof currentUrlOrOptions === 'object' && currentUrlOrOptions !== null) {
      // Custom message override
      super(currentUrlOrOptions.message)
    } else {
      // Auto-generate message
      super(`Connection already in progress to ${currentUrlOrOptions}. Cannot connect to ${requestedUrl} concurrently.`)
      this.currentUrl = currentUrlOrOptions
      this.requestedUrl = requestedUrl
    }
    this.name = 'ConcurrentConnectionError'
  }
}

/**
 * Error thrown when connection to server fails.
 */
export class TransportConnectionError extends TransportError {
  public readonly originalError?: Error
  public readonly url?: string

  public constructor(url: string, originalError?: Error)
  public constructor(options: {message: string})
  public constructor(urlOrOptions: string | {message: string}, originalError?: Error) {
    if (typeof urlOrOptions === 'object' && urlOrOptions !== null) {
      // Custom message override
      super(urlOrOptions.message)
    } else {
      // Auto-generate message
      super(`Connection failed to ${urlOrOptions}${originalError ? `: ${originalError.message}` : ''}`)
      this.url = urlOrOptions
      this.originalError = originalError
    }
    this.name = 'TransportConnectionError'
  }
}

/**
 * Error thrown when client is not connected to server.
 */
export class TransportNotConnectedError extends TransportError {
  public readonly operation?: string

  public constructor(operation?: string)
  public constructor(options: {message: string})
  public constructor(operationOrOptions?: string | {message: string}) {
    if (typeof operationOrOptions === 'object' && operationOrOptions !== null) {
      // Custom message override
      super(operationOrOptions.message)
    } else {
      // Auto-generate message
      const operation = operationOrOptions ?? 'operation'
      super(`Not connected to server. Cannot perform: ${operation}`)
      this.operation = operationOrOptions
    }
    this.name = 'TransportNotConnectedError'
  }
}

/**
 * Error thrown when a request times out.
 */
export class TransportRequestTimeoutError extends TransportError {
  public readonly event?: string
  public readonly timeoutMs?: number

  public constructor(event: string, timeoutMs: number)
  public constructor(options: {message: string})
  public constructor(eventOrOptions: string | {message: string}, timeoutMs?: number) {
    if (typeof eventOrOptions === 'object' && eventOrOptions !== null) {
      // Custom message override
      super(eventOrOptions.message)
    } else {
      // Auto-generate message
      super(`Request timeout for event '${eventOrOptions}' after ${timeoutMs}ms`)
      this.event = eventOrOptions
      this.timeoutMs = timeoutMs
    }
    this.name = 'TransportRequestTimeoutError'
  }
}

/**
 * Error thrown when a request fails with server error.
 */
export class TransportRequestError extends TransportError {
  public readonly event?: string

  public constructor(event: string, message?: string)
  public constructor(options: {message: string})
  public constructor(eventOrOptions: string | {message: string}, message?: string) {
    if (typeof eventOrOptions === 'object' && eventOrOptions !== null) {
      // Custom message override
      super(eventOrOptions.message)
    } else {
      // Auto-generate message
      const errorMessage = message ?? 'Request failed'
      super(`${errorMessage} for event '${eventOrOptions}'`)
      this.event = eventOrOptions
    }
    this.name = 'TransportRequestError'
  }
}

/**
 * Error thrown when room operations fail.
 */
export class TransportRoomError extends TransportError {
  public readonly operation?: 'join' | 'leave'
  public readonly room?: string

  public constructor(room: string, operation: 'join' | 'leave')
  public constructor(options: {message: string})
  public constructor(roomOrOptions: string | {message: string}, operation?: 'join' | 'leave') {
    if (typeof roomOrOptions === 'object' && roomOrOptions !== null) {
      // Custom message override
      super(roomOrOptions.message)
    } else {
      // Auto-generate message
      super(`Failed to ${operation} room '${roomOrOptions}'`)
      this.room = roomOrOptions
      this.operation = operation
    }
    this.name = 'TransportRoomError'
  }
}

/**
 * Error thrown when room operation times out.
 */
export class TransportRoomTimeoutError extends TransportError {
  public readonly operation?: 'join' | 'leave'
  public readonly room?: string
  public readonly timeoutMs?: number

  public constructor(room: string, operation: 'join' | 'leave', timeoutMs: number)
  public constructor(options: {message: string})
  public constructor(roomOrOptions: string | {message: string}, operation?: 'join' | 'leave', timeoutMs?: number) {
    if (typeof roomOrOptions === 'object' && roomOrOptions !== null) {
      // Custom message override
      super(roomOrOptions.message)
    } else {
      // Auto-generate message
      super(`${operation === 'join' ? 'Join' : 'Leave'} room '${roomOrOptions}' timed out after ${timeoutMs}ms`)
      this.room = roomOrOptions
      this.operation = operation
      this.timeoutMs = timeoutMs
    }
    this.name = 'TransportRoomTimeoutError'
  }
}

/**
 * Error thrown when the URL provided to connect() is invalid.
 */
export class InvalidTransportUrlError extends TransportError {
  public readonly url?: string
  public readonly reason?: string

  public constructor(url: string, reason: string)
  public constructor(options: {message: string})
  public constructor(urlOrOptions: string | {message: string}, reason?: string) {
    if (typeof urlOrOptions === 'object' && urlOrOptions !== null) {
      // Custom message override
      super(urlOrOptions.message)
    } else {
      // Auto-generate message
      super(`Invalid transport URL '${urlOrOptions}': ${reason}`)
      this.url = urlOrOptions
      this.reason = reason
    }
    this.name = 'InvalidTransportUrlError'
  }
}

/**
 * Error thrown when an invalid room name is provided.
 */
export class InvalidRoomNameError extends TransportError {
  public readonly room?: string
  public readonly reason?: string

  public constructor(room: string, reason: string)
  public constructor(options: {message: string})
  public constructor(roomOrOptions: string | {message: string}, reason?: string) {
    if (typeof roomOrOptions === 'object' && roomOrOptions !== null) {
      // Custom message override
      super(roomOrOptions.message)
    } else {
      // Auto-generate message
      super(`Invalid room name '${roomOrOptions}': ${reason}`)
      this.room = roomOrOptions
      this.reason = reason
    }
    this.name = 'InvalidRoomNameError'
  }
}

/**
 * Error thrown when an invalid event name is provided.
 */
export class InvalidEventNameError extends TransportError {
  public readonly event?: string
  public readonly reason?: string

  public constructor(event: string, reason: string)
  public constructor(options: {message: string})
  public constructor(eventOrOptions: string | {message: string}, reason?: string) {
    if (typeof eventOrOptions === 'object' && eventOrOptions !== null) {
      // Custom message override
      super(eventOrOptions.message)
    } else {
      // Auto-generate message
      super(`Invalid event name '${eventOrOptions}': ${reason}`)
      this.event = eventOrOptions
      this.reason = reason
    }
    this.name = 'InvalidEventNameError'
  }
}

/**
 * Error thrown when server response has invalid structure.
 */
export class InvalidResponseError extends TransportError {
  public readonly event?: string
  public readonly reason?: string

  public constructor(event: string, reason: string)
  public constructor(options: {message: string})
  public constructor(eventOrOptions: string | {message: string}, reason?: string) {
    if (typeof eventOrOptions === 'object' && eventOrOptions !== null) {
      // Custom message override
      super(eventOrOptions.message)
    } else {
      // Auto-generate message
      super(`Invalid response for event '${eventOrOptions}': ${reason}`)
      this.event = eventOrOptions
      this.reason = reason
    }
    this.name = 'InvalidResponseError'
  }
}

/**
 * Error thrown when an invalid timeout value is provided.
 */
export class InvalidTimeoutError extends TransportError {
  public readonly value?: number
  public readonly parameterName?: string

  public constructor(value: number, parameterName: string)
  public constructor(options: {message: string})
  public constructor(valueOrOptions: number | {message: string}, parameterName?: string) {
    if (typeof valueOrOptions === 'object' && valueOrOptions !== null) {
      // Custom message override
      super(valueOrOptions.message)
    } else {
      // Auto-generate message
      super(`Invalid timeout value ${valueOrOptions} for '${parameterName}': must be a positive number`)
      this.value = valueOrOptions
      this.parameterName = parameterName
    }
    this.name = 'InvalidTimeoutError'
  }
}

/**
 * Error thrown when maximum pending once handlers limit is exceeded.
 * This occurs when `once()` is called before connection and the queue is full.
 */
export class MaxPendingOnceHandlersExceededError extends TransportError {
  public readonly event?: string
  public readonly maxPendingHandlers?: number

  public constructor(event: string, maxPendingHandlers: number)
  public constructor(options: {message: string})
  public constructor(eventOrOptions: string | {message: string}, maxPendingHandlers?: number) {
    if (typeof eventOrOptions === 'object' && eventOrOptions !== null) {
      // Custom message override
      super(eventOrOptions.message)
    } else {
      // Auto-generate message
      super(
        `Cannot queue once handler for '${eventOrOptions}': maximum pending handlers (${maxPendingHandlers}) exceeded. ` +
          `Either establish connection first, or increase maxPendingOnceHandlers configuration.`,
      )
      this.event = eventOrOptions
      this.maxPendingHandlers = maxPendingHandlers
    }
    this.name = 'MaxPendingOnceHandlersExceededError'
  }
}

/**
 * Error thrown when an invalid state transition is attempted.
 * State transitions must follow the defined state machine rules.
 */
export class InvalidStateTransitionError extends TransportError {
  public readonly fromState?: string
  public readonly toState?: string

  public constructor(fromState: string, toState: string)
  public constructor(options: {message: string})
  public constructor(fromStateOrOptions: string | {message: string}, toState?: string) {
    if (typeof fromStateOrOptions === 'object' && fromStateOrOptions !== null) {
      // Custom message override
      super(fromStateOrOptions.message)
    } else {
      // Auto-generate message
      super(`Invalid state transition: ${fromStateOrOptions} → ${toState}`)
      this.fromState = fromStateOrOptions
      this.toState = toState
    }
    this.name = 'InvalidStateTransitionError'
  }
}

/**
 * Error thrown when an operation is attempted in an invalid state.
 */
export class InvalidOperationError extends TransportError {
  public readonly operation?: string
  public readonly currentState?: string

  public constructor(message: string)
  public constructor(operation: string, currentState: string)
  public constructor(messageOrOperation: string, currentState?: string) {
    if (currentState) {
      // Auto-generate message from operation + state
      super(`Operation '${messageOrOperation}' not allowed in state '${currentState}'`)
      this.operation = messageOrOperation
      this.currentState = currentState
    } else {
      // Custom message
      super(messageOrOperation)
    }
    this.name = 'InvalidOperationError'
  }
}
