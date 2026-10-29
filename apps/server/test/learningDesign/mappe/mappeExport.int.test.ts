/**
 * Integration tests for the pedagogisk mappe export through the routes (D-094): the picker lists the author's own and
 * co-authored activities and never a stranger's; an export filtered like the page filters (by course, phase and date)
 * holds exactly the chosen activities with their phase, course, outcomes, rationale, validator result and the reasons
 * given; switching the criteria set changes the criterion texts and the reader's guide; each language has its template.
 *
 * Spec: MAPPE-001, MAPPE-002, UD-022
 */
import type { MappeActivity } from '@hvl-interaktiv/api-contract';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { FIXTURE_SETS, studioContentWithMappe } from '../../support/mappeFixture.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';
import { storeMetadata } from '../metadata/metadataFixtures.js';

describeWithServices('[MAPPE-001] exporting a pedagogisk mappe', () => {
  const tb = openApiTestbed({ studioContent: studioContentWithMappe() });
  let author: TestPrincipal;
  const ids: Record<string, string> = {};
  const exportMd = (body: object, criteriaSet?: string) =>
    requestAs(tb.app, author, 'post', '/api/mappe/export?format=md').send({
      locale: 'nn',
      ...(criteriaSet ? { criteriaSet } : {}),
      ...body,
    });

  beforeAll(async () => {
    author = await tb.principal('author');
    const colleague = await tb.principal('author');
    const me = author.principal.userId;
    ids.own = await tb.content(me, { title: 'Eiga blodtrykksvideo', status: 'published' });
    ids.coAuthored = await tb.content(colleague.principal.userId, {
      title: 'Delt casestudie',
      coAuthors: [me],
    });
    ids.otherCourse = await tb.content(me, { title: 'Anna emne' });
    ids.stranger = await tb.content(colleague.principal.userId, {
      title: 'Kollegaen sin quiz',
      status: 'published',
      visibility: 'organisation',
    });
    await storeMetadata(tb.db, ids.own, {
      courseCode: 'SYK110',
      phase: 'forarbeid',
      outcomes: [{ text: 'Forklare blodtrykk', category: 'kunnskap' }],
      rationale: 'Studentane ser videoen før samlinga.',
    });
    await storeMetadata(tb.db, ids.coAuthored, { courseCode: 'SYK110', phase: 'etterarbeid' });
    await storeMetadata(tb.db, ids.otherCourse, { courseCode: 'PED3001', phase: 'forarbeid' });
    await tb.db.validationAcknowledgement.create({
      data: {
        contentId: ids.own,
        ruleId: 'V-IMG-ALT',
        path: 'image',
        reason: 'Biletet er pynt.',
        userId: me,
      },
    });
    // WHY: the validator stand-in reports one universal design error and one pedagogical hint on every activity.
    tb.validator = () => [
      {
        ruleId: 'V-IMG-ALT',
        severity: 'error',
        requirement: 'UD-021',
        path: 'image',
        message: 'Biletet manglar alternativ tekst.',
      },
      {
        ruleId: 'PED-H05',
        severity: 'hint',
        requirement: 'PED-020',
        path: '',
        message: 'Eit pedagogisk tips.',
      },
    ];
  });
  afterAll(() => tb.close());

  it('[MAPPE-001] the picker lists own and co-authored activities, never a stranger’s, with course, phase and date', async () => {
    // Act
    const res = await requestAs(tb.app, author, 'get', '/api/mappe/activities');
    // Assert
    const items = res.body.items as MappeActivity[];
    expect(items.map((item) => item.title).sort()).toEqual([
      'Anna emne',
      'Delt casestudie',
      'Eiga blodtrykksvideo',
    ]);
    expect(items.find((item) => item.contentId === ids.own)).toMatchObject({
      courseCode: 'SYK110',
      phase: 'forarbeid',
    });
    expect(items.every((item) => !Number.isNaN(Date.parse(item.updatedAt)))).toBe(true);
  });

  it('[MAPPE-001] exports the activities chosen by course and phase as the page filters them, and nothing else', async () => {
    // Arrange: what the page's filter (course SYK110, any phase, changed today) leaves to choose
    const listed = (await requestAs(tb.app, author, 'get', '/api/mappe/activities')).body
      .items as MappeActivity[];
    const today = new Date().toISOString().slice(0, 10);
    const chosen = listed.filter((item) => item.courseCode === 'SYK110' && item.updatedAt.startsWith(today));
    // Act
    const res = await exportMd({ contentIds: chosen.map((item) => item.contentId) });
    // Assert
    expect(res.status).toBe(200);
    expect(res.text).toContain('### Eiga blodtrykksvideo');
    expect(res.text).toContain('### Delt casestudie');
    expect(res.text).not.toContain('Anna emne');
    expect(res.text).not.toContain('Kollegaen sin quiz');
    expect(res.text).toContain('Samarbeid: 1 av 2 aktivitetar.');
    // WHY: the phase labels are ALU's (phases.yaml), so the test reads them from the loaded content (PED-001).
    const label = (key: string) =>
      tb.studio.content.phases.phases.find((phase) => phase.key === key)?.label.nn;
    expect(res.text).toContain(
      `- **SYK110:** 2 aktivitetar (${label('forarbeid')}: 1, ${label('etterarbeid')}: 1)`,
    );
  });

  it('[MAPPE-001] shows each activity’s phase, course, outcomes, rationale, link and the validator’s result with the reason', async () => {
    // Act
    const res = await exportMd({ contentIds: [ids.own] });
    // Assert
    expect(res.text).toContain('- **Emne:** SYK110');
    expect(res.text).toContain('- **Læringsutbytte:** Forklare blodtrykk (kunnskap)');
    expect(res.text).toContain('- **Didaktisk grunngjeving:** Studentane ser videoen før samlinga.');
    expect(res.text).toContain(`/aktivitet/${ids.own}`);
    expect(res.text).toContain('Sjekken for universell utforming: feil: 1 (grunngjevne: 1), åtvaringar: 0.');
    expect(res.text).toMatch(
      /- Feil: Biletet manglar alternativ tekst\. \(grunngjeve .+: «Biletet er pynt\.»\)/,
    );
    expect(res.text).not.toContain('Eit pedagogisk tips.');
  });

  it('[MAPPE-001] refuses a stranger’s activity like an unknown one, even next to the author’s own', async () => {
    // Act
    const res = await exportMd({ contentIds: [ids.own, ids.stranger] });
    // Assert
    expect([res.status, res.body.errorCode]).toEqual([404, 'hvl:activity-unavailable']);
  });

  it('[MAPPE-002] switching the criteria set changes the criterion texts, the reader’s guide and the limits', async () => {
    // Act
    const first = await exportMd({ contentIds: [ids.own] }, FIXTURE_SETS.default);
    const second = await exportMd({ contentIds: [ids.own] }, FIXTURE_SETS.other);
    const preview = await requestAs(tb.app, author, 'post', '/api/mappe/preview').send({
      contentIds: [ids.own],
      criteriaSet: FIXTURE_SETS.other,
      locale: 'nn',
    });
    // Assert
    expect(first.text).toContain('Kriterietekst ein-ein frå testsettet 2025');
    expect(first.text).not.toContain('Kriterietekst A-ein frå testsettet 2027');
    expect(second.text).toContain('Kriterietekst A-ein frå testsettet 2027');
    expect(second.text).not.toContain('Kriterietekst ein-ein frå testsettet 2025');
    expect(preview.body).toMatchObject({
      criteriaSet: FIXTURE_SETS.other,
      wordLimit: 100,
      attachments: 3,
      attachmentLimit: 2,
    });
    expect(preview.body.overLimit).toBe(true);
  });

  it('[MAPPE-002] each language exports its own template and texts', async () => {
    // Act
    const en = await exportMd({ contentIds: [ids.own], locale: 'en' });
    const nb = await exportMd({ contentIds: [ids.own], locale: 'nb' });
    // Assert
    expect(en.text).toMatch(/^# Teaching portfolio\n/);
    expect(en.text).toContain('Criterion text one-one from the 2025 test set');
    expect(en.text).toContain('- **Learning outcomes:** Forklare blodtrykk (knowledge)');
    expect(nb.text).toContain('## Leserveiledning');
    expect(nb.text).toContain('Kriterietekst en-en fra testsettet 2025');
  });
});
