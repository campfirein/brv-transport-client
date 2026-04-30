# Changelog

## 1.1.0 — 2026-04-30

Fix for [ENG-2540](https://linear.app/byterover/issue/ENG-2540) / [byterover-cli#583](https://github.com/campfirein/byterover-cli/issues/583): daemon SIGTERM ping-pong loop when two clients at different versions share a `BRV_DATA_DIR`.

### Behavior change (the fix)

`checkDaemonHealth` / `discoverDaemon` now use an **asymmetric** version gate:

- **Before**: `client.version !== daemon.version` → SIGTERM (both directions).
- **After**: `compareSemver(clientVersion, daemonVersion) > 0` → SIGTERM (only when the *client* is strictly newer; older client tolerates a newer daemon and connects normally).

Two peer clients at different versions can no longer ping-pong each other's daemons. The daemon spawned by the strictly-newer side wins; the older side connects to it without firing a SIGTERM back.

`compareSemver` strips prerelease tags (`-beta.1` etc.) before comparing, so `3.10.0-beta.1` and `3.10.0` are considered equal for the gate.

### Type renames

The `daemon_outdated` reason and `daemonVersion` / `clientVersion` field names replace the old `version_mismatch` / `actualVersion` / `expectedVersion` for clarity (the old `expectedVersion` was actually the *client's* version — confusing).

| Old | New |
|---|---|
| `reason: 'version_mismatch'` | `reason: 'daemon_outdated'` |
| `actualVersion?: string` (the daemon's) | `daemonVersion: string` |
| `expectedVersion: string` (the caller's) | `clientVersion: string` |

Affected exported types:
- `DaemonHealthResult` (from `daemon-health.ts`)
- `DaemonStatus` (from `daemon-discovery-sync.ts`)

`daemonVersion` is now required on the `daemon_outdated` branch (was optional). Producer always set it; the type just narrows to match the runtime invariant.

### API additions (backward-compatible)

- `ITransportClient.getDaemonVersion?(): string | undefined` — **optional** method. Returns the daemon version reported in the most recent `client:register` ack. Older `ITransportClient` implementations (custom transports, test doubles) that don't provide it keep compiling; callers should use `?.()` to be safe.
- `ClientRegisterResponseSchema` gains an optional `daemonVersion?: string` field. Older daemons that don't emit it parse normally (consumers see `undefined`).

### Migration

Most consumers don't need changes. If your code:
- Reads `result.actualVersion` / `result.expectedVersion` → rename to `result.daemonVersion` / `result.clientVersion`.
- Switches on `result.reason === 'version_mismatch'` → switch to `'daemon_outdated'`.
- Calls `client.getDaemonVersion()` → use `client.getDaemonVersion?.()` to be explicit about the optional contract.
