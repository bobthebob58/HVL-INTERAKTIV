/**
 * End-to-end test of the content bank in Chromium (PROD-007, D-091, D-092): author A lists a published activity in
 * the bank from its **Deling** tab, after ticking the consent; author B, a second HVL staff author signed in through
 * the mock Feide, finds it on `/laeringsdesign/innhaldsbank`, makes a copy and lands on the copy's **Rediger** tab,
 * whose page says «Kopi av «…» av …». The database then holds a private draft of B's with the source and its author,
 * the source's phase and outcomes, and neither A's rationale nor A's course code. The whole server with the built web
 * app and the real content types (../test/support/realWebApp.ts); a failed step names itself and what failed before
 * it (../test/support/flowRecorder.ts, ../test/support/lostTestRows.ts).
 *
 * Spec: PROD-007, AUTH-001
 */
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { asAccountUser } from '../src/h5p/HvlH5pUser.js';
import { recordFlow } from '../test/support/flowRecorder.js';
import { lostRowsFact } from '../test/support/lostTestRows.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { REAL_PACKAGES_DIR } from '../test/support/realPackages.js';
import { testActor } from '../test/support/testActors.js';
import { signInColleague, type Colleague } from './support/runColleague.js';
import { webText } from '../test/support/webAppTexts.js';

/** Author A's learning design of the source: the bank copies the first three, never the last two (D-092). */
const DESIGN = {
  phase: 'etterarbeid',
  minutes: 10,
  outcome: 'Kan forklare skilnaden på ein celle og eit vev.',
  rationale: 'Grunngjevinga til forfattar A, som berre A ser.',
  courseCode: 'E2E101',
} as const;

describeWithRealWebApp('[PROD-007] the content bank: a colleague copies a listed activity', () => {
  let browser: Browser;
  let app: RealWebApp;
  let colleague: Colleague;
  let sourceId: string;
  let title: string;
  beforeAll(async () => {
    browser = await chromium.launch();
    app = await openRealWebApp(browser);
    // Arrange: A's published activity (shared with HVL) has A's learning design
    // WHY: the bank lists every staff author's listings on the shared database (other runs' too), so the source
    // is a fresh import of the real MultiChoice with a title of this run, published and shared with HVL.
    title = `Celler og vev ${randomBytes(4).toString('hex')}`;
    const author = asAccountUser(testActor('author', { accountId: app.authorId }));
    const imported = await app.tb.runtime.editor.packageImporter.addPackageLibrariesAndContent(
      join(REAL_PACKAGES_DIR, 'H5P.MultiChoice.h5p'),
      author,
    );
    sourceId = String(imported.id);
    const row = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: sourceId } });
    await app.tb.db.h5PContent.update({
      where: { id: sourceId },
      data: {
        title,
        metadata: { ...(row.metadata as object), title },
        status: 'published',
        visibility: 'organisation',
      },
    });
    await app.tb.db.learningDesignMetadata.create({
      data: {
        contentId: sourceId,
        phase: DESIGN.phase,
        courseCode: DESIGN.courseCode,
        rationale: DESIGN.rationale,
        estimatedStudentMinutes: DESIGN.minutes,
        outcomes: { create: [{ text: DESIGN.outcome, category: 'kunnskap', position: 0 }] },
      },
    });
    colleague = await signInColleague(browser, app.tb);
  }, 240_000);
  afterAll(async () => {
    await app?.close();
    await browser?.close();
  });

  it('[PROD-007] A lists it with consent; B copies it from the bank and lands on the copy’s Rediger tab with «Kopi av …»', async () => {
    // Arrange: A and B each in a browser of their own; a failed step reports what each page saw
    const authorContext = await browser.newContext({ storageState: app.authorStorage });
    const colleagueContext = await browser.newContext({ storageState: colleague.storage });
    const authorPage = await authorContext.newPage();
    const colleaguePage = await colleagueContext.newPage();
    const authorFlow = await recordFlow(authorPage, app.base);
    const flow = await recordFlow(colleaguePage, app.base);
    const authorName = (await app.tb.db.user.findUniqueOrThrow({ where: { id: app.authorId } })).displayName;
    const facts = async () => ({
      author: { failed: authorFlow.failed, problems: authorFlow.problems },
      ...(await lostRowsFact(app.tb.db, {
        users: { 'author A': app.authorId, 'author B': colleague.userId },
        contents: { 'the source': sourceId },
      })),
    });
    const seen = await flow.run(async () => {
      // Act: A ticks the consent and lists the activity on its Deling tab
      flow.step = 'list in the bank';
      await authorPage.goto(`${app.base}/aktivitet/${sourceId}?fane=sharing`);
      await authorPage.getByRole('checkbox', { name: webText('sharing.bankConsentCheckbox') }).check();
      await authorPage.getByRole('button', { name: webText('sharing.bankList'), exact: true }).click();
      await authorPage.getByText(webText('sharing.bankListedNow'), { exact: true }).waitFor();
      // Act: B finds the entry in the bank and copies it
      flow.step = 'find in the bank';
      await colleaguePage.goto(`${app.base}/laeringsdesign/innhaldsbank`);
      const entry = colleaguePage.getByRole('article', { name: title });
      await entry.waitFor({ timeout: 30_000 });
      const entryText = await entry.textContent();
      flow.step = 'copy';
      await entry.getByRole('button', { name: webText('sharing.duplicateOf', { title }) }).click();
      await colleaguePage.waitForURL(/\/aktivitet\/[0-9a-f-]{36}\?fane=edit$/, { timeout: 60_000 });
      const copyId = new URL(colleaguePage.url()).pathname.split('/').pop() ?? '';
      // Act: the copy's page, on Rediger, says what it is a copy of
      flow.step = 'the copy';
      const attribution = webText('sharing.attribution', { title, author: authorName ?? '' });
      await colleaguePage.getByText(attribution, { exact: false }).waitFor({ timeout: 30_000 });
      const editTab = colleaguePage.getByRole('tab', { name: webText('activity.tabEdit') });
      return { entryText, copyId, editSelected: await editTab.getAttribute('aria-selected') };
    }, facts);
    const source = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: sourceId } });
    const copy = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: seen.copyId } });
    const design = await app.tb.db.learningDesignMetadata.findUniqueOrThrow({
      where: { contentId: seen.copyId },
      include: { outcomes: true },
    });
    // Assert: listed by A, shown to B with A's name
    expect(source.bankListedAt).not.toBeNull();
    expect(seen.entryText).toContain(authorName);
    // Assert: B's private draft of the source, opened on Rediger
    expect(seen.editSelected).toBe('true');
    expect(copy).toMatchObject({
      ownerUserId: colleague.userId,
      status: 'draft',
      visibility: 'private',
      bankListedAt: null,
      sourceContentId: sourceId,
      sourceAuthorUserId: app.authorId,
      mainLibrary: source.mainLibrary,
    });
    // Assert: the learning design came along without A's rationale and course code (bank copy, D-092)
    expect(design).toMatchObject({
      phase: DESIGN.phase,
      estimatedStudentMinutes: DESIGN.minutes,
      rationale: null,
      courseCode: null,
    });
    expect(design.outcomes.map((o) => o.text)).toEqual([DESIGN.outcome]);
    expect([...authorFlow.problems, ...flow.problems]).toEqual([]);
    await authorContext.close();
    await colleagueContext.close();
  }, 180_000);
});
