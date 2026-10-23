/**
 * packContentTypes — writes one `.h5p` package per content type: our example content plus every library it needs.
 *
 * Why: the server installs libraries through the same package path that admins and the seed command use
 *      (H5P-003, SEC-003, SEC-005), so libraries built from GitHub are delivered as ordinary `.h5p` files. Each
 *      package carries a small Nynorsk example activity that tests play and the validator reads (D-078).
 * Spec: H5P-003
 * Invariants:
 *   - A package holds `h5p.json`, `content/content.json`, the example's assets under `content/`, and the library
 *     folders of the main library's closure plus every sub-content library the example uses.
 *   - The closure follows `preloadedDependencies` and `editorDependencies`, so the package can also be edited.
 *   - Output is deterministic: entries sorted, one fixed timestamp and mode, so equal inputs give equal bytes.
 *   - Parameters are completed with each library's Nynorsk defaults (./semanticDefaults.mjs).
 * Collaborators: ./fetchLibraries.mjs, ./semanticDefaults.mjs, ./examples/*.json, ../../apps/server/src/h5p/libraries/seedLibraries.ts.
 * Tests: tools/h5p-libraries/test/packContentTypes.test.mjs
 */
import { createWriteStream, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ZipFile } from 'yazl';
import { libraryDefaults, withDefaults } from './semanticDefaults.mjs';

const FIXED_TIME = new Date('2026-01-01T00:00:00Z');
const folderOf = (dep) => `${dep.machineName}-${dep.majorVersion}.${dep.minorVersion}`;
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/**
 * Finds every sub-content library an example's parameters use (`{ library: "H5P.Name 1.2", params }`).
 * @param {unknown} params - Content parameters.
 * @returns {{ machineName: string, majorVersion: number, minorVersion: number }[]} Distinct libraries.
 */
export function subContentLibraries(params) {
  const found = new Map();
  const stack = [params];
  while (stack.length > 0) {
    const value = stack.pop();
    if (Array.isArray(value)) stack.push(...value);
    else if (value && typeof value === 'object') {
      const m = typeof value.library === 'string' ? /^([\w.]+) (\d+)\.(\d+)$/.exec(value.library) : null;
      if (m)
        found.set(value.library, {
          machineName: m[1],
          majorVersion: Number(m[2]),
          minorVersion: Number(m[3]),
        });
      stack.push(...Object.values(value));
    }
  }
  return [...found.values()];
}

/**
 * The library folders a package needs, from the main library and the sub-content libraries.
 * @param {string} librariesDir - Folder of library folders (`Name-major.minor`).
 * @param {object[]} starts - Libraries to start from.
 * @returns {string[]} Folder names, sorted.
 * @throws {Error} When a needed library folder is missing.
 */
export function libraryClosure(librariesDir, starts) {
  const seen = new Set();
  const queue = [...starts];
  while (queue.length > 0) {
    const folder = folderOf(queue.shift());
    if (seen.has(folder)) continue;
    seen.add(folder);
    const library = readJson(join(librariesDir, folder, 'library.json'));
    queue.push(...(library.preloadedDependencies ?? []), ...(library.editorDependencies ?? []));
  }
  return [...seen].sort();
}

const filesUnder = (dir, prefix = '') =>
  readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(dir, `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
  );

/**
 * Writes one content type's package.
 * @param {object} input - What to pack.
 * @param {string} input.librariesDir - Folder of library folders.
 * @param {string} input.exampleFile - The example (`{ title, language, license, params, assets? }`).
 * @param {string} input.outFile - The `.h5p` file to write.
 * @returns {Promise<string[]>} The library folders the package contains.
 */
export async function packContentType({ librariesDir, exampleFile, outFile }) {
  const example = readJson(exampleFile);
  const main = readJson(join(librariesDir, example.mainLibrary, 'library.json'));
  const mainDep = {
    machineName: main.machineName,
    majorVersion: main.majorVersion,
    minorVersion: main.minorVersion,
  };
  const subContent = subContentLibraries(example.params);
  const folders = libraryClosure(librariesDir, [mainDep, ...subContent]);
  const defaultsFor = (library) => libraryDefaults(join(librariesDir, library.replace(' ', '-')));
  const mainName = `${main.machineName} ${main.majorVersion}.${main.minorVersion}`;
  const params = withDefaults(example.params, defaultsFor, mainName);
  const h5pJson = {
    title: example.title,
    language: example.language,
    mainLibrary: main.machineName,
    // WHY: h5p.json must name an embed type; QuestionSet 1.21's library.json lists none (upstream omission).
    embedTypes: main.embedTypes?.length ? main.embedTypes : ['iframe'],
    license: example.license,
    defaultLanguage: example.language,
    preloadedDependencies: [mainDep, ...subContent],
  };
  const entries = [
    ['h5p.json', Buffer.from(JSON.stringify(h5pJson, null, 2))],
    ['content/content.json', Buffer.from(JSON.stringify(params))],
    ...Object.entries(example.assets ?? {}).map(([path, file]) => [
      `content/${path}`,
      readFileSync(join(exampleFile, '..', file)),
    ]),
    ...folders.flatMap((folder) =>
      filesUnder(join(librariesDir, folder)).map((rel) => [
        `${folder}/${rel}`,
        join(librariesDir, folder, rel),
      ]),
    ),
  ].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const zip = new ZipFile();
  for (const [name, data] of entries) {
    const buffer = typeof data === 'string' ? readFileSync(data) : data;
    zip.addBuffer(buffer, name, { mtime: FIXED_TIME, mode: 0o100644, compress: true });
  }
  zip.end();
  await new Promise((resolve, reject) => {
    zip.outputStream.pipe(createWriteStream(outFile)).on('close', resolve).on('error', reject);
  });
  if (statSync(outFile).size === 0) throw new Error(`${outFile} is empty`);
  return folders;
}
