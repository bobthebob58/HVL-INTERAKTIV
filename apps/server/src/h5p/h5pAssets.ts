/**
 * h5pAssets — the H5P Core 1.28 files that h5p-server 10.0.4 leaves out of its player and editor pages.
 *
 * Why: Lumi 10.0.4's asset lists were written for Core 1.27. Core 1.28 adds the theme ("Daylight") styles and
 *      fonts (F3 in spec 01 §1). The editor list also lacks the tooltip and table styles and two core scripts
 *      that the player list has (found in S2). Without them content types render unstyled or call a missing
 *      H5P.Tooltip.
 *      The files are added through Lumi's `customization.global` options instead of patching Lumi.
 * Spec: H5P-001
 * Invariants:
 *   - With these additions, the player and the editor load every style and script that Core 1.28's own
 *     H5PCore lists (`h5p.classes.php`), checked by a test against the fetched core.
 *   - URLs are built by Lumi's UrlGenerator, so they carry the same base URL and cache buster as Lumi's own.
 * Collaborators: ./H5pEditorFactory.ts, ./H5pPlayerFactory.ts, Lumi's playerAssetList.json and editorAssetList.json.
 * Tests: apps/server/test/h5p/H5pFactories.test.ts
 */
import type { IUrlGenerator } from '@lumieducation/h5p-server';

// UPSTREAM: Lumi master adds these, unreleased; see https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/playerAssetList.json
// Remove when a pinned h5p-server release lists these files; the first test in H5pFactories.test.ts then fails.
/** Core 1.28 styles missing from Lumi 10.0.4's player list. */
export const PLAYER_MISSING_CORE_STYLES: readonly string[] = [
  'styles/h5p-fonts.css',
  'styles/h5p-theme.css',
  'styles/h5p-theme-variables.css',
];

/** Core 1.28 styles missing from Lumi 10.0.4's editor list (the editor also lacks tooltip and table). */
export const EDITOR_MISSING_CORE_STYLES: readonly string[] = [
  ...PLAYER_MISSING_CORE_STYLES,
  'styles/h5p-tooltip.css',
  'styles/h5p-table.css',
];

/** Core 1.28 scripts missing from Lumi 10.0.4's editor list (the player list has them). */
export const EDITOR_MISSING_CORE_SCRIPTS: readonly string[] = ['js/request-queue.js', 'js/h5p-tooltip.js'];

/** The `customization.global` option of Lumi's player and editor. */
export interface GlobalAssets {
  readonly scripts: string[];
  readonly styles: string[];
}

/**
 * The extra core files for the player.
 * @param urls - Lumi's URL generator for the same config as the player.
 * @returns Absolute URLs to pass as `customization.global`.
 */
export function playerGlobalAssets(urls: Pick<IUrlGenerator, 'coreFile'>): GlobalAssets {
  return { scripts: [], styles: PLAYER_MISSING_CORE_STYLES.map((file) => urls.coreFile(file)) };
}

/**
 * The extra core files for the editor.
 * @param urls - Lumi's URL generator for the same config as the editor.
 * @returns Absolute URLs to pass as `customization.global`.
 */
export function editorGlobalAssets(urls: Pick<IUrlGenerator, 'coreFile'>): GlobalAssets {
  return {
    scripts: EDITOR_MISSING_CORE_SCRIPTS.map((file) => urls.coreFile(file)),
    styles: EDITOR_MISSING_CORE_STYLES.map((file) => urls.coreFile(file)),
  };
}
