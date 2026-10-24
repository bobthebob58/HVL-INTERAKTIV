/**
 * Tests for the document title of a page: the page's own name first and the site name last, in every locale, and the
 * pattern Next.js's title template is built from.
 *
 * Spec: UD-013, PROD-012
 */
import { describe, expect, it } from 'vitest';
import { pageTitle, TITLE_SEPARATOR } from '../../src/i18n/pageTitle';

describe('[UD-013] page titles', () => {
  it.each([
    ['Hjelp', 'nn', 'Hjelp – HVL Interaktiv'],
    ['Celler og vev', 'en', 'Celler og vev – HVL Interaktiv'],
    ['%s', 'nb', '%s – HVL Interaktiv'],
  ] as const)('[UD-013] "%s" in %s is titled "%s" (WCAG 2.4.2)', (name, locale, title) => {
    expect(pageTitle(name, locale)).toBe(title);
    expect(TITLE_SEPARATOR).toBe(' – ');
  });
});
