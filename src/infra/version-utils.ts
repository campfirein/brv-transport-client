/**
 * Compares two semver-like version strings numerically.
 *
 * Returns negative if `a < b`, positive if `a > b`, `0` if equal.
 *
 * Prerelease tags (anything after `-`) and build metadata (anything after `+`)
 * are stripped before compare so that:
 * - `3.10.0-beta.1` and `3.10.0` compare as equal
 * - `3.10.0+sha.abc` and `3.10.0` compare as equal
 *
 * Including either suffix in the daemon-version gate would re-introduce the
 * SIGTERM ping-pong loop for prerelease / build-metadata releases.
 *
 * Non-numeric segments (e.g. `'unknown'`) coerce to `0`. This means a daemon
 * that failed to read its own version string is always treated as the oldest
 * possible — newer clients will SIGTERM and respawn it, which is the safer
 * default for a misconfigured daemon.
 */
export function compareSemver(a: string, b: string): number {
  const partsOf = (v: string): number[] => {
    // Strip build metadata (`+...`) first, then prerelease (`-...`).
    const stripBuild = v.split('+')[0] ?? v
    const stripped = stripBuild.split('-')[0] ?? stripBuild
    return stripped.split('.').map((p) => {
      const n = Number.parseInt(p, 10)
      return Number.isFinite(n) ? n : 0
    })
  }

  const aParts = partsOf(a)
  const bParts = partsOf(b)
  const len = Math.max(aParts.length, bParts.length)

  for (let i = 0; i < len; i++) {
    const av = aParts[i] ?? 0
    const bv = bParts[i] ?? 0
    if (av !== bv) return av - bv
  }

  return 0
}

/**
 * Returns `true` when two semver-like version strings are considered equivalent
 * by the daemon-version gate (i.e. `compareSemver` returns 0).
 *
 * Use this for user-visible drift indicators (TUI header, MCP tool footers,
 * stderr drift logs) so the indicator semantics match the SIGTERM gate.
 *
 * Without this helper, naive `a !== b` string equality would fire drift
 * indicators for `3.10.0` vs `3.10.0-beta.1` even though the SIGTERM gate
 * considers them equal — a confusing inconsistency.
 *
 * Either side `undefined` returns `true` (no drift to show — caller should
 * gate on presence separately).
 */
export function versionsAreEquivalent(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return true
  return compareSemver(a, b) === 0
}
