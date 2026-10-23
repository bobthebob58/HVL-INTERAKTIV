/**
 * Integration tests for the player page: preloaded learner state, Core 1.28 styles, inert stored markup, no
 * user identifier in the page, and no player for drafts.
 *
 * Spec: H5P-001, H5P-005, H5P-006, SEC-008, DATA-002
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { t } from '../../src/i18n/translate.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithServices } from '../support/services.js';

const BREAKOUT = '</script><script>alert(1)</script>';

describeWithServices('H5P player page', () => {
  let tb: HttpTestbed;
  let author: TestActor;
  let published: string;
  let draft: string;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    author = await tb.actor('author');
    const body = {
      library: 'H5P.MultiChoice 1.16',
      params: { params: { question: 'Kva?', answers: ['Ja'] }, metadata: { title: 'Q', license: 'U' } },
    };
    const save = async () =>
      (
        (
          await request(tb.app)
            .post('/h5p/content')
            .set(...author.header)
            .send(body)
        ).body as { contentId: string }
      ).contentId;
    published = await save();
    draft = await save();
    await tb.db.h5PContent.update({
      where: { id: published },
      data: { status: 'published', visibility: 'organisation' },
    });
  }, 60_000);
  afterAll(() => tb.close());

  const play = (who: TestActor, id: string) =>
    request(tb.app)
      .get(`/h5p/play/${id}`)
      .set(...who.header);

  it('[H5P-005] the page preloads the learner’s saved state and is never cached', async () => {
    const learner = await tb.actor('learner', { contextId: 'course-1' });
    await request(tb.app)
      .post(`/h5p/contentUserData/${published}/state/0`)
      .set(...learner.header)
      .type('form')
      .send({ data: '{"answers":[2]}', preload: '1', invalidate: '1' });
    const res = await play(learner, published);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.text).toContain('window.H5PIntegration');
    expect(res.text).toMatch(/answers.{0,6}\[2\]/);
  });

  it('[H5P-001] the page loads the Core 1.28 theme styles (F3)', async () => {
    const learner = await tb.actor('learner');
    const res = await play(learner, published);
    expect(res.text).toMatch(/href="[^"]*\/h5p\/core\/styles\/h5p-theme\.css\?version=/);
    expect(res.text).toMatch(/href="[^"]*\/h5p\/core\/styles\/h5p-theme-variables\.css/);
  });

  it('[SEC-008] a stored title that tries to close the script tag stays text', async () => {
    // WHY: written directly, as by an older version or another path; saves through the editor sanitise titles.
    const row = await tb.db.h5PContent.findUniqueOrThrow({ where: { id: published } });
    const metadata = { ...(row.metadata as object), title: BREAKOUT };
    await tb.db.h5PContent.update({ where: { id: published }, data: { title: BREAKOUT, metadata } });
    const learner = await tb.actor('learner');
    const res = await play(learner, published);
    expect(res.status).toBe(200);
    expect(res.text).not.toContain(BREAKOUT);
    const inline = res.text.match(/<script>/g) ?? [];
    expect(inline).toHaveLength(1);
  });

  it('[DATA-002] the page carries no pseudonym and no account ID', async () => {
    const learner = await tb.actor('learner');
    const res = await play(learner, published);
    expect(res.text).not.toContain(learner.actor.learnerKey);
    expect(res.text).not.toContain(learner.actor.accountId);
    expect(res.text).toMatch(/"user":\{"name":"","mail":"","id":""\}/);
  });

  it('[H5P-006] a learner gets no player for a draft (404, its existence is not revealed); its author previews it', async () => {
    const learner = await tb.actor('learner');
    const refused = await play(learner, draft);
    expect(refused.status).toBe(404);
    expect(refused.body).toMatchObject({
      errorCode: 'h5p-player:content-missing',
      message: t('error.notFound', {}, 'nn'),
    });
    expect((await play(author, draft)).status).toBe(200);
  });
});
