/**
 * sourceAttributionReader — where a copy came from, for the activity detail: the source activity and its title, and
 * the source author's name, read when the copy is shown.
 *
 * Why: PROD-007 keeps a duplicate's link to its source and the original author's attribution. D-092 stores only IDs
 *      on the copy (`sourceContentId`, `sourceAuthorUserId`) and reads the name at display time, so a renamed author
 *      shows their current name and a deleted one is simply unknown.
 * Spec: PROD-007, DATA-002, H5P-006, UD-010
 * Invariants:
 *   - PRIVACY: called only for a person who may Edit the copy (the detail route's `mayEdit`); learners and other
 *     viewers get none of it (D-092 as amended, packages/api-contract/src/sourceAttribution.ts).
 *   - The source's ID and title are given only while the source exists and the person may View it (D-066: an
 *     activity they may not see is not named); the author's display name whenever the account still has one.
 *   - The source's language tag comes with its title, when the source states one, so the web app can mark the
 *     title's language (UD-010, D-092 amendment 2026-10-29).
 *   - An original (no source, no source author) gives an empty object, so its detail is unchanged.
 * Collaborators: ../../http/api/contentListRoutes.ts (the caller), ../../h5p/permissions/contentRules.ts,
 *   ../../h5p/permissions/ContentAccessRepository.ts, ./copyRecords.ts (writes the IDs),
 *   ../../validation/activityLanguage.ts.
 * Tests: apps/server/test/learningDesign/collaboration/sourceAttribution.int.test.ts
 */
import { ContentPermission } from '@lumieducation/h5p-server';
import type { SourceAttribution } from '@hvl-interaktiv/api-contract';
import type { Principal } from '../../auth/Principal.js';
import { principalToH5pActor } from '../../auth/principalToH5pActor.js';
import { asAccountUser } from '../../h5p/HvlH5pUser.js';
import type { ContentAccessRepository } from '../../h5p/permissions/ContentAccessRepository.js';
import { decideContent } from '../../h5p/permissions/contentRules.js';
import type { Database } from '../../infra/prismaClient.js';
import { activityLanguage } from '../../validation/activityLanguage.js';

/**
 * Reads a copy's source attribution for someone who may edit the copy.
 * @param deps - The database and the activity facts.
 * @param principal - Who reads the detail (the caller has checked Edit on the copy).
 * @param copyId - The copy's canonical ID.
 * @returns The fields the person may see; empty for an original.
 * @spec PROD-007
 */
export async function readSourceAttribution(
  deps: { readonly db: Database; readonly access: ContentAccessRepository },
  principal: Principal,
  copyId: string,
): Promise<SourceAttribution> {
  const row = await deps.db.h5PContent.findUnique({
    where: { id: copyId },
    select: {
      sourceContentId: true,
      source: { select: { title: true, metadata: true } },
      sourceAuthor: { select: { displayName: true } },
    },
  });
  if (!row) return {};
  const authorName = row.sourceAuthor?.displayName;
  const attribution: { -readonly [K in keyof SourceAttribution]: SourceAttribution[K] } = {
    ...(authorName ? { sourceAuthorName: authorName } : {}),
  };
  const sourceId = row.sourceContentId;
  if (sourceId && row.source) {
    const facts = await deps.access.factsFor(sourceId);
    // SECURITY: a source the person may no longer view is not named, not even by its ID (D-066).
    if (
      facts &&
      decideContent(asAccountUser(principalToH5pActor(principal)), ContentPermission.View, facts)
    ) {
      attribution.sourceContentId = facts.contentId;
      attribution.sourceTitle = row.source.title;
      const language = activityLanguage(row.source.metadata);
      if (language) attribution.sourceLanguage = language;
    }
  }
  return attribution;
}
