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
 *   - Activity `0` is the editor's own UI state (e.g. whether a field's description is open): it is answered
 *     as "nothing stored" and never written, so no table holds author UI preferences (D-069).
 * Collaborators: ../../h5p/storage/PrismaContentUserDataStorage.ts, Lumi's ContentUserDataManager,
 *   ../requestBodies.ts.
 * Tests: apps/server/test/http/userData.int.test.ts
 */
import { Router, type Request } from 'express';
import { asStateUser } from '../../h5p/HvlH5pUser.js';
import { HttpError } from '../HttpError.js';
import { requireActor } from '../h5pLocals.js';
import type { H5pRouteDeps } from '../h5pRouteDeps.js';
import { formBody } from '../requestBodies.js';
import { pathParam } from '../routeParams.js';

const STATE_PARAMS = ['contentId', 'dataType', 'subContentId'] as const;

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

  // WHY: H5P's editor remembers UI choices as user data of activity 0; it works without them, so they are not kept.
  router.get(
    '/contentUserData/0/:dataType/:subContentId',
    (_req, res) => void res.json({ success: true, data: false }),
  );
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
