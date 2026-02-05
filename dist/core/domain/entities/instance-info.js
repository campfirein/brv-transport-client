import { InvalidInstanceDataError } from '../errors/connection-error.js';
/**
 * Default transport host for localhost connections.
 * Using IP address instead of 'localhost' for better sandbox compatibility.
 */
const DEFAULT_TRANSPORT_HOST = '127.0.0.1';
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
    currentSessionId;
    pid;
    port;
    /**
     * Internal timestamp storage to ensure immutability.
     * Use getStartedAt() to get a Date object.
     */
    #startedAtMs;
    constructor(data) {
        this.currentSessionId = data.currentSessionId;
        this.pid = data.pid;
        this.port = data.port;
        this.#startedAtMs = data.startedAtMs;
    }
    /**
     * Gets the start time as a new Date object.
     * Returns a defensive copy to prevent external mutation.
     */
    getStartedAt() {
        return new Date(this.#startedAtMs);
    }
    /**
     * Creates a new instance info.
     */
    static create(data) {
        return new InstanceInfo({
            currentSessionId: data.currentSessionId ?? null,
            pid: data.pid,
            port: data.port,
            startedAtMs: Date.now(),
        });
    }
    /**
     * Creates instance info from JSON data (from instance.json file).
     * @throws InvalidInstanceDataError if the JSON data is invalid or malformed
     */
    static fromJson(json) {
        // Validate required fields exist and have correct types
        InstanceInfo.validateJson(json);
        return new InstanceInfo({
            currentSessionId: json.currentSessionId,
            pid: json.pid,
            port: json.port,
            startedAtMs: json.startedAt,
        });
    }
    /**
     * Validates JSON data before creating an instance.
     * @throws InvalidInstanceDataError if validation fails
     */
    static validateJson(json) {
        if (typeof json !== 'object' || json === null) {
            throw new InvalidInstanceDataError('expected object, got ' + (json === null ? 'null' : typeof json));
        }
        const obj = json;
        // Validate pid
        if (typeof obj.pid !== 'number') {
            throw new InvalidInstanceDataError('pid must be a number', 'pid', obj.pid);
        }
        if (!Number.isInteger(obj.pid) || obj.pid <= 0) {
            throw new InvalidInstanceDataError('pid must be a positive integer', 'pid', obj.pid);
        }
        // Validate port
        if (typeof obj.port !== 'number') {
            throw new InvalidInstanceDataError('port must be a number', 'port', obj.port);
        }
        if (!Number.isInteger(obj.port) || obj.port <= 0 || obj.port > 65535) {
            throw new InvalidInstanceDataError('port must be a valid port number (1-65535)', 'port', obj.port);
        }
        // Validate startedAt
        if (typeof obj.startedAt !== 'number') {
            throw new InvalidInstanceDataError('startedAt must be a number', 'startedAt', obj.startedAt);
        }
        if (!Number.isInteger(obj.startedAt) || obj.startedAt <= 0) {
            throw new InvalidInstanceDataError('startedAt must be a positive integer timestamp', 'startedAt', obj.startedAt);
        }
        // Validate currentSessionId (can be null or string)
        if (obj.currentSessionId !== null && typeof obj.currentSessionId !== 'string') {
            throw new InvalidInstanceDataError('currentSessionId must be null or a string', 'currentSessionId', obj.currentSessionId);
        }
    }
    /**
     * Returns the transport URL for connecting to this instance.
     *
     * @param host - The host address (default: '127.0.0.1' for localhost).
     *               Using IP address instead of 'localhost' for better sandbox compatibility.
     * @returns The full URL including protocol, host, and port
     */
    getTransportUrl(host = DEFAULT_TRANSPORT_HOST) {
        return `http://${host}:${this.port}`;
    }
    /**
     * Converts instance info to JSON for persistence.
     */
    toJson() {
        return {
            currentSessionId: this.currentSessionId,
            pid: this.pid,
            port: this.port,
            startedAt: this.#startedAtMs,
        };
    }
    /**
     * Creates a new instance info with updated session ID.
     * Returns a new immutable instance.
     */
    withSessionId(sessionId) {
        return new InstanceInfo({
            currentSessionId: sessionId,
            pid: this.pid,
            port: this.port,
            startedAtMs: this.#startedAtMs,
        });
    }
}
//# sourceMappingURL=instance-info.js.map