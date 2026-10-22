/**
 * Tests for the exact-pin check on every workspace manifest.
 *
 * Spec: SEC-007
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loosePins, manifestPaths } from '../checkPins.mjs';

describe('[SEC-007] exact dependency pins', () => {
  it('[SEC-007] accepts exact versions, including pre-releases', () => {
    const manifest = { dependencies: { a: '1.2.3', b: '7.0.0-rc.1' }, overrides: { c: '1.13.8' } };
    expect(loosePins('package.json', manifest)).toEqual([]);
  });

  it('[SEC-007] rejects ranges, tags, wildcards and URLs in every dependency field', () => {
    const manifest = {
      dependencies: { caret: '^1.2.3' },
      devDependencies: { tilde: '~1.2.3', tag: 'latest' },
      optionalDependencies: { star: '*' },
      peerDependencies: { range: '>=1.0.0' },
      overrides: { git: 'github:x/y' },
    };
    expect(loosePins('apps/server/package.json', manifest)).toEqual([
      'apps/server/package.json: dependencies.caret is ""^1.2.3""; pin an exact version',
      'apps/server/package.json: devDependencies.tilde is ""~1.2.3""; pin an exact version',
      'apps/server/package.json: devDependencies.tag is ""latest""; pin an exact version',
      'apps/server/package.json: optionalDependencies.star is ""*""; pin an exact version',
      'apps/server/package.json: peerDependencies.range is "">=1.0.0""; pin an exact version',
      'apps/server/package.json: overrides.git is ""github:x/y""; pin an exact version',
    ]);
  });

  it('[SEC-007] checks every leaf of overrides scoped to a parent package', () => {
    expect(loosePins('package.json', { overrides: { parent: { express: '4.22.3' } } })).toEqual([]);
    expect(loosePins('package.json', { overrides: { a: { b: '^1.0.0', c: { d: '~2.0.0' } } } })).toEqual([
      'package.json: overrides.a.b is ""^1.0.0""; pin an exact version',
      'package.json: overrides.a.c.d is ""~2.0.0""; pin an exact version',
    ]);
  });

  it('[SEC-007] passes on this repository', () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const files = manifestPaths(root);
    expect(files).toContain('apps/server/package.json');
    expect(files.flatMap((f) => loosePins(f, JSON.parse(readFileSync(join(root, f), 'utf8'))))).toEqual([]);
  });
});
