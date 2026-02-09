/**
 * Connection Errors
 *
 * Errors related to discovering and connecting to running instances.
 */

/**
 * Base error for client connection failures.
 */
export class ConnectionError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = 'ConnectionError'
  }
}

/**
 * Error thrown when no running instance is found.
 */
export class NoInstanceRunningError extends ConnectionError {
  public constructor()
  public constructor(options: {message: string})
  public constructor(options?: {message: string}) {
    const defaultMessage = 'No ByteRover instance is running. Start one with: brv'
    super(options?.message ?? defaultMessage)
    this.name = 'NoInstanceRunningError'
  }
}

/**
 * Error thrown when daemon instance is found but its heartbeat is stale.
 * This indicates the daemon process may be hung or stopped writing heartbeats.
 */
export class InstanceStaleError extends ConnectionError {
  public constructor()
  public constructor(options: {message: string})
  public constructor(options?: {message: string}) {
    const defaultMessage = 'ByteRover daemon instance is stale (heartbeat expired). Please restart with: brv'
    super(options?.message ?? defaultMessage)
    this.name = 'InstanceStaleError'
  }
}

/**
 * Error thrown when instance is found but process has crashed.
 */
export class InstanceCrashedError extends ConnectionError {
  public readonly projectRoot?: string

  public constructor(projectRoot?: string)
  public constructor(options: {message: string})
  public constructor(projectRootOrOptions?: string | {message: string}) {
    if (typeof projectRootOrOptions === 'object' && projectRootOrOptions !== null) {
      // Custom message override
      super(projectRootOrOptions.message)
    } else {
      // Auto-generate message
      const details = projectRootOrOptions ? ` in ${projectRootOrOptions}` : ''
      super(`ByteRover instance${details} has crashed. Please restart with: brv`)
      this.projectRoot = projectRootOrOptions
    }
    this.name = 'InstanceCrashedError'
  }
}

/**
 * Error thrown when connection to instance fails.
 */
export class ConnectionFailedError extends ConnectionError {
  public readonly originalError?: Error
  public readonly port?: number

  public constructor(port?: number, originalError?: Error)
  public constructor(options: {message: string})
  public constructor(portOrOptions?: number | {message: string}, originalError?: Error) {
    if (typeof portOrOptions === 'object' && portOrOptions !== null) {
      // Custom message override
      super(portOrOptions.message)
    } else {
      // Auto-generate message
      const portInfo = portOrOptions ? ` on port ${portOrOptions}` : ''
      const errorInfo = originalError ? `: ${originalError.message}` : ''
      super(`Failed to connect to ByteRover instance${portInfo}${errorInfo}`)
      this.port = portOrOptions
      this.originalError = originalError
    }
    this.name = 'ConnectionFailedError'
  }
}

/**
 * Error thrown when connection times out.
 */
export class ConnectionTimeoutError extends ConnectionError {
  public readonly timeoutMs?: number

  public constructor(timeoutMs: number)
  public constructor(options: {message: string})
  public constructor(timeoutMsOrOptions: number | {message: string}) {
    if (typeof timeoutMsOrOptions === 'object' && timeoutMsOrOptions !== null) {
      // Custom message override
      super(timeoutMsOrOptions.message)
    } else {
      // Auto-generate message
      super(`Connection timed out after ${timeoutMsOrOptions}ms`)
      this.timeoutMs = timeoutMsOrOptions
    }
    this.name = 'ConnectionTimeoutError'
  }
}

/**
 * Error thrown when daemon fails to start (spawn timeout).
 */
export class DaemonSpawnError extends ConnectionError {
  public readonly spawnError?: string

  public constructor(spawnError?: string)
  public constructor(options: {message: string})
  public constructor(spawnErrorOrOptions?: string | {message: string}) {
    if (typeof spawnErrorOrOptions === 'object' && spawnErrorOrOptions !== null) {
      // Custom message override
      super(spawnErrorOrOptions.message)
    } else {
      // Auto-generate message
      const detail = spawnErrorOrOptions ? `: ${spawnErrorOrOptions}` : ''
      super(`Failed to start daemon: timed out waiting for daemon to become ready${detail}`)
      this.spawnError = spawnErrorOrOptions
    }
    this.name = 'DaemonSpawnError'
  }
}

/**
 * Error thrown when instance data is invalid or malformed.
 */
export class InvalidInstanceDataError extends ConnectionError {
  public readonly field?: string
  public readonly value?: unknown

  public constructor(message: string, field?: string, value?: unknown)
  public constructor(options: {message: string})
  public constructor(messageOrOptions: string | {message: string}, field?: string, value?: unknown) {
    if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
      // Custom message override
      super(messageOrOptions.message)
    } else {
      // Auto-generate message
      super(`Invalid instance data: ${messageOrOptions}`)
      this.field = field
      this.value = value
    }
    this.name = 'InvalidInstanceDataError'
  }
}
