/**
 * Tests for the npm part of the SBOM: what it keeps from npm's document, what it drops, and the guard against a
 * shrunken production set.
 *
 * Spec: SEC-007
 */
import { describe, expect, it } from 'vitest';
import {
  REVIEWED_LICENCE,
  incompleteNpmSet,
  licensesOf,
  packageName,
  productionPart,
} from '../npmComponents.mjs';
import { FIXTURE_MANIFESTS, npmBomFixture } from './sbomFixtures.mjs';

const refs = (components) => components.map((c) => c['bom-ref']);

describe('[SEC-007] npm production components', () => {
  it('[SEC-007] keeps a production package exactly as npm wrote it: licence, purl, hashes and references', () => {
    const npmBom = npmBomFixture();
    const { components } = productionPart(npmBom);
    expect(components.find((c) => c.name === 'express')).toEqual(npmBom.components[1]);
  });

  it('[SEC-007] leaves out packages only dev dependencies need, and extraneous ones, with their edges', () => {
    // Arrange
    const npmBom = npmBomFixture();
    // Act
    const part = productionPart(npmBom);
    // Assert
    expect(refs(part.components)).toEqual(['@hvl-interaktiv/server@0.1.0', 'express@5.3.0', 'esprima@1.2.5']);
    expect(part.development).toBe(1);
    expect(part.extraneous).toEqual(['left-pad@1.3.0']);
    expect(part.dependencies.map((d) => d.ref)).not.toContain('vitest@5.0.5');
    expect(part.dependencies.find((d) => d.ref === '@hvl-interaktiv/server@0.1.0').dependsOn).toEqual([
      'express@5.3.0',
      'esprima@1.2.5',
    ]);
  });

  it('[SEC-007] names a workspace and the root by package name, not by folder', () => {
    const part = productionPart(npmBomFixture());
    expect(part.root.name).toBe('fixture-root');
    expect(part.components[0]).toMatchObject({
      name: '@hvl-interaktiv/server',
      purl: 'pkg:npm/%40hvl-interaktiv/server@0.1.0',
    });
  });

  it('[SEC-007] takes the licence check:licences reviewed when npm could not read one, and says so', () => {
    // Arrange
    const reviewed = { 'esprima@1.2.5': 'BSD-2-Clause', 'nothing@1.0.0': 'MIT' };
    // Act
    const esprima = productionPart(npmBomFixture(), reviewed).components.find((c) => c.name === 'esprima');
    // Assert
    expect(esprima.licenses).toEqual([{ license: { id: 'BSD-2-Clause' } }]);
    expect(esprima.properties).toContainEqual({
      name: REVIEWED_LICENCE,
      value: 'tools/dependency-check/checkLicences.mjs',
    });
    expect(esprima.purl).toBe('pkg:npm/esprima@1.2.5');
  });

  it('[SEC-007] writes an SPDX expression as an expression and one identifier as an id', () => {
    expect(licensesOf('MIT AND ISC')).toEqual([{ expression: 'MIT AND ISC' }]);
    expect(licensesOf('Apache-2.0')).toEqual([{ license: { id: 'Apache-2.0' } }]);
  });

  it('[SEC-007] reads the package name from scoped and unscoped references', () => {
    expect(packageName('@prisma/engines-version@8.1.0-1.d1b3f377')).toBe('@prisma/engines-version');
    expect(packageName('express@5.3.0')).toBe('express');
  });

  it('[SEC-007] refuses a production set that lacks a declared runtime dependency or a workspace', () => {
    // Arrange
    const { components } = productionPart(npmBomFixture());
    const withoutExpress = components.filter((c) => c.name !== 'express');
    const withoutWorkspace = components.filter((c) => c.name !== '@hvl-interaktiv/server');
    // Act and assert
    expect(incompleteNpmSet(FIXTURE_MANIFESTS, components)).toEqual([]);
    expect(incompleteNpmSet(FIXTURE_MANIFESTS, withoutExpress)[0]).toMatch(
      /^express \(declared in apps\/server/,
    );
    expect(incompleteNpmSet(FIXTURE_MANIFESTS, withoutWorkspace)[0]).toMatch(/^@hvl-interaktiv\/server/);
  });
});
