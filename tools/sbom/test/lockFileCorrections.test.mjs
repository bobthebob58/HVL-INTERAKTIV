/**
 * Tests for the correction of npm's SBOM by the lock file: a runtime package that npm describes by a development
 * copy, or calls extraneous although a production install keeps it, stays in the production part, written as npm
 * writes its production copy; nothing else changes.
 *
 * Spec: SEC-007
 */
import { describe, expect, it } from 'vitest';
import { BUNDLED, withLockFileCorrections } from '../lockFileCorrections.mjs';
import { DEVELOPMENT, EXTRANEOUS, productionPart } from '../npmComponents.mjs';
import { npmBomFixture } from './sbomFixtures.mjs';

const flag = (name) => ({ name, value: 'true' });
const ADDRESS = 'https://registry.npmjs.org/helper/-/helper-2.8.1.tgz';
const VCS = { type: 'vcs', url: 'https://example.org/helper.git' };
const INTEGRITY = `sha512-${Buffer.alloc(64, 0xab).toString('base64')}`;

/** npm's document with one more component, helper@2.8.1, as npm wrote it for the first copy it met. */
function bomWith(properties, extra = {}) {
  const bom = npmBomFixture();
  bom.components.push({
    'bom-ref': 'helper@2.8.1',
    type: 'library',
    name: 'helper',
    version: '2.8.1',
    scope: 'optional',
    purl: 'pkg:npm/helper@2.8.1',
    properties,
    externalReferences: [VCS],
    licenses: [{ license: { id: '0BSD' } }],
    ...extra,
  });
  bom.dependencies.find((d) => d.ref === 'express@5.3.0').dependsOn.push('helper@2.8.1');
  bom.dependencies.push({ ref: 'helper@2.8.1', dependsOn: ['vitest@5.0.5'] });
  return bom;
}
/** The first copy npm met is the one a dev tool bundles: development, bundled, no hash, no download address. */
const bomWithBundledCopyFirst = () => bomWith([flag(DEVELOPMENT), flag(BUNDLED)]);

const copy = (name, version, location, extra = {}) => ({ name, version, location, dev: false, ...extra });
const BUNDLED_COPY = 'node_modules/dev-tool/node_modules/helper';
/** The installed tree: the bundled copy comes first, as in npm's own order; the server's copy is at the top. */
const INSTALLED = [
  copy('fixture-root', '0.1.0', ''),
  copy('helper', '2.8.1', BUNDLED_COPY, { dev: true, to: ['node_modules/vitest'] }),
  copy('esprima', '1.2.5', 'node_modules/esprima'),
  copy('express', '5.3.0', 'node_modules/express', { to: ['node_modules/helper'] }),
  copy('helper', '2.8.1', 'node_modules/helper', {
    to: ['node_modules/esprima', 'node_modules/esprima', 'node_modules/absent'],
  }),
  copy('vitest', '5.0.5', 'node_modules/vitest', { dev: true }),
];
const lockWith = (helper) => ({
  [BUNDLED_COPY]: { version: '2.8.1', dev: true, inBundle: true },
  'node_modules/vitest': { version: '5.0.5', dev: true },
  ...(helper ? { 'node_modules/helper': { version: '2.8.1', ...helper } } : {}),
});
const helperIn = (bom) => bom.components.find((c) => c.name === 'helper');

describe('[SEC-007] a runtime package that npm describes by another copy', () => {
  it('[SEC-007] stays in the production part, written as npm writes its production copy', () => {
    // Arrange
    const npmBom = bomWithBundledCopyFirst();
    const lockPackages = lockWith({ resolved: ADDRESS, integrity: INTEGRITY });
    // Act
    const part = productionPart(withLockFileCorrections(npmBom, INSTALLED, lockPackages));
    // Assert: uncorrected, the package is left out; corrected, it has the top copy's address, hash and edges
    expect(productionPart(npmBom).components.map((c) => c.name)).not.toContain('helper');
    expect(helperIn(part)).toEqual({
      'bom-ref': 'helper@2.8.1',
      type: 'library',
      name: 'helper',
      version: '2.8.1',
      scope: 'required',
      purl: 'pkg:npm/helper@2.8.1',
      properties: [],
      externalReferences: [{ type: 'distribution', url: ADDRESS }, VCS],
      hashes: [{ alg: 'SHA-512', content: 'ab'.repeat(64) }],
      licenses: [{ license: { id: '0BSD' } }],
    });
    expect(Object.keys(helperIn(part)).slice(-3)).toEqual(['externalReferences', 'hashes', 'licenses']);
    expect(part.dependencies.find((d) => d.ref === 'helper@2.8.1').dependsOn).toEqual(['esprima@1.2.5']);
    expect(part.dependencies.find((d) => d.ref === 'express@5.3.0').dependsOn).toContain('helper@2.8.1');
    expect(part.development).toBe(1);
  });

  it('[SEC-007] keeps the scope and the bundled flag of the production copy', () => {
    // Act: the production copy is itself optional and sits in a runtime package's bundle
    const corrected = withLockFileCorrections(
      bomWithBundledCopyFirst(),
      INSTALLED,
      lockWith({ optional: true, inBundle: true }),
    );
    // Assert
    expect(helperIn(corrected)).toMatchObject({ scope: 'optional', properties: [flag(BUNDLED)] });
    expect(helperIn(corrected).externalReferences).toEqual([VCS]);
    expect(helperIn(corrected).hashes).toBeUndefined();
    const either = withLockFileCorrections(
      bomWithBundledCopyFirst(),
      INSTALLED,
      lockWith({ devOptional: true }),
    );
    expect(helperIn(either)).toMatchObject({ scope: 'optional', properties: [] });
  });

  it('[SEC-007] lists a copy npm calls extraneous when the lock file lists its folder as production', () => {
    // Arrange: no installed package needs the top copy, so npm marks it development and extraneous
    const npmBom = bomWith([flag(DEVELOPMENT), flag(EXTRANEOUS)]);
    const leftBehind = INSTALLED.map((c) => (c.location === 'node_modules/helper' ? { ...c, dev: true } : c));
    const lockPackages = lockWith({ resolved: ADDRESS, integrity: INTEGRITY, optional: true });
    // Act
    const part = productionPart(withLockFileCorrections(npmBom, leftBehind, lockPackages));
    // Assert: a production install keeps it, so it is listed; only the package the lock file lacks is extraneous
    expect(helperIn(part)).toMatchObject({ scope: 'optional', properties: [] });
    expect(helperIn(part).hashes).toEqual([{ alg: 'SHA-512', content: 'ab'.repeat(64) }]);
    expect(part.extraneous).toEqual(['left-pad@1.3.0']);
  });

  it('[SEC-007] counts an extraneous copy the lock file lists as dev as development, not as extraneous', () => {
    // Arrange: only the dev tool's copy is installed, and npm calls it extraneous
    const npmBom = bomWith([flag(DEVELOPMENT), flag(EXTRANEOUS), flag(BUNDLED)]);
    const onlyBundled = INSTALLED.filter((c) => c.location !== 'node_modules/helper');
    // Act
    const part = productionPart(withLockFileCorrections(npmBom, onlyBundled, lockWith(undefined)));
    // Assert
    expect(part.components.map((c) => c.name)).not.toContain('helper');
    expect(part.development).toBe(2);
    expect(part.extraneous).toEqual(['left-pad@1.3.0']);
  });

  it('[SEC-007] keeps the extraneous flag while one installed copy sits in a folder the lock file lacks', () => {
    // Arrange: besides the dev tool's copy, a stray copy that the lock file does not list
    const npmBom = bomWith([flag(DEVELOPMENT), flag(EXTRANEOUS)]);
    const stray = copy('helper', '2.8.1', 'node_modules/stray/node_modules/helper', { dev: true });
    const withStray = [...INSTALLED.filter((c) => c.location !== 'node_modules/helper'), stray];
    // Act
    const corrected = withLockFileCorrections(npmBom, withStray, lockWith(undefined));
    // Assert: unchanged, so the command still names the package and says to run npm ci
    expect(corrected).toBe(npmBom);
    expect(productionPart(corrected).extraneous).toEqual(['left-pad@1.3.0', 'helper@2.8.1']);
  });

  it('[SEC-007] changes nothing when every copy of a development package is a development copy', () => {
    // Arrange
    const npmBom = bomWithBundledCopyFirst();
    const onlyBundled = INSTALLED.filter((c) => c.location !== 'node_modules/helper');
    // Act and assert: the same document, also with no list of copies at all
    expect(withLockFileCorrections(npmBom, onlyBundled, lockWith(undefined))).toBe(npmBom);
    expect(withLockFileCorrections(npmBom, [], {})).toBe(npmBom);
  });

  it('[SEC-007] refuses a production copy the lock file lacks or lists in another version, or without sha512', () => {
    // Arrange: an install that lags the lock file has 2.8.1 where the lock file says 2.8.0
    const weak = lockWith({ resolved: ADDRESS, integrity: 'sha1-2jmj7l5rSw0yVb/vlWAYkK/YBwk=' });
    const other = lockWith({
      version: '2.8.0',
      resolved: ADDRESS.replace('2.8.1', '2.8.0'),
      integrity: INTEGRITY,
    });
    const lacks = /package-lock\.json lacks node_modules\/helper in the installed version/;
    // Act and assert
    expect(() => withLockFileCorrections(bomWithBundledCopyFirst(), INSTALLED, lockWith(undefined))).toThrow(
      lacks,
    );
    expect(() => withLockFileCorrections(bomWithBundledCopyFirst(), INSTALLED, other)).toThrow(lacks);
    expect(() => withLockFileCorrections(bomWithBundledCopyFirst(), INSTALLED, weak)).toThrow(
      /node_modules\/helper needs one sha512 integrity value/,
    );
  });
});
