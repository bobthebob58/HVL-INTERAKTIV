/**
 * xapiTarget — checks that a person may report statements about an activity, and reads what the ingestion needs
 * to know about it: its stored ID, current version and main library.
 *
 * Why: LTI-011 checks that the object belongs to content the principal may view; D-102 adds that in Canvas it must be
 *      the launched activity, so a learner's ltik cannot write learning data about another course's activity. The
 *      route contract answers every refusal with the same 403, so it tells nothing about whether an activity
 *      exists (D-066).
 * Spec: LTI-011, H5P-006, DATA-012
 * Invariants:
 *   - SECURITY: View is decided by the H5P-006 matrix (`viewableContent`), the same rules the player uses; unknown,
 *     not viewable and (in Canvas) not the launched activity are one answer, 403 `error.forbidden`.
 *   - SECURITY: an LTI principal reports only about `principal.lti.contentId`, the activity its launch opened; a
 *     Deep Linking launch opens none, so it reports about nothing.
 *   - The main library's category comes from the stored h5p.json (the version the activity was saved with), never
 *     from a statement.
 * Collaborators: ../content/contentAccess.ts, ../content/storedContent.ts (`mainLibraryUbername`),
 *   ./xapiRootTests.ts (`mainLibraryCategory`), ./XapiIngest.ts.
 * Tests: apps/server/test/xapi/xapiRouteAuth.int.test.ts, apps/server/test/xapi/xapiIngest.int.test.ts
 */
import type { Principal } from '../auth/Principal.js';
import { viewableContent } from '../content/contentAccess.js';
import { mainLibraryUbername } from '../content/storedContent.js';
import type { ContentAccessRepository } from '../h5p/permissions/ContentAccessRepository.js';
import { isAuthError } from '../http/authErrors.js';
import { HttpError } from '../http/HttpError.js';
import type { Database } from '../infra/prismaClient.js';
import { mainLibraryCategory } from './xapiRootTests.js';

/** The activity a batch reports about, as the server knows it. */
export interface XapiTarget {
  /** The stored ID (lower-case UUID). */
  readonly contentId: string;
  /** `H5PContent.version` now; a batch may name 1 up to this (D-093, D-115). */
  readonly currentVersion: number;
  /** The main library's machine name, e.g. `H5P.QuestionSet`. */
  readonly mainLibrary: string;
  /** Its category IRI with the saved version (`mainLibraryCategory`); undefined when the version is unknown. */
  readonly mainCategory: string | undefined;
}

/** What the check reads. */
export interface XapiTargetDeps {
  readonly access: ContentAccessRepository;
  readonly db: Database;
}

const forbidden = (): HttpError => new HttpError(403, 'error.forbidden');

/**
 * Checks the reporter and reads the activity.
 * @param deps - Activity facts and the database.
 * @param principal - Who sends the batch.
 * @param contentId - The batch's `contentId` (untrusted).
 * @returns The activity's stored ID, current version and main library.
 * @throws HttpError 403 `error.forbidden` when the activity is unknown, not viewable, or not the launched one.
 * @spec LTI-011
 */
export async function xapiTarget(
  deps: XapiTargetDeps,
  principal: Principal,
  contentId: string,
): Promise<XapiTarget> {
  let canonical: string;
  try {
    canonical = (await viewableContent(deps.access, principal, contentId)).facts.contentId;
  } catch (error) {
    // SECURITY: the contract answers "unknown" and "not yours" alike, with 403 (D-066).
    if (isAuthError(error, 'hvl:activity-unavailable')) throw forbidden();
    throw error;
  }
  // SECURITY: in Canvas only the launched activity, so an ltik writes no data about another course's activity (D-102).
  if (principal.mode === 'lti' && principal.lti?.contentId?.toLowerCase() !== canonical) throw forbidden();
  const row = await deps.db.h5PContent.findUnique({
    where: { id: canonical },
    select: { version: true, mainLibrary: true, metadata: true },
  });
  if (!row) throw forbidden();
  return {
    contentId: canonical,
    currentVersion: row.version,
    mainLibrary: row.mainLibrary,
    mainCategory: mainLibraryCategory(mainLibraryUbername(row.mainLibrary, row.metadata)),
  };
}
