/**
 * runSummary tests — a full run of the accessibility suite is distilled into a summary that holds no duration,
 * markup or clock time, that is the same for the same run whatever order its parts came in, and that records a file
 * Vitest marked failed even when none of its tests did; a run of part of the suite is not taken for the whole.
 * Spec: UD-040, UD-030
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { missingSuiteFiles, resultText, runPassed, suiteResult } from '../runResults.mjs';
import { distilRun, readRunFolder, stableText, suiteKey, summaryText } from '../runSummary.mjs';

const ID = '3f2b9c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';
const outcome = (title, status, duration = 1234) => ({ title, status, duration, failureMessages: [] });
const vitest = (results) => ({ startTime: Date.UTC(2026, 10, 5, 4, 41), testResults: results });
const file = (name, assertions, status = 'passed') => ({
  name: `/repo/apps/server/a11y/${name}`,
  status,
  assertionResults: assertions,
});
const finding = (ruleId, impact) => ({
  ruleId,
  impact,
  target: 'iframe > .x',
  html: '<div class="x">',
  summary: 'Fix',
});
const SOURCE = { commit: 'a'.repeat(40), clean: false, axeVersion: '4.13.0' };

const RUN = vitest([
  file(
    'keyboardFocus.a11y.test.ts',
    [
      outcome(`[UD-004] /aktivitet/${ID}: every focused element is visible and not covered`, 'passed'),
      outcome('[UD-006] / : the first Tab reaches the skip link, which moves focus to main', 'failed'),
    ],
    'failed',
  ),
  file('axeWebRoutes.a11y.test.ts', [
    outcome('[UD-030] signed out: / has no serious or critical violation', 'pending'),
  ]),
]);
const AXE = [
  {
    label: `light /aktivitet/${ID} (Spel)`,
    blocking: [finding('color-contrast', 'serious')],
    other: [],
    review: [],
  },
  {
    label: 'forced colours, the editor of H5P.Blanks',
    blocking: [finding('color-contrast', 'serious'), finding('color-contrast', 'serious')],
    other: [finding('region', 'moderate')],
    review: [finding('color-contrast', 'serious')],
  },
];

describe('[UD-040] the run summary', () => {
  const dirs = [];
  afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

  it('[UD-040] keeps titles and statuses, counts axe findings by rule and impact, and drops what varies', () => {
    // Act
    const summary = distilRun(RUN, AXE, SOURCE);

    // Assert
    expect(summary.format).toBe(2);
    expect(summary.date).toBe('2026-11-05');
    expect(summary.worktree).toBe('with uncommitted changes');
    expect(summary.totals).toEqual({ files: 2, failedFiles: 1, passed: 1, failed: 1, skipped: 1 });
    expect(Object.keys(summary.files)).toEqual(['axeWebRoutes.a11y.test.ts', 'keyboardFocus.a11y.test.ts']);
    expect(summary.files['keyboardFocus.a11y.test.ts'][0].title).toContain('/aktivitet/<id>:');
    expect(summary.axe.scans).toBe(2);
    expect(summary.axe.blocking).toEqual([
      { rule: 'color-contrast', impact: 'serious', elements: 3, scans: 2 },
    ]);
    expect(summary.axe.other).toEqual([{ rule: 'region', impact: 'moderate', elements: 1, scans: 1 }]);
    expect(summary.axe.labels.map((l) => l.label)).toContain('light /aktivitet/<id> (Spel)');
    expect(summaryText(summary)).not.toMatch(/duration|<div|iframe > |T\d\d:\d\d/);
  });

  it('[UD-040] gives the same summary for the same run in another order', () => {
    const reversed = vitest(
      [...RUN.testResults]
        .reverse()
        .map((r) => ({ ...r, assertionResults: [...r.assertionResults].reverse() })),
    );

    expect(summaryText(distilRun(reversed, [...AXE].reverse(), SOURCE))).toBe(
      summaryText(distilRun(RUN, AXE, SOURCE)),
    );
  });

  it('[UD-040] never counts a test that did not run as passed', () => {
    const summary = distilRun(
      vitest([file('a.a11y.test.ts', [outcome('[UD-005] x', 'todo'), outcome('[UD-005] y', 'skipped')])]),
      [],
      SOURCE,
    );

    expect(summary.totals).toEqual({ files: 1, failedFiles: 0, passed: 0, failed: 0, skipped: 2 });
    expect(runPassed(summary)).toBe(true);
  });

  it('[UD-040] records a file whose hook or import failed as failed, though none of its tests failed', () => {
    // Arrange: as Vitest 5 reports them, a failed beforeAll leaves the tests skipped, a failed import leaves none
    const run = vitest([
      file('targetSize.a11y.test.ts', [outcome('[UD-005] / : every target is 24 px', 'skipped')], 'failed'),
      file('language.a11y.test.ts', [], 'failed'),
      file('textSpacingZoom.a11y.test.ts', [outcome('[UD-002] at 200 % zoom', 'passed')]),
    ]);

    // Act
    const summary = distilRun(run, [], SOURCE);
    const check = { suite: 'targetSize.a11y.test.ts', match: ['UD-005'] };

    // Assert
    expect(summary.failedFiles).toEqual(['language.a11y.test.ts', 'targetSize.a11y.test.ts']);
    expect(summary.totals).toMatchObject({ failed: 0, failedFiles: 2 });
    expect(runPassed(summary)).toBe(false);
    expect(resultText(suiteResult(summary, check))).toBe('its file failed (appendix A); 1 skipped');
    expect(
      resultText(suiteResult(summary, { suite: 'textSpacingZoom.a11y.test.ts', match: ['UD-002'] })),
    ).toBe('1 passed');
  });

  it('[UD-040] keys files by their path in the suite, and refuses one outside it or one reported twice', () => {
    // Arrange: a file in a folder of the suite, a file reported twice, and one outside the suite
    const nested = vitest([file('studio/bank.a11y.test.ts', []), file('bank.a11y.test.ts', [])]);
    const twice = vitest([file('bank.a11y.test.ts', []), file('bank.a11y.test.ts', [])]);
    const outside = vitest([
      { name: '/repo/apps/server/test/x.test.ts', status: 'passed', assertionResults: [] },
    ]);

    // Act and assert
    expect(Object.keys(distilRun(nested, [], SOURCE).files)).toEqual([
      'bank.a11y.test.ts',
      'studio/bank.a11y.test.ts',
    ]);
    expect(suiteKey('C:\\repo\\apps\\server\\a11y\\x.a11y.test.ts')).toBe('x.a11y.test.ts');
    expect(() => distilRun(twice, [], SOURCE)).toThrow(/twice/);
    expect(() => distilRun(outside, [], SOURCE)).toThrow(/not a file of the accessibility suite/);
  });

  it('[UD-040] names the suite files a run left out, so a partial run is not taken for the full one', () => {
    const summary = distilRun(RUN, [], SOURCE);

    expect(missingSuiteFiles(summary, ['axeWebRoutes.a11y.test.ts', 'keyboardFocus.a11y.test.ts'])).toEqual(
      [],
    );
    expect(missingSuiteFiles(summary, ['keyboardFocus.a11y.test.ts', 'targetSize.a11y.test.ts'])).toEqual([
      'targetSize.a11y.test.ts',
    ]);
  });

  it('[UD-040] reads a run folder, and refuses one without the Vitest report', () => {
    const dir = mkdtempSync(join(tmpdir(), 'a11y-report-test-'));
    dirs.push(dir);
    // Act and assert: an empty folder is refused
    expect(() => readRunFolder(dir)).toThrow(/vitest\.json is missing/);

    writeFileSync(join(dir, 'vitest.json'), JSON.stringify(RUN));
    writeFileSync(join(dir, 'axe-reports.jsonl'), `${AXE.map((r) => JSON.stringify(r)).join('\n')}\n`);

    // Act and assert: a whole folder is read
    expect(readRunFolder(dir).axeReports).toHaveLength(2);
    expect(stableText(`  a \n b ${ID} `)).toBe('a b <id>');
  });
});
