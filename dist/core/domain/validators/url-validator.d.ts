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
export declare function validateTransportUrl(url: string): void;
//# sourceMappingURL=url-validator.d.ts.map