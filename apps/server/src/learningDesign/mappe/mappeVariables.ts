/**
 * mappeVariables — the names a pedagogisk mappe template may use: its values, its lists with their item values, and
 * its markers, which place the blocks the server builds (the reader's guide, the references) and delimit the parts it
 * counts (Del 1's words, the suggested attachments).
 *
 * Why: D-094 checks every tag of `content/mappe/template.{nn,nb,en}.md` against an allowlist when the content loads, so
 *      a misspelt name stops the start instead of silently leaving a value out, and Mustache can never reach a name
 *      the view does not define (a prototype name such as `toString`, probe P5). The loader and the view builder
 *      both read this one table, so they cannot disagree about a name.
 * Spec: MAPPE-002
 * Invariants:
 *   - Names are Nynorsk domain terms in lower-case ASCII with `_` (GLOSSARY: Norwegian terms keep their form), the
 *     same in all three languages' templates.
 *   - Within one chain of scopes (top level → a list → a list inside it) no name repeats, so an item's own value
 *     can never be mistaken for a value of the level around it.
 *   - Every value is text when it reaches Mustache: the view builder formats numbers and dates first, and gives a
 *     localised placeholder for anything unknown, so no value is ever empty (D-094 probe amendment).
 *   - A marker is not a value: it stands alone on its own line, outside every section, exactly once.
 * Collaborators: ../content/mappeTemplateTags.ts (checks templates against it), ./mappeView.ts (builds a view with
 *   exactly these keys), content/mappe/README.md (lists them for ALU).
 * Tests: apps/server/test/learningDesign/content/mappeTemplateLoader.test.ts,
 *   apps/server/test/learningDesign/mappe/mappeView.test.ts
 */

/** One level of names: the values a template may write there and the lists it may open there. */
export interface MappeScope {
  readonly values: readonly string[];
  readonly lists: Readonly<Record<string, MappeScope>>;
}

/** The values of one validator finding about universal design (inside `uu_merknader`). */
const FINDING_SCOPE = {
  values: ['alvor', 'melding', 'uu_grunngjeving'],
  lists: {},
} as const satisfies MappeScope;

/** The values of one selected activity (inside `aktivitetar`). */
const ACTIVITY_SCOPE = {
  values: [
    'tittel',
    'innhaldstype',
    'status',
    'fase',
    'emne',
    'laeringsutbytte',
    'grunngjeving',
    'uu_status',
    'lenke',
    'resultat',
    'deltakarar',
    'fullforing',
    'median_forsok',
    'endring',
    'oppretta',
    'endra',
    'publisert',
  ],
  lists: { uu_merknader: FINDING_SCOPE },
} as const satisfies MappeScope;

/** The values of one course in the course overview (inside `emneoversikt`). */
const COURSE_SCOPE = {
  values: ['emnekode', 'tal', 'fasar'],
  lists: {},
} as const satisfies MappeScope;

/**
 * The names a template may use outside every section, with the lists it may open and their items' names.
 * @spec MAPPE-002
 */
export const MAPPE_TEMPLATE_SCOPE = {
  values: [
    'forfattar',
    'dato',
    'k',
    'ordtal_del1',
    'ordgrense',
    'maks_vedlegg',
    'kriteriesett',
    'aktivitetar_tal',
    'samarbeid_tal',
    'resultat_merknad',
  ],
  lists: { aktivitetar: ACTIVITY_SCOPE, emneoversikt: COURSE_SCOPE },
} as const satisfies MappeScope;

/**
 * The markers, each alone on its own line exactly once: where the reader's guide and the references go, and the
 * pairs around Del 1 (its word count) and around the suggested attachments (their count).
 * @spec MAPPE-002
 */
export const MAPPE_MARKERS = [
  'lesarrettleiing',
  'del1_start',
  'del1_slutt',
  'referansar',
  'vedlegg_start',
  'vedlegg_slutt',
] as const;

/** A marker name. */
export type MappeMarker = (typeof MAPPE_MARKERS)[number];

/** The markers whose place the server fills with a block it builds. */
export const MAPPE_BLOCK_MARKERS = [
  'lesarrettleiing',
  'referansar',
] as const satisfies readonly MappeMarker[];

/** A marker that the server fills. */
export type MappeBlockMarker = (typeof MAPPE_BLOCK_MARKERS)[number];

/** The pairs of markers that delimit a counted part, start first. */
export const MAPPE_MARKER_PAIRS = [
  ['del1_start', 'del1_slutt'],
  ['vedlegg_start', 'vedlegg_slutt'],
] as const satisfies readonly (readonly [MappeMarker, MappeMarker])[];

/**
 * Tells whether a name is a marker.
 * @param name - A tag's name.
 * @returns True for one of `MAPPE_MARKERS`.
 */
export const isMappeMarker = (name: string): name is MappeMarker =>
  (MAPPE_MARKERS as readonly string[]).includes(name);

/** The top-level values of a view: text for every name of `MAPPE_TEMPLATE_SCOPE.values`. */
export type MappeTopValues = Readonly<Record<(typeof MAPPE_TEMPLATE_SCOPE.values)[number], string>>;

/** One finding in a view (`uu_merknader`). */
export type MappeFindingView = Readonly<Record<(typeof FINDING_SCOPE.values)[number], string>>;

/** One activity in a view (`aktivitetar`): every item value as text, and its findings. */
export type MappeActivityView = Readonly<Record<(typeof ACTIVITY_SCOPE.values)[number], string>> & {
  readonly uu_merknader: readonly MappeFindingView[];
};

/** One course in a view (`emneoversikt`). */
export type MappeCourseView = Readonly<Record<(typeof COURSE_SCOPE.values)[number], string>>;

/** The whole view a template is rendered with; the markers are not part of it. */
export type MappeView = MappeTopValues & {
  readonly aktivitetar: readonly MappeActivityView[];
  readonly emneoversikt: readonly MappeCourseView[];
};
