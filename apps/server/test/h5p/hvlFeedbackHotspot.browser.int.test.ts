/**
 * Browser tests of the answer prefix of ImageHotspotQuestion 1.8, which Column offers as sub-content (also
 * Column 1.22, InteractiveBook's page type): the learner's click mark shows the library's ✓/✗ in the tokens'
 * colours with the label beside it, on the side where the image has room, and the label is in the accessibility
 * tree. The activity is filled with the libraries' Nynorsk defaults, as the editor does.
 *
 * Spec: UD-003, UD-012
 */
import { createReadStream } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { asAccountUser } from '../../src/h5p/HvlH5pUser.js';
import { describeWithBrowser } from '../support/browser.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../support/realPackages.js';
import {
  contentTree,
  openRealPlayer,
  openRealTypesServer,
  type RealTypesServer,
} from '../support/realTypesPlayer.js';
import { describeWithServices } from '../support/services.js';

/** The library folders `npm run h5p:fetch-libraries` writes beside the packages. */
const LIBRARIES_DIR = resolve(REAL_PACKAGES_DIR, '..', 'libraries');
const DEFAULTS_MODULE = new URL('../../../../tools/h5p-libraries/semanticDefaults.mjs', import.meta.url);
const IMAGE = new URL('../../../../tools/h5p-libraries/examples/assets/diagram.png', import.meta.url);
const COLUMN = 'H5P.Column 1.22';
const METADATA = { title: 'Finn fasen', license: 'U', defaultLanguage: 'nn' };
/** A 960 × 540 picture of the three phases: the right hotspot in the middle, a wrong one at the right edge. */
const spot = (correct: boolean, feedbackText: string, x: number, width: number) => ({
  userSettings: { correct, feedbackText },
  computedSettings: { x, y: 20, width, height: 40, figure: 'rectangle' },
});
const QUESTION = {
  library: 'H5P.ImageHotspotQuestion 1.8',
  subContentId: 'ihq',
  metadata: { title: 'Finn fasen', license: 'U' },
  params: {
    imageHotspotQuestion: {
      backgroundImageSettings: { path: 'images/diagram.png', mime: 'image/png', width: 960, height: 540 },
      hotspotSettings: {
        taskDescription: '<p>Kva fase har samtale og problemløysing?</p>',
        hotspot: [
          spot(true, 'Ja, under samlinga.', 40, 20),
          spot(false, 'Nei, det er etter samlinga.', 93, 6),
        ],
        noneSelectedFeedback: 'Du traff ingen av fasane.',
      },
    },
  },
};

/** Saves the Column, then its picture into the activity's files, then the parameters that use the picture. */
async function hotspotActivity(server: RealTypesServer): Promise<string> {
  const { libraryDefaults, withDefaults } = (await import(DEFAULTS_MODULE.href)) as {
    libraryDefaults: (dir: string) => object;
    withDefaults: (params: object, defaults: (library: string) => object, library: string) => object;
  };
  const defaults = (name: string) => libraryDefaults(join(LIBRARIES_DIR, name.replace(' ', '-')));
  const params = withDefaults({ content: [{ content: QUESTION }] }, defaults, COLUMN);
  const { tb, author } = server;
  const id = await tb.activity(author, { library: COLUMN, params: { content: [] }, metadata: METADATA });
  const user = asAccountUser(author.actor);
  await tb.runtime.editor.contentStorage.addFile(id, 'images/diagram.png', createReadStream(IMAGE), user);
  await tb.runtime.editor.saveOrUpdateContent(id, params, METADATA as never, COLUMN, user);
  await tb.db.h5PContent.update({ where: { id }, data: { status: 'published', visibility: 'organisation' } });
  return id;
}

/** Whether the label (the picture's ::after) covers the points 10 px right and left of the click mark. */
const labelBeside = (page: Page) =>
  page.evaluate(() => {
    const mark = document.querySelector('.hotspot-feedback')?.getBoundingClientRect();
    if (!mark) return 'no mark';
    const at = (x: number) =>
      document.elementFromPoint(x, mark.top + mark.height / 2)?.matches('.image-wrapper') ?? false;
    return { right: at(mark.right + 10), left: at(mark.left - 10) };
  });
const after = (page: Page) =>
  page.locator('.image-wrapper').evaluate((el) => getComputedStyle(el, '::after').content);

describeWithServices('the answer prefix of ImageHotspotQuestion', () => {
  describeWithRealPackages('[UD-003] ImageHotspotQuestion in a Column', () => {
    let server: RealTypesServer;
    let id = '';
    beforeAll(async () => {
      server = await openRealTypesServer();
      // WHY: none of the ten example packages uses it, so the seed does not install it; a Hub package of Column
      // carries it (D-078). The folder holds the library at its pinned commit.
      const folder = join(LIBRARIES_DIR, 'H5P.ImageHotspotQuestion-1.8');
      await server.tb.runtime.editor.libraryManager.installFromDirectory(folder);
      id = await hotspotActivity(server);
    }, 180_000);
    afterAll(() => server?.close());

    describeWithBrowser('[UD-003] in Chromium', (browser) => {
      it('[UD-003] the right hotspot: ✓ in the tokens, "Riktig:" beside the mark, announced', async () => {
        // Arrange
        const page = await openRealPlayer(browser(), server, id);
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.locator('.hotspot-image').waitFor();
        // Act
        await page.locator('.image-hotspot').nth(0).click();
        await page.locator('.h5p-question-feedback-close').click();
        // Assert: the library's ✓ circle, recoloured; the label on its right; the label read before the feedback
        const colours = await page
          .locator('.hotspot-feedback.correct')
          .evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
        expect(colours).toEqual(['rgb(209, 231, 221)', 'rgb(15, 81, 50)']);
        expect(await after(page)).toBe('"Riktig:" / ""');
        await expect.poll(() => labelBeside(page)).toEqual({ right: true, left: false });
        expect(await contentTree(page)).toContain('Riktig:');
        await page.close();
      }, 60_000);

      it('[UD-003][UD-012] a wrong hotspot at the edge: "Feil:" goes to the side with room, also in forced colours', async () => {
        // Arrange
        const page = await openRealPlayer(browser(), server, id);
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.locator('.hotspot-image').waitFor();
        // Act
        await page.locator('.image-hotspot').nth(1).click();
        // WHY: the mark grows in over 0.5 s (`fade-in`); its box is final only then.
        await expect.poll(() => labelBeside(page)).toEqual({ right: false, left: true });
        await page.emulateMedia({ forcedColors: 'active' });
        const forced = await page.locator('.image-wrapper').evaluate((el) => {
          const label = getComputedStyle(el, '::after');
          return [label.content, label.borderTopStyle, label.color];
        });
        // Assert: the mark is less than a label's width from the picture's right edge, so the label is on its
        // left; with forced colours it keeps its text and frame, in the system colours
        const hidden = page.locator('.hotspot-feedback:not(.correct) > .hvl-feedback-sr');
        expect(await hidden.textContent()).toBe('Feil: ');
        expect(forced).toEqual(['"Feil:" / ""', 'solid', 'rgb(0, 0, 0)']);
        await page.close();
      }, 60_000);
    });
  });
});
