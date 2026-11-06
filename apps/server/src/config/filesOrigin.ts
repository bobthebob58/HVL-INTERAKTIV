/**
 * filesOrigin — the origin the player's user files are served from: `FILES_BASE_URL`, or `files.<host>` of
 * `PUBLIC_BASE_URL`, and the rules that keep it apart from the app's origin.
 *
 * Why: a file an author uploaded may be crafted (CVE-2025-7062). Served from another host, a script in it can reach
 *      neither the app's origin nor its cookies or the ltik in its pages (`SEC-004`, D-012, D-045). The setting and
 *      its default are D-110's (amendment of 2026-11-05).
 * Spec: SEC-004, DOC-008
 * Invariants:
 *   - The files origin is an origin (scheme, host and port), never a path; the default keeps the app's scheme and
 *     port and puts `files.` before its host (`http://files.localhost:3000` in development).
 *   - Its host differs from the app's host in every environment: a browser sends a host's cookies to all of its
 *     ports (RFC 6265 §8.5), so a second port on the same host would not keep the cookies away.
 *   - An app host that is an IP address has no `files.` name, so `FILES_BASE_URL` must then be set.
 *   - Production requires https: a set `FILES_BASE_URL` is checked here; the default inherits `PUBLIC_BASE_URL`'s
 *     scheme, which ./productionChecks.ts already requires to be https, so it is not reported twice.
 *   - Messages name the variable, never its value.
 * Collaborators: ./env.ts (`loadEnv` collects the problems), ../h5p/createH5pRuntime.ts (the player's file URLs and
 *   page policy), ../http/createH5pRouter.ts (`createFilesHostRouter`) and ../http/filesOriginRouter.ts (which requests
 *   go to the files origin), ../server/createApp.ts (mounts it).
 * Tests: apps/server/test/config/filesOrigin.test.ts
 */
import { isIP } from 'node:net';

/** The variables the files origin is decided from. */
export interface FilesOriginSettings {
  /** The app's origin (`PUBLIC_BASE_URL`). */
  readonly PUBLIC_BASE_URL: string;
  /** The files origin, when set (`FILES_BASE_URL`, already reduced to an origin by ./env.ts). */
  readonly FILES_BASE_URL?: string | undefined;
}

/** The prefix the default files host puts before the app's host (D-110: `files.<host>`). */
export const FILES_HOST_PREFIX = 'files.';

// WHY: `URL.hostname` keeps the brackets of an IPv6 literal, which `isIP` does not accept.
const isIpHost = (hostname: string): boolean => isIP(hostname.replace(/^\[|\]$/g, '')) !== 0;

/**
 * The origin the player's files come from.
 * @param settings - `PUBLIC_BASE_URL` and, when set, `FILES_BASE_URL`.
 * @returns `FILES_BASE_URL`, or `<scheme>://files.<host>[:port]` of `PUBLIC_BASE_URL`.
 * @throws Error when `FILES_BASE_URL` is unset and the app's host is an IP address (`loadEnv` reports this first).
 */
export function filesOriginOf(settings: FilesOriginSettings): string {
  if (settings.FILES_BASE_URL) return settings.FILES_BASE_URL;
  const app = new URL(settings.PUBLIC_BASE_URL);
  if (isIpHost(app.hostname))
    throw new Error('FILES_BASE_URL must be set when the app host is an IP address');
  return `${app.protocol}//${FILES_HOST_PREFIX}${app.host}`;
}

/**
 * Says what is wrong with the files origin, if anything.
 * @param settings - `PUBLIC_BASE_URL` and, when set, `FILES_BASE_URL`, both parsed by ./env.ts.
 * @param production - Whether `NODE_ENV` is `production` (then https is required).
 * @returns One message per problem, each naming the variable; empty when the files origin is usable.
 */
export function filesOriginProblems(settings: FilesOriginSettings, production: boolean): string[] {
  const app = new URL(settings.PUBLIC_BASE_URL);
  if (!settings.FILES_BASE_URL && isIpHost(app.hostname)) {
    return [
      "FILES_BASE_URL: must be set when PUBLIC_BASE_URL's host is an IP address (no files.<host> exists)",
    ];
  }
  const files = new URL(filesOriginOf(settings));
  const problems: string[] = [];
  // SECURITY: cookies are scoped by host, not by port; the same host on another port would receive the app's cookies.
  if (files.hostname.toLowerCase() === app.hostname.toLowerCase()) {
    problems.push(
      'FILES_BASE_URL: must name another host than PUBLIC_BASE_URL (cookies reach every port of a host)',
    );
  }
  if (production && settings.FILES_BASE_URL && files.protocol !== 'https:') {
    problems.push('FILES_BASE_URL: must use https in production');
  }
  return problems;
}
