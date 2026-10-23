/**
 * libraryFiles — chooses which files of a library's repository checkout belong in its H5P library folder.
 *
 * Why: a repository holds more than H5P installs: build sources, tests, tooling and `node_modules`. An `.h5p`
 *      package may only contain file types H5P accepts, so the library folder is built from an allowlist of
 *      extensions with the repository's own tooling left out (D-078; the server's package checks still run on
 *      the result, SEC-003/SEC-005).
 * Spec: H5P-003, SEC-005
 * Invariants:
 *   - Hidden files and folders, `node_modules`, tests and package-manager or bundler files are never copied.
 *   - A built library leaves out `src/` (its preloaded files come from the build output).
 *   - Only extensions in `ALLOWED_EXTENSIONS` are copied; paths are returned sorted, with `/` separators.
 * Collaborators: ./fetchLibraries.mjs, ./packContentTypes.mjs.
 * Tests: tools/h5p-libraries/test/libraryFiles.test.mjs
 */
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * File types an H5P library may contain: the server's content list plus scripts, styles and web fonts
 * (apps/server/src/h5p/H5pConfigFactory.ts `LIBRARY_WHITELIST`); documentation such as `README.md` is left out.
 */
export const ALLOWED_EXTENSIONS = new Set([
  'json',
  'js',
  'css',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'eot',
  'ttf',
  'woff',
  'woff2',
  'otf',
  'webm',
  'mp4',
  'ogg',
  'mp3',
  'm4a',
  'wav',
  'txt',
  'vtt',
  'webvtt',
]);

const SKIPPED_FOLDERS = new Set(['node_modules', 'test', 'tests', 'spec', 'coverage']);
const SKIPPED_FILES = new Set(['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']);
const TOOLING_FILE =
  /(^|\.)(webpack|babel|rollup|vite|jest|karma|eslint|postcss|prettier)(\.[\w-]+)*\.(c|m)?js(on)?$/i;

/**
 * Lists the files of a checkout that belong in the library folder.
 * @param {string} checkoutDir - The repository checkout.
 * @param {{ built: boolean }} options - Whether the library was built (then `src/` is left out).
 * @returns {string[]} Relative paths, sorted.
 */
export function libraryFileList(checkoutDir, { built }) {
  const files = [];
  const walk = (rel) => {
    for (const entry of readdirSync(join(checkoutDir, rel), { withFileTypes: true })) {
      const path = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        if (SKIPPED_FOLDERS.has(entry.name) || (built && rel === '' && entry.name === 'src')) continue;
        walk(path);
      } else if (entry.isFile() && isLibraryFile(entry.name)) {
        files.push(path);
      }
    }
  };
  walk('');
  return files.sort();
}

/**
 * Whether a file name is one H5P accepts and not repository tooling.
 * @param {string} name - The file name.
 * @returns {boolean} True for a library file.
 */
export function isLibraryFile(name) {
  if (SKIPPED_FILES.has(name) || TOOLING_FILE.test(name)) return false;
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  return ALLOWED_EXTENSIONS.has(extension);
}

/**
 * Copies a checkout's library files into a library folder.
 * @param {string} checkoutDir - The repository checkout.
 * @param {string} libraryDir - The destination, e.g. `…/H5P.MultiChoice-1.16`.
 * @param {{ built: boolean }} options - Whether the library was built.
 * @returns {string[]} The copied relative paths.
 */
export function copyLibraryFiles(checkoutDir, libraryDir, options) {
  const files = libraryFileList(checkoutDir, options);
  for (const path of files) {
    mkdirSync(dirname(join(libraryDir, path)), { recursive: true });
    copyFileSync(join(checkoutDir, path), join(libraryDir, path));
  }
  return files;
}
