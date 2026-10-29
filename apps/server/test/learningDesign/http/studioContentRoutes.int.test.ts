/**
 * Integration tests for the public studio routes through the whole app (D-089): the overview, the guide and a
 * pattern's detail answer 200 to a signed-out visitor, a Canvas launch, a portal author and a portal learner alike, with the
 * contract's shapes; the fixture pattern and the fixture guide reach them with no code change; an unknown pattern or
 * language is 404.
 *
 * Spec: PED-001, PED-002, PED-003, PED-011, AUTH-003
 */
import { guideSchema, patternDetailSchema, studioOverviewSchema } from '@hvl-interaktiv/api-contract';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { loginWithFeide } from '../../support/feideTestbed.js';
import { FIXTURE_PATTERN_ID } from '../../support/fixturePattern.js';
import { studioContentWithFixtures } from '../../support/guideFixture.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { describeWithServices } from '../../support/services.js';

const ROUTES = [
  ['/api/studio', studioOverviewSchema],
  ['/api/studio/guide/nb', guideSchema],
  [`/api/studio/patterns/${FIXTURE_PATTERN_ID}`, patternDetailSchema],
] as const;

describeWithServices('[PED-001] the public studio routes', () => {
  let tb: AppTestbed;
  const callers = new Map<string, (path: string) => request.Test>();

  beforeAll(async () => {
    tb = await openAppTestbed(undefined, { studioContent: studioContentWithFixtures({ pattern: true }) });
    const login = async (user: string) =>
      (await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, user)).sessionCookie ?? '';
    const [cookie, learnerCookie] = [await login('author'), await login('student')];
    const { ltik } = await launchFromCanvas(tb.app, tb.mock.canvas, {
      messageType: 'LtiDeepLinkingRequest',
      user: { sub: `teacher-${Date.now()}`, roles: CANVAS_USERS.teacher.roles },
    });
    // WHY: without an ltik the Canvas case would be a signed-out request and pass for the wrong reason.
    if (!ltik || !cookie || !learnerCookie) throw new Error('a launch or a login gave no credential');
    callers.set('nobody signed in', (path) => request(tb.app).get(path));
    callers.set('a Canvas launch (ltik)', (path) =>
      request(tb.app).get(path).set('Authorization', `Bearer ${ltik}`),
    );
    callers.set('a signed-in portal author', (path) => request(tb.app).get(path).set('Cookie', cookie));
    callers.set('a signed-in portal learner', (path) =>
      request(tb.app).get(path).set('Cookie', learnerCookie),
    );
  }, 60_000);
  afterAll(() => tb.close());

  describe('[AUTH-003] who may read', () => {
    // WHY: `it.each` reads its list when the file is collected, before `beforeAll` fills `callers`.
    it.each([
      'nobody signed in',
      'a Canvas launch (ltik)',
      'a signed-in portal author',
      'a signed-in portal learner',
    ])(
      '[AUTH-003] %s gets the overview, the guide and a pattern’s detail, in the contract’s shapes',
      async (who) => {
        // Act
        const answers = await Promise.all(ROUTES.map(([path]) => callers.get(who)?.(path)));
        // Assert
        for (const [index, [path, schema]] of ROUTES.entries()) {
          const answer = answers[index];
          expect(answer?.status, path).toBe(200);
          expect(schema.safeParse(answer?.body).success, path).toBe(true);
          expect(answer?.headers['cache-control']).toBe('no-store');
        }
      },
    );
  });

  it('[PED-011] the fixture pattern folder is in the catalogue and has its page, with no code change', async () => {
    // Act
    const overview = await request(tb.app).get('/api/studio');
    const detail = await request(tb.app).get(`/api/studio/patterns/${FIXTURE_PATTERN_ID}`);
    // Assert
    const ids = (overview.body.patterns as { id: string }[]).map(({ id }) => id);
    expect(ids).toContain(FIXTURE_PATTERN_ID);
    expect(detail.body).toMatchObject({
      id: FIXTURE_PATTERN_ID,
      contentTypes: ['H5P.QuestionSet', 'H5P.Blanks'],
      references: [{ key: 'fixture2026' }],
    });
    expect(typeof detail.body.available).toBe('boolean');
  });

  it('[PED-002] the guide route answers the fixture guide in each language, with its references', async () => {
    // Act
    const answers = await Promise.all(
      ['nn', 'nb', 'en'].map((locale) => request(tb.app).get(`/api/studio/guide/${locale}`)),
    );
    // Assert
    for (const answer of answers) {
      expect(answer.body.nodes.filter((node: { type: string }) => node.type === 'marker')).toEqual([
        { type: 'marker', name: 'phase-matrix' },
        { type: 'marker', name: 'pattern-catalogue' },
      ]);
      expect(answer.body.references.map((reference: { key: string }) => reference.key)).toEqual([
        'fixture-guide2026',
        'fixture-box2026',
      ]);
    }
  });

  it('[PED-011] answers 404 for an unknown pattern, a malformed pattern ID and a language that is not nn, nb or en', async () => {
    // Act
    const answers = await Promise.all(
      ['/api/studio/patterns/no-such-pattern', '/api/studio/patterns/Not_An_ID', '/api/studio/guide/se'].map(
        (path) => request(tb.app).get(path),
      ),
    );
    // Assert
    expect(answers.map((answer) => [answer.status, answer.body.errorCode])).toEqual([
      [404, 'error.notFound'],
      [404, 'error.notFound'],
      [404, 'error.notFound'],
    ]);
  });
});
