/**
 * End-to-end test of journey J1's portal part in Chromium (PROD-001, D-085, D-086, PED-030): a signed-in author opens
 * `/laeringsdesign`, filters the catalogue by phase (the address keeps it), opens a pattern, creates an activity from
 * it with the filtered phase and lands on **Rediger**; **Sjekk og publiser** lists only V-PLACEHOLDER errors; «Gå til
 * feltet» puts focus in a placeholder's field, the author writes over it and saves, and one error fewer is left; on
 * **Læringsdesign** the author moves the activity to another phase and adds an outcome (another phase, so the step is
 * seen in the database and is not the creation's own phase again); the rest of the placeholders are acknowledged with
 * a reason, and the activity is published. The database then holds the metadata with the pattern, the phase chosen on
 * the tab, the course code and the outcome.
 * The pattern is chosen by its shape from `GET /api/studio`, never by ALU's texts (D-082, Q17). The whole server with
 * the built web app and the real content types (../test/support/realWebApp.ts).
 *
 * Spec: PROD-001, PED-003, PED-030, UD-022, PROD-003
 */
import type { PatternSummary, StudioOverview } from '@hvl-interaktiv/api-contract';
import { chromium, type Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { recordFlow } from '../test/support/flowRecorder.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { pressEditorSave } from './support/editorSave.js';
import { deepFocus, editorFrames, pathOf } from './support/portalFrames.js';
import { webText, webTextPattern } from './support/webTexts.js';

/** Single-type patterns whose fields «Gå til feltet» reaches, best first (D-093 amendment, W5b). */
const PREFERRED = ['H5P.MultiChoice', 'H5P.QuestionSet', 'H5P.Blanks', 'H5P.DragText'] as const;
const COURSE = 'E2E101';
const WRITTEN = 'Kva skil ein celle frå eit vev?';
const OUTCOME = 'Kan skilje mellom celle og vev.';
const REASON = 'Teksten blir skriven ferdig saman med emneansvarleg før semesterstart.';
const PLACEHOLDER = webText('findings.rule', { ruleId: 'V-PLACEHOLDER' });

/** The pattern the flow uses: available, one content type, the best ranked by {@link PREFERRED}. */
const chooseTarget = (patterns: readonly PatternSummary[]): PatternSummary => {
  const rank = (p: PatternSummary) =>
    p.contentTypes.length === 1 ? PREFERRED.indexOf(p.contentTypes[0] as (typeof PREFERRED)[number]) : -1;
  const target = patterns.filter((p) => p.available && rank(p) >= 0).sort((a, b) => rank(a) - rank(b))[0];
  if (!target) throw new Error('no available single-type pattern of the preferred types in content/');
  return target;
};

describeWithRealWebApp('[PROD-001] from a pattern to a published activity in the portal (J1)', () => {
  let browser: Browser;
  let app: RealWebApp;
  beforeAll(async () => {
    browser = await chromium.launch();
    app = await openRealWebApp(browser);
  }, 240_000);
  afterAll(async () => {
    await app?.close();
    await browser?.close();
  });

  it('[PROD-001][PED-030] filter, open a pattern, create, fill a placeholder, set the learning design, publish with reasons', async () => {
    // Arrange: the pattern by its shape, filtered by its last phase
    const overview = (await (await fetch(`${app.base}/api/studio`)).json()) as StudioOverview;
    const target = chooseTarget(overview.patterns);
    const phase = target.phases.at(-1) ?? 'etterarbeid';
    const phaseLabel = overview.phases.find((p) => p.key === phase)?.label.nn ?? '';
    // WHY: the creation already stores the filtered phase (D-085); the tab must change it to show it works.
    const moved = overview.phases.find((p) => p.key !== phase);
    if (!moved) throw new Error('content/ has fewer than two phases');
    const inPhase = overview.patterns.filter((p) => p.phases.includes(phase)).length;
    const context = await browser.newContext({ storageState: app.authorStorage });
    const page = await context.newPage();
    const flow = await recordFlow(page, app.base);
    const tab = (key: string) => page.getByRole('tab', { name: webText(key) });
    const errorsRegion = page.getByRole('region', { name: webTextPattern('findings.groupError') });
    // WHY: when a step fails, say where focus is and what the editor page last announced.
    const facts = async () => ({
      focus: await deepFocus(page).catch(() => 'unreadable'),
      editorStatus: await page
        .frames()
        .find((frame) => pathOf(frame.url()).startsWith('/h5p/edit/'))
        ?.textContent('#hvl-editor-status', { timeout: 1_000 })
        .catch(() => 'unreadable'),
    });
    const seen = await flow.run(async () => {
      // Act: filter the catalogue by phase and open the pattern
      flow.step = 'catalogue';
      await page.goto(`${app.base}/laeringsdesign`);
      await page.getByRole('combobox', { name: webText('studio.filterPhase') }).selectOption(phase);
      const count = webText('studio.catalogueCount', { shown: inPhase, total: overview.patterns.length });
      await page.getByRole('status').getByText(count, { exact: true }).waitFor();
      // WHY: the catalogue shows the filter at once and writes the address when the router has replaced it.
      const addressPhase = () => new URL(page.url()).searchParams.get('fase');
      await expect.poll(addressPhase, { timeout: 10_000 }).toBe(phase);
      const filteredAddress = new URL(page.url()).search;
      // WHY: the phase matrix links the same pattern; the flow opens it from the filtered catalogue.
      const catalogue = page.getByRole('region', { name: webText('studio.catalogueHeading') });
      await catalogue.getByRole('link', { name: target.name.nn, exact: true }).click();
      await page.getByRole('heading', { level: 1, name: target.name.nn }).waitFor({ timeout: 30_000 });
      // Act: create from it with a course code; the new activity opens on Rediger
      flow.step = 'create';
      const phaseChosen =
        target.phases.length < 2 || (await page.getByRole('radio', { name: phaseLabel }).isChecked());
      await page.getByRole('textbox', { name: webText('patterns.courseCode') }).fill(COURSE);
      await page.getByRole('button', { name: webText('patterns.submit') }).click();
      await page.waitForURL(/\/aktivitet\/[0-9a-f-]{36}\?fane=edit$/, { timeout: 60_000 });
      const contentId = new URL(page.url()).pathname.split('/').pop() ?? '';
      const editSelected = await tab('activity.tabEdit').getAttribute('aria-selected');
      const createdDesign = await app.tb.db.learningDesignMetadata.findUnique({ where: { contentId } });
      // Act: the check lists the placeholders as errors
      flow.step = 'check';
      await tab('activity.tabCheck').click();
      await errorsRegion.waitFor({ timeout: 30_000 });
      const errorsBefore = await errorsRegion.getByRole('listitem').allTextContents();
      // Act: «Gå til feltet» on the first one; write over it and save in the editor
      flow.step = 'fill a placeholder';
      await errorsRegion
        .getByRole('button', { name: webText('findings.goToField') })
        .first()
        .click();
      await expect.poll(() => deepFocus(page), { timeout: 45_000 }).toMatchObject({ typable: true });
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.type(WRITTEN);
      const { editor } = await editorFrames(page, contentId);
      const saved = await pressEditorSave(page, editor, contentId);
      await page.getByRole('status').getByText(webText('activity.saved'), { exact: true }).waitFor();
      await tab('activity.tabCheck').click();
      await expect.poll(() => errorsRegion.getByRole('listitem').count()).toBe(errorsBefore.length - 1);
      // Act: the learning design: another phase and an outcome
      flow.step = 'learning design';
      await tab('learningDesign.tab').click();
      const fromPattern = webText('learningDesign.fromPattern', { pattern: target.name.nn });
      await page.getByText(fromPattern, { exact: true }).waitFor({ timeout: 30_000 });
      const createdChecked = await page.getByRole('radio', { name: phaseLabel, exact: true }).isChecked();
      await page.getByRole('radio', { name: moved.label.nn, exact: true }).check();
      await page.getByRole('button', { name: webText('learningDesign.outcomeAdd') }).click();
      await page
        .getByRole('textbox', { name: webText('learningDesign.outcomeLabel', { number: 1 }) })
        .fill(OUTCOME);
      await page.getByRole('button', { name: webText('learningDesign.save') }).click();
      await page.getByText(webText('learningDesign.saved'), { exact: true }).waitFor();
      // Act: publish, with a reason for each placeholder left
      flow.step = 'publish';
      await tab('activity.tabCheck').click();
      await page.getByRole('button', { name: webText('publish.open'), exact: true }).click();
      const dialog = page.getByRole('dialog', { name: webText('publish.title') });
      // WHY: `all()` does not wait; the reason fields are counted once the dialog is open.
      await dialog.waitFor();
      const reasons = dialog.getByRole('textbox', { name: webTextPattern('publish.reasonLabel') });
      const reasonFields = await reasons.all();
      for (const field of reasonFields) await field.fill(REASON);
      await dialog.getByRole('button', { name: webText('publish.submit') }).click();
      await page.getByRole('status').getByText(webText('publish.published'), { exact: true }).waitFor();
      const reasonCount = reasonFields.length;
      const created = { phase: createdDesign?.phase, checked: createdChecked };
      return {
        filteredAddress,
        phaseChosen,
        contentId,
        editSelected,
        created,
        errorsBefore,
        saved,
        reasonCount,
      };
    }, facts);
    const { contentId, errorsBefore } = seen;
    const row = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: contentId } });
    const design = await app.tb.db.learningDesignMetadata.findUniqueOrThrow({
      where: { contentId },
      include: { outcomes: true },
    });
    const acknowledged = await app.tb.db.validationAcknowledgement.findMany({ where: { contentId } });
    // Assert: the filter is in the address; the form carried the phase; the draft opened on Rediger
    expect(new URLSearchParams(seen.filteredAddress).get('fase')).toBe(phase);
    expect(seen.phaseChosen).toBe(true);
    expect(seen.editSelected).toBe('true');
    expect(seen.created).toEqual({ phase, checked: true });
    // Assert: only placeholders were errors, and writing over one left one fewer
    expect(errorsBefore.length).toBeGreaterThan(0);
    expect(errorsBefore.every((item) => item.includes(PLACEHOLDER))).toBe(true);
    expect(seen.saved.status()).toBe(200);
    expect(`${row.title} ${JSON.stringify(row.params)}`).toContain(WRITTEN);
    // Assert: published with one reason per placeholder left, and the learning design stored with the pattern
    expect(row.status).toBe('published');
    expect(seen.reasonCount).toBe(errorsBefore.length - 1);
    expect(acknowledged.map((a) => [a.ruleId, a.reason])).toEqual(
      Array.from({ length: errorsBefore.length - 1 }, () => ['V-PLACEHOLDER', REASON]),
    );
    expect(design).toMatchObject({ patternId: target.id, phase: moved.key, courseCode: COURSE });
    expect(design.outcomes.map((o) => o.text)).toEqual([OUTCOME]);
    expect(flow.problems).toEqual([]);
    await context.close();
  }, 300_000);
});
