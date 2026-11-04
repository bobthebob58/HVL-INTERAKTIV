/**
 * insightDbFixture — writes the 30-learner fixture into PostgreSQL: a staff owner, the QuestionSet (version 2), the
 * InteractiveVideo and the ImageHotspots, a platform with courses A and B, and every fixture row in its place;
 * removed again by `close`.
 *
 * Why: INS-001's numbers must match the hand calculation through the real query (version, context, period, order),
 *      not only on the pure builder; rows the view must leave out are stored beside them (fixtures/README.md).
 * Spec: INS-001, PROD-013
 * Tests: apps/server/test/insight/insightService.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import { createPrismaClient, type Database } from '../../../src/infra/prismaClient.js';
import { serviceEnv, uniqueName } from '../../support/services.js';
import { IMAGE_HOTSPOTS, INTERACTIVE_VIDEO, QUESTION_SET } from '../fixtures/insightActivities.js';
import { questionSetNoise, questionSetRows, videoRows, type FixtureRow } from '../fixtures/thirtyLearners.js';

/** The fixture's rows in the database. */
export interface InsightDbFixture {
  readonly db: Database;
  readonly questionSetId: string;
  readonly videoId: string;
  readonly hotspotsId: string;
  /** `<platformId>:A` and `<platformId>:B` (D-103). */
  readonly courseA: string;
  readonly courseB: string;
  close(): Promise<void>;
}

const activity = (
  db: Database,
  ownerUserId: string,
  kind: { mainLibrary: string; params: object },
  version: number,
) =>
  db.h5PContent.create({
    data: {
      mainLibrary: kind.mainLibrary,
      title: kind.mainLibrary,
      params: kind.params,
      metadata: { title: kind.mainLibrary, mainLibrary: kind.mainLibrary, language: 'nn' },
      ownerUserId,
      version,
    },
  });

/**
 * Creates the rows.
 * @returns The fixture.
 */
export async function openInsightDbFixture(): Promise<InsightDbFixture> {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const owner = await db.user.create({ data: { kind: 'staff' } });
  const questionSet = await activity(db, owner.id, QUESTION_SET, 2);
  const video = await activity(db, owner.id, INTERACTIVE_VIDEO, 1);
  const hotspots = await activity(db, owner.id, IMAGE_HOTSPOTS, 1);
  const url = `https://${uniqueName('insight')}.example`;
  const platform = await db.ltiPlatform.create({
    data: {
      url,
      clientId: '1',
      name: 'Canvas',
      authenticationEndpoint: 'https://sso.example/auth',
      accessTokenEndpoint: 'https://sso.example/token',
      idTokenValidationMethod: 'JWK_SET',
      idTokenValidationKey: 'https://sso.example/jwks',
      publicKey: 'p',
      privateKeyEncrypted: Buffer.from([1]),
    },
  });
  // WHY: course A was renamed (PED100, then PED101); the newest label must win, so the times are set, not now().
  for (const [minute, contextId, contextLabel] of [
    [0, 'A', 'PED100'],
    [1, 'B', null],
    [2, 'A', 'PED101'],
    [3, 'A', null],
  ] as const) {
    await db.ltiPlacement.create({
      data: {
        platformId: platform.id,
        contextId,
        resourceLinkId: uniqueName('link'),
        contentId: questionSet.id,
        contextLabel,
        createdAt: new Date(Date.UTC(2026, 9, 1, 8, minute)),
      },
    });
  }
  const courseA = `${platform.id}:A`;
  const courseB = `${platform.id}:B`;
  const write = (
    rows: readonly FixtureRow[],
    contentId: string,
    contentVersion: number,
    contextId: string | null,
  ) =>
    db.xapiStatement.createMany({
      data: rows.map((row) => ({
        ...row,
        id: randomUUID(),
        contentId,
        contentVersion,
        contextId,
        academicYear: 2026,
      })),
    });
  await write(questionSetRows(), questionSet.id, 2, courseA);
  for (const { place, rows } of questionSetNoise()) {
    const contextId = place === 'portal' ? null : place === 'otherCourse' ? courseB : courseA;
    await write(rows, questionSet.id, place === 'version1' ? 1 : 2, contextId);
  }
  await write(videoRows(), video.id, 1, courseA);
  return {
    db,
    questionSetId: questionSet.id,
    videoId: video.id,
    hotspotsId: hotspots.id,
    courseA,
    courseB,
    close: async () => {
      await db.ltiPlatform.deleteMany({ where: { url } });
      await db.h5PContent.deleteMany({ where: { id: { in: [questionSet.id, video.id, hotspots.id] } } });
      await db.user.deleteMany({ where: { id: owner.id } });
      await db.$disconnect();
    },
  };
}
