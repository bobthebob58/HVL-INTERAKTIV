/**
 * End-to-end test of journey J4 (spec 00 §3, «Document practice for the teaching portfolio») in full Chromium: 13
 * Canvas learners of one course and 2 of another answer the author's QuestionSet through the real ingestion route,
 * and the plays are moved to yesterday (the mappe reads what was stored before the latest midnight in Oslo, D-106's
 * amendment). The author tags the activity on its **Læringsdesign** tab with a phase, a learning outcome and a short
 * didactic rationale (PED-030), then chooses it on **Pedagogisk mappe** and downloads the Markdown. The activity's
 * part of the file holds the design (phase, outcome, rationale), its universal design status (MAPPE-002) and the
 * anonymised results of the course of 13 only: the course of 2 is below *k* and is not counted, and a rate of 100 %
 * is hidden (MAPPE-003, D-095); nothing in the file names or keys a learner. The PDF of the same export, its tags and
 * title, and that nothing is stored are ./mappeDownloads.e2e.test.ts. The whole server with the built web app and the
 * real content types (../test/support/realWebApp.ts).
 *
 * Spec: PED-030, MAPPE-001, MAPPE-002, MAPPE-003
 */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { StudioOverview } from '@hvl-interaktiv/api-contract';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { LaunchSpec } from '../../../tools/mock-platform/mockPlatform.mjs';
import { t } from '../src/i18n/translate.js';
import { recordFlow } from '../test/support/flowRecorder.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { moveStatementsToYesterday } from '../test/support/statementsToYesterday.js';
import { launchCookieTestChromium } from '../test/support/thirdPartyCookies.js';
import { webText } from '../test/support/webAppTexts.js';
import { answerAsCohort, type CohortAnswer } from './support/seminarCohort.js';

const OUTCOME = 'Kan forklare kva undervegsvurdering er, og kvifor ho hjelper læringa.';
const RATIONALE =
  'Ein kort quiz før samlinga viser kva studentane alt kan, så samlinga byggjer vidare på det.';
/** Every learner answers the first question right; the third gap as most learners did in J3. */
const ANSWER: CohortAnswer = { option: 0, thirdGap: 'sjølvvurdering' };

describeWithRealWebApp(
  '[PED-030] a teacher documents a design with its results in the pedagogisk mappe (J4)',
  () => {
    let browser: Browser;
    let app: RealWebApp;
    let contentId: string;
    const launchIn = (courseId: string) => (user: NonNullable<LaunchSpec['user']>) => ({
      user,
      course: { id: courseId, label: courseId.slice(0, 12).toUpperCase() },
      resourceLinkId: `e2e-mappe-${courseId}`,
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

    it('[PED-030][MAPPE-002][MAPPE-003] the design, its universal design status and the course of 13 reach the Markdown', async () => {
      // Arrange: two courses' learners, stored through the ingestion route and moved to yesterday
      const big = await answerAsCohort(
        app,
        launchIn(`e2e-mappe-a-${randomUUID()}`),
        contentId,
        Array(13).fill(ANSWER),
      );
      const small = await answerAsCohort(app, launchIn(`e2e-mappe-b-${randomUUID()}`), contentId, [
        ANSWER,
        ANSWER,
      ]);
      await moveStatementsToYesterday(app.tb.db, contentId);
      const learnerKeys = (await app.tb.db.xapiStatement.findMany({ where: { contentId } })).map(
        (row) => row.learnerKey,
      );
      const overview = (await (await fetch(`${app.base}/api/studio`)).json()) as StudioOverview;
      const phase = overview.phases.find((candidate) => candidate.key === 'forarbeid') ?? overview.phases[0];
      const { title } = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: contentId } });
      const context = await browser.newContext({ storageState: app.authorStorage, acceptDownloads: true });
      const page = await context.newPage();
      const flow = await recordFlow(page, app.base);
      const markdown = await flow.run(async () => {
        // Act: tag the activity with a phase, an outcome and a rationale on the Læringsdesign tab
        flow.step = 'learning design';
        await page.goto(`${app.base}/aktivitet/${contentId}`);
        await page.getByRole('tab', { name: webText('learningDesign.tab') }).click();
        await page
          .getByRole('radio', { name: phase?.label.nn ?? '', exact: true })
          .check({ timeout: 30_000 });
        await page.getByRole('button', { name: webText('learningDesign.outcomeAdd') }).click();
        await page
          .getByRole('textbox', { name: webText('learningDesign.outcomeLabel', { number: 1 }) })
          .fill(OUTCOME);
        await page.getByRole('textbox', { name: webText('learningDesign.rationaleLabel') }).fill(RATIONALE);
        await page.getByRole('button', { name: webText('learningDesign.save') }).click();
        await page.getByText(webText('learningDesign.saved'), { exact: true }).waitFor();
        // Act: choose the activity on Pedagogisk mappe and download the Markdown
        flow.step = 'mappe';
        await page.goto(`${app.base}/mappe`);
        await page.locator(`input[type="checkbox"][id$="-${contentId}"]`).check({ timeout: 30_000 });
        const [saved] = await Promise.all([
          page.waitForEvent('download', { timeout: 60_000 }),
          page.getByRole('button', { name: webText('mappe.downloadMarkdown'), exact: true }).click(),
        ]);
        return readFile(await saved.path(), 'utf8');
      });
      // WHY: the activity's own part of the file runs from its heading to the next heading of any level.
      const part = markdown.split(`#### ${title}\n`)[1]?.split(/\n#{1,4} /)[0] ?? '';
      // Assert: every learner was stored
      expect([...big, ...small].every((status) => status === 202)).toBe(true);
      // Assert: the design the teacher tagged (PED-030)
      expect(part).toContain(`**Fase:** ${phase?.label.nn}`);
      expect(part).toContain(`**Læringsutbytte:** ${OUTCOME}`);
      expect(part).toContain(`**Didaktisk grunngjeving:** ${RATIONALE}`);
      // Assert: its universal design status, from the validator (MAPPE-002)
      expect(part).toContain('Sjekken for universell utforming');
      // Assert: the course of 13 is counted and the course of 2 is not; a rate of 100 % and a change from one attempt
      // are hidden (D-095's two-sided rule); no learner is named or keyed (MAPPE-003)
      const hidden = t('mappe.results.hidden', {}, 'nn');
      const results = t(
        'mappe.results.summary',
        { participants: '13', completion: hidden, median: '1', change: hidden },
        'nn',
      );
      expect(part).toContain(`**Anonymiserte resultat (formative):** ${results}`);
      for (const key of new Set(learnerKeys)) expect(markdown).not.toContain(key);
      expect(flow.failed).toEqual([]);
      expect(flow.problems).toEqual([]);
      await context.close();
    }, 300_000);
  },
);
