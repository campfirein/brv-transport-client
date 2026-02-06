import {expect} from 'chai'
import {homedir} from 'node:os'
import {join} from 'node:path'

import {getGlobalDataDir} from '../../src/infra/global-data-path.js'

describe('getGlobalDataDir()', () => {
  let originalPlatform: string
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalPlatform = process.platform
    originalEnv = {...process.env}
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    })
    process.env = originalEnv
  })

  describe('BRV_DATA_DIR override', () => {
    it('should use BRV_DATA_DIR when set (any platform)', () => {
      process.env.BRV_DATA_DIR = '/custom/override/path'

      const result = getGlobalDataDir()

      expect(result).to.equal('/custom/override/path')
    })

    it('should take priority over platform-specific paths', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      })
      process.env.BRV_DATA_DIR = '/override'
      process.env.LOCALAPPDATA = '/should/not/use'

      const result = getGlobalDataDir()

      expect(result).to.equal('/override')
    })
  })

  describe('Linux', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      })
      delete process.env.BRV_DATA_DIR
    })

    it('should use XDG_DATA_HOME when set', () => {
      process.env.XDG_DATA_HOME = '/custom/data/home'

      const result = getGlobalDataDir()

      expect(result).to.equal('/custom/data/home/brv')
    })

    it('should fall back to ~/.local/share when XDG_DATA_HOME unset', () => {
      delete process.env.XDG_DATA_HOME

      const result = getGlobalDataDir()

      expect(result).to.equal(join(homedir(), '.local', 'share', 'brv'))
    })

    it('should fall back to ~/.local/share when XDG_DATA_HOME is empty string', () => {
      process.env.XDG_DATA_HOME = ''

      const result = getGlobalDataDir()

      // Empty string is falsy — falls back to default
      expect(result).to.equal(join(homedir(), '.local', 'share', 'brv'))
    })
  })

  describe('macOS', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      })
      delete process.env.BRV_DATA_DIR
    })

    it('should use ~/Library/Application Support/brv', () => {
      const result = getGlobalDataDir()

      expect(result).to.equal(join(homedir(), 'Library', 'Application Support', 'brv'))
    })

    it('should NOT use XDG_DATA_HOME even when set', () => {
      process.env.XDG_DATA_HOME = '/custom/xdg'

      const result = getGlobalDataDir()

      // macOS ignores XDG — uses native convention
      expect(result).to.equal(join(homedir(), 'Library', 'Application Support', 'brv'))
    })
  })

  describe('Windows', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      })
      delete process.env.BRV_DATA_DIR
    })

    it('should use LOCALAPPDATA when set', () => {
      const testLocalAppData = join(homedir(), 'AppData', 'Local')
      process.env.LOCALAPPDATA = testLocalAppData

      const result = getGlobalDataDir()

      expect(result).to.equal(join(testLocalAppData, 'brv'))
    })

    it('should fall back to ~/AppData/Local when LOCALAPPDATA unset', () => {
      delete process.env.LOCALAPPDATA

      const result = getGlobalDataDir()

      expect(result).to.equal(join(homedir(), 'AppData', 'Local', 'brv'))
    })

    it('should fall back to ~/AppData/Local when LOCALAPPDATA is empty string', () => {
      process.env.LOCALAPPDATA = ''

      const result = getGlobalDataDir()

      // Empty string is falsy — falls back to default
      expect(result).to.equal(join(homedir(), 'AppData', 'Local', 'brv'))
    })
  })

  describe('Edge cases', () => {
    beforeEach(() => {
      delete process.env.BRV_DATA_DIR
    })

    it('should handle path with spaces in XDG_DATA_HOME', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      })
      process.env.XDG_DATA_HOME = '/path with spaces/data'

      const result = getGlobalDataDir()

      expect(result).to.equal('/path with spaces/data/brv')
    })

    it('should handle path with special characters', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      })
      process.env.XDG_DATA_HOME = '/path-with_special.chars/data'

      const result = getGlobalDataDir()

      expect(result).to.equal('/path-with_special.chars/data/brv')
    })

    it('should always append "brv" subdirectory on Linux', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      })
      process.env.XDG_DATA_HOME = '/data'

      const result = getGlobalDataDir()

      expect(result).to.equal('/data/brv')
      expect(result.endsWith('brv')).to.be.true
    })

    it('should always append "brv" subdirectory on macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      })

      const result = getGlobalDataDir()

      expect(result.endsWith('brv')).to.be.true
    })

    it('should fall back to ~/.local/share for unknown platforms', () => {
      Object.defineProperty(process, 'platform', {
        value: 'freebsd',
        configurable: true,
      })
      delete process.env.XDG_DATA_HOME

      const result = getGlobalDataDir()

      expect(result).to.equal(join(homedir(), '.local', 'share', 'brv'))
    })
  })
})
