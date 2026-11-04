/**
 * insightAccess — who may see an activity's insight, and for which contexts: the activity's owner and co-authors for
 * the portal's plays and every Canvas course it is placed in, and a Canvas author for the launch's course only.
 *
 * Why: INS-007 as D-106 amends it. For a context, the owner and co-authors see insight, and so does an LTI author whose
 *      launch comes from that context, whether or not they own the activity (after a course copy, LTI-007). In
 *      `/app/play` the context is the launch's and cannot be changed, so a Canvas principal sees that course only,
 *      also when they own the activity. Learners never see insight, and an admin gets none through the role: the
 *      audited support action is not built in S6. The rules are the grade-sync status's (D-106), kept here so each
 *      area states its own.
 * Spec: INS-007, LTI-006, LTI-007
 * Invariants:
 *   - View is checked first (H5P-006, `viewableContent`): an activity the person may not view is 404
 *     `hvl:activity-unavailable` like an unknown one (D-066), so a 403 only tells something to a person who can open
 *     the activity anyway.
 *   - SECURITY: only a principal with the `author` role gets a reader; in the portal only an owner or co-author; in
 *     Canvas only for a launch course that can be stored (D-103) and that the activity is placed in.
 *   - The Canvas course is the launch's (`principal.lti`), never one from the request; a requested context other
 *     than it is 403. In the portal a context the activity does not have is 400.
 * Collaborators: ../../content/contentAccess.ts, ../../xapi/platformContextKey.ts, ../InsightService.ts
 *   (`contexts`), ./insightRoutes.ts.
 * Tests: apps/server/test/insight/http/insightAccess.test.ts,
 *   apps/server/test/insight/http/insightPermissions.int.test.ts
 */
import {
  PORTAL_CONTEXT_KEY,
  type InsightContext,
  type InsightContextKey,
} from '@hvl-interaktiv/api-contract';
import type { Principal } from '../../auth/Principal.js';
import { viewableContent } from '../../content/contentAccess.js';
import type { ContentAccessRepository, ContentFacts } from '../../h5p/permissions/ContentAccessRepository.js';
import { HttpError } from '../../http/HttpError.js';
import type { Database } from '../../infra/prismaClient.js';
import { parsePlatformContextKey, principalContextKey } from '../../xapi/platformContextKey.js';

/** Whose insight a person may see: every context of the activity, or one Canvas course. */
export type InsightReader =
  { readonly kind: 'editor' } | { readonly kind: 'course'; readonly contextKey: string };

/** A person admitted to an activity's insight. */
export interface InsightAccess {
  /** The stored activity ID (lower-case UUID). */
  readonly contentId: string;
  readonly reader: InsightReader;
  /** H5P-006 Edit: whether acknowledgement reasons may be shown (INS-010). */
  readonly mayEdit: boolean;
}

/**
 * The reader a person is for one activity they may view; pure, so the rules are tested as a table.
 * @param principal - Who asks.
 * @param facts - The activity's owner and co-authors.
 * @returns The reader, or undefined when the person may see no insight of it (403).
 * @spec INS-007
 */
export function insightReader(
  principal: Pick<Principal, 'userId' | 'roles' | 'mode' | 'lti'>,
  facts: Pick<ContentFacts, 'ownerUserId' | 'coAuthorIds'>,
): InsightReader | undefined {
  // SECURITY: learners never see insight, and admin alone grants nothing (D-106): the author role is needed.
  if (!principal.roles.includes('author')) return undefined;
  if (principal.mode === 'lti') {
    // WHY: in Canvas the view is the launch's course only (D-106); a launch without a storable course has none.
    const contextKey = principalContextKey(principal);
    return typeof contextKey === 'string' ? { kind: 'course', contextKey } : undefined;
  }
  const editor = facts.ownerUserId === principal.userId || facts.coAuthorIds.includes(principal.userId);
  return editor ? { kind: 'editor' } : undefined;
}

/**
 * Checks that a person may see an activity's insight.
 * @param deps - The activity facts and the database (for the Canvas placement).
 * @param principal - Who asks.
 * @param contentId - The ID from the path (untrusted).
 * @returns The canonical ID, the reader and whether the person may edit the activity.
 * @throws HttpError 404 `hvl:activity-unavailable` when the activity is unknown or not viewable; 403
 *   `error.forbidden` when the person may view it but see none of its insight.
 * @spec INS-007
 */
export async function insightAccess(
  deps: { readonly access: ContentAccessRepository; readonly db: Database },
  principal: Principal,
  contentId: string,
): Promise<InsightAccess> {
  const { facts, mayEdit } = await viewableContent(deps.access, principal, contentId);
  const reader = insightReader(principal, facts);
  if (!reader) throw new HttpError(403, 'error.forbidden');
  if (reader.kind === 'course') {
    const course = parsePlatformContextKey(reader.contextKey);
    const placement =
      course &&
      (await deps.db.ltiPlacement.findFirst({
        where: { contentId: facts.contentId, platformId: course.platformId, contextId: course.contextId },
        select: { id: true },
      }));
    // SECURITY: a Canvas author sees an activity's insight only through a course it is placed in (D-106).
    if (!placement) throw new HttpError(403, 'error.forbidden');
  }
  return { contentId: facts.contentId, reader, mayEdit };
}

/**
 * The contexts a reader may choose from.
 * @param reader - Who reads.
 * @param all - Every context of the activity (`InsightService.contexts`): the portal, then its courses.
 * @returns All of them for an owner or co-author; the launch's course alone in Canvas.
 * @spec INS-007
 */
export function readerContexts(reader: InsightReader, all: readonly InsightContext[]): InsightContext[] {
  if (reader.kind === 'editor') return [...all];
  return all.filter((context) => context.key === reader.contextKey);
}

/**
 * The context one view covers.
 * @param reader - Who reads.
 * @param requested - The query's context, if any.
 * @param contexts - Every context of the activity, read only when an owner or co-author names a course.
 * @returns The launch's course in Canvas; otherwise the requested context, the portal by default.
 * @throws HttpError 403 `error.forbidden` in Canvas for another context; 400 `error.badRequest` in the portal for a
 *   course the activity is not placed in.
 * @spec INS-007
 */
export async function viewContext(
  reader: InsightReader,
  requested: InsightContextKey | undefined,
  contexts: () => Promise<readonly InsightContext[]>,
): Promise<InsightContextKey> {
  if (reader.kind === 'course') {
    // SECURITY: the context is the launch's and cannot be changed (D-106); naming another is refused, not ignored.
    if (requested !== undefined && requested !== reader.contextKey)
      throw new HttpError(403, 'error.forbidden');
    return reader.contextKey;
  }
  const key = requested ?? PORTAL_CONTEXT_KEY;
  if (key !== PORTAL_CONTEXT_KEY && !(await contexts()).some((context) => context.key === key)) {
    throw new HttpError(400, 'error.badRequest');
  }
  return key;
}
