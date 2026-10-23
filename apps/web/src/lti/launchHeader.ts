/**
 * launchHeader — reads the Canvas launch that Express resolved for `/app/play` from the request header
 * `x-hvli-launch`.
 *
 * Why: the web app never sees the ltik on the server (D-068). Express checks the ltik and the View right first, then
 *      passes the activity's ID, title, the Edit decision and the locale in one header it always overwrites
 *      (apps/server/src/web/appLaunch.ts, D-069). A missing or malformed header means there is no launch.
 * Spec: LTI-006, LTI-003
 * Invariants:
 *   - The value is `encodeURIComponent(JSON.stringify({ contentId, title, mayEdit, locale }))`.
 *   - Anything that does not have exactly those types is "no launch", never a partial launch.
 *   - The header carries no token; the page's script reads the ltik from its own address bar.
 * Collaborators: apps/server/src/web/appLaunch.ts (writes it), ../app/app/play/page.tsx.
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
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (typeof data !== 'object' || data === null) return undefined;
  const { contentId, title, mayEdit, locale } = data as Record<string, unknown>;
  if (typeof contentId !== 'string' || !UUID.test(contentId)) return undefined;
  if (typeof title !== 'string' || typeof mayEdit !== 'boolean') return undefined;
  if (typeof locale !== 'string' || !isLocale(locale)) return undefined;
  return { contentId, title, mayEdit, locale };
}

/**
 * The launch of the current request.
 * @returns The launch, or undefined outside a resolved launch.
 */
export async function requestLaunch(): Promise<AppLaunch | undefined> {
  return parseLaunch((await headers()).get(LAUNCH_HEADER));
}
