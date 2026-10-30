/**
 * xapiBatching — the xAPI bridge's batch rules: how much one request may carry, what the server's answer means for
 * the batch, and how long the bridge pauses before it tries again.
 *
 * Why: D-115 limits a batch to 50 items and 60 000 bytes of JSON, so that the `pagehide` flush fits the 64 KiB a
 *      browser lets `keepalive` requests carry, and the server refuses a larger body (413). It retries a batch only
 *      when the server did not take it for a reason that can pass (a network error, a 5xx, a 429 with `Retry-After`)
 *      and drops one refused for any other reason, which a retry would only repeat (D-115). These rules are pure, so
 *      they are tested apart from the bridge's timers.
 * Spec: LTI-010
 * Invariants:
 *   - Sizes are the UTF-8 length of the JSON text, which is what the browser and the server count.
 *   - A batch is the longest head of the queue within both limits; an item that alone exceeds them never fits.
 *   - The answer is read from the status (and `Retry-After`) alone, never from the body: Canvas-like 401s and the
 *     server's refusals say nothing a retry could change (trap (a) of step 3).
 *   - A pause is counted in ticks of 2 s, at most 30 ticks after failures and 150 after a `Retry-After`.
 *   - Pure: reads only its arguments, never throws on them. Defined once per window as a read-only global.
 * Collaborators: ./xapiBridge.js (the only reader; loaded right before it), apps/server/src/h5p/h5pAssets.ts,
 *   packages/api-contract/src/xapi.ts (`XAPI_BATCH_MAX_STATEMENTS`, `XAPI_BRIDGE_BATCH_BYTES`).
 * Tests: packages/hvl-h5p-theme/test/xapiBatching.test.ts
 */
(function hvlXapiBatching() {
  'use strict';
  if (window.hvliXapiBatching) return;

  var TICK_MS = 2000;
  var MAX_ITEMS = 50;
  var MAX_BYTES = 60000;
  var MAX_BACKOFF_TICKS = 30;
  var MAX_PAUSE_TICKS = 150;

  /** UTF-8 length of JSON text; JSON.stringify never leaves a lone surrogate, so each high one starts a pair. */
  function utf8Bytes(text) {
    var bytes = 0;
    for (var i = 0; i < text.length; i += 1) {
      var code = text.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        bytes += 4;
        i += 1;
      } else {
        bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
      }
    }
    return bytes;
  }

  /** A value with the size of its JSON, as the queue keeps each item. */
  function sized(value) {
    return { value: value, bytes: utf8Bytes(JSON.stringify(value)) };
  }

  /**
   * How many entries from the head of `entries` fit one batch whose envelope (with an empty list) has
   * `envelopeBytes`: each item adds its own bytes and a comma after the first.
   */
  function fitting(entries, envelopeBytes) {
    var count = 0;
    var bytes = envelopeBytes;
    while (count < entries.length && count < MAX_ITEMS) {
      var next = bytes + entries[count].bytes + (count > 0 ? 1 : 0);
      if (next > MAX_BYTES) break;
      bytes = next;
      count += 1;
    }
    return count;
  }

  /** The pause after `failures` failed tries in a row: 0, 1, 3, 7 … ticks, at most 30 (about a minute). */
  function backoff(failures) {
    return Math.min(MAX_BACKOFF_TICKS, Math.pow(2, Math.max(0, failures - 1)) - 1);
  }

  /**
   * What an answer means for its batch: `{ retry: false }` when it is settled (taken, or refused for good),
   * `{ retry: true }` when it goes back to the queue, with `pause` ticks when a 429 said how long to wait.
   * `status` is null for a network error.
   */
  function outcome(status, retryAfter) {
    if (status === null) return { retry: true };
    if (status !== 429) return { retry: status >= 500 };
    var seconds = Number(retryAfter === null || retryAfter === undefined ? NaN : retryAfter);
    if (!Number.isFinite(seconds) || seconds < 0) return { retry: true };
    // WHY: the next try comes at tick `pause + 1`, which must be no earlier than `Retry-After`.
    var ticks = Math.ceil((seconds * 1000) / TICK_MS) - 1;
    return { retry: true, pause: Math.min(MAX_PAUSE_TICKS, Math.max(0, ticks)) };
  }

  Object.defineProperty(window, 'hvliXapiBatching', {
    value: Object.freeze({
      TICK_MS: TICK_MS,
      MAX_ITEMS: MAX_ITEMS,
      MAX_BYTES: MAX_BYTES,
      utf8Bytes: utf8Bytes,
      sized: sized,
      fitting: fitting,
      backoff: backoff,
      outcome: outcome,
    }),
  });
})();
