/**
 * Tests for how the xAPI bridge sends (jsdom, with its 2-second timer and the server's answers driven by hand): the
 * request and its token header, one request in flight, batches of at most 50, a failed batch back at the head of the
 * queue, a refused one dropped, `Retry-After`, and the `pagehide` flush within the `keepalive` budget.
 *
 * Spec: LTI-010
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_ID, openBridgeDocument, portalConfig, statement } from './support/bridgeDocument.js';

const ids = (request: { body: { statements: Record<string, unknown>[] } } | undefined) =>
  (request?.body.statements ?? []).map((i) => String(i.statementId));
/** Opens the portal page and queues `count` root answers. */
function pageWith(count: number, config = portalConfig()) {
  const page = openBridgeDocument({ config });
  for (let i = 0; i < count; i += 1) page.dispatch(statement('answered'));
  return page;
}

describe('[LTI-010] how the bridge sends', () => {
  it('[LTI-010] posts on the tick, as JSON to the endpoint, with the CSRF token in the portal', async () => {
    // Arrange
    const page = pageWith(2);
    // Act
    const before = page.requests.length;
    page.tick();
    await page.settle();
    // Assert
    const [request] = page.requests;
    expect(before).toBe(0);
    expect(request?.url).toBe('/api/h5p/xapi');
    expect(request?.headers).toEqual({ 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-token-1' });
    expect([request?.credentials, request?.keepalive]).toEqual(['same-origin', false]);
    expect(request?.body).toMatchObject({ contentId: CONTENT_ID, contentVersion: 2 });
    expect(request?.body.statements).toHaveLength(2);
  });

  it('[LTI-010] in Canvas sends the ltik as Bearer, never in the URL', async () => {
    // Arrange
    const page = pageWith(1, { ...portalConfig(), token: { name: 'ltik', value: 'lt.ik.1' } });
    // Act
    page.tick();
    await page.settle();
    // Assert
    expect(page.requests[0]?.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer lt.ik.1',
    });
    expect(page.requests[0]?.url).not.toContain('lt.ik.1');
  });

  it('[LTI-010] keeps one request in flight and sends at most 50 items in each', async () => {
    // Arrange
    const page = pageWith(120);
    // Act
    page.tick();
    page.tick();
    const whileWaiting = page.requests.length;
    await page.answer(0, 202);
    page.tick();
    await page.answer(1, 202);
    page.tick();
    // Assert
    expect(whileWaiting).toBe(1);
    expect(page.requests.map((r) => r.body.statements.length)).toEqual([50, 50, 20]);
  });

  it.each([500, 503, 429, null])(
    '[LTI-010] puts a batch answered %s back at the head of the queue',
    async (status) => {
      // Arrange
      const page = pageWith(2);
      page.tick();
      // Act
      await page.answer(0, status);
      page.dispatch(statement('answered'));
      page.tick();
      // Assert
      expect(ids(page.requests[1]).slice(0, 2)).toEqual(ids(page.requests[0]));
      expect(page.requests[1]?.body.statements).toHaveLength(3);
    },
  );

  it.each([400, 401, 403, 404, 413])('[LTI-010] drops a batch refused with %s', async (status) => {
    // Arrange
    const page = pageWith(2);
    page.tick();
    // Act
    await page.answer(0, status);
    page.tick();
    // Assert
    expect(page.requests).toHaveLength(1);
  });

  it('[LTI-010] waits as long as Retry-After says, and longer after each failure in a row', async () => {
    // Arrange
    const page = pageWith(1);
    page.tick();
    // Act: a 429 with 7 s pauses three ticks; then two 500s in a row (the 2nd and 3rd failures) one and three
    await page.answer(0, 429, '7');
    const after429 = [1, 2, 3, 4].map(() => (page.tick(), page.requests.length));
    await page.answer(1, 500);
    const afterSecond = [1, 2].map(() => (page.tick(), page.requests.length));
    await page.answer(2, 500);
    const afterThird = [1, 2, 3, 4].map(() => (page.tick(), page.requests.length));
    // Assert
    expect(after429).toEqual([1, 1, 1, 2]);
    expect(afterSecond).toEqual([2, 3]);
    expect(afterThird).toEqual([3, 3, 3, 4]);
  });

  it('[LTI-010] on pagehide sends everything unacknowledged in one keepalive request, oldest first', async () => {
    // Arrange: 10 in flight, 5 more queued
    const page = pageWith(10);
    page.tick();
    for (let i = 0; i < 5; i += 1) page.dispatch(statement('answered'));
    // Act
    page.pagehide();
    await page.answer(0, 503);
    page.tick();
    // Assert: the late answer of the request pagehide took over is not retried
    const [regular, flush] = page.requests;
    expect(page.requests).toHaveLength(2);
    expect(flush?.keepalive).toBe(true);
    expect(ids(flush).slice(0, 10)).toEqual(ids(regular));
    expect(flush?.body.statements).toHaveLength(15);
  });

  it('[LTI-010] keeps the pagehide flush within 50 items and 60 000 bytes, so it fits the 64 KiB budget', () => {
    // Arrange: answers of nine 100-character gaps (908 characters, under the 1 000 cap) make items of about 2 KB
    const page = openBridgeDocument();
    const gaps = Array(9).fill('å'.repeat(100)).join('[,]');
    const definition = { interactionType: 'fill-in' };
    for (let i = 0; i < 80; i += 1)
      page.dispatch(
        statement('answered', { object: { id: CONTENT_ID, definition }, result: { response: gaps } }),
      );
    // Act
    page.pagehide();
    // Assert
    const [flush] = page.requests;
    expect(flush?.keepalive).toBe(true);
    expect(flush?.bytes).toBeLessThanOrEqual(60_000);
    expect(flush?.body.statements.length).toBeLessThan(50);
    expect(flush?.bytes).toBeGreaterThan(60_000 - 2_200);
  });

  it('[LTI-010] keeps everything in page memory: no storage, cookies, eval, console or markup', () => {
    for (const name of ['xapiBridge.js', 'xapiBatching.js', 'xapiStatements.js']) {
      const code = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(code, name).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|sendBeacon/);
      expect(code, name).not.toMatch(/\beval\s*\(|new Function|innerHTML|insertAdjacentHTML|console\./);
    }
  });
});
