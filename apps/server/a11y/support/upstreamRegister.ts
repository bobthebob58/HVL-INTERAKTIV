/**
 * upstreamRegister — the serious and critical axe violations found in H5P's own markup (player, editor, content-type
 * list) that neither the HVL theme nor our pages can repair, and two proven measurement artefacts of axe under
 * forced colours; one entry per rule and kind of element, with where it occurs and H5P's source at the pinned commit.
 *
 * Why: UD-030 fails on serious and critical violations and forbids disabling an axe rule. The suite therefore needs
 *      an explicit, reviewable list of what remains and why (./upstreamFindings.ts matches it, prints every match and
 *      fails on anything new and on any entry that no longer occurs). This list is reported to H5P and in PROGRESS.
 * Spec: UD-030, UD-011, UD-012
 * Invariants:
 *   - Every entry has an `UPSTREAM:` comment with the repository at the commit we run (D-022, D-078 manifest).
 *   - `html` matches the start of the element's markup as axe reports it; `target` narrows by axe's selector.
 *   - `forced` limits an entry to forced colours (`true`) or the light theme (`false`); `tour` limits it to the
 *     BranchingScenario editor while H5P's guided tour is open (`true`) or after it was closed (`false`).
 * Collaborators: ./upstreamFindings.ts, tools/h5p-libraries/libraries.manifest.json.
 * Tests: apps/server/a11y/axeContentTypes.a11y.test.ts, apps/server/a11y/axeEditor.a11y.test.ts,
 *   apps/server/a11y/axeWebRoutes.a11y.test.ts
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

const RANGE_LIST_TYPES = [
  'H5P.Blanks',
  'H5P.Column',
  'H5P.DragText',
  'H5P.InteractiveBook',
  'H5P.MultiChoice',
];
const VERTICAL_TABS_TYPES = ['H5P.ImageHotspots', 'H5P.InteractiveBook', 'H5P.QuestionSet'];
const BRANCHING = ['H5P.BranchingScenario'];

/** The register. */
export const UPSTREAM_FINDINGS: readonly UpstreamFinding[] = [
  // UPSTREAM: https://github.com/h5p/h5p-course-presentation/tree/369d140c741fab528604237380c34ec1fe8f121a (1.28.25, src/scripts/progressbar.js).
  {
    ruleId: 'link-name',
    html: /^<a href="#"[^>]*><span class="h5p-progressbar-part-title hidden-but-read"><\/span><\/a>/,
    surfaces: ['player', 'editor'],
    types: ['H5P.CoursePresentation'],
    why: "the progress bar's links have an empty text span; the slide title is only on the parent's aria-label",
  },
  // UPSTREAM: https://github.com/h5p/h5p-course-presentation/tree/369d140c741fab528604237380c34ec1fe8f121a (1.28.25, src/scripts/progressbar.js).
  {
    ruleId: 'nested-interactive',
    html: /^<div class="h5p-progressbar-part[^"]*" id="progressbar-part-\d+" role="tab"/,
    surfaces: ['player', 'editor'],
    types: ['H5P.CoursePresentation'],
    why: 'each progress-bar part is a role="tab" with a focusable <a> inside it',
  },
  // UPSTREAM: https://github.com/h5p/h5p-drag-text/tree/3d3eb6d759b3ed65862c3048fbe02b989cbb7110 (1.10.52, src/scripts/drag-text.js).
  {
    ruleId: 'aria-prohibited-attr',
    html: /^<div aria-dropeffect="none" aria-label="[^"]*" tabindex="-1" class="ui-droppable"/,
    surfaces: ['player'],
    types: ['H5P.DragText'],
    why: 'the drop zones are plain <div>s with aria-label (and the deprecated aria-dropeffect)',
  },
  // UPSTREAM: https://github.com/dequelabs/axe-core/blob/v4.13.0/lib/commons/color/get-foreground-color.js reads -webkit-text-fill-color first.
  {
    ruleId: 'color-contrast',
    html: /^<(button class="(h5p-start-button|transition h5p-(back-button|nav-button h5p-proceed-button))|li class="([a-z]+|reuse-question disabled)"|span class="(zoom-status|fit-to-canvas)")/,
    surfaces: ['player', 'editor'],
    types: BRANCHING,
    forced: true,
    why:
      'measurement artefact: under forced colours Chromium paints the text in the system colour (computed `color` ' +
      'is rgb(0, 0, 0)) but keeps the author colour in -webkit-text-fill-color, which axe reads; light author text ' +
      'is then compared with the forced white background',
  },
  // UPSTREAM: https://github.com/h5p/h5p-editor-range-list/tree/d1e1118999cedb86bd4f746f8db9dbde8ccbf05c (1.0.13, the score-range table).
  {
    ruleId: 'label',
    html: /^<input class="h5peditor-text" type="text" id="field-to-\d+"/,
    surfaces: ['editor'],
    types: [...RANGE_LIST_TYPES, 'H5P.QuestionSet'],
    why: 'the "to" field of each score range in the overall-feedback table has no label, only a column heading',
  },
  // UPSTREAM: https://github.com/h5p/h5p-editor-vertical-tabs/tree/20df230e6b2f052b61a8dfd9b195c6d12a8a9c86 (1.3.16, vertical-tabs.js).
  {
    ruleId: 'aria-required-children',
    html: /^<ol id="field-[a-z]+-\d+" role="tablist" class="h5p-ul">/,
    surfaces: ['editor'],
    types: VERTICAL_TABS_TYPES,
    why: 'the vertical tab list puts <li> items between role="tablist" and its role="tab" elements',
  },
  // UPSTREAM: https://github.com/h5p/h5p-editor-vertical-tabs/tree/20df230e6b2f052b61a8dfd9b195c6d12a8a9c86 (1.3.16, vertical-tabs.js).
  {
    ruleId: 'aria-required-parent',
    html: /^<div class="h5p-vtab-a" role="tab"/,
    surfaces: ['editor'],
    types: VERTICAL_TABS_TYPES,
    why: 'each role="tab" sits in an <li>, so its parent is not the tablist',
  },
  // UPSTREAM: https://github.com/h5p/h5p-editor-vertical-tabs/tree/20df230e6b2f052b61a8dfd9b195c6d12a8a9c86 (1.3.16, vertical-tabs.js).
  {
    ruleId: 'listitem',
    html: /^<li class="h5p-vtab-li/,
    surfaces: ['editor'],
    types: VERTICAL_TABS_TYPES,
    why: 'the <li> items are children of an <ol role="tablist">, which is no longer a list',
  },
  // UPSTREAM: https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5peditor-semantic-structure.js
  {
    ruleId: 'list',
    html: /^<ul class="h5peditor-widget-select"/,
    surfaces: ['editor'],
    types: ['H5P.QuestionSet'],
    why: 'the editor-mode switch is a <ul> whose items are role="button", so the list has no list items',
  },
  // UPSTREAM: https://github.com/h5p/h5p-editor-image-coordinate-selector/tree/53bd59035df3193d60de571b18be16827ca94c41 (1.2.7).
  {
    ruleId: 'image-alt',
    html: /^<img src="[^"]*\/images\//,
    target: /image-coordinate-selector > img$/,
    surfaces: ['editor'],
    types: ['H5P.ImageHotspots'],
    why: 'the background image of the hotspot position picker has no alt attribute',
  },
  // UPSTREAM: https://github.com/h5p/h5p-drag-n-bar/tree/b475daaf1d5de8d967145072388fb4727a7d8e6a (1.5.23, the paste button).
  {
    ruleId: 'link-name',
    html: /^<a href="#" class="h5p-dragnbar-a h5p-dragnbar-paste-button"><\/a>/,
    surfaces: ['editor'],
    types: ['H5P.CoursePresentation'],
    why: "the slide editor's paste button is an empty link; its name exists only as a tooltip on hover",
  },
  // UPSTREAM: https://github.com/h5p/h5p-editor-branching-scenario/tree/8fcd92d0a5a5f6b855d9d03ce4d19ab31baa4b99 (1.5.13, the guided tour).
  {
    ruleId: 'color-contrast',
    html: /^</,
    surfaces: ['editor'],
    types: BRANCHING,
    forced: false,
    tour: true,
    why:
      'the guided tour that opens with the editor fades everything else to opacity 0.15 without making it inert, ' +
      'so faded text stays readable to keyboard and screen-reader users while it is nearly invisible',
  },
  // UPSTREAM: https://github.com/h5p/h5p-editor-branching-scenario/tree/8fcd92d0a5a5f6b855d9d03ce4d19ab31baa4b99 (1.5.13, the reuse toolbar).
  {
    ruleId: 'color-contrast',
    html: /^<li class="reuse-question disabled"/,
    surfaces: ['editor'],
    types: BRANCHING,
    forced: false,
    why:
      'the "Paste" item is disabled by a class only (no aria-disabled), so its faded text (3.99:1) counts as the ' +
      'text of an active control and assistive technology does not hear that it is unavailable',
  },
  // UPSTREAM: https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5p-hub-client.js (built from h5p/h5p-hub-client).
  {
    ruleId: 'list',
    html: /^<ol>$/,
    target: /iframe > ol$/,
    surfaces: ['hub'],
    types: ['*'],
    why: 'the content-type list is an <ol> whose items are role="button", so the list has no list items',
  },
  // UPSTREAM: https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5p-hub-client.js (built from h5p/h5p-hub-client).
  {
    ruleId: 'nested-interactive',
    html: /^<li (class="h5p-hub-tab-button"|id="h5p-[a-z]+" class="h5p-hub-media)/,
    surfaces: ['hub'],
    types: ['*'],
    why: 'the hub tabs (role="tab") and the content types (role="button") each contain a focusable link or button',
  },
];
