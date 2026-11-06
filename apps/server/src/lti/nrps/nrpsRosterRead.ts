/**
 * nrpsRosterRead — reads a course's learners from Canvas's Names and Roles service through ltijs's launch context:
 * the full Learner role URI, pages of 50 up to a limit, one new token after a 401, and a time limit on the whole read.
 *
 * Why: LTI-008 counts a course's active learners. ltijs's `namesAndRoles.getMembers` reads the pages and gets the
 *      token, but it has no time limit, sends a refused token again until it expires, and passes our role filter as
 *      given. This module asks the way Canvas answers (S6 traps (a) and (b)) and says whether the roster is complete.
 * Spec: LTI-008
 * Invariants:
 *   - The role filter is always `LEARNER_ROLE_URI`, the full URI: Canvas matches the short name `Learner` to nobody.
 *   - Pages of `NRPS_PAGE_SIZE` (50, Canvas's maximum), at most `maxPages`; ltijs then reports the next page's URL,
 *     and the roster is `complete: false`.
 *   - A 401 (Canvas's answer to an expired or revoked token and to a missing scope alike) drops ltijs's cached token
 *     and reads once more from the first page; a second 401, or any other failure, is thrown to the caller. Retries
 *     are decided on the HTTP status only, never on the body.
 *   - The whole read, the retry included, fails after `timeoutMs`; ltijs's request itself cannot be cancelled and
 *     ends unread in the background.
 *   - PRIVACY: the members are returned to the caller only, in memory; nothing about them is logged here.
 * Collaborators: ./NrpsLearnerCounter.ts (the caller), ./activeLearners.ts (the role URI, the member facts),
 *   ./nrpsTokenCache.ts (drops the refused token), ltijs `LaunchContext.namesAndRoles`.
 * Tests: apps/server/test/lti/nrps/nrpsRosterRead.test.ts, apps/server/test/lti/nrps/NrpsLearnerCounter.int.test.ts,
 *   apps/server/test/lti/nrps/NrpsLearnerCounterFaults.int.test.ts
 */
import { LEARNER_ROLE_URI, type NrpsMemberFacts } from './activeLearners.js';
import type { ForgetNrpsToken, NrpsTokenPlatform } from './nrpsTokenCache.js';

/** NRPS page size: Canvas's default and maximum (tools/mock-platform/canvasMemberships.mjs). */
export const NRPS_PAGE_SIZE = 50;
/** How long one read may take, the retry included, before it counts as failed. */
export const NRPS_TIMEOUT_MS = 60_000;

/** What the read uses of an ltijs launch context (ltijs's `LaunchContext` fits it). */
export interface NrpsLaunch {
  /** The launch's platform; its URL and client ID name ltijs's cached token. */
  readonly platform: NrpsTokenPlatform;
  readonly namesAndRoles: {
    /** Whether the launch carries the NRPS claim. */
    isAvailable(): boolean;
    /** Reads up to `pages` pages of up to `limit` members with `role` (ltijs's `getMembers`). */
    getMembers(options: {
      role: string;
      limit: number;
      pages: number;
    }): Promise<{ readonly members: readonly NrpsMemberFacts[]; readonly next?: string | undefined }>;
  };
}

/** A course's learners as NRPS listed them. */
export interface NrpsRoster {
  /** Every member listed on the pages read. */
  readonly members: readonly NrpsMemberFacts[];
  /** False when the course has more pages than were read. */
  readonly complete: boolean;
}

/** How the roster is read. */
export interface NrpsReadOptions {
  /** `NRPS_MAX_PAGES`. */
  readonly maxPages: number;
  /** Drops the cached token after a 401 (./nrpsTokenCache.ts). */
  readonly forgetToken: ForgetNrpsToken;
  /** `NRPS_TIMEOUT_MS` unless a test shortens it. */
  readonly timeoutMs?: number;
}

/**
 * The HTTP status of a failed ltijs request (its `HttpError`), if any.
 * @param error - What ltijs threw.
 * @returns The status, or undefined for an error without one (a network error, a malformed answer, a timeout).
 */
export const httpStatusOf = (error: unknown): number | undefined => {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : undefined;
};

/** One read of every page, as far as `maxPages` allows. */
async function readPages(launch: NrpsLaunch, maxPages: number): Promise<NrpsRoster> {
  const memberships = await launch.namesAndRoles.getMembers({
    role: LEARNER_ROLE_URI,
    limit: NRPS_PAGE_SIZE,
    pages: maxPages,
  });
  // WHY: ltijs sets `next` only when it stopped at the page limit with a page still to read.
  return { members: memberships.members, complete: memberships.next === undefined };
}

/** Reads, and after a 401 drops the cached token and reads once more. */
async function readWithOneNewToken(launch: NrpsLaunch, options: NrpsReadOptions): Promise<NrpsRoster> {
  try {
    return await readPages(launch, options.maxPages);
  } catch (error) {
    if (httpStatusOf(error) !== 401) throw error;
    // WHY: Canvas answers 401 to a token it no longer accepts and to a missing scope; one new token tells them apart.
    await options.forgetToken(launch.platform);
    return readPages(launch, options.maxPages);
  }
}

/**
 * Reads a course's learners from NRPS.
 * @param launch - The launch's ltijs context, with the NRPS claim (`namesAndRoles.isAvailable()`).
 * @param options - The page limit, the token cache and, for tests, a shorter time limit.
 * @returns The members listed and whether that is the whole course.
 * @throws ltijs's error for a failed read (a second 401, any other status, a malformed answer), or an Error after
 *   the time limit.
 * @spec LTI-008
 */
export async function readLearnerRoster(launch: NrpsLaunch, options: NrpsReadOptions): Promise<NrpsRoster> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('NRPS timeout')), options.timeoutMs ?? NRPS_TIMEOUT_MS);
    timer.unref();
  });
  try {
    return await Promise.race([readWithOneNewToken(launch, options), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
