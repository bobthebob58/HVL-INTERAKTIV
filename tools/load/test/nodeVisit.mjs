/**
 * nodeVisit — one visit of the load model made with Node's `fetch` and the same page readers and request builders
 * the k6 script uses, so a test can prove them against the real bench without k6.
 *
 * Why: k6 runs only in its container (D-114), while the readers (../k6/playerPages.js) and the bodies
 *      (../k6/xapiBatches.js) must be shown to work on the real tool's pages and routes (NFR-001); the steps are those
 *      of ../k6/launchSteps.js and ../k6/visit.js.
 * Spec: NFR-001
 * Invariants:
 *   - Redirects are never followed; the ltik stays in this function's result and is never printed.
 *   - Every step's status is returned, so the test asserts each one.
 * Collaborators: ../k6/playerPages.js, ../k6/xapiBatches.js, ./loadBench.test.mjs.
 * Tests: tools/load/test/loadBench.test.mjs
 */
import { randomUUID } from 'node:crypto';
import { autoPostForm, embeddedJson, pageAssets, playerContext } from '../k6/playerPages.js';
import { answeredBatch, attemptedBatch, completedBatch, stateSaveForm } from '../k6/xapiBatches.js';

const post = (url, fields) =>
  fetch(url, { method: 'POST', body: new URLSearchParams(fields), redirect: 'manual' });

/**
 * Launches one learner and opens the player page with its assets.
 * @param {string} frameUrl - The mock Canvas's course-frame URL.
 * @param {string} toolUrl - The tool's base URL.
 * @returns {Promise<{ltik?: string, html: string, pageStatus: number, assetStatuses: number[]}>} What it got.
 */
export async function launchInNode(frameUrl, toolUrl) {
  const loginForm = autoPostForm(await (await fetch(frameUrl)).text());
  const loginData = embeddedJson(
    await (await post(loginForm.action, loginForm.fields)).text(),
    'ltijs-login-data',
  );
  const launchForm = autoPostForm(await (await fetch(loginData.targetUrl)).text());
  let launched = await post(launchForm.action, launchForm.fields);
  if (launched.status === 200) {
    launched = await post(launchForm.action, {
      ...launchForm.fields,
      ltijs_recovered_state: loginData.recoveryToken,
    });
  }
  const location = launched.headers.get('location') ?? '';
  const page = await fetch(`${toolUrl}${location}`, { redirect: 'manual' });
  const html = await page.text();
  const assetStatuses = await Promise.all(
    pageAssets(html).map(async (path) => (await fetch(`${toolUrl}${path}`)).status),
  );
  return { ltik: /[?&]ltik=([^&]+)/.exec(location)?.[1], html, pageStatus: page.status, assetStatuses };
}

/**
 * The rest of a visit: the opening batch, `rounds` answers with state saves, and the total.
 * @param {string} toolUrl - The tool's base URL.
 * @param {{ltik: string, html: string}} opened - From `launchInNode`.
 * @param {number} rounds - How many answers.
 * @returns {Promise<{batchStatuses: number[], stateAnswers: object[], stateReadBack: object}>} The answers.
 */
export async function useActivityInNode(toolUrl, opened, rounds) {
  const page = playerContext(opened.html);
  const view = { viewId: randomUUID(), uuid: randomUUID };
  const send = async (batch) =>
    (
      await fetch(`${toolUrl}${page.endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${opened.ltik}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      })
    ).status;
  const batchStatuses = [await send(attemptedBatch(page, view))];
  const stateAnswers = [];
  for (let round = 0; round < rounds; round += 1) {
    batchStatuses.push(await send(answeredBatch(page, view, page.questions[round], true)));
    stateAnswers.push(
      await (
        await post(`${toolUrl}${page.stateUrl}`, stateSaveForm(round + 1, page.questions.length))
      ).json(),
    );
  }
  batchStatuses.push(
    await send(completedBatch(page, view, { raw: rounds, max: page.questions.length, seconds: 9 })),
  );
  const stateReadBack = await (await fetch(`${toolUrl}${page.stateUrl}`)).json();
  return { batchStatuses, stateAnswers, stateReadBack };
}
