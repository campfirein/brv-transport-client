import {expect} from 'chai'

import {compareSemver, versionsAreEquivalent} from '../../src/infra/version-utils.js'

describe('compareSemver()', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).to.equal(0)
  })

  it('returns negative when a < b', () => {
    expect(compareSemver('1.2.3', '1.2.4')).to.be.lessThan(0)
  })

  it('returns positive when a > b', () => {
    expect(compareSemver('1.3.0', '1.2.9')).to.be.greaterThan(0)
  })

  it('compares numerically not lexicographically', () => {
    // Lexicographic would put '10' < '9'. Semver puts 9 < 10.
    expect(compareSemver('3.10.0', '3.9.0')).to.be.greaterThan(0)
    expect(compareSemver('3.9.0', '3.10.0')).to.be.lessThan(0)
  })

  it('treats prerelease tags as stripped (3.10.0-beta.1 == 3.10.0)', () => {
    expect(compareSemver('3.10.0-beta.1', '3.10.0')).to.equal(0)
    expect(compareSemver('3.10.0', '3.10.0-rc.5')).to.equal(0)
  })

  it('treats build metadata as stripped (3.10.0+sha.abc == 3.10.0)', () => {
    expect(compareSemver('3.10.0+sha.abc', '3.10.0')).to.equal(0)
    expect(compareSemver('3.10.0', '3.10.0+build.123')).to.equal(0)
  })

  it('strips both prerelease and build metadata simultaneously', () => {
    expect(compareSemver('3.10.0-beta.1+sha.abc', '3.10.0')).to.equal(0)
  })

  it('coerces non-numeric segments to 0 (so "unknown" treated as oldest)', () => {
    // A daemon that failed to read its own version (returns 'unknown') should
    // be treated as ancient — newer client SIGTERMs and respawns it.
    expect(compareSemver('3.10.0', 'unknown')).to.be.greaterThan(0)
  })

  it('handles missing minor/patch parts gracefully', () => {
    // '1.0' vs '1.0.0' — same numeric tuple [1,0]/[1,0,0], compare equal.
    expect(compareSemver('1.0', '1.0.0')).to.equal(0)
  })
})

describe('versionsAreEquivalent()', () => {
  it('returns true for equal versions', () => {
    expect(versionsAreEquivalent('3.10.0', '3.10.0')).to.be.true
  })

  it('returns true for prerelease vs release of same numeric (3.10.0-beta.1 ≡ 3.10.0)', () => {
    // Customer-bug regression: drift indicator must NOT fire for prerelease
    // pairs that the SIGTERM gate considers equal.
    expect(versionsAreEquivalent('3.10.0-beta.1', '3.10.0')).to.be.true
  })

  it('returns true for build-metadata vs release of same numeric', () => {
    expect(versionsAreEquivalent('3.10.0+sha.abc', '3.10.0')).to.be.true
  })

  it('returns false for genuinely-different numeric versions', () => {
    expect(versionsAreEquivalent('3.10.0', '3.10.1')).to.be.false
    expect(versionsAreEquivalent('3.9.0', '3.10.0')).to.be.false
  })

  it('returns true when either side is undefined (caller should presence-check separately)', () => {
    expect(versionsAreEquivalent(undefined, '3.10.0')).to.be.true
    expect(versionsAreEquivalent('3.10.0', undefined)).to.be.true
    expect(versionsAreEquivalent(undefined, undefined)).to.be.true
  })
})
