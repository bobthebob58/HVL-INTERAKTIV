/**
 * insightLearners — Canvas learners who play a recorded activity through the server's real ingestion route: each is
 * launched from the mock Canvas into a course, and posts probe P1's recorded statements, with the answers this test
 * gives them, to `POST /api/h5p/xapi` with the launch's Bearer ltik, as the player's bridge does.
 *
 * Why: insight (INS-001…INS-005) needs at least *k* learners in a course before it shows a number (INS-006). Playing
 *      every one of them in Chromium is slow; the bridge's own path is proved by the browser learners of the
 *      end-to-end tests, and these learners take everything after it for real: the LTI launch, the ltik, the View and
 *      launch checks, zod, the rate limit and the DATA-012 mapper (LTI-011).
 * Spec: INS-001, LTI-011, DATA-012
 * Invariants:
 *   - Each learner is a new Canvas user with a random `sub` and the student roles, so each gets a learnerKey of their
 *     own; no name or e-mail is sent (DATA-012).
 *   - The statements are the bridge's of one page load (`fixturePlay` with `bridgeOnly`): the first root
 *     `attempted`, every `answered` and the root `completed`, with fresh statement and attempt IDs.
 *   - An answer is changed only through `answer` (`withAnswer`): its response, raw and scaled score and `success`.
 * Collaborators: ./ltiLaunchDriver.ts, ../xapi/support/xapiBridgeItems.ts, ./realWebApp.ts,
 *   ../../e2e/insightInCanvas.e2e.test.ts.
 * Tests: apps/server/e2e/insightInCanvas.e2e.test.ts
 */
import { randomUUID } from 'node:crypto';
import { CANVAS_USERS, type LaunchSpec } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { fixturePlay, type PostedStatement } from '../xapi/support/xapiBridgeItems.js';
import { launchFromCanvas } from './ltiLaunchDriver.js';
import type { RealWebApp } from './realWebApp.js';

/** The xAPI extension that names a statement's sub-content (H5P). */
const SUB_CONTENT = 'http://h5p.org/x-api/h5p-subContentId';

/** What one answer of a learner says. */
export interface GivenAnswer {
  /** H5P's response pattern, e.g. `1` for the second option or `a[,]b` for two gaps. */
  readonly response: string;
  /** The raw score; the scaled score follows from the statement's maximum. */
  readonly raw: number;
}

/** Changes a learner's answers: `null` for the activity's own answer, else the sub-content ID. */
export type AnswerOf = (subContentId: string | null) => GivenAnswer | undefined;

/**
 * A new Canvas learner.
 * @returns A user with a random `sub` and the student roles.
 */
export const newCanvasLearner = (): NonNullable<LaunchSpec['user']> => ({
  sub: randomUUID(),
  roles: CANVAS_USERS.student.roles,
});

/**
 * The sub-content a statement is about.
 * @param statement - A posted statement.
 * @returns Its sub-content ID, or null for the activity itself.
 */
function subContentOf(statement: PostedStatement): string | null {
  const object = statement.object as { definition?: { extensions?: Record<string, unknown> } } | undefined;
  const id = object?.definition?.extensions?.[SUB_CONTENT];
  return typeof id === 'string' ? id : null;
}

/**
 * A statement with another answer.
 * @param statement - An `answered` statement as recorded.
 * @param answer - The response and raw score to give.
 * @returns A copy with the response, raw and scaled score and `success` changed.
 */
export function withAnswer(statement: PostedStatement, answer: GivenAnswer): PostedStatement {
  const result = (statement.result ?? {}) as { score?: { max?: number }; success?: boolean };
  const max = result.score?.max ?? 1;
  const score = { ...result.score, raw: answer.raw, scaled: Math.round((answer.raw / max) * 10000) / 10000 };
  const success = 'success' in result ? { success: answer.raw >= max } : {};
  return { ...statement, result: { ...result, ...success, score, response: answer.response } };
}

/**
 * One learner launches from the mock Canvas and posts one page load's statements through the ingestion route.
 * @param app - The running app.
 * @param launch - The learner's launch: the user, the course, the link and `custom.contentId`.
 * @param type - The recorded fixture to play, e.g. `H5P.MultiChoice`.
 * @param answerOf - The answers to give; a question it returns nothing for keeps the recorded answer.
 * @returns The ingestion's answer status (202 when stored).
 * @throws Error when the launch does not reach the tool.
 */
export async function playThroughIngestion(
  app: RealWebApp,
  launch: LaunchSpec & { custom: { contentId: string } },
  type: string,
  answerOf: AnswerOf = () => undefined,
): Promise<number> {
  const { ltik } = await launchFromCanvas(app.tb.app, app.tb.mock.canvas, launch);
  if (!ltik) throw new Error('the learner launch did not reach the tool');
  const { contentId } = launch.custom;
  const [view] = fixturePlay(type, contentId, { bridgeOnly: true }).views;
  const statements = (view?.statements ?? []).map((statement) => {
    const given = (statement.verb as { id?: string }).id?.endsWith('/answered')
      ? answerOf(subContentOf(statement))
      : undefined;
    return given ? withAnswer(statement, given) : statement;
  });
  const { version } = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: contentId } });
  const res = await fetch(`${app.base}/api/h5p/xapi`, {
    method: 'POST',
    headers: { authorization: `Bearer ${ltik}`, 'content-type': 'application/json' },
    body: JSON.stringify({ contentId, contentVersion: version, statements }),
  });
  await res.body?.cancel();
  return res.status;
}
