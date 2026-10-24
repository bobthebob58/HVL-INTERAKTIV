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
 *     id or role that no H5P markup has, also one that only shares the prefix the entry names (`class="h5p-` matches
 *     `class="h5p-anything"`), unless its `target` names something such an element's selector chain (`div`,
 *     `iframe > li`, `.unknown span` …) does not have. Such an entry would cover every new violation of its rule on
 *     the pages it applies to (`matchesAnyElement`, checked by ../upstreamRegister.a11y.test.ts).
 * Collaborators: ./upstreamRegister.ts, ./axeScan.ts, the axe suites in ../.
 * Tests: apps/server/a11y/upstreamRegister.a11y.test.ts, apps/server/a11y/axeContentTypes.a11y.test.ts,
 *   apps/server/a11y/axeEditor.a11y.test.ts, apps/server/a11y/axeWebRoutes.a11y.test.ts
 */
import { expect } from 'vitest';
import { printReport, type AxeFinding, type AxeReport } from './axeScan.js';
import { UPSTREAM_FINDINGS, type H5pSurface, type UpstreamFinding } from './upstreamRegister.js';

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

/**
 * The names an entry's markup pattern starts a class or id with (`h5p-` in `class="h5p-`), each followed by
 * `UNKNOWN`: a pattern that only starts a name (a prefix) then matches a name H5P never writes, while one that
 * ends it (a quote or space after the name, `class="h5p-hub-media[ "]`) does not.
 */
const unknownNames = (pattern: RegExp, start: RegExp): string[] => [
  UNKNOWN,
  ...[...pattern.source.matchAll(start)].map((m) => `${m[1] ?? ''}${UNKNOWN}`),
];

/** Markup of elements with nothing to identify them (D-080), with the given unknown names; an entry must name more. */
const genericHtml = (names: readonly string[]): string[] => [
  ...TAGS.flatMap((tag) => [
    `<${tag}>`,
    ...names.flatMap((name) => [
      `<${tag} class="${name}">`,
      `<${tag} id="${name}">`,
      ...names.map((other) => `<${tag} id="${name}" class="${other}">`),
      `<${tag} class="${name}" role="button" tabindex="0">`,
      `<${tag} aria-hidden="true" class="${name}">`,
    ]),
  ]),
  '<a href="#">',
  '<img src="image.png" alt="">',
  ...names.flatMap((name) => [`<a href="#" class="${name}">`, `<input type="text" class="${name}">`]),
];

/** Selector chains of such elements, as axe writes them; a `target` that matches one narrows nothing. */
const genericTargets = (names: readonly string[]): string[] => [
  ...TAGS.flatMap((tag) => [tag, `${tag}:nth-child(2)`, `iframe > ${tag}`, `iframe > iframe > ${tag}`]),
  ...names.flatMap((name) => [
    ...TAGS.flatMap((tag) => [
      `#${name} > ${tag}`,
      `.${name} ${tag}`,
      `iframe > .${name} > ${tag}:nth-child(3)`,
    ]),
    `.${name}`,
    `#${name}`,
    `iframe > .${name}`,
  ]),
];

/**
 * Whether an entry would cover any element of its rule: its `html` matches an element it knows nothing about (no
 * class or id, or one H5P never writes, also one that only shares the prefix the pattern names), and its `target`,
 * if it has one, also matches such an element's selector chain.
 * @param entry - A register entry.
 * @returns True for a catch-all entry, which would hide a new violation of the same rule.
 */
export const matchesAnyElement = (entry: UpstreamFinding): boolean => {
  const html = genericHtml(unknownNames(entry.html, /(?:class|id)="([^\\^$.|?*+()[\]{}"\s]*)/g));
  const target = entry.target;
  const chains = target ? genericTargets(unknownNames(target, /(?:\\\.|#)([\w-]*)/g)) : [];
  return (
    html.some((markup) => entry.html.test(markup)) && (!target || chains.some((chain) => target.test(chain)))
  );
};

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
