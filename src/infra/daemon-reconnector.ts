import type {ConnectionState, ITransportClient} from '../core/interfaces/i-client.js'

import {type ConnectToDaemonOptions, connectToDaemon} from './daemon-connector.js'

const DEFAULT_INITIAL_DELAY_MS = 1000
const DEFAULT_MAX_DELAY_MS = 30_000
const DEFAULT_BACKOFF_MULTIPLIER = 1.5

/**
 * Options for {@link createDaemonReconnector}.
 */
export type DaemonReconnectorOptions = {
  /** Backoff multiplier. Default: 1.5. */
  backoffMultiplier?: number
  /** Options passed to connectToDaemon() on each reconnection attempt. */
  connectOptions: ConnectToDaemonOptions
  /** Initial backoff delay (ms). Default: 1000. */
  initialDelayMs?: number
  /** Maximum backoff delay (ms). Default: 30000. */
  maxDelayMs?: number
  /**
   * Called after each successful reconnection with the new client.
   * The reconnector has already:
   * - Disconnected the old client
   * - Wired its own state handler on the new client
   *
   * Consumer should update their client reference, re-register event handlers, etc.
   */
  onReconnected: (newClient: ITransportClient) => void | Promise<void>
  /**
   * Called on every state change of the active client (optional).
   * Use for logging, UI updates, etc.
   * Reconnection is already handled internally — no need to trigger it here.
   */
  onStateChange?: (state: ConnectionState, client: ITransportClient) => void
}

/** Handle returned by {@link createDaemonReconnector} to cancel auto-reconnection. */
export type DaemonReconnectorHandle = {
  /** Cancel auto-reconnection. Cleans up timers and state handlers. */
  cancel: () => void
}

/** Dependencies for createDaemonReconnector — injectable for unit testing. */
export type DaemonReconnectorDeps = {
  connectToDaemon: typeof connectToDaemon
}

const defaultDeps: DaemonReconnectorDeps = {
  connectToDaemon,
}

/**
 * Watches a client for disconnection and auto-reconnects via connectToDaemon().
 *
 * Flow on disconnect:
 * 1. Wait with exponential backoff
 * 2. Call connectToDaemon(connectOptions) to spawn daemon + connect
 * 3. Disconnect old client (stops its internal Tier 1/2/3 reconnection)
 * 4. Wire state handler on new client
 * 5. Call onReconnected(newClient) for consumer-specific setup
 * 6. Watch new client for future disconnects (repeats from step 1)
 *
 * Also handles Socket.IO built-in reconnection: when state transitions
 * to 'connected' without a full reconnect, backoff delay is reset.
 *
 * @param client - The initial (already connected) client to watch
 * @param options - Reconnection options and callbacks
 * @param deps - Injectable dependencies (for testing)
 * @returns Handle to cancel auto-reconnection
 */
export function createDaemonReconnector(
  client: ITransportClient,
  options: DaemonReconnectorOptions,
  deps: DaemonReconnectorDeps = defaultDeps,
): DaemonReconnectorHandle {
  const {
    backoffMultiplier = DEFAULT_BACKOFF_MULTIPLIER,
    connectOptions,
    initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    onReconnected,
    onStateChange,
  } = options

  let cancelled = false
  let currentClient = client
  let stateUnsubscribe: (() => void) | undefined
  let reconnectTimer: NodeJS.Timeout | undefined
  let isReconnecting = false
  let currentDelay = initialDelayMs

  function wireStateHandler(targetClient: ITransportClient): void {
    stateUnsubscribe?.()
    stateUnsubscribe = targetClient.onStateChange((state: ConnectionState) => {
      if (cancelled) return

      // Notify consumer of state change (for logging, UI updates, etc.)
      onStateChange?.(state, targetClient)

      if (state === 'connected') {
        // Socket.IO built-in reconnect succeeded — reset backoff
        currentDelay = initialDelayMs
        isReconnecting = false
      }

      if (state === 'disconnected') {
        attemptReconnect()
      }
    })
  }

  function attemptReconnect(): void {
    if (cancelled || isReconnecting) return

    isReconnecting = true

    reconnectTimer = setTimeout(async () => {
      if (cancelled) return

      try {
        const result = await deps.connectToDaemon(connectOptions)

        if (cancelled) {
          await result.client.disconnect()
          return
        }

        // Disconnect old client (stops its internal Tier 1/2/3 reconnection)
        const oldClient = currentClient
        try {
          await oldClient.disconnect()
        } catch {
          // Ignore disconnect errors on old client
        }

        currentClient = result.client
        currentDelay = initialDelayMs
        isReconnecting = false

        // Wire state handler on new client first (before consumer callback)
        wireStateHandler(result.client)

        // Notify consumer (update reference, re-register handlers, etc.)
        await onReconnected(result.client)
      } catch {
        // Exponential backoff (capped)
        currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs)
        isReconnecting = false

        // Retry
        attemptReconnect()
      }
    }, currentDelay)
  }

  // Wire initial client
  wireStateHandler(client)

  return {
    cancel: () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      stateUnsubscribe?.()
    },
  }
}
