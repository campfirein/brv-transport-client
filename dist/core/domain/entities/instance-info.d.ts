/**
 * Raw instance data as stored in instance.json.
 * Used for serialization/deserialization.
 *
 * NOTE: We don't store "status" - we check pid alive at runtime instead.
 * This avoids stale status when process crashes.
 */
export type InstanceInfoJson = {
    /** Current active session ID (for quick lookup without DB query) */
    currentSessionId: null | string;
    /** Process ID of the Core process */
    pid: number;
    /** Port the transport server is listening on */
    port: number;
    /** Timestamp when instance started (ms since epoch) */
    startedAt: number;
};
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
export declare class InstanceInfo {
    #private;
    readonly currentSessionId: null | string;
    readonly pid: number;
    readonly port: number;
    private constructor();
    /**
     * Gets the start time as a new Date object.
     * Returns a defensive copy to prevent external mutation.
     */
    getStartedAt(): Date;
    /**
     * Creates a new instance info.
     */
    static create(data: {
        currentSessionId?: null | string;
        pid: number;
        port: number;
    }): InstanceInfo;
    /**
     * Creates instance info from JSON data (from instance.json file).
     * @throws InvalidInstanceDataError if the JSON data is invalid or malformed
     */
    static fromJson(json: InstanceInfoJson): InstanceInfo;
    /**
     * Validates JSON data before creating an instance.
     * @throws InvalidInstanceDataError if validation fails
     */
    private static validateJson;
    /**
     * Returns the transport URL for connecting to this instance.
     *
     * @param host - The host address (default: '127.0.0.1' for localhost).
     *               Using IP address instead of 'localhost' for better sandbox compatibility.
     * @returns The full URL including protocol, host, and port
     */
    getTransportUrl(host?: string): string;
    /**
     * Converts instance info to JSON for persistence.
     */
    toJson(): InstanceInfoJson;
    /**
     * Creates a new instance info with updated session ID.
     * Returns a new immutable instance.
     */
    withSessionId(sessionId: string): InstanceInfo;
}
//# sourceMappingURL=instance-info.d.ts.map