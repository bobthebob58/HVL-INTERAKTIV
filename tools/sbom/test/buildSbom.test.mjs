/**
 * Tests for the assembled SBOM and the command: same input gives the same bytes, `--check` finds a stale or missing
 * file, a shrunken npm set is refused, and the real `npm sbom` of this repository gives the full production set.
 *
 * Spec: SEC-007
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assembleSbom, serialise } from '../assembleSbom.mjs';
import { buildSbom, main, runNpmSbom } from '../buildSbom.mjs';
import { DEVELOPMENT, REVIEWED_LICENCE, productionPart } from '../npmComponents.mjs';
import { REPOSITORY, fixtureRepository, npmBomFixture } from './sbomFixtures.mjs';

const UUID_V5 = /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const added = () => [
  {
    'bom-ref': 'pkg:github/h5p/x@1',
    name: 'x',
    scope: 'required',
    properties: [
      { name: 'b', value: '2' },
      { name: 'a', value: '1' },
    ],
  },
];
const assemble = (npmBom) =>
  assembleSbom({ npmBom, npm: productionPart(npmBom), added: added(), platform: 'linux-x64' });

describe('[SEC-007] deterministic SBOM', () => {
  it('[SEC-007] gives the same bytes for the same input, in whatever order npm lists it', () => {
    // Arrange
    const shuffled = npmBomFixture();
    shuffled.components.reverse();
    shuffled.dependencies.reverse();
    shuffled.dependencies[0].dependsOn.reverse();
    // Act
    const first = serialise(assemble(npmBomFixture()));
    const second = serialise(assemble(shuffled));
    // Assert
    expect(second).toBe(first);
    const bom = JSON.parse(first);
    expect(bom.components.map((c) => c['bom-ref'])).toEqual(
      [...bom.components.map((c) => c['bom-ref'])].sort(),
    );
    expect(bom.components.find((c) => c.name === 'x').properties.map((p) => p.name)).toEqual(['a', 'b']);
  });

  it('[SEC-007] has no time stamp or tool version, and a serial number that follows the content', () => {
    // Arrange
    const changed = npmBomFixture();
    changed.components[1].version = '5.3.1';
    // Act
    const bom = assemble(npmBomFixture());
    // Assert
    expect(bom.metadata.timestamp).toBeUndefined();
    expect(bom.metadata.tools.every((t) => t.version === undefined)).toBe(true);
    expect(bom.serialNumber).toMatch(UUID_V5);
    expect(assemble(npmBomFixture()).serialNumber).toBe(bom.serialNumber);
    expect(assemble(changed).serialNumber).not.toBe(bom.serialNumber);
  });

  it('[SEC-007] makes the root depend on every added component that is part of the service', () => {
    const extra = [...added(), { 'bom-ref': 'pkg:oci/clamav@sha256%3A1', scope: 'excluded' }];
    const npm = productionPart(npmBomFixture());
    const bom = assembleSbom({ npmBom: npmBomFixture(), npm, added: extra, platform: 'linux-x64' });
    const edges = Object.fromEntries(bom.dependencies.map((d) => [d.ref, d.dependsOn]));
    expect(edges['fixture-root@0.1.0']).toEqual(['@hvl-interaktiv/server@0.1.0', 'pkg:github/h5p/x@1']);
    expect(edges['pkg:oci/clamav@sha256%3A1']).toEqual([]);
  });
});

describe('[SEC-007] npm run sbom', () => {
  let root;
  let out;
  const run = (...argv) =>
    main([...argv, `--out=${out}`], { root, npmSbom: npmBomFixture, platform: 'linux-x64' });
  beforeEach(() => {
    root = fixtureRepository();
    out = join(root, 'docs/assurance/sbom.cdx.json');
    for (const method of ['log', 'warn', 'error']) vi.spyOn(console, method).mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('[SEC-007] --check passes on a current file and fails on a stale or missing one', () => {
    // Arrange
    expect(run()).toBe(0);
    // Act and assert
    expect(run('--check')).toBe(0);
    writeFileSync(out, readFileSync(out, 'utf8').replace('"5.3.0"', '"5.2.0"'));
    expect(run('--check')).toBe(1);
    expect(console.error).toHaveBeenLastCalledWith(
      expect.stringMatching(/is not current\. Run: npm run sbom$/),
    );
    unlinkSync(out);
    expect(run('--check')).toBe(1);
    expect(existsSync(out)).toBe(false);
  });

  it('[SEC-007] --check says when the file lists the npm packages of another platform', () => {
    run();
    const check = main(['--check', `--out=${out}`], {
      root,
      npmSbom: npmBomFixture,
      platform: 'darwin-arm64',
    });
    expect(check).toBe(1);
    expect(console.error).toHaveBeenLastCalledWith(expect.stringContaining('npm packages of linux-x64'));
  });

  it('[SEC-007] writes nothing when npm reports a production set without a declared dependency', () => {
    // Arrange
    const shrunken = () => {
      const bom = npmBomFixture();
      bom.components = bom.components.filter((c) => c.name !== 'express');
      return bom;
    };
    // Act
    const code = main([`--out=${out}`], { root, npmSbom: shrunken, platform: 'linux-x64' });
    // Assert
    expect(code).toBe(1);
    expect(existsSync(out)).toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/^✗ sbom: express \(declared in/));
  });
});

describe('[SEC-007] the real npm sbom', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('[SEC-007] lists every package npm query counts as production, with npm licences and purls', () => {
    // Arrange: as under NODE_ENV=production, npm is told to omit dev packages; the generator must still see them all
    vi.stubEnv('npm_config_omit', 'dev');
    const npmBom = runNpmSbom(REPOSITORY);
    vi.unstubAllEnvs();
    const query = JSON.parse(execFileSync('npm', ['query', '*'], { cwd: REPOSITORY, maxBuffer: 64 << 20 }));
    const rootName = JSON.parse(readFileSync(join(REPOSITORY, 'package.json'), 'utf8')).name;
    const production = new Set(
      query.filter((e) => e.dev !== true && e.name !== rootName).map((e) => `${e.name}@${e.version}`),
    );
    // Act
    const { bom, problems } = buildSbom(REPOSITORY, npmBom, 'linux-x64');
    // Assert
    expect(problems).toEqual([]);
    const npm = bom.components.filter((c) => c.purl.startsWith('pkg:npm/'));
    expect(new Set(npm.map((c) => c['bom-ref']))).toEqual(production);
    expect(npm.map((c) => c.name)).toEqual(
      expect.arrayContaining(['playwright-core', 'tsx', 'react', 'prisma']),
    );
    expect(npm.some((c) => c.properties.some((p) => p.name === DEVELOPMENT))).toBe(false);
    for (const ours of npm) {
      const theirs = npmBom.components.find((c) => c['bom-ref'] === ours['bom-ref']);
      expect(ours.purl).toBe(theirs.purl);
      if (!ours.properties.some((p) => p.name === REVIEWED_LICENCE))
        expect(ours.licenses).toEqual(theirs.licenses);
    }
    expect(npm.every((c) => c.licenses?.length === 1)).toBe(true);
  }, 120_000);
});
