/**
 * meRoutes — `GET /api/me` (who is signed in) and `PUT /api/me/notices/:noticeId` (remember a dismissed notice).
 *
 * Why: the web app chooses its views from the person's mode, language and roles, and PROD-011 remembers the
 *      dismissal of the formative-use notice per user in `NoticeDismissal` (D-075), because the Redis session ends at
 *      logout and an LTI launch has none.
 * Spec: PROD-011, DATA-002, DOC-012
 * Auth: either — a portal session (the CSRF token on PUT) or an ltik as `Authorization: Bearer`.
 * Errors: 401 `hvl:unauthenticated`, `hvl:session-expired`, `hvl:ltik-invalid`, `hvl:csrf-invalid`;
 *   PUT also 403 `error.forbidden` (learners), 404 `error.notFound` (a notice ID outside the allowlist) and
 *   400 `error.badRequest` (body).
 * Invariants:
 *   - `/me` never contains a name, e-mail address, Feide ID, LTI subject or user ID (DATA-002).
 *   - Learners never see these notices: they get no dismissals and may not store one, so no learner data is added.
 *   - One row per (user, notice); a PUT replaces the version and the time.
 * Collaborators: ./apiRouter.ts, ./apiBodies.ts, ../../auth/principalLocals.ts, @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/http/api/meRoutes.int.test.ts
 */
import {
  NOTICE_IDS,
  noticeDismissalRequestSchema,
  noticeIdSchema,
  type DismissedNotice,
  type Me,
} from '@hvl-interaktiv/api-contract';
import { Router } from 'express';
import { canAuthor } from '../../auth/Principal.js';
import { requirePrincipal } from '../../auth/principalLocals.js';
import type { Clock } from '../../content/publishingDeps.js';
import type { Database } from '../../infra/prismaClient.js';
import { HttpError } from '../HttpError.js';
import { pathParam } from '../routeParams.js';
import { apiJson, parseBody } from './apiBodies.js';

const isKnownNotice = (id: string): id is DismissedNotice['noticeId'] =>
  (NOTICE_IDS as readonly string[]).includes(id);

/**
 * Builds the `/me` routes.
 * @param deps - The database and the clock of the dismissal time.
 * @returns A router to mount at `/api`.
 */
export function meRoutes(deps: { db: Database; clock: Clock }): Router {
  const router = Router();

  router.get('/me', async (_req, res) => {
    const principal = requirePrincipal(res);
    // PRIVACY: learners never see these notices, so nothing about them is read or stored (D-075).
    const rows = canAuthor(principal)
      ? await deps.db.noticeDismissal.findMany({
          where: { userId: principal.userId },
          select: { noticeId: true, noticeVersion: true },
          orderBy: { noticeId: 'asc' },
        })
      : [];
    const dismissedNotices = rows.flatMap(({ noticeId, noticeVersion }) =>
      isKnownNotice(noticeId) ? [{ noticeId, version: noticeVersion }] : [],
    );
    const me: Me = {
      kind: principal.mode,
      locale: principal.locale,
      roles: [...principal.roles],
      dismissedNotices,
    };
    res.json(me);
  });

  router.put('/me/notices/:noticeId', apiJson('1kb'), async (req, res) => {
    const principal = requirePrincipal(res);
    if (!canAuthor(principal)) throw new HttpError(403, 'error.forbidden');
    const notice = noticeIdSchema.safeParse(pathParam(req, 'noticeId'));
    if (!notice.success) throw new HttpError(404, 'error.notFound');
    const { version } = parseBody(noticeDismissalRequestSchema, req.body);
    const at = deps.clock();
    await deps.db.noticeDismissal.upsert({
      where: { userId_noticeId: { userId: principal.userId, noticeId: notice.data } },
      create: { userId: principal.userId, noticeId: notice.data, noticeVersion: version, at },
      update: { noticeVersion: version, at },
    });
    res.status(204).end();
  });
  return router;
}
