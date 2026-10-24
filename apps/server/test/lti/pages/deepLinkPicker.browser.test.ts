/**
 * Browser tests for the Deep Linking picker's script with the real page, stylesheets and policy: a problem appears
 * in the error summary below the heading, which takes focus and links to the field it is about (UD-013).
 *
 * Spec: UD-013, LTI-005
 */
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { pageAssetRoutes } from '../../../src/http/pages/pageAssetRoutes.js';
import { t } from '../../../src/i18n/translate.js';
import { ltiPageCsp, setLtiPageHeaders } from '../../../src/lti/http/ltiPageHeaders.js';
import {
  DEEP_LINK_PICKER_SCRIPT,
  DEEP_LINK_RESPONSE_PATH,
  deepLinkPickerPage,
} from '../../../src/lti/pages/deepLinkPickerPage.js';
import { describeWithBrowser } from '../../support/browser.js';

const TOKENS = createRequire(import.meta.url).resolve('@hvl-interaktiv/design-tokens/tokens.css');
const SCRIPT = fileURLToPath(new URL('../../../src/lti/pages/client/deepLinkPicker.js', import.meta.url));
const ACTIVITIES = [
  { id: 'd1', title: 'Utkast', mainLibrary: 'H5P.Blanks', selectable: false },
  { id: 'a1', title: 'Brøkar', mainLibrary: 'H5P.MultiChoice', selectable: true },
];

describeWithBrowser('[UD-013] Deep Linking picker errors in Chromium', (browser) => {
  let server: Server;
  let base: string;
  const pages: Page[] = [];
  beforeAll(async () => {
    const app = express();
    app.use(pageAssetRoutes());
    app.get('/h5p/theme/tokens.css', (_req, res) => res.sendFile(TOKENS));
    app.get(DEEP_LINK_PICKER_SCRIPT, (_req, res) => res.sendFile(SCRIPT));
    app.get('/lti/deeplink', (_req, res) => {
      setLtiPageHeaders(res, ltiPageCsp(['https://hvl.instructure.com']));
      res
        .type('html')
        .send(deepLinkPickerPage({ locale: 'nn', activities: ACTIVITIES, multiple: false, graded: false }));
    });
    app.post(DEEP_LINK_RESPONSE_PATH, (_req, res) => void res.status(500).json({ success: false }));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterEach(async () => {
    await Promise.all(pages.splice(0).map((page) => page.close()));
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const openPicker = async (): Promise<Page> => {
    const page = await browser().newPage();
    pages.push(page);
    await page.goto(`${base}/lti/deeplink?ltik=test-ltik`);
    return page;
  };

  /** What the summary and the fieldset say after a submit. */
  const errorState = (page: Page) =>
    page.evaluate(() => {
      const summary = document.getElementById('deep-link-errors');
      const fieldset = document.querySelector('fieldset');
      return {
        visible: summary !== null && !summary.hidden && summary.getBoundingClientRect().height > 0,
        focused: document.activeElement?.id,
        text: document.getElementById('deep-link-error')?.textContent,
        link: document.querySelector('#deep-link-error a')?.getAttribute('href') ?? null,
        invalid: fieldset?.getAttribute('aria-invalid') ?? null,
        describedBy: fieldset?.getAttribute('aria-describedby') ?? null,
      };
    });

  it('[UD-013] nothing chosen: the summary takes focus and links to the first choice, which names it', async () => {
    // Arrange
    const page = await openPicker();
    // Act
    await page.click('button[type="submit"]');
    const state = await errorState(page);
    await page.click('#deep-link-error a');
    // Assert
    expect(state).toEqual({
      visible: true,
      focused: 'deep-link-errors',
      text: t('deepLink.noneChosen', {}, 'nn'),
      link: '#activity-1',
      invalid: 'true',
      describedBy: 'deep-link-error',
    });
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('activity-1');
  }, 30_000);

  it('[UD-013] a failed send is reported in the summary too, without a field link, and clears the field state', async () => {
    // Arrange
    const page = await openPicker();
    await page.click('button[type="submit"]');
    // Act
    await page.check('#activity-1');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => document.getElementById('deep-link-error')?.textContent !== '');
    // Assert
    expect(await errorState(page)).toEqual({
      visible: true,
      focused: 'deep-link-errors',
      text: t('deepLink.failed', {}, 'nn'),
      link: null,
      invalid: null,
      describedBy: null,
    });
    expect(await page.isEnabled('button[type="submit"]')).toBe(true);
  }, 30_000);
});
