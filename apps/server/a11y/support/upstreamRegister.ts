/**
 * upstreamRegister — the serious and critical axe violations found in H5P's own markup (player, editor, content-type
 * list) that neither the HVL theme, the markup repairs nor our pages can remove; one entry per rule and kind of
 * element, with where it occurs and H5P's source at the pinned commit.
 *
 * Why: UD-030 fails on serious and critical violations and forbids disabling an axe rule. The suite therefore needs
 *      an explicit, reviewable list of what remains and why (./upstreamFindings.ts matches it, prints every match and
 *      fails on anything new and on any entry that no longer occurs). This list is the source for the UD-040
 *      conformance report and for the upstream issues still to be filed (S6, D-080); PROGRESS summarises it.
 *      D-080: what a local, attribute-only change removes without changing H5P's behaviour is repaired at run time
 *      by packages/hvl-h5p-theme/src/a11yRepairs.js (CoursePresentation's progress bar, DragText's drop zones,
 *      H5P.Question's explanation title, BranchingScenario's default start and end pictures, which have no alt
 *      (D-080 amendment of 2026-10-28; still to be reported upstream for UD-040)) and src/a11yEditorRepairs.js (the
 *      paste button, the score-range "to" field, the vertical tabs, the editor-mode switch, the hotspot picker image
 *      and the hub's content-type list) and is no longer listed here. The theme (hvl-h5p-theme.css) sets the text
 *      fill of BranchingScenario's controls under forced colours, so axe's -webkit-text-fill-color reading no longer
 *      reports them, and a11yEditorRepairs.js makes the parts the guided tour fades (`.tour-fade`) inert while it is
 *      open, so the tour adds no finding.
 *      A second list, `UPSTREAM_ENGLISH_TEXTS`, records what axe cannot see: learner-facing text a library writes in
 *      English whatever the activity's language (D-080 amendment of 2026-10-28), for UD-040.
 * Spec: UD-030, UD-011, UD-012, UD-010
 * SPEC-DEVIATION: D-080 — an entry here is printed in every run but does not fail CI, although UD-030 fails it on
 *   any serious or critical violation.
 * Invariants:
 *   - Every entry has an `UPSTREAM:` comment with the repository at the commit we run (D-022, D-078 manifest).
 *   - `html` matches the start of the element's markup as axe reports it; `target` narrows by axe's selector.
 *     No entry matches an element it knows nothing about (a bare tag, or one with a class, id or role H5P never
 *     writes, also one that only starts with the prefix the pattern names) unless its `target` rules out such an
 *     element's selector chain: it would cover a new violation of the same rule (./upstreamFindings.ts
 *     `matchesAnyElement`; apps/server/a11y/upstreamRegister.a11y.test.ts fails on such an entry). So a class or
 *     id is named whole, up to its closing quote or the space before the next name.
 *   - `forced` limits an entry to forced colours (`true`) or the light theme (`false`); `tour` limits it to the
 *     BranchingScenario editor while H5P's guided tour is open (`true`) or after it was closed (`false`). Only the
 *     Paste entry needs one (`tour: false`); the editor is still scanned in both states (axeEditor.a11y.test.ts).
 * Collaborators: ./upstreamFindings.ts, tools/h5p-libraries/libraries.manifest.json,
 *   packages/hvl-h5p-theme/src/a11yRepairs.js, packages/hvl-h5p-theme/src/a11yEditorRepairs.js.
 * Tests: apps/server/a11y/upstreamRegister.a11y.test.ts, apps/server/a11y/axeContentTypes.a11y.test.ts,
 *   apps/server/a11y/axeEditor.a11y.test.ts, apps/server/a11y/axeWebRoutes.a11y.test.ts
 */

/** Where H5P markup is shown: the player, the editor form, or the editor's content-type list (the "hub"). */
export type H5pSurface = 'player' | 'editor' | 'hub';

/** One recorded violation. */
export interface UpstreamFinding {
  readonly ruleId: string;
  /** Matches the start of the element's markup as axe reports it. */
  readonly html: RegExp;
  /** Matches axe's selector chain, where the markup alone is too general. */
  readonly target?: RegExp;
  readonly surfaces: readonly H5pSurface[];
  /** Main libraries whose page shows it; `*` for every page of the surface. */
  readonly types: readonly string[];
  readonly forced?: boolean;
  readonly tour?: boolean;
  /** Why it fails and why we cannot repair it here. */
  readonly why: string;
}

const BRANCHING = ['H5P.BranchingScenario'];

/** The register. */
export const UPSTREAM_FINDINGS: readonly UpstreamFinding[] = [
  // UPSTREAM: https://github.com/h5p/h5p-editor-branching-scenario/tree/8fcd92d0a5a5f6b855d9d03ce4d19ab31baa4b99 (1.5.13, the reuse toolbar). No issue filed yet (SPEC-DEVIATION: D-080 amendment DOC-13); the entry goes when it stops occurring, which fails the suite.
  {
    ruleId: 'color-contrast',
    html: /^<li class="reuse-question disabled"/,
    surfaces: ['editor'],
    types: BRANCHING,
    tour: false,
    why:
      'the "Paste" item is disabled by a class only (no aria-disabled), so its text, faded by `opacity: .5` ' +
      '(3.99:1; 3.94:1 under forced colours, which keep the opacity), counts as the text of an active control ' +
      'and assistive technology does not hear that it is unavailable (while the guided tour is open the reuse ' +
      'panel is faded and inert, so it is reported after the tour only)',
  },
  // UPSTREAM: https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5p-hub-client.js (built from h5p/h5p-hub-client). No issue filed yet (SPEC-DEVIATION: D-080 amendment DOC-13); the entry goes when it stops occurring, which fails the suite.
  {
    ruleId: 'nested-interactive',
    html: /^<li (class="h5p-hub-tab-button"|id="h5p-[a-z]+" class="h5p-hub-media[ "])/,
    surfaces: ['hub'],
    types: ['*'],
    why:
      'the hub tabs (role="tab") and the content types (role="button") each contain a focusable link or button. ' +
      "Not repairable by attributes (D-080): the tabs' focus, arrow keys and Enter belong to the inner <a href>, " +
      'and h5p-hub-client.css lays the tabs out by [role=tab] on the <li> and [role=tab] > a, so moving the role ' +
      'unstyles them and dropping the link drops Enter; a content type is a role="button" <li> (Space uses it) ' +
      'holding its own "Details" button, and no attribute separates the two without removing one control',
  },
];

/** Learner-facing text a pinned library writes in English in every language, which axe cannot see (WCAG 3.1.2). */
export interface UpstreamEnglishText {
  /** The library, as `H5P.Name major.minor`, that writes it. */
  readonly library: string;
  /** The text exactly as the library writes it. */
  readonly text: string;
  /** When a learner sees it. */
  readonly shownWhen: string;
  /** Why it cannot be translated or repaired here, and what keeps it from learners. */
  readonly why: string;
}

/** English texts of the pinned libraries that no language file reaches (D-080 amendment of 2026-10-28). */
export const UPSTREAM_ENGLISH_TEXTS: readonly UpstreamEnglishText[] = [
  // UPSTREAM: https://github.com/h5p/h5p-video/blob/af25aef6e9eb8f84db037d564d82494c7d44e267/scripts/video.js (1.6.80). No issue filed yet (SPEC-DEVIATION: D-080 amendment DOC-13); the entry goes when a pinned H5P.Video keeps the l10n it is given.
  {
    library: 'H5P.Video 1.6',
    text: 'Video source is missing.',
    shownWhen: 'an InteractiveVideo (or another type holding an H5P.Video) has no video source',
    why:
      'H5P.Video merges its English defaults over the l10n it is given ($.extend), so no translation reaches it; ' +
      'V-PLACEHOLDER reports the missing video as an error, so such an activity is not published by mistake',
  },
  // UPSTREAM: https://github.com/h5p/h5p-image-hotspots/blob/adc855f17f2c86e8741c9299f6d834f8fabc7417/scripts/image-hotspots.js (1.11.6). No issue filed yet (SPEC-DEVIATION: D-080 amendment DOC-13); the entry goes when a pinned ImageHotspots takes the text from its semantics.
  {
    library: 'H5P.ImageHotspots 1.11',
    text: 'Missing required background image',
    shownWhen: 'an ImageHotspots has no background image',
    why:
      'the text is written into the markup in English and has no field in the semantics or language files; ' +
      'V-PLACEHOLDER reports the missing image as an error, so such an activity is not published by mistake',
  },
];
