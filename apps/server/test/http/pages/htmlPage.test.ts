/**
 * Tests for the escaping page template of the server-rendered Session 3 pages.
 *
 * Spec: LTI-003, PROD-004
 */
import { describe, expect, it } from 'vitest';
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
