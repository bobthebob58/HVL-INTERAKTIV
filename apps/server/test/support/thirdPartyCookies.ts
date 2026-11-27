/**
 * thirdPartyCookies — starts Chromium with third-party cookies blocked, as a person's own setting blocks them.
 *
 * Why: LTI-003 requires launch → play → resume in a cross-site iframe with third-party cookies blocked (D-065).
 *      The headless shell that `chromium.launch()` starts by default silently ignores the blocking switch, and CDP
 *      `Network.setCookieControls` stops covering a site-isolated frame after its first load. So tests start the
 *      full Chromium build (`channel: 'chromium'`, new headless mode) on a fresh profile in which the browser's own
 *      setting «Block third-party cookies» is on (`profile.cookie_controls_mode`), as a person would set it. The
 *      switch `--test-third-party-cookie-phaseout`, which did this up to Chromium 141, blocks nothing from
 *      Chromium 159 unless storage partitioning is on (D-149). Playwright turns storage partitioning off
 *      (playwright#32230), so a blocked frame loses localStorage as well, unlike stock Chrome; `partitionedStorage`
 *      restores the stock behaviour.
 * Spec: LTI-003
 * Invariants:
 *   - A test that relies on the block asserts the canary first (./thirdPartyCookieCanary.ts): an ignored setting
 *     must fail, never pass.
 *   - Every context of the returned browser follows the profile's setting; the profile folder is removed when the
 *     browser closes. Chromium's processes still write into it for a moment after the connection is gone, so a
 *     removal is tried again, and one that still fails is reported and never thrown: an exception in the close
 *     handler would fail a whole run in which every test passed.
 * Collaborators: playwright-core 1.65.1 (the switches it starts Chromium with, read for `partitionedStorage`),
 *   ./thirdPartyCookieCanary.ts.
 * Tests: apps/server/test/browser/thirdPartyCookies.browser.test.ts
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright-core';

/**
 * Chromium's test switch for blocking third-party cookies. The helper no longer uses it: the headless shell ignores
 * it, and from Chromium 159 the full build honours it only with storage partitioning on (the browser tests pin both).
 */
export const BLOCK_THIRD_PARTY_COOKIES_SWITCH = '--test-third-party-cookie-phaseout';

/** A profile's preferences with Chrome's own setting «Block third-party cookies» on (1: in every window). */
const BLOCKING_PREFERENCES = { profile: { cookie_controls_mode: 1 } };

/** How {@link launchCookieTestChromium} starts the browser. */
export interface CookieTestChromiumOptions {
  /** Blocks third-party cookies (default `true`); `false` starts the control browser. */
  readonly blockThirdPartyCookies?: boolean;
  /** Restores the storage partitioning that Playwright turns off, as in stock Chrome (default `false`). */
  readonly partitionedStorage?: boolean;
}

let disableFeaturesSwitch: Promise<string> | undefined;

/**
 * Playwright's own `--disable-features=…` switch for the full Chromium, read once from a browser it starts.
 * WHY: the switch list is no longer a module of its own in playwright-core (1.65.1 ships one bundle), and
 * Chromium tells its command line over CDP only with `--enable-automation`, which Playwright does not pass. The
 * process `launchServer` starts carries the same default switches as `launch`.
 */
function playwrightDisableFeaturesSwitch(): Promise<string> {
  disableFeaturesSwitch ??= (async () => {
    const server = await chromium.launchServer({ channel: 'chromium' });
    try {
      const found = server.process().spawnargs.find((s) => s.startsWith('--disable-features='));
      if (!found?.split(/[=,]/).includes('ThirdPartyStoragePartitioning'))
        throw new Error(
          'playwright-core no longer turns storage partitioning off; recheck partitionedStorage',
        );
      return found;
    } finally {
      await server.close();
    }
  })();
  return disableFeaturesSwitch;
}

/**
 * Removes a browser profile folder with everything in it.
 * @param profile - The folder; one that is already gone is no error.
 */
export function removeBrowserProfile(profile: string): void {
  try {
    // WHY: a file Chromium writes while the folder is being emptied makes the removal fail with ENOTEMPTY; Node
    // tries such a removal again itself, a little later each time.
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch (error) {
    // WHY: a temporary folder left behind harms nothing; the line says where it is.
    console.warn(`the browser profile ${profile} could not be removed: ${String(error)}`);
  }
}

/**
 * Starts the full Chromium build in new headless mode on a fresh profile, by default with third-party cookies
 * blocked by the profile's own setting.
 * @param options - Blocking on or off (control), and whether storage partitioning is restored.
 * @returns A running browser whose contexts all follow the setting; the caller closes it.
 * @throws When the full Chromium build is not installed (`npx playwright-core install chromium` installs it).
 * @spec LTI-003
 */
export async function launchCookieTestChromium(options: CookieTestChromiumOptions = {}): Promise<Browser> {
  const profile = mkdtempSync(join(tmpdir(), 'cookie-test-chromium-'));
  if (options.blockThirdPartyCookies !== false) {
    mkdirSync(join(profile, 'Default'));
    writeFileSync(join(profile, 'Default', 'Preferences'), JSON.stringify(BLOCKING_PREFERENCES));
  }
  const args: string[] = [];
  const ignoreDefaultArgs: string[] = [];
  if (options.partitionedStorage) {
    // WHY: listing ThirdPartyStoragePartitioning in --enable-features does not win over Playwright's disable
    // list; replacing that list without the feature does.
    const disabled = await playwrightDisableFeaturesSwitch();
    const kept = disabled.slice(disabled.indexOf('=') + 1).split(',');
    ignoreDefaultArgs.push(disabled);
    args.push(
      `--disable-features=${kept.filter((name) => name !== 'ThirdPartyStoragePartitioning').join(',')}`,
    );
  }
  // WHY: only a persistent context starts on a profile we prepared; its browser still gives separate contexts.
  const started = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    args,
    ignoreDefaultArgs,
  });
  const browser = started.browser();
  if (!browser) throw new Error('the persistent context has no browser; recheck launchCookieTestChromium');
  browser.on('disconnected', () => removeBrowserProfile(profile));
  return browser;
}
