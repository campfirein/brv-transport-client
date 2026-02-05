import {expect} from 'chai'
import {mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {resolveServerPath} from '../../src/infra/resolve-server-path.js'

describe('resolve-server-path', () => {
  let testDir: string

  beforeEach(() => {
    testDir = realpathSync(mkdtempSync(join(tmpdir(), 'brv-resolve-test-')))
  })

  afterEach(() => {
    rmSync(testDir, {force: true, recursive: true})
  })

  describe('resolveServerPath()', () => {
    it('should return explicit path when provided', () => {
      const path = '/custom/path/brv-server.js'
      expect(resolveServerPath(path)).to.equal(path)
    })

    it('should use BRV_SERVER_MAIN env var when set', () => {
      const original = process.env.BRV_SERVER_MAIN
      try {
        process.env.BRV_SERVER_MAIN = '/env/path/brv-server.js'
        expect(resolveServerPath()).to.equal('/env/path/brv-server.js')
      } finally {
        if (original === undefined) {
          delete process.env.BRV_SERVER_MAIN
        } else {
          process.env.BRV_SERVER_MAIN = original
        }
      }
    })

    it('should prefer explicit path over env var', () => {
      const original = process.env.BRV_SERVER_MAIN
      try {
        process.env.BRV_SERVER_MAIN = '/env/path/brv-server.js'
        expect(resolveServerPath('/explicit/brv-server.js')).to.equal('/explicit/brv-server.js')
      } finally {
        if (original === undefined) {
          delete process.env.BRV_SERVER_MAIN
        } else {
          process.env.BRV_SERVER_MAIN = original
        }
      }
    })

    it('should throw when no resolution strategy works', () => {
      const original = process.env.BRV_SERVER_MAIN
      const originalPath = process.env.PATH
      try {
        delete process.env.BRV_SERVER_MAIN
        // Set PATH to temp dir (no brv binary)
        process.env.PATH = testDir
        expect(() => resolveServerPath()).to.throw('Cannot resolve brv-server.js path')
      } finally {
        if (original === undefined) {
          delete process.env.BRV_SERVER_MAIN
        } else {
          process.env.BRV_SERVER_MAIN = original
        }

        process.env.PATH = originalPath
      }
    })
  })
})
