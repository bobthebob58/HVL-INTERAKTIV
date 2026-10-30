/**
 * xapiBridgeEndpoint — a test endpoint at `POST /api/h5p/xapi` on the real-types server that records each batch the
 * player's xAPI bridge sends, and helpers that read the recorded items, read the bridge's facts from a player
 * document and open the player in H5P's iframe mode.
 *
 * Why: the bridge's browser test (LTI-010) proves what arrives at the server from the real player, independently of
 *      the ingestion route that step 3 builds in parallel; it records every request as received, so duplicates and
 *      missing statements show, with the headers that carry the token and the test person.
 * Spec: LTI-010, H5P-009
 * Invariants:
 *   - The endpoint answers 202 with no body, as LTI-011's route does, and stores nothing but this list.
 *   - The iframe mode only changes the player page's content container into H5P's own `<iframe class="h5p-iframe">`
 *     (which the production policy allows, D-115); headers, scripts and the integration stay as the server sent them.
 * Collaborators: ../../support/realTypesPlayer.ts, ../../support/httpTestbed.ts, playwright-core.
 * Tests: ../xapiBridge.browser.int.test.ts
 */
import express from 'express';
import type { BrowserContext, Frame } from 'playwright-core';
import { expect } from 'vitest';
import type { TestActor } from '../../support/httpTestbed.js';
import type { RealTypesServer } from '../../support/realTypesPlayer.js';

/** One item of a batch, as the bridge sent it. */
export type SentItem = Record<string, unknown> & { statementId: string; attemptId: string };

/** One request the endpoint received. */
export interface ReceivedBatch {
  /** The `x-test-actor` header: whose page sent it. */
  readonly actor: string;
  readonly headers: Record<string, string | undefined>;
  readonly body: { contentId: string; contentVersion: number; statements: SentItem[] };
}

/**
 * Adds the recording endpoint to the server's app.
 * @param server - From `openRealTypesServer`, listening.
 * @returns The list the endpoint appends to, in arrival order.
 */
export function recordXapiBatches(server: RealTypesServer): ReceivedBatch[] {
  const received: ReceivedBatch[] = [];
  server.tb.app.post('/api/h5p/xapi', express.json({ limit: '64kb' }), (req, res) => {
    const header = (name: string) => (typeof req.headers[name] === 'string' ? req.headers[name] : undefined);
    received.push({
      actor: header('x-test-actor') ?? '',
      headers: {
        authorization: header('authorization'),
        csrf: header('x-csrf-token'),
        contentType: header('content-type'),
      },
      body: req.body as ReceivedBatch['body'],
    });
    res.status(202).end();
  });
  return received;
}

/**
 * The items one person's pages sent, in arrival order.
 * @param received - From `recordXapiBatches`.
 * @param actor - The test person.
 * @returns Every item of every batch from that person.
 */
export const itemsFrom = (received: readonly ReceivedBatch[], actor: TestActor): SentItem[] =>
  received.filter((batch) => batch.actor === actor.header[1]).flatMap((batch) => batch.body.statements);

/**
 * Waits until one person's pages have sent `count` distinct statements (the bridge sends every 2 s).
 * @param received - From `recordXapiBatches`.
 * @param actor - The test person.
 * @param count - How many distinct statement IDs to wait for.
 */
export async function waitForStatements(
  received: readonly ReceivedBatch[],
  actor: TestActor,
  count: number,
): Promise<void> {
  const distinct = () => new Set(itemsFrom(received, actor).map((item) => item.statementId)).size;
  await expect.poll(distinct, { timeout: 15_000, message: `waited for ${count} statements` }).toBe(count);
}

/**
 * Each item as `verb root|sub n`: the verb, whether it is about the activity, and its attempt number.
 * @param items - Sent items.
 * @param contentId - The activity.
 * @returns One line per item.
 */
export const describeItems = (items: readonly SentItem[], contentId: string): string[] =>
  items.map((item) => {
    const verb = String((item.verb as { id: string }).id)
      .split('/')
      .pop();
    const where = (item.object as { id: string }).id === contentId ? 'root' : 'sub';
    return `${verb} ${where} ${item.attemptId.split(':')[1]}`;
  });

/**
 * Makes the context's player pages embed the activity in H5P's own iframe instead of our div (D-115's iframe mode).
 * @param context - A browser context whose pages open `/h5p/play/…` directly.
 */
export async function useH5pIframeEmbedding(context: BrowserContext): Promise<void> {
  await context.route('**/h5p/play/*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      /<div class="h5p-content" data-content-id="([^"]+)"[^>]*><\/div>/,
      '<div class="h5p-iframe-wrapper"><iframe id="h5p-iframe-$1" class="h5p-iframe" data-content-id="$1" ' +
        'src="about:blank" title="Aktivitet" style="width:100%;height:600px;border:0"></iframe></div>',
    );
    await route.fulfill({ response, body });
  });
}

/**
 * Tells whether every statement ID arrived at most twice, and a second time only as an exact copy: what the
 * `pagehide` flush sends again of a batch still in flight (D-115).
 * @param items - Sent items.
 * @returns True when no statement was sent more than twice or changed between copies.
 */
export function resentAsExactCopies(items: readonly SentItem[]): boolean {
  const copies = new Map<string, string[]>();
  for (const item of items)
    copies.set(item.statementId, [...(copies.get(item.statementId) ?? []), JSON.stringify(item)]);
  return [...copies.values()].every((sent) => sent.length <= 2 && new Set(sent).size === 1);
}

/**
 * What a player document says about the bridge: whether it started, its configuration block and scripts (also in
 * `H5PIntegration.core.scripts`, which H5P copies into its iframes) and `reportingIsEnabled`.
 * @param frame - The player document's frame.
 * @returns The facts.
 */
export const bridgeFacts = (frame: Frame) =>
  frame.evaluate(() => {
    const w = window as unknown as {
      hvliXapiBridgeStarted?: boolean;
      H5PIntegration: { reportingIsEnabled?: boolean; core: { scripts: string[] } };
    };
    return {
      started: w.hvliXapiBridgeStarted === true,
      config: document.getElementById('hvl-xapi-bridge') !== null,
      scripts: [...document.scripts].filter((s) => /\/theme\/xapi/.test(s.src)).length,
      coreScripts: w.H5PIntegration.core.scripts.filter((src) => src.includes('/theme/xapi')).length,
      reporting: w.H5PIntegration.reportingIsEnabled,
    };
  });
