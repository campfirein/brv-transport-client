import {InvalidTransportUrlError} from '../errors/transport-error.js'

/**
 * Valid protocols for transport connections.
 * Socket.IO supports HTTP, HTTPS, WebSocket, and secure WebSocket protocols.
 */
const VALID_PROTOCOLS = ['http:', 'https:', 'ws:', 'wss:']

/**
 * Validates that a transport URL is properly formatted and uses a supported protocol.
 *
 * @param url - The URL to validate
 * @throws InvalidTransportUrlError if URL is invalid
 *
 * @remarks
 * Validation rules:
 * - Must be a non-empty string
 * - Must be a valid URL format (parseable by URL constructor)
 * - Must use one of the supported protocols: http, https, ws, wss
 * - Must have a hostname
 *
 * Business rules:
 * - Socket.IO supports HTTP/HTTPS for long-polling and WebSocket fallback
 * - WebSocket protocols (ws/wss) for native WebSocket connections
 *
 * @example
 * ```typescript
 * validateTransportUrl('http://localhost:3000')  // OK
 * validateTransportUrl('https://example.com')    // OK
 * validateTransportUrl('ws://localhost:3000')    // OK
 * validateTransportUrl('')                       // Throws InvalidTransportUrlError
 * validateTransportUrl('ftp://example.com')      // Throws InvalidTransportUrlError (unsupported protocol)
 * validateTransportUrl('not-a-url')              // Throws InvalidTransportUrlError (malformed)
 * ```
 */
export function validateTransportUrl(url: string): void {
  // Check for null/undefined/empty
  if (!url || typeof url !== 'string') {
    throw new InvalidTransportUrlError(String(url), 'URL must be a non-empty string')
  }

  // Check for empty after trimming
  const trimmedUrl = url.trim()
  if (trimmedUrl.length === 0) {
    throw new InvalidTransportUrlError(url, 'URL must be a non-empty string')
  }

  // Validate URL format using URL constructor
  let parsedUrl: URL
  try {
    parsedUrl = new URL(trimmedUrl)
  } catch {
    throw new InvalidTransportUrlError(url, 'URL is malformed')
  }

  // Validate protocol (Socket.IO supports http, https, ws, wss)
  if (!VALID_PROTOCOLS.includes(parsedUrl.protocol)) {
    throw new InvalidTransportUrlError(url, `protocol must be one of: ${VALID_PROTOCOLS.join(', ')}`)
  }

  // Validate hostname exists
  if (!parsedUrl.hostname) {
    throw new InvalidTransportUrlError(url, 'hostname is required')
  }
}
