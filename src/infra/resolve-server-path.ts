import {accessSync, realpathSync} from 'node:fs'
import {delimiter, dirname, join, resolve} from 'node:path'

/**
 * Resolves the path to brv-server.js (the daemon entry point).
 *
 * Resolution order:
 * 1. `serverPath` parameter — explicit override (byterover-cli always uses this)
 * 2. `BRV_SERVER_MAIN` env var — for dev mode or custom installs
 * 3. Auto-resolve: find `brv` binary in PATH → follow symlink → derive path
 *
 * @throws Error if path cannot be resolved by any strategy
 */
export function resolveServerPath(serverPath?: string): string {
  // 1. Explicit override
  if (serverPath) {
    return serverPath
  }

  // 2. Environment variable
  if (process.env.BRV_SERVER_MAIN) {
    return process.env.BRV_SERVER_MAIN
  }

  // 3. Auto-resolve via brv binary in PATH
  return autoResolveFromPath()
}

/**
 * Finds `brv` binary in PATH using pure Node.js (no shell exec).
 * Follows symlink chain to real path, then derives brv-server.js location.
 */
function autoResolveFromPath(): string {
  const pathDirs = (process.env.PATH ?? '').split(delimiter)

  for (const dir of pathDirs) {
    const candidate = join(dir, 'brv')
    try {
      accessSync(candidate)
      // Found brv binary. Follow symlink chain to real path.
      const realPath = realpathSync(candidate)
      // realPath is e.g. /path/to/byterover-cli/bin/run.js
      // Navigate up from bin/ to package root
      const packageRoot = resolve(dirname(realPath), '..')
      const serverMain = join(packageRoot, 'dist', 'server', 'infra', 'daemon', 'brv-server.js')
      // Verify the file exists
      accessSync(serverMain)
      return serverMain
    } catch {
      // Not found at this PATH entry, continue
    }
  }

  throw new Error(
    'Cannot resolve brv-server.js path. ' +
      'Ensure `brv` is installed globally and in PATH, or set BRV_SERVER_MAIN environment variable.',
  )
}
