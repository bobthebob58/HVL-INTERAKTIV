/**
 * catalogue — what the accessibility suites walk through: the colour modes of the axe scans, the ten content
 * types, the web app's routes and the server's own pages, by the names the suites print.
 *
 * Why: UD-030, UD-008 and DATA-011 say "every route" and "every type". One list keeps the suites from drifting
 *      apart: a route added to the web app is added here once and every check covers it.
 * Spec: UD-030, UD-008, DATA-011, PROD-002
 * Invariants:
 *   - `CONTENT_TYPES` is exactly the ten authorable types (PROD-002); never `H5P.DragQuestion`.
 *   - Routes are paths of the built web app (apps/web/src/app); `activity` and `canvas` are opened through their
 *     helpers in ./pages.ts, because they need an activity or a launch.
 * Collaborators: ./pages.ts, the suites in ../.
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

/** The web app's pages that need no activity, as a signed-out visitor and an author see them. */
export const PLAIN_ROUTES = ['/', '/hjelp', '/personvern', '/aktivitet/ny', NOT_FOUND_PATH] as const;

/** Every view of the web app a suite opens: a plain route, an activity on one tab, or the Canvas page. */
export type WebView =
  | { readonly kind: 'route'; readonly path: (typeof PLAIN_ROUTES)[number] }
  | { readonly kind: 'activity'; readonly tab: 'play' | 'edit' | 'check' }
  | { readonly kind: 'canvas' };

/** Every view of the web app, signed in as the author (the Canvas page through a student's launch). */
export const WEB_VIEWS: readonly WebView[] = [
  ...PLAIN_ROUTES.map((path) => ({ kind: 'route', path }) as const),
  { kind: 'activity', tab: 'play' },
  { kind: 'activity', tab: 'edit' },
  { kind: 'activity', tab: 'check' },
  { kind: 'canvas' },
];

/**
 * A view's name in test titles and reports.
 * @param view - The view.
 * @returns e.g. `/hjelp`, `/aktivitet/<id> (edit)` or `/app/play`.
 */
export const viewName = (view: WebView): string =>
  view.kind === 'route'
    ? view.path
    : view.kind === 'activity'
      ? `/aktivitet/<id> (${view.tab})`
      : '/app/play';
