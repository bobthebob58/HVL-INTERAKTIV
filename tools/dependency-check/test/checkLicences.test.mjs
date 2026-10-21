/**
 * Tests for the GPL-3.0 compatibility check of production dependencies.
 *
 * Spec: NFR-005
 */
import { describe, it, expect } from 'vitest';
import { checkLicences, isAllowed, licenceOf } from '../checkLicences.mjs';

describe('[NFR-005] licence allow-list', () => {
  it('[NFR-005] allows permissive and GPL-3.0 licences', () => {
    for (const id of ['MIT', 'ISC', 'Apache-2.0', 'BSD-3-Clause', 'GPL-3.0-or-later', 'MPL-2.0']) {
      expect(isAllowed(id), id).toBe(true);
    }
  });

  it('[NFR-005] rejects licences that cannot be combined with GPL-3.0', () => {
    for (const id of [
      'GPL-2.0-only',
      'AGPL-3.0-only',
      'SSPL-1.0',
      'BUSL-1.1',
      'CC-BY-NC-4.0',
      'UNLICENSED',
    ]) {
      expect(isAllowed(id), id).toBe(false);
    }
  });

  it('[NFR-005] evaluates SPDX OR and AND expressions', () => {
    expect(isAllowed('(MIT OR GPL-2.0-only)')).toBe(true);
    expect(isAllowed('MIT AND BSD-3-Clause')).toBe(true);
    expect(isAllowed('MIT AND SSPL-1.0')).toBe(false);
    expect(isAllowed('(BUSL-1.1 OR SSPL-1.0)')).toBe(false);
  });

  it('[NFR-005] reads legacy licence objects and reviewed overrides', () => {
    expect(licenceOf({ name: 'a', version: '1.0.0', license: { type: 'MIT' } })).toBe('MIT');
    expect(licenceOf({ name: 'esprima', version: '1.2.5', licenses: [{ type: 'BSD' }] })).toBe(
      'BSD-2-Clause',
    );
    expect(licenceOf({ name: 'b', version: '1.0.0' })).toBeUndefined();
  });

  it('[NFR-005] reports unknown and incompatible packages and skips our own workspaces', () => {
    const packages = [
      { name: 'hvl-interaktiv', version: '0.1.0', license: 'GPL-3.0-or-later' },
      { name: '@hvl-interaktiv/server', version: '0.1.0' },
      { name: 'ok', version: '1.0.0', license: 'MIT' },
      { name: 'mystery', version: '2.0.0' },
      { name: 'closed', version: '3.0.0', license: 'BUSL-1.1' },
    ];
    expect(checkLicences(packages)).toEqual([
      'mystery@2.0.0: no SPDX licence; read its licence file and add it to REVIEWED',
      'closed@3.0.0: licence "BUSL-1.1" is not GPL-3.0-compatible',
    ]);
  });
});
