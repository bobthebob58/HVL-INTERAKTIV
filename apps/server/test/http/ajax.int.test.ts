/**
 * Integration tests for the editor's AJAX endpoint: exactly ten creatable types, learners refused, no Hub
 * install, no DragQuestion in library data, and translated refusals.
 *
 * Spec: H5P-002, PROD-002, H5P-004, H5P-006, H5P-008, H5P-011, SEC-003
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { HVL_TOP10_CONTENT_TYPES } from '../../src/h5p/HvlTop10ContentTypeFilter.js';
import { t } from '../../src/i18n/translate.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('H5P editor AJAX endpoint', () => {
  let tb: HttpTestbed;
  let author: TestActor;
  let admin: TestActor;
  let learner: TestActor;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    author = await tb.actor('author');
    admin = await tb.actor('admin');
    learner = await tb.actor('learner');
  }, 60_000);
  afterAll(() => tb.close());

  it('[H5P-002][PROD-002] lists exactly the ten types as creatable, none installable', async () => {
    for (const who of [author, admin]) {
      const res = await request(tb.app)
        .get('/h5p/ajax?action=content-type-cache')
        .set(...who.header);
      expect(res.status).toBe(200);
      const libraries = (res.body as { libraries: { machineName: string; canInstall: boolean }[] }).libraries;
      expect(libraries.map((l) => l.machineName).sort()).toEqual([...HVL_TOP10_CONTENT_TYPES].sort());
      expect(libraries.some((l) => l.canInstall)).toBe(false);
    }
  });

  it('[H5P-006] a learner gets 403 on the editor endpoint, GET and POST', async () => {
    // Act
    const get = await request(tb.app)
      .get('/h5p/ajax?action=content-type-cache')
      .set(...learner.header);
    const post = await request(tb.app)
      .post('/h5p/ajax?action=libraries')
      .set(...learner.header);
    // Assert: both are refused with the translated message.
    for (const res of [get, post]) {
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        errorCode: 'error.forbidden',
        message: t('error.forbidden', {}, 'nn'),
      });
    }
  });

  it('[H5P-002] saving H5P.TrueFalse as main library is refused with 403, in nn and in en', async () => {
    // Arrange
    const english = await tb.actor('author', { locale: 'en' });
    const body = { library: 'H5P.TrueFalse 1.8', params: { params: {}, metadata: { title: 'Sant' } } };
    // Act and assert: a save by an nn author and by an en author.
    for (const [who, locale] of [
      [author, 'nn'],
      [english, 'en'],
    ] as const) {
      const res = await request(tb.app)
        .post('/h5p/content')
        .set(...who.header)
        .send(body);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        errorCode: 'hvl:content-type-not-allowed',
        message: t('h5p.contentTypeNotAllowed', { library: 'H5P.TrueFalse' }, locale),
      });
    }
  });

  it('[H5P-002] library data for a container never offers H5P.DragQuestion', async () => {
    const res = await request(tb.app)
      .get('/h5p/ajax?action=libraries&machineName=H5P.QuestionSet&majorVersion=1&minorVersion=21')
      .set(...author.header);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain('H5P.MultiChoice 1.16');
    expect(JSON.stringify(res.body)).not.toContain('H5P.DragQuestion');
  });

  it('[H5P-004] the library overview reads jQuery-style form arrays (libraries[]=…)', async () => {
    const res = await request(tb.app)
      .post('/h5p/ajax?action=libraries')
      .set(...author.header)
      .type('form')
      .send('libraries[]=H5P.MultiChoice 1.16&libraries[]=H5P.QuestionSet 1.21');
    expect(res.status).toBe(200);
    const names = (res.body as { uberName: string }[]).map((l) => l.uberName).sort();
    expect(names).toEqual(['H5P.MultiChoice 1.16', 'H5P.QuestionSet 1.21']);
  });

  it('[H5P-008] library strings come in the requested language, nn falls back to nb, and an unknown code to the actor’s', async () => {
    // Arrange: fetch one library's strings in a given language.
    const strings = async (language: string) => {
      const res = await request(tb.app)
        .post(`/h5p/ajax?action=translations&language=${encodeURIComponent(language)}`)
        .set(...author.header)
        .type('form')
        .send('libraries[]=H5P.MultiChoice 1.16');
      expect(res.status).toBe(200);
      return JSON.stringify(res.body);
    };
    // Act and assert: en as asked, nn through nb, and a bogus code through the actor's language.
    expect(await strings('en')).toContain('Question (en)');
    expect(await strings('nn')).toContain('Spørsmål (nb)');
    const bogus = await strings('../../etc');
    expect(bogus).toContain('Spørsmål (nb)');
    expect(bogus).not.toContain('Question (en)');
  });

  it('[H5P-011] Content Hub metadata is answered empty instead of being fetched from the Hub', async () => {
    const res = await request(tb.app)
      .get('/h5p/ajax?action=content-hub-metadata-cache&language=nn')
      .set(...author.header);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { disciplines: [], languages: [], levels: [], licenses: [] },
    });
  });

  it('[SEC-003][H5P-011] installing from the H5P Hub is refused for everyone, also admins', async () => {
    for (const who of [author, admin]) {
      const res = await request(tb.app)
        .post('/h5p/ajax?action=library-install&id=H5P.TrueFalse')
        .set(...who.header);
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ errorCode: 'hvl:hub-install-disabled' });
    }
  });
});
