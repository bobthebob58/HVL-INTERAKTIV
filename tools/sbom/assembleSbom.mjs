/**
 * assembleSbom — joins the npm, H5P and image components into one CycloneDX document whose bytes depend only on its
 * content, and counts its components by kind.
 *
 * Why: `npm run sbom -- --check` must be able to say whether the committed SBOM is current, so equal inputs must give
 *      equal bytes. npm's own output carries a time stamp and a random serial number, and its order follows the
 *      installed tree (SEC-007).
 * Spec: SEC-007
 * Invariants:
 *   - No time stamp and no tool version. The serial number is a name-based UUID (version 5) of the document's other
 *     content, so it changes exactly when the content does.
 *   - Components are sorted by `bom-ref`, their properties by name and value; dependencies by `ref`, each `dependsOn`
 *     sorted and without duplicates. Sorting compares code units, never the locale.
 *   - The root depends on every added component whose scope is not `excluded`; each added component gets its own
 *     (empty) dependency entry, so the graph covers every component.
 * Collaborators: ./npmComponents.mjs (the npm part), ./h5pComponents.mjs, ./imageComponents.mjs, ./buildSbom.mjs.
 * Tests: tools/sbom/test/buildSbom.test.mjs
 */
import { createHash } from 'node:crypto';

/** Where the SBOM is committed, relative to the repository. */
export const SBOM_PATH = 'docs/assurance/sbom.cdx.json';
/** Our property recording the platform whose optional native npm packages the file lists. */
export const PLATFORM_PROPERTY = 'hvl:npm:platform';
/** The purl prefix of our own workspaces (`@hvl-interaktiv/*`). */
export const WORKSPACE_PURL = 'pkg:npm/%40hvl-interaktiv/';
// WHY: RFC 9562's URL namespace; any fixed namespace works, it only has to stay the same.
const SERIAL_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byRef = (a, b) => compare(a['bom-ref'], b['bom-ref']);
const byProperty = (a, b) => compare(a.name, b.name) || compare(a.value, b.value);
const withSortedProperties = (component) =>
  component.properties ? { ...component, properties: [...component.properties].sort(byProperty) } : component;

/**
 * A name-based UUID, version 5 (SHA-1), as RFC 9562 defines it.
 * @param {string} name - The name.
 * @param {string} [namespace] - The namespace UUID.
 * @returns {string} The UUID in its usual text form.
 */
export function uuidV5(name, namespace = SERIAL_NAMESPACE) {
  const hash = createHash('sha1')
    .update(Buffer.from(namespace.replaceAll('-', ''), 'hex'))
    .update(name, 'utf8')
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Builds the whole document.
 * @param {object} input - The parts.
 * @param {{$schema: string, bomFormat: string, specVersion: string, metadata: {lifecycles?: object[]}}} input.npmBom -
 *   npm's document, for its format fields and lifecycle.
 * @param {{root: object, components: object[], dependencies: {ref: string, dependsOn: string[]}[]}} input.npm - The
 *   production part (npmComponents.productionPart).
 * @param {object[]} input.added - The H5P and image components.
 * @param {string} input.platform - `<platform>-<arch>` of the installed tree, e.g. `linux-x64`.
 * @returns {object} The CycloneDX document.
 * @example
 * assembleSbom({ npmBom, npm: productionPart(npmBom), added: [...h5p, ...images], platform: 'linux-x64' });
 */
export function assembleSbom({ npmBom, npm, added, platform }) {
  const rootRef = npm.root['bom-ref'];
  const required = added.filter((c) => c.scope !== 'excluded').map((c) => c['bom-ref']);
  const edges = [
    ...npm.dependencies.map((d) =>
      d.ref === rootRef ? { ...d, dependsOn: [...d.dependsOn, ...required] } : d,
    ),
    ...added.map((c) => ({ ref: c['bom-ref'], dependsOn: [] })),
  ];
  const body = {
    $schema: npmBom.$schema,
    bomFormat: npmBom.bomFormat,
    specVersion: npmBom.specVersion,
    version: 1,
    metadata: {
      lifecycles: npmBom.metadata.lifecycles ?? [{ phase: 'build' }],
      // WHY: no versions here: the file should change with the lockfile and the pins, not with the npm release.
      tools: [
        { vendor: 'npm', name: 'cli' },
        { vendor: 'HVL Interaktiv', name: 'tools/sbom' },
      ],
      component: withSortedProperties(npm.root),
      properties: [{ name: PLATFORM_PROPERTY, value: platform }],
    },
    components: [...npm.components, ...added].map(withSortedProperties).sort(byRef),
    dependencies: edges
      .map((d) => ({ ref: d.ref, dependsOn: [...new Set(d.dependsOn)].sort(compare) }))
      .sort((a, b) => compare(a.ref, b.ref)),
  };
  const { $schema, bomFormat, specVersion, ...rest } = body;
  const serialNumber = `urn:uuid:${uuidV5(JSON.stringify(body))}`;
  return { $schema, bomFormat, specVersion, serialNumber, ...rest };
}

/**
 * The file's text: two-space JSON and a final newline.
 * @param {object} bom - The document.
 * @returns {string} The text written to SBOM_PATH.
 */
export const serialise = (bom) => `${JSON.stringify(bom, null, 2)}\n`;

/**
 * Counts the components by where they come from, for the command's summary.
 * @param {{components: {purl?: string}[]}} bom - The document.
 * @returns {{npm: number, workspaces: number, h5p: number, images: number, other: number}} Counts.
 */
export function countsByKind(bom) {
  const counts = { npm: 0, workspaces: 0, h5p: 0, images: 0, other: 0 };
  for (const { purl = '' } of bom.components) {
    if (purl.startsWith('pkg:npm/')) {
      counts.npm += 1;
      if (purl.startsWith(WORKSPACE_PURL)) counts.workspaces += 1;
    } else if (purl.startsWith('pkg:github/')) counts.h5p += 1;
    else if (purl.startsWith('pkg:oci/')) counts.images += 1;
    else counts.other += 1;
  }
  return counts;
}
