import {expect} from 'chai'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {tmpdir} from 'node:os'

import {FileInstanceReader} from '../../infra/file-instance-reader.js'

describe('FileInstanceReader', () => {
  let reader: FileInstanceReader
  let testDir: string

  beforeEach(async () => {
    reader = new FileInstanceReader()
    // Create a unique temp directory for each test
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'file-instance-reader-test-'))
  })

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(testDir, {recursive: true, force: true})
  })

  describe('load()', () => {
    it('should return InstanceInfo when file exists and is valid', async () => {
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})
      await fs.writeFile(
        path.join(brvDir, 'instance.json'),
        JSON.stringify({
          pid: 1234,
          port: 9847,
          currentSessionId: 'session-123',
          startedAt: 1704067200000,
        }),
      )

      const result = await reader.load(testDir)

      expect(result).to.not.be.undefined
      expect(result?.pid).to.equal(1234)
      expect(result?.port).to.equal(9847)
      expect(result?.currentSessionId).to.equal('session-123')
    })

    it('should return undefined when .brv directory does not exist', async () => {
      const result = await reader.load(testDir)

      expect(result).to.be.undefined
    })

    it('should return undefined when instance.json does not exist', async () => {
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})

      const result = await reader.load(testDir)

      expect(result).to.be.undefined
    })

    it('should return undefined when JSON is invalid', async () => {
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})
      await fs.writeFile(path.join(brvDir, 'instance.json'), 'not valid json')

      const result = await reader.load(testDir)

      expect(result).to.be.undefined
    })

    it('should return undefined when JSON is missing required fields', async () => {
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})
      await fs.writeFile(path.join(brvDir, 'instance.json'), JSON.stringify({pid: 1234}))

      const result = await reader.load(testDir)

      expect(result).to.be.undefined
    })

    it('should return undefined when pid is not a number', async () => {
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})
      await fs.writeFile(
        path.join(brvDir, 'instance.json'),
        JSON.stringify({
          pid: 'not-a-number',
          port: 9847,
          currentSessionId: null,
          startedAt: 1704067200000,
        }),
      )

      const result = await reader.load(testDir)

      expect(result).to.be.undefined
    })

    it('should return undefined when port is not a number', async () => {
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})
      await fs.writeFile(
        path.join(brvDir, 'instance.json'),
        JSON.stringify({
          pid: 1234,
          port: 'not-a-number',
          currentSessionId: null,
          startedAt: 1704067200000,
        }),
      )

      const result = await reader.load(testDir)

      expect(result).to.be.undefined
    })

    it('should handle null currentSessionId', async () => {
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})
      await fs.writeFile(
        path.join(brvDir, 'instance.json'),
        JSON.stringify({
          pid: 1234,
          port: 9847,
          currentSessionId: null,
          startedAt: 1704067200000,
        }),
      )

      const result = await reader.load(testDir)

      expect(result).to.not.be.undefined
      expect(result?.currentSessionId).to.be.null
    })

    it('should handle string currentSessionId', async () => {
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})
      await fs.writeFile(
        path.join(brvDir, 'instance.json'),
        JSON.stringify({
          pid: 1234,
          port: 9847,
          currentSessionId: 'session-abc',
          startedAt: 1704067200000,
        }),
      )

      const result = await reader.load(testDir)

      expect(result).to.not.be.undefined
      expect(result?.currentSessionId).to.equal('session-abc')
    })

    it('should return undefined when currentSessionId is invalid type', async () => {
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})
      await fs.writeFile(
        path.join(brvDir, 'instance.json'),
        JSON.stringify({
          pid: 1234,
          port: 9847,
          currentSessionId: 123, // should be string or null
          startedAt: 1704067200000,
        }),
      )

      const result = await reader.load(testDir)

      expect(result).to.be.undefined
    })

    it('should return undefined when file is empty', async () => {
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})
      await fs.writeFile(path.join(brvDir, 'instance.json'), '')

      const result = await reader.load(testDir)

      expect(result).to.be.undefined
    })

    it('should return undefined when JSON is null', async () => {
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})
      await fs.writeFile(path.join(brvDir, 'instance.json'), 'null')

      const result = await reader.load(testDir)

      expect(result).to.be.undefined
    })

    it('should return undefined when JSON is an array', async () => {
      const brvDir = path.join(testDir, '.brv')
      await fs.mkdir(brvDir, {recursive: true})
      await fs.writeFile(path.join(brvDir, 'instance.json'), '[]')

      const result = await reader.load(testDir)

      expect(result).to.be.undefined
    })
  })
})
