/**
 * h5pTranslationResources — loads Lumi's own translation files (nn, nb, en) into an i18next resource object.
 *
 * Why: Lumi's editor and player ask the server to translate their own strings (copyright and metadata
 *      fields, client strings, Hub and library titles). The installed @lumieducation/h5p-server package
 *      ships these strings per namespace and language; HvlTranslationCallback serves them nn → nb → en
 *      (H5P-008, D-046). Our own server messages stay in src/i18n/translate.ts.
 * Spec: H5P-008
 * Invariants:
 *   - The folder is resolved through the installed package (createRequire), never a hard-coded
 *     node_modules path, so it follows the pinned Lumi version wherever npm placed it.
 *   - Only nn, nb and en are loaded. A namespace without a file for a language (Lumi has no en.json for
 *     `hub` and `library-metadata`, whose English text is the source string) is skipped for that language.
 *   - A file that exists but is not valid JSON fails loudly at startup instead of silently showing keys.
 * Collaborators: ./HvlTranslationCallback.ts (the only consumer), ../i18n/translate.ts (LOCALES).
 * Tests: apps/server/test/h5p/HvlTranslationCallback.test.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Resource, ResourceKey, ResourceLanguage } from 'i18next';
import { LOCALES } from '../i18n/translate.js';

/**
 * Lumi's translation namespaces that the editor, the player, LibraryManager and the content-type list use.
 * `storage-file-implementations` and `server` hold Lumi's error messages.
 */
export const H5P_TRANSLATION_NAMESPACES = [
  'client',
  'copyright-semantics',
  'metadata-semantics',
  'hub',
  'library-metadata',
  'server',
  'storage-file-implementations',
] as const;

/**
 * The folder that holds Lumi's translation files, as `<namespace>/<language>.json`.
 * @returns The absolute path of `build/assets/translations` inside the installed h5p-server package.
 */
export function h5pTranslationsDirectory(): string {
  // WHY: the package has no "exports" map, so its package.json resolves wherever npm installed it
  // (hoisted or nested); a fixed node_modules path would break under a different install layout.
  const packageJson = createRequire(import.meta.url).resolve('@lumieducation/h5p-server/package.json');
  return join(dirname(packageJson), 'build', 'assets', 'translations');
}

/**
 * Reads Lumi's translation files for nn, nb and en into an i18next resource object.
 * @param directory - Folder with `<namespace>/<language>.json` files; defaults to the installed package's.
 * @returns Resources shaped `{ [language]: { [namespace]: strings } }`, ready for i18next's `resources` option.
 * @throws SyntaxError when an existing translation file is not valid JSON.
 */
export function loadH5pTranslationResources(directory: string = h5pTranslationsDirectory()): Resource {
  const resources: Resource = {};
  for (const language of LOCALES) {
    const namespaces: ResourceLanguage = {};
    for (const namespace of H5P_TRANSLATION_NAMESPACES) {
      const file = join(directory, namespace, `${language}.json`);
      if (existsSync(file)) namespaces[namespace] = JSON.parse(readFileSync(file, 'utf8')) as ResourceKey;
    }
    resources[language] = namespaces;
  }
  return resources;
}
