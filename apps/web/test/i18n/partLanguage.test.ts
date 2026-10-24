/**
 * Tests for the `lang` of a part of the page: a title in another language than the page gets its tag; the page's own
 * language, a regional variant of it, or no known language gets none.
 *
 * Spec: UD-010
 */
import { describe, expect, it } from 'vitest';
import { partLanguage } from '../../src/i18n/partLanguage';

describe('[UD-010] the language of a part of the page', () => {
  it.each([
    ['nn', 'en', 'nn'],
    ['en-GB', 'nb', 'en-GB'],
    ['nn', 'nn', undefined],
    ['nb-NO', 'nb', undefined],
    [undefined, 'en', undefined],
  ] as const)('[UD-010] a part in %s on a page in %s gets lang=%s', (language, locale, expected) => {
    expect(partLanguage(language, locale)).toBe(expected);
  });
});
