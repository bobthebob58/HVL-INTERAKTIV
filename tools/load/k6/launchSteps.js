/**
 * launchSteps — one learner's LTI launch and player page under k6, as a browser in the Canvas frame makes them: the
 * mock Canvas's login form, `POST /lti/login` (and the script its page names), the mock's authorization answer,
 * `POST /lti/launch` and ltijs's second post with the recovered state, then `/lti/play?ltik=…` with every script and
 * stylesheet it names, fetched like a browser with an empty cache.
 *
 * Why: NFR-001's "becomes interactive in ≤ 3 s" starts when the learner's browser reaches the tool; D-114's load
 *      amendment of 2026-11-05 measures from the tool's `/lti/login` to the last script or stylesheet, less the
 *      mock Canvas's answer, which a real Canvas gives in its own time. The steps are those of
 *      apps/server/test/support/ltiLaunchDriver.ts.
 * Spec: NFR-001, LTI-003
 * Invariants:
 *   - Every request has a fixed `name` and `kind` tag (`launch`, `page`, `asset`, `mock`); `url` is no system tag
 *     (./loadProfiles.js), so no URL with an ltik becomes a metric, a tag or a line of the summary.
 *   - Redirects are never followed by k6: the launch's redirect is read, and the player page fetched by name.
 *   - Within one visit each asset is fetched once, at most 6 at a time per host (`batchPerHost`).
 *   - SECURITY: the ltik is returned to the caller only; it is never logged or written (LTI-003).
 * Collaborators: ./playerPages.js, ./visit.js, k6/http.
 * Tests: tools/load/test/loadBench.test.mjs (the same steps in Node), the smoke run (docs/ops/runbook.md)
 */
import http from 'k6/http';
import { check } from 'k6';
import { autoPostForm, embeddedJson, pageAssets } from './playerPages.js';

const tagged = (name, kind, extra = {}) => ({ tags: { name, kind }, redirects: 0, ...extra });

const sizeOf = (res) =>
  Number(res.headers['Content-Length'] ?? 0) || (res.body ? String(res.body).length : 0);

/**
 * Fetches the same-origin assets of a page that this visit has not fetched yet.
 * @param {string} toolUrl - The tool's base URL.
 * @param {string} html - The page.
 * @param {Set<string>} fetched - Paths this visit fetched already; updated.
 * @returns {{ok: boolean, bytes: number}} Whether all answered 200, and their size.
 */
function fetchAssets(toolUrl, html, fetched) {
  const paths = pageAssets(html).filter((path) => !fetched.has(path));
  paths.forEach((path) => fetched.add(path));
  if (paths.length === 0) return { ok: true, bytes: 0 };
  const answers = http.batch(
    paths.map((path) => [
      'GET',
      `${toolUrl}${path}`,
      null,
      tagged('asset', 'asset', { responseType: 'none' }),
    ]),
  );
  return {
    ok: answers.every((res) => res.status === 200),
    bytes: answers.reduce((total, res) => total + sizeOf(res), 0),
  };
}

/**
 * Launches from the mock Canvas and opens the player page with its scripts and styles.
 * @param {string} frameUrl - The mock Canvas's course-frame URL of this learner.
 * @param {string} toolUrl - The tool's base URL.
 * @returns {{ltik: string, html: string, readyMs: number, launchMs: number, bytes: number} | undefined} The
 *   launch's ltik, the player page, the time to interactive and to the redirect (both less the mock's answer), and
 *   the bytes fetched; undefined when a step failed (its check is recorded).
 */
export function launchAndOpen(frameUrl, toolUrl) {
  const fetched = new Set();
  const frame = http.get(frameUrl, tagged('canvas-frame', 'mock'));
  const loginForm = autoPostForm(frame.body);
  if (!check(loginForm, { 'the mock Canvas offers a login form': (form) => form !== undefined }))
    return undefined;
  const started = Date.now();
  const login = http.post(loginForm.action, loginForm.fields, tagged('lti-login', 'launch'));
  const loginData = embeddedJson(login.body, 'ltijs-login-data');
  const loginAssets = fetchAssets(toolUrl, login.body, fetched);
  if (!check(loginData, { 'the tool answers the login': (data) => typeof data?.targetUrl === 'string' })) {
    return undefined;
  }
  const askedCanvas = Date.now();
  const authorized = http.get(loginData.targetUrl, tagged('canvas-authorize', 'mock'));
  const mockMs = Date.now() - askedCanvas;
  const launchForm = autoPostForm(authorized.body);
  if (!check(launchForm, { 'the mock Canvas authorizes': (form) => form?.fields.id_token !== undefined })) {
    return undefined;
  }
  let launched = http.post(launchForm.action, launchForm.fields, tagged('lti-launch', 'launch'));
  let bytes = sizeOf(login) + loginAssets.bytes;
  if (launched.status === 200) {
    // WHY: in Canvas's frame the tool's state cookie is third-party and blocked, so ltijs's page posts again.
    bytes += sizeOf(launched) + fetchAssets(toolUrl, launched.body, fetched).bytes;
    const recovered = { ...launchForm.fields, ltijs_recovered_state: loginData.recoveryToken ?? '' };
    launched = http.post(launchForm.action, recovered, tagged('lti-launch-recovered', 'launch'));
  }
  const location = launched.headers.Location ?? '';
  const ltik = /[?&]ltik=([^&]+)/.exec(location)?.[1];
  const launchMs = Date.now() - started - mockMs;
  if (!check(ltik, { 'the launch redirects to the player': (value) => value !== undefined }))
    return undefined;
  // WHY: ltijs redirects to a path; k6 has no WHATWG `URL` in every version, so the base is joined by hand.
  const playUrl = location.startsWith('/') ? `${toolUrl}${location}` : location;
  const page = http.get(playUrl, tagged('lti-play', 'page'));
  const pageAssetsLoaded = fetchAssets(toolUrl, page.body, fetched);
  const readyMs = Date.now() - started - mockMs;
  const loaded = check(page, {
    'the player page answers 200': (res) => res.status === 200,
    'every script and stylesheet answers 200': () => pageAssetsLoaded.ok && loginAssets.ok,
  });
  if (!loaded) return undefined;
  bytes += sizeOf(page) + pageAssetsLoaded.bytes;
  return { ltik: decodeURIComponent(ltik), html: String(page.body), readyMs, launchMs, bytes };
}
