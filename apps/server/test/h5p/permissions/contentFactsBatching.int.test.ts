/**
 * Integration test on PostgreSQL for content facts looked up in the same tick: Prisma batches the `findUnique` calls
 * of one tick into one `IN (…)` query and matches the rows back by string equality, so an activity ID spelt in upper
 * case (a URL may spell it so) must still find its activity, also when other look-ups run beside it.
 *
 * Spec: H5P-006, PROD-004
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { PrismaContentAccessRepository } from '../../../src/h5p/permissions/ContentAccessRepository.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';

describeWithServices('[H5P-006] content facts looked up together', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const repository = new PrismaContentAccessRepository(db);
  let ownerId: string;
  const ids: string[] = [];

  beforeAll(async () => {
    ownerId = (await db.user.create({ data: { kind: 'staff' } })).id;
    const base = {
      mainLibrary: 'H5P.MultiChoice',
      title: 'Test',
      params: {},
      metadata: {},
      ownerUserId: ownerId,
    };
    for (let i = 0; i < 2; i++) ids.push((await db.h5PContent.create({ data: base })).id);
  });

  afterAll(async () => {
    await db.h5PContent.deleteMany({ where: { ownerUserId: ownerId } });
    await db.user.deleteMany({ where: { id: ownerId } });
    await db.$disconnect();
  });

  it('[H5P-006] an upper-case ID among look-ups of the same tick finds its activity by its stored ID', async () => {
    // Arrange
    const [first = '', second = ''] = ids;
    // Act: Prisma batches these three into one query
    const facts = await Promise.all([
      repository.factsFor(first.toUpperCase()),
      repository.factsFor(second),
      repository.factsFor(first),
    ]);
    // Assert
    expect(facts.map((f) => f?.contentId)).toEqual([first, second, first]);
    expect(facts.map((f) => f?.ownerUserId)).toEqual([ownerId, ownerId, ownerId]);
  });
});
