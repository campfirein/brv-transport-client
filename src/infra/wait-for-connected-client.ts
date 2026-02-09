import type {ITransportClient} from '../core/interfaces/i-client.js'

const DEFAULT_TIMEOUT_MS = 60_000
const POLL_INTERVAL_MS = 500

/**
 * Polls a client getter until it returns a connected client, or times out.
 *
 * Useful when the caller's client reference may be replaced in the background
 * (e.g., MCP server's attemptReconnect replaces this.client).
 *
 * @param getClient - Getter that returns the current client (may change between polls)
 * @param timeoutMs - Maximum time to wait (default: 60s)
 * @returns The connected client, or undefined on timeout
 */
export function waitForConnectedClient(
  getClient: () => ITransportClient | undefined,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ITransportClient | undefined> {
  const client = getClient()
  if (client?.getState() === 'connected') return Promise.resolve(client)

  return new Promise<ITransportClient | undefined>((resolve) => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const c = getClient()
      if (c?.getState() === 'connected') {
        clearInterval(interval)
        resolve(c)
        return
      }

      if (Date.now() - startTime >= timeoutMs) {
        clearInterval(interval)
        resolve(undefined)
      }
    }, POLL_INTERVAL_MS)
  })
}
