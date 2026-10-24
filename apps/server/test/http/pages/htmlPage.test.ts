/**
 * Tests for the escaping page template of the server-rendered pages, and their header with Hjelp.
 *
 * Spec: LTI-003, PROD-004, UD-013, UD-006, UD-007
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../src/i18n/translate.js';
import { escapeHtml, htmlPage, markup, SafeHtml } from '../../../src/http/pages/htmlPage.js';

const ATTACK = `"><script>alert('x')</script><img src=x onerror=alert(1)>&`;

describe('[LTI-003] page template', () => {
  it('[LTI-003] escapes every interpolated value, including arrays, and keeps SafeHtml as it is', () => {
    // Act
    const out = markup`<p title="${ATTACK}">${ATTACK}${[ATTACK, markup`<b>${ATTACK}</b>`]}${undefined}${false}${0}</p>`;
    // Assert
    expect(out.value).not.toMatch(/<script|<img|onerror=alert\(1\)>/);
    expect(out.value).toContain('<b>&quot;&gt;&lt;script&gt;');
    expect(out.value.endsWith('0</p>')).toBe(true);
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('[LTI-003] builds a document with lang, viewport, no-referrer, one main and only static scripts', () => {
    // Act
    const page = htmlPage(
      {
        locale: 'nb',
        title: ATTACK,
        main: markup`<h1>Hei</h1>`,
        scripts: ['/static/lti/ltikLanding.js'],
        bodyData: { 'content-id': ATTACK },
      },
      'HVL Interaktiv',
    );
    // Assert
    expect(page.startsWith('<!doctype html>\n<html lang="nb">')).toBe(true);
    expect(page).toContain('<meta name="referrer" content="no-referrer">');
    // UD-001: the design tokens and the server pages' stylesheet, both same-origin files (D-067).
    expect(page).toContain('<link rel="stylesheet" href="/h5p/theme/tokens.css">');
    expect(page).toContain('<link rel="stylesheet" href="/static/pages/serverPages.css">');
    expect(page).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(page.match(/<main/g)).toHaveLength(1);
    expect(page).toContain('<script src="/static/lti/ltikLanding.js" defer></script>');
    expect(page).toContain('data-content-id="&quot;&gt;&lt;script&gt;');
    expect(page).not.toMatch(/<script>|<style|style=/);
    expect(page).toContain('&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;');
  });

  it('[LTI-003] refuses a script that is not one of our static files and a malformed data attribute', () => {
    // Arrange
    const page = (input: { scripts?: string[]; bodyData?: Record<string, string> }) => () =>
      htmlPage({ locale: 'nn', title: 't', main: new SafeHtml('<h1>t</h1>'), ...input }, 'HVL Interaktiv');
    const bad = [
      'https://evil.example/x.js',
      '//evil.example/x.js',
      '/static/../x.js',
      '/static/a.js"',
      'javascript:x',
    ];
    // Act and assert
    for (const src of bad) {
      expect(page({ scripts: [src] }), src).toThrow('invalid script path');
    }
    expect(page({ bodyData: { 'x" onload="alert(1)': 'v' } })).toThrow('invalid data attribute name');
  });
});

describe('[UD-013] the Hjelp header', () => {
  const pageWith = (help?: { newTab: boolean }) =>
    htmlPage({ locale: 'nn', title: 'T', main: markup`<h1>T</h1>`, help }, 'HVL Interaktiv');

  it('[UD-013] with a help link the page starts with a skip link and the banner with Hjelp, like the web app', () => {
    // Act
    const page = pageWith({ newTab: false });
    // Assert
    const body = page.slice(page.indexOf('<body>'));
    expect(body.indexOf('class="hvl-skip-link" href="#main"')).toBeLessThan(body.indexOf('<header'));
    expect(body.indexOf('</header>')).toBeLessThan(body.indexOf('<main id="main">'));
    expect(page).toContain(`<nav aria-label="${t('page.help.nav', {}, 'nn')}">`);
    expect(page).toContain(`<a href="/hjelp?lang=nn" target="_top">${t('page.help.link', {}, 'nn')}</a>`);
    expect(page).toContain('<link rel="stylesheet" href="/static/pages/serverChrome.css">');
    expect(page).not.toMatch(/style=/);
  });

  it('[UD-007] inside Canvas the link opens a new tab, says so, and gives the new tab no opener', () => {
    const page = pageWith({ newTab: true });
    expect(page).toContain('<a href="/hjelp?lang=nn" target="_blank" rel="noopener noreferrer">');
    expect(page).toContain(`<span class="hvl-visually-hidden"> ${t('page.help.newTab', {}, 'nn')}</span>`);
  });

  it('[UD-013] Hjelp carries the page language, which /hjelp follows when no launch says it (D-076)', () => {
    const help = { newTab: true };
    const page = htmlPage({ locale: 'en', title: 'T', main: markup`<h1>T</h1>`, help }, 'HVL Interaktiv');
    expect(page).toContain('<a href="/hjelp?lang=en" target="_blank" rel="noopener noreferrer">');
  });

  it('[UD-013] without a help link (the web app does not run) there is no header and no link to /hjelp', () => {
    const page = pageWith();
    expect(page).not.toContain('<header');
    expect(page).not.toContain('/hjelp');
    expect(page).not.toContain('serverChrome.css');
  });
});
