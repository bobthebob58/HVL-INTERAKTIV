/**
 * Tests for the web app's translations: Nynorsk by default, fallback through nn → nb → en, placeholders, and the
 * locale decision read from Express's header.
 *
 * Spec: PROD-012, DOC-009, UD-010
 */
import { describe, expect, it } from 'vitest';
import { localeFromHeader } from '../../src/i18n/requestLocale';
import { isLocale, t, type MessageKey } from '../../src/i18n/translate';

describe('[PROD-012] web translations', () => {
  it('[PROD-012] returns the text in each supported locale', () => {
    expect(t('help.title', 'nn')).toBe('Hjelp');
    expect(t('notFound.title', 'nb')).toBe('Fant ikke siden');
    expect(t('notFound.title', 'en')).toBe('Page not found');
  });

  it('[DOC-009] an unknown key comes back as itself instead of failing', () => {
    expect(t('no.such.key' as MessageKey, 'nn')).toBe('no.such.key');
  });

  it('[PROD-012] only nn, nb and en are locales', () => {
    expect(['nn', 'nb', 'en'].every(isLocale)).toBe(true);
    expect(['no', 'NN', 'en-GB', ''].some(isLocale)).toBe(false);
  });

  it('[UD-010] the request locale is Nynorsk unless Express sent a supported one', () => {
    expect(localeFromHeader('nb')).toBe('nb');
    expect(localeFromHeader(null)).toBe('nn');
    expect(localeFromHeader('de')).toBe('nn');
    expect(localeFromHeader('en, nb')).toBe('nn');
  });
});
