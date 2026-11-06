/**
 * h5pComponents — the H5P core, the H5P editor and the ten content types as SBOM components, read from the pin files
 * the fetch tools use, so the SBOM names exactly the commits those tools prove.
 *
 * Why: the server sends H5P's core, editor and content-type JavaScript to every learner and author, but it comes
 *      from GitHub through git, not from npm, so npm's SBOM cannot see it (D-022, D-027, D-078; SEC-007).
 * Spec: SEC-007
 * Invariants:
 *   - Values come only from tools/h5p-core/fetchCoreClients.sh, the committed per-file SHA-256 lists it names and
 *     tools/h5p-libraries/libraries.manifest.json. A value missing there throws; nothing is guessed.
 *   - One component per root in CONTENT_TYPE_ROOTS (the ten authorable types): the manifest entry of that machine
 *     name with the root's major.minor. None, or more than one, throws.
 *   - Each component's purl, `pedigree.commits` and `hvl:git:ref` name the pinned commit and ref.
 * Collaborators: ../h5p-core/fetchCoreClients.sh, ../h5p-libraries/resolveManifest.mjs (CONTENT_TYPE_ROOTS),
 *   ../h5p-libraries/libraries.manifest.json, ./buildSbom.mjs.
 * Tests: tools/sbom/test/sourceComponents.test.mjs
 */
import { CONTENT_TYPE_ROOTS } from '../h5p-libraries/resolveManifest.mjs';

/** The script that fetches and proves H5P core and the editor (the pins for both). */
export const CORE_SCRIPT = 'tools/h5p-core/fetchCoreClients.sh';
/** The pinned library set the content types are built from. */
export const LIBRARY_MANIFEST = 'tools/h5p-libraries/libraries.manifest.json';
/** Our property naming the file a component's pin was read from. */
export const SOURCE_PROPERTY = 'hvl:sbom:source';

/**
 * Reads a shell script's `NAME="value"` lines, resolving `$ROOT/` (the repository) and earlier names.
 * @param {string} text - The script.
 * @returns {Map<string, string>} Name → repository-relative or literal value.
 */
export function shellAssignments(text) {
  const values = new Map();
  for (const [, name, raw] of text.matchAll(/^([A-Z][A-Z_]*)="([^"]*)"$/gm)) {
    const value = raw
      .replace(/^\$ROOT\//, '')
      .replace(/\$\{?([A-Z][A-Z_]*)\}?/g, (whole, ref) => values.get(ref) ?? whole);
    values.set(name, value);
  }
  return values;
}

/**
 * Splits a GitHub repository URL.
 * @param {string} repository - For example `https://github.com/h5p/h5p-blanks` (with or without `.git`).
 * @returns {{url: string, owner: string, repo: string}} The URL without `.git`, owner and repository.
 * @throws {Error} When it is not a github.com repository URL.
 */
export function githubRepository(repository) {
  const m = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(repository);
  if (!m) throw new Error(`not a GitHub repository URL: ${repository}`);
  return { url: `https://github.com/${m[1]}/${m[2]}`, owner: m[1], repo: m[2] };
}

/**
 * Builds one component for source code pinned to a git commit on GitHub.
 * @param {object} pin - The pin.
 * @param {string} pin.name - Component name.
 * @param {string} pin.version - Version (a release, or the commit when there is none).
 * @param {string} pin.description - One sentence for readers.
 * @param {string} pin.repository - GitHub repository URL.
 * @param {string} pin.commit - The 40-hex commit the fetch tool proves.
 * @param {{name: string, value: string}[]} pin.properties - Extra properties.
 * @returns {object} The CycloneDX component; `bom-ref` is its purl.
 * @throws {Error} When the commit is not 40 hex digits or the repository is not on GitHub.
 */
export function gitComponent({ name, version, description, repository, commit, properties }) {
  if (!/^[0-9a-f]{40}$/.test(commit ?? ''))
    throw new Error(`${name}: commit "${commit}" is not 40 hex digits`);
  const { url, owner, repo } = githubRepository(repository);
  const purl = `pkg:github/${owner.toLowerCase()}/${repo.toLowerCase()}@${commit}`;
  return {
    'bom-ref': purl,
    type: 'library',
    name,
    version,
    scope: 'required',
    description,
    purl,
    properties,
    externalReferences: [{ type: 'vcs', url }],
    pedigree: { commits: [{ uid: commit, url: `${url}/commit/${commit}` }] },
  };
}

/**
 * The H5P core and editor components, from fetchCoreClients.sh and the hash lists it names.
 * @param {(file: string) => string} readText - Reads a repository-relative file.
 * @returns {object[]} Core, then editor.
 * @throws {Error} When the script lacks a pin, or a hash list cannot be read.
 */
export function coreComponents(readText) {
  const pins = shellAssignments(readText(CORE_SCRIPT));
  const need = (name) => {
    if (!pins.get(name)) throw new Error(`${CORE_SCRIPT}: ${name}="…" not found`);
    return pins.get(name);
  };
  const files = (list) => [
    { name: 'hvl:file-hashes', value: list },
    {
      name: 'hvl:file-count',
      value: String(
        readText(list)
          .split('\n')
          .filter((l) => l.trim()).length,
      ),
    },
  ];
  const tag = need('CORE_TAG');
  const editorCommit = need('EDITOR_COMMIT');
  const repoName = (variable) => githubRepository(need(variable)).repo;
  return [
    gitComponent({
      name: repoName('CORE_REPO'),
      version: tag,
      description: `H5P core client files from release tag ${tag}; each file is checked against a committed SHA-256 list`,
      repository: need('CORE_REPO'),
      commit: need('CORE_COMMIT'),
      properties: [
        { name: 'hvl:git:ref', value: `refs/tags/${tag}` },
        ...files(need('CORE_HASHES')),
        { name: SOURCE_PROPERTY, value: CORE_SCRIPT },
      ],
    }),
    gitComponent({
      name: repoName('EDITOR_REPO'),
      version: editorCommit,
      description:
        'H5P editor client files from a pinned commit (no 1.28 release exists, D-022); each file is checked ' +
        'against a committed SHA-256 list',
      repository: need('EDITOR_REPO'),
      commit: editorCommit,
      properties: [
        { name: 'hvl:git:ref', value: editorCommit },
        ...files(need('EDITOR_HASHES')),
        { name: SOURCE_PROPERTY, value: CORE_SCRIPT },
      ],
    }),
  ];
}

/**
 * The ten content types, each at the manifest entry of its root's major.minor.
 * @param {{libraries: object[]}} manifest - The parsed libraries.manifest.json.
 * @param {{machineName: string, majorVersion: number, minorVersion: number}[]} [roots] - The content types.
 * @returns {object[]} One component per root, in the roots' order.
 * @throws {Error} When a root has no entry, or more than one, of its major.minor.
 */
export function contentTypeComponents(manifest, roots = CONTENT_TYPE_ROOTS) {
  return roots.map(({ machineName, majorVersion, minorVersion }) => {
    const prefix = `${majorVersion}.${minorVersion}.`;
    const entries = manifest.libraries.filter(
      (l) => l.machineName === machineName && l.version.startsWith(prefix),
    );
    if (entries.length !== 1)
      throw new Error(
        `${LIBRARY_MANIFEST}: ${entries.length} entries for ${machineName} ${prefix}x, expected 1`,
      );
    const [entry] = entries;
    return gitComponent({
      name: machineName,
      version: entry.version,
      description: 'H5P content type, one of the ten authorable types',
      repository: entry.repository,
      commit: entry.commit,
      properties: [
        { name: 'hvl:git:ref', value: entry.ref },
        ...(entry.untagged ? [{ name: 'hvl:git:untagged', value: 'true' }] : []),
        { name: 'hvl:h5p:npm-build', value: String(entry.build === true) },
        { name: SOURCE_PROPERTY, value: LIBRARY_MANIFEST },
      ],
    });
  });
}
