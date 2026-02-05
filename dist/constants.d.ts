/**
 * Transport Client Constants
 *
 * These constants are duplicated from the main codebase to maintain
 * leaf component independence (no dependencies on other brv modules).
 */
export declare const BRV_DIR = ".brv";
export declare const INSTANCE_FILE = "instance.json";
export declare const TRANSPORT_HOST = "127.0.0.1";
export declare const TRANSPORT_REQUEST_TIMEOUT_MS = 10000;
export declare const TRANSPORT_ROOM_TIMEOUT_MS = 2000;
export declare const TRANSPORT_CONNECT_TIMEOUT_MS = 3000;
export declare const TRANSPORT_RECONNECTION_DELAY_MS = 50;
export declare const TRANSPORT_RECONNECTION_DELAY_MAX_MS = 1000;
export declare const TRANSPORT_RECONNECTION_ATTEMPTS = 30;
export declare const TRANSPORT_DEFAULT_TRANSPORTS: readonly ["websocket"];
export declare const ROOM_MAX_REJOIN_ATTEMPTS = 5;
export declare const ROOM_REJOIN_BASE_DELAY_MS = 50;
//# sourceMappingURL=constants.d.ts.map