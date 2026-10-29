/**
 * studioSeed — the studio data the accessibility suites check the S5 pages in: learning design on the run author's
 * example activities for one course (with both kinds of gap and an activity without tags), two findable colleagues
 * (one already a co-author), two bank listings (the author's own and a colleague's English activity) and the
 * author's copy of the colleague's activity.
 *
 * Why: UD-030 checks every page in the states a person meets. An empty planner, bank or **Deling** tab would hide the
 *      table, the cards and the co-author list that most need checking. The rows are written to the database as the
 *      routes store them, so the seed does not depend on the flows the e2e suite tests (D-088, D-090 … D-092).
 * Spec: UD-030, PED-030, PED-031, PED-032, PROD-007
 * Invariants:
 *   - Every row belongs to an activity or an account of this run: the author's, or colleagues made with
 *     `tb.staffAccount`, so ../../test/support/appTestbed.ts's cleanup removes them all.
 *   - The texts are this file's fixture texts, never ALU's content; the pattern is the first one the server lists
 *     as available, whatever its ID.
 *   - The draft (`app.draftId`) is left alone, since the save-choice and publish checks change it.
 * Collaborators: ./a11ySuite.ts (seeds once per server), ./studioViews.ts, ./staffActivities.ts (colleagues and
 *   imported activities), ../../test/support/realWebApp.ts.
 * Tests: apps/server/a11y/axeStudioViews.a11y.test.ts and every suite that walks ./catalogue.ts's views.
 */
import { randomBytes } from 'node:crypto';
import type { StudioOverview } from '@hvl-interaktiv/api-contract';
import type { RealWebApp } from '../../test/support/realWebApp.js';
import { findableColleague, importMultiChoice } from './staffActivities.js';

/** What the seed made, for the views that open it. */
export interface StudioSeed {
  /** The course code of the seeded plan (D-087's form). */
  readonly course: string;
  /** A pattern the server lists as available. */
  readonly patternId: string;
  /** The author's published activity with full learning design, a co-author and a bank listing. */
  readonly designedId: string;
  /** A colleague's published English activity in the bank, with an English purpose. */
  readonly colleagueActivityId: string;
  /** The author's copy of the colleague's activity. */
  readonly copyId: string;
  /** A findable colleague who is not on the designed activity yet, and a query that finds only them there. */
  readonly searchable: { readonly name: string; readonly query: string };
}

type PhaseKey = 'forarbeid' | 'underveis' | 'etterarbeid';
type Category = 'kunnskap' | 'ferdigheiter' | 'generell_kompetanse';
interface Design {
  readonly phase?: PhaseKey;
  readonly courseCode?: string;
  readonly outcomes?: readonly (readonly [string, Category])[];
  readonly purpose?: string;
  readonly minutes?: number;
  readonly rationale?: string;
}

const COURSE = 'UU-A11Y-101';
const KNOW = ['Forklare kva undervegsvurdering er', 'kunnskap'] as const;
const SKILL = ['Gje tilbakemelding på arbeidet til medstudentar', 'ferdigheiter'] as const;

/** The learner purposes the seed writes: the author's Nynorsk activity's and the colleague's English one's. */
export const SEED_PURPOSES = {
  nn: 'Du ser kva du alt kan før samlinga.',
  en: 'You find out what you already know before the session.',
} as const;

/** Writes an activity's learning design as `PUT /api/content/:id/learning-design` stores it. */
async function design(app: RealWebApp, contentId: string, d: Design): Promise<void> {
  const data = {
    phase: d.phase ?? null,
    courseCode: d.courseCode ?? null,
    rationale: d.rationale ?? null,
    estimatedStudentMinutes: d.minutes ?? null,
    learnerPurpose: d.purpose ?? null,
  };
  await app.tb.db.learningDesignMetadata.upsert({
    where: { contentId },
    create: { contentId, ...data },
    update: data,
  });
  await app.tb.db.learningOutcome.createMany({
    data: (d.outcomes ?? []).map(([text, category], position) => ({
      metadataContentId: contentId,
      text,
      category,
      position,
    })),
  });
}

/** The colleague's activity: published to HVL, listed in the bank, in English with an English purpose. */
async function colleagueActivity(app: RealWebApp, ownerId: string): Promise<string> {
  const id = await importMultiChoice(app, ownerId);
  const row = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id }, select: { metadata: true } });
  const title = 'Check what you know';
  await app.tb.db.h5PContent.update({
    where: { id },
    data: {
      title,
      metadata: { ...(row.metadata as object), title, language: 'en', defaultLanguage: 'en' },
      status: 'published',
      visibility: 'organisation',
      bankListedAt: new Date(),
    },
  });
  await design(app, id, {
    phase: 'forarbeid',
    outcomes: [['Explain what formative assessment is', 'kunnskap']],
    purpose: SEED_PURPOSES.en,
    minutes: 5,
  });
  return id;
}

/** The first pattern the server lists as available (any ID: ALU may rename or remove patterns). */
async function availablePattern(app: RealWebApp): Promise<string> {
  const overview = (await (await fetch(`${app.base}/api/studio`)).json()) as StudioOverview;
  const pattern = overview.patterns.find((p) => p.available);
  if (!pattern) throw new Error('the server lists no available pattern; are the real libraries installed?');
  return pattern.id;
}

/** The author's example activity of a type, which openRealWebApp imported and published. */
const example = (app: RealWebApp, type: string): string => {
  const id = app.ids.get(type);
  if (!id) throw new Error(`the run has no ${type} example`);
  return id;
};

/**
 * Seeds the studio data for one running server.
 * @param app - The server, with the author signed in and the examples imported.
 * @returns What was made.
 * @throws Error when an example or an available pattern is missing.
 */
export async function seedStudio(app: RealWebApp): Promise<StudioSeed> {
  const { db } = app.tb;
  const tag = randomBytes(3).toString('hex');
  const coAuthor = await findableColleague(app, `Kari Kollega ${tag}`);
  const searchableName = `Ola Kollega ${tag}`;
  await findableColleague(app, searchableName);
  const colleagueActivityId = await colleagueActivity(app, coAuthor);

  // PED-031's plan: the knowledge outcome reaches etterarbeid, the skill does not, nothing is in underveis, and the
  // DragText has the course but no tags.
  const designedId = example(app, 'H5P.MultiChoice');
  await design(app, designedId, {
    phase: 'forarbeid',
    courseCode: COURSE,
    outcomes: [KNOW, SKILL],
    purpose: SEED_PURPOSES.nn,
    minutes: 10,
    rationale: 'Ei kort prøve før samlinga hentar fram det studentane kan frå før.',
  });
  await design(app, example(app, 'H5P.QuestionSet'), {
    phase: 'etterarbeid',
    courseCode: COURSE,
    outcomes: [KNOW],
    minutes: 15,
  });
  await design(app, example(app, 'H5P.DragText'), { courseCode: COURSE });
  await db.h5PContent.update({ where: { id: designedId }, data: { bankListedAt: new Date() } });
  await db.contentCollaborator.create({
    data: { contentId: designedId, userId: coAuthor, role: 'coauthor' },
  });

  const copyId = await importMultiChoice(app, app.authorId);
  await db.h5PContent.update({
    where: { id: copyId },
    data: { sourceContentId: colleagueActivityId, sourceAuthorUserId: coAuthor },
  });
  return {
    course: COURSE,
    patternId: await availablePattern(app),
    designedId,
    colleagueActivityId,
    copyId,
    searchable: { name: searchableName, query: tag },
  };
}
