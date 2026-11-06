/**
 * Tests for the bridge's batch rules: sizes count UTF-8 bytes as the browser does, a batch is the longest head of the
 * queue within 50 items and 60 000 bytes (the contract's limits), the server's answer is read from its status alone,
 * and the pause after failures grows to about a minute.
 *
 * Spec: LTI-010
 */
import { XAPI_BATCH_MAX_STATEMENTS, XAPI_BRIDGE_BATCH_BYTES } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import { openBridgeDocument } from './support/bridgeDocument.js';

interface Batching {
  TICK_MS: number;
  MAX_ITEMS: number;
  MAX_BYTES: number;
  utf8Bytes(text: string): number;
  sized(value: unknown): { value: unknown; bytes: number };
  fitting(entries: { bytes: number }[], envelopeBytes: number): number;
  backoff(failures: number): number;
  outcome(status: number | null, retryAfter: string | null): { retry: boolean; pause?: number };
}
const batching = (
  openBridgeDocument({ config: null }).dom.window as unknown as { hvliXapiBatching: Batching }
).hvliXapiBatching;
const entries = (count: number, bytes: number) => Array.from({ length: count }, () => ({ bytes }));

describe('[LTI-010] the bridge’s batch rules', () => {
  it('[LTI-010] uses the contract’s limits and a 2-second tick', () => {
    expect([batching.MAX_ITEMS, batching.MAX_BYTES, batching.TICK_MS]).toEqual([
      XAPI_BATCH_MAX_STATEMENTS,
      XAPI_BRIDGE_BATCH_BYTES,
      2000,
    ]);
  });

  it.each(['ascii', 'æøå', '中文', '😀 and 👩‍👩‍👧', JSON.stringify({ a: ' "\\' })])(
    '[LTI-010] counts %s in UTF-8 bytes, as the request body will carry it',
    (text) => {
      expect(batching.utf8Bytes(text)).toBe(Buffer.byteLength(text, 'utf8'));
      expect(batching.sized({ text }).bytes).toBe(Buffer.byteLength(JSON.stringify({ text }), 'utf8'));
    },
  );

  it('[LTI-010] takes at most 50 items, and no more bytes than 60 000 with the envelope and commas', () => {
    expect(batching.fitting(entries(80, 10), 100)).toBe(50);
    expect(batching.fitting(entries(10, 1000), 59_000)).toBe(1);
    // WHY: 100 + 46 × 1 300 + 45 commas = 59 945 bytes; the 47th item would need 1 301 more.
    expect(batching.fitting(entries(60, 1300), 100)).toBe(46);
    expect(batching.fitting([{ bytes: 60_001 }, { bytes: 1 }], 0)).toBe(0);
    expect(batching.fitting([], 100)).toBe(0);
  });

  it.each([
    [202, null, { retry: false }],
    [200, null, { retry: false }],
    [400, null, { retry: false }],
    [401, null, { retry: false }],
    [403, null, { retry: false }],
    [404, null, { retry: false }],
    [413, null, { retry: false }],
    [500, null, { retry: true }],
    [503, '30', { retry: true }],
    [null, null, { retry: true }],
    [429, '7', { retry: true, pause: 3 }],
    [429, '0', { retry: true, pause: 0 }],
    [429, '86400', { retry: true, pause: 150 }],
    [429, null, { retry: true }],
    [429, 'Wed, 21 Oct 2026 07:28:00 GMT', { retry: true }],
  ] as const)(
    '[LTI-010] answer %s (Retry-After %s) means %o for the batch',
    (status, retryAfter, expected) => {
      expect(batching.outcome(status, retryAfter)).toEqual(expected);
    },
  );

  it('[LTI-010] pauses 0, 1, 3, 7 … ticks after failures in a row, at most 30', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 20].map(batching.backoff)).toEqual([0, 1, 3, 7, 15, 30, 30, 30]);
  });
});
