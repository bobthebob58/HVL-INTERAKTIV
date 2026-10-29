/**
 * Integration test that a co-author's rights end with the co-authorship (D-090): the permission facts are read on
 * every request, so a removed co-author loses Edit, and on a private activity View, at the next request.
 *
 * Spec: PROD-007, H5P-006
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { personNamed, runToken } from './collaborationFixtures.js';

const TOKEN = runToken();

describeWithServices('[PROD-007] a removed co-author', () => {
  const tb = openApiTestbed();
  let owner: TestPrincipal;
  let coAuthor: TestPrincipal;

  beforeAll(async () => {
    owner = await personNamed(tb, `Eigar ${TOKEN}`);
    coAuthor = await personNamed(tb, `Medforfattar ${TOKEN}`);
  });
  afterAll(() => tb.close());

  const rights = async (contentId: string) => {
    const detail = await requestAs(tb.app, coAuthor, 'get', `/api/content/${contentId}`);
    const design = await requestAs(tb.app, coAuthor, 'get', `/api/content/${contentId}/learning-design`);
    return { detail: [detail.status, detail.body.mayEdit], design: design.status };
  };

  it.each([
    ['a private activity', { visibility: 'private' }, { detail: [404, undefined], design: 404 }],
    [
      'an activity shared with HVL',
      { visibility: 'organisation', status: 'published' },
      { detail: [200, false], design: 403 },
    ],
  ] as const)('[PROD-007] loses Edit on %s at the next request', async (_name, options, after) => {
    // Arrange: the co-author may edit
    const contentId = await tb.content(owner.principal.userId, {
      ...options,
      coAuthors: [coAuthor.principal.userId],
    });
    const before = await rights(contentId);
    // Act
    const removed = await requestAs(
      tb.app,
      owner,
      'delete',
      `/api/content/${contentId}/coauthors/${coAuthor.principal.userId}`,
    );
    // Assert
    expect(before).toEqual({ detail: [200, true], design: 200 });
    expect(removed.status).toBe(200);
    expect(await rights(contentId)).toEqual(after);
  });
});
