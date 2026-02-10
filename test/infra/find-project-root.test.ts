import {expect} from 'chai'
import * as fs from 'node:fs/promises'
import {tmpdir} from 'node:os'
import * as path from 'node:path'

import {BRV_DIR} from '../../src/constants.js'
import {findProjectRoot} from '../../src/infra/find-project-root.js'

describe('findProjectRoot', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'find-project-root-test-'))
    // Resolve symlinks (e.g., /var → /private/var on macOS)
    testDir = await fs.realpath(testDir)
  })

  afterEach(async () => {
    await fs.rm(testDir, {recursive: true, force: true})
  })

  it('should find project root in current directory', async () => {
    // Setup: testDir/.brv/config.json
    await fs.mkdir(path.join(testDir, BRV_DIR), {recursive: true})
    await fs.writeFile(path.join(testDir, BRV_DIR, 'config.json'), '{}')

    const result = await findProjectRoot(testDir)

    expect(result).to.equal(testDir)
  })

  it('should walk up from subdirectory to find project root', async () => {
    // Setup: testDir/.brv/config.json + testDir/src/modules/
    await fs.mkdir(path.join(testDir, BRV_DIR), {recursive: true})
    await fs.writeFile(path.join(testDir, BRV_DIR, 'config.json'), '{}')
    const deepDir = path.join(testDir, 'src', 'modules')
    await fs.mkdir(deepDir, {recursive: true})

    const result = await findProjectRoot(deepDir)

    expect(result).to.equal(testDir)
  })

  it('should skip bare .brv/ directory without config.json', async () => {
    // Setup: testDir/sub/.brv/sessions/ (no config.json) — should NOT match
    const subDir = path.join(testDir, 'sub')
    await fs.mkdir(path.join(subDir, BRV_DIR, 'sessions'), {recursive: true})

    const result = await findProjectRoot(subDir)

    expect(result).to.be.undefined
  })

  it('should return undefined when no project root is found', async () => {
    // Setup: empty temp dir with no .brv/ anywhere
    const emptyDir = path.join(testDir, 'some', 'dir')
    await fs.mkdir(emptyDir, {recursive: true})

    const result = await findProjectRoot(emptyDir)

    expect(result).to.be.undefined
  })

  it('should find nearest project root when multiple exist', async () => {
    // Setup: testDir/.brv/config.json AND testDir/inner/.brv/config.json + testDir/inner/deep/
    await fs.mkdir(path.join(testDir, BRV_DIR), {recursive: true})
    await fs.writeFile(path.join(testDir, BRV_DIR, 'config.json'), '{}')

    const innerDir = path.join(testDir, 'inner')
    await fs.mkdir(path.join(innerDir, BRV_DIR), {recursive: true})
    await fs.writeFile(path.join(innerDir, BRV_DIR, 'config.json'), '{}')

    const deepDir = path.join(innerDir, 'deep')
    await fs.mkdir(deepDir, {recursive: true})

    const result = await findProjectRoot(deepDir)

    // Should find the nearest (inner), not the outermost (testDir)
    expect(result).to.equal(innerDir)
  })
})
