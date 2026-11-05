/**
 * End-to-end test of journey J3 (spec 00 §3, «Prepare the seminar from evidence») in full Chromium, on the activity
 * page in the portal: 13 Canvas learners of one course answer the author's QuestionSet (5 pick the right option of
 * the first question, 8 pick option B; 11 write «sjølvvurdering» in the Blanks question's third gap and 2 write
 * «kollegavurdering»). The plays are moved to yesterday, since a view holds the data up to and including yesterday
 * (D-106's amendment of 2026-11-04). The author opens **Innsikt** («Innsikt før samlinga», the default 7 days),
 * chooses the course and sees 13 who started and completed; the first question 38 % right on the first attempt;
 * option B chosen by 8 with the author's own feedback beside it; the word 2 learners wrote never shown and its
 * group as «< 5» (INS-006). The tab writes an option's count, not its share: J3 step 2's «62 % chose option B» (8
 * of 13) is only the bar's length (apps/web/src/features/insight/ChoiceQuestion.tsx), which this test does not
 * read. The author adds the question to «Ta opp i samlinga» and opens the list on the big screen for the seminar.
 * The Canvas path of insight (the course fixed by the launch, other courses and learners refused) is
 * ./insightInCanvas.e2e.test.ts. The whole server with the built web app and the real content types
 * (../test/support/realWebApp.ts).
 *
 * Spec: INS-001, INS-002, INS-003, INS-006, INS-007, PROD-010, DATA-007
 */
import { randomUUID } from 'node:crypto';
import type { Browser, Locator, Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { LaunchSpec } from '../../../tools/mock-platform/mockPlatform.mjs';
import { recordFlow } from '../test/support/flowRecorder.js';
import { lostRowsFact } from '../test/support/lostTestRows.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { moveStatementsToYesterday } from '../test/support/statementsToYesterday.js';
import { launchCookieTestChromium } from '../test/support/thirdPartyCookies.js';
import { webText } from '../test/support/webAppTexts.js';
import { answerAsCohort, questionSetTexts, type CohortAnswer } from './support/seminarCohort.js';

const COURSE_LABEL = 'SEMINAR101';
/** 5 right and 8 on option B; 11 «sjølvvurdering» and 2 «kollegavurdering», spread over the class. */
const CLASS: readonly CohortAnswer[] = Array.from({ length: 13 }, (_, n) => ({
  option: n % 3 === 0 ? 0 : 1,
  thirdGap: n === 4 || n === 9 ? 'kollegavurdering' : 'sjølvvurdering',
}));

/** The value of one participation tile, e.g. «Starta». */
const tile = async (page: Page, name: string): Promise<string> =>
  (await page.locator('dt', { hasText: name }).locator('xpath=following-sibling::dd[1]').textContent()) ?? '';
/** Text with every run of white space (narrow spaces before «%» included) as one plain space. */
const flat = (text: string | null): string => (text ?? '').replace(/\s+/g, ' ').trim();
/** The texts of a table row's cells. */
const cells = async (row: Locator): Promise<string[]> =>
  (await row.locator('th, td').allTextContents()).map(flat);

describeWithRealWebApp('[INS-003] a teacher prepares the seminar from the class’s answers (J3)', () => {
  let browser: Browser;
  let app: RealWebApp;
  let contentId: string;
  const course = { id: `e2e-seminar-${randomUUID()}`, label: COURSE_LABEL, title: 'Samling torsdag' };
  const launchOf = (user: NonNullable<LaunchSpec['user']>) => ({
    user,
    course,
    resourceLinkId: `e2e-seminar-${course.id}`,
    custom: { contentId },
  });
  beforeAll(async () => {
    browser = await launchCookieTestChromium();
    app = await openRealWebApp(browser);
    contentId = app.ids.get('H5P.QuestionSet') ?? '';
  }, 240_000);
  afterAll(async () => {
    await app?.close();
    await browser?.close();
  });

  it('[INS-001][INS-002][INS-003][INS-006] the class’s answers, the misconception with the teacher’s feedback, the shortlist on the big screen', async () => {
    // Arrange: the class's answers, stored through the ingestion route and moved to yesterday
    const texts = await questionSetTexts(app, contentId);
    expect(CLASS.filter((answer) => answer.option === 0)).toHaveLength(5);
    const statuses = await answerAsCohort(app, launchOf, contentId, CLASS);
    await moveStatementsToYesterday(app.tb.db, contentId);
    const context = await browser.newContext({ storageState: app.authorStorage });
    const page = await context.newPage();
    const flow = await recordFlow(page, app.base);
    const facts = async () => ({
      ...(await lostRowsFact(app.tb.db, { contents: { 'the activity': contentId } })),
    });
    const seen = await flow.run(async () => {
      // Act: Wednesday evening, the author opens Innsikt for the activity and chooses the course
      flow.step = 'open insight';
      await page.goto(`${app.base}/aktivitet/${contentId}?fane=insight`);
      await page
        .getByRole('heading', { level: 2, name: webText('insight.heading') })
        .waitFor({ timeout: 30_000 });
      const courseOption = webText('insight.query.contextCourse', { label: COURSE_LABEL });
      const select = page.getByRole('combobox', { name: webText('insight.query.context') });
      await expect.poll(() => select.locator('option', { hasText: courseOption }).count()).toBe(1);
      await select.selectOption({ label: courseOption });
      await page.getByRole('button', { name: webText('insight.query.submit') }).click();
      await expect
        .poll(() => tile(page, webText('insight.participation.started')), { timeout: 30_000 })
        .toBe('13');
      // Act: read participation, the item, the misconception and the third gap
      flow.step = 'read the view';
      const items = page.getByRole('table', { name: webText('insight.items.caption') });
      const question = page.getByRole('region', { name: texts.first, exact: true });
      const options = question.getByRole('table', {
        name: webText('insight.choice.caption', { question: texts.first }),
      });
      const blanks = page.getByRole('region', { name: texts.blanks, exact: true });
      const view = {
        completed: await tile(page, webText('insight.participation.completed')),
        item: await cells(items.locator('tbody tr', { hasText: texts.first })),
        summary: flat(await question.locator('figcaption').textContent()),
        optionB: await cells(options.locator('tbody tr').nth(1)),
        thirdGap: flat(
          await blanks
            .getByRole('table', { name: webText('insight.gaps.caption', { number: 3 }) })
            .textContent(),
        ),
        panel: flat(await page.getByRole('tabpanel').textContent()),
      };
      // Act: add the question to the shortlist and open it on the big screen for Thursday's seminar
      flow.step = 'shortlist';
      await question
        .getByRole('button', { name: `${webText('insight.shortlist.add')} (${texts.first})` })
        .click();
      const listName = `${webText('insight.shortlist.heading')} (${webText('insight.shortlist.count', { count: 1 })})`;
      const shortlist = page.getByRole('region', { name: listName, exact: true });
      await shortlist.getByText(texts.first, { exact: true }).waitFor();
      await shortlist.getByRole('button', { name: webText('insight.shortlist.project') }).click();
      const screen = page.getByRole('dialog');
      await screen.waitFor();
      const projected = flat(await screen.textContent());
      return { view, projected };
    }, facts);
    await flow.settled();
    const audits = await app.tb.db.auditEvent.findMany({
      where: { action: 'insight.view', targetId: contentId },
    });
    // Assert: every learner was stored; 13 started and completed (INS-001)
    expect(statuses.every((status) => status === 202)).toBe(true);
    expect(seen.view.panel).toContain(`Viser ${COURSE_LABEL} i Canvas`);
    expect(seen.view.completed).toBe('13');
    // Assert: the first question, 5 of 13 right on the first and the latest attempt (INS-002)
    expect(seen.view.item.slice(1, 5)).toEqual([texts.first, '13', '38 %', '38 %']);
    // Assert: option B chosen by 8 (a count; no share is written), with the author's own feedback beside it (INS-003)
    expect(seen.view.optionB).toEqual([
      texts.options[1],
      expect.stringContaining('Feil'),
      '8',
      texts.feedback[1],
    ]);
    expect(seen.view.summary).toContain(texts.options[1]);
    // Assert: the word only 2 wrote is never shown, and the rest of the wrong answers stay «< 5» (INS-006)
    expect(seen.view.thirdGap).toContain('sjølvvurdering');
    expect(seen.view.thirdGap).toContain('< 5');
    expect(seen.view.panel).not.toContain('kollegavurdering');
    // Assert: the big screen shows the question, its share and the feedback, and nothing about a learner
    expect(seen.projected).toContain(texts.first);
    expect(seen.projected).toContain('38 %');
    expect(seen.projected).not.toMatch(/learnerKey|kollegavurdering/);
    // Assert: the view is audited with its context and no learner (DATA-007)
    expect(audits.map((event) => (event.details as { context: string }).context)).toContain(
      `${app.tb.platformId}:${course.id}`,
    );
    expect(JSON.stringify(audits)).not.toMatch(/learnerKey|"value"/);
    expect(flow.failed).toEqual([]);
    expect(flow.problems).toEqual([]);
    await context.close();
  }, 300_000);
});
