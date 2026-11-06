/**
 * sbomFixtures — a small npm SBOM, as `npm sbom --sbom-format cyclonedx` writes it, and a throwaway repository with
 * the real pin files, so the SBOM tests run without calling npm.
 *
 * Why: the tests must show what the generator keeps and drops (dev, extraneous, a folder-named workspace, a licence
 *      npm cannot read) on input small enough to read, and the CLI tests need a repository they may write into.
 * Spec: SEC-007
 * Invariants:
 *   - The fixture has one package of each kind the generator treats differently, with npm's field order.
 *   - The throwaway repository gets copies of the real pin files and manifests that match the fixture, so the
 *     production-set guard passes; the real repository is never written.
 * Collaborators: tools/sbom/buildSbom.mjs, tools/sbom/npmComponents.mjs.
 * Tests: tools/sbom/test/npmComponents.test.mjs, tools/sbom/test/buildSbom.test.mjs
 */
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The real repository. */
export const REPOSITORY = fileURLToPath(new URL('../../../', import.meta.url));

/** The pin files the generator reads, copied into a throwaway repository. */
export const PIN_FILES = [
  'tools/h5p-core/fetchCoreClients.sh',
  'docs/reference/h5p-core-1.28-seed-packages/h5p-php-library-1.28.0.files.sha256',
  'docs/reference/h5p-core-1.28-seed-packages/h5p-editor-php-library-ab2daa18.files.sha256',
  'tools/h5p-libraries/libraries.manifest.json',
  'deploy/Dockerfile',
  'deploy/compose.app.yml',
];

/** Root and workspace manifests that declare exactly the fixture's runtime packages. */
export const FIXTURE_MANIFESTS = {
  'package.json': { name: 'fixture-root', version: '0.1.0', workspaces: ['apps/*'], devDependencies: {} },
  'apps/server/package.json': {
    name: '@hvl-interaktiv/server',
    version: '0.1.0',
    dependencies: { express: '5.3.0', esprima: '1.2.5' },
    devDependencies: { vitest: '5.0.5' },
  },
};

const flag = (name) => ({ name, value: 'true' });
const npmComponent = (name, version, extra = {}) => ({
  'bom-ref': `${name}@${version}`,
  type: 'library',
  name,
  version,
  scope: 'required',
  purl: `pkg:npm/${name.replace('@', '%40')}@${version}`,
  properties: [],
  externalReferences: [
    { type: 'distribution', url: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz` },
  ],
  hashes: [{ alg: 'SHA-512', content: `${'ab'.repeat(32)}` }],
  licenses: [{ license: { id: 'MIT' } }],
  ...extra,
});

/**
 * A fresh npm SBOM: the root, one workspace named after its folder, two runtime packages (one without a licence
 * npm can read), a dev-only package and an extraneous one.
 * @returns {object} npm's CycloneDX document, with its time stamp and random serial number.
 */
export function npmBomFixture() {
  return {
    $schema: 'http://cyclonedx.org/schema/bom-1.5.schema.json',
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: 'urn:uuid:3f2b1c9e-8d4a-4b6f-9e2d-1a2b3c4d5e6f',
    version: 1,
    metadata: {
      timestamp: '2026-11-05T12:00:00.000Z',
      lifecycles: [{ phase: 'build' }],
      tools: [{ vendor: 'npm', name: 'cli', version: '11.19.1' }],
      component: {
        ...npmComponent('fixture-root', '0.1.0', { type: 'application', name: 'FIXTURE-FOLDER' }),
        properties: [flag('cdx:npm:package:private')],
        externalReferences: [],
        licenses: [{ license: { id: 'GPL-3.0-or-later' } }],
      },
    },
    components: [
      {
        ...npmComponent('@hvl-interaktiv/server', '0.1.0', { name: 'server' }),
        properties: [flag('cdx:npm:package:private')],
        externalReferences: [],
        licenses: [{ license: { id: 'GPL-3.0-or-later' } }],
      },
      npmComponent('express', '5.3.0', { description: 'Fast, unopinionated, minimalist web framework' }),
      npmComponent('esprima', '1.2.5', { licenses: undefined }),
      npmComponent('vitest', '5.0.5', { properties: [flag('cdx:npm:package:development')] }),
      npmComponent('left-pad', '1.3.0', { properties: [flag('cdx:npm:package:extraneous')] }),
    ],
    dependencies: [
      { ref: 'fixture-root@0.1.0', dependsOn: ['@hvl-interaktiv/server@0.1.0', 'vitest@5.0.5'] },
      { ref: '@hvl-interaktiv/server@0.1.0', dependsOn: ['express@5.3.0', 'esprima@1.2.5', 'vitest@5.0.5'] },
      { ref: 'express@5.3.0', dependsOn: [] },
      { ref: 'esprima@1.2.5', dependsOn: [] },
      { ref: 'vitest@5.0.5', dependsOn: ['express@5.3.0'] },
      { ref: 'left-pad@1.3.0', dependsOn: [] },
    ],
  };
}

/**
 * Makes a throwaway repository with the fixture manifests and copies of the real pin files.
 * @returns {string} Its absolute path; the caller removes it.
 */
export function fixtureRepository() {
  const root = mkdtempSync(join(tmpdir(), 'hvli-sbom-'));
  for (const [file, manifest] of Object.entries(FIXTURE_MANIFESTS)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  for (const file of PIN_FILES) cpSync(join(REPOSITORY, file), join(root, file));
  mkdirSync(join(root, 'docs/assurance'), { recursive: true });
  return root;
}
