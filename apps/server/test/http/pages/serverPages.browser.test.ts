/**
 * Browser tests for the look of the server's own pages with their real stylesheets: the editor's outer page uses the
 * token typography and target size for its save button and status (A11Y-4), and its «Lagre» held with
 * `aria-disabled` looks like a disabled button (D-093 amendment 2026-10-29, S5 review); a page with the Hjelp header
 * has a skip link that appears on focus and a Hjelp link at least 24 px tall (UD-013, UD-006, UD-005).
 *
 * Spec: UD-002, UD-005, UD-006, UD-013
 */
import type { IIntegration } from '@lumieducation/h5p-server';
import express from 'express';
import type { Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { HVL_THEME_FILES } from '../../../src/h5p/h5pAssets.js';
import { renderEditorPage } from '../../../src/h5p/render/editorPage.js';
import { messagePage } from '../../../src/http/pages/messagePage.js';
import { pageAssetRoutes } from '../../../src/http/pages/pageAssetRoutes.js';
import { describeWithBrowser } from '../../support/browser.js';
import { closeLoopbackServers, listenOnLoopback } from '../../support/loopbackServers.js';

const THEME_STYLES = HVL_THEME_FILES.filter((file) => file.name.endsWith('.css'));

describeWithBrowser('[UD-002] server pages in Chromium', (browser) => {
  let base: string;
  const pages: Page[] = [];
  beforeAll(async () => {
    const app = express();
    app.use(pageAssetRoutes());
    for (const file of HVL_THEME_FILES)
      app.get(`/h5p/theme/${file.name}`, (_req, res) => res.sendFile(file.path));
    app.get('/editor', (_req, res) => {
      const styles = THEME_STYLES.map((file) => `/h5p/theme/${file.name}`);
      const integration = { editor: { language: 'nn' } } as unknown as IIntegration;
      res
        .type('html')
        .send(
          renderEditorPage({ integration, scripts: [], styles, contentId: 'c1', token: undefined }, 'nn'),
        );
    });
    app.get('/message', (_req, res) => {
      const input = { locale: 'nn', titleKey: 'page.notFound.title', bodyKey: 'page.notFound.body' } as const;
      res.type('html').send(messagePage({ ...input, help: { newTab: false } }));
    });
    base = await listenOnLoopback(app);
  });
  afterEach(async () => {
    await Promise.all(pages.splice(0).map((page) => page.close()));
  });
  afterAll(async () => {
    await closeLoopbackServers();
  });

  const open = async (path: string): Promise<Page> => {
    const page = await browser().newPage({ viewport: { width: 1280, height: 800 } });
    pages.push(page);
    // WHY: the editor's boot scripts are not served here; only the styles matter.
    await page.route('**/*.js', (route) => route.abort());
    await page.goto(`${base}${path}`);
    return page;
  };

  it('[UD-002] the editor’s save button and status use the token font, size and line height; the editor keeps its width', async () => {
    // Act
    const page = await open('/editor');
    const looks = await page.evaluate(() => {
      const style = (selector: string) => getComputedStyle(document.querySelector(selector) as Element);
      const button = document.querySelector('#hvl-editor-save') as HTMLElement;
      return {
        buttonFont: style('#hvl-editor-save').fontFamily,
        buttonSize: style('#hvl-editor-save').fontSize,
        buttonHeight: button.getBoundingClientRect().height,
        statusFont: style('#hvl-editor-status').fontFamily,
        statusSize: style('#hvl-editor-status').fontSize,
        statusLineHeight: style('#hvl-editor-status').lineHeight,
        mainWidth: (document.querySelector('main') as HTMLElement).getBoundingClientRect().width,
      };
    });
    // Assert
    expect(looks.buttonFont).toMatch(/^Arial/);
    expect(looks.buttonSize).toBe('16px');
    expect(looks.buttonHeight).toBeGreaterThanOrEqual(24);
    expect(looks.statusFont).toMatch(/^Arial/);
    expect(looks.statusSize).toBe('16px');
    expect(looks.statusLineHeight).toBe('24px');
    expect(looks.mainWidth).toBeGreaterThan(1200);
  }, 30_000);

  it('[UD-002] a button held with aria-disabled looks like a disabled one, also in forced colours', async () => {
    // Arrange: «Lagre» while a chosen reset or copy runs (D-093 amendment 2026-10-29, S5 review)
    const page = await open('/editor');
    const looks = () =>
      page.evaluate(() => {
        const button = document.querySelector('#hvl-editor-save') as HTMLButtonElement;
        const look = () => {
          const style = getComputedStyle(button);
          return [style.borderColor, style.backgroundColor, style.color, style.cursor].join(' / ');
        };
        button.disabled = false;
        const available = look();
        button.disabled = true;
        const disabled = look();
        button.disabled = false;
        button.setAttribute('aria-disabled', 'true');
        const held = look();
        button.removeAttribute('aria-disabled');
        return { available, disabled, held };
      });
    // Act
    const normal = await looks();
    await page.emulateMedia({ forcedColors: 'active' });
    const forced = await looks();
    // Assert
    expect(normal.held).toBe(normal.disabled);
    expect(normal.held).not.toBe(normal.available);
    expect(forced.held).toBe(forced.disabled);
    expect(forced.held).not.toBe(forced.available);
  }, 30_000);

  it('[UD-006] the skip link appears when focused and the Hjelp link is a 24 px target in the header', async () => {
    // Arrange
    const page = await open('/message');
    const skipTop = () =>
      page.evaluate(() => document.querySelector('.hvl-skip-link')?.getBoundingClientRect().top ?? -1);
    // Act
    const hiddenTop = await skipTop();
    await page.keyboard.press('Tab');
    const focusedTop = await skipTop();
    const help = await page.evaluate(() => {
      const link = document.querySelector('header nav a') as HTMLElement;
      return { height: link.getBoundingClientRect().height, text: link.textContent };
    });
    // Assert
    expect(hiddenTop).toBeLessThan(0);
    expect(focusedTop).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => document.activeElement?.className)).toBe('hvl-skip-link');
    expect(help).toEqual({ height: expect.any(Number), text: 'Hjelp' });
    expect(help.height).toBeGreaterThanOrEqual(24);
  }, 30_000);
});
