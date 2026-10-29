/**
 * PublishedSaveGate — runs a save of an existing activity: the publish gate when the activity is published, then
 * the editor's write, as one step that no publish of the same activity can interleave with.
 *
 * Why: D-074 says saving a published activity runs the same gate as publishing: learners see the saved version at
 *      once, so a save that adds an error nobody has explained is refused, while warnings and hints never block
 *      (PROD-003). `H5PContent.version`, which xAPI statements record so insight compares like with like
 *      (DATA-012), is raised by the editor's write itself, and only for a structural edit (D-093 amends D-074's
 *      "every save"): a text-only edit keeps the learners' state and the version they saved it under.
 * Spec: PROD-003, UD-022, PROD-013
 * Invariants:
 *   - Drafts pass without validation. A published activity is validated as the editor will store it (./savedForm.ts),
 *     never as the request says; a refused save writes nothing.
 *   - The status read, the gate and the editor's write (with its version raise) run inside the activity's
 *     ContentWriteLock, which the publish also holds: a publish either commits before the read (the gate then sees
 *     `published`) or waits until the save is written (its `updatedAt` check then answers 409
 *     `hvl:content-changed`).
 *   - An error is covered by a stored acknowledgement for the same rule and path younger than 14 days; a save cannot
 *     add acknowledgements (that is the publish request's job).
 *   - The caller checks Edit permission first and calls `save` only for someone who may edit, so the findings, and
 *     the lock, reach only them.
 *   - Residual risk (D-074): if the gate's read and Lumi's write of the parameters were more than the lock's lease
 *     apart (a minute; only database reads and semantics walks lie between them, no file transfer), a publish could
 *     again commit in between. The saved form repeats the editor's cleaning steps; ./savedForm.ts says how a new
 *     step is caught.
 * Collaborators: ./savedForm.ts, ./ContentWriteLock.ts, ./storedContent.ts, ./acknowledgementCoverage.ts,
 *   ./PublishBlockedError.ts, ../http/routes/contentRoutes.ts, ../server/createApp.ts.
 * Tests: apps/server/test/content/publishedSave.int.test.ts, apps/server/test/content/saveRace.int.test.ts,
 *   apps/server/test/content/publishedSaveRealTypes.int.test.ts,
 *   apps/server/test/learningDesign/safeEditing/safeEditing.int.test.ts
 */
import { isContentUuid } from '../h5p/contentIds.js';
import type { Locale } from '../i18n/translate.js';
import type { ValidationMetadata } from '../validation/types.js';
import { hasUncoveredError, withAcknowledgements } from './acknowledgementCoverage.js';
import { IN_PROCESS_WRITE_LOCK } from './ContentWriteLock.js';
import type { PublishingDeps } from './publishingDeps.js';
import { PublishBlockedError } from './PublishBlockedError.js';
import type { SavedForm, SubmittedContent } from './savedForm.js';
import { recentAcknowledgements } from './storedContent.js';

/** What a save submits, and the language its findings are given in. */
export interface SubmittedSave extends SubmittedContent {
  readonly locale: Locale;
}

/** The save of an existing activity, as the H5P content route runs it (../http/routes/contentRoutes.ts). */
export interface ContentSaveGate {
  /**
   * Saves an existing activity: for a published one the publish gate first, then `write`.
   * @param contentId - The activity ID from the request path.
   * @param submitted - What the save submits, and the language of the findings.
   * @param write - The editor's save (with its learner-state step, D-093); it returns the saved activity's ID.
   * @returns The saved activity's ID.
   * @throws PublishBlockedError (409 `hvl:published-save-blocked`) with the findings; HttpError 409
   *   `hvl:content-changed` when another save or a publish holds the activity for longer than the lock's wait.
   */
  save(contentId: string, submitted: SubmittedSave, write: () => Promise<string>): Promise<string>;
}

/** The save gate on PostgreSQL. */
export class PublishedSaveGate implements ContentSaveGate {
  /**
   * @param deps - Database, validator, clock and write lock (the same as the publish API's).
   * @param savedForm - What a save will store (`editorSavedForm` from ./savedForm.ts).
   */
  constructor(
    private readonly deps: PublishingDeps,
    private readonly savedForm: SavedForm,
  ) {}

  /** Runs the save under the activity's write lock; IDs that are no UUID go straight to the editor (not found). */
  async save(contentId: string, submitted: SubmittedSave, write: () => Promise<string>): Promise<string> {
    if (!isContentUuid(contentId)) return write();
    const lock = this.deps.writeLock ?? IN_PROCESS_WRITE_LOCK;
    return lock.hold(contentId, async () => {
      await this.check(contentId, submitted);
      return write();
    });
  }

  /** Refuses a save of a published activity that would store an error without an acknowledgement. */
  private async check(contentId: string, submitted: SubmittedSave): Promise<void> {
    const { db, validator } = this.deps;
    const row = await db.h5PContent.findUnique({
      where: { id: contentId },
      select: { id: true, status: true },
    });
    if (row?.status !== 'published') return;
    const saved = await this.savedForm(submitted);
    // WHY: the editor refuses this save before it writes anything, with its own answer.
    if (!saved) return;
    const now = this.deps.clock();
    const metadata = (saved.metadata ?? {}) as ValidationMetadata;
    const findings = validator({ ...saved, metadata, locale: submitted.locale });
    const covered = withAcknowledgements(findings, await recentAcknowledgements(db, row.id, now), now);
    if (hasUncoveredError(covered)) throw new PublishBlockedError(covered, 'hvl:published-save-blocked');
  }
}
