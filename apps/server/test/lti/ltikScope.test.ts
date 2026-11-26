/**
 * Unit tests of what a request with an ltik may ask for (D-130): the list per kind of launch, that an ID in the
 * path must be the launched activity, that everything else is refused, and which routes of the API contract an
 * ltik reaches at all.
 *
 * Spec: LTI-003, LTI-004, LTI-006, PROD-007
 */
import { API_ROUTES } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import { ltikScopeAllows } from '../../src/lti/ltikScope.js';

const LAUNCHED = '0192f1a2-3b4c-7d5e-8f60-718293a4b5c6';
const OTHER = '0192f1a2-3b4c-7d5e-8f60-000000000001';
const resourceLink = { messageType: 'LtiResourceLinkRequest', contentId: LAUNCHED };
const deepLinking = { messageType: 'LtiDeepLinkingRequest' };

/** What the pages of a resource-link launch ask, with the launched activity's ID. */
const RESOURCE_LINK_REQUESTS: [string, string][] = [
  ['GET', '/api/me'],
  ['PUT', '/api/me/notices/formative-use'],
  ['POST', '/api/h5p/xapi'],
  ['GET', `/h5p/contentUserData/${LAUNCHED}/state/0`],
  ['POST', `/h5p/contentUserData/${LAUNCHED}/state/0`],
  ['GET', '/h5p/contentUserData/0/state/0'],
  ['GET', '/h5p/ajax'],
  ['POST', '/h5p/ajax'],
  ['GET', `/h5p/params/${LAUNCHED}`],
  ['PUT', `/h5p/content/${LAUNCHED}`],
  ['GET', `/api/content/${LAUNCHED}/findings`],
  ['GET', `/api/content/${LAUNCHED}/insight`],
  ['GET', `/api/content/${LAUNCHED}/insight/contexts`],
  ['GET', `/api/content/${LAUNCHED}/insight/export`],
  ['GET', `/api/content/${LAUNCHED}/insight/findings`],
  ['GET', `/api/content/${LAUNCHED}/grade-sync`],
  ['POST', `/api/content/${LAUNCHED}/grade-sync/retry`],
];

describe('[LTI-003] what a request with an ltik may ask for', () => {
  it.each(RESOURCE_LINK_REQUESTS)('[LTI-006] a resource-link launch may %s %s', (method, path) => {
    // Act
    const allowed = ltikScopeAllows(resourceLink, method, path);
    // Assert
    expect(allowed).toBe(true);
  });

  it('[LTI-003] the same requests about another activity are refused', () => {
    // Arrange
    const aboutAnother = RESOURCE_LINK_REQUESTS.filter(([, path]) => path.includes(LAUNCHED)).map(
      ([method, path]) => [method, path.replace(LAUNCHED, OTHER)] as const,
    );
    // Act
    const allowed = aboutAnother.filter(([method, path]) => ltikScopeAllows(resourceLink, method, path));
    // Assert
    expect(aboutAnother).toHaveLength(11);
    expect(allowed).toEqual([]);
  });

  it.each([
    ['GET', '/api/content'],
    ['GET', `/api/content/${LAUNCHED}`],
    ['POST', '/h5p/content'],
    ['DELETE', `/h5p/content/${LAUNCHED}`],
    ['GET', `/h5p/download/${LAUNCHED}`],
    ['POST', `/h5p/content/${LAUNCHED}/copy`],
    ['POST', `/api/content/${LAUNCHED}/publish`],
    ['POST', `/api/content/${LAUNCHED}/unpublish`],
    ['PATCH', `/api/content/${LAUNCHED}/sharing`],
    ['GET', `/h5p/play/${LAUNCHED}`],
    ['GET', `/h5p/edit/${LAUNCHED}`],
    ['GET', '/h5p/new'],
    ['POST', `/h5p/params/${LAUNCHED}`],
    ['GET', '/api/a-route-added-later'],
  ])('[PROD-007] no ltik may %s %s', (method, path) => {
    // Act
    const allowed = [resourceLink, deepLinking].map((launch) => ltikScopeAllows(launch, method, path));
    // Assert
    expect(allowed).toEqual([false, false]);
  });

  it('[LTI-004] a Deep Linking launch, and a launch of an unknown kind, reach only «who am I» and the notice', () => {
    // Arrange
    const launches = [
      deepLinking,
      { messageType: 'LtiSubmissionReviewRequest', contentId: LAUNCHED },
      undefined,
    ];
    // Act
    const reached = launches.map((launch) =>
      RESOURCE_LINK_REQUESTS.filter(([method, path]) => ltikScopeAllows(launch, method, path)),
    );
    // Assert
    const common = [
      ['GET', '/api/me'],
      ['PUT', '/api/me/notices/formative-use'],
    ];
    expect(reached).toEqual([common, common, common]);
    // WHY: what anyone may read without signing in, a request with an ltik may read too (D-089).
    expect(ltikScopeAllows(deepLinking, 'GET', '/api/studio/guide/nn')).toBe(true);
    expect(ltikScopeAllows(undefined, 'POST', '/api/studio/guide/nn')).toBe(false);
  });

  it('[LTI-003] a launch that opened no activity reaches no activity route', () => {
    // Arrange
    const noActivity = { messageType: 'LtiResourceLinkRequest' };
    // Act
    const reached = RESOURCE_LINK_REQUESTS.filter(([method, path]) =>
      ltikScopeAllows(noActivity, method, path),
    );
    // Assert
    expect(reached.some(([, path]) => path.includes(LAUNCHED))).toBe(false);
  });

  it('[LTI-003] the ID is compared without regard to case; HEAD counts as GET; one trailing slash is ignored', () => {
    // Act
    const answers = [
      ltikScopeAllows(resourceLink, 'GET', `/h5p/params/${LAUNCHED.toUpperCase()}`),
      ltikScopeAllows(resourceLink, 'HEAD', `/h5p/params/${LAUNCHED}`),
      ltikScopeAllows(resourceLink, 'GET', `/h5p/params/${LAUNCHED}/`),
      ltikScopeAllows(resourceLink, 'GET', `/h5p/params/${LAUNCHED}//`),
      ltikScopeAllows(resourceLink, 'GET', `/h5p/params/${OTHER}/../${LAUNCHED}`),
      ltikScopeAllows(resourceLink, 'GET', `/H5P/params/${LAUNCHED}`),
    ];
    // Assert
    expect(answers).toEqual([true, true, true, false, false, false]);
  });

  it('[PROD-007] of the routes in the API contract, an ltik reaches exactly these', () => {
    // Arrange: every documented `/api` route, with the launched activity wherever a path names an activity
    const requests = API_ROUTES.map((route) => ({
      method: route.method.toUpperCase(),
      path: `/api${route.path.replace(':contentId', LAUNCHED).replace(/:[A-Za-z]+/g, 'x')}`,
      name: `${route.method.toUpperCase()} ${route.path}`,
    }));
    // Act
    const reached = requests
      .filter(({ method, path }) => ltikScopeAllows(resourceLink, method, path))
      .map(({ name }) => name);
    // Assert
    expect(reached.sort()).toEqual(
      [
        'GET /content/:contentId/findings',
        'GET /content/:contentId/grade-sync',
        'GET /content/:contentId/insight',
        'GET /content/:contentId/insight/contexts',
        'GET /content/:contentId/insight/export',
        'GET /content/:contentId/insight/findings',
        'GET /docs',
        'GET /me',
        'GET /studio',
        'GET /studio/guide/:locale',
        'GET /studio/patterns/:patternId',
        'POST /content/:contentId/grade-sync/retry',
        'POST /h5p/xapi',
        'PUT /me/notices/:noticeId',
      ].sort(),
    );
    expect(requests.length).toBeGreaterThan(reached.length + 20);
  });
});
