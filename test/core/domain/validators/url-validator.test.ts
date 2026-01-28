import {describe, it} from 'mocha'
import {expect} from 'chai'
import {validateTransportUrl} from '../../../../core/domain/validators/url-validator.js'
import {InvalidTransportUrlError} from '../../../../core/domain/errors/transport-error.js'

describe('validateTransportUrl', () => {
  describe('valid URLs', () => {
    it('should accept http URL with localhost', () => {
      expect(() => validateTransportUrl('http://localhost:3000')).to.not.throw()
    })

    it('should accept http URL with 127.0.0.1', () => {
      expect(() => validateTransportUrl('http://127.0.0.1:3000')).to.not.throw()
    })

    it('should accept https URL', () => {
      expect(() => validateTransportUrl('https://example.com')).to.not.throw()
    })

    it('should accept https URL with port', () => {
      expect(() => validateTransportUrl('https://example.com:8443')).to.not.throw()
    })

    it('should accept ws URL', () => {
      expect(() => validateTransportUrl('ws://localhost:3000')).to.not.throw()
    })

    it('should accept wss URL', () => {
      expect(() => validateTransportUrl('wss://example.com:8443')).to.not.throw()
    })

    it('should accept URL with path', () => {
      expect(() => validateTransportUrl('http://localhost:3000/socket.io')).to.not.throw()
    })

    it('should accept URL with query string', () => {
      expect(() => validateTransportUrl('http://localhost:3000?token=abc')).to.not.throw()
    })

    it('should accept URL with leading/trailing spaces', () => {
      expect(() => validateTransportUrl('  http://localhost:3000  ')).to.not.throw()
    })
  })

  describe('boundary values - port numbers', () => {
    it('should accept port 1 (minimum valid port)', () => {
      expect(() => validateTransportUrl('http://localhost:1')).to.not.throw()
    })

    it('should accept port 80 (default HTTP)', () => {
      expect(() => validateTransportUrl('http://localhost:80')).to.not.throw()
    })

    it('should accept port 443 (default HTTPS)', () => {
      expect(() => validateTransportUrl('https://localhost:443')).to.not.throw()
    })

    it('should accept port 65535 (maximum valid port)', () => {
      expect(() => validateTransportUrl('http://localhost:65535')).to.not.throw()
    })

    it('should accept URL without port (uses default)', () => {
      expect(() => validateTransportUrl('http://localhost')).to.not.throw()
    })
  })

  describe('invalid protocols', () => {
    it('should reject ftp protocol', () => {
      expect(() => validateTransportUrl('ftp://example.com')).to.throw(
        InvalidTransportUrlError,
        'protocol must be one of: http:, https:, ws:, wss:',
      )
    })

    it('should reject file protocol', () => {
      expect(() => validateTransportUrl('file:///path/to/file')).to.throw(
        InvalidTransportUrlError,
        'protocol must be one of: http:, https:, ws:, wss:',
      )
    })

    it('should reject custom protocol', () => {
      expect(() => validateTransportUrl('custom://example.com')).to.throw(
        InvalidTransportUrlError,
        'protocol must be one of: http:, https:, ws:, wss:',
      )
    })

    it('should reject missing protocol', () => {
      expect(() => validateTransportUrl('example.com')).to.throw(InvalidTransportUrlError, 'URL is malformed')
    })

    it('should reject protocol without colon', () => {
      expect(() => validateTransportUrl('http//example.com')).to.throw(InvalidTransportUrlError, 'URL is malformed')
    })
  })

  describe('invalid URLs', () => {
    it('should reject empty string', () => {
      expect(() => validateTransportUrl('')).to.throw(InvalidTransportUrlError, 'URL must be a non-empty string')
    })

    it('should reject whitespace-only string', () => {
      expect(() => validateTransportUrl('   ')).to.throw(InvalidTransportUrlError, 'URL must be a non-empty string')
    })

    it('should reject null', () => {
      expect(() => validateTransportUrl(null as any)).to.throw(
        InvalidTransportUrlError,
        'URL must be a non-empty string',
      )
    })

    it('should reject undefined', () => {
      expect(() => validateTransportUrl(undefined as any)).to.throw(
        InvalidTransportUrlError,
        'URL must be a non-empty string',
      )
    })

    it('should reject number', () => {
      expect(() => validateTransportUrl(123 as any)).to.throw(
        InvalidTransportUrlError,
        'URL must be a non-empty string',
      )
    })

    it('should reject object', () => {
      expect(() => validateTransportUrl({} as any)).to.throw(InvalidTransportUrlError, 'URL must be a non-empty string')
    })

    it('should reject array', () => {
      expect(() => validateTransportUrl([] as any)).to.throw(InvalidTransportUrlError, 'URL must be a non-empty string')
    })

    it('should reject malformed URL', () => {
      expect(() => validateTransportUrl('not-a-url')).to.throw(InvalidTransportUrlError, 'URL is malformed')
    })

    it('should reject URL without hostname', () => {
      expect(() => validateTransportUrl('http://')).to.throw(InvalidTransportUrlError, 'URL is malformed')
    })

    it('should reject URL with only protocol', () => {
      expect(() => validateTransportUrl('http:')).to.throw(InvalidTransportUrlError)
    })
  })

  describe('edge cases', () => {
    it('should handle URL with IPv6 address', () => {
      expect(() => validateTransportUrl('http://[::1]:3000')).to.not.throw()
    })

    it('should handle URL with authentication', () => {
      expect(() => validateTransportUrl('http://user:pass@localhost:3000')).to.not.throw()
    })

    it('should handle URL with fragment', () => {
      expect(() => validateTransportUrl('http://localhost:3000#section')).to.not.throw()
    })
  })
})
