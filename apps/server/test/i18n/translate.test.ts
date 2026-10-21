/**
 * Tests for the server message catalogues: key parity and lookup.
 *
 * Spec: PROD-012, DOC-009
 */
import { describe, it, expect } from 'vitest';
import nn from '../../src/i18n/locales/nn.json' with { type: 'json' };
import nb from '../../src/i18n/locales/nb.json' with { type: 'json' };
import en from '../../src/i18n/locales/en.json' with { type: 'json' };
import { DEFAULT_LOCALE, isLocale, t } from '../../src/i18n/translate.js';

const keysOf = (obj: object, prefix = ''): string[] =>
  Object.entries(obj)
    .flatMap(([k, v]) => (typeof v === 'object' ? keysOf(v as object, `${prefix}${k}.`) : [`${prefix}${k}`]))
    .sort();

describe('[PROD-012] three languages, Nynorsk first', () => {
  it('[PROD-012] nn, nb and en define exactly the same keys', () => {
    expect(keysOf(nb)).toEqual(keysOf(nn));
    expect(keysOf(en)).toEqual(keysOf(nn));
  });

  it('[PROD-012] uses Nynorsk by default', () => {
    expect(DEFAULT_LOCALE).toBe('nn');
    expect(t('upload.archive.unreadable')).toBe('Fila er ikkje eit gyldig H5P-arkiv.');
  });

  it('[PROD-012] returns Bokmål and English on request', () => {
    expect(t('upload.archive.unreadable', {}, 'nb')).toBe('Filen er ikke et gyldig H5P-arkiv.');
    expect(t('upload.archive.unreadable', {}, 'en')).toBe('The file is not a valid H5P archive.');
  });

  it('[PROD-012] recognises only the three supported locale codes', () => {
    expect(['nn', 'nb', 'en'].every(isLocale)).toBe(true);
    expect(isLocale('no')).toBe(false);
    expect(isLocale('sv')).toBe(false);
  });
});

describe('[DOC-009] messages come from locale files', () => {
  it('[DOC-009] fills placeholders and leaves unknown ones visible', () => {
    expect(t('upload.archive.tooManyEntries', { max: 4000 }, 'en')).toBe(
      'The archive contains too many files (more than 4000).',
    );
    expect(t('upload.archive.fileTooLarge', { entry: 'a.mp4' }, 'en')).toBe(
      'The file “a.mp4” in the archive is larger than {{maxMb}} MB.',
    );
  });

  it('[DOC-009] every message is non-empty and has the same placeholders in every language', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
    for (const key of keysOf(nn)) {
      const [base, ...others] = (['nn', 'nb', 'en'] as const).map((l) =>
        t(key as Parameters<typeof t>[0], {}, l),
      );
      expect(base?.trim(), key).not.toBe('');
      for (const text of others) expect(placeholders(text ?? ''), key).toEqual(placeholders(base ?? ''));
    }
  });
});
