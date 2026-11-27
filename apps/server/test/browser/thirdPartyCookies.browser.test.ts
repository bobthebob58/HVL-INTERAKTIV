/**
 * Browser tests that find a reliable way to run Chromium with third-party cookies blocked for the cookie-less LTI
 * iframe e2e (D-065, D-149), prove it with a canary against a control run, and record what a blocked cross-site
 * frame can still store. They also pin the Chromium switches, settings and CDP controls that look like they block
 * but do not, so a browser update that changes one of them is noticed. One test holds the clean-up of a profile
 * folder: removed with what is in it, and a failure reported, never thrown.
 *
 * Spec: LTI-003
 */
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import { startCookieCanary, type CookieCanary } from '../support/thirdPartyCookieCanary.js';
import {
  BLOCK_THIRD_PARTY_COOKIES_SWITCH,
  launchCookieTestChromium,
  removeBrowserProfile,
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

it('[LTI-003] a profile folder is removed with what is in it, and one that cannot be removed fails no run', () => {
  // Arrange: a profile as a closing Chromium leaves it, and a path no removal can take
  const profile = mkdtempSync(join(tmpdir(), 'cookie-profile-'));
  mkdirSync(join(profile, 'Default', 'Cache'), { recursive: true });
  writeFileSync(join(profile, 'Default', 'Cache', 'index'), 'x');
  const warned = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  // Act
  removeBrowserProfile(profile);
  removeBrowserProfile(profile);
  const unremovable = () => removeBrowserProfile('no\0such-profile');
  // Assert: gone, gone again without a word, and the failure said, not thrown
  expect(existsSync(profile)).toBe(false);
  expect(warned).not.toHaveBeenCalled();
  expect(unremovable).not.toThrow();
  expect(warned.mock.calls.map(([line]) => String(line))).toEqual([
    expect.stringMatching(/^the browser profile no\0such-profile could not be removed: /),
  ]);
  warned.mockRestore();
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

  it('upstream pin: the full build ignores the blocking switch while storage partitioning is off', async () => {
    // WHY: up to Chromium 141 the switch blocked here; from 159 it needs the partitioning Playwright turns off.
    const full = await chromium.launch({ channel: 'chromium', args: [BLOCK_THIRD_PARTY_COOKIES_SWITCH] });
    const { report, stored } = await probe(full, canary).finally(() => full.close());
    expect(report.followUpCookie).toBe('canary=1');
    expect(stored).toEqual(['canary']);
  });

  it('upstream pin: the default headless shell ignores the profile setting that the full build follows', async () => {
    // Arrange: a profile with «Block third-party cookies» on, as launchCookieTestChromium prepares it
    const profile = mkdtempSync(join(tmpdir(), 'cookie-shell-'));
    mkdirSync(join(profile, 'Default'));
    const preferences = JSON.stringify({ profile: { cookie_controls_mode: 1 } });
    writeFileSync(join(profile, 'Default', 'Preferences'), preferences);
    // Act
    const shell = await chromium.launchPersistentContext(profile);
    const report = await canary.open(await shell.newPage()).finally(() => shell.close());
    removeBrowserProfile(profile);
    // Assert
    expect(report).toMatchObject({ documentCookie: 'canary=1', followUpCookie: 'canary=1' });
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
