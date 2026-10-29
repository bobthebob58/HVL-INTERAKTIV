/**
 * Integration tests for «Lagre som ny versjon» (`POST /h5p/content/:contentId/copy`) on the real content types: the
 * edit becomes a new private draft linked to the original, the original and its learners' state stay as they
 * were, and Canvas cannot make a copy (D-093, D-098).
 *
 * Spec: PROD-013, PROD-007
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { edited, type MultiChoiceParams } from './learnerStateAfterEditEdits.js';
import { openSafeEditingBench, type SafeEditingBench } from './safeEditingBench.js';

describeWithServices('[PROD-013] saving an edit as a copy', () => {
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

    it('[PROD-013] the edit becomes a new private draft linked to the original, which keeps its parameters and state', async () => {
      // Arrange: a published activity that another learner has state in
      const mc = await bench.importExample('H5P.MultiChoice', { published: true });
      const other = await bench.addOtherLearnersState(mc);
      const before = await bench.stored(mc.id);
      // Act
      const res = await bench.copy(mc, appended(mc.params));
      // Assert
      expect(res.status).toBe(201);
      const copyId = (res.body as { contentId: string }).contentId;
      const copy = await bench.tb.db.h5PContent.findUniqueOrThrow({ where: { id: copyId } });
      expect(copy).toMatchObject({
        status: 'draft',
        visibility: 'private',
        sourceContentId: mc.id,
        version: 1,
      });
      expect(copy.ownerUserId).toBe(
        (await bench.tb.db.h5PContent.findUniqueOrThrow({ where: { id: mc.id } })).ownerUserId,
      );
      const answers = (params: unknown) => (params as MultiChoiceParams).answers.length;
      expect(answers(copy.params)).toBe(answers(mc.params) + 1);
      expect(await bench.stored(mc.id)).toEqual(before);
      expect(await bench.stateKeys(mc.id)).toEqual([other]);
      expect(await bench.stateKeys(copyId)).toEqual([]);
    });

    it('[PROD-013] a copy request from Canvas is refused (reset or cancel only there), and nothing is copied', async () => {
      // Arrange
      const mc = await bench.importExample('H5P.MultiChoice', { published: true });
      const ltik = await bench.launch(mc, 'teacher');
      const copies = () => bench.tb.db.h5PContent.count({ where: { sourceContentId: mc.id } });
      // Act
      const res = await bench.copy(mc, appended(mc.params), ltik);
      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ errorCode: 'hvl:unauthenticated' });
      expect(await copies()).toBe(0);
    });

    it('[PROD-013] a portal copy request without the CSRF token is refused like the editor’s save, and nothing is copied', async () => {
      // Arrange
      const mc = await bench.importExample('H5P.MultiChoice');
      const body = { params: appended(mc.params), metadata: mc.metadata };
      // Act
      const res = await request(bench.tb.app)
        .post(`/h5p/content/${mc.id}/copy`)
        .set('Cookie', bench.author.cookie)
        .send(body);
      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ errorCode: 'hvl:csrf-invalid' });
      expect(await bench.tb.db.h5PContent.count({ where: { sourceContentId: mc.id } })).toBe(0);
    });

    it('[PROD-013] a copy request without parameters and metadata is refused with 400', async () => {
      const mc = await bench.importExample('H5P.MultiChoice');
      const res = await bench.copy(mc, 'not parameters' as unknown as object);
      expect(res.status).toBe(400);
    });

    it('[PROD-013] the editor’s library goes through the route; a library that is not a string is 400 and copies nothing', async () => {
      // Arrange: the body the editor page sends (D-093 amendment, S5 W4)
      const mc = await bench.importExample('H5P.MultiChoice');
      const send = (library: unknown) =>
        request(bench.tb.app)
          .post(`/h5p/content/${mc.id}/copy`)
          .set('Cookie', bench.author.cookie)
          .set('x-csrf-token', bench.author.csrf)
          .send({ params: mc.params, metadata: mc.metadata, library });
      const copies = () => bench.tb.db.h5PContent.count({ where: { sourceContentId: mc.id } });
      // Act
      const refused = await send(42);
      const before = await copies();
      const accepted = await send(mc.library);
      // Assert
      expect([refused.status, refused.body.errorCode]).toEqual([400, 'error.badRequest']);
      expect(before).toBe(0);
      expect(accepted.status).toBe(201);
      expect(await copies()).toBe(1);
    });
  });
});
