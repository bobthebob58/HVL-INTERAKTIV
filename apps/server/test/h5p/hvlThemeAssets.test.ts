/**
 * Tests that HVL's H5P theme reaches every document H5P renders in: the player page, `H5PIntegration.core` (which
 * H5P Core copies into the iframes it writes) and the editor's iframe assets, in the right order and versioned:
 * its stylesheets and its scripts (answer prefixes, markup repairs, reduced motion). The xAPI bridge's scripts come
 * last in the player's list only, never in the theme's or the editor's (D-102, D-115).
 *
 * Spec: UD-003, UD-009, UD-011, LTI-010
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { UrlGenerator } from '@lumieducation/h5p-server';
import { afterAll, describe, expect, it } from 'vitest';
import {
  editorGlobalAssets,
  HVL_THEME_FILES,
  isXapiBridgeUrl,
  playerGlobalAssets,
  SERVED_THEME_FILES,
  themeUrls,
  XAPI_BRIDGE_FILES,
} from '../../src/h5p/h5pAssets.js';
import { asAccountUser } from '../../src/h5p/HvlH5pUser.js';
import { engineTestbed, removeEngineTestbeds } from '../support/engineTestbed.js';
import { testActor } from '../support/testActors.js';

afterAll(removeEngineTestbeds);

const urls = { baseUrl: () => '/h5p', coreFile: (file: string) => `/h5p/core/${file}?version=1.28.0` };
const names = (list: string[]) => list.map((url) => /\/theme\/([^?]+)/.exec(url)?.[1]).filter(Boolean);
const STYLE_ORDER = [
  'tokens.css',
  'h5p-daylight.css',
  'hvl-h5p-theme.css',
  'hvl-h5p-targets.css',
  'hvl-h5p-feedback.css',
  'hvl-h5p-indicators.css',
  'hvl-feedback-prefixes.css',
];
/** The answer prefixes (UD-003), the content and editor markup repairs (D-080) and the jQuery half of reduced
 * motion (UD-009). */
const SCRIPT_ORDER = ['feedbackPrefixes.js', 'a11yRepairs.js', 'a11yEditorRepairs.js', 'reducedMotion.js'];
/** The xAPI bridge: its rules, its batch rules and the bridge, after every theme script, in the player only. */
const BRIDGE_ORDER = ['xapiStatements.js', 'xapiBatching.js', 'xapiBridge.js'];

describe('the HVL theme files', () => {
  it('[UD-011] resolves every theme file from its package and versions it by content', () => {
    expect(HVL_THEME_FILES.map((f) => f.name)).toEqual([...STYLE_ORDER, ...SCRIPT_ORDER]);
    for (const file of HVL_THEME_FILES) {
      const hash = createHash('sha256').update(readFileSync(file.path)).digest('hex');
      expect(file.version).toBe(hash.slice(0, 12));
      expect(file.path).toMatch(/packages\/(design-tokens|hvl-h5p-theme)\//);
    }
  });

  it('[UD-011] theme URLs live under the H5P base URL with the content version', () => {
    const [first] = HVL_THEME_FILES;
    expect(themeUrls(urls, '.css')[0]).toBe(`/h5p/theme/tokens.css?version=${first?.version}`);
    expect(names(themeUrls(urls, '.js'))).toEqual(SCRIPT_ORDER);
  });

  it('[UD-011] the player adds the theme after the Core 1.28 styles, tokens first', () => {
    const assets = playerGlobalAssets(urls);
    const daylight = assets.styles.indexOf('/h5p/core/styles/h5p-theme-variables.css?version=1.28.0');
    const tokens = assets.styles.findIndex((url) => url.includes('/theme/tokens.css'));
    expect(daylight).toBeGreaterThanOrEqual(0);
    expect(tokens).toBeGreaterThan(daylight);
    expect(names(assets.styles)).toEqual(STYLE_ORDER);
    expect(names(assets.scripts)).toEqual([...SCRIPT_ORDER, ...BRIDGE_ORDER]);
  });

  it('[LTI-010] keeps the bridge out of the theme and the editor, and serves it beside the theme', () => {
    // Arrange
    const editor = editorGlobalAssets(urls);
    // Act
    const bridge = playerGlobalAssets(urls).scripts.filter(isXapiBridgeUrl);
    // Assert
    expect(XAPI_BRIDGE_FILES.map((f) => f.name)).toEqual(BRIDGE_ORDER);
    expect(HVL_THEME_FILES.some((f) => BRIDGE_ORDER.includes(f.name))).toBe(false);
    expect(editor.scripts.filter(isXapiBridgeUrl)).toEqual([]);
    expect(names(bridge)).toEqual(BRIDGE_ORDER);
    expect(SERVED_THEME_FILES.map((f) => f.name)).toEqual([...STYLE_ORDER, ...SCRIPT_ORDER, ...BRIDGE_ORDER]);
    expect(isXapiBridgeUrl('/h5p/theme/reducedMotion.js?version=1')).toBe(false);
    expect(isXapiBridgeUrl('/h5p/theme/xapiBridge.js?version=1')).toBe(true);
  });

  it('[UD-011] the editor adds the theme after its missing core files', () => {
    const assets = editorGlobalAssets(urls);
    expect(assets.scripts[0]).toBe('/h5p/core/js/request-queue.js?version=1.28.0');
    expect(names(assets.scripts)).toEqual(SCRIPT_ORDER);
    expect(names(assets.styles)).toEqual(STYLE_ORDER);
    expect(assets.styles.at(-1)).toContain('/theme/hvl-feedback-prefixes.css');
  });
});

describe('the engines built by the factories', () => {
  const author = asAccountUser(testActor('author'));

  it('[UD-011] list the theme as core files, so H5P copies them into the iframes it writes', async () => {
    const { player } = await engineTestbed();
    // WHY: the lists are private in Lumi; they become `H5PIntegration.core`, which `H5P.getHeadTags` reads.
    const styles = (player as unknown as { listCoreStyles(): string[] }).listCoreStyles();
    const scripts = (player as unknown as { listCoreScripts(): string[] }).listCoreScripts();
    expect(names(styles)).toEqual(STYLE_ORDER);
    expect(names(scripts)).toEqual([...SCRIPT_ORDER, ...BRIDGE_ORDER]);
  });

  it("[UD-011] give the editor's iframe the theme through H5PIntegration.editor.assets", async () => {
    // Arrange
    const { editor, config } = await engineTestbed();
    const core = new UrlGenerator(config);
    // Act
    const model = (await editor.render(undefined as never, 'nn', author)) as {
      integration: { editor: { assets: { css: string[]; js: string[] } } };
    };
    // Assert
    const { css, js } = model.integration.editor.assets;
    expect(names(css)).toEqual(STYLE_ORDER);
    expect(names(js)).toEqual(SCRIPT_ORDER);
    expect(css.indexOf(core.coreFile('styles/h5p-theme-variables.css'))).toBeLessThan(
      css.findIndex((url) => url.includes('/theme/h5p-daylight.css')),
    );
  });
});
