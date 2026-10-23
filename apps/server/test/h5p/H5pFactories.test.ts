/**
 * Tests for the editor and player factories: Core 1.28 assets (F3), the Hub local ID (F1), and the wiring of
 * permission system, language fallback, DragQuestion removal and renderers.
 *
 * Spec: H5P-001, H5P-002, H5P-006, H5P-008, SEC-008
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { UrlGenerator } from '@lumieducation/h5p-server';
import { afterAll, describe, expect, it } from 'vitest';
import { LOCAL_ID_MAX_LENGTH, localIdFor } from '../../src/h5p/H5pConfigFactory.js';
import { modelRenderer } from '../../src/h5p/H5pPlayerFactory.js';
import { asAccountUser } from '../../src/h5p/HvlH5pUser.js';
import { SERVER_ROOT } from '../../src/h5p/h5pServerInit.js';
import { LanguageFallbackLibraryStorage } from '../../src/h5p/storage/LanguageFallbackLibraryStorage.js';
import { engineTestbed, removeEngineTestbeds } from '../support/engineTestbed.js';

afterAll(removeEngineTestbeds);

/** A `public static $name = array(...)` list from the fetched Core's h5p.classes.php. */
function coreList(name: 'styles' | 'scripts'): string[] {
  const php = readFileSync(join(SERVER_ROOT, 'h5p/core/h5p.classes.php'), 'utf8');
  const block = new RegExp(`public static \\$${name} = array\\(([^)]*)\\)`).exec(php)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '');
}

const author = asAccountUser({
  accountId: '0192f0c4-0000-7000-8000-000000000001',
  role: 'author',
  learnerKey: 'k',
  contextId: '',
  locale: 'nn',
  hvlMember: true,
  feideAuthenticated: true,
  ltiLaunchContentIds: [],
});

describe('H5P engine factories', () => {
  it('[H5P-001] Core 1.28 lists the theme styles that Lumi 10.0.4 leaves out (F3 still applies)', () => {
    const lumi = createRequire(import.meta.url)(
      '@lumieducation/h5p-server/build/src/playerAssetList.json',
    ) as {
      styles: { core: string[] };
    };
    expect(coreList('styles')).toContain('styles/h5p-theme.css');
    expect(lumi.styles.core).not.toContain('styles/h5p-theme.css');
  });

  it('[H5P-001] the editor page loads every core style and script that Core 1.28 lists (F3)', async () => {
    const { editor, config } = await engineTestbed();
    const urls = new UrlGenerator(config);
    const model = (await editor.render(undefined as never, 'nn', author)) as {
      styles: string[];
      scripts: string[];
    };
    for (const file of coreList('styles')) expect(model.styles).toContain(urls.coreFile(file));
    for (const file of coreList('scripts')) expect(model.scripts).toContain(urls.coreFile(file));
  });

  it('[H5P-001] the player loads every core style and script that Core 1.28 lists (F3)', async () => {
    const { player, config } = await engineTestbed();
    const urls = new UrlGenerator(config);
    // WHY: the lists are private in Lumi; rendering would need installed content types.
    const styles = (player as unknown as { listCoreStyles(): string[] }).listCoreStyles();
    const scripts = (player as unknown as { listCoreScripts(): string[] }).listCoreScripts();
    for (const file of coreList('styles')) expect(styles).toContain(urls.coreFile(file));
    for (const file of coreList('scripts')) expect(scripts).toContain(urls.coreFile(file));
  });

  it('[H5P-001] the Hub registration sends a local_id of at most 15 characters, stable per site (F1)', async () => {
    const { editor, config } = await engineTestbed();
    config.uuid = '7f9a1c2e-3b4d-4e5f-8a9b-0c1d2e3f4a5b';
    const registration = editor.contentTypeCache['compileRegistrationData']() as { local_id: string };
    expect(registration.local_id.length).toBeLessThanOrEqual(LOCAL_ID_MAX_LENGTH);
    expect(registration.local_id).toBe(localIdFor(config.uuid));
  });

  it('[H5P-008] editor and player read library languages through the nn → nb → en fallback', async () => {
    const { editor, player } = await engineTestbed();
    expect(editor.libraryManager.libraryStorage).toBeInstanceOf(LanguageFallbackLibraryStorage);
    const playerStorage = (player as unknown as { libraryStorage: unknown }).libraryStorage;
    expect(playerStorage).toBeInstanceOf(LanguageFallbackLibraryStorage);
  });

  it('[H5P-002] the editor built by the factory never offers H5P.DragQuestion', async () => {
    const { editor } = await engineTestbed([
      {
        machineName: 'H5P.Column',
        minorVersion: 34,
        runnable: true,
        semantics: [
          { name: 'c', type: 'library', options: ['H5P.MultiChoice 1.16', 'H5P.DragQuestion 1.14'] },
        ],
      },
    ]);
    const data = await editor.getLibraryData('H5P.Column', '1', '34', 'nn');
    expect(JSON.stringify(data.semantics)).toContain('H5P.MultiChoice 1.16');
    expect(JSON.stringify(data.semantics)).not.toContain('H5P.DragQuestion');
  });

  it('[SEC-008] neither engine renders Lumi HTML; both hand over the model for our templates', async () => {
    const { editor, player } = await engineTestbed();
    const model = await editor.render(undefined as never, 'nn', author);
    expect(typeof model).toBe('object');
    expect((player as unknown as { renderer: unknown }).renderer).toBe(modelRenderer);
  });
});
