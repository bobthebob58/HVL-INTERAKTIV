/**
 * h5pAssets — the files the player and the editor add to Lumi's lists: the H5P Core 1.28 files that h5p-server
 * 10.0.4 leaves out, and HVL's theme for H5P (tokens, Daylight mapping, theme, feedback prefixes, the content and
 * editor markup repairs, reduced motion).
 *
 * Why: Lumi 10.0.4's asset lists were written for Core 1.27. Core 1.28 adds the theme ("Daylight") styles and
 *      fonts (F3 in spec 01 §1). The editor list also lacks the tooltip and table styles and two core scripts
 *      that the player list has (found in S2). Without them content types render unstyled or call a missing
 *      H5P.Tooltip. HVL's theme must reach every document H5P renders in (UD-011): files in Lumi's
 *      `customization.global` lists go into the player page, into `H5PIntegration.core`, which H5P Core copies
 *      into the iframes it writes for iframe content (`H5P.getHeadTags`), and into
 *      `H5PIntegration.editor.assets`, which the editor's iframe loads. So the theme is added here too, after the
 *      core files and before the libraries' own styles.
 *      The files are added through Lumi's `customization.global` options instead of patching Lumi. The two markup
 *      repair scripts (D-080) and the reduced-motion script (UD-009) need the same documents as the prefix script,
 *      so they are loaded the same way. The xAPI bridge (LTI-010) is different: it runs only in the player document
 *      and only for learners (D-102), so its scripts are the player's last ones, never the editor's, and the player
 *      page removes them for anyone else (./render/xapiBridgeConfig.ts).
 * Spec: H5P-001, UD-003, UD-009, UD-011, UD-030, LTI-010, H5P-009
 * Invariants:
 *   - With these additions, the player and the editor load every style and script that Core 1.28's own
 *     H5PCore lists (`h5p.classes.php`), checked by a test against the fetched core.
 *   - Core URLs are built by Lumi's UrlGenerator, so they carry the same base URL and cache buster as Lumi's own.
 *   - Theme URLs are `<baseUrl>/theme/<name>?version=<content hash>`; only the names in `HVL_THEME_FILES` are served
 *     there (../http/routes/staticRoutes.ts). The tokens come before the Daylight mapping, which comes before the
 *     theme, the feedback styles, the indicator styles (drop zones, task dots) and the prefixes; the prefix, repair
 *     and reduced-motion scripts come after every core script.
 *   - The bridge's files (`XAPI_BRIDGE_FILES`) are never in `HVL_THEME_FILES`, which also feeds the editor; they come
 *     last in the player's scripts, after the theme's, and are served under the same `/theme/` path (D-115).
 *   - The files are resolved through the packages' `exports` at start-up; a missing file stops the server.
 * Collaborators: ./H5pEditorFactory.ts, ./H5pPlayerFactory.ts, Lumi's playerAssetList.json and editorAssetList.json,
 *   ../http/routes/staticRoutes.ts, packages/design-tokens, packages/hvl-h5p-theme.
 * Tests: apps/server/test/h5p/H5pFactories.test.ts, apps/server/test/h5p/hvlThemeAssets.test.ts,
 *   apps/server/test/h5p/hvlTheme.browser.int.test.ts, apps/server/test/h5p/a11yRepairs.browser.int.test.ts,
 *   apps/server/test/h5p/xapiBridge.browser.int.test.ts
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
  ['hvl-h5p-targets.css', '@hvl-interaktiv/hvl-h5p-theme/hvl-h5p-targets.css'],
  ['hvl-h5p-feedback.css', '@hvl-interaktiv/hvl-h5p-theme/hvl-h5p-feedback.css'],
  ['hvl-h5p-indicators.css', '@hvl-interaktiv/hvl-h5p-theme/hvl-h5p-indicators.css'],
  ['hvl-feedback-prefixes.css', '@hvl-interaktiv/hvl-h5p-theme/hvl-feedback-prefixes.css'],
  ['feedbackPrefixes.js', '@hvl-interaktiv/hvl-h5p-theme/feedbackPrefixes.js'],
  ['a11yRepairs.js', '@hvl-interaktiv/hvl-h5p-theme/a11yRepairs.js'],
  ['a11yEditorRepairs.js', '@hvl-interaktiv/hvl-h5p-theme/a11yEditorRepairs.js'],
  ['reducedMotion.js', '@hvl-interaktiv/hvl-h5p-theme/reducedMotion.js'],
];

/** Served name → package export of the xAPI bridge's scripts, in load order: its rules, then the bridge (D-115). */
const XAPI_BRIDGE_SOURCES: readonly (readonly [string, string])[] = [
  ['xapiStatements.js', '@hvl-interaktiv/hvl-h5p-theme/xapiStatements.js'],
  ['xapiBatching.js', '@hvl-interaktiv/hvl-h5p-theme/xapiBatching.js'],
  ['xapiBridge.js', '@hvl-interaktiv/hvl-h5p-theme/xapiBridge.js'],
];

const resolvePackageFile = createRequire(import.meta.url).resolve;

const themeFile = ([name, specifier]: readonly [string, string]): ThemeFile => {
  const path = resolvePackageFile(specifier);
  const version = createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12);
  return Object.freeze({ name, path, version });
};

/** HVL's theme files, in load order, with their content versions (read once at start-up). */
export const HVL_THEME_FILES: readonly ThemeFile[] = THEME_SOURCES.map(themeFile);

/**
 * The xAPI bridge's scripts (LTI-010), in load order: player only, never in `HVL_THEME_FILES` (which the editor also
 * gets), and left out of the page for anyone but a learner (D-102, D-115).
 */
export const XAPI_BRIDGE_FILES: readonly ThemeFile[] = XAPI_BRIDGE_SOURCES.map(themeFile);

/** Every file served under `THEME_PATH`: the theme and the bridge. */
export const SERVED_THEME_FILES: readonly ThemeFile[] = [...HVL_THEME_FILES, ...XAPI_BRIDGE_FILES];

/** The `customization.global` option of Lumi's player and editor. */
export interface GlobalAssets {
  readonly scripts: string[];
  readonly styles: string[];
}

/** The part of Lumi's URL generator the asset lists need: Core's file URLs and the base URL. */
export type AssetUrls = Pick<IUrlGenerator, 'coreFile' | 'baseUrl'>;

/**
 * The URLs of the theme's styles or scripts.
 * @param urls - Lumi's URL generator (for the base URL).
 * @param kind - `.css` files or `.js` files.
 * @returns Absolute paths with the content version, in load order.
 */
export function themeUrls(urls: Pick<IUrlGenerator, 'baseUrl'>, kind: '.css' | '.js'): string[] {
  return HVL_THEME_FILES.filter((file) => file.name.endsWith(kind)).map((file) => fileUrl(urls, file));
}

const fileUrl = (urls: Pick<IUrlGenerator, 'baseUrl'>, file: ThemeFile): string =>
  `${urls.baseUrl()}${THEME_PATH}/${file.name}?version=${file.version}`;

/**
 * Tells whether a script URL is one of the xAPI bridge's, so the player page can leave it out (D-102).
 * @param url - A URL from the player's script lists, e.g. `/h5p/theme/xapiBridge.js?version=…`.
 * @returns True when its path ends in `/theme/<name>` of a file in `XAPI_BRIDGE_FILES`.
 * @spec LTI-010
 */
export function isXapiBridgeUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0] ?? '';
  return XAPI_BRIDGE_FILES.some((file) => path.endsWith(`${THEME_PATH}/${file.name}`));
}

/**
 * The extra core files, the HVL theme and, last, the xAPI bridge for the player.
 * @param urls - Lumi's URL generator for the same config as the player.
 * @returns Absolute URLs to pass as `customization.global`.
 */
export function playerGlobalAssets(urls: AssetUrls): GlobalAssets {
  return {
    // WHY: last, so the bridge registers after Core's x-api scripts and before the libraries' root `attempted` (D-115).
    scripts: [...themeUrls(urls, '.js'), ...XAPI_BRIDGE_FILES.map((file) => fileUrl(urls, file))],
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
