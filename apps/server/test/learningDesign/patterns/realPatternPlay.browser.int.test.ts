/**
 * Browser integration test that plays every real pattern's created activity once in the player, in Nynorsk: each
 * content type in each phase the pattern allows, created through the route on the real content types (D-084, D-085),
 * opened at `/h5p/play/<id>` by its signed-in author in Chromium. H5P must start an instance, and the page may raise
 * no page error and log no console error, also where a pattern's media is still missing (probe P1: the type shows its
 * own notice instead). The patterns are ALU's drafts, so the test names no pattern and reads none of their texts.
 *
 * Spec: PED-010, PROD-001
 */
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../../support/browser.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { signInRunAuthor, type BrowserStorage } from '../../support/runFeideAuthor.js';
import { describeWithServices } from '../../support/services.js';
import { openRealPatternBench, type PatternCreationBench } from './patternCreationBench.js';
import {
  createRealPatterns,
  creationName,
  realPatternChoices,
  type RealPatternCreation,
} from './realPatterns.js';
import { LATE_ERROR_WINDOW_MS } from './skeletonCreationSettling.js';

/** What one play showed. */
interface Played {
  readonly name: string;
  readonly status: number;
  /** How many H5P instances the page started. */
  readonly instances: number;
  /** Page errors and console errors, in order. */
  readonly problems: readonly string[];
}

/** Opens one activity in the player as the signed-in author and reads whether H5P started it, and what went wrong. */
async function play(
  browser: Browser,
  storage: BrowserStorage,
  base: string,
  creation: RealPatternCreation,
): Promise<Played> {
  const context = await browser.newContext({ storageState: storage });
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page: ${error.message}`));
  page.on('console', (m) => void (m.type() === 'error' && problems.push(`console: ${m.text()}`)));
  const response = await page.goto(`${base}/h5p/play/${creation.contentId}`);
  // WHY: H5P.init marks the container, then builds the activity in the same task (h5p.js). Once the mark shows,
  // the activity's constructor has run to its end or failed, so a crash shows at once, as in probe P3's player.
  await page.waitForSelector('.h5p-content.h5p-initialized', { timeout: 60_000 });
  // WHY: absence: an error the player raises after it started (a timer, a late request) must still be reported.
  await page.waitForTimeout(LATE_ERROR_WINDOW_MS);
  const instances = await page.evaluate(
    () => (window as unknown as { H5P?: { instances?: unknown[] } }).H5P?.instances?.length ?? 0,
  );
  await context.close();
  return { name: creationName(creation), status: response?.status() ?? 0, instances, problems };
}

describeWithServices('playing every real pattern', () => {
  describeWithRealPackages('[PED-010] every pattern’s created activity in the player', () => {
    let bench: PatternCreationBench;
    const created: RealPatternCreation[] = [];
    beforeAll(async () => {
      bench = await openRealPatternBench();
      created.push(
        ...(await createRealPatterns(bench, realPatternChoices(bench.tb.studio.content.patterns), 'nn')),
      );
    }, 300_000);
    afterAll(() => bench?.close(), 60_000);

    describeWithBrowser('[PED-010] in Chromium, in Nynorsk', (browser) => {
      it('[PED-010] each created activity starts an H5P instance with no page or console error', async () => {
        // Arrange: the author signed in through the browser, every creation made
        const storage = await signInRunAuthor(browser(), bench.tb);
        expect(created.filter((c) => c.status !== 201).map(creationName)).toEqual([]);
        // Act
        const played: Played[] = [];
        for (const creation of created)
          played.push(await play(browser(), storage, bench.tb.toolUrl, creation));
        // Assert
        expect(played.length).toBeGreaterThan(0);
        expect(played).toEqual(
          played.map(({ name }) => ({ name, status: 200, instances: expect.any(Number), problems: [] })),
        );
        expect(played.filter((p) => p.instances < 1).map((p) => p.name)).toEqual([]);
      }, 300_000);
    });
  });
});
