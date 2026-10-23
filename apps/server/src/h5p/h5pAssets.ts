/**
 * h5pAssets — the files the player and the editor add to Lumi's lists: the H5P Core 1.28 files that h5p-server
 * 10.0.4 leaves out, and HVL's theme for H5P (tokens, Daylight mapping, theme, feedback prefixes).
 *
 * Why: Lumi 10.0.4's asset lists were written for Core 1.27. Core 1.28 adds the theme ("Daylight") styles and
 *      fonts (F3 in spec 01 §1). The editor list also lacks the tooltip and table styles and two core scripts
 *      that the player list has (found in S2). Without them content types render unstyled or call a missing
 *      H5P.Tooltip. HVL's theme must reach every document H5P renders in (UD-011): files in Lumi's
 *      `customization.global` lists go into the player page, into `H5PIntegration.core`, which H5P Core copies
 *      into the iframes it writes for iframe content (`H5P.getHeadTags`), and into
 *      `H5PIntegration.editor.assets`, which the editor's iframe loads. So the theme is added here too, after the
 *      core files and before the libraries' own styles.
 *      The files are added through Lumi's `customization.global` options instead of patching Lumi.
 * Spec: H5P-001, UD-003, UD-011
 * Invariants:
 *   - With these additions, the player and the editor load every style and script that Core 1.28's own
 *     H5PCore lists (`h5p.classes.php`), checked by a test against the fetched core.
 *   - Core URLs are built by Lumi's UrlGenerator, so they carry the same base URL and cache buster as Lumi's own.
 *   - Theme URLs are `<baseUrl>/theme/<name>?version=<content hash>`; only the names in `HVL_THEME_FILES` are served
 *     there (../http/routes/staticRoutes.ts). The tokens come before the Daylight mapping, which comes before the
 *     theme, the feedback styles and the prefixes; the prefix script comes after every core script.
 *   - The files are resolved through the packages' `exports` at start-up; a missing file stops the server.
 * Collaborators: ./H5pEditorFactory.ts, ./H5pPlayerFactory.ts, Lumi's playerAssetList.json and editorAssetList.json,
 *   ../http/routes/staticRoutes.ts, packages/design-tokens, packages/hvl-h5p-theme.
 * Tests: apps/server/test/h5p/H5pFactories.test.ts, apps/server/test/h5p/hvlThemeAssets.test.ts,
 *   apps/server/test/h5p/hvlTheme.browser.int.test.ts
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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

/** Where the H5P router serves the theme files, below the H5P base URL. */
export const THEME_PATH = '/theme';

/** One file of HVL's H5P theme. */
export interface ThemeFile {
  /** The served name, e.g. `hvl-h5p-theme.css`. */
  readonly name: string;
  /** Absolute path of the file in its workspace package. */
  readonly path: string;
  /** The first 12 hex digits of the file's SHA-256, used as the cache buster. */
  readonly version: string;
}

/** Served name → package export, in load order. */
const THEME_SOURCES: readonly (readonly [string, string])[] = [
  ['tokens.css', '@hvl-interaktiv/design-tokens/tokens.css'],
  ['h5p-daylight.css', '@hvl-interaktiv/design-tokens/h5p-daylight.css'],
  ['hvl-h5p-theme.css', '@hvl-interaktiv/hvl-h5p-theme/hvl-h5p-theme.css'],
  ['hvl-h5p-feedback.css', '@hvl-interaktiv/hvl-h5p-theme/hvl-h5p-feedback.css'],
  ['hvl-feedback-prefixes.css', '@hvl-interaktiv/hvl-h5p-theme/hvl-feedback-prefixes.css'],
  ['feedbackPrefixes.js', '@hvl-interaktiv/hvl-h5p-theme/feedbackPrefixes.js'],
];

const resolvePackageFile = createRequire(import.meta.url).resolve;

/** HVL's theme files, in load order, with their content versions (read once at start-up). */
export const HVL_THEME_FILES: readonly ThemeFile[] = THEME_SOURCES.map(([name, specifier]) => {
  const path = resolvePackageFile(specifier);
  const version = createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12);
  return Object.freeze({ name, path, version });
});

/** The `customization.global` option of Lumi's player and editor. */
export interface GlobalAssets {
  readonly scripts: string[];
  readonly styles: string[];
}

type AssetUrls = Pick<IUrlGenerator, 'coreFile' | 'baseUrl'>;

/**
 * The URLs of the theme's styles or scripts.
 * @param urls - Lumi's URL generator (for the base URL).
 * @param kind - `.css` files or `.js` files.
 * @returns Absolute paths with the content version, in load order.
 */
export function themeUrls(urls: Pick<IUrlGenerator, 'baseUrl'>, kind: '.css' | '.js'): string[] {
  return HVL_THEME_FILES.filter((file) => file.name.endsWith(kind)).map(
    (file) => `${urls.baseUrl()}${THEME_PATH}/${file.name}?version=${file.version}`,
  );
}

/**
 * The extra core files and the HVL theme for the player.
 * @param urls - Lumi's URL generator for the same config as the player.
 * @returns Absolute URLs to pass as `customization.global`.
 */
export function playerGlobalAssets(urls: AssetUrls): GlobalAssets {
  return {
    scripts: themeUrls(urls, '.js'),
    styles: [...PLAYER_MISSING_CORE_STYLES.map((file) => urls.coreFile(file)), ...themeUrls(urls, '.css')],
  };
}

/**
 * The extra core files and the HVL theme for the editor.
 * @param urls - Lumi's URL generator for the same config as the editor.
 * @returns Absolute URLs to pass as `customization.global`.
 */
export function editorGlobalAssets(urls: AssetUrls): GlobalAssets {
  return {
    scripts: [...EDITOR_MISSING_CORE_SCRIPTS.map((file) => urls.coreFile(file)), ...themeUrls(urls, '.js')],
    styles: [...EDITOR_MISSING_CORE_STYLES.map((file) => urls.coreFile(file)), ...themeUrls(urls, '.css')],
  };
}
