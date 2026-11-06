/**
 * loadProfiles — NFR-001's load as k6 options: the full profile (200 learners on one node), the reduced smoke
 * profile, and the thresholds both must pass.
 *
 * Why: NFR-001 says an activity page becomes interactive in ≤ 3 s at p95 with 200 concurrent learners on one
 *      application node, and API p95 is ≤ 300 ms excluding file downloads. D-114's load amendment of 2026-11-05 turns
 *      that into two profiles with the same thresholds; the full run is HVL's, the smoke runs here and in review.
 * Spec: NFR-001
 * Invariants:
 *   - Pure: no k6 module is imported, so Node's tests read the same numbers k6 runs with.
 *   - Both profiles use `THRESHOLDS` unchanged; only the learners, the timing and the answers per visit differ.
 *   - `url` is not a system tag, so no URL (which can hold an ltik) becomes a tag of any metric (LTI-003).
 *   - k6's usage report is turned off by the runner's `--no-usage-report` (k6 2.3.0 has no option for it).
 * Collaborators: ./visit.js (exports `options` from `k6Options`), ../runLoad.mjs (the bench's learner count).
 * Tests: tools/load/test/loadProfiles.test.mjs
 */

/** NFR-001's numbers. */
export const NFR_001 = Object.freeze({ learners: 200, playerReadyP95Ms: 3000, apiP95Ms: 300 });

/** The thresholds every profile must pass (D-114). */
export const THRESHOLDS = Object.freeze({
  hvli_player_ready: [`p(95)<${NFR_001.playerReadyP95Ms}`],
  'http_req_duration{kind:api}': [`p(95)<${NFR_001.apiP95Ms}`],
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
});

/** Sub-metrics shown in the summary without a limit of their own. */
export const SHOWN = Object.freeze([
  'http_req_duration{name:lti-play}',
  'http_req_duration{name:xapi}',
  'http_req_duration{name:state}',
  'http_req_duration{kind:asset}',
  'http_req_duration{kind:launch}',
  'http_req_duration{kind:mock}',
]);

/**
 * The profiles. `learners` is also the number of launch addresses the bench writes.
 * @type {Readonly<Record<'smoke' | 'full', {learners: number, thinkSeconds: [number, number], rounds: number,
 *   scenario: object}>>}
 */
export const PROFILES = Object.freeze({
  smoke: Object.freeze({
    learners: 20,
    thinkSeconds: [2, 4],
    rounds: 4,
    scenario: { executor: 'constant-vus', vus: 20, duration: '30s', gracefulStop: '30s' },
  }),
  full: Object.freeze({
    learners: NFR_001.learners,
    thinkSeconds: [5, 15],
    rounds: 6,
    scenario: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '60s', target: NFR_001.learners },
        { duration: '10m', target: NFR_001.learners },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  }),
});

/** The tags k6 sets on every request: its defaults without `url` (SECURITY: an ltik rides in some URLs). */
export const SYSTEM_TAGS = Object.freeze([
  'proto',
  'subproto',
  'status',
  'method',
  'name',
  'group',
  'check',
  'error',
  'error_code',
  'tls_version',
  'scenario',
  'service',
  'expected_response',
]);

/**
 * The profile of a name.
 * @param {string | undefined} name - `smoke` or `full`.
 * @returns {(typeof PROFILES)['smoke']} The profile.
 * @throws {Error} For any other name.
 */
export function profileOf(name) {
  if (name !== 'smoke' && name !== 'full') throw new Error('HVLI_LOAD_PROFILE must be smoke or full');
  return PROFILES[name];
}

/**
 * The k6 options of a profile.
 * @param {string | undefined} name - `smoke` or `full`.
 * @returns {object} k6's `options`: one scenario `learners`, the thresholds, at most 6 connections per host.
 */
export function k6Options(name) {
  const profile = profileOf(name);
  const thresholds = { ...THRESHOLDS };
  for (const metric of SHOWN) thresholds[metric] = [];
  return {
    scenarios: { learners: { ...profile.scenario } },
    thresholds,
    // WHY: a browser opens at most 6 connections per host; the page's scripts and styles load that way.
    batchPerHost: 6,
    systemTags: [...SYSTEM_TAGS],
    summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max'],
  };
}
