/**
 * Transport Client Constants
 *
 * These constants are duplicated from the main codebase to maintain
 * leaf component independence (no dependencies on other brv modules).
 */

// Transport layer constants (optimized for localhost real-time)
export const TRANSPORT_REQUEST_TIMEOUT_MS = 10_000 // 10s - most operations complete quickly
export const TRANSPORT_ROOM_TIMEOUT_MS = 2000 // 2s - room ops are instant on localhost
export const TRANSPORT_CONNECT_TIMEOUT_MS = 3000 // 3s - 127.0.0.1 connects in <10ms
export const TRANSPORT_RECONNECTION_DELAY_MS = 50 // 50ms - ultra aggressive start
export const TRANSPORT_RECONNECTION_DELAY_MAX_MS = 1000 // 1s cap - fail fast, retry fast
export const TRANSPORT_RECONNECTION_ATTEMPTS = 30 // More attempts with faster retry

// WebSocket-only transport to avoid HTTP polling issues in sandboxed environments (Cursor, etc.)
// HTTP polling may be blocked by IDE sandboxes causing "xhr poll error"
export const TRANSPORT_DEFAULT_TRANSPORTS = ['websocket'] as const

// Room manager constants
export const ROOM_MAX_REJOIN_ATTEMPTS = 5 // Max attempts to rejoin a room after reconnect
export const ROOM_REJOIN_BASE_DELAY_MS = 50 // Base delay for exponential backoff (50ms, 100ms, 200ms...)

// Project root discovery (walk-up to find .brv/ directory)
export const BRV_DIR = '.brv'

// Daemon instance discovery constants (platform-specific global data directory)
export const GLOBAL_DATA_DIR = 'brv'
export const DAEMON_INSTANCE_FILE = 'daemon.json'
export const HEARTBEAT_FILE = 'heartbeat'
export const HEARTBEAT_STALE_THRESHOLD_MS = 15_000

// Spawn lock — prevents concurrent daemon spawn attempts
export const SPAWN_LOCK_FILE = 'spawn.lock'
export const SPAWN_LOCK_STALE_THRESHOLD_MS = 30_000 // 30s

// Daemon readiness polling
export const DAEMON_READY_TIMEOUT_MS = 5000 // 5s max wait
export const DAEMON_READY_POLL_INTERVAL_MS = 100 // 100ms between polls

// Daemon spawner — budget allocation for stop + poll
export const DAEMON_STOP_BUDGET_MS = 3000 // 3s max to stop old daemon
export const DAEMON_STOP_POLL_INTERVAL_MS = 100 // 100ms between death checks

// Daemon port range (IANA dynamic/private ports, RFC 6335)
export const DAEMON_PORT_MIN = 49152
export const DAEMON_PORT_MAX = 65535

// TransportClient internal timing
export const TRANSPORT_IS_CONNECTED_TIMEOUT_MS = 2000 // Default ping timeout for isConnected()
export const TRANSPORT_RECONNECT_WAIT_CONNECTED_MS = 5000 // Max wait for socket.connected after reconnect
export const TRANSPORT_RECONNECT_POLL_INTERVAL_MS = 10 // Poll interval during reconnect wait
export const TRANSPORT_ROOM_REJOIN_SETTLE_MS = 50 // Delay before retry room rejoin after force reconnect
export const TRANSPORT_REGISTRATION_TIMEOUT_MS = 3000 // Timeout for client:register ack
