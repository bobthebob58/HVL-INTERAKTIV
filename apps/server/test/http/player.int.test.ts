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
import { inlineScriptTags, integrationFromPage } from '../support/playerIntegration.js';
import { requestAs } from '../support/requestAs.js';

const BREAKOUT = '</script><script>alert(1)</script>';

describeWithServices('H5P player page', () => {
  let tb: HttpTestbed;
  let author: TestActor;
  let published: string;
  let draft: string;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    author = await tb.actor('author');
    published = await tb.activity(author, { published: true });
    draft = await tb.activity(author);
  }, 60_000);
  afterAll(() => tb.close());

  const play = (who: TestActor, id: string) => requestAs(tb.app, who, 'get', `/h5p/play/${id}`);

  it('[H5P-005] the page preloads the learner’s saved state and is never cached', async () => {
    // Arrange: the learner has saved state that is to be preloaded
    const learner = await tb.actor('learner', { contextId: 'course-1' });
    await requestAs(tb.app, learner, 'post', `/h5p/contentUserData/${published}/state/0`)
      .type('form')
      .send({ data: '{"answers":[2]}', preload: '1', invalidate: '1' });
    // Act
    const res = await play(learner, published);
    // Assert
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(integrationFromPage(res.text)).not.toBeNull();
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
    expect(inlineScriptTags(res.text)).toEqual([]);
    expect(integrationFromPage(res.text)).not.toBeNull();
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
    expect(refused.text).toContain(`<h1>${t('page.notAvailable.title', {}, 'nn')}</h1>`);
    expect(refused.text).not.toContain('content-missing');
    const unknown = await play(learner, crypto.randomUUID());
    expect(unknown.text).toBe(refused.text);
    expect((await play(author, draft)).status).toBe(200);
  });

  it('[PROD-004] without a session the player page sends the browser to Feide login and back', async () => {
    const res = await request(tb.app).get(`/h5p/play/${published}?lang=nb`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      `/auth/feide/login?returnTo=${encodeURIComponent(`/h5p/play/${published}?lang=nb`)}`,
    );
  });

  it('[UD-010] the content container carries the activity’s language from either metadata field', async () => {
    // Arrange: one activity from the editor (defaultLanguage), one as a package stores it (language only)
    const author = await tb.actor('author');
    const learner = await tb.actor('learner');
    const fromEditor = await tb.activity(author, {
      published: true,
      metadata: { title: 'Engelsk', license: 'U', defaultLanguage: 'en' },
    });
    const fromPackage = await tb.activity(author, {
      published: true,
      metadata: { title: 'Bokmål', license: 'U', language: 'nb' },
    });
    // Act
    const pages = await Promise.all([fromEditor, fromPackage].map((id) => play(learner, id)));
    // Assert
    const langs = pages.map((r) => /<div class="h5p-content"[^>]*?(?: lang="([^"]+)")?>/.exec(r.text)?.[1]);
    expect(langs).toEqual(['en', 'nb']);
    expect(pages.every((r) => r.text.includes('<html lang="nn"'))).toBe(true);
  });
});
