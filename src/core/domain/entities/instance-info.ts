import {InvalidInstanceDataError} from '../errors/connection-error.js'

/**
 * Default transport host for localhost connections.
 * Using IP address instead of 'localhost' for better sandbox compatibility.
 */
const DEFAULT_TRANSPORT_HOST = '127.0.0.1'

/**
 * Raw instance data as stored in instance.json.
 * Used for serialization/deserialization.
 *
 * NOTE: We don't store "status" - we check pid alive at runtime instead.
 * This avoids stale status when process crashes.
 */
export type InstanceInfoJson = {
  /** Process ID of the Core process */
  pid: number
  /** Port the transport server is listening on */
  port: number
  /** Timestamp when instance started (ms since epoch) */
  startedAt: number
  /** CLI version that started this daemon (optional for backward compat) */
  version?: string
}

/**
 * Instance information representing a BRV Core process.
 *
 * Architecture note:
 * - File exists + pid alive  → instance is running
 * - File exists + pid dead   → stale (crash), can overwrite
 * - File doesn't exist       → no instance
 *
 * @remarks
 * This class is immutable. All properties are readonly and Date is stored
 * as a timestamp internally to prevent external mutation.
 */
export class InstanceInfo {
  public readonly pid: number
  public readonly port: number
  public readonly version: string | undefined

  /**
   * Internal timestamp storage to ensure immutability.
   * Use getStartedAt() to get a Date object.
   */
  readonly #startedAtMs: number

  private constructor(data: {pid: number; port: number; startedAtMs: number; version?: string}) {
    this.pid = data.pid
    this.port = data.port
    this.version = data.version
    this.#startedAtMs = data.startedAtMs
  }

  /**
   * Gets the start time as a new Date object.
   * Returns a defensive copy to prevent external mutation.
   */
  public getStartedAt(): Date {
    return new Date(this.#startedAtMs)
  }

  /**
   * Creates a new instance info.
   */
  public static create(data: {pid: number; port: number; version?: string}): InstanceInfo {
    return new InstanceInfo({
      pid: data.pid,
      port: data.port,
      startedAtMs: Date.now(),
      version: data.version,
    })
  }

  /**
   * Creates instance info from JSON data (from instance.json file).
   * @throws InvalidInstanceDataError if the JSON data is invalid or malformed
   */
  public static fromJson(json: InstanceInfoJson): InstanceInfo {
    // Validate required fields exist and have correct types
    InstanceInfo.validateJson(json)

    return new InstanceInfo({
      pid: json.pid,
      port: json.port,
      startedAtMs: json.startedAt,
      version: json.version,
    })
  }

  /**
   * Validates JSON data before creating an instance.
   * @throws InvalidInstanceDataError if validation fails
   */
  private static validateJson(json: unknown): asserts json is InstanceInfoJson {
    if (typeof json !== 'object' || json === null) {
      throw new InvalidInstanceDataError('expected object, got ' + (json === null ? 'null' : typeof json))
    }

    const obj = json as Record<string, unknown>

    // Validate pid
    if (typeof obj.pid !== 'number') {
      throw new InvalidInstanceDataError('pid must be a number', 'pid', obj.pid)
    }
    if (!Number.isInteger(obj.pid) || obj.pid <= 0) {
      throw new InvalidInstanceDataError('pid must be a positive integer', 'pid', obj.pid)
    }

    // Validate port — IANA dynamic/private range (49152-65535)
    // Must match DAEMON_PORT_MIN/MAX in constants.ts
    if (typeof obj.port !== 'number') {
      throw new InvalidInstanceDataError('port must be a number', 'port', obj.port)
    }
    if (!Number.isInteger(obj.port) || obj.port < 49152 || obj.port > 65535) {
      throw new InvalidInstanceDataError('port must be in dynamic/private range (49152-65535)', 'port', obj.port)
    }

    // Validate startedAt
    if (typeof obj.startedAt !== 'number') {
      throw new InvalidInstanceDataError('startedAt must be a number', 'startedAt', obj.startedAt)
    }
    if (!Number.isInteger(obj.startedAt) || obj.startedAt <= 0) {
      throw new InvalidInstanceDataError('startedAt must be a positive integer timestamp', 'startedAt', obj.startedAt)
    }
  }

  /**
   * Returns the transport URL for connecting to this instance.
   *
   * @param host - The host address (default: '127.0.0.1' for localhost).
   *               Using IP address instead of 'localhost' for better sandbox compatibility.
   * @returns The full URL including protocol, host, and port
   */
  public getTransportUrl(host: string = DEFAULT_TRANSPORT_HOST): string {
    return `http://${host}:${this.port}`
  }

  /**
   * Converts instance info to JSON for persistence.
   */
  public toJson(): InstanceInfoJson {
    return {
      pid: this.pid,
      port: this.port,
      startedAt: this.#startedAtMs,
      ...(this.version !== undefined && {version: this.version}),
    }
  }
}
