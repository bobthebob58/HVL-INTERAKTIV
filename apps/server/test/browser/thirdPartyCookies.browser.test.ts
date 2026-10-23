/**
 * Browser tests that find a reliable way to run Chromium with third-party cookies blocked for the cookie-less LTI
 * iframe e2e (D-065), prove it with a canary against a control run, and record what a blocked cross-site frame
 * can still store. They also pin the Chromium switches and CDP controls that look like they block but do not.
 *
 * Spec: LTI-003
 */
import { chromium, type Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import {
  BLOCK_THIRD_PARTY_COOKIES_SWITCH,
  launchCookieTestChromium,
  startCookieCanary,
  type CookieCanary,
} from '../support/thirdPartyCookies.js';

const COOKIE_CONTROLS = {
  enableThirdPartyCookieRestriction: true,
  disableThirdPartyCookieMetadata: true,
  disableThirdPartyCookieHeuristics: true,
};

/** Opens the canary in a fresh context of `browser`; returns the frame's report and the cookie names stored. */
async function probe(browser: Browser, canary: CookieCanary) {
  const context = await browser.newContext();
  try {
    const report = await canary.open(await context.newPage());
    return { report, stored: (await context.cookies()).map((cookie) => cookie.name) };
  } finally {
    await context.close();
  }
}

describeWithBrowser('[LTI-003] Chromium with third-party cookies blocked', () => {
  let canary: CookieCanary;
  let control: Browser;
  let blocked: Browser;
  let partitioned: Browser;
  beforeAll(async () => {
    canary = await startCookieCanary();
    [control, blocked, partitioned] = await Promise.all([
      launchCookieTestChromium({ blockThirdPartyCookies: false }),
      launchCookieTestChromium(),
      launchCookieTestChromium({ partitionedStorage: true }),
    ]);
  });
  afterAll(async () => {
    await Promise.all([control?.close(), blocked?.close(), partitioned?.close(), canary?.close()]);
  });

  it('[LTI-003] control: with blocking off, the cross-site frame stores and sends its cookie', async () => {
    const { report, stored } = await probe(control, canary);
    expect(report).toEqual({
      documentCookie: 'canary=1',
      followUpCookie: 'canary=1',
      localStorage: 'ok',
      sessionStorage: 'ok',
    });
    expect(stored).toEqual(['canary']);
  });

  it('[LTI-003] canary: with blocking on, the frame cookie is neither stored nor sent and storage throws', async () => {
    const { report, stored } = await probe(blocked, canary);
    // WHY: Playwright turns storage partitioning off, so blocking cookies blocks the frame's storage too.
    expect(report).toEqual({
      documentCookie: '',
      followUpCookie: '',
      localStorage: 'SecurityError',
      sessionStorage: 'SecurityError',
    });
    expect(stored).toEqual([]);
  });

  it('[LTI-003] with partitioning restored as in stock Chrome, cookies stay blocked but storage works', async () => {
    const { report, stored } = await probe(partitioned, canary);
    expect(report).toEqual({
      documentCookie: '',
      followUpCookie: '',
      localStorage: 'ok',
      sessionStorage: 'ok',
    });
    expect(stored).toEqual([]);
  });

  it('[LTI-003] a __Host- cookie set by http://localhost is stored and sent in a top-level page', async () => {
    // Arrange
    const context = await blocked.newContext();
    const page = await context.newPage();
    // Act
    await page.goto(`${canary.toolOrigin}/top-level`);
    const sent = await page.evaluate(() => fetch('/echo').then((response) => response.text()));
    const cookies = await context.cookies();
    await context.close();
    // Assert
    expect(sent).toBe('__Host-canary=1');
    expect(cookies).toMatchObject([
      {
        name: '__Host-canary',
        domain: 'localhost',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  });
});

describeWithBrowser('[LTI-003] Chromium cookie controls that do not block reliably', (browser) => {
  let canary: CookieCanary;
  beforeAll(async () => {
    canary = await startCookieCanary();
  });
  afterAll(async () => {
    await canary?.close();
  });

  it('upstream pin: the default headless shell ignores the blocking switch', async () => {
    const shell = await chromium.launch({ args: [BLOCK_THIRD_PARTY_COOKIES_SWITCH] });
    const { report, stored } = await probe(shell, canary).finally(() => shell.close());
    expect(report.followUpCookie).toBe('canary=1');
    expect(stored).toEqual(['canary']);
  });

  it('upstream pin: CDP Network.setCookieControls changes nothing until Network.enable', async () => {
    const context = await browser().newContext();
    const page = await context.newPage();
    await (await context.newCDPSession(page)).send('Network.setCookieControls', COOKIE_CONTROLS);
    const report = await canary.open(page).finally(() => context.close());
    expect(report.documentCookie).toBe('canary=1');
  });

  it('upstream pin: CDP cookie controls in full Chromium miss a site-isolated frame after its first load', async () => {
    // Arrange
    const full = await launchCookieTestChromium({ blockThirdPartyCookies: false });
    const page = await (await full.newContext()).newPage();
    const session = await page.context().newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.setCookieControls', COOKIE_CONTROLS);
    // Act
    const first = await canary.open(page);
    const again = await canary.reloadFrame(page).finally(() => full.close());
    // Assert
    expect(first).toMatchObject({ documentCookie: '', followUpCookie: '' });
    expect(again).toMatchObject({ documentCookie: 'canary=1', followUpCookie: 'canary=1' });
  });
});
