/**
 * loadSummary — the load run's own short text summary, built from k6's end-of-test data: each NFR-001 threshold with
 * its measured value and verdict, the shown sub-metrics, the visits, the checks and the bytes per visit.
 *
 * Why: D-114's load amendment of 2026-11-05 writes `summary.json` and this text from `handleSummary`, so no script
 *      loads a remote module at run time (k6's own summary helpers are one), and PROGRESS gets the real numbers.
 * Spec: NFR-001
 * Invariants:
 *   - Pure: reads only k6's summary object; a metric that is missing reads `–`, never throws.
 *   - Names metrics and tags only, never a URL (no URL is a tag, ./loadProfiles.js), so it holds no ltik.
 * Collaborators: ./visit.js (`handleSummary`), ./loadProfiles.js.
 * Tests: tools/load/test/loadSummary.test.mjs
 */
import { SHOWN, THRESHOLDS } from './loadProfiles.js';

const ms = (value) => (typeof value === 'number' ? `${Math.round(value)} ms` : '–');
const percent = (value) => (typeof value === 'number' ? `${(value * 100).toFixed(2)} %` : '–');

/**
 * The value a threshold expression is about, as k6 reports it.
 * @param {object | undefined} metric - One entry of `data.metrics`.
 * @param {string} expression - e.g. `p(95)<3000` or `rate<0.01`.
 * @returns {string} The measured value, formatted.
 */
function measured(metric, expression) {
  const stat = /^([a-z]+(?:\(\d+\))?)/.exec(expression)?.[1] ?? '';
  const value = metric?.values?.[stat];
  return metric?.type === 'rate' ? percent(value) : ms(value);
}

/**
 * The verdict lines of every threshold.
 * @param {object} data - k6's summary data.
 * @returns {{lines: string[], passed: boolean}} One line per threshold and whether all passed.
 */
export function thresholdLines(data) {
  const lines = [];
  let passed = true;
  for (const [name, expressions] of Object.entries(THRESHOLDS)) {
    const metric = data?.metrics?.[name];
    for (const expression of expressions) {
      const ok = metric?.thresholds?.[expression]?.ok === true;
      passed = passed && ok;
      lines.push(`  ${ok ? 'PASS' : 'FAIL'}  ${name} ${expression}: ${measured(metric, expression)}`);
    }
  }
  return { lines, passed };
}

/**
 * The text summary of a run.
 * @param {object} data - k6's summary data.
 * @param {{profile: string, learners: number}} run - The profile's name and its learners.
 * @returns {string} The summary, ending in a newline.
 */
export function loadSummaryText(data, run) {
  const metrics = data?.metrics ?? {};
  const value = (name, stat) => metrics[name]?.values?.[stat];
  const { lines, passed } = thresholdLines(data);
  const shown = SHOWN.map(
    (name) => `  ${name}: p95 ${ms(value(name, 'p(95)'))}, median ${ms(value(name, 'med'))}`,
  );
  const seconds =
    typeof data?.state?.testRunDurationMs === 'number' ? data.state.testRunDurationMs / 1000 : 0;
  const bytes = value('hvli_visit_bytes', 'avg');
  return [
    `HVL Interaktiv load test (NFR-001), profile ${run.profile}: ${run.learners} learners, ${seconds.toFixed(0)} s`,
    `Thresholds (${passed ? 'all passed' : 'NOT all passed'}):`,
    ...lines,
    'Also measured:',
    `  hvli_launch (login to redirect, less the mock Canvas): p95 ${ms(value('hvli_launch', 'p(95)'))}`,
    `  hvli_player_ready: median ${ms(value('hvli_player_ready', 'med'))}, max ${ms(value('hvli_player_ready', 'max'))}`,
    ...shown,
    `Visits: ${value('iterations', 'count') ?? 0} (${(value('iterations', 'rate') ?? 0).toFixed(2)}/s), ` +
      `requests: ${value('http_reqs', 'count') ?? 0}, checks passed: ${percent(value('checks', 'rate'))}`,
    `Bytes per visit (page, scripts, styles): ${typeof bytes === 'number' ? Math.round(bytes / 1024) : '–'} KiB`,
    '',
  ].join('\n');
}
