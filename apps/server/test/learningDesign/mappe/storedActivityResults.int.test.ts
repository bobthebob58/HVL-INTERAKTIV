/**
 * Integration tests for the pedagogisk mappe's real results source on PostgreSQL (D-095): the hand-worked figures of
 * the stored-results fixture through the real query, a 4-learner activity suppressed, the groups below *k* left out,
 * a second version's figures not giving away the first's hidden completers, the export through the route with the
 * source the app builds, nothing written, and only the author's own and co-authored activities.
 *
 * Spec: MAPPE-003, MAPPE-002, INS-006
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { t } from '../../../src/i18n/translate.js';
import { activityAggregates } from '../../../src/learningDesign/mappe/activityResults.js';
import { StoredActivityResults } from '../../../src/learningDesign/mappe/storedActivityResults.js';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { studioContentWithMappe } from '../../support/mappeFixture.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { readOnlyDatabase } from './readOnlyDatabase.js';
import {
  fixtureLearnerKey,
  largeActivityRows,
  smallActivityRows,
  splitActivityRows,
  storeRows,
} from './storedResultsFixture.js';

const k5 = minimumGroupSize(5);

describeWithServices('[MAPPE-003] the mappe’s results from the stored learning data', () => {
  const tb = openApiTestbed({ studioContent: studioContentWithMappe() });
  const run = randomUUID().slice(0, 8);
  const platform = randomUUID();
  const courses = { a: `${platform}:A`, b: `${platform}:B`, c: `${platform}:C` };
  let author: TestPrincipal;
  let large: string;
  let small: string;
  let split: string;
  let foreign: string;
  const exportMd = (contentIds: string[]) =>
    requestAs(tb.app, author, 'post', '/api/mappe/export?format=md').send({ contentIds, locale: 'nn' });

  beforeAll(async () => {
    author = await tb.principal('author');
    const colleague = await tb.principal('author');
    large = await tb.content(colleague.principal.userId, {
      title: 'Stor gruppe',
      coAuthors: [author.principal.userId],
    });
    small = await tb.content(author.principal.userId, { title: 'Liten gruppe' });
    split = await tb.content(author.principal.userId, { title: 'To versjonar' });
    foreign = await tb.content(colleague.principal.userId, { title: 'Ein annan sin' });
    await storeRows(tb.db, run, large, largeActivityRows(courses));
    await storeRows(tb.db, run, small, smallActivityRows(courses.a));
    await storeRows(tb.db, run, split, splitActivityRows(courses.a));
    await storeRows(tb.db, run, foreign, largeActivityRows(courses));
  });
  afterAll(() => tb.close());

  it('[MAPPE-003] gives the hand-worked figures of the groups of at least k, and leaves out every smaller group', async () => {
    // Act
    const summaries = await new StoredActivityResults(tb.db).learnerSummaries([small, large], k5);
    const aggregates = activityAggregates(k5, summaries.get(large));
    // Assert
    expect([...summaries.keys()]).toEqual([large]);
    expect(aggregates).toMatchObject({ participants: 17, completionRate: 11 / 17, medianAttempts: 2 });
    expect(aggregates.changePoints).toBeCloseTo(32, 9);
  });

  it('[MAPPE-003] hides the rate and the median when the total less insight’s shown version gives a hidden count', async () => {
    // Act
    const summaries = await new StoredActivityResults(tb.db).learnerSummaries([split], k5);
    const res = await exportMd([split]);
    // Assert
    expect(activityAggregates(k5, summaries.get(split))).toEqual({
      recorded: true,
      suppressed: false,
      participants: 27,
    });
    expect(res.text).toContain(
      '27 deltakarar, fullført: ikkje vist, median ikkje vist forsøk, endring frå første til siste forsøk: ikkje vist',
    );
  });

  it('[MAPPE-003] a 4-learner activity shows no figure at all in the export, and a larger one only aggregates', async () => {
    // Act
    const res = await exportMd([small, large]);
    // Assert
    expect(res.status).toBe(200);
    expect(res.text).toContain(t('mappe.results.noteRecorded', { k: '5' }, 'nn'));
    expect(res.text).toContain(
      '**Anonymisert resultat (formativt):** Færre enn 5 deltakarar, så resultata blir ikkje viste.',
    );
    expect(res.text).toMatch(
      /17 deltakarar, fullført: 65\s%, median 2 forsøk, endring frå første til siste forsøk: \+32 prosentpoeng/u,
    );
    expect(res.text).toMatch(/\*\*Tal:\*\* 17; 65\s%; 2; \\\+32 prosentpoeng/u);
    expect(res.text.match(/\d+ deltakarar, fullført/gu)).toEqual(['17 deltakarar, fullført']);
    expect(res.text).not.toContain(`mappe-learner-${run}`);
  });

  it('[MAPPE-003] the source reads the activities it is given only, and the route gives it the author’s own and co-authored ones', async () => {
    // Act
    const asked = await new StoredActivityResults(tb.db).learnerSummaries([large], k5);
    const refused = await exportMd([large, foreign]);
    // Assert
    expect([...asked.keys()]).toEqual([large]);
    expect(asked.get(large)).toHaveLength(17);
    expect([refused.status, refused.body.errorCode]).toEqual([404, 'hvl:activity-unavailable']);
  });

  it('[MAPPE-003] reading the results writes nothing, and no learner key reaches a summary', async () => {
    // Arrange
    const writes: string[] = [];
    const source = new StoredActivityResults(readOnlyDatabase(tb.db, writes));
    // Act
    const summaries = await source.learnerSummaries([small, large, foreign], k5);
    // Assert
    expect(writes).toEqual([]);
    expect(JSON.stringify([...summaries])).not.toContain(fixtureLearnerKey(run, ''));
    for (const learners of summaries.values()) {
      for (const summary of learners) {
        expect(Object.keys(summary).sort()).toEqual([
          'attempts',
          'completed',
          'firstScore',
          'group',
          'lastScore',
        ]);
      }
    }
  });

  it('[MAPPE-003] an activity with no stored statement has no summaries, and asking for none reads nothing', async () => {
    // Arrange
    const writes: string[] = [];
    const empty = await tb.content(author.principal.userId, { title: 'Utan spor' });
    // Act
    const none = await new StoredActivityResults(readOnlyDatabase(tb.db, writes)).learnerSummaries(
      [empty],
      k5,
    );
    const nothingAsked = await new StoredActivityResults(tb.db).learnerSummaries([], k5);
    // Assert
    expect(none.size).toBe(0);
    expect(nothingAsked.size).toBe(0);
    expect(activityAggregates(k5, none.get(empty) ?? [])).toEqual({ recorded: true, suppressed: true });
  });
});
