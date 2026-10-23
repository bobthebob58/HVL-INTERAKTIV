/**
 * contentSharingRoutes — `PATCH /api/content/:contentId/sharing`, which changes who can find an activity.
 *
 * Why: PROD-006 lets the owner and co-authors share an activity with everyone at HVL or everyone with Feide; the
 *      change applies at once because every View check reads the stored visibility. Every change is audited
 *      (DATA-007) with the old and new value.
 * Spec: PROD-006, PROD-004, DATA-007
 * Invariants:
 *   - The principal comes from the authentication middleware: a portal request has passed the CSRF check and an
 *     LTI request carried its ltik as a Bearer token (D-057, D-058).
 *   - Only `visibility` changes; the status (draft/published) is never touched here (D-066).
 *   - The update and its audit record are written in one transaction, and the update applies only if the visibility
 *     is still the one checked; otherwise 409 `hvl:sharing-changed` (a concurrent change), so the audit trail holds.
 *   - The canonical activity ID is updated, audited and returned, whatever letter case the path used.
 * Collaborators: ./contentSharing.ts, ../../auth/principalLocals.ts, ../../h5p/permissions/ContentAccessRepository.ts.
 * Tests: apps/server/test/http/api/contentSharingRoutes.int.test.ts
 */
import express, { Router } from 'express';
import { z } from 'zod';
import { requirePrincipal } from '../../auth/principalLocals.js';
import type { ContentAccessRepository } from '../../h5p/permissions/ContentAccessRepository.js';
import type { Database } from '../../infra/prismaClient.js';
import { authError } from '../authErrors.js';
import { HttpError } from '../HttpError.js';
import { pathParam } from '../routeParams.js';
import { sharingRefusal } from './contentSharing.js';

const BODY = z.strictObject({ visibility: z.enum(['private', 'organisation', 'feide']) });

/**
 * Builds the sharing route.
 * @param deps - The database and the activity facts.
 * @returns A router to mount at `/api`.
 */
export function contentSharingRoutes(deps: { db: Database; access: ContentAccessRepository }): Router {
  const router = Router();
  router.patch('/content/:contentId/sharing', express.json({ limit: '2kb' }), async (req, res) => {
    const principal = requirePrincipal(res);
    const body = BODY.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'error.badRequest');
    const to = body.data.visibility;
    const contentId = pathParam(req, 'contentId');
    const facts = await deps.access.factsFor(contentId);
    const refusal = sharingRefusal(principal, facts, to);
    if (refusal || !facts) throw authError(refusal ?? 'hvl:activity-unavailable');
    const id = facts.contentId;
    await deps.db.$transaction(async (tx) => {
      // WHY: the update holds only if nothing changed since the check, so the audit's "from" is always true.
      const { count } = await tx.h5PContent.updateMany({
        where: { id, visibility: facts.visibility },
        data: { visibility: to },
      });
      if (count === 0) throw new HttpError(409, 'error.sharingChanged', {}, 'hvl:sharing-changed');
      await tx.auditEvent.create({
        data: {
          actorUserId: principal.userId,
          action: 'content.sharing.change',
          targetType: 'H5PContent',
          targetId: id,
          details: { from: facts.visibility, to, mode: principal.mode },
        },
      });
    });
    res.set('Cache-Control', 'no-store').json({ contentId: id, visibility: to });
  });
  return router;
}
