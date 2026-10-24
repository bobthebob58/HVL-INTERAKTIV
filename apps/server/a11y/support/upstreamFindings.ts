/**
 * upstreamFindings — matches an axe report against the register of recorded H5P problems (./upstreamRegister.ts):
 * the scan fails on any serious or critical violation no entry covers, and on any entry that no longer occurs.
 *
 * Why: UD-030 fails on serious and critical violations, and no axe rule may be disabled to pass. Where H5P's markup
 *      itself is wrong, the suite must still fail on anything new, keep showing the known problems and notice when
 *      one disappears (so the entry is removed and the improvement is not lost again).
 * Spec: UD-030, UD-011
 * SPEC-DEVIATION: D-080 — UD-030 fails CI on any serious or critical violation; a registered H5P upstream one is
 *   printed in every run but does not fail it.
 * Invariants:
 *   - Matching is per rule ID and markup (and selector where the entry names one); a match is printed as "recorded
 *     H5P upstream problem (not passing)", never dropped.
 *   - The entries that apply to a scan are chosen by surface, content type, colour mode and tour state; each of them
 *     must match at least one finding of that scan.
 *   - No entry may match an element it knows nothing about: a bare tag (`<div>`, `<li>` …), or a tag with a class,
 *     id or role that no H5P markup has, unless its `target` names something such an element's selector chain
 *     (`div`, `iframe > li`, `.unknown span` …) does not have. Such an entry would cover every new violation of its
 *     rule on the pages it applies to (`matchesAnyElement`, checked by ../upstreamRegister.a11y.test.ts).
 * Collaborators: ./upstreamRegister.ts, ./axeScan.ts, the axe suites in ../.
 * Tests: apps/server/a11y/upstreamRegister.a11y.test.ts, apps/server/a11y/axeContentTypes.a11y.test.ts,
 *   apps/server/a11y/axeEditor.a11y.test.ts, apps/server/a11y/axeWebRoutes.a11y.test.ts
 */
import { expect } from 'vitest';
import { printReport, type AxeFinding, type AxeReport } from './axeScan.js';
import { UPSTREAM_FINDINGS, type H5pSurface, type UpstreamFinding } from './upstreamRegister.js';

export type { H5pSurface, UpstreamFinding } from './upstreamRegister.js';

/** The state of the scanned page that decides which entries apply. */
export interface ScanState {
  /** Forced colours emulated. */
  readonly forced?: boolean;
  /** The BranchingScenario editor's guided tour is open (it opens with the editor). */
  readonly tour?: boolean;
}

/**
 * The register entries for one surface of one content type in one state.
 * @param surface - Player, editor form or content-type list.
 * @param library - The main library, e.g. `H5P.DragText`, or `*` for a page with H5P's content-type list only.
 * @param state - Colour mode and tour state of the scan.
 * @returns The entries that must occur there.
 */
export function recordedFor(surface: H5pSurface, library: string, state: ScanState = {}): UpstreamFinding[] {
  const forced = state.forced ?? false;
  const tour = library === 'H5P.BranchingScenario' && surface === 'editor' ? (state.tour ?? true) : undefined;
  return UPSTREAM_FINDINGS.filter(
    (entry) =>
      entry.surfaces.includes(surface) &&
      (entry.types.includes(library) || entry.types.includes('*')) &&
      (entry.forced === undefined || entry.forced === forced) &&
      (entry.tour === undefined || entry.tour === tour),
  );
}

/** A class and id that no H5P markup has, standing for "any other element". */
const UNKNOWN = 'not-in-h5p';
const TAGS = [
  'div',
  'span',
  'p',
  'li',
  'ul',
  'ol',
  'a',
  'button',
  'img',
  'input',
  'label',
  'section',
  'h2',
  'table',
];

/** Markup of elements with nothing to identify them (D-080); an entry must name more than any of these. */
const GENERIC_HTML = [
  ...TAGS.flatMap((tag) => [
    `<${tag}>`,
    `<${tag} class="${UNKNOWN}">`,
    `<${tag} id="${UNKNOWN}">`,
    `<${tag} id="${UNKNOWN}" class="${UNKNOWN}">`,
    `<${tag} class="${UNKNOWN}" role="button" tabindex="0">`,
    `<${tag} aria-hidden="true" class="${UNKNOWN}">`,
  ]),
  '<a href="#">',
  `<a href="#" class="${UNKNOWN}">`,
  `<input type="text" class="${UNKNOWN}">`,
  '<img src="image.png" alt="">',
];

/** Selector chains of such elements, as axe writes them; a `target` that matches one narrows nothing. */
const GENERIC_TARGETS = [
  ...TAGS.flatMap((tag) => [
    tag,
    `${tag}:nth-child(2)`,
    `iframe > ${tag}`,
    `iframe > iframe > ${tag}`,
    `#${UNKNOWN} > ${tag}`,
    `.${UNKNOWN} ${tag}`,
    `iframe > .${UNKNOWN} > ${tag}:nth-child(3)`,
  ]),
  `.${UNKNOWN}`,
  `#${UNKNOWN}`,
  `iframe > .${UNKNOWN}`,
];

/**
 * Whether an entry would cover any element of its rule: its `html` matches an element it knows nothing about, and
 * its `target`, if it has one, also matches such an element's selector chain.
 * @param entry - A register entry.
 * @returns True for a catch-all entry, which would hide a new violation of the same rule.
 */
export const matchesAnyElement = (entry: UpstreamFinding): boolean =>
  GENERIC_HTML.some((html) => entry.html.test(html)) &&
  (entry.target === undefined || GENERIC_TARGETS.some((target) => entry.target?.test(target)));

const matches = (entry: UpstreamFinding, finding: AxeFinding): boolean =>
  entry.ruleId === finding.ruleId &&
  entry.html.test(finding.html) &&
  (entry.target === undefined || entry.target.test(finding.target));

/**
 * Asserts that a scan has no blocking violation besides the recorded ones, and that each recorded one still occurs;
 * prints the report either way.
 * @param report - One scan's result.
 * @param recorded - The register entries that apply to the scanned page (`recordedFor`).
 */
export function expectOnlyRecorded(report: AxeReport, recorded: readonly UpstreamFinding[]): void {
  // SPEC-DEVIATION: D-080 — registered upstream violations are reported but do not fail (UD-030 fails on any).
  const known = report.blocking.filter((finding) => recorded.some((entry) => matches(entry, finding)));
  printReport(report, known);
  const unknown = report.blocking.filter((finding) => !known.includes(finding));
  const stale = recorded.filter((entry) => !report.blocking.some((finding) => matches(entry, finding)));
  expect(unknown, `${report.label}: blocking violations`).toEqual([]);
  expect(
    stale.map((entry) => `${entry.ruleId}: ${entry.why}`),
    `${report.label}: recorded upstream problems that no longer occur (remove them from upstreamRegister.ts)`,
  ).toEqual([]);
}
