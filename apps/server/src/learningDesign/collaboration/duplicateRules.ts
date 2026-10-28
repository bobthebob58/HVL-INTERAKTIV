/**
 * duplicateRules — who may make a copy of an activity (PROD-007, D-092), as one pure decision.
 *
 * Why: a duplicate copies another person's parameters and files, and Lumi does not refuse a paste source the saver
 *      may not see: it silently saves a copy with the files emptied (D-092 amendment, probe P2). The rule therefore
 *      decides before anything is copied, both for the duplicator and for the editor's own copy-and-paste paths
 *      (../../h5p/pasteSourceGuard.ts). Keeping it free of I/O lets a table test cover every combination.
 * Spec: PROD-007, H5P-006
 * Invariants:
 *   - A copy is a new activity, so only someone who may create activities (`ContentPermission.Create`: an author or
 *     admin in the account view) may duplicate at all.
 *   - Allowed through Edit: the person may Edit the source (owner, co-author or admin, H5P-006).
 *   - Allowed through the bank: the source is published AND listed in the content bank AND the person may View it.
 *   - Unknown content, or content the person may not View, is `unavailable` (404, D-066), never `refused`, so a
 *     refusal reveals nothing about activities the person cannot see.
 *   - `via: 'edit'` wins when both apply: only then are the rationale and course code copied (D-092).
 * Collaborators: ../../h5p/permissions/contentRules.ts (`decideContent`),
 *   ../../h5p/permissions/ContentAccessRepository.ts (facts, including `bankListed`), ./ContentDuplicator.ts,
 *   ../../h5p/pasteSourceGuard.ts.
 * Tests: apps/server/test/learningDesign/collaboration/duplicateRules.test.ts
 */
import { ContentPermission } from '@lumieducation/h5p-server';
import type { HvlH5pUser } from '../../h5p/HvlH5pUser.js';
import type { ContentFacts } from '../../h5p/permissions/ContentAccessRepository.js';
import { decideContent } from '../../h5p/permissions/contentRules.js';

/** How a person who may duplicate reached the source: as one who may Edit it, or through the content bank. */
export type DuplicateRoute = 'edit' | 'bank';

/** The outcome of the duplicate rule for one person and one activity. */
export type DuplicateDecision =
  /** Unknown, or not viewable by this person: answer as if it did not exist (404 `hvl:activity-unavailable`). */
  | { readonly kind: 'unavailable' }
  /** Viewable, but this person may not copy it (403 `hvl:duplicate-not-allowed`). */
  | { readonly kind: 'refused' }
  /** May copy it; `via` says whether the person may also Edit the source. */
  | { readonly kind: 'allowed'; readonly via: DuplicateRoute };

const UNAVAILABLE: DuplicateDecision = Object.freeze({ kind: 'unavailable' });
const REFUSED: DuplicateDecision = Object.freeze({ kind: 'refused' });
const BY_EDIT: DuplicateDecision = Object.freeze({ kind: 'allowed', via: 'edit' });
const BY_BANK: DuplicateDecision = Object.freeze({ kind: 'allowed', via: 'bank' });

/**
 * Decides whether a person may duplicate an activity.
 * @param user - The person, as an issued H5P user (the account view; the state view may not create content).
 * @param facts - The source activity's facts, or `undefined` when it does not exist.
 * @returns `unavailable`, `refused`, or `allowed` with the route that allowed it.
 * @example
 * const decision = decideDuplicate(asAccountUser(actor), await access.factsFor(sourceId));
 * if (decision.kind === 'allowed' && decision.via === 'edit') copyRationaleToo();
 * @spec PROD-007
 */
export function decideDuplicate(user: HvlH5pUser, facts: ContentFacts | undefined): DuplicateDecision {
  if (!facts || !decideContent(user, ContentPermission.View, facts)) return UNAVAILABLE;
  // WHY: the copy is a new activity owned by this person; Lumi would refuse its save anyway, after we read the source.
  if (!decideContent(user, ContentPermission.Create, undefined)) return REFUSED;
  if (decideContent(user, ContentPermission.Edit, facts)) return BY_EDIT;
  // SECURITY: a colleague's activity may be copied only once its owner has listed it in the bank (D-091), which
  // needs it to be published; View alone (e.g. an activity shared with all of HVL) is not consent to copying.
  return facts.status === 'published' && facts.bankListed ? BY_BANK : REFUSED;
}

/**
 * Tells whether a person may duplicate an activity (the editor's paste-source check).
 * @param user - The person.
 * @param facts - The source activity's facts, or `undefined` when it does not exist.
 * @returns True when {@link decideDuplicate} allows it, by either route.
 * @spec PROD-007
 */
export const mayDuplicate = (user: HvlH5pUser, facts: ContentFacts | undefined): boolean =>
  decideDuplicate(user, facts).kind === 'allowed';
