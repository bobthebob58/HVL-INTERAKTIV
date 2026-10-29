/**
 * Integration tests for what learners see of an activity's learning design in the portal (D-087): the activity
 * summary and detail carry the estimated minutes, the purpose and the language, only after the View check, and
 * never the rationale, the course code, the outcomes or the pattern.
 *
 * Spec: PED-032, PED-030
 */
import { contentDetailSchema, contentListSchema } from '@hvl-interaktiv/api-contract';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { storeMetadata } from './metadataFixtures.js';

const PURPOSE = 'Du øver på blodtrykk før samlinga.';
const AUTHORS_OWN = {
  rationale: 'Grunngjeving berre for forfattaren',
  courseCode: 'SYK110',
  outcomes: [{ text: 'Forklare blodtrykksregulering', category: 'kunnskap' as const }],
  patternId: 'ea-retrieval',
};

describeWithServices('[PED-032] the estimated time and purpose in the activity summary', () => {
  const tb = openApiTestbed();
  let owner: TestPrincipal;
  let learner: TestPrincipal;
  let published: string;
  let draft: string;

  beforeAll(async () => {
    owner = await tb.principal('author');
    learner = await tb.principal('learner');
    published = await tb.content(owner.principal.userId, { status: 'published', visibility: 'organisation' });
    draft = await tb.content(owner.principal.userId);
    const metadata = { title: 'Quiz', mainLibrary: 'H5P.MultiChoice', defaultLanguage: 'en' };
    await tb.db.h5PContent.update({ where: { id: published }, data: { metadata } });
    for (const id of [published, draft]) {
      await storeMetadata(tb.db, id, {
        ...AUTHORS_OWN,
        estimatedStudentMinutes: 15,
        learnerPurpose: PURPOSE,
      });
    }
  });
  afterAll(() => tb.close());

  it('[PED-032] a learner who may view the activity gets the minutes, the purpose and its language', async () => {
    // Act
    const res = await requestAs(tb.app, learner, 'get', `/api/content/${published}`);
    // Assert
    expect(res.status).toBe(200);
    expect(contentDetailSchema.parse(res.body)).toMatchObject({
      estimatedStudentMinutes: 15,
      learnerPurpose: PURPOSE,
      language: 'en',
      mayEdit: false,
    });
  });

  it('[PED-030] learners never get the rationale, the course code, the outcomes or the pattern', async () => {
    // Act
    const res = await requestAs(tb.app, learner, 'get', `/api/content/${published}`);
    // Assert
    for (const authorsOwn of [
      AUTHORS_OWN.rationale,
      AUTHORS_OWN.courseCode,
      AUTHORS_OWN.patternId,
      'blodtrykksregulering',
    ]) {
      expect(res.text).not.toContain(authorsOwn);
    }
  });

  it('[PED-032] an activity the person may not view gives the one 404 and nothing of its learning design', async () => {
    // Act
    const res = await requestAs(tb.app, learner, 'get', `/api/content/${draft}`);
    // Assert
    expect([res.status, res.body.errorCode]).toEqual([404, 'hvl:activity-unavailable']);
    expect(res.text).not.toContain(PURPOSE);
  });

  it('[PED-032] the author’s list carries them too, and leaves them out where none are set', async () => {
    // Arrange
    const untagged = await tb.content(owner.principal.userId);
    // Act
    const { items } = contentListSchema.parse((await requestAs(tb.app, owner, 'get', '/api/content')).body);
    // Assert
    expect(items.find((item) => item.id === draft)).toMatchObject({
      estimatedStudentMinutes: 15,
      learnerPurpose: PURPOSE,
    });
    const bare = items.find((item) => item.id === untagged);
    expect(bare).not.toHaveProperty('estimatedStudentMinutes');
    expect(bare).not.toHaveProperty('learnerPurpose');
  });

  it('[PED-032] a stored value outside the limits is left out rather than shown', async () => {
    // Arrange
    const odd = await tb.content(owner.principal.userId, { status: 'published', visibility: 'organisation' });
    await storeMetadata(tb.db, odd, { estimatedStudentMinutes: 900, learnerPurpose: 'Linje ein\nLinje to' });
    // WHY: a row stored before the W3 rule may hold a tab; the contract now refuses one, and Canvas a launch with one.
    const tabbed = await tb.content(owner.principal.userId, {
      status: 'published',
      visibility: 'organisation',
    });
    await storeMetadata(tb.db, tabbed, { estimatedStudentMinutes: 10, learnerPurpose: 'Ein\tTo' });
    // Act
    const res = await requestAs(tb.app, learner, 'get', `/api/content/${odd}`);
    const withTab = await requestAs(tb.app, learner, 'get', `/api/content/${tabbed}`);
    // Assert
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('estimatedStudentMinutes');
    expect(res.body).not.toHaveProperty('learnerPurpose');
    expect(withTab.status).toBe(200);
    expect(withTab.body).toMatchObject({ estimatedStudentMinutes: 10 });
    expect(withTab.body).not.toHaveProperty('learnerPurpose');
  });
});
