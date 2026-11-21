/**
 * Unit tests of what the browser's fetch metadata says about a request to the Feide login routes (D-131): which
 * requests start a login, which get the sign-in page, and which are refused.
 *
 * Spec: AUTH-001, AUTH-003
 */
import { describe, expect, it } from 'vitest';
import { isPageNavigation, loginStartOf } from '../../../src/auth/feide/loginNavigation.js';

/** Request headers with the given fetch metadata: site, mode, destination and whether the person clicked. */
const metadata = (site: string, mode = 'navigate', dest = 'document', user = false) => ({
  'sec-fetch-site': site,
  'sec-fetch-mode': mode,
  'sec-fetch-dest': dest,
  ...(user ? { 'sec-fetch-user': '?1' } : {}),
});

describe('[AUTH-003] who may start a Feide login', () => {
  it.each([
    ['a browser that sends no fetch metadata', {}, 'start'],
    ['a link on our own page', metadata('same-origin', 'navigate', 'document', true), 'start'],
    ['our own page sending the browser on', metadata('same-origin'), 'start'],
    ['a typed address or a bookmark', metadata('none'), 'start'],
    [
      'a link the person clicked on another site',
      metadata('cross-site', 'navigate', 'document', true),
      'start',
    ],
    [
      'a link the person clicked on a sister site',
      metadata('same-site', 'navigate', 'document', true),
      'start',
    ],
    ['another site sending the browser on without a click', metadata('cross-site'), 'ask'],
    ['a sister site sending the browser on without a click', metadata('same-site'), 'ask'],
    ['a frame, also one of ours', metadata('same-origin', 'navigate', 'iframe'), 'ask'],
    ['a frame on another site', metadata('cross-site', 'navigate', 'iframe', true), 'ask'],
    ['an image on another site', metadata('cross-site', 'no-cors', 'image'), 'refuse'],
    ['a background fetch from another site', metadata('cross-site', 'cors', 'empty'), 'refuse'],
    ['a background fetch from our own page', metadata('same-origin', 'cors', 'empty'), 'refuse'],
  ] as const)('[AUTH-003] %s: %s → %s', (_case, headers, expected) => {
    // Act
    const start = loginStartOf(headers);
    // Assert
    expect(start).toBe(expected);
  });

  it('[AUTH-001] a callback counts as a page only as a top-level navigation, or without fetch metadata', () => {
    // Act
    const answers = [
      isPageNavigation({}),
      isPageNavigation(metadata('cross-site')),
      isPageNavigation(metadata('cross-site', 'navigate', 'iframe')),
      isPageNavigation(metadata('cross-site', 'no-cors', 'image')),
      isPageNavigation(metadata('same-origin', 'cors', 'empty')),
    ];
    // Assert
    expect(answers).toEqual([true, true, false, false, false]);
  });
});
