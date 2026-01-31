import {homedir} from 'node:os'
import {join} from 'node:path'

/**
 * Returns the global data directory for BRV daemon state.
 *
 * Follows XDG Base Directory Specification:
 * - Linux: $XDG_DATA_HOME/brv or ~/.local/share/brv
 * - macOS: ~/.local/share/brv
 * - Windows: %LOCALAPPDATA%/brv
 */
export function getGlobalDataDir(): string {
  if (process.platform === 'win32') {
    return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'brv')
  }

  // Linux/macOS: XDG_DATA_HOME or ~/.local/share
  return join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'brv')
}
