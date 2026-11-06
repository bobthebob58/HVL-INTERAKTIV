/**
 * Integration tests for the xAPI bridge on the portal's player page (`/h5p/play/:contentId`): a learner's page carries
 * the bridge's scripts after the theme's, its configuration with the session's CSRF token and the version the page
 * was rendered with, and `reportingIsEnabled`; an author's preview, also of their own activity, and an admin's page
 * carry none of them.
 *
 * Spec: LTI-010, H5P-009
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { bridgeOnPage } from '../h5p/support/xapiBridgePage.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { requestAs } from '../support/requestAs.js';
import { describeWithServices } from '../support/services.js';

const CSRF = 'csrf-token-of-the-portal-session';
const BRIDGE = ['xapiStatements.js', 'xapiBatching.js', 'xapiBridge.js'];

describeWithServices('[LTI-010] the xAPI bridge on the portal’s player page', () => {
  let tb: HttpTestbed;
  let author: TestActor;
  let published: string;
  beforeAll(async () => {
    tb = await openHttpTestbed();
    author = await tb.actor('author', { urlToken: { name: 'csrf', value: CSRF } });
    published = await tb.activity(author, { published: true });
  }, 60_000);
  afterAll(() => tb.close());

  const page = async (who: TestActor) => {
    const res = await requestAs(tb.app, who, 'get', `/h5p/play/${published}`);
    expect(res.status).toBe(200);
    return { html: res.text, bridge: bridgeOnPage(res.text) };
  };

  it('[LTI-010] a learner’s page loads the bridge last, with the CSRF token and the rendered version', async () => {
    // Arrange
    const learner = await tb.actor('learner', { urlToken: { name: 'csrf', value: CSRF } });
    const { version } = await tb.db.h5PContent.findUniqueOrThrow({ where: { id: published } });
    // Act
    const { html, bridge } = await page(learner);
    // Assert
    expect(bridge.config).toEqual({
      endpoint: '/api/h5p/xapi',
      contentId: published,
      contentVersion: version,
      token: { name: 'csrf', value: CSRF },
    });
    expect(bridge.scripts).toEqual(BRIDGE);
    expect(bridge.coreScripts).toHaveLength(3);
    expect(bridge.bridgeAfterTheme).toBe(true);
    expect(bridge.reporting).toBe(true);
    // PRIVACY: the configuration names no person (D-115)
    expect(html).not.toContain(learner.actor.learnerKey);
    expect(html).not.toContain(learner.actor.accountId);
  });

  it('[H5P-009] an author previewing their own activity, and an admin, get no bridge and no reporting', async () => {
    // Arrange
    const admin = await tb.actor('admin', { urlToken: { name: 'csrf', value: CSRF } });
    for (const viewer of [author, admin]) {
      // Act
      const { bridge } = await page(viewer);
      // Assert
      expect(bridge, viewer.actor.role).toEqual({
        config: null,
        scripts: [],
        coreScripts: [],
        reporting: undefined,
        bridgeAfterTheme: true,
      });
    }
  });
});
