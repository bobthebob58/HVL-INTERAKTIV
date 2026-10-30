/**
 * Integration tests of who may answer the save choice, through the real routes on a real MultiChoice (PROD-013,
 * D-093, D-098): a teacher's structural save from Canvas (the ltik as Bearer) is asked and then goes through with the
 * confirmation, its 409 in Canvas's words; «Lagre som ny versjon» by a co-author makes a copy that belongs to the co-author, not to the
 * activity's owner; a portal learner may not use the copy route.
 *
 * Spec: PROD-013, PROD-007
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { t } from '../../../src/i18n/translate.js';
import { loginWithFeide } from '../../support/feideTestbed.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { edited, type MultiChoiceParams } from './learnerStateAfterEditEdits.js';
import { openSafeEditingBench, type BenchActivity, type SafeEditingBench } from './safeEditingBench.js';

/** A portal session of a mock Feide user: the cookie and the CSRF token. */
const portalSession = async (bench: SafeEditingBench, key: string) => {
  const login = await loginWithFeide({ app: bench.tb.app, feide: bench.tb.mock.feide }, key);
  const cookie = login.sessionCookie ?? '';
  const session = await request(bench.tb.app).get('/auth/session').set('Cookie', cookie);
  return { cookie, csrf: String(session.body.csrfToken) };
};

/** Posts «Lagre som ny versjon» of an edit with a portal session. */
const copyAs = (
  bench: SafeEditingBench,
  who: { cookie: string; csrf: string },
  mc: BenchActivity,
  params: object,
) =>
  request(bench.tb.app)
    .post(`/h5p/content/${mc.id}/copy`)
    .set('Cookie', who.cookie)
    .set('X-CSRF-Token', who.csrf)
    .send({ params, metadata: mc.metadata });

describeWithServices('[PROD-013] who may answer the save choice', () => {
  describeWithRealPackages('[PROD-013] on a real activity', () => {
    let bench: SafeEditingBench;
    beforeAll(async () => {
      bench = await openSafeEditingBench();
    }, 240_000);
    afterAll(() => bench?.close());

    const appended = (params: Record<string, unknown>) =>
      edited<MultiChoiceParams>(
        params,
        (p) => void p.answers.push({ text: '<div>Ny</div>', correct: false }),
      );

    it('[PROD-013] a structural save from Canvas is asked first, then saved with the confirmation and the state reset', async () => {
      // Arrange: the teacher's own activity, which another learner has progress in
      const first = await bench.launch(
        await bench.importExample('H5P.MultiChoice', { published: true }),
        'teacher',
      );
      const teacherId = (await bench.tb.lti.resolveLtik(first)).principal.userId;
      const mc = await bench.importExample('H5P.MultiChoice');
      await bench.tb.db.h5PContent.update({ where: { id: mc.id }, data: { ownerUserId: teacherId } });
      await bench.addOtherLearnersState(mc);
      const ltik = await bench.launch(mc, 'teacher');
      const { locale } = (await bench.tb.lti.resolveLtik(ltik)).principal;
      const save = (extra: object) =>
        request(bench.tb.app)
          .put(`/h5p/content/${mc.id}`)
          .set('Authorization', `Bearer ${ltik}`)
          .send({
            library: mc.library,
            params: { params: appended(mc.params), metadata: mc.metadata },
            ...extra,
          });
      // Act
      const asked = await save({});
      const confirmed = await save({ confirmLearnerStateReset: true });
      // Assert
      expect([asked.status, asked.body.errorCode]).toEqual([409, 'hvl:learner-state-reset-needed']);
      // UD-013: Canvas has no «Lagre som ny versjon» (D-098), so its answer does not offer one
      expect(asked.body.message).toBe(t('safeEditing.resetNeededCanvas', {}, locale));
      expect(confirmed.status).toBe(200);
      expect(await bench.stored(mc.id)).toMatchObject({ version: 2 });
      expect(await bench.stateKeys(mc.id)).toEqual([]);
    });

    it('[PROD-007] «Lagre som ny versjon» by a co-author makes a private draft that belongs to the co-author', async () => {
      // Arrange: an HVL colleague who co-authors the run author's activity
      const key = `w5b-colleague-${randomUUID().slice(0, 8)}`;
      bench.tb.mock.feide.addUser({ key, affiliations: ['member', 'employee', 'faculty'] });
      const colleague = await portalSession(bench, key);
      const colleagueId = await bench.tb.feideAccount(key);
      const mc = await bench.importExample('H5P.MultiChoice', { published: true });
      await bench.tb.db.contentCollaborator.create({ data: { contentId: mc.id, userId: colleagueId } });
      const before = await bench.stored(mc.id);
      // Act
      const res = await copyAs(bench, colleague, mc, appended(mc.params));
      // Assert
      expect(res.status).toBe(201);
      const copy = await bench.tb.db.h5PContent.findUniqueOrThrow({
        where: { id: res.body.contentId as string },
      });
      const source = await bench.tb.db.h5PContent.findUniqueOrThrow({ where: { id: mc.id } });
      expect(copy).toMatchObject({ ownerUserId: colleagueId, status: 'draft', visibility: 'private' });
      expect(copy).toMatchObject({ sourceContentId: mc.id, sourceAuthorUserId: source.ownerUserId });
      expect(copy.ownerUserId).not.toBe(source.ownerUserId);
      expect(await bench.stored(mc.id)).toEqual(before);
    });

    it('[PROD-013] a portal learner may not use the copy route, and nothing is copied', async () => {
      // Arrange
      const learner = await portalSession(bench, 'student');
      const mc = await bench.importExample('H5P.MultiChoice', { published: true });
      // Act
      const res = await copyAs(bench, learner, mc, appended(mc.params));
      // Assert
      expect([res.status, res.body.errorCode]).toEqual([403, 'error.forbidden']);
      expect(await bench.tb.db.h5PContent.count({ where: { sourceContentId: mc.id } })).toBe(0);
    });
  });
});
