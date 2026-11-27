/**
 * Tests for the rule that an installed copy counts as production when the lock file lists its folder as production,
 * also where npm's flag on the installed tree says dev (a copy no installed package needs, which the image keeps).
 *
 * Spec: NFR-005, SEC-007
 */
import { describe, expect, it } from 'vitest';
import { checkLicences, productionPackages } from '../checkLicences.mjs';
import { keptByProductionInstall, withLockFileProduction } from '../lockFileProduction.mjs';

const entry = (name, location, flags = {}) => ({
  name,
  version: '1.0.0',
  license: 'MIT',
  location,
  ...flags,
});

describe('[NFR-005] the lock file decides what a production install keeps', () => {
  it('[NFR-005] counts a copy npm calls dev when the lock file lists its folder as production', () => {
    // Arrange: `left-behind` is installed, no installed package needs it, and the lock file lists it as optional
    const entries = [
      entry('zod', 'node_modules/zod', { dev: false }),
      entry('left-behind', 'node_modules/left-behind', { dev: true, license: 'BUSL-1.1' }),
      entry('vitest', 'node_modules/vitest', { dev: true, license: 'BUSL-1.1' }),
      entry('unlisted', 'node_modules/unlisted', { dev: true, license: 'BUSL-1.1' }),
      entry('marked', 'node_modules/marked', { dev: true, license: 'BUSL-1.1' }),
    ];
    const lockPackages = {
      'node_modules/zod': {},
      'node_modules/left-behind': { optional: true },
      'node_modules/vitest': { dev: true },
      'node_modules/marked': { extraneous: true },
    };
    // Act
    const production = productionPackages(withLockFileProduction(entries, lockPackages));
    // Assert: the copy the image keeps is checked; a dev tool, an unlisted folder and a marked one are not
    expect(production.map((p) => p.name)).toEqual(['zod', 'left-behind']);
    expect(checkLicences(production)).toEqual([
      'left-behind@1.0.0: licence "BUSL-1.1" is not GPL-3.0-compatible',
    ]);
  });

  it('[NFR-005] never makes the set smaller: what npm counts as production stays, whatever the lock file says', () => {
    // Arrange
    const entries = [
      entry('zod', 'node_modules/zod', { dev: false }),
      entry('hvl-interaktiv', ''),
      { name: 'no-folder', version: '1.0.0', dev: true },
    ];
    // Act
    const marked = withLockFileProduction(entries, { 'node_modules/zod': { dev: true }, '': {} });
    // Assert: the same objects; an entry without a folder is never taken for the root
    expect(marked[0]).toBe(entries[0]);
    expect(marked[1]).toBe(entries[1]);
    expect(marked[2]).toBe(entries[2]);
  });

  it('[NFR-005] reads a folder name as a name only, never as a built-in property of the lock file', () => {
    expect(withLockFileProduction([entry('x', 'constructor', { dev: true })], {})[0].dev).toBe(true);
    expect(keptByProductionInstall(undefined)).toBe(false);
    expect(keptByProductionInstall({ optional: true, devOptional: true })).toBe(true);
  });
});
