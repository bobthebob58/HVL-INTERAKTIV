/**
 * userDataRoutes — reads and saves a learner's state of an activity ("where was I?").
 *
 * Why: the H5P player saves the learner's answers so a reload resumes them (H5P-005). The state belongs to the
 *      learner's pseudonym in the course they came from, so the routes use the actor's state view
 *      (`id` = learnerKey) and the actor's context. Lumi would take both from the query (`contextId`,
 *      `asUserId`); here the query cannot choose whose or which course's state is read (D-036).
 * Spec: H5P-005, PROD-008, H5P-006, DATA-002
 * Invariants:
 *   - The user is `asStateUser(actor)`; `contextId` is the actor's; a `contextId` query value is ignored.
 *   - `asUserId` in the query is refused with 400 (reading another learner's state is not a player feature).
 *   - Answers have H5P's shape: `{ success: true, data }`, with `data: false` when nothing is stored.
 *   - `data=0` deletes the state (H5P's reset), handled by the storage (D-038).
 *   - Activity `0` is the editor's own UI state (whether a field's description is open, whether a guided tour was
 *     seen); it is never written, so no table holds author UI preferences (D-069). GET answers BranchingScenario's
 *     tour flags (`h5p-editor-branching-scenario-*tour-v1-seen`) with H5P's error shape
 *     `{ success: false, message: 'hvl:editor-ui-state-not-kept' }`, so H5P keeps the flag the browser holds, and
 *     every other flag with `data: false`, which H5P reads as not set (D-069 amendment).
 * Collaborators: ../../h5p/storage/PrismaContentUserDataStorage.ts, Lumi's ContentUserDataManager,
 *   ../requestBodies.ts.
 * Tests: apps/server/test/http/userData.int.test.ts, apps/server/test/h5p/branchingTour.browser.int.test.ts
 */
import { Router, type Request } from 'express';
import { asStateUser } from '../../h5p/HvlH5pUser.js';
import { HttpError } from '../HttpError.js';
import { requireActor } from '../h5pLocals.js';
import type { H5pRouteDeps } from '../h5pRouteDeps.js';
import { formBody } from '../requestBodies.js';
import { pathParam } from '../routeParams.js';

const STATE_PARAMS = ['contentId', 'dataType', 'subContentId'] as const;

/** BranchingScenario's guided-tour flags (H5PEditor.BranchingScenario 1.5.13 has three tours). */
const BS_TOUR_FLAG = /^h5p-editor-branching-scenario-[a-z-]*tour-v1-seen$/;

const refuseOtherLearner = (req: Request): void => {
  if (req.query.asUserId !== undefined) throw new HttpError(400, 'h5p.userData.asUserNotSupported');
};

/** H5P sends flags as the strings "1" and "0". */
const flag = (value: unknown): boolean => value === '1' || value === 1 || value === true;

/**
 * Builds the learner-state routes.
 * @param deps - The editor (its user-data manager uses our permission system and storage).
 * @returns A router for `GET` and `POST /contentUserData/:contentId/:dataType/:subContentId`.
 */
export function userDataRoutes(deps: H5pRouteDeps): Router {
  const router = Router();
  const path = '/contentUserData/:contentId/:dataType/:subContentId';
  const manager = deps.editor.contentUserDataManager;

  // UPSTREAM: https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5peditor.js
  // UPSTREAM: https://github.com/h5p/h5p-editor-branching-scenario/blob/8fcd92d0a5a5f6b855d9d03ce4d19ab31baa4b99/src/scripts/helpers/UserStorage.js
  // WHY: H5P's editors keep UI flags in localStorage and let this answer override them. `data: false` reads as
  // "not set": right for an important description (open until the author closes it), wrong for BranchingScenario's
  // tours, which then started on every open and faded the editor. An error answer keeps the browser's flag. No issue
  // filed (it follows how the pinned editors read the answer; D-080 amendment of 2026-10-24, V2D-5). Remove when HVL
  // keeps author UI flags itself, or when H5P's editors stop letting the server's answer override localStorage.
  // Covered by apps/server/test/http/userData.int.test.ts and apps/server/test/h5p/branchingTour.browser.int.test.ts.
  router.get('/contentUserData/0/:dataType/:subContentId', (req, res) => {
    const tour = BS_TOUR_FLAG.test(pathParam(req, 'dataType'));
    res.json(
      tour ? { success: false, message: 'hvl:editor-ui-state-not-kept' } : { success: true, data: false },
    );
  });
  router.post('/contentUserData/0/:dataType/:subContentId', (_req, res) => void res.json({ success: true }));

  router.get(path, async (req, res) => {
    refuseOtherLearner(req);
    const actor = requireActor(res);
    const [contentId, dataType, subContentId] = STATE_PARAMS.map((name) => pathParam(req, name)) as [
      string,
      string,
      string,
    ];
    const stored = await manager.getContentUserData(
      contentId,
      dataType,
      subContentId,
      asStateUser(actor),
      actor.contextId,
    );
    res.json({ success: true, data: stored?.userState ?? false });
  });

  router.post(path, ...formBody('2mb'), async (req, res) => {
    refuseOtherLearner(req);
    const actor = requireActor(res);
    const [contentId, dataType, subContentId] = STATE_PARAMS.map((name) => pathParam(req, name)) as [
      string,
      string,
      string,
    ];
    const body = req.body as Record<string, unknown>;
    if (typeof body.data !== 'string') throw new HttpError(400, 'error.badRequest');
    await manager.createOrUpdateContentUserData(
      contentId,
      dataType,
      subContentId,
      body.data,
      flag(body.invalidate),
      flag(body.preload),
      asStateUser(actor),
      actor.contextId,
    );
    res.json({ success: true });
  });
  return router;
}
