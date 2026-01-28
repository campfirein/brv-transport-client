import {expect} from 'chai'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {tmpdir} from 'node:os'

import {FileInstanceDiscovery} from '../../infra/file-instance-discovery.js'

describe('FileInstanceDiscovery', () => {
  let discovery: FileInstanceDiscovery
  let testDir: string

  beforeEach(async () => {
    discovery = new FileInstanceDiscovery()
    // Create a unique temp directory for each test
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'file-instance-discovery-test-'))
  })

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(testDir, {recursive: true, force: true})
  })

  describe('discover()', () => {
    it('should return found instance when .brv exists and process is alive', async () => {
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})
      // Use current process PID to ensure it's alive
      await fs.writeFile(
        path.join(brvDir, 'instance.json'),
        JSON.stringify({
          pid: process.pid,
          port: 9847,
          currentSessionId: 'session-123',
          startedAt: Date.now(),
        }),
      )

      const result = await discovery.discover(testDir)

      expect(result.found).to.be.true
      if (result.found) {
        expect(result.instance.pid).to.equal(process.pid)
        expect(result.instance.port).to.equal(9847)
        expect(result.projectRoot).to.equal(testDir)
      }
    })

    it('should return no_instance when no .brv directory found', async () => {
      const result = await discovery.discover(testDir)

      expect(result.found).to.be.false
      if (!result.found) {
        expect(result.reason).to.equal('no_instance')
      }
    })

    it('should return no_instance when .brv exists but no instance.json', async () => {
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})

      const result = await discovery.discover(testDir)

      expect(result.found).to.be.false
      if (!result.found) {
        expect(result.reason).to.equal('no_instance')
      }
    })

    it('should return instance_crashed when process is dead', async () => {
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})
      // Use a PID that is very unlikely to exist
      await fs.writeFile(
        path.join(brvDir, 'instance.json'),
        JSON.stringify({
          pid: 999999999,
          port: 9847,
          currentSessionId: null,
          startedAt: Date.now(),
        }),
      )

      const result = await discovery.discover(testDir)

      expect(result.found).to.be.false
      if (!result.found) {
        expect(result.reason).to.equal('instance_crashed')
      }
    })

    it('should walk up directory tree to find .brv', async () => {
      // Create .brv in testDir
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})
      await fs.writeFile(
        path.join(brvDir, 'instance.json'),
        JSON.stringify({
          pid: process.pid,
          port: 9847,
          currentSessionId: null,
          startedAt: Date.now(),
        }),
      )

      // Create a subdirectory
      const subDir = path.join(testDir, 'src', 'components')
      await fs.mkdir(subDir, {recursive: true})

      // Discover from subdirectory
      const result = await discovery.discover(subDir)

      expect(result.found).to.be.true
      if (result.found) {
        expect(result.projectRoot).to.equal(testDir)
      }
    })
  })

  describe('findProjectRoot()', () => {
    it('should return directory containing .brv', async () => {
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})

      const result = await discovery.findProjectRoot(testDir)

      expect(result).to.equal(testDir)
    })

    it('should walk up and find .brv in parent directory', async () => {
      // Create .brv in testDir
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})

      // Create subdirectory
      const subDir = path.join(testDir, 'src')
      await fs.mkdir(subDir, {recursive: true})

      const result = await discovery.findProjectRoot(subDir)

      expect(result).to.equal(testDir)
    })

    it('should return undefined when no .brv found', async () => {
      const result = await discovery.findProjectRoot(testDir)

      expect(result).to.be.undefined
    })
  })

  describe('constructor', () => {
    it('should use default FileInstanceReader when none provided', () => {
      const defaultDiscovery = new FileInstanceDiscovery()

      // Just verify it can be instantiated without error
      expect(defaultDiscovery).to.be.instanceOf(FileInstanceDiscovery)
    })
  })
})
