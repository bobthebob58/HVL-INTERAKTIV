/**
 * Tests for how the xAPI bridge recovers (jsdom, its timer and the server's answers driven by hand): a success ends the
 * pause after failures, a failed `pagehide` flush stays queued for a page restored from the back-forward cache, the
 * queue holds at most 1 000 statements while the server is away, and a statement too large for any batch is never
 * queued, so it can never block the ones behind it.
 *
 * Spec: LTI-010
 */
import { describe, expect, it } from 'vitest';
import { openBridgeDocument, statement } from './support/bridgeDocument.js';

const ids = (request: { body: { statements: Record<string, unknown>[] } } | undefined) =>
  (request?.body.statements ?? []).map((i) => String(i.statementId));

describe('[LTI-010] how the bridge recovers', () => {
  it('[LTI-010] a success clears the failures, so the next failure is retried at once again', async () => {
    // Arrange: a failure and its retry's success
    const page = openBridgeDocument();
    page.dispatch(statement('answered'));
    page.tick();
    await page.answer(0, 500);
    page.tick();
    await page.answer(1, 202);
    // Act: a new statement fails once
    page.dispatch(statement('answered'));
    page.tick();
    await page.answer(2, 500);
    page.tick();
    // Assert: a first failure pauses no tick (0, 1, 3 … counts failures in a row only)
    expect(page.requests).toHaveLength(4);
    expect(ids(page.requests[3])).toEqual(ids(page.requests[2]));
  });

  it.each([503, null])(
    '[LTI-010] keeps a pagehide flush answered %s, and sends it after the page is restored',
    async (status) => {
      // Arrange
      const page = openBridgeDocument();
      for (let i = 0; i < 3; i += 1) page.dispatch(statement('answered'));
      page.pagehide();
      // Act: the flush fails; the page comes back from the back-forward cache and its timer runs on
      await page.answer(0, status);
      page.tick();
      // Assert
      expect(page.requests.map((r) => r.keepalive)).toEqual([true, false]);
      expect(ids(page.requests[1])).toEqual(ids(page.requests[0]));
    },
  );

  it('[LTI-010] holds at most 1 000 statements while the server is away', async () => {
    // Arrange
    const page = openBridgeDocument();
    for (let i = 0; i < 1_010; i += 1) page.dispatch(statement('answered'));
    // Act: the server comes back and takes every batch
    for (let i = 0; i < 25; i += 1) {
      page.tick();
      await page.answer(i, 202);
    }
    // Assert
    const sent = page.requests.flatMap((r) => ids(r));
    expect(sent).toHaveLength(1_000);
    expect(new Set(sent).size).toBe(1_000);
  });

  it('[LTI-010] never queues a statement too large for any batch, so the next one is sent', async () => {
    // Arrange: an object ID that alone is over the 60 000-byte budget, then an ordinary answer
    const page = openBridgeDocument();
    page.dispatch(statement('answered', { object: { id: 'x'.repeat(61_000) } }));
    page.dispatch(statement('answered'));
    // Act
    page.tick();
    await page.answer(0, 202);
    page.tick();
    // Assert
    expect(page.requests).toHaveLength(1);
    expect(page.requests[0]?.body.statements).toHaveLength(1);
    expect(page.requests[0]?.bytes).toBeLessThan(2_000);
  });
});
