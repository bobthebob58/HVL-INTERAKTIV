/**
 * playerPages.test — the virtual user's page readers on the mock Canvas's real self-posting page and on player-page
 * markup: forms with escaped values, embedded JSON, same-origin assets, and the player's context.
 * Spec: NFR-001
 */
import { describe, expect, it } from 'vitest';
import { autoPostPage } from '../../mock-platform/canvasPages.mjs';
import { autoPostForm, embeddedJson, libraryCategory, pageAssets, playerContext } from '../k6/playerPages.js';

const CONTENT_ID = '01a1aa0a-385d-7693-b2d2-7b691700cdda';

/** A player page as apps/server/src/lti/play/ltiPlayRoutes.ts renders one, cut to what the readers use. */
function playerPage({ questions = true } = {}) {
  const params = questions
    ? {
        questions: [{ library: 'H5P.MultiChoice 1.16', subContentId: 'q-1' }, { library: 'H5P.Blanks 1.14' }],
      }
    : {};
  const integration = {
    ajax: {
      contentUserData:
        '/h5p/contentUserData/:contentId/:dataType/:subContentId?contextId=c&ltik=T&contentVersion=2',
    },
    contents: {
      [`cid-${CONTENT_ID}`]: { library: 'H5P.QuestionSet 1.21', jsonContent: JSON.stringify(params) },
    },
  };
  const bridge = {
    endpoint: '/api/h5p/xapi',
    contentId: CONTENT_ID,
    contentVersion: 2,
    token: { name: 'ltik', value: 'T' },
  };
  return [
    '<script src="/static/lti/ltikLanding.js"></script>',
    `<script type="application/json" id="h5p-integration">${JSON.stringify(integration)}</script>`,
    `<script type="application/json" id="hvl-xapi-bridge">${JSON.stringify(bridge)}</script>`,
    '<script src="/h5p/core/js/h5p.js?version=1.28.0"></script><script src="/h5p/core/js/h5p.js?version=1.28.0"></script>',
    '<link rel="stylesheet" href="/h5p/core/styles/h5p.css?version=1.28.0"><link rel="icon" href="/favicon.ico">',
    '<script src="https://cdn.example/x.js"></script><script src="//cdn.example/y.js"></script>',
  ].join('\n');
}

describe('the virtual user reads the launch pages', () => {
  it('[NFR-001] reads the mock Canvas login form with its escaped values', () => {
    // Arrange: the mock's real page, with characters that must be escaped
    const html = autoPostPage('Mock Canvas · launching', 'http://localhost:1/lti/login?a=1&b="2"', {
      iss: 'http://127.0.0.1:2',
      login_hint: 'x&y<z>"q"',
      lti_storage_target: undefined,
    });

    // Act
    const form = autoPostForm(html);

    // Assert
    expect(form).toEqual({
      action: 'http://localhost:1/lti/login?a=1&b="2"',
      fields: { iss: 'http://127.0.0.1:2', login_hint: 'x&y<z>"q"' },
    });
    expect(autoPostForm('<p>no form</p>')).toBeUndefined();
  });

  it('[NFR-001] reads embedded JSON and tolerates a missing or broken block', () => {
    // Arrange
    const html =
      '<script type="application/json" id="ltijs-login-data">{"targetUrl":"http://p/a?x=1"}</script>';

    // Act and assert
    expect(embeddedJson(html, 'ltijs-login-data')).toEqual({ targetUrl: 'http://p/a?x=1' });
    expect(embeddedJson(html, 'other')).toBeUndefined();
    expect(
      embeddedJson('<script id="ltijs-login-data">{broken</script>', 'ltijs-login-data'),
    ).toBeUndefined();
  });

  it('[NFR-001] fetches each same-origin script and stylesheet once, in page order, and nothing else', () => {
    // Act
    const assets = pageAssets(playerPage());

    // Assert
    expect(assets).toEqual([
      '/static/lti/ltikLanding.js',
      '/h5p/core/js/h5p.js?version=1.28.0',
      '/h5p/core/styles/h5p.css?version=1.28.0',
    ]);
  });

  it('[NFR-001] reads the activity, its version, its questions and the root state URL from the player page', () => {
    // Act
    const context = playerContext(playerPage());

    // Assert
    expect(context).toEqual({
      contentId: CONTENT_ID,
      contentVersion: 2,
      endpoint: '/api/h5p/xapi',
      category: 'http://h5p.org/libraries/H5P.QuestionSet-1.21',
      questions: [{ subContentId: 'q-1', library: 'H5P.MultiChoice 1.16' }],
      stateUrl: `/h5p/contentUserData/${CONTENT_ID}/state/0?contextId=c&ltik=T&contentVersion=2`,
    });
    expect(playerContext(playerPage({ questions: false }))?.questions).toEqual([]);
    expect(playerContext('<html></html>')).toBeUndefined();
    expect(libraryCategory('H5P.DragText 1.10')).toBe('http://h5p.org/libraries/H5P.DragText-1.10');
  });
});
