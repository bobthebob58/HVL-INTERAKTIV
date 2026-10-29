/**
 * axe on the læringsdesign studio (S5) in the states the seed gives it, in the light theme and with forced colours
 * emulated: a pattern page signed out (its sign-in prompt) and signed in (its create form), the planner of a course
 * with gaps, the content bank with entries, `/mappe` with every activity chosen and its word count, an activity's
 * **Læringsdesign** tab (outcomes, purpose, time) and **Deling** tab (a co-author, the bank listing), and a copy's page
 * with its attribution sign. The plain studio routes (the guide with the real guide text, the planner's chooser, the
 * bank and `/mappe`, signed out and in) are scanned by axeWebRoutes.a11y.test.ts through ./support/catalogue.ts. The
 * guide page is also held to axe's best-practice rules `landmark-unique` and `region`: its «Kva dette betyr for
 * aktiviteten din» boxes are regions that need distinct names, and no text may stand outside a landmark. No serious
 * or critical violation besides the recorded H5P upstream problems of the copy's player.
 *
 * Spec: UD-030, PED-002, PED-010, PED-030, PED-031, PROD-001, PROD-007, MAPPE-001
 */
import { AxeBuilder } from '@axe-core/playwright';
import type { Guide } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import { describeA11y } from './support/a11ySuite.js';
import { scanPage, type AxeReport } from './support/axeScan.js';
import { COLOUR_MODES, STUDIO_VIEW_NAMES, type StudioView } from './support/catalogue.js';
import { openWebPage } from './support/pages.js';
import { openStudioView } from './support/studioViews.js';
import { expectOnlyRecorded, recordedFor } from './support/upstreamFindings.js';
import { webText } from './support/webLocale.js';

/** The regions named by `aria-labelledby` inside `main`: sections and `role="region"` scroll boxes. */
const NAMED_REGIONS = 'main :is(section, [role=region])[aria-labelledby]';

/** The accessible name of each region, in page order. */
const regionNames = (regions: Element[]): string[] =>
  regions.map((region) =>
    (region.getAttribute('aria-labelledby') ?? '')
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
      .join(' '),
  );

describeA11y('[UD-030] axe on the læringsdesign studio', (env) => {
  describe.each(COLOUR_MODES)('%s', (mode, forcedColors) => {
    const forced = forcedColors === 'active';
    /** Opens a studio view, signed in unless said, and scans the page with every frame. */
    const scan = async (view: StudioView | 'bank', signedIn = true): Promise<AxeReport> => {
      const { app, browser } = env();
      const context = await browser.newContext({
        forcedColors,
        ...(signedIn ? { storageState: app.authorStorage } : {}),
      });
      const page =
        view === 'bank'
          ? await openWebPage(context, app.base, '/laeringsdesign/innhaldsbank')
          : await openStudioView(app, context, view, signedIn);
      // WHY: an empty bank would show none of the cards the scan is for.
      if (view === 'bank') expect(await page.locator('main article').count()).toBeGreaterThanOrEqual(2);
      const name = view === 'bank' ? '/laeringsdesign/innhaldsbank (with entries)' : STUDIO_VIEW_NAMES[view];
      const report = await scanPage(page, `${mode}, ${signedIn ? 'signed in' : 'signed out'}: ${name}`);
      await context.close();
      return report;
    };

    it('[UD-030][PED-010] signed out: a pattern page has no serious or critical violation', async () => {
      expectOnlyRecorded(await scan('pattern', false), []);
    });

    it('[UD-030][PED-010][PROD-001] signed in: a pattern page with its create form has no serious or critical violation', async () => {
      expectOnlyRecorded(await scan('pattern'), []);
    });

    it('[UD-030][PED-031] signed in: the planner of a course with gaps has no serious or critical violation', async () => {
      expectOnlyRecorded(await scan('planner'), []);
    });

    it('[UD-030][PROD-007] signed in: the content bank with entries has no serious or critical violation', async () => {
      expectOnlyRecorded(await scan('bank'), []);
    });

    it('[UD-030][MAPPE-001] signed in: /mappe with a word count has no serious or critical violation', async () => {
      expectOnlyRecorded(await scan('mappePreview'), []);
    });

    it('[UD-030][PED-030] signed in: an activity’s Læringsdesign tab has no serious or critical violation', async () => {
      expectOnlyRecorded(await scan('learningDesign'), []);
    });

    it('[UD-030][PROD-007] signed in: an activity’s Deling tab has no serious or critical violation', async () => {
      expectOnlyRecorded(await scan('sharing'), []);
    });

    it('[UD-030][PROD-007] signed in: a copy’s page with its attribution sign has only recorded upstream problems', async () => {
      expectOnlyRecorded(await scan('copy'), recordedFor('player', 'H5P.MultiChoice', { forced }));
    });
  });

  it('[UD-030][PED-002] the guide page: every box is a region of its own name, and all content is in landmarks', async () => {
    // Arrange: the real guide, signed out (the guide is public, D-089), and how many boxes the server's guide has
    const { app, browser } = env();
    const guide = (await (await fetch(`${app.base}/api/studio/guide/nn`)).json()) as Guide;
    const boxCount = guide.nodes.filter((node) => node.type === 'box').length;
    const context = await browser.newContext();
    const page = await openWebPage(context, app.base, '/laeringsdesign');
    // Act
    const results = await new AxeBuilder({ page }).withRules(['landmark-unique', 'region']).analyze();
    const names = await page.locator(NAMED_REGIONS).evaluateAll(regionNames);
    const boxes = names.filter((name) => name.startsWith(webText('studio.boxHeading')));
    console.info(`PED-002 guide regions (${boxes.length} boxes):\n  ${names.join('\n  ')}`);
    // Assert: every box of the guide is a named region (none rendered as plain text), and no two names are alike
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    ).toEqual([]);
    expect(results.passes.map((rule) => rule.id).sort()).toEqual(['landmark-unique', 'region']);
    expect(boxes).toHaveLength(boxCount);
    expect(new Set(names).size).toBe(names.length);
    await context.close();
  });
});
