/**
 * paths — every address the web app links to: its own pages, Express's login and logout, and the H5P pages it frames.
 *
 * Why: links and frames must name the same addresses Express serves (D-067, D-068); one list keeps them consistent
 *      and keeps addresses out of the markup, where they would read as user-facing text (DOC-009 lint). The studio's
 *      pages (D-089) keep their state in the address, so a filtered catalogue or a planner view can be shared
 *      (PED-003) and a planner cell can open the catalogue for its phase and course (PED-031, D-088).
 * Spec: UD-013, DATA-006, AUTH-001, LTI-006, PED-003, PED-031
 * Invariants:
 *   - Every path is same-origin; an activity ID, a pattern ID and every query value are percent-encoded.
 *   - The ltik goes only into the two LTI frame addresses, as Express accepts it there (D-069).
 *   - The help and privacy links carry the page's locale (`?lang=`), which Express accepts for a page without a launch
 *     (apps/server/src/web/webRoutes.ts), so a page opened in a new tab from Canvas keeps the language (DATA-006).
 *   - The studio's query names are Norwegian words (`fase`, `type`, `tid`, `emne`) and `fane` names a tab of the
 *     activity page; ./studioFilters.ts reads them back and ignores any value it does not know.
 * Collaborators: ../components/*, ../features/*, ./studioFilters.ts, apps/server/src/web/webRoutes.ts,
 *   apps/server/src/http/routes/*.
 * Tests: apps/web/test/config/paths.test.ts
 */
import type { AuthorableContentType, PhaseKey } from '@hvl-interaktiv/api-contract';
import type { Locale } from '../i18n/translate';

/** The portal's start page. */
export const HOME_PATH = '/';
/** The help page (UD-013). */
export const HELP_PATH = '/hjelp';
/** The privacy notice (DATA-006). */
export const PRIVACY_PATH = '/personvern';
/** The query parameter that names a page's language (same name in apps/server/src/web/webRoutes.ts). */
export const LANG_QUERY = 'lang';

/**
 * A link to the help or privacy page in the language of the page that links to it.
 * @param path - `HELP_PATH` or `PRIVACY_PATH`.
 * @param locale - The linking page's locale.
 * @returns e.g. `/personvern?lang=en`.
 */
export const infoHref = (path: typeof HELP_PATH | typeof PRIVACY_PATH, locale: Locale): string =>
  `${path}?${LANG_QUERY}=${locale}`;

/** The new-activity page. */
export const NEW_ACTIVITY_PATH = '/aktivitet/ny';
/** Express's Feide login (apps/server/src/auth/feide/feideLoginRoutes.ts). */
export const LOGIN_PATH = '/auth/feide/login';
/** Express's logout, a POST with the CSRF token (D-057). */
export const LOGOUT_PATH = '/auth/logout';
/** Express's editor page for a new activity (apps/server/src/http/routes/editorRoutes.ts). */
export const NEW_EDITOR_PATH = '/h5p/new';

const encoded = (contentId: string): string => encodeURIComponent(contentId);

/** The query parameter that names the tab the activity page opens on (`?fane=edit`, D-085). */
export const ACTIVITY_TAB_QUERY = 'fane';

/**
 * The activity page, optionally opened on one of its tabs.
 * @param contentId - The activity.
 * @param tab - A tab `id` from apps/web/src/features/activity/tabs/activityTabs.ts, e.g. `edit`; the page falls back
 *   to **Spel** when the person does not get that tab.
 * @returns `/aktivitet/<id>` or `/aktivitet/<id>?fane=<tab>`.
 */
export const activityPath = (contentId: string, tab?: string): string =>
  `/aktivitet/${encoded(contentId)}${tab ? `?${ACTIVITY_TAB_QUERY}=${encodeURIComponent(tab)}` : ''}`;

/**
 * Express's player page for an activity in the portal.
 * @param contentId - The activity.
 * @returns `/h5p/play/<id>`.
 */
export const playerPath = (contentId: string): string => `/h5p/play/${encoded(contentId)}`;

/**
 * Express's editor page for an activity in the portal.
 * @param contentId - The activity.
 * @returns `/h5p/edit/<id>`.
 */
export const editorPath = (contentId: string): string => `/h5p/edit/${encoded(contentId)}`;

/**
 * Express's player or editor page for the activity of a Canvas launch.
 * @param page - `play` or `edit`.
 * @param ltik - The launch's ltik, kept in page memory.
 * @returns `/lti/play?ltik=…` or `/lti/edit?ltik=…`.
 */
export const ltiFramePath = (page: 'play' | 'edit', ltik: string): string =>
  `/lti/${page}?ltik=${encodeURIComponent(ltik)}`;

/**
 * The Feide login link for a page.
 * @param returnTo - The local path to come back to; omitted for the start page.
 * @returns The login URL.
 */
export const loginHref = (returnTo?: string): string =>
  returnTo && returnTo !== HOME_PATH ? `${LOGIN_PATH}?returnTo=${encodeURIComponent(returnTo)}` : LOGIN_PATH;

/** The læringsdesign guide with the phase matrix and the pattern catalogue; public (D-089). */
export const GUIDE_PATH = '/laeringsdesign';
/** The alignment planner (PED-031); authors only. */
export const PLANNER_PATH = '/laeringsdesign/planlegg';
/** The HVL content bank (PROD-007, D-091); authors only. */
export const BANK_PATH = '/laeringsdesign/innhaldsbank';
/** The pedagogisk mappe export (MAPPE-001); authors only. */
export const MAPPE_PATH = '/mappe';
/** The `id` of the catalogue's section on the guide page, which `catalogueHref` scrolls to. */
export const CATALOGUE_ID = 'monsterkatalog';

/** The query parameter names of the studio pages (PED-003, D-088). */
export const STUDIO_QUERY = {
  /** A phase key, e.g. `forarbeid`. */
  phase: 'fase',
  /** A content type's machine name, e.g. `H5P.MultiChoice`. */
  type: 'type',
  /** The longest build time in minutes, e.g. `30`. */
  buildTime: 'tid',
  /** A normalised course code, e.g. `SYK110`, carried to the planner and to creation from a pattern (D-085). */
  course: 'emne',
} as const;

/** The catalogue's filters and the course a studio page carries; every one is optional. */
export interface StudioFilters {
  readonly phase?: PhaseKey;
  readonly type?: AuthorableContentType;
  /** The longest build time in minutes (1–600). */
  readonly buildTime?: number;
  readonly course?: string;
}

const studioQuery = ({ phase, type, buildTime, course }: StudioFilters): string => {
  const query = new URLSearchParams();
  if (phase) query.set(STUDIO_QUERY.phase, phase);
  if (type) query.set(STUDIO_QUERY.type, type);
  if (buildTime !== undefined) query.set(STUDIO_QUERY.buildTime, String(buildTime));
  if (course) query.set(STUDIO_QUERY.course, course);
  const text = query.toString();
  return text ? `?${text}` : '';
};

/**
 * The pattern catalogue on the guide page, filtered (PED-003); a planner cell opens it for its phase and course.
 * @param filters - The filters to set; none for the whole catalogue.
 * @returns e.g. `/laeringsdesign?fase=etterarbeid&emne=SYK110#monsterkatalog`.
 */
export const catalogueHref = (filters: StudioFilters = {}): string =>
  `${GUIDE_PATH}${studioQuery(filters)}#${CATALOGUE_ID}`;

/**
 * One pattern's page, with the phase and course that creating from it pre-fills (D-085, D-088).
 * @param patternId - The pattern, e.g. `fa-video`.
 * @param context - The phase and course carried from the catalogue or the planner.
 * @returns e.g. `/laeringsdesign/monster/fa-video?emne=SYK110`.
 */
export const patternPath = (
  patternId: string,
  context: Pick<StudioFilters, 'phase' | 'course'> = {},
): string => `${GUIDE_PATH}/monster/${encodeURIComponent(patternId)}${studioQuery(context)}`;

/**
 * The alignment planner for one course (PED-031).
 * @param course - The course code; none lets the author choose one.
 * @returns e.g. `/laeringsdesign/planlegg?emne=SYK110`.
 */
export const plannerHref = (course?: string): string => `${PLANNER_PATH}${studioQuery({ course })}`;
