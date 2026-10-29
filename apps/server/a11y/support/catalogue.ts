/**
 * catalogue — what the accessibility suites walk through: the colour modes of the axe scans, the ten content
 * types, the web app's routes (the læringsdesign studio's among them) and the studio's seeded views, by the names
 * the suites print.
 *
 * Why: UD-030, UD-008 and DATA-011 say "every route" and "every type". One list keeps the suites from drifting
 *      apart: a route added to the web app is added here once and every check covers it.
 * Spec: UD-030, UD-008, DATA-011, PROD-002
 * Invariants:
 *   - `CONTENT_TYPES` is exactly the ten authorable types (PROD-002); never `H5P.DragQuestion`.
 *   - Routes are paths of the built web app (apps/web/src/app); `activity` and `canvas` are opened through their
 *     helpers in ./pages.ts, because they need an activity or a launch, and `studio` through ./studioViews.ts,
 *     because it needs the seeded data (./studioSeed.ts) or a step after loading.
 * Collaborators: ./pages.ts, ./studioViews.ts, the suites in ../.
 * Tests: apps/server/a11y/axeWebRoutes.a11y.test.ts and the other suites in apps/server/a11y/.
 */

/** The colour modes every axe suite scans in: the light theme, and forced colours emulated (`forcedColors`). */
export const COLOUR_MODES = [
  ['light', 'none'],
  ['forced colours', 'active'],
] as const;

/** The ten authorable content types by main library (PROD-002). */
export const CONTENT_TYPES = [
  'H5P.Blanks',
  'H5P.BranchingScenario',
  'H5P.Column',
  'H5P.CoursePresentation',
  'H5P.DragText',
  'H5P.ImageHotspots',
  'H5P.InteractiveBook',
  'H5P.InteractiveVideo',
  'H5P.MultiChoice',
  'H5P.QuestionSet',
] as const;

/** One of the ten types. */
export type ContentType = (typeof CONTENT_TYPES)[number];

/** A path no route answers; the web app shows its 404 page in the portal chrome. */
export const NOT_FOUND_PATH = '/finst-ikkje';

/**
 * The web app's pages that need no activity, as a signed-out visitor and an author see them: from S5 also the
 * studio's guide (public) and its author pages, which show a sign-in prompt to a visitor (D-089).
 */
export const PLAIN_ROUTES = [
  '/',
  '/hjelp',
  '/personvern',
  '/aktivitet/ny',
  NOT_FOUND_PATH,
  '/laeringsdesign',
  '/laeringsdesign/planlegg',
  '/laeringsdesign/innhaldsbank',
  '/mappe',
] as const;

/** The studio's views that need the seed or a step after loading (./studioViews.ts), besides the plain routes. */
export const STUDIO_VIEWS = [
  'pattern',
  'planner',
  'mappePreview',
  'learningDesign',
  'sharing',
  'copy',
] as const;

/** One of the studio's seeded views. */
export type StudioView = (typeof STUDIO_VIEWS)[number];

/** Each studio view's name in test titles and reports. */
export const STUDIO_VIEW_NAMES: Readonly<Record<StudioView, string>> = {
  pattern: '/laeringsdesign/monster/<id>',
  planner: '/laeringsdesign/planlegg?emne=<course>',
  mappePreview: '/mappe (with a word count)',
  learningDesign: '/aktivitet/<id> (Læringsdesign)',
  sharing: '/aktivitet/<id> (Deling)',
  copy: '/aktivitet/<copy> (attribution)',
};

/** Every view of the web app a suite opens: a plain route, an activity on one tab, the Canvas page or a studio view. */
export type WebView =
  | { readonly kind: 'route'; readonly path: (typeof PLAIN_ROUTES)[number] }
  | { readonly kind: 'activity'; readonly tab: 'play' | 'edit' | 'check' }
  | { readonly kind: 'canvas' }
  | { readonly kind: 'studio'; readonly view: StudioView };

/** Every view of the web app, signed in as the author (the Canvas page through a student's launch). */
export const WEB_VIEWS: readonly WebView[] = [
  ...PLAIN_ROUTES.map((path) => ({ kind: 'route', path }) as const),
  { kind: 'activity', tab: 'play' },
  { kind: 'activity', tab: 'edit' },
  { kind: 'activity', tab: 'check' },
  { kind: 'canvas' },
  ...STUDIO_VIEWS.map((view) => ({ kind: 'studio', view }) as const),
];

/**
 * Whether a view is a page as its address loads it, with focus at the start of the document; the activity page's
 * other tabs are that page after a click, and `/mappe` with a word count is that page after a choice.
 * @param view - The view.
 * @returns True for a view the address alone opens.
 */
export const loadsByAddress = (view: WebView): boolean =>
  view.kind === 'activity' ? view.tab === 'play' : view.kind !== 'studio' || view.view !== 'mappePreview';

/**
 * A view's name in test titles and reports.
 * @param view - The view.
 * @returns e.g. `/hjelp`, `/aktivitet/<id> (edit)`, `/app/play` or `/laeringsdesign/planlegg?emne=<course>`.
 */
export const viewName = (view: WebView): string => {
  if (view.kind === 'route') return view.path;
  if (view.kind === 'activity') return `/aktivitet/<id> (${view.tab})`;
  return view.kind === 'studio' ? STUDIO_VIEW_NAMES[view.view] : '/app/play';
};
