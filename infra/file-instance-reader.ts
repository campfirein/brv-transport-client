import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

import type {IInstanceReader} from '../core/interfaces/i-instance-reader.js'

import {BRV_DIR, INSTANCE_FILE} from '../constants.js'
import {InstanceInfo, type InstanceInfoJson} from '../core/domain/entities/instance-info.js'

/**
 * Type guard to validate instance.json structure.
 * Ensures all required fields exist with correct types.
 */
function isValidInstanceInfoJson(value: unknown): value is InstanceInfoJson {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const obj = value as Record<string, unknown>

  return (
    typeof obj.pid === 'number' &&
    typeof obj.port === 'number' &&
    typeof obj.startedAt === 'number' &&
    (obj.currentSessionId === null || typeof obj.currentSessionId === 'string')
  )
}

/**
 * File-based implementation of IInstanceReader.
 *
 * Reads instance information from .brv/instance.json.
 * This is a read-only subset of the full FileInstanceManager.
 */
export class FileInstanceReader implements IInstanceReader {
  /**
   * Loads instance info from the project root.
   * Returns undefined if instance.json doesn't exist or is invalid.
   */
  async load(projectRoot: string): Promise<InstanceInfo | undefined> {
    const filePath = join(projectRoot, BRV_DIR, INSTANCE_FILE)

    try {
      const content = await readFile(filePath, 'utf8')
      const json: unknown = JSON.parse(content)

      if (!isValidInstanceInfoJson(json)) {
        // Corrupted file = no valid instance
        return undefined
      }

      return InstanceInfo.fromJson(json)
    } catch {
      // File doesn't exist, is corrupted, or unreadable = no valid instance
      return undefined
    }
  }
}
