/**
 * Language of page and parts in the browser: `<html lang>` of every web view follows the UI language, also when a
 * Canvas launch asks for Bokmål or English; the framed H5P player page has the same `lang`, and the content
 * container carries the activity's own language (the examples are Nynorsk), as does H5P's editor iframe. The Canvas
 * page's title heading says `lang="nn"` when the page is in another language (WCAG 3.1.2). In the studio (S5), text
 * in another language than the page carries its own `lang`: the guide's references (most are English), and a learner
 * purpose before the activity, in the portal, in Canvas and on the content bank's cards.
 *
 * Spec: UD-010, PROD-012, PED-002, PED-032
 */
import type { Guide } from '@hvl-interaktiv/api-contract';
import type { Page } from 'playwright-core';
import { expect, it } from 'vitest';
import type { UiLocale } from '../test/support/realWebApp.js';
import { describeA11y } from './support/a11ySuite.js';
import { CONTENT_TYPES, viewName, WEB_VIEWS } from './support/catalogue.js';
import { openActivityTab, openLaunch, openWebPage, playerFrame } from './support/pages.js';
import { SEED_PURPOSES } from './support/studioSeed.js';
import { openView } from './support/views.js';

/** The skip link's text per UI language (apps/web `common.skipToMain`). */
const SKIP_LINK: Record<UiLocale, string> = {
  nn: 'Gå til hovudinnhaldet',
  nb: 'Gå til hovedinnholdet',
  en: 'Skip to main content',
};

describeA11y('[UD-010] language of page and parts', (env) => {
  it.each(WEB_VIEWS.map((view) => [viewName(view), view] as const))(
    '[UD-010] %s has <html lang="nn"> for the author',
    async (_name, view) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ storageState: app.authorStorage });
      // Act
      const page = await openView(app, context, view, { signedIn: true });
      // Assert
      expect(await page.locator('html').getAttribute('lang')).toBe('nn');
      await context.close();
    },
  );

  it.each<UiLocale>(['nn', 'nb', 'en'])(
    '[UD-010] a Canvas launch in %s sets the page and player language; the activity keeps its own',
    async (locale) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext();
      // Act
      const page = await openView(app, context, { kind: 'canvas' }, { locale });
      const player = await playerFrame(page);
      // Assert
      expect(await page.locator('html').getAttribute('lang')).toBe(locale);
      await expect.poll(() => page.getByRole('link', { name: SKIP_LINK[locale] }).count()).toBe(1);
      expect(await player.locator('html').getAttribute('lang')).toBe(locale);
      expect(await player.locator('.h5p-content').getAttribute('lang')).toBe('nn');
      expect(await page.locator('h1').getAttribute('lang')).toBe(locale === 'nn' ? null : 'nn');
      await context.close();
    },
  );

  it.each(CONTENT_TYPES)(
    '[UD-010] %s: the player content container and the editor iframe say nn',
    async (type) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ storageState: app.authorStorage });
      const contentId = app.ids.get(type) ?? '';
      // Act
      const player = await playerFrame(
        await openView(app, context, { kind: 'activity', tab: 'play' }, { contentId }),
      );
      const editorPage = await openView(app, context, { kind: 'activity', tab: 'edit' }, { contentId });
      const editor = editorPage.frames().find((frame) => frame.parentFrame()?.url().includes('/h5p/edit/'));
      // Assert
      expect(await player.locator('.h5p-content').getAttribute('lang')).toBe('nn');
      expect(await editor?.locator('html').getAttribute('lang')).toBe('nn');
      await context.close();
    },
  );

  it('[UD-010][PED-002] the guide page marks every reference that is not in Nynorsk with its own lang', async () => {
    // Arrange: the real guide and its references, as the server answers them
    const { app, browser } = env();
    const guide = (await (await fetch(`${app.base}/api/studio/guide/nn`)).json()) as Guide;
    const context = await browser.newContext();
    const page = await openWebPage(context, app.base, '/laeringsdesign');
    // Act
    // WHY: read in the page, so a reference without `lang` reads as null instead of waiting for an element.
    const marked = await Promise.all(
      guide.references.map((r) =>
        page
          .locator(`[id="kjelde-${r.key}"]`)
          .evaluate((entry) => entry.querySelector('[lang]')?.getAttribute('lang') ?? null),
      ),
    );
    // Assert
    expect(guide.references.length).toBeGreaterThan(0);
    expect(marked).toEqual(
      guide.references.map((r) => (r.language.split('-')[0] === 'nn' ? null : r.language)),
    );
    await context.close();
  });

  it('[UD-010][PED-032] a learner purpose carries the activity’s language where the page has another', async () => {
    // Arrange: the author's Nynorsk activity launched in English, and a colleague's English one in the portal
    const { app, browser, studio } = env();
    const canvas = await browser.newContext();
    const portal = await browser.newContext({ storageState: app.authorStorage });
    const purpose = (page: Page, text: string) => page.locator('main dd').filter({ hasText: text });
    // Act
    const launched = await openLaunch(canvas, app, studio.designedId, { locale: 'en' });
    const played = await openActivityTab(portal, app.base, studio.colleagueActivityId, 'play');
    const bank = await openWebPage(portal, app.base, '/laeringsdesign/innhaldsbank');
    const card = bank.locator('main article').filter({ hasText: SEED_PURPOSES.en });
    // Assert
    expect(await purpose(launched, SEED_PURPOSES.nn).getAttribute('lang')).toBe('nn');
    expect(await purpose(played, SEED_PURPOSES.en).getAttribute('lang')).toBe('en');
    expect(await purpose(bank, SEED_PURPOSES.en).getAttribute('lang')).toBe('en');
    expect(await card.locator('h2').getAttribute('lang')).toBe('en');
    await Promise.all([canvas.close(), portal.close()]);
  });
});
