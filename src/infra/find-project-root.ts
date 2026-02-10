import {access} from 'node:fs/promises'
import {dirname, join} from 'node:path'

import {BRV_DIR} from '../constants.js'

/**
 * Walk up from startDir to find the nearest directory containing .brv/config.json.
 *
 * Checks for .brv/config.json specifically — a bare .brv/ directory
 * (e.g., with only sessions/) is NOT considered a project root.
 *
 * @param startDir - Directory to start searching from
 * @returns The project root directory, or undefined if not found
 */
export async function findProjectRoot(startDir: string): Promise<string | undefined> {
  let currentDir = startDir

  while (true) {
    try {
      await access(join(currentDir, BRV_DIR, 'config.json'))
      return currentDir
    } catch {
      // config.json not found at this level, walk up
    }

    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) {
      // Reached filesystem root
      return undefined
    }

    currentDir = parentDir
  }
}
