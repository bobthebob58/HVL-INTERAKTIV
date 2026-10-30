/**
 * Integration tests of the bank branch of copying when the listing's owner is no longer findable staff (D-092
 * amendment 2026-10-29, S5 review): the bank hides such a listing (D-091 amendment), so neither the duplicate route
 * nor an editor paste may copy it through the bank, while the owner still copies it through Edit, and the listing is
 * copyable again once the owner is findable.
 *
 * Spec: PROD-007, DATA-002
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { HvlH5pActor } from '../../../src/h5p/HvlH5pUser.js';
import { PrismaContentAccessRepository } from '../../../src/h5p/permissions/ContentAccessRepository.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import type { ImageParams } from './duplicateFilesBench.js';
import { openDuplicateRouteBench, type DuplicateRouteBench } from './duplicateRouteBench.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describeWithServices('[PROD-007] a bank copy needs an owner who is findable staff', () => {
  describeWithRealPackages('[PROD-007] real content types', () => {
    let bench: DuplicateRouteBench;
    let sourceId: string;

    beforeAll(async () => {
      bench = await openDuplicateRouteBench();
      sourceId = await bench.importExample('H5P.ImageHotspots', true);
    }, 180_000);
    afterAll(() => bench.close());

    const ownerFindableSince = (date: Date) =>
      bench.tb.db.user.update({
        where: { id: bench.owner.actor.accountId },
        data: { coAuthorSearchableAt: date },
      });
    const duplicate = (actor: HvlH5pActor) =>
      request(bench.api)
        .post(`/api/content/${sourceId}/duplicate`)
        .set(...bench.as(actor));
    const pasteAsCopier = async () => {
      const { source, params } = await bench.pasteFrom(sourceId);
      (params as unknown as ImageParams).image.path = `../${sourceId}/images/diagram.png`;
      return bench.saveCopy(params, source).catch((error: unknown) => error);
    };

    it('[PROD-007] a listing whose owner left HVL staff is refused to colleagues by the route and a paste, not to its owner', async () => {
      // Arrange: the owner's last eligible Feide login was 400 days ago, so the bank hides the listing
      await ownerFindableSince(new Date(Date.now() - 400 * DAY_MS));
      const before = await bench.copierActivityIds();
      // Act
      const facts = await new PrismaContentAccessRepository(bench.tb.db).factsFor(sourceId);
      const colleague = await duplicate(bench.copier.actor);
      const pasted = await pasteAsCopier();
      const owner = await duplicate(bench.owner.actor);
      // Assert: nothing copied through the bank, and the owner's own copy through Edit still works
      expect(facts).toMatchObject({ status: 'published', bankListed: false });
      expect([colleague.status, colleague.body.errorCode]).toEqual([403, 'hvl:duplicate-not-allowed']);
      expect(pasted).toMatchObject({ errorId: 'hvl:paste-source-not-allowed', httpStatusCode: 403 });
      expect(await bench.copierActivityIds()).toEqual(before);
      expect(owner.status).toBe(201);
    }, 120_000);

    it('[PROD-007] the listing is copyable through the bank again after the owner’s next eligible login', async () => {
      // Arrange
      await ownerFindableSince(new Date());
      // Act
      const colleague = await duplicate(bench.copier.actor);
      // Assert
      expect(colleague.status).toBe(201);
    }, 120_000);
  });
});
