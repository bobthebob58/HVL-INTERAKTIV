/**
 * HvlUrlGenerator — Lumi's URL generator, with the request's token on H5P's AJAX URLs and signed content-file URLs.
 *
 * Why: in Canvas the player runs in a third-party iframe without cookies, so the requests H5P itself makes (AJAX,
 *      learner state, set-finished) must carry the ltik, and in the portal the CSRF token (`H5P-007`, D-057,
 *      D-058). Lumi's `queryParamGenerator` writes the token unencoded into the AJAX and set-finished URLs, but
 *      encoded into the user-data URL, and always adds a pair to set-finished, even for a user without a token;
 *      and `contentFilesUrl` receives no user at all. So this class adds the token itself, URL-encoded, and gives
 *      content files a signed grant (./contentFileGrants.ts) instead of a token.
 * Spec: H5P-007, SEC-004
 * Invariants:
 *   - `name=value` (both URL-encoded) is added only to `ajaxEndpoint`, `contentUserData` and `setFinished`, and
 *     only when the user is an issued HvlH5pUser whose actor has a non-empty `urlToken`; never to another URL.
 *   - `ajaxEndpoint` keeps `action=` last, because H5P appends the action name to it.
 *   - `contentFilesUrl` is `<baseUrl>/files/<grant>/<contentId>`: no token and no user. Lumi calls it only while
 *     rendering the player, after the View check on the activity's parameters; the player factory refuses the
 *     render options that skip that check (./H5pPlayerFactory.ts, `UNCHECKED_RENDER_OPTIONS`).
 *   - Every other URL is Lumi's own, unchanged (tested against Lumi's UrlGenerator).
 * SPEC-DEVIATION: D-058 — H5P-007 names Lumi's `queryParamGenerator`; it cannot encode the token correctly for all
 *   three URLs (see Why), so the token is added here and the generator is not used.
 * Collaborators: ./HvlH5pUser.ts (`urlToken`), ./contentFileGrants.ts, ./H5pEditorFactory.ts,
 *   ./H5pPlayerFactory.ts, ./createH5pRuntime.ts, ../http/routes/signedFileRoutes.ts (serves the file URLs).
 * Tests: apps/server/test/h5p/HvlUrlGenerator.test.ts, apps/server/test/http/signedFiles.int.test.ts
 */
import { UrlGenerator, type ContentId, type IH5PConfig, type IUser } from '@lumieducation/h5p-server';
import type { ContentFileGrants } from './contentFileGrants.js';
import { isHvlH5pUser } from './HvlH5pUser.js';

/** Lumi's AJAX URL ends with this; H5P appends the action name to it. */
const ACTION_QUERY = '?action=';

/** The path under the H5P base URL where ../http/routes/signedFileRoutes.ts serves content files. */
export const SIGNED_FILES_PATH = '/files';

/**
 * The `name=value` query pair for a user's URL token.
 * @param user - Whatever Lumi passes as the acting user.
 * @returns The URL-encoded pair, or undefined when the user is not ours or carries no token.
 */
export function urlTokenQuery(user: IUser | undefined): string | undefined {
  if (!isHvlH5pUser(user)) return undefined;
  const token = user.actor.urlToken;
  if (!token || token.value === '') return undefined;
  return `${encodeURIComponent(token.name)}=${encodeURIComponent(token.value)}`;
}

const appendQuery = (url: string, query: string | undefined): string =>
  query ? `${url}${url.includes('?') ? '&' : '?'}${query}` : url;

function insertBeforeAction(url: string, query: string | undefined): string {
  if (!query) return url;
  // UPSTREAM: Lumi 10.0.4 builds `<base><ajaxUrl>?action=`; see https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/UrlGenerator.ts
  // Remove this guard if a pinned Lumi release encodes the token itself (then use its queryParamGenerator).
  if (!url.endsWith(ACTION_QUERY)) throw new Error('unexpected H5P AJAX URL shape from Lumi');
  return `${url.slice(0, -ACTION_QUERY.length)}?${query}&action=`;
}

/** The URL generator for the editor and the player: Lumi's URLs plus tokens and signed file URLs. */
export class HvlUrlGenerator extends UrlGenerator {
  /**
   * @param config - The H5P config (base URL and route paths).
   * @param grants - Signs the content-file URLs.
   * @param clock - The current time; tests pass a fixed one.
   */
  constructor(
    config: IH5PConfig,
    private readonly grants: ContentFileGrants,
    private readonly clock: () => Date = () => new Date(),
  ) {
    super(config);
    // WHY: Lumi defines these three as instance arrow functions, not prototype methods, so `super.x()` cannot
    // reach them. Its own functions are kept here and their output is extended.
    const lumi = {
      ajaxEndpoint: this.ajaxEndpoint,
      contentUserData: this.contentUserData,
      setFinished: this.setFinished,
    };
    this.ajaxEndpoint = (user) => insertBeforeAction(lumi.ajaxEndpoint(user), urlTokenQuery(user));
    this.contentUserData = (user, contextId, asUserId, options) =>
      appendQuery(lumi.contentUserData(user, contextId, asUserId, options), urlTokenQuery(user));
    this.setFinished = (user) => appendQuery(lumi.setFinished(user), urlTokenQuery(user));
  }

  /**
   * The base of an activity's file URLs, with a fresh grant (H5P appends `/<path>`).
   * @param contentId - The activity whose player is being rendered.
   * @returns `<baseUrl>/files/<grant>/<contentId>`.
   */
  override contentFilesUrl(contentId: ContentId): string {
    const id = String(contentId);
    const grant = this.grants.issueGrant(id, this.clock());
    return `${this.baseUrl()}${SIGNED_FILES_PATH}/${grant}/${encodeURIComponent(id)}`;
  }
}
