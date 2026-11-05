/**
 * a11yReport tests — the conformance report generator lists every WCAG 2.2 A and AA criterion, keeps the manual
 * blocks byte for byte, gives the same file for the same sources whatever the clock, and takes results only from
 * the run summary; the committed report's blocks parse (UD-040's document check, D-113).
 * Spec: UD-040
 */
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { committedReport, composeReport, loadSources } from '../buildReport.mjs';
import { EVIDENCE, evidenceProblems } from '../criterionEvidence.mjs';
import { criterionBlockId, parseManualBlocks, verdictOf } from '../manualBlocks.mjs';
import { SECTION_BLOCKS } from '../renderReport.mjs';
import { readSummary } from '../runSummary.mjs';
import { CRITERIA } from '../wcagCriteria.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const start = (id) => `<!-- manual:${'start'} ${id} -->`;
const end = (id) => `<!-- manual:${'end'} ${id} -->`;
const withBlock = (text, id, body) => {
  const from = text.indexOf(start(id)) + start(id).length;
  return text.slice(0, from) + body + text.slice(text.indexOf(end(id)));
};
const sectionOf = (text, id) => {
  const from = text.indexOf(`\n### ${id} `);
  const next = text.slice(from + 1).search(/\n##+ /);
  return text.slice(from, from + 1 + next);
};
const SUMMARY = {
  format: 2,
  command: 'npm run test:a11y',
  date: '2030-01-02',
  commit: 'b'.repeat(40),
  worktree: 'clean',
  axeCore: '4.13.0',
  totals: { files: 1, failedFiles: 1, passed: 1, failed: 1, skipped: 0 },
  failedFiles: ['keyboardFocus.a11y.test.ts'],
  files: {
    'keyboardFocus.a11y.test.ts': [
      {
        group: '',
        title: '[UD-006] / : the first Tab reaches the skip link, which moves focus to main',
        status: 'failed',
      },
      {
        group: '',
        title: '[UD-006] /hjelp: the first Tab reaches the skip link, which moves focus to main',
        status: 'passed',
      },
    ],
  },
  axe: {
    scans: 3,
    labels: [{ label: 'light, /', scans: 3 }],
    blocking: [{ rule: 'color-contrast', impact: 'serious', elements: 2, scans: 1 }],
    other: [],
    review: [],
  },
};

describe('[UD-040] the conformance report generator', () => {
  let sources;
  let fresh;
  beforeAll(async () => {
    sources = await loadSources(ROOT);
    fresh = composeReport(sources, undefined, '');
  });
  afterEach(() => vi.useRealTimers());

  it('[UD-040] lists each of the 56 WCAG 2.2 A and AA criteria once, as a section and as a summary row', () => {
    // Act and assert: the list itself, then each criterion in the report
    expect(CRITERIA).toHaveLength(56);
    expect(CRITERIA.filter((c) => c.level === 'A')).toHaveLength(32);
    expect(new Set(CRITERIA.map((c) => c.id)).size).toBe(56);
    expect(evidenceProblems(EVIDENCE)).toEqual([]);
    const blocks = parseManualBlocks(fresh);
    for (const c of CRITERIA) {
      expect(fresh.split(`\n### ${c.id} ${c.name}\n`)).toHaveLength(2);
      expect(fresh.split(`\n| [${c.id} ${c.name}](#`)).toHaveLength(2);
      expect(verdictOf(c.id, blocks.get(criterionBlockId(c.id)))).toBe('Not yet determined');
    }
    const headings = [...fresh.matchAll(/^### (\d\.\d\.\d+) /gm)].map((m) => m[1]);
    expect(headings).toEqual(CRITERIA.map((c) => c.id));
  });

  it('[UD-040] keeps every manual block byte for byte, and the summary copies the verdict people wrote', () => {
    const verdict =
      '\n**Verdict:** Partially supports\n\n**Evaluated by HVL:** 2027-01-15, ALU (KH), AT-1.\n\n' +
      '| Step | Result |\n|---|---|\n| J2.3 | Pass |\n\n\n### A heading inside\n  trailing  \n';
    let edited = withBlock(fresh, criterionBlockId('1.4.3'), verdict);
    edited = withBlock(edited, 'scope', 'HVL’s own words, no line break at the end');
    edited = withBlock(edited, 'uustatus-notes', '');

    // Act
    const regenerated = composeReport(sources, undefined, edited);

    // Assert
    const kept = parseManualBlocks(regenerated);
    for (const [id, body] of parseManualBlocks(edited)) expect(kept.get(id)).toBe(body);
    expect(composeReport(sources, undefined, regenerated)).toBe(regenerated);
    expect(regenerated).toContain('| AA | Partially supports |');
    expect(regenerated).toContain(
      'Partially supports 1 · Does not support 0 · Not applicable 0 · Not yet determined 55',
    );
  });

  it('[UD-040] gives the same file for the same sources whatever the clock, and its own output back unchanged', () => {
    vi.useFakeTimers({ now: new Date('2031-03-04T05:06:07Z') });
    const first = composeReport(sources, SUMMARY, fresh);
    vi.setSystemTime(new Date('2044-12-24T23:59:59Z'));

    // Act
    const second = composeReport(sources, SUMMARY, fresh);

    // Assert
    expect(second).toBe(first);
    expect(composeReport(sources, SUMMARY, first)).toBe(first);
    expect(first).not.toMatch(/2031-03-04|2044-12-24/);
    expect(first.endsWith('\n') && !first.endsWith('\n\n')).toBe(true);
  });

  it('[UD-040] stops on a broken block or one no section owns instead of writing a report without its text', () => {
    const broken = fresh.replace(end(criterionBlockId('2.1.1')), '');
    const unknown = `${fresh}\n${start('sc-9.9.9')}\nHVL’s notes\n${end('sc-9.9.9')}\n`;

    expect(() => composeReport(sources, undefined, broken)).toThrow(/starts inside|never closed/);
    expect(() => composeReport(sources, undefined, unknown)).toThrow(/belongs to no section/);
  });

  it('[UD-040] takes a suite check’s result and axe’s findings from the run summary, and says when none is recorded', () => {
    // Act
    const report = composeReport(sources, SUMMARY, fresh);

    // Assert
    expect(sectionOf(report, '2.4.1')).toContain(
      'Last run: its file failed (appendix A); 1 passed, 1 failed.',
    );
    expect(sectionOf(report, '1.4.3')).toContain(
      'serious or critical: `color-contrast` (serious): 2 elements in 1 scan;',
    );
    expect(sectionOf(fresh, '2.4.1')).toContain('Last run: not recorded (no full run yet).');
    expect(report).toContain(
      '| Last automated run | 2030-01-02, commit `bbbbbbbbbbbb` (clean): 1 passed, 1 failed, 0 skipped; 1 of 1 files failed',
    );
    expect(report).toContain(
      '- `keyboardFocus.a11y.test.ts`: [UD-006] / : the first Tab reaches the skip link',
    );
  });

  it('[UD-040] names for each criterion the protocol’s steps and page checks, and the register’s upstream barriers', () => {
    expect(sectionOf(fresh, '2.4.1')).toMatch(
      /\*\*Manual protocol:\*\* J1\.4 «Sign in to HVL Interaktiv with Feide.*»; §7 Skip link/,
    );
    expect(sectionOf(fresh, '1.4.3')).toContain('`color-contrast` in the editor of H5P.BranchingScenario');
    expect(sectionOf(fresh, '3.1.2')).toContain('H5P.Video 1.6 writes «Video source is missing.»');
    expect(sectionOf(fresh, '4.1.2')).toContain('`nested-interactive` in the hub of every content type');
    expect(sectionOf(fresh, '1.2.4')).toContain('- None. No automated check covers this criterion');
    expect(fresh).toContain('*not yet tested by HVL*');
  });

  it('[UD-040] the committed report and run summary exist, and every manual block of the report parses', () => {
    // Act
    const text = committedReport(ROOT);
    const blocks = parseManualBlocks(text);

    // Assert
    expect(readSummary(ROOT)?.totals.passed).toBeGreaterThan(0);
    for (const id of SECTION_BLOCKS) expect(blocks.has(id)).toBe(true);
    for (const c of CRITERIA) {
      expect(text).toContain(`\n### ${c.id} ${c.name}\n`);
      expect(() => verdictOf(c.id, blocks.get(criterionBlockId(c.id)))).not.toThrow();
    }
  });
});
