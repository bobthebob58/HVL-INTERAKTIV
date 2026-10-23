/**
 * Tests for our player page: script-safe integration JSON in an inert data block (no inline script), escaped
 * attributes and no user identifier.
 *
 * Spec: SEC-008, DATA-002, DATA-011
 */
import { describe, it, expect } from 'vitest';
import type { IPlayerModel } from '@lumieducation/h5p-server';
import type { Locale } from '../../../src/i18n/translate.js';
import {
  ANONYMOUS_H5P_USER,
  H5P_INTEGRATION_SCRIPT,
  renderPlayerPage,
} from '../../../src/h5p/render/playerPage.js';
import { escapeHtml, scriptJson } from '../../../src/h5p/render/scriptJson.js';

const BREAKOUT = '</script><script>alert(1)</script>';
const STATE = '{"answers":[1]}';

const model = (overrides: Partial<IPlayerModel> = {}): IPlayerModel =>
  ({
    contentId: '0192f0c4-0000-7000-8000-000000000042',
    styles: ['/h5p/core/styles/h5p.css'],
    scripts: ['/h5p/core/js/h5p.js'],
    integration: {
      contents: {
        'cid-0192f0c4-0000-7000-8000-000000000042': {
          metadata: { title: BREAKOUT },
          jsonContent: JSON.stringify({ [`<b onmouseover=x>${BREAKOUT}`]: BREAKOUT }),
          contentUserData: [{ state: STATE }],
        },
      },
      user: { name: 'Kari Nordmann', mail: 'kari@hvl.no', id: 'fVM1n87kyTwxPqqVDl8B3LabYsblWepkkhGCUE-d9Mo' },
    },
    ...overrides,
  }) as unknown as IPlayerModel;

/** The object the page's JSON data block holds for window.H5PIntegration. */
const integrationOf = (html: string): Record<string, unknown> =>
  JSON.parse(
    /<script type="application\/json" id="h5p-integration">(.*?)<\/script>/.exec(html)?.[1] ?? 'null',
  ) as Record<string, unknown>;
/** Script elements that would run inline: neither a `src` nor an inert JSON block. */
const inlineScripts = (html: string): string[] =>
  html.match(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/json")[^>]*>/g) ?? [];

describe('[SEC-008] player page', () => {
  it('[SEC-008] keeps markup in titles and parameters inert: no inline script, data unchanged', () => {
    const html = renderPlayerPage(model(), 'nn');
    expect(html.match(/<script/g)).toHaveLength(3);
    expect(inlineScripts(html)).toEqual([]);
    expect(html).not.toContain(BREAKOUT);
    const integration = integrationOf(html);
    const contents = integration.contents as Record<string, { metadata: { title: string } }>;
    expect(Object.values(contents)[0]?.metadata.title).toBe(BREAKOUT);
  });

  it('[SEC-008] escapes URLs, the content ID and the language', () => {
    // Act: hostile URLs and content ID
    const html = renderPlayerPage(
      model({
        contentId: '"><script>x()</script>',
        styles: ['/a.css" onload="x()'],
        scripts: ['/b.js"></script><script>x()'],
      }),
      'nn',
    );
    // Assert
    expect(html.match(/<script/g)).toHaveLength(3);
    expect(inlineScripts(html)).toEqual([]);
    expect(html).toContain('<html lang="nn" class="h5p-iframe">');
    expect(html).not.toContain('onload="x()"');
    // Act: a hostile language
    // WHY: the type allows only nn, nb and en; the escaping must hold even if a caller passes something else.
    const hostile = renderPlayerPage(model(), '"><script>x()</script>' as unknown as Locale);
    // Assert
    expect(hostile).toContain(
      '<html lang="&#34;&#62;&#60;script&#62;x()&#60;/script&#62;" class="h5p-iframe">',
    );
    expect(hostile.match(/<script/g)).toHaveLength(3);
  });

  it('[DATA-011] the integration data comes before the boot script, which comes before every H5P script', () => {
    const html = renderPlayerPage(model(), 'nn');
    const data = html.indexOf('id="h5p-integration"');
    const boot = html.indexOf(`<script src="${H5P_INTEGRATION_SCRIPT}"></script>`);
    expect(data).toBeGreaterThan(-1);
    expect(boot).toBeGreaterThan(data);
    expect(html.indexOf('<script src="/h5p/core/js/h5p.js">')).toBeGreaterThan(boot);
  });

  it('[SEC-008] scriptJson round-trips every value and never emits markup characters', () => {
    const value = { a: BREAKOUT, b: '&amp; <!-- -->', c: '\u2028\u2029', d: [1, null, true], e: 'ø æ å' };
    const json = scriptJson(value);
    expect(json).not.toMatch(/[<>&\u2028\u2029]/);
    expect(JSON.parse(json)).toEqual(value);
    expect(escapeHtml(`<"'&>`)).toBe('&#60;&#34;&#39;&#38;&#62;');
  });
});

describe('[DATA-002] no identity in the page', () => {
  it('[DATA-002] the page carries no name, e-mail, pseudonym or account ID, but keeps the saved state', () => {
    const html = renderPlayerPage(model(), 'nn');
    for (const secret of ['Kari Nordmann', 'kari@hvl.no', 'fVM1n87kyTwxPqqVDl8B3LabYsblWepkkhGCUE-d9Mo']) {
      expect(html).not.toContain(secret);
    }
    const integration = integrationOf(html);
    expect(integration.user).toEqual(ANONYMOUS_H5P_USER);
    expect(JSON.stringify(integration)).toContain('answers');
  });

  it('[LTI-003] runs a same-origin first script before H5P and refuses any other script URL', () => {
    // Act
    const html = renderPlayerPage(model(), 'nn', { firstScripts: ['/static/lti/ltikLanding.js'] });
    // Assert
    const landing = html.indexOf('<script src="/static/lti/ltikLanding.js"></script>');
    expect(landing).toBeGreaterThan(0);
    expect(landing).toBeLessThan(html.indexOf('<script src=', landing + 1));
    for (const src of ['https://evil.example/x.js', '//evil.example/x.js', '/static/../x.js', '/h5p/x.js']) {
      expect(() => renderPlayerPage(model(), 'nn', { firstScripts: [src] }), src).toThrow(
        'invalid script path',
      );
    }
  });

  it('[UD-010] the content container carries the activity’s own language, escaped, and none when it states none', () => {
    expect(renderPlayerPage(model(), 'nn', { contentLanguage: 'en' })).toMatch(
      /<div class="h5p-content"[^>]* lang="en">/,
    );
    expect(renderPlayerPage(model(), 'nn', { contentLanguage: '"><x' })).toContain('lang="&#34;&#62;&#60;x"');
    expect(renderPlayerPage(model(), 'nn')).not.toMatch(/<div class="h5p-content"[^>]* lang=/);
  });
});
