/**
 * Tests for the lock-file check (D-145): the real package-lock.json passes, and a copy in which one package comes
 * from another server or another package's file, carries a weak or no checksum, is an alias or a bundled package,
 * or in which a link leaves the repository, is refused.
 *
 * Spec: SEC-007
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lockSourceProblems, registryPackages, REGISTRY } from '../checkLockfile.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const LOCK = JSON.parse(readFileSync(`${ROOT}package-lock.json`, 'utf8'));
const KEY = 'node_modules/express';
const AT = `package-lock.json: ${KEY}`;

/** The real lock file with one entry changed. */
const withEntry = (key, change) => {
  const lock = structuredClone(LOCK);
  lock.packages[key] = change(lock.packages[key]);
  return lock;
};

describe('[SEC-007] the lock file names one source and one kind of checksum', () => {
  it('[SEC-007] the real lock file passes: every package is from the npm registry with a sha512 value', () => {
    expect(lockSourceProblems(LOCK)).toEqual([]);
    expect(registryPackages(LOCK).length).toBeGreaterThan(900);
    expect(registryPackages(LOCK).every(([, entry]) => entry.resolved.startsWith(REGISTRY))).toBe(true);
  });

  it('[SEC-007] a package from another server, or from another package of the registry, is refused', () => {
    // Arrange
    const version = LOCK.packages[KEY].version;
    const expected = `${REGISTRY}express/-/express-${version}.tgz`;
    const from = (resolved) => lockSourceProblems(withEntry(KEY, (entry) => ({ ...entry, resolved })));
    const other = `https://registry.example.org/express/-/express-${version}.tgz`;
    const lookalike = `${REGISTRY}expresss/-/expresss-${version}.tgz`;
    // Act and assert
    expect(from(other)).toEqual([`${AT}: comes from ${other}, expected ${expected}`]);
    expect(from(lookalike)).toEqual([`${AT}: comes from ${lookalike}, expected ${expected}`]);
    expect(from(`http://registry.npmjs.org/express/-/express-${version}.tgz`)).toHaveLength(1);
    expect(from('git+ssh://git@github.com/expressjs/express.git#0123abc')).toHaveLength(1);
    expect(from(undefined)).toEqual([`${AT}: comes from undefined, expected ${expected}`]);
  });

  it('[SEC-007] a package with a weak, cut or missing checksum is refused', () => {
    // Arrange
    const sums = [
      'sha1-2jmj7l5rSw0yVb/vlWAYkK/YBwk=',
      'sha512-' + LOCK.packages[KEY].integrity.slice(7, 40),
      'sha512-' + '!'.repeat(86) + '==',
      undefined,
    ];
    // Act
    const problems = sums.map((integrity) =>
      lockSourceProblems(withEntry(KEY, (entry) => ({ ...entry, integrity }))),
    );
    // Assert
    expect(problems).toEqual(sums.map(() => [`${AT}: needs a sha512 integrity value`]));
  });

  it('[SEC-007] an alias and a bundled package are refused until a person reviews them', () => {
    // Act
    const alias = lockSourceProblems(withEntry(KEY, (entry) => ({ ...entry, name: 'expresss' })));
    const bundled = lockSourceProblems(
      withEntry(KEY, (entry) => ({ ...entry, resolved: undefined, integrity: undefined, inBundle: true })),
    );
    // Assert
    expect(alias).toEqual([`${AT}: is installed under another name (expresss); review it`]);
    expect(bundled).toEqual([`${AT}: is bundled inside another package and has no checksum of its own`]);
  });

  it('[SEC-007] a link must point at a local package, and a local package names no download', () => {
    // Arrange
    const link = 'node_modules/@hvl-interaktiv/server';
    const to = (resolved) => lockSourceProblems(withEntry(link, (entry) => ({ ...entry, resolved })));
    // Act
    const outside = to('../elsewhere');
    const fetched = lockSourceProblems(
      withEntry('apps/server', (entry) => ({ ...entry, resolved: `${REGISTRY}x/-/x-1.0.0.tgz` })),
    );
    // Assert
    expect(outside).toEqual([
      `package-lock.json: ${link}: links to ../elsewhere, which is not a local package of the lock file`,
    ]);
    expect(to('node_modules/express')).toHaveLength(1);
    expect(fetched).toEqual([
      'package-lock.json: apps/server: a local package must not name a download address or a checksum',
    ]);
  });

  it('[SEC-007] an older lock file format is refused', () => {
    expect(lockSourceProblems({ ...LOCK, lockfileVersion: 1 })).toEqual([
      'package-lock.json: lockfileVersion must be 3',
    ]);
  });
});
