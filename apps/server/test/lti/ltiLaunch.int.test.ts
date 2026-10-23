/**
 * Integration tests for LTI resource-link launches from the mock Canvas through the whole app: the launch, the
 * player page, the friendly refusals and what is stored.
 *
 * Spec: LTI-001, LTI-003, LTI-006, PROD-004
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices } from '../support/services.js';

const claimsOf = (jwt: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>;

describeWithServices('LTI resource-link launch', () => {
  let tb: AppTestbed;
  let owner: string;
  let published: string;
  let draft: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    owner = await tb.staffAccount();
    published = await tb.activity(owner, { published: true, title: 'Brøkar' });
    draft = await tb.activity(owner);
  }, 60_000);
  afterAll(() => tb.close());

  const launch = (contentId: string | undefined, extra: Parameters<typeof launchFromCanvas>[2] = {}) =>
    launchFromCanvas(tb.app, tb.mock.canvas, {
      custom: contentId ? { contentId } : {},
      resourceLinkId: `link-${contentId ?? 'none'}`,
      ...extra,
    });

  describe('a learner opens a published activity', () => {
    it('[LTI-001] the launch reaches the player with an ltik in the URL', async () => {
      const run = await launch(published);
      expect(run.res.status).toBe(302);
      expect(run.path).toBe('/lti/play');
      expect(run.ltik).toBeTruthy();
    });

    it('[LTI-003] the player page is framed only by Canvas, never cached and never sends a Referer', async () => {
      // Arrange
      const { ltik } = await launch(published);
      // Act
      const res = await request(tb.app).get(`/lti/play?ltik=${encodeURIComponent(ltik ?? '')}`);
      // Assert
      expect(res.status).toBe(200);
      expect(res.headers['content-security-policy']).toContain(`frame-ancestors ${tb.mock.canvas.origin}`);
      expect(res.headers['x-frame-options']).toBeUndefined();
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(res.text).toContain('/static/lti/ltikLanding.js');
    });

    it('[LTI-006] the launch records the placement for the course and resource link', async () => {
      // Act
      await launch(published, { course: { id: 'course-lti-006' } });
      // Assert
      const placement = await tb.db.ltiPlacement.findFirst({
        where: { platformId: tb.platformId, contentId: published, resourceLinkId: `link-${published}` },
      });
      expect(placement).not.toBeNull();
    });
  });

  describe('refusals', () => {
    it('[LTI-001] a replayed launch is refused with a page, not a second ltik', async () => {
      // Arrange
      const run = await launch(published);
      // Act
      const again = await run.replay();
      // Assert
      expect(again.status).toBe(400);
      expect(again.headers.location).toBeUndefined();
      expect(again.text).toContain('<h1>');
    });

    it('[LTI-001] a launch for a deployment that is not configured gets no ltik', async () => {
      // Act
      const run = await launch(published, { deploymentId: 'unknown-deployment' });
      // Assert
      expect(run.ltik).toBeUndefined();
      expect(run.res.status).toBe(403);
    });

    it('[LTI-001] an ID token signed with another key is refused', async () => {
      // Act: the platform's own claims, signed with a key the platform never published
      const run = await launchFromCanvas(
        tb.app,
        tb.mock.canvas,
        { custom: { contentId: published } },
        (token, canvas) => canvas.signIdToken(claimsOf(token), { key: 'foreign' }),
      );
      // Assert
      expect(run.ltik).toBeUndefined();
      expect(run.res.status).toBe(400);
    });

    it('[LTI-001] the same claims signed with the platform key are accepted (control for the test above)', async () => {
      const run = await launchFromCanvas(
        tb.app,
        tb.mock.canvas,
        { custom: { contentId: published } },
        (token, canvas) => canvas.signIdToken(claimsOf(token)),
      );
      expect(run.path).toBe('/lti/play');
    });

    it('[PROD-004] a draft, an unknown activity and a launch without an activity get the same 404 page', async () => {
      // Act
      const answers = await Promise.all([
        launch(draft),
        launch('0192f0c4-9999-7000-8000-000000000999'),
        launch(undefined),
      ]);
      // Assert
      for (const { res, ltik } of answers) {
        expect(res.status).toBe(404);
        expect(ltik).toBeUndefined();
      }
      expect(new Set(answers.map(({ res }) => res.text)).size).toBe(1);
    });

    it('[PROD-004] the owner launching as an instructor previews their own draft; other teachers cannot', async () => {
      // Arrange: the teacher's first launch creates their account; they then own a draft
      const first = await launch(published, { user: CANVAS_USERS.teacher });
      const { principal } = await tb.lti.resolveLtik(first.ltik ?? '');
      const ownDraft = await tb.activity(principal.userId);
      // Act
      const own = await launch(ownDraft, { user: CANVAS_USERS.teacher });
      const foreign = await launch(draft, { user: CANVAS_USERS.teacher });
      // Assert
      expect(own.path).toBe('/lti/play');
      expect(foreign.res.status).toBe(404);
    });
  });

  describe('the ltik', () => {
    it('[LTI-003] an invalid ltik gets the "open it again from Canvas" page with 401', async () => {
      const res = await request(tb.app).get('/lti/play?ltik=not-a-token');
      expect(res.status).toBe(401);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('[LTI-003] the ltik never appears in the log', async () => {
      // Arrange
      const { ltik } = await launch(published);
      // Act
      await request(tb.app).get(`/lti/play?ltik=${encodeURIComponent(ltik ?? '')}`);
      // Assert
      expect(tb.logs.join('\n')).not.toContain(ltik);
    });
  });
});
