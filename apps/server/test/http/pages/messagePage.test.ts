/**
 * Tests for the friendly message pages (not available, reopen from Canvas, logged out).
 *
 * Spec: PROD-004, LTI-001, PROD-012
 */
import { describe, expect, it } from 'vitest';
import { messagePage } from '../../../src/http/pages/messagePage.js';

describe('[PROD-004] friendly message pages', () => {
  it('[PROD-004] says "not available" in the requested language with the heading as the title', () => {
    // Act
    const nn = messagePage({
      locale: 'nn',
      titleKey: 'page.notAvailable.title',
      bodyKey: 'page.notAvailable.body',
    });
    const en = messagePage({
      locale: 'en',
      titleKey: 'page.notAvailable.title',
      bodyKey: 'page.notAvailable.body',
    });
    // Assert
    expect(nn).toContain('<html lang="nn">');
    expect(nn).toContain('<title>Ikkje tilgjengeleg – HVL Interaktiv</title>');
    expect(nn).toContain('<h1>Ikkje tilgjengeleg</h1>');
    expect(en).toContain(
      '<p>The activity does not exist, is not published, or you do not have access to it.</p>',
    );
  });

  it('[LTI-001] offers one local link, and refuses links that could leave the site', () => {
    // Act
    const page = messagePage({
      locale: 'nb',
      titleKey: 'page.loggedOut.title',
      bodyKey: 'page.loggedOut.body',
      action: { href: '/auth/feide/login?returnTo=%2F&x=1', labelKey: 'page.login' },
    });
    // Assert
    expect(page).toContain('<a href="/auth/feide/login?returnTo=%2F&amp;x=1">Logg inn med Feide</a>');
    for (const href of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)']) {
      expect(
        () =>
          messagePage({
            locale: 'nn',
            titleKey: 'page.error.title',
            bodyKey: 'error.generic',
            action: { href, labelKey: 'page.login' },
          }),
        href,
      ).toThrow('local paths');
    }
  });
});
