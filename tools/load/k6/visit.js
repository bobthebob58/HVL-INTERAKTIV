/**
 * visit — k6's entry script for NFR-001: a virtual user is one learner in one Canvas course, and one iteration is one
 * visit: the LTI launch and the player page, the root `attempted` the page sends on opening, `rounds` answers (each
 * an xAPI batch and a learner-state save, after a think time), and the root `completed` with the total.
 *
 * Why: NFR-001 asks for "a k6 or Artillery load test script in `tools/load/`"; D-114's load amendment of 2026-11-05
 *      fixes the model and the thresholds (./loadProfiles.js). The requests are those the bridge and H5P send
 *      (./xapiBatches.js), so the server does under load what it does for a learner.
 * Spec: NFR-001
 * Invariants:
 *   - Its only settings are `HVLI_LOAD_PROFILE` (`smoke` or `full`), `HVLI_LOAD_ADDRESSES` (the bench's file) and
 *     `HVLI_LOAD_OUT` (the output folder); it loads nothing at run time beyond k6's built-in modules.
 *   - SECURITY: the ltik lives only in this virtual user's memory and travels as on a real page (the landing query,
 *     `Authorization: Bearer` for the bridge, H5P's state URL); it is never logged, tagged or written (LTI-003).
 *   - `handleSummary` writes `summary.json` and `summary.txt` into the output folder and the text to standard output.
 * Collaborators: ./launchSteps.js, ./playerPages.js, ./xapiBatches.js, ./loadProfiles.js, ./loadSummary.js,
 *   ../runLoad.mjs (runs it in the pinned k6 image).
 * Tests: tools/load/test/loadProfiles.test.mjs, tools/load/test/loadBench.test.mjs (one visit in Node), the smoke
 */
/* global __ENV, open */
import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Trend } from 'k6/metrics';
import { launchAndOpen } from './launchSteps.js';
import { k6Options, profileOf } from './loadProfiles.js';
import { loadSummaryText } from './loadSummary.js';
import { playerContext } from './playerPages.js';
import {
  answeredBatch,
  attemptedBatch,
  completedBatch,
  stateSaveForm,
  uuidFromBytes,
} from './xapiBatches.js';

const PROFILE = __ENV.HVLI_LOAD_PROFILE;
const OUT = __ENV.HVLI_LOAD_OUT || '/out';
const profile = profileOf(PROFILE);
const addresses = JSON.parse(open(__ENV.HVLI_LOAD_ADDRESSES));

/** k6's options for the chosen profile. */
export const options = k6Options(PROFILE);

const playerReady = new Trend('hvli_player_ready', true);
const launchTime = new Trend('hvli_launch', true);
const visitBytes = new Trend('hvli_visit_bytes');

const newUuid = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : uuidFromBytes(crypto.getRandomValues(new Uint8Array(16)));

const think = () => {
  const [low, high] = profile.thinkSeconds;
  sleep(low + Math.random() * (high - low));
};

/**
 * Posts one xAPI batch as the bridge does.
 * @param {object} page - The player page's context.
 * @param {string} ltik - The launch's ltik.
 * @param {object} batch - The body.
 */
function postBatch(page, ltik, batch) {
  const res = http.post(`${addresses.toolUrl}${page.endpoint}`, JSON.stringify(batch), {
    headers: { Authorization: `Bearer ${ltik}`, 'Content-Type': 'application/json' },
    tags: { name: 'xapi', kind: 'api' },
    redirects: 0,
  });
  check(res, { 'the xAPI batch is accepted (202)': (r) => r.status === 202 });
}

/**
 * Saves the learner's state as H5P does (its state URL carries the ltik, D-058).
 * @param {object} page - The player page's context.
 * @param {number} answered - Questions answered so far.
 */
function saveState(page, answered) {
  const res = http.post(
    `${addresses.toolUrl}${page.stateUrl}`,
    stateSaveForm(answered, page.questions.length),
    {
      tags: { name: 'state', kind: 'api' },
      redirects: 0,
    },
  );
  check(res, {
    'the learner state is saved': (r) => r.status === 200 && String(r.body).includes('"success":true'),
  });
}

/** One visit. */
export default function visit() {
  const learner = addresses.learners[(exec.vu.idInTest - 1) % addresses.learners.length];
  const opened = launchAndOpen(learner, addresses.toolUrl);
  if (!opened) return sleep(1);
  playerReady.add(opened.readyMs);
  launchTime.add(opened.launchMs);
  visitBytes.add(opened.bytes);
  const page = playerContext(opened.html);
  if (!check(page, { 'the player page names its activity and questions': (p) => p?.questions.length > 0 })) {
    return sleep(1);
  }
  const view = { viewId: newUuid(), uuid: newUuid };
  const started = Date.now();
  postBatch(page, opened.ltik, attemptedBatch(page, view));
  const latest = new Map();
  for (let round = 0; round < profile.rounds; round += 1) {
    think();
    const question = page.questions[round % page.questions.length];
    const right = Math.random() < 0.7;
    latest.set(question.subContentId, right);
    postBatch(page, opened.ltik, answeredBatch(page, view, question, right));
    saveState(page, Math.min(round + 1, page.questions.length));
  }
  const raw = [...latest.values()].filter(Boolean).length;
  const total = { raw, max: page.questions.length, seconds: (Date.now() - started) / 1000 };
  postBatch(page, opened.ltik, completedBatch(page, view, total));
}

/**
 * Writes the run's summary files and prints its text.
 * @param {object} data - k6's end-of-test data.
 * @returns {Record<string, string>} Files and standard output.
 */
export function handleSummary(data) {
  const text = loadSummaryText(data, { profile: PROFILE, learners: profile.learners });
  return {
    [`${OUT}/summary.json`]: JSON.stringify(data, null, 2),
    [`${OUT}/summary.txt`]: text,
    stdout: text,
  };
}
