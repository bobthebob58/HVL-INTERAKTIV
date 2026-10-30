/**
 * Integration tests for the pedagogisk mappe routes (D-094, D-099): who may ask (signed out and Canvas 401, a portal
 * learner 403, an author 200), the refusals in their order (who asks, then the size, then the body), the answer while
 * the content has no mappe files (409 `hvl:mappe-not-ready`), and the Markdown file's headers.
 *
 * Spec: MAPPE-001, MAPPE-002, MAPPE-003, AUTH-003
 */
import {
  MARKDOWN_MEDIA_TYPE,
  mappeActivityListSchema,
  mappeCriteriaSetListSchema,
} from '@hvl-interaktiv/api-contract';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { studioContentWithMappe, studioContentWithoutMappe } from '../../support/mappeFixture.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { REFUSED_CALLERS } from '../metadata/metadataFixtures.js';

const ROUTES = [
  ['get', '/api/mappe/activities'],
  ['get', '/api/mappe/criteria-sets'],
  ['post', '/api/mappe/preview'],
  ['post', '/api/mappe/export?format=md'],
] as const;

describeWithServices('[MAPPE-001] the pedagogisk mappe routes', () => {
  const tb = openApiTestbed({ studioContent: studioContentWithMappe() });
  // WHY: the real content now has its mappe files (W6b), so "no portfolio yet" is the real content without them.
  const empty = openApiTestbed({ studioContent: studioContentWithoutMappe() });
  let author: TestPrincipal;
  let mine: string;
  const body = () => ({ contentIds: [mine], locale: 'nn' });

  beforeAll(async () => {
    author = await tb.principal('author');
    mine = await tb.content(author.principal.userId, { title: 'Blåbærquiz' });
  });
  afterAll(async () => {
    await tb.close();
    await empty.close();
  });

  describe('[AUTH-003] who may ask', () => {
    it.each(
      REFUSED_CALLERS.flatMap((caller) => ROUTES.map(([method, path]) => ({ ...caller, method, path }))),
    )(
      '[AUTH-003] $who: $method $path → $status $errorCode',
      async ({ role, overrides, method, path, status, errorCode }) => {
        // Arrange
        const caller = role ? await tb.principal(role, overrides) : undefined;
        // Act
        const res = caller
          ? await requestAs(tb.app, caller, method, path).send(body())
          : await request(tb.app)[method](path).send(body());
        // Assert
        expect([res.status, res.body.errorCode]).toEqual([status, errorCode]);
      },
    );

    it('[MAPPE-001] answers an author: the activities, the criteria sets, the preview and the file', async () => {
      // Act
      const [activities, sets, preview, file] = await Promise.all(
        ROUTES.map(([method, path]) => requestAs(tb.app, author, method, path).send(body())),
      );
      // Assert
      expect([activities?.status, sets?.status, preview?.status, file?.status]).toEqual([200, 200, 200, 200]);
      expect(mappeActivityListSchema.parse(activities?.body).items.map((item) => item.contentId)).toEqual([
        mine,
      ]);
      expect(mappeCriteriaSetListSchema.parse(sets?.body)).toMatchObject({
        defaultSet: 'hvl-merittering-2025',
        sets: [
          { id: 'hvl-merittering-2025', wordLimit: 7500, attachmentLimit: 11, limitsToVerify: true },
          { id: 'fixture-2027', wordLimit: 100, attachmentLimit: 2, limitsToVerify: false },
        ],
      });
    });
  });

  describe('[MAPPE-001] what an export answers', () => {
    it('[MAPPE-003] answers the Markdown as a download that is never cached, under a plain ASCII name', async () => {
      // Act
      const res = await requestAs(tb.app, author, 'post', '/api/mappe/export?format=md').send(body());
      // Assert
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe(MARKDOWN_MEDIA_TYPE);
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="pedagogisk-mappe-\d{4}-\d{2}-\d{2}\.md"$/,
      );
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.text).toContain('### Blåbærquiz');
    });

    it.each([
      [
        'more than 50 activities',
        { contentIds: Array.from({ length: 51 }, () => crypto.randomUUID()), locale: 'nn' },
        '',
        400,
        'hvl:mappe-too-many',
      ],
      [
        'an unknown criteria set',
        { criteriaSet: 'hvl-merittering-1999' },
        '',
        400,
        'hvl:criteria-set-unknown',
      ],
      ['a body that does not match the schema', { locale: 'se' }, '', 400, 'error.badRequest'],
      ['another format', {}, '&x=1', 400, 'error.badRequest'],
      [
        'an activity that is not the author’s',
        { contentIds: [crypto.randomUUID()] },
        '',
        404,
        'hvl:activity-unavailable',
      ],
    ])('[MAPPE-001] refuses %s', async (_name, change, query, status, errorCode) => {
      // Act
      const res = await requestAs(tb.app, author, 'post', `/api/mappe/export?format=md${query}`).send({
        ...body(),
        ...change,
      });
      // Assert
      expect([res.status, res.body.errorCode]).toEqual([status, errorCode]);
    });

    it('[MAPPE-001] answers 409 hvl:mappe-not-ready while the content has no mappe files, and still lists activities', async () => {
      // Arrange
      const caller = await empty.principal('author');
      const own = await empty.content(caller.principal.userId);
      // Act
      const sets = await requestAs(empty.app, caller, 'get', '/api/mappe/criteria-sets');
      const exported = await requestAs(empty.app, caller, 'post', '/api/mappe/export?format=md').send({
        contentIds: [own],
        locale: 'nn',
      });
      const activities = await requestAs(empty.app, caller, 'get', '/api/mappe/activities');
      // Assert
      expect([sets.status, sets.body.errorCode]).toEqual([409, 'hvl:mappe-not-ready']);
      expect([exported.status, exported.body.errorCode]).toEqual([409, 'hvl:mappe-not-ready']);
      expect(exported.body.message).toMatch(/ikkje lagde inn enno/);
      expect(activities.status).toBe(200);
    });
  });
});
