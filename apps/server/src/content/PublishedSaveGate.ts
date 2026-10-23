/**
 * PublishedSaveGate — the publish gate for saves of an activity that is already published, and the version count of
 * every save.
 *
 * Why: D-074 says saving a published activity runs the same gate as publishing: learners see the saved version at
 *      once, so a save that adds an error nobody has explained is refused, while warnings and hints never block
 *      (PROD-003). Every save of an existing activity increases `H5PContent.version`, which xAPI statements record so
 *      insight compares like with like (DATA-012).
 * Spec: PROD-003, UD-022
 * Invariants:
 *   - Drafts pass without validation; a published activity is validated as submitted, not as stored.
 *   - An error is covered by a stored acknowledgement for the same rule and path younger than 14 days; a save cannot
 *     add acknowledgements (that is the publish request's job).
 *   - The caller checks Edit permission first, so the findings of an activity reach only those who may edit it.
 *   - A publish that commits between `beforeSave` and the save is not re-checked here; the publish itself validated
 *     the version it saw, and the next save of the published activity meets the gate.
 * Collaborators: ./storedContent.ts, ./acknowledgementCoverage.ts, ./PublishBlockedError.ts,
 *   ../http/routes/contentRoutes.ts, ../server/createApp.ts.
 * Tests: apps/server/test/content/publishedSave.int.test.ts
 */
import { isContentUuid } from '../h5p/contentIds.js';
import type { Locale } from '../i18n/translate.js';
import type { ValidationMetadata } from '../validation/types.js';
import { hasUncoveredError, withAcknowledgements } from './acknowledgementCoverage.js';
import type { PublishingDeps } from './publishingDeps.js';
import { PublishBlockedError } from './PublishBlockedError.js';
import { recentAcknowledgements } from './storedContent.js';

/** What a save submits, as the validator reads it. */
export interface SubmittedContent {
  /** The library's ubername, e.g. `H5P.MultiChoice 1.16`. */
  readonly mainLibrary: string;
  readonly params: unknown;
  readonly metadata: unknown;
}

/** The two steps around a save that the H5P content route runs (../http/routes/contentRoutes.ts). */
export interface ContentSaveGate {
  /**
   * Refuses a save of a published activity that would leave an error without an acknowledgement.
   * @param contentId - The activity ID from the request path.
   * @param submitted - What the save would store.
   * @param locale - The language of the findings.
   * @throws PublishBlockedError (409 `hvl:published-save-blocked`) with the findings.
   */
  beforeSave(contentId: string, submitted: SubmittedContent, locale: Locale): Promise<void>;
  /**
   * Counts a completed save of an existing activity.
   * @param contentId - The saved activity.
   */
  afterSave(contentId: string): Promise<void>;
}

/** The save gate on PostgreSQL. */
export class PublishedSaveGate implements ContentSaveGate {
  /**
   * @param deps - Database, validator and clock (the same as the publish API's).
   */
  constructor(private readonly deps: PublishingDeps) {}

  /** Validates a save of a published activity; drafts and unknown IDs pass (the editor decides about those). */
  async beforeSave(contentId: string, submitted: SubmittedContent, locale: Locale): Promise<void> {
    if (!isContentUuid(contentId)) return;
    const { db, validator } = this.deps;
    const row = await db.h5PContent.findUnique({
      where: { id: contentId },
      select: { id: true, status: true },
    });
    if (row?.status !== 'published') return;
    const now = this.deps.clock();
    const { mainLibrary, params } = submitted;
    const metadata = (submitted.metadata ?? {}) as ValidationMetadata;
    const findings = validator({ mainLibrary, params, metadata, locale });
    const covered = withAcknowledgements(findings, await recentAcknowledgements(db, row.id, now), now);
    if (hasUncoveredError(covered)) throw new PublishBlockedError(covered, 'hvl:published-save-blocked');
  }

  /** Increases the activity's version by one. */
  async afterSave(contentId: string): Promise<void> {
    await this.deps.db.h5PContent.update({ where: { id: contentId }, data: { version: { increment: 1 } } });
  }
}
