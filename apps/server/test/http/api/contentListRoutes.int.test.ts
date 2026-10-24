/**
 * Integration tests for the content list and detail: whose activities are listed, what a person may do with one,
 * and the activity's own language for the title's `lang`.
 *
 * Spec: PROD-003, H5P-006, PROD-004, DATA-002, UD-010
 */
import { contentDetailSchema, contentListSchema } from '@hvl-interaktiv/api-contract';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { describeWithServices } from '../../support/services.js';

describeWithServices('[PROD-003] content list and detail', () => {
  const tb = openApiTestbed();
  let owner: TestPrincipal;
  let coAuthor: TestPrincipal;
  let colleague: TestPrincipal;
  let own: string;
  let shared: string;
  let foreignPublished: string;
  let foreignDraft: string;

  beforeAll(async () => {
    owner = await tb.principal('author');
    coAuthor = await tb.principal('author');
    colleague = await tb.principal('author');
    await tb.db.user.update({
      where: { id: owner.principal.userId },
      data: { displayName: 'Aud Forfattar', email: 'aud@hvl.no' },
    });
    own = await tb.content(owner.principal.userId, { title: 'Mi', coAuthors: [coAuthor.principal.userId] });
    shared = await tb.content(colleague.principal.userId, {
      title: 'Delt',
      coAuthors: [owner.principal.userId],
    });
    foreignPublished = await tb.content(colleague.principal.userId, {
      title: 'Open',
      status: 'published',
      visibility: 'organisation',
    });
    foreignDraft = await tb.content(colleague.principal.userId, { title: 'Utkast' });
    // WHY: the list is ordered by the newest change, so the owner's own activity is changed last.
    await tb.db.h5PContent.update({ where: { id: own }, data: { updatedAt: new Date(Date.now() + 1000) } });
  });
  afterAll(() => tb.close());

  const detail = (id: string, who: TestPrincipal) =>
    request(tb.app)
      .get(`/api/content/${id}`)
      .set(...who.header);

  it('[PROD-003] the list shows only own and co-authored activities, newest change first, with the role', async () => {
    // Act
    const res = await request(tb.app)
      .get('/api/content')
      .set(...owner.header);
    // Assert
    expect(res.status).toBe(200);
    const { items } = contentListSchema.parse(res.body);
    expect(items.map((i) => [i.id, i.role])).toEqual([
      [own, 'owner'],
      [shared, 'coAuthor'],
    ]);
    expect(items[0]).toMatchObject({
      title: 'Mi',
      status: 'draft',
      visibility: 'private',
      publishedAt: null,
    });
    expect(items.map((i) => i.id)).not.toContain(foreignPublished);
  });

  it('[PROD-003] learners get an empty list, and nobody signed in gets 401', async () => {
    // Arrange
    const learner = await tb.principal('learner', { userId: owner.principal.userId });
    // Act
    const res = await request(tb.app)
      .get('/api/content')
      .set(...learner.header);
    // Assert
    expect(res.body).toEqual({ items: [] });
    expect((await request(tb.app).get('/api/content')).status).toBe(401);
  });

  it('[H5P-006] the detail says what the person may do, from the same matrix as the H5P routes', async () => {
    // Arrange
    const admin = await tb.principal('admin');
    // Act
    const asOwner = contentDetailSchema.parse((await detail(own, owner)).body);
    const asCoAuthor = contentDetailSchema.parse((await detail(own, coAuthor)).body);
    const asViewer = contentDetailSchema.parse((await detail(foreignPublished, owner)).body);
    const asAdmin = contentDetailSchema.parse((await detail(own, admin)).body);
    // Assert
    expect(asOwner).toMatchObject({ id: own, role: 'owner', mayEdit: true, mayPublish: true });
    expect(asCoAuthor).toMatchObject({ role: 'coAuthor', mayEdit: true, mayPublish: true });
    expect(asViewer).toMatchObject({ role: null, mayEdit: false, mayPublish: false, status: 'published' });
    expect(asAdmin).toMatchObject({ role: null, mayEdit: true, mayPublish: true });
  });

  it('[PROD-004] someone else’s draft and an unknown ID give the same 404', async () => {
    // Act
    const draft = await detail(foreignDraft, owner);
    const unknown = await detail(crypto.randomUUID(), owner);
    const malformed = await detail('not-a-uuid', owner);
    // Assert
    for (const res of [draft, unknown, malformed]) {
      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('hvl:activity-unavailable');
    }
  });

  it('[DATA-002] no answer names the owner or holds their ID', async () => {
    // Act
    const list = await request(tb.app)
      .get('/api/content')
      .set(...coAuthor.header);
    const one = await detail(own, coAuthor);
    // Assert
    for (const res of [list, one]) {
      expect(res.text).not.toMatch(new RegExp(`Aud|aud@hvl.no|${owner.principal.userId}`));
    }
  });

  it('[UD-010] the list and the detail carry the language an activity states, and none when it states none', async () => {
    // Arrange
    const metadata = { title: 'Delt', mainLibrary: 'H5P.MultiChoice', defaultLanguage: 'nn', language: 'en' };
    await tb.db.h5PContent.update({ where: { id: shared }, data: { metadata } });
    // Act
    const list = await request(tb.app)
      .get('/api/content')
      .set(...owner.header);
    const { items } = contentListSchema.parse(list.body);
    const one = contentDetailSchema.parse((await detail(shared, owner)).body);
    // Assert
    expect(items.find((i) => i.id === shared)?.language).toBe('nn');
    expect(items.find((i) => i.id === own)).not.toHaveProperty('language');
    expect(one.language).toBe('nn');
    expect(list.text).not.toContain('preloadedDependencies');
  });
});
