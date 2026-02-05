import type {ClientType} from '../core/domain/types.js'
import type {ConnectionResult} from '../core/interfaces/i-client-factory.js'

import {connectToTransport} from './client-factory.js'
import {DaemonInstanceDiscovery} from './daemon-instance-discovery.js'
import {type EnsureDaemonResult, ensureDaemonRunning} from './daemon-spawner.js'

/**
 * Options for connecting to the daemon.
 *
 * This is the SINGLE entry point for "ensure daemon + connect transport + register client".
 * All consumers should use this instead of calling ensureDaemonRunning() + connectToTransport() separately.
 */
export type ConnectToDaemonOptions = {
  /** Client type for registration. */
  clientType: ClientType
  /** Starting directory for daemon/instance discovery. Default: process.cwd() */
  fromDir?: string
  /** Rooms to join after connection + registration (e.g., ['broadcast-room'] for TUI). */
  joinRooms?: readonly string[]
  /** Project path sent in client:register payload. Omit for MCP global mode. */
  projectPath?: string
  /** Explicit path to brv-server.js. If omitted, auto-resolved via BRV_SERVER_MAIN or PATH. */
  serverPath?: string
  /** Skip registration entirely (e.g., debug commands). Default: false */
  skipRegistration?: boolean
  /** CLI version for daemon version matching (restart unhealthy daemon). */
  version?: string
}

/** Dependencies for connectToDaemon — injectable for unit testing. */
export type ConnectToDaemonDeps = {
  connectToTransport: typeof connectToTransport
  ensureDaemonRunning: (options?: {serverPath?: string; version?: string}) => Promise<EnsureDaemonResult>
}

const defaultDeps: ConnectToDaemonDeps = {
  connectToTransport,
  ensureDaemonRunning,
}

/**
 * Ensures the daemon is running, then connects and registers via transport-client.
 *
 * Flow:
 * 1. ensureDaemonRunning() — spawns daemon if needed (fast no-op if already running)
 * 2. connectToTransport() — discovers instance, connects Socket.IO, registers, joins rooms
 *
 * @throws Error if daemon fails to start within timeout
 * @throws ConnectionError (from transport-client) if connection fails
 */
export async function connectToDaemon(
  options: ConnectToDaemonOptions,
  deps: ConnectToDaemonDeps = defaultDeps,
): Promise<ConnectionResult> {
  const {clientType, fromDir, joinRooms, projectPath, serverPath, skipRegistration = false, version} = options

  // 1. Ensure daemon is running (fast no-op if already running)
  const ensureOptions = version || serverPath ? {serverPath, version} : undefined
  const daemonResult = await deps.ensureDaemonRunning(ensureOptions)
  if (!daemonResult.success) {
    const detail = daemonResult.spawnError ? `: ${daemonResult.spawnError}` : ''
    throw new Error(`Failed to start daemon: timed out waiting for daemon to become ready${detail}`)
  }

  // 2. Connect + register + join rooms (all handled by transport-client)
  return deps.connectToTransport(fromDir, {
    autoRegister: !skipRegistration,
    clientType,
    discovery: new DaemonInstanceDiscovery(),
    joinRooms,
    projectPath,
  })
}
