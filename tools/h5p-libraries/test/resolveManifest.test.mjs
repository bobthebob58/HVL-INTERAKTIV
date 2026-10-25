/**
 * Tests for resolving and pinning the libraries of the content types, against a fake git source.
 *
 * Spec: H5P-003, H5P-002
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveManifest } from '../resolveManifest.mjs';

const dirs = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const workDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'h5p-resolve-'));
  dirs.push(dir);
  return dir;
};
const lib = (name, version, deps = [], extra = {}) => {
  const [majorVersion, minorVersion, patchVersion] = version.split('.').map(Number);
  const toDep = (d) => ({
    machineName: d.split(' ')[0],
    majorVersion: +d.split(' ')[1].split('.')[0],
    minorVersion: +d.split(' ')[1].split('.')[1],
  });
  return {
    machineName: name,
    majorVersion,
    minorVersion,
    patchVersion,
    preloadedDependencies: deps.map(toDep),
    ...extra,
  };
};

/** A fake source: per repository, tags and the library.json each ref holds. */
function fakeSource(repos) {
  const checkedOut = [];
  return {
    checkedOut,
    listVersionTags: (repo) =>
      Object.keys(repos[repo])
        .filter((ref) => ref !== 'HEAD')
        .map((tag) => ({ tag, version: tag.split('.').map(Number) })),
    checkout: (repo, ref, dir) => {
      const tag = ref.replace('refs/tags/', '');
      const library = repos[repo][tag];
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'library.json'), JSON.stringify(library));
      for (const file of library.files ?? []) writeFileSync(join(dir, file), '');
      checkedOut.push(`${repo}@${tag}`);
      return `${repo.length}`.padStart(40, '0');
    },
  };
}
const registry = {
  'H5P.A': { repo: { url: 'a' } },
  'H5P.B': { repo: { url: 'b' } },
  'H5P.C': { repo: { url: 'c' } },
};
const ROOTS = [{ machineName: 'H5P.A', majorVersion: 1, minorVersion: 2 }];
/** Resolves the content type H5P.A 1.2 from `source` into a fresh work folder. */
const resolveA = (source) => resolveManifest({ roots: ROOTS, registry, source, workDir: workDir() });

describe('[H5P-003] resolving the pinned library set', () => {
  it('[H5P-003] takes the newest tag of each required major.minor, follows dependencies once, and sorts', () => {
    // Arrange
    const source = fakeSource({
      a: {
        '1.2.0': lib('H5P.A', '1.2.0', ['H5P.B 1.0']),
        '1.2.7': lib('H5P.A', '1.2.7', ['H5P.B 1.0', 'H5P.C 2.1']),
        '1.3.0': lib('H5P.A', '1.3.0'),
      },
      b: { '1.0.4': lib('H5P.B', '1.0.4', ['H5P.C 2.1']) },
      c: {
        '2.1.9': lib('H5P.C', '2.1.9', [], {
          preloadedJs: [{ path: 'dist/c.js' }],
          files: ['package-lock.json'],
        }),
      },
    });
    // Act
    const { libraries } = resolveA(source);
    // Assert
    expect(libraries.map((l) => `${l.machineName} ${l.version} ${l.ref} build=${l.build}`)).toEqual([
      'H5P.A 1.2.7 refs/tags/1.2.7 build=false',
      'H5P.B 1.0.4 refs/tags/1.0.4 build=false',
      'H5P.C 2.1.9 refs/tags/2.1.9 build=true',
    ]);
    expect(source.checkedOut.filter((c) => c.startsWith('c@'))).toHaveLength(1);
  });

  it('[H5P-003] a library without a matching tag is pinned to the default branch and marked untagged', () => {
    const source = fakeSource({ a: { HEAD: lib('H5P.A', '1.2.3') } });
    const { libraries } = resolveA(source);
    expect(libraries[0]).toMatchObject({ ref: 'HEAD', untagged: true, version: '1.2.3' });
  });

  it('[H5P-003] follows sub-content types the semantics offer, and skips one that cannot be resolved', () => {
    // Arrange: A offers C 2.1 (resolvable) and B 9.9 (no such version) as sub-content
    const offers = [
      {
        name: 'pages',
        type: 'list',
        field: { name: 'page', type: 'library', options: ['H5P.C 2.1', 'H5P.B 9.9'] },
      },
    ];
    const source = fakeSource({
      a: { '1.2.0': lib('H5P.A', '1.2.0', [], { semantics: offers }) },
      b: { HEAD: lib('H5P.B', '1.0.0') },
      c: { '2.1.0': lib('H5P.C', '2.1.0') },
    });
    const checkout = source.checkout;
    source.checkout = (repo, ref, dir) => {
      const commit = checkout(repo, ref, dir);
      const library = JSON.parse(readFileSync(join(dir, 'library.json'), 'utf8'));
      if (library.semantics) writeFileSync(join(dir, 'semantics.json'), JSON.stringify(library.semantics));
      return commit;
    };
    // Act
    const { libraries, skipped } = resolveA(source);
    // Assert
    expect(libraries.map((l) => l.machineName)).toEqual(['H5P.A', 'H5P.C']);
    expect(skipped).toEqual([
      { library: 'H5P.B 9.9', offeredBy: 'H5P.A 1.2', reason: expect.stringMatching(/holds 1.0/) },
    ]);
  });

  it('[H5P-003] refuses a library that must be built but has no package-lock.json', () => {
    const source = fakeSource({
      a: { '1.2.0': lib('H5P.A', '1.2.0', [], { preloadedJs: [{ path: 'dist/a.js' }] }) },
    });
    expect(() => resolveA(source)).toThrow(/no package-lock/);
  });

  it('[H5P-003] refuses a checkout that holds another version, and a library missing from the registry', () => {
    const wrong = fakeSource({ a: { HEAD: lib('H5P.A', '1.9.0') } });
    expect(() => resolveA(wrong)).toThrow(/holds 1.9/);
    const missing = [{ machineName: 'H5P.Unknown', majorVersion: 1, minorVersion: 0 }];
    expect(() => resolveManifest({ roots: missing, registry, source: wrong, workDir: workDir() })).toThrow(
      /not in the H5P registry/,
    );
  });
});
