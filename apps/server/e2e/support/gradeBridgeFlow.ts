/**
 * gradeBridgeFlow — what the xAPI → Canvas flow does in and around the browser: records the xAPI bridge's posts with
 * their answers, answers a MultiChoice right as a learner would, and builds the grade worker as main.ts does.
 *
 * Why: the end-to-end test of the grade bridge (LTI-010, LTI-012) must see the bridge's real requests from the
 *      player frame inside the Canvas iframe, and then drive the real worker once, at a moment it names, instead of
 *      waiting for its timer (D-104's `runOnce(now)`).
 * Spec: LTI-010, LTI-011, LTI-012, NFR-004
 * Invariants:
 *   - A recorded post keeps the scheme of its credential (`Bearer`, `csrf` or none) and never its value (LTI-003).
 *   - The right options are read from the stored activity, so the flow follows the real content, not a guess; the
 *     check requires `randomAnswers: false`, so H5P shows the options in stored order.
 *   - The worker is built as main.ts builds it: the server's database, Redis and encryption keys, and our AGS client
 *     over ltijs's platform manager.
 * Collaborators: ./portalFrames.ts, ../xapiToCanvas.e2e.test.ts, ../../src/grades/GradeSyncWorker.ts,
 *   ../../test/support/realWebApp.ts, ../../test/support/capturedLogger.ts.
 * Tests: apps/server/e2e/xapiToCanvas.e2e.test.ts
 */
import type { Frame, Page } from 'playwright-core';
import { expect } from 'vitest';
import { GradeSyncWorker } from '../../src/grades/GradeSyncWorker.js';
import { DataEncryption } from '../../src/security/keys/DataEncryption.js';
import { capturedLogger } from '../../test/support/capturedLogger.js';
import type { RealWebApp } from '../../test/support/realWebApp.js';

/** The bridge's endpoint (src/h5p/render/xapiBridgeConfig.ts). */
export const XAPI_PATH = '/api/h5p/xapi';

/** One post of the bridge, as the test may keep it. */
export interface BridgePost {
  /** `Bearer`, `csrf` or `none`: which credential the post carried, never its value. */
  readonly credential: 'Bearer' | 'csrf' | 'none';
  /** The verbs of its statements, by their last path segment (e.g. `answered`). */
  readonly verbs: readonly string[];
  /** The answer's status. */
  readonly status: number;
}

/**
 * The verbs of a batch's statements, by their last path segment.
 * @param body - The request body as sent.
 * @returns The verbs, or `['unreadable']` for a body that is not a batch's JSON.
 */
function verbsOf(body: string | null): string[] {
  try {
    const batch = JSON.parse(body ?? '{}') as { statements?: { verb?: { id?: string } }[] };
    return (batch.statements ?? []).map((s) => (s.verb?.id ?? '').split('/').pop() ?? '');
  } catch {
    return ['unreadable'];
  }
}

/**
 * Records every post to the xAPI endpoint that a page or any of its frames sends, once it is answered.
 * @param page - The page; requests of its frames count too.
 * @returns The live list of answered posts.
 */
export function recordBridgePosts(page: Page): BridgePost[] {
  const posts: BridgePost[] = [];
  page.on('response', async (response) => {
    const request = response.request();
    if (request.method() !== 'POST' || new URL(request.url()).pathname !== XAPI_PATH) return;
    // WHY: `headers()` leaves out security-related headers in Chromium; `allHeaders()` has the Authorization header.
    const headers = await request.allHeaders().catch(() => request.headers());
    const credential = headers.authorization?.startsWith('Bearer ')
      ? 'Bearer'
      : headers['x-csrf-token']
        ? 'csrf'
        : 'none';
    posts.push({ credential, verbs: verbsOf(request.postData()), status: response.status() });
  });
  return posts;
}

/**
 * Waits for the player frame at `path` and until H5P has started the activity in it.
 * @param page - The page that frames the player.
 * @param path - `/lti/play` or `/h5p/play/<id>`.
 * @returns The frame.
 */
export async function startedPlayer(page: Page, path: string): Promise<Frame> {
  const pathOf = (url: string) => (url.startsWith('http') ? new URL(url).pathname : url);
  const find = () => page.frames().find((frame) => !frame.isDetached() && pathOf(frame.url()) === path);
  await expect.poll(() => find() !== undefined, { timeout: 45_000 }).toBe(true);
  const frame = find() as Frame;
  await frame.waitForFunction(
    () => (window as unknown as { H5P?: { instances?: unknown[] } }).H5P?.instances?.length,
    undefined,
    { timeout: 30_000 },
  );
  return frame;
}

/**
 * Answers a stored MultiChoice right: picks every correct option and presses «Sjekk».
 * @param app - The running app, to read the stored activity.
 * @param player - The started player frame.
 * @param contentId - The activity.
 * @returns How many options were picked.
 * @throws Error when the activity shuffles its options or has no right one.
 */
export async function answerMultiChoiceRight(
  app: RealWebApp,
  player: Frame,
  contentId: string,
): Promise<number> {
  const { params } = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: contentId } });
  const stored = params as { answers: { correct?: boolean }[]; behaviour?: { randomAnswers?: boolean } };
  if (stored.behaviour?.randomAnswers !== false)
    throw new Error('the activity must keep its options in order');
  const right = stored.answers.flatMap((answer, index) => (answer.correct ? [index] : []));
  if (right.length === 0) throw new Error('the activity has no right option');
  await player.locator('.h5p-answer').first().waitFor();
  for (const index of right) await player.locator('.h5p-answer').nth(index).click();
  await player.locator('.h5p-question-check-answer:visible').click();
  return right.length;
}

/**
 * The grade worker as main.ts builds it, for one `runOnce(now)`.
 * @param app - The running app.
 * @param placementIds - Only these placements' jobs, so the flow never sends another test's leftovers.
 * @returns The worker; it is never started, so it holds no timer.
 */
export function gradeWorkerOf(app: RealWebApp, placementIds: readonly string[]): GradeSyncWorker {
  const { db, redis, env, lti } = app.tb;
  return new GradeSyncWorker({
    db,
    redis,
    logger: capturedLogger('debug').logger,
    encryption: new DataEncryption(env.DATA_ENCRYPTION_KEYS),
    platforms: lti.provider.platformManager,
    placementIds,
  });
}
