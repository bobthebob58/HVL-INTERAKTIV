/**
 * launchHeader — reads the Canvas launch that Express resolved for `/app/play` from the request header
 * `x-hvli-launch`.
 *
 * Why: the web app never sees the ltik on the server (D-068). Express checks the ltik and the View right first, then
 *      passes the activity's ID, title, the Edit decision, the locale and, when the activity states them, its own
 *      language, its estimated minutes and its one-line purpose in one header it always overwrites
 *      (apps/server/src/web/appLaunch.ts, D-069, PED-032). A missing or malformed header means there is no launch.
 * Spec: LTI-006, LTI-003, UD-010, PED-032
 * Invariants:
 *   - The value is `encodeURIComponent(JSON.stringify({ contentId, title, mayEdit, locale, language?,
 *     estimatedStudentMinutes?, learnerPurpose? }))`.
 *   - Strict: an unknown key, or a value that does not have exactly its type and bounds, is "no launch", never a
 *     partial launch. `language` is a language tag of at most 35 characters (UD-010); the minutes are a whole number
 *     of 1–600; the purpose is one line of 1–200 characters without control characters (the contract's limits,
 *     D-087).
 *   - The header carries no token; the page's script reads the ltik from its own address bar.
 * Collaborators: apps/server/src/web/appLaunch.ts (writes it), ../app/app/play/page.tsx,
 *   ../features/lti/LtiPlayView.tsx, packages/api-contract/src/learnerInfo.ts (the limits mirrored here).
 * Tests: apps/web/test/lti/launchHeader.test.ts
 */
import { headers } from 'next/headers';
import { isLocale, type Locale } from '../i18n/translate';

/** The request header with the launch (same name in apps/server/src/web/appLaunch.ts). */
export const LAUNCH_HEADER = 'x-hvli-launch';

/** What the Canvas page knows about its launch. */
export interface AppLaunch {
  readonly contentId: string;
  readonly title: string;
  /** The launch's person may edit the activity (the **Rediger** tab, LTI-006). */
  readonly mayEdit: boolean;
  readonly locale: Locale;
  /** The activity's own language tag, for the title's `lang` (UD-010); absent when the activity states none. */
  readonly language?: string;
  /** Estimated student minutes, shown before the activity (PED-032); absent when not set. */
  readonly estimatedStudentMinutes?: number;
  /** One line on why the activity matters, in the activity's language (PED-032); absent when not set. */
  readonly learnerPurpose?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The tags apps/server/src/validation/activityLanguage.ts accepts. */
const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/;
/** The longest language tag accepted (RFC 5646 §4.4.1 asks implementations to support 35 characters). */
export const LANGUAGE_TAG_MAX_LENGTH = 35;
/** The most estimated minutes accepted (the contract's `MAX_STUDENT_MINUTES`, D-087; a test keeps them equal). */
export const LAUNCH_MINUTES_MAX = 600;
/** The longest learner purpose in UTF-16 code units (the contract's `LEARNER_PURPOSE_MAX_LENGTH`). */
export const LAUNCH_PURPOSE_MAX_LENGTH = 200;
const KEYS = new Set([
  'contentId',
  'title',
  'mayEdit',
  'locale',
  'language',
  'estimatedStudentMinutes',
  'learnerPurpose',
]);

const isLanguageTag = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= LANGUAGE_TAG_MAX_LENGTH && LANGUAGE_TAG.test(value);
const isMinutes = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= LAUNCH_MINUTES_MAX;
// WHY: learners see the purpose as one line before the activity; a line break or control character is not that.
const isPurpose = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= LAUNCH_PURPOSE_MAX_LENGTH &&
  !/\p{Cc}/u.test(value);

/**
 * The optional fields of a launch, each checked; undefined when one is present but invalid.
 * @param data - The decoded object.
 * @returns The valid optional fields, or undefined.
 */
function optionalFields(data: Record<string, unknown>): Partial<AppLaunch> | undefined {
  const { language, estimatedStudentMinutes, learnerPurpose } = data;
  if (language !== undefined && !isLanguageTag(language)) return undefined;
  if (estimatedStudentMinutes !== undefined && !isMinutes(estimatedStudentMinutes)) return undefined;
  if (learnerPurpose !== undefined && !isPurpose(learnerPurpose)) return undefined;
  return {
    ...(language !== undefined ? { language } : {}),
    ...(estimatedStudentMinutes !== undefined ? { estimatedStudentMinutes } : {}),
    ...(learnerPurpose !== undefined ? { learnerPurpose } : {}),
  };
}

/**
 * Parses the header value.
 * @param value - The header value, if any.
 * @returns The launch, or undefined when there is none or it is malformed.
 */
export function parseLaunch(value: string | null | undefined): AppLaunch | undefined {
  if (!value) return undefined;
  let data: unknown;
  try {
    data = JSON.parse(decodeURIComponent(value));
  } catch {
    return undefined;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return undefined;
  const fields = data as Record<string, unknown>;
  // SECURITY: strict, so a header that Express did not write in exactly this shape is no launch (LTI-003).
  if (Object.keys(fields).some((key) => !KEYS.has(key))) return undefined;
  const { contentId, title, mayEdit, locale } = fields;
  if (typeof contentId !== 'string' || !UUID.test(contentId)) return undefined;
  if (typeof title !== 'string' || typeof mayEdit !== 'boolean') return undefined;
  if (typeof locale !== 'string' || !isLocale(locale)) return undefined;
  const optional = optionalFields(fields);
  return optional ? { contentId, title, mayEdit, locale, ...optional } : undefined;
}

/**
 * The launch of the current request.
 * @returns The launch, or undefined outside a resolved launch.
 */
export async function requestLaunch(): Promise<AppLaunch | undefined> {
  return parseLaunch((await headers()).get(LAUNCH_HEADER));
}
