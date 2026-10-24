/**
 * Language of page and parts in the browser: `<html lang>` of every web view follows the UI language, also when a
 * Canvas launch asks for Bokmål or English; the framed H5P player page has the same `lang`, and the content
 * container carries the activity's own language (the examples are Nynorsk), as does H5P's editor iframe. The Canvas
 * page's title heading says `lang="nn"` when the page is in another language (WCAG 3.1.2).
 *
 * Spec: UD-010, PROD-012
 */
import { expect, it } from 'vitest';
import type { UiLocale } from '../test/support/realWebApp.js';
import { describeA11y } from './support/a11ySuite.js';
import { CONTENT_TYPES, viewName, WEB_VIEWS } from './support/catalogue.js';
import { playerFrame } from './support/pages.js';
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
});
