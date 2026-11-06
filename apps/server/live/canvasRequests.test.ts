/**
 * Tests of the live-contract seam's request guards: a bearer token goes only to the course's API origin, however a
 * URL Canvas returns is written, and the refusal names the variable, never the URL (D-101's amendment of
 * 2026-11-05). These run with every live run, also when every check is skipped.
 *
 * Spec: LTI-012, LTI-008
 */
import { describe, expect, it } from 'vitest';
import { nextLinkOf, onApiOrigin } from './canvasRequests.js';

const TARGET = Object.freeze({ apiOrigin: 'https://hvl.test.instructure.com' });

describe('LTI-012 where the live checks send a token', () => {
  it('[LTI-012] accepts a URL on the course API origin, unchanged', () => {
    // Arrange
    const url = 'https://hvl.test.instructure.com/api/lti/courses/1/line_items/2';
    // Act and assert
    expect(onApiOrigin(TARGET, url)).toBe(url);
  });

  it.each([
    ['another host', 'https://elsewhere.example/api/lti/courses/1/line_items/2'],
    ['a look-alike host', 'https://hvl.test.instructure.com.example/x'],
    ['http on the same host', 'http://hvl.test.instructure.com/x'],
    ['another port', 'https://hvl.test.instructure.com:8443/x'],
    ['no URL', 'not a url'],
  ])('[LTI-012] refuses %s, naming the variable and not the URL', (_case, url) => {
    // Act
    const sending = () => onApiOrigin(TARGET, url);
    // Assert
    expect(sending).toThrow(/LIVE_CANVAS_API_ORIGIN/);
    expect(sending).not.toThrow(/elsewhere|\.example|8443|not a url/);
  });

  it('[LTI-008] reads the next page from a Link header as Canvas writes it', () => {
    // Act
    const next = nextLinkOf('<https://c/x?page=1>; rel="current",<https://c/x?page=2>; rel="next"');
    // Assert
    expect([next, nextLinkOf(null), nextLinkOf('<https://c/x?page=1>; rel="first"')]).toEqual([
      'https://c/x?page=2',
      undefined,
      undefined,
    ]);
  });
});
