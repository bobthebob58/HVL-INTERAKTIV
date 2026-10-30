/**
 * xapiBridge — sends a learner's xAPI statements from the H5P player page to the server in small batches, each with
 * its own statement ID and attempt ID, without ever delaying the activity.
 *
 * Why: LTI-010 captures H5P's statements for the grade bridge (LTI-012) and insight (INS-*). D-102 runs the bridge in
 *      the player document that holds `H5PIntegration`, where H5P Core also relays the events of its own iframes, and
 *      only for learners; D-115 fixes how it finds that document, what it sends (./xapiStatements.js), the IDs it adds
 *      (H5P marks no attempts) and how it batches (./xapiBatching.js).
 * Spec: LTI-010, H5P-009
 * Invariants:
 *   - Starts once, while it is evaluated, and only in a document that is not one of Core's iframes (whose
 *     `frameElement` has the class `h5p-iframe`) and that has its configuration (the inert JSON block
 *     `#hvl-xapi-bridge`, rendered only for a learner, D-102); otherwise it does nothing. At event time it ignores an
 *     event that `H5P.isFramed && H5P.externalEmbed === false` marks as raised in a Core iframe.
 *   - It sends the first root `attempted` of the page load, every `answered` and a root `completed`, each queued once
 *     with a `statementId` (`crypto.randomUUID()`) and an `attemptId` `<viewId>:<n>`; `n` goes up right after a root
 *     result whose `score.max` is above 0 (D-115).
 *   - Every 2 s at most one batch and one request in flight; a batch the server did not take for a passing reason goes
 *     back to the head of the queue. On `pagehide` everything not acknowledged, the request in flight included, goes
 *     in one `keepalive` request, oldest first, within the same limits (D-102 accepts the loss of a larger tail).
 *   - SECURITY: the token goes only into a header of a same-origin request to the configured path: the ltik as
 *     `Authorization: Bearer` in Canvas, the CSRF token as `X-CSRF-Token` in the portal (LTI-003, D-057); never into
 *     a URL, a log or browser storage. The queue lives in page memory only.
 *   - PRIVACY: no actor, text or answer beyond D-115's cut leaves the page (DATA-012); the server takes the learner
 *     from the request (D-102). Silent for the learner: no UI, no console output, nothing it does throws into H5P.
 * SPEC-DEVIATION: D-102 — LTI-010's bridge is plain JavaScript in the player document, not inside H5P's iframe
 *   (H5P-009); D-115 — it sends only what the server stores, with its own statement and attempt IDs.
 * Collaborators: ./xapiStatements.js, ./xapiBatching.js, apps/server/src/h5p/h5pAssets.ts (the last player scripts,
 *   never the editor's), apps/server/src/h5p/render/xapiBridgeConfig.ts (the configuration), `POST /api/h5p/xapi`.
 * Tests: packages/hvl-h5p-theme/test/xapiBridge.test.ts, packages/hvl-h5p-theme/test/xapiBridgeSending.test.ts,
 *   apps/server/test/h5p/xapiBridge.browser.int.test.ts
 */
(function hvlXapiBridge() {
  'use strict';
  var MAX_QUEUE = 1000;
  var SAME_ORIGIN_PATH = /^\/(?![/\\])/;

  var frame;
  try {
    frame = window.frameElement;
  } catch {
    // WHY: an old browser throws for a cross-origin parent (Canvas); that parent is no Core iframe either.
  }
  // WHY: in a Core iframe the parent's bridge sees every event H5P relays, so a second copy would send it twice.
  if (frame && frame.classList && frame.classList.contains('h5p-iframe')) return;
  if (window.hvliXapiBridgeStarted) return;
  var rules = window.hvliXapiStatements;
  var batching = window.hvliXapiBatching;
  var h5p = window.H5P;
  var dispatcher = h5p && h5p.externalDispatcher;
  var crypto = window.crypto;
  var config = readConfig();
  if (!config || !rules || !batching || !dispatcher || typeof dispatcher.on !== 'function') return;
  // WHY: randomUUID exists in every secure context, which the player always is in production (HTTPS).
  if (!crypto || typeof crypto.randomUUID !== 'function') return;
  window.hvliXapiBridgeStarted = true;

  var integration = window.H5PIntegration;
  var content = integration && integration.contents && integration.contents['cid-' + config.contentId];
  var mainLibrary = content && content.library;
  var viewId = crypto.randomUUID();
  var attempt = 1;
  var rootAttemptedSent = false;
  var queue = [];
  var inFlight = null;
  var pauseTicks = 0;
  var failures = 0;
  var envelopeBytes = batching.sized(envelope([])).bytes;

  /** The configuration block, or null when it is missing, unreadable or names anything but a same-origin path. */
  function readConfig() {
    var block = document.getElementById('hvl-xapi-bridge');
    var parsed;
    try {
      parsed = block ? JSON.parse(block.textContent || '') : null;
    } catch {
      return null;
    }
    var valid =
      parsed &&
      typeof parsed.endpoint === 'string' &&
      SAME_ORIGIN_PATH.test(parsed.endpoint) &&
      typeof parsed.contentId === 'string' &&
      Number.isInteger(parsed.contentVersion) &&
      parsed.contentVersion >= 1;
    return valid ? parsed : null;
  }

  function envelope(items) {
    return { contentId: config.contentId, contentVersion: config.contentVersion, statements: items };
  }

  /** Whether the bridge sends this statement (D-115); remembers the page load's first root `attempted`. */
  function keep(statement) {
    var verb = rules.verbOf(statement);
    if (verb === 'answered') return true;
    var root = rules.isRoot(statement, config.contentId);
    if (verb === 'completed') return root;
    if (verb !== 'attempted' || !root || rootAttemptedSent) return false;
    rootAttemptedSent = true;
    return true;
  }

  function onXapi(event) {
    try {
      // WHY: H5P marks its own iframes so; their events reach the parent document's bridge, which sends them (D-115).
      if (h5p.isFramed && h5p.externalEmbed === false) return;
      var statement = event && event.data && event.data.statement;
      if (!keep(statement)) return;
      var item = rules.cut(statement);
      item.statementId = crypto.randomUUID();
      item.attemptId = viewId + ':' + attempt;
      var entry = batching.sized(item);
      // WHY: an item that alone overflows a batch can never be sent; a full queue means the server is away.
      if (batching.fitting([entry], envelopeBytes) === 1 && queue.length < MAX_QUEUE) queue.push(entry);
      if (rules.isGradable(statement, config.contentId, mainLibrary)) attempt += 1;
    } catch {
      // WHY: a statement the bridge cannot read is not sent; H5P never sees the bridge's errors (LTI-010).
    }
  }

  /** Posts entries; resolves with what ./xapiBatching.js makes of the answer. Never rejects. */
  function post(entries, keepalive) {
    var headers = { 'Content-Type': 'application/json' };
    var token = config.token;
    // SECURITY: the request's own token, in a header of a same-origin request only (LTI-003, D-057, D-102).
    if (token && token.name === 'ltik') headers.Authorization = 'Bearer ' + token.value;
    if (token && token.name === 'csrf') headers['X-CSRF-Token'] = token.value;
    var body = JSON.stringify(envelope(entries.map((entry) => entry.value)));
    var init = {
      method: 'POST',
      headers: headers,
      body: body,
      credentials: 'same-origin',
      keepalive: keepalive,
    };
    try {
      return window.fetch(config.endpoint, init).then(
        (response) => batching.outcome(response.status, response.headers.get('Retry-After')),
        () => batching.outcome(null, null),
      );
    } catch {
      // WHY: a browser that cannot make the request at all (no fetch) would fail the same way again; drop it.
      return Promise.resolve({ retry: false });
    }
  }

  function settle(entries, result) {
    if (!result.retry) {
      failures = 0;
      return;
    }
    queue = entries.concat(queue);
    failures += 1;
    pauseTicks = result.pause !== undefined ? result.pause : batching.backoff(failures);
  }

  function tick() {
    if (pauseTicks > 0) {
      pauseTicks -= 1;
      return;
    }
    if (inFlight || queue.length === 0) return;
    var batch = queue.splice(0, batching.fitting(queue, envelopeBytes));
    inFlight = batch;
    post(batch, false).then((result) => {
      // WHY: `pagehide` took this batch into its own request; the server stores a statement ID once (D-115).
      if (inFlight !== batch) return;
      inFlight = null;
      settle(batch, result);
    });
  }

  function onPageHide() {
    var pending = (inFlight || []).concat(queue);
    inFlight = null;
    var batch = pending.slice(0, batching.fitting(pending, envelopeBytes));
    // WHY: a page restored from the back-forward cache sends the rest later; a page that unloads loses it (D-102).
    queue = pending.slice(batch.length);
    if (batch.length > 0)
      post(batch, true).then((result) => {
        if (result.retry) queue = batch.concat(queue);
      });
  }

  dispatcher.on('xAPI', onXapi);
  window.setInterval(tick, batching.TICK_MS);
  window.addEventListener('pagehide', onPageHide);
})();
