/**
 * resolveManifest — works out every library the ten HVL content types need, each at the newest release tag of the
 * required major.minor version, and pins it to an exact commit.
 *
 * Why: H5P packages name their dependencies as `machineName major.minor`; a content type pulls in 5–40 helper
 *      libraries for the player and the editor. Resolving them once and committing the result (with commit hashes)
 *      keeps every later fetch reproducible and reviewable (D-078), like Core and the editor (D-022).
 * Spec: H5P-003, H5P-002
 * Invariants:
 *   - Dependencies are `preloadedDependencies` and `editorDependencies`, followed recursively; one entry per
 *     `machineName major.minor` (H5P installs several minor versions side by side).
 *   - Sub-content types a `library` field in `semantics.json` offers are followed too, but as optional, and so are
 *     their own dependencies: an optional library that cannot be resolved, or whose dependencies cannot, is listed
 *     in `skipped` instead of failing, because the content type works without it (only that choice is missing in
 *     the editor). Without them a container such as InteractiveBook could not save its own pages (the sub-content
 *     policy accepts only offered libraries). A required library is never skipped.
 *   - The newest `x.y.z` tag of the required major.minor wins; a library without such a tag falls back to the
 *     repository's default branch and is pinned to that commit, marked `untagged` for review.
 *   - A checkout whose `library.json` reports another major.minor than required is an error, not a guess.
 *   - `build` is true when a file the library preloads is missing from the repository (it must be built). A
 *     library that needs a build but has no `package-lock.json` cannot be built reproducibly and is refused.
 * Collaborators: ./gitSource.mjs (the real source), ./fetchLibraries.mjs, the H5P library registry
 *   (github.com/h5p/h5p-registry `libraries.json`, machine name → repository).
 * Tests: tools/h5p-libraries/test/resolveManifest.test.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The ten authorable types (CLAUDE.md §1) at the versions S4 starts from (D-078). */
export const CONTENT_TYPE_ROOTS = [
  ['H5P.CoursePresentation', 1, 28],
  ['H5P.InteractiveVideo', 1, 28],
  ['H5P.QuestionSet', 1, 21],
  ['H5P.InteractiveBook', 1, 15],
  ['H5P.Column', 1, 18],
  ['H5P.DragText', 1, 10],
  ['H5P.MultiChoice', 1, 16],
  ['H5P.Blanks', 1, 14],
  ['H5P.ImageHotspots', 1, 11],
  ['H5P.BranchingScenario', 1, 10],
].map(([machineName, majorVersion, minorVersion]) => ({ machineName, majorVersion, minorVersion }));

/**
 * Reads a checkout's `library.json`.
 * @param {string} dir - The checkout.
 * @returns {object} The parsed file.
 */
export const readLibrary = (dir) => JSON.parse(readFileSync(join(dir, 'library.json'), 'utf8'));

/**
 * Whether a checkout lacks a file its `library.json` preloads, i.e. needs its build step.
 * @param {string} dir - The checkout.
 * @param {object} library - Its parsed `library.json`.
 * @returns {boolean} True when some preloaded JS or CSS file is missing.
 */
export function needsBuild(dir, library) {
  const files = [...(library.preloadedJs ?? []), ...(library.preloadedCss ?? [])].map((f) => f.path);
  return files.some((path) => !existsSync(join(dir, path)));
}

/**
 * The sub-content libraries a library's semantics offers (`library` fields' `options`, at any depth).
 * @param {object[]} fields - `semantics.json`.
 * @returns {{ machineName: string, majorVersion: number, minorVersion: number }[]} Offered libraries.
 */
export function offeredLibraries(fields) {
  const found = [];
  const walk = (list) => {
    for (const field of list ?? []) {
      if (field.type === 'library') {
        for (const option of field.options ?? []) {
          const m = /^([\w.]+) (\d+)\.(\d+)$/.exec(option);
          if (m) found.push({ machineName: m[1], majorVersion: Number(m[2]), minorVersion: Number(m[3]) });
        }
      }
      walk(field.fields);
      if (field.field) walk([field.field]);
    }
  };
  walk(fields);
  return found;
}

/**
 * Drops optional libraries whose dependencies were skipped, until none is left.
 * @param {Map<string, object>} done - Resolved libraries by key.
 * @param {Map<string, object>} skipped - Skipped libraries by key.
 * @param {Map<string, { optional: boolean, deps: string[] }>} needs - Each resolved library's dependencies.
 * @throws {Error} When a required library depends on a skipped one.
 */
function pruneUnresolvable(done, skipped, needs) {
  for (let changed = true; changed;) {
    changed = false;
    for (const [key, { optional, deps }] of needs) {
      const missing = deps.find((dep) => !done.has(dep));
      if (!done.has(key) || !missing) continue;
      if (!optional) throw new Error(`${key} needs ${missing}, which could not be resolved`);
      done.delete(key);
      skipped.set(key, {
        library: key,
        offeredBy: 'dependency',
        reason: `needs ${missing}, which was skipped`,
      });
      changed = true;
    }
  }
}

const readSemantics = (dir) =>
  existsSync(join(dir, 'semantics.json'))
    ? JSON.parse(readFileSync(join(dir, 'semantics.json'), 'utf8'))
    : [];

/**
 * Resolves the full, pinned library set.
 * @param {object} input - What to resolve.
 * @param {object[]} input.roots - `{ machineName, majorVersion, minorVersion }` of each content type.
 * @param {Record<string, { repo: { url: string } }>} input.registry - Machine name → repository.
 * @param {{ listVersionTags: Function, checkout: Function }} input.source - Git access (./gitSource.mjs).
 * @param {string} input.workDir - Where checkouts go; one sub-folder per library.
 * @returns {{ libraries: object[], skipped: object[] }} One entry per library, sorted by machine name and version,
 *   and the offered sub-content libraries that could not be resolved, with the reason.
 * @throws {Error} For a required library missing from the registry or a checkout with the wrong version.
 */
export function resolveManifest({ roots, registry, source, workDir }) {
  const done = new Map();
  const skipped = new Map();
  const needs = new Map();
  const queue = roots.map((r) => ({ ...r, requiredBy: 'content type', optional: false }));
  while (queue.length > 0) {
    const item = queue.shift();
    const key = `${item.machineName} ${item.majorVersion}.${item.minorVersion}`;
    if (done.has(key)) continue;
    if (skipped.has(key)) {
      if (!item.optional)
        throw new Error(`${key} (required by ${item.requiredBy}): ${skipped.get(key).reason}`);
      continue;
    }
    try {
      resolveOne(item, key);
    } catch (error) {
      // WHY: an offered sub-content type is a choice in the editor, not something the content type needs to run.
      //      A network failure is never a reason to skip one (./gitSource.mjs marks it transient).
      if (!item.optional || error.transient) throw error;
      skipped.set(key, { library: key, offeredBy: item.requiredBy, reason: error.message });
    }
  }

  function resolveOne({ machineName, majorVersion, minorVersion, requiredBy, optional }, key) {
    const repository = registry[machineName]?.repo?.url;
    if (!repository) throw new Error(`${key} (required by ${requiredBy}) is not in the H5P registry`);
    const newest = source
      .listVersionTags(repository)
      .filter(({ version }) => version[0] === majorVersion && version[1] === minorVersion)
      .sort((a, b) => a.version[2] - b.version[2])
      .at(-1);
    const ref = newest ? `refs/tags/${newest.tag}` : 'HEAD';
    const dir = join(workDir, `${machineName}-${majorVersion}.${minorVersion}`);
    const commit = source.checkout(repository, ref, dir);
    const library = readLibrary(dir);
    if (library.majorVersion !== majorVersion || library.minorVersion !== minorVersion) {
      throw new Error(`${key}: ${repository} ${ref} holds ${library.majorVersion}.${library.minorVersion}`);
    }
    const build = needsBuild(dir, library);
    if (build && !existsSync(join(dir, 'package-lock.json'))) {
      throw new Error(`${key} must be built but has no package-lock.json, so its build is not reproducible`);
    }
    done.set(key, {
      machineName,
      version: `${library.majorVersion}.${library.minorVersion}.${library.patchVersion}`,
      repository,
      ref,
      commit,
      ...(newest ? {} : { untagged: true }),
      build,
    });
    const deps = [...(library.preloadedDependencies ?? []), ...(library.editorDependencies ?? [])];
    needs.set(key, {
      optional,
      deps: deps.map((d) => `${d.machineName} ${d.majorVersion}.${d.minorVersion}`),
    });
    for (const dep of deps) queue.push({ ...dep, requiredBy: key, optional });
    for (const offered of offeredLibraries(readSemantics(dir))) {
      queue.push({ ...offered, requiredBy: key, optional: true });
    }
  }
  pruneUnresolvable(done, skipped, needs);
  const libraries = [...done.values()].sort(
    (a, b) =>
      a.machineName.localeCompare(b.machineName) ||
      a.version.localeCompare(b.version, 'en', { numeric: true }),
  );
  return { libraries, skipped: [...skipped.values()].sort((a, b) => a.library.localeCompare(b.library)) };
}
