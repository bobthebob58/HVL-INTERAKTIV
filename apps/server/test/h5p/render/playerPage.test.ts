/**
 * Tests for our player page: script-safe integration JSON, escaped attributes and no user identifier.
 *
 * Spec: SEC-008, DATA-002
 */
import { describe, it, expect } from 'vitest';
import type { IPlayerModel } from '@lumieducation/h5p-server';
import type { Locale } from '../../../src/i18n/translate.js';
import { ANONYMOUS_H5P_USER, renderPlayerPage } from '../../../src/h5p/render/playerPage.js';
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

/** The object assigned to window.H5PIntegration in a rendered page. */
const integrationOf = (html: string): Record<string, unknown> =>
  JSON.parse(/window\.H5PIntegration = (.*);<\/script>/.exec(html)?.[1] ?? 'null') as Record<string, unknown>;

describe('[SEC-008] player page', () => {
  it('[SEC-008] keeps markup in titles and parameters inert: exactly one inline script, data unchanged', () => {
    const html = renderPlayerPage(model(), 'nn');
    expect(html.match(/<script/g)).toHaveLength(2);
    expect(html).not.toContain(BREAKOUT);
    const integration = integrationOf(html);
    const contents = integration.contents as Record<string, { metadata: { title: string } }>;
    expect(Object.values(contents)[0]?.metadata.title).toBe(BREAKOUT);
  });

  it('[SEC-008] escapes URLs, the content ID and the language', () => {
    const html = renderPlayerPage(
      model({
        contentId: '"><script>x()</script>',
        styles: ['/a.css" onload="x()'],
        scripts: ['/b.js"></script><script>x()'],
      }),
      'nn',
    );
    expect(html.match(/<script/g)).toHaveLength(2);
    expect(html).toContain('<html lang="nn" class="h5p-iframe">');
    expect(html).not.toContain('onload="x()"');
    // WHY: the type allows only nn, nb and en; the escaping must hold even if a caller passes something else.
    const hostile = renderPlayerPage(model(), '"><script>x()</script>' as unknown as Locale);
    expect(hostile).toContain(
      '<html lang="&#34;&#62;&#60;script&#62;x()&#60;/script&#62;" class="h5p-iframe">',
    );
    expect(hostile.match(/<script/g)).toHaveLength(2);
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
});
