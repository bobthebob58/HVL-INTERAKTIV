/**
 * dsrFixtureRows — the learner rows of the data-subject fixture: Kari's under her Canvas key in 2040 and under both
 * her keys in 2041, Ola's under his Canvas key in both years, and a 2039 statement, a 2038 H5P state and a 2037 grade
 * job, whose years have no secret.
 *
 * Why: a request must find a person's rows in every retained year and under every pseudonym variant (D-108), and must
 *      leave everyone else's alone; one row per table of a year without a secret shows `unreachableYears` (D-108's
 *      amendment).
 * Spec: DATA-008
 * Invariants:
 *   - The rows' keys are derived as a login or launch derives them (`deriveLearnerKey` at a moment in that year), never
 *     by the code under test, so a request finds them only when it derives the same keys.
 * Tests: apps/server/test/privacy/dsr/dataSubjectRequest.int.test.ts (through ./dsrFixture.ts)
 */
import { randomBytes, randomUUID } from 'node:crypto';
import type { Database } from '../../../../src/infra/prismaClient.js';
import { deriveLearnerKey, type LearnerSource } from '../../../../src/privacy/deriveLearnerKey.js';
import type { DataSubject } from '../../../../src/privacy/dsr/dataSubject.js';
import type { SubjectPseudonym } from '../../../../src/privacy/dsr/subjectKeys.js';
import type { PseudonymSecrets } from '../../../../src/privacy/pseudonymSecrets.js';

/**
 * The pseudonyms a person's logins and launches made in the given years: one per year and identifier, Feide first.
 * @param subject - The person's identifiers.
 * @param secrets - The years' secrets.
 * @param years - The academic years.
 * @returns The keys, each with its year and variant.
 */
export function pseudonymsAsWritten(
  subject: DataSubject,
  secrets: PseudonymSecrets,
  years: readonly number[],
): SubjectPseudonym[] {
  const sources: { variant: 'feide' | 'lti'; source: LearnerSource }[] = [
    ...(subject.feideId
      ? [{ variant: 'feide' as const, source: { kind: 'feide' as const, feideId: subject.feideId } }]
      : []),
    ...subject.lti.map((one) => ({
      variant: 'lti' as const,
      source: { kind: 'lti' as const, issuer: one.issuer, subject: one.subject },
    })),
  ];
  return years.flatMap((academicYear) =>
    sources.map(({ variant, source }) => ({
      // WHY: 1 October of the year, when seedKey writes its rows, as a login or launch on that day derives the key.
      learnerKey: deriveLearnerKey(source, secrets, new Date(Date.UTC(academicYear, 9, 1, 10))),
      academicYear,
      variant,
    })),
  );
}

/** Where the rows belong. */
export interface DsrTarget {
  readonly contentId: string;
  /** `<platformId>:DSR-COURSE`. */
  readonly course: string;
  readonly placementId: string;
}

/** What one key holds: statements (in the course or the portal), states and a grade job. */
interface Planned {
  readonly statements: number;
  readonly inCourse: boolean;
  readonly states: number;
  /** A grade job; `withSub` stores an encrypted sub on it. */
  readonly job?: { readonly withSub: boolean };
}

/** Kari's and Ola's rows per (variant, year): what each of their keys holds. */
const KARI: Record<string, Planned> = {
  'lti-2040': { statements: 3, inCourse: true, states: 1, job: { withSub: true } },
  'feide-2041': { statements: 2, inCourse: false, states: 1 },
  'lti-2041': { statements: 0, inCourse: true, states: 1, job: { withSub: false } },
};
const OLA: Record<string, Planned> = {
  'lti-2040': { statements: 2, inCourse: true, states: 1, job: { withSub: true } },
  'lti-2041': { statements: 2, inCourse: true, states: 1 },
};

/** Writes what one pseudonym holds. */
async function seedKey(db: Database, target: DsrTarget, key: SubjectPseudonym, plan: Planned): Promise<void> {
  const { learnerKey, academicYear } = key;
  const at = (minute: number) => new Date(Date.UTC(academicYear, 9, 1, 10, minute));
  await db.xapiStatement.createMany({
    data: Array.from({ length: plan.statements }, (_, n) => ({
      contentId: target.contentId,
      contentVersion: 1,
      contextId: plan.inCourse ? target.course : null,
      learnerKey,
      verb: n === 0 ? 'attempted' : 'answered',
      scoreRaw: n === 0 ? null : 1,
      scoreMax: n === 0 ? null : 1,
      attemptId: `${randomUUID()}:1`,
      timestamp: at(n),
      academicYear,
    })),
  });
  await db.h5PUserData.createMany({
    data: Array.from({ length: plan.states }, () => ({
      contentId: target.contentId,
      dataType: 'state',
      learnerKey,
      contextId: plan.inCourse ? target.course : '',
      data: '{"answers":[1]}',
      academicYear,
    })),
  });
  if (!plan.job) return;
  await db.gradeSyncJob.create({
    data: {
      placementId: target.placementId,
      learnerKey,
      ltiSubEncrypted: plan.job.withSub ? new Uint8Array(randomBytes(40)) : null,
      attemptId: `${randomUUID()}:1`,
      scoreGiven: 100,
      resultAt: at(30),
      status: 'succeeded',
      idempotencyKey: `${target.placementId}:${learnerKey}`,
      nextAttemptAt: null,
      academicYear,
    },
  });
}

/**
 * Writes Kari's and Ola's rows, and one row per table of 2037–2039 under keys no secret makes.
 * @param db - The test database.
 * @param target - The activity, course and placement.
 * @param kari - Kari's pseudonyms (./dsrFixture.ts derives them).
 * @param ola - Ola's pseudonyms.
 * @returns When written.
 */
export async function seedLearnerRows(
  db: Database,
  target: DsrTarget,
  kari: readonly SubjectPseudonym[],
  ola: readonly SubjectPseudonym[],
): Promise<void> {
  for (const [keys, plans] of [
    [kari, KARI],
    [ola, OLA],
  ] as const) {
    for (const key of keys) {
      const plan = plans[`${key.variant}-${key.academicYear}`];
      if (plan) await seedKey(db, target, key, plan);
    }
  }
  // WHY: one table per year, so `unreachableYears` is shown to read each of the three tables.
  const unreachable: [number, Planned][] = [
    [2039, { statements: 1, inCourse: true, states: 0 }],
    [2038, { statements: 0, inCourse: true, states: 1 }],
    [2037, { statements: 0, inCourse: true, states: 0, job: { withSub: false } }],
  ];
  for (const [academicYear, plan] of unreachable) {
    const learnerKey = randomBytes(32).toString('base64url');
    await seedKey(db, target, { learnerKey, academicYear, variant: 'lti' }, plan);
  }
}
