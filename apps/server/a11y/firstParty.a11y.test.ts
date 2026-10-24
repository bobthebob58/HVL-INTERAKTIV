/**
 * First-party requests only: every request of every web view (signed out and as the author), of the Canvas page
 * with the player of each of the ten content types (fresh, then started and answered) and of each type's editor
 * goes to the tool's own origin. What the Content Security Policy refused (it never reached the network) is printed, so a new outside
 * source is noticed.
 *
 * Spec: DATA-011, UD-030
 */
import { expect, it } from 'vitest';
import { describeA11y } from './support/a11ySuite.js';
import { CONTENT_TYPES, PLAIN_ROUTES, viewName, WEB_VIEWS } from './support/catalogue.js';
import { recordRequests, thirdPartyRequests, type RequestLog } from './support/motionAndNetwork.js';
import { playerFrame } from './support/pages.js';
import { openView, startAndAnswer } from './support/views.js';

/** Prints what the policy refused on a view. */
const printRefused = (label: string, log: RequestLog) => {
  if (log.refused.length)
    console.info(`DATA-011 ${label}: refused by the policy:\n  ${log.refused.join('\n  ')}`);
};

describeA11y('[DATA-011] no third-party requests in the browser', (env) => {
  it.each(PLAIN_ROUTES)('[DATA-011] signed out: %s requests only its own origin', async (path) => {
    // Arrange
    const { app, browser } = env();
    const context = await browser.newContext();
    const log = recordRequests(context);
    // Act
    await openView(app, context, { kind: 'route', path });
    // Assert
    printRefused(path, log);
    expect(log.urls.length).toBeGreaterThan(0);
    expect(thirdPartyRequests(log, app.base)).toEqual([]);
    await context.close();
  });

  it.each(WEB_VIEWS.map((view) => [viewName(view), view] as const))(
    '[DATA-011] the author on %s requests only its own origin',
    async (name, view) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ storageState: app.authorStorage });
      const log = recordRequests(context);
      // Act
      await openView(app, context, view, { signedIn: true });
      // Assert
      printRefused(name, log);
      expect(thirdPartyRequests(log, app.base)).toEqual([]);
      await context.close();
    },
  );

  it.each(CONTENT_TYPES)(
    '[DATA-011] %s in Canvas, fresh, started and answered, requests only its own origin',
    async (type) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext();
      const log = recordRequests(context);
      // Act
      const page = await openView(app, context, { kind: 'canvas' }, { contentId: app.ids.get(type) ?? '' });
      await startAndAnswer(await playerFrame(page));
      await page.waitForLoadState('networkidle');
      // Assert
      printRefused(`${type} player`, log);
      expect(log.urls.some((url) => url.includes('/h5p/libraries/'))).toBe(true);
      expect(thirdPartyRequests(log, app.base)).toEqual([]);
      await context.close();
    },
  );

  it.each(CONTENT_TYPES)('[DATA-011] the editor of %s requests only its own origin', async (type) => {
    // Arrange
    const { app, browser } = env();
    const context = await browser.newContext({ storageState: app.authorStorage });
    const log = recordRequests(context);
    // Act
    await openView(app, context, { kind: 'activity', tab: 'edit' }, { contentId: app.ids.get(type) ?? '' });
    // Assert
    printRefused(`${type} editor`, log);
    expect(thirdPartyRequests(log, app.base)).toEqual([]);
    await context.close();
  });
});
