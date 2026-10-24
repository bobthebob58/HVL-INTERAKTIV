/**
 * axeScan — runs axe-core on a page and every frame in it with the WCAG 2.2 AA tags, and sorts what it finds into
 * blocking violations, lower-impact violations and results a person must review.
 *
 * Why: UD-030 fails CI on violations with impact `serious` or `critical` and lists the others in the report. One
 *      scanner keeps the tags, the impact rule and the report format the same in every suite. Rules are never
 *      disabled: what H5P's own markup gets wrong is matched against ./upstreamFindings.ts, entry by entry.
 * Spec: UD-030, UD-011, UD-012
 * Invariants:
 *   - The tags are exactly `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`; no rule is disabled and no element is
 *     excluded.
 *   - Frames are scanned too (AxeBuilder's default), so the H5P player page in its chrome page and any iframe H5P
 *     writes are part of the same result; a finding's `target` names the frame chain.
 *   - A scan fails unless its results reach into every shown frame that holds H5P (`unscannedH5pFrames`):
 *     @axe-core/playwright drops a frame it cannot inject into within 1 s, or one that reloads mid-scan, without a
 *     word, and its `frame-tested` rule is not a WCAG rule, so such a scan would pass on the chrome page alone. One
 *     repeated scan tells a slow moment from a frame that is never scanned.
 *   - When `A11Y_REPORT_DIR` is set, every report is also appended there as JSON lines for the session gate.
 * Collaborators: @axe-core/playwright, ./axeFrames.ts, ./upstreamFindings.ts, the suites in ../.
 * Tests: apps/server/a11y/axeWebRoutes.a11y.test.ts, apps/server/a11y/axeContentTypes.a11y.test.ts,
 *   apps/server/a11y/axeEditor.a11y.test.ts, apps/server/a11y/axeServerPages.a11y.test.ts
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import type { NodeResult, Result } from 'axe-core';
import type { Page } from 'playwright-core';
import { unscannedH5pFrames } from './axeFrames.js';

/** The WCAG 2.2 A and AA rule tags UD-030 names. */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

/** Impacts that fail the suite (UD-030). */
export const BLOCKING_IMPACTS: ReadonlySet<string> = new Set(['serious', 'critical']);

/** One element axe reported. */
export interface AxeFinding {
  readonly ruleId: string;
  /** `minor`, `moderate`, `serious` or `critical`. */
  readonly impact: string;
  /** The frame chain and the element, e.g. `iframe > .h5p-content button`. */
  readonly target: string;
  /** The start of the element's markup. */
  readonly html: string;
  /** Why axe reports it, in one line. */
  readonly summary: string;
}

/** What one scan found. */
export interface AxeReport {
  /** What was scanned, e.g. `forced colours /aktivitet/<id> (Spel)`. */
  readonly label: string;
  /** Violations with impact `serious` or `critical`. */
  readonly blocking: readonly AxeFinding[];
  /** Violations with impact `minor` or `moderate`. */
  readonly other: readonly AxeFinding[];
  /** Axe's "incomplete" results: checks a person must make (e.g. contrast on a gradient). */
  readonly review: readonly AxeFinding[];
}

const findingsOf = (results: readonly Result[]): AxeFinding[] =>
  results.flatMap((result) =>
    result.nodes.map((node: NodeResult) => ({
      ruleId: result.id,
      impact: node.impact ?? result.impact ?? 'unknown',
      target: node.target
        .map((part) => (Array.isArray(part) ? part.join(' >>> ') : String(part)))
        .join(' > '),
      html: node.html.replace(/\s+/g, ' ').slice(0, 200),
      summary: (node.failureSummary ?? result.help).replace(/\s+/g, ' ').slice(0, 240),
    })),
  );

/**
 * Scans a page and its frames.
 * @param page - A loaded page.
 * @param label - What is scanned, for the report.
 * @param builder - The scanner; the suites use the default (UD-030's tags), a control passes one that cannot enter
 *   frames.
 * @returns The sorted findings.
 * @throws Error when a shown H5P frame was not scanned, also on a second try.
 */
export async function scanPage(
  page: Page,
  label: string,
  builder: AxeBuilder = new AxeBuilder({ page }).withTags([...WCAG_TAGS]),
): Promise<AxeReport> {
  let results = await builder.analyze();
  let unscanned = await unscannedH5pFrames(page, results);
  if (unscanned.length > 0) {
    results = await builder.analyze();
    unscanned = await unscannedH5pFrames(page, results);
  }
  if (unscanned.length > 0) throw new Error(`${label}: axe did not scan inside ${unscanned.join(', ')}`);
  const violations = findingsOf(results.violations);
  const report: AxeReport = {
    label,
    blocking: violations.filter((f) => BLOCKING_IMPACTS.has(f.impact)),
    other: violations.filter((f) => !BLOCKING_IMPACTS.has(f.impact)),
    review: findingsOf(results.incomplete),
  };
  const dir = process.env.A11Y_REPORT_DIR;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'axe-reports.jsonl'), `${JSON.stringify(report)}\n`);
  }
  return report;
}

/**
 * Joins the scans of one view in several states (fresh, answered) into one report.
 * @param label - What was scanned.
 * @param reports - The scans.
 * @returns One report with every finding of every scan, each element once per rule.
 */
export function mergeReports(label: string, reports: readonly AxeReport[]): AxeReport {
  const unique = (findings: AxeFinding[]) => [
    ...new Map(findings.map((f) => [`${f.ruleId} ${f.target}`, f])).values(),
  ];
  return {
    label,
    blocking: unique(reports.flatMap((r) => r.blocking)),
    other: unique(reports.flatMap((r) => r.other)),
    review: unique(reports.flatMap((r) => r.review)),
  };
}

/**
 * Counts findings by rule and impact, e.g. `link-name (serious) × 3`.
 * @param findings - Findings of one or more scans.
 * @returns One line per rule and impact, sorted.
 */
export function countByRule(findings: readonly AxeFinding[]): string[] {
  const counts = new Map<string, number>();
  for (const f of findings)
    counts.set(`${f.ruleId} (${f.impact})`, (counts.get(`${f.ruleId} (${f.impact})`) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([key, n]) => `${key} × ${n}`);
}

/**
 * Prints a report: every blocking and lower-impact violation and the checks left for review.
 * @param report - One scan's result.
 * @param known - Blocking findings that are recorded H5P upstream problems (./upstreamFindings.ts).
 */
export function printReport(report: AxeReport, known: readonly AxeFinding[] = []): void {
  const line = (f: AxeFinding) =>
    `    ${f.ruleId} (${f.impact}) ${f.target}\n      ${f.html}\n      ${f.summary}`;
  const parts = [`axe: ${report.label}`];
  const unknown = report.blocking.filter((f) => !known.includes(f));
  if (unknown.length) parts.push('  blocking:', ...unknown.map(line));
  if (known.length) parts.push('  recorded H5P upstream problems (not passing):', ...known.map(line));
  if (report.other.length) parts.push('  lower impact:', ...report.other.map(line));
  if (report.review.length) parts.push(`  to review by hand: ${countByRule(report.review).join(', ')}`);
  if (parts.length === 1) parts.push('  no violation');
  console.info(parts.join('\n'));
}
