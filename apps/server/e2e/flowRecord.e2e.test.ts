/**
 * End-to-end test of what the browser flows report: the flow record (../test/support/flowRecorder.ts) sees a cookie
 * that Chromium drops in a cross-site frame, keeps the ltik out of everything it reports, and the lost-rows check
 * (../test/support/lostTestRows.ts) names rows that another process removed from the shared database.
 *
 * Spec: LTI-003, DATA-009, NFR-004
 */
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Database } from '../src/infra/prismaClient.js';
import { recordFlow } from '../test/support/flowRecorder.js';
import { LOST_ROWS_HINT, lostRowsFact } from '../test/support/lostTestRows.js';
import { describeWithServices, serviceEnv } from '../test/support/services.js';
import { launchCookieTestChromium, startCookieCanary } from '../test/support/thirdPartyCookies.js';

/** An ltik-shaped JWT (not a real one): header, payload and signature in base64url. */
const FAKE_LTIK = ['{"alg":"RS256"}', '{"tid":"flow-record"}', 'signature']
  .map((part) => Buffer.from(part).toString('base64url'))
  .join('.');

describe('[LTI-003] the flow record of a cross-site frame', () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await launchCookieTestChromium();
  });
  afterAll(async () => {
    await browser?.close();
  });

  it('[LTI-003][DATA-009] the record sees a Set-Cookie the browser drops and never repeats the ltik', async () => {
    // Arrange: the canary's tool frame sets a cookie, which Chromium drops in a cross-site frame
    const canary = await startCookieCanary();
    const context = await browser.newContext();
    const page = await context.newPage();
    const flow = await recordFlow(page, canary.toolOrigin);
    flow.step = 'canary';
    // Act: the frame then fails a request that carries an ltik, as H5P's AJAX requests do
    await canary.open(page);
    const frame = page.frames().find((candidate) => candidate.url().startsWith(canary.toolOrigin));
    await frame?.evaluate((ltik) => fetch(`/missing?ltik=${ltik}&action=content-type-cache`), FAKE_LTIK);
    await expect.poll(() => flow.problems.length).toBe(1);
    // Act: a policy violation in the cross-site frame, with the ltik in the blocked address
    await frame?.evaluate((ltik) => {
      const violation = { violatedDirective: 'img-src', effectiveDirective: 'img-src', originalPolicy: '' };
      const init = {
        ...violation,
        blockedURI: `http://elsewhere.test/?ltik=${ltik}`,
        disposition: 'enforce',
      };
      document.dispatchEvent(new SecurityPolicyViolationEvent('securitypolicyviolation', init as never));
    }, FAKE_LTIK);
    await expect.poll(() => flow.problems.length).toBe(2);
    await flow.settled();
    const explained = flow.explain(new Error(`Authorization: Bearer ${FAKE_LTIK} at /x?ltik=${FAKE_LTIK}`));
    const jar = await context.cookies(canary.toolOrigin);
    await context.close();
    await canary.close();
    // Assert: the cookie never reached the jar, but the record saw the header
    expect(jar).toEqual([]);
    expect(flow.setCookies).toEqual(['/frame canary']);
    expect(flow.failed).toEqual(['404 /missing']);
    expect(flow.requests).toContain('GET /missing');
    // Assert: the console message and the violation keep their addresses without the ltik, as the explanation does
    expect(flow.problems[0]).toContain(
      `${canary.toolOrigin}/missing?ltik=[redacted]&action=content-type-cache`,
    );
    expect(flow.problems[1]).toMatch(/^csp: img-src http:\/\/elsewhere\.test\/\?ltik=\[redacted\] /);
    expect(explained.message).toContain(
      'the flow failed at "canary": Error: Authorization: Bearer [redacted]',
    );
    expect(explained.message).toContain('"failed":["404 /missing"]');
    const reported = [...flow.problems, explained.message, (explained.cause as Error).stack].join('\n');
    for (const part of FAKE_LTIK.split('.')) expect(reported).not.toContain(part);
  });
});

describeWithServices('[NFR-004] rows another process removed from the shared database', () => {
  let db: Database;
  beforeAll(() => {
    db = createPrismaClient(serviceEnv().DATABASE_URL);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it('[NFR-004] a failed flow names the rows that are gone and why, by their labels', async () => {
    // Arrange: one account that is still there and one that another process's cleanup removed
    const kept = (await db.user.create({ data: { kind: 'staff' } })).id;
    const removed = (await db.user.create({ data: { kind: 'staff' } })).id;
    await db.user.delete({ where: { id: removed } });
    // Act
    const fact = await lostRowsFact(db, {
      users: { 'the author': kept, 'the teacher': removed },
      contents: { 'the activity': crypto.randomUUID() },
      platformId: crypto.randomUUID(),
    });
    const none = await lostRowsFact(db, { users: { 'the author': kept } });
    await db.user.delete({ where: { id: kept } });
    // Assert
    expect(fact).toEqual({
      lostRows: [
        'the teacher (User)',
        'the activity (H5PContent)',
        'the mock Canvas (LtiPlatform deleted or inactive)',
      ],
      hint: LOST_ROWS_HINT,
    });
    expect(none).toEqual({ lostRows: [] });
  });
});
