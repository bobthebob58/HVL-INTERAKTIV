/**
 * Unit tests for the Nynorsk-first translation of Lumi's own H5P strings (i18next, nn → nb → en).
 *
 * Spec: H5P-008
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createHvlTranslationCallback,
  H5P_FALLBACK_LANGUAGES,
  normaliseH5pLanguage,
} from '../../src/h5p/HvlTranslationCallback.js';
import {
  H5P_TRANSLATION_NAMESPACES,
  h5pTranslationsDirectory,
  loadH5pTranslationResources,
} from '../../src/h5p/h5pTranslationResources.js';

// WHY: Lumi does not export the classes that call the callback; tests load them by path, as Lumi runs them.
const load = createRequire(import.meta.url);
const TranslatorWithFallback = (
  load(
    '@lumieducation/h5p-server/build/src/helpers/TranslatorWithFallback.js',
  ) as typeof import('@lumieducation/h5p-server/build/src/helpers/TranslatorWithFallback.js')
).default;
const SemanticsLocalizer = (
  load(
    '@lumieducation/h5p-server/build/src/SemanticsLocalizer.js',
  ) as typeof import('@lumieducation/h5p-server/build/src/SemanticsLocalizer.js')
).default;

// WHY: Lumi's nn files are copies of its nb files (same keys, same text), so the order nn → nb → en is
// proven on small resources where every language says something different.
const LAYERED = {
  nn: { client: { onlyNn: 'nn', inAll: 'nn', emptyInNn: '' } },
  nb: { client: { inAll: 'nb', inNbAndEn: 'nb', emptyInNn: 'nb' } },
  en: { client: { inAll: 'en', inNbAndEn: 'en', onlyEn: 'en', emptyInNn: 'en' } },
};

// Lumi's real files: one instance shared by the tests below (it is read-only).
const lumi = createHvlTranslationCallback();

describe('[H5P-008] HvlTranslationCallback', () => {
  it('[H5P-008] defaults to nn and falls back nb then en', () => {
    // Arrange
    const t = createHvlTranslationCallback(LAYERED);

    // Act and assert
    expect(H5P_FALLBACK_LANGUAGES).toEqual(['nb', 'en']);
    expect(t('client:inAll', 'nn')).toBe('nn');
    expect(t('client:inNbAndEn', 'nn')).toBe('nb');
    expect(t('client:onlyEn', 'nn')).toBe('en');
    // An empty Nynorsk string counts as missing, so the reader gets Bokmål instead of nothing.
    expect(t('client:emptyInNn', 'nn')).toBe('nb');
    // A language HVL does not serve, or none at all, means Nynorsk.
    expect(t('client:inAll', 'de')).toBe('nn');
    expect(t('client:inAll', undefined as unknown as string)).toBe('nn');
    // Lumi's real strings: Nynorsk where Lumi has it, English for keys only English has.
    expect(lumi('copyright-semantics:title', 'nn')).toBe('Tittel');
    expect(lumi('client:mainTitle', 'nn')).toBe('Sharing <strong>:title</strong>');
  });

  it('[H5P-008] returns the key unchanged when no language has it', () => {
    // Arrange
    const t = createHvlTranslationCallback(LAYERED);
    const misses = [
      'client:noSuchKey',
      'noSuchNamespace:inAll',
      // Plain labels from a library's semantics.json, which Lumi's SemanticsLocalizer passes through us.
      'Question text',
      'Note: this text is shown to learners.',
      'Score.max',
      // A key that names a group of strings, not a string.
      'hub:H5P_Accordion',
      '',
    ];

    // Act and assert: the callback with our resources and with Lumi's real ones.
    for (const key of misses) {
      expect(t(key, 'nn')).toBe(key);
      expect(lumi(key, 'nn')).toBe(key);
      expect(lumi(key, 'en')).toBe(key);
    }
  });

  it('[H5P-008] the language can be chosen per user', () => {
    // Arrange
    const t = createHvlTranslationCallback(LAYERED);

    // Act and assert: one callback serves every user; the language of one call does not stick.
    expect(['nn', 'nb', 'en'].map((language) => t('client:inAll', language))).toEqual(['nn', 'nb', 'en']);
    // From nb the chain is nb → en: a Bokmål reader never gets Nynorsk-only text.
    expect(t('client:onlyNn', 'nb')).toBe('client:onlyNn');

    expect(lumi('client:fullscreen', 'nn')).toBe('Full skjerm');
    expect(lumi('client:fullscreen', 'nb')).toBe('Full skjerm');
    expect(lumi('client:fullscreen', 'en')).toBe('Fullscreen');
    expect(lumi('client:fullscreen', 'en-GB')).toBe('Fullscreen');
    expect(lumi('metadata-semantics:title', 'en')).toBe('Title');
    expect(lumi('metadata-semantics:title', 'nn')).toBe('Tittel');
    expect(lumi('client:fullscreen', 'nn-NO')).toBe('Full skjerm');
  });

  it("[H5P-008] Lumi's own translators keep their English text on a miss", () => {
    // Arrange: Lumi's callers (LibraryManager and the Hub list use the first, editor and player the second).
    const translator = new TranslatorWithFallback(lumi, ['hub', 'library-metadata']);
    const localizer = new SemanticsLocalizer(lumi);
    const semantics = [
      { name: 'copyright', type: 'group', label: 'copyright-semantics:copyright-information' },
      { name: 'question', type: 'text', label: 'Note: shown to learners.', description: 'Score.max' },
    ];

    // Act and assert: hits are translated, misses keep the text Lumi passed in.
    expect(translator.tryLocalize('H5P_Image.title', 'Image', 'nn')).toBe('Bilde');
    expect(translator.tryLocalize('H5P_NoSuchType.title', 'No such type', 'nn')).toBe('No such type');
    expect(localizer.localize(semantics, 'nn')).toEqual([
      { ...semantics[0], label: 'Informasjon om copyright' },
      semantics[1],
    ]);
  });

  it('[H5P-008] returns H5P strings verbatim, without interpolation or escaping', () => {
    const t = createHvlTranslationCallback({
      en: { client: { braces: 'Hello {{name}} & $t(client:other)', other: 'Other' } },
    });

    expect(t('client:braces', 'nn')).toBe('Hello {{name}} & $t(client:other)');
    expect(lumi('client:acceptTerms', 'en')).toBe(
      "I accept the <a href=':url' target='_blank'>terms of use</a>",
    );
  });

  it.each([
    ['nn', 'nn'],
    ['NN', 'nn'],
    ['nn-NO', 'nn'],
    ['nn_NO', 'nn'],
    ['nno', 'nn'],
    ['no-NO-NY', 'nn'],
    ['no-nyn', 'nn'],
    ['nb', 'nb'],
    ['nb-NO', 'nb'],
    ['nb_NO', 'nb'],
    ['nob', 'nb'],
    ['no', 'nb'],
    ['no-NO', 'nb'],
    ['en', 'en'],
    ['en-GB', 'en'],
    ['en-US', 'en'],
    ['eng', 'en'],
    ['de', 'nn'],
    ['sv-SE', 'nn'],
    ['cimode', 'nn'],
    ['constructor', 'nn'],
    ['__proto__', 'nn'],
    ['', 'nn'],
    [undefined, 'nn'],
  ])('[H5P-008] reads language code %s as %s', (code, expected) => {
    expect(normaliseH5pLanguage(code)).toBe(expected);
  });
});

describe('[H5P-008] h5pTranslationResources', () => {
  it("[H5P-008] loads Lumi's namespaces for nn, nb and en from the installed package", () => {
    const resources = loadH5pTranslationResources();

    expect(h5pTranslationsDirectory()).toMatch(
      /@lumieducation[/\\]h5p-server[/\\]build[/\\]assets[/\\]translations$/,
    );
    expect(Object.keys(resources).sort()).toEqual(['en', 'nb', 'nn']);
    for (const language of ['nn', 'nb'] as const) {
      expect(Object.keys(resources[language] ?? {}).sort()).toEqual([...H5P_TRANSLATION_NAMESPACES].sort());
    }
    // Lumi ships no English Hub or library titles: English is the source text Lumi keeps on a miss.
    expect(Object.keys(resources.en ?? {}).sort()).toEqual(
      H5P_TRANSLATION_NAMESPACES.filter((ns) => ns !== 'hub' && ns !== 'library-metadata').sort(),
    );
  });

  it('[H5P-008] skips missing files and fails loudly on a broken one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'h5p-translations-'));
    try {
      mkdirSync(join(dir, 'client'));
      writeFileSync(join(dir, 'client', 'nb.json'), JSON.stringify({ close: 'Lukk' }));

      expect(loadH5pTranslationResources(dir)).toEqual({ nn: {}, nb: { client: { close: 'Lukk' } }, en: {} });

      writeFileSync(join(dir, 'client', 'en.json'), '{ not json');
      expect(() => loadH5pTranslationResources(dir)).toThrow(SyntaxError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
