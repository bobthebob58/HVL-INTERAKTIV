/**
 * Tests for the guard that fails the licence check when npm's production set lacks a workspace or a declared runtime
 * dependency (the S5 gate's stray node_modules/node_modules link, D-113), and for its wiring into check:licences.
 *
 * Spec: NFR-005
 */
import { afterAll, describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { productionPackages } from '../checkLicences.mjs';
import { manifestPaths } from '../checkPins.mjs';
import {
  expectedProductionPackages,
  incompleteSetProblems,
  LIKELY_CAUSE,
  readWorkspaceManifests,
  workspaceManifestPaths,
} from '../productionSetGuard.mjs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const temporary = [];
afterAll(() => temporary.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** Writes files (path → string, or an object written as JSON) under a fresh temporary folder and returns it. */
function tempTree(files) {
  const root = mkdtempSync(join(tmpdir(), 'production-set-'));
  temporary.push(root);
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return root;
}

// Arrange (shared): a root with only dev tools, a server using a contract package, and a web app whose only
// dependency the server declares too (so hiding the web app alone hides no dependency).
const rootManifest = { name: 'hvl-interaktiv', workspaces: ['apps/*', 'packages/*'] };
const manifests = {
  'package.json': { ...rootManifest, devDependencies: { vitest: '5.0.5' } },
  'apps/server/package.json': {
    name: '@hvl-interaktiv/server',
    dependencies: { '@hvl-interaktiv/api-contract': '0.1.0', zod: '4.6.7' },
  },
  'apps/web/package.json': { name: '@hvl-interaktiv/web', dependencies: { zod: '4.6.7' } },
  'packages/api-contract/package.json': {
    name: '@hvl-interaktiv/api-contract',
    dependencies: { zod: '4.6.7' },
  },
};
const expected = expectedProductionPackages(manifests);
const entry = (name, flags = {}) => ({ name, version: '1.0.0', license: 'MIT', dev: false, ...flags });
const names = [
  'hvl-interaktiv',
  '@hvl-interaktiv/server',
  '@hvl-interaktiv/web',
  '@hvl-interaktiv/api-contract',
];
const complete = [...names, 'zod'].map((name) => entry(name));
const of = (count) => `is missing from the ${count} production packages npm reported`;

describe('[NFR-005] the checked production set is complete', () => {
  it('[NFR-005] names every workspace and dependency when npm did not see the workspaces (the S5 gate)', () => {
    // Arrange: what npm query reported behind the stray link: the workspaces and all they need marked dev.
    const hidden = productionPackages([
      entry('hvl-interaktiv'),
      ...complete.slice(1).map((e) => ({ ...e, dev: true })),
    ]);
    // Act and assert
    expect(incompleteSetProblems(expected, hidden)).toEqual([
      `@hvl-interaktiv/server (the workspace in apps/server) ${of(1)}`,
      '@hvl-interaktiv/api-contract (the workspace in packages/api-contract; declared in ' +
        `apps/server/package.json) ${of(1)}`,
      `zod (declared in apps/server/package.json, apps/web/package.json, packages/api-contract/package.json) ${of(1)}`,
      `@hvl-interaktiv/web (the workspace in apps/web) ${of(1)}`,
      LIKELY_CAUSE,
    ]);
    expect(LIKELY_CAUSE).toContain('node_modules/node_modules');
  });

  it('[NFR-005] fails when one workspace is hidden although every dependency it declares is present', () => {
    const webHidden = complete.map((e) => (e.name === '@hvl-interaktiv/web' ? { ...e, dev: true } : e));
    expect(incompleteSetProblems(expected, productionPackages(webHidden))).toEqual([
      `@hvl-interaktiv/web (the workspace in apps/web) ${of(4)}`,
      LIKELY_CAUSE,
    ]);
  });

  it('[NFR-005] fails when a declared dependency is only in the dev set', () => {
    const zodDev = complete.map((e) => (e.name === 'zod' ? { ...e, dev: true } : e));
    expect(incompleteSetProblems(expected, productionPackages(zodDev))[0]).toMatch(/^zod \(declared in /);
  });

  it('[NFR-005] passes a complete set: workspace links, optional and peer entries count, dev tools do not', () => {
    // Arrange: the contract package is a workspace the server links to; zod is flagged optional and peer.
    const entries = [
      ...complete.slice(0, 4),
      entry('zod', { optional: true, peer: true }),
      entry('vitest', { dev: true }),
    ];
    // Act
    const problems = incompleteSetProblems(expected, productionPackages(entries));
    // Assert
    expect(problems).toEqual([]);
    expect(expected.has('vitest')).toBe(false);
    expect(expected.get('@hvl-interaktiv/api-contract')).toEqual({
      workspace: 'packages/api-contract',
      declaredIn: ['apps/server/package.json'],
    });
  });

  it('[NFR-005] reports an entry without a package name instead of crashing', () => {
    const entries = [...complete, { location: '../elsewhere/node_modules', dev: false }];
    expect(incompleteSetProblems(expected, entries)).toEqual([
      'npm reported an entry without a package name at ../elsewhere/node_modules',
      LIKELY_CAUSE,
    ]);
  });
});

describe('[NFR-005] the workspaces come from the root manifest', () => {
  it('[NFR-005] expands `dir/*` and plain folders as npm does, and refuses patterns it cannot expand', () => {
    // Arrange: one real workspace among a dot-folder, node_modules and a folder without a manifest.
    const root = tempTree({
      'package.json': { name: 'root' },
      'apps/a/package.json': { name: 'a' },
      'apps/.cache/package.json': { name: 'cache' },
      'apps/node_modules/package.json': { name: 'nm' },
      'apps/notes/README.md': '# notes',
      'tools/one/package.json': {},
    });
    // Act and assert
    expect(workspaceManifestPaths(root, { workspaces: ['apps/*', './tools/one/', 'gone/*'] })).toEqual([
      'package.json',
      'apps/a/package.json',
      'tools/one/package.json',
    ]);
    expect(expectedProductionPackages({ 'tools/one/package.json': {} }).get('one')?.workspace).toBe(
      'tools/one',
    );
    for (const pattern of ['apps/**', 'packages/{a,b}', '*/x', '!apps/a'])
      expect(() => workspaceManifestPaths(root, { workspaces: [pattern] }), pattern).toThrow(/not supported/);
  });

  it('[NFR-005] reads the same manifests in this repository as check:pins', () => {
    // WHY: check:pins lists apps/* and packages/* itself; a workspace elsewhere would be pinned by nobody.
    expect(Object.keys(readWorkspaceManifests(repoRoot))).toEqual(manifestPaths(repoRoot));
  });
});

describe('[NFR-005] check:licences runs the guard first', () => {
  /** Runs a copy of checkLicences.mjs in a temporary repository whose `npm query '*'` prints the given entries. */
  function runCheck(entries) {
    const root = tempTree({
      'package.json': { ...rootManifest, workspaces: ['apps/*'] },
      'apps/server/package.json': manifests['apps/server/package.json'],
      'bin/npm': '#!/bin/sh\ncat "$(dirname "$0")/query.json"\n',
      'bin/query.json': entries,
    });
    chmodSync(join(root, 'bin/npm'), 0o755);
    mkdirSync(join(root, 'tools/dependency-check'), { recursive: true });
    for (const file of ['checkLicences.mjs', 'productionSetGuard.mjs'])
      copyFileSync(
        join(repoRoot, 'tools/dependency-check', file),
        join(root, 'tools/dependency-check', file),
      );
    const env = { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}` };
    const script = join(root, 'tools/dependency-check/checkLicences.mjs');
    return spawnSync(process.execPath, [script], { env, encoding: 'utf8' });
  }

  it('[NFR-005] exits 1 and names what is missing when npm reports only the root package', () => {
    const run = runCheck([entry('hvl-interaktiv'), entry('@hvl-interaktiv/server', { dev: true })]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(`✗ @hvl-interaktiv/server (the workspace in apps/server) ${of(1)}`);
    expect(run.stderr).toContain(`✗ zod (declared in apps/server/package.json) ${of(1)}`);
    expect(run.stderr).toContain(`✗ ${LIKELY_CAUSE}`);
  });

  it('[NFR-005] passes when every workspace and declared dependency is in the set', () => {
    const run = runCheck(complete.filter((e) => e.name !== '@hvl-interaktiv/web'));
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('✓ check:licences: 4 production packages (all 3 workspaces and declared');
  });
});
