/**
 * xapiTypeRun — plays one real type through its learner script, checks the play against probe P1's findings and
 * the committed fixture, and asserts the per-type facts with messages that name the finding that broke.
 *
 * Why: each of the ten tests in ../xapi*Types.browser.int.test.ts then states only what its type sends, while the
 *      findings every type shares (F1, F4–F8, F11) are checked the same way for all (D-102).
 * Spec: H5P-009
 * Invariants:
 *   - Every play starts a fresh browser context: no cookie, storage or cache carries over between types.
 *   - The two-task Column is the package example with its MultiChoice twice and without the image (the example has
 *     one task, so it cannot show that Column waits for every task); its second task has a fixed subContentId.
 * Collaborators: ./xapiCapture.ts, ./xapiFindings.ts, ./xapiLearnerQuestions.ts, ./xapiLearnerContainers.ts,
 *   ../../support/xapiFixtures.ts, ../../support/realPackages.ts.
 * Tests: ../xapiQuestionTypes.browser.int.test.ts, ../xapiContainerTypes.browser.int.test.ts
 */
import type { Browser } from 'playwright-core';
import { expect } from 'vitest';
import { packageExamples } from '../../support/realPackages.js';
import type { RealTypesServer } from '../../support/realTypesPlayer.js';
import { curateXapiFixture, xapiFixtureDrift } from '../../support/xapiFixtures.js';
import { openXapiPlay } from './xapiCapture.js';
import { findingViolations, summarise, type PlaySummary } from './xapiFindings.js';
import { CONTAINER_SCRIPTS } from './xapiLearnerContainers.js';
import { QUESTION_SCRIPTS } from './xapiLearnerQuestions.js';

/** The outcome of one type's play. */
export interface TypeRun {
  readonly violations: string[];
  readonly summary: PlaySummary;
  /** What the learner script saw besides statements (buttons, popups). */
  readonly observed: Record<string, unknown>;
  readonly fixtureDrift: string[];
}

/** What a type is expected to send; `subResults` and `observed` default to none. */
export type TypeExpectations = Omit<PlaySummary, 'subResults'> & {
  readonly subResults?: string[];
  readonly observed?: Record<string, unknown>;
};

const SCRIPTS = { ...QUESTION_SCRIPTS, ...CONTAINER_SCRIPTS };
/** The subContentId of the two-task Column's second MultiChoice. */
const SECOND_TASK_ID = '3f6a2c1e-8b4d-4e7f-9a1c-5d2e6f7a8b04';

/**
 * Plays `type` as the server's learner and checks it.
 * @param browser - The running full Chromium.
 * @param server - From `openRealTypesServer`.
 * @param type - The main library's machine name, e.g. `H5P.MultiChoice`.
 * @param contentId - The activity; the type's imported example by default.
 * @returns What the play sent and how it compares.
 */
export async function playRealType(
  browser: Browser,
  server: RealTypesServer,
  type: string,
  contentId = server.ids.get(type),
): Promise<TypeRun> {
  const script = SCRIPTS[type];
  if (!script || !contentId) throw new Error(`no learner script or activity for ${type}`);
  const play = await openXapiPlay(browser, server, contentId);
  try {
    await play.quiet();
    const observed = (await script.play(play, server)) ?? {};
    play.step('end');
    await play.quiet();
    const library = play.facts[0]?.library ?? '';
    const actions = ['load: opens the activity', ...script.actions];
    return {
      violations: findingViolations(play),
      summary: summarise(play, library.replace(' ', '-')),
      observed,
      fixtureDrift: xapiFixtureDrift(type, curateXapiFixture(library, contentId, actions, play.statements)),
    };
  } finally {
    await play.close();
  }
}

/**
 * Asserts a type's play, each part with the finding it pins in its failure message.
 * @param run - From `playRealType`.
 * @param expected - What P1 observed for the type with the script's answers.
 */
export function expectP1(run: TypeRun, expected: TypeExpectations): void {
  expect(run.violations, 'P1 findings F1, F4–F8 and F11 (listed in support/xapiFindings.ts)').toEqual([]);
  expect(run.summary.onLoad, 'attempt boundaries (F6): what each page load sends by itself').toEqual(
    expected.onLoad,
  );
  expect(run.summary.rootResults, 'F6: the gradable root result of this type').toEqual(expected.rootResults);
  expect(run.summary.subResults, 'F6: the scored sub-content statements').toEqual(expected.subResults ?? []);
  expect(run.summary.kinds, 'F6: the kinds of statement (root or sub, and verb)').toEqual(expected.kinds);
  expect(run.summary.responses, 'F8: the response formats by interaction type').toEqual(expected.responses);
  expect(run.observed, 'the learner script reached the state P1 saw').toEqual(expected.observed ?? {});
  expect(run.fixtureDrift, 'the curated fixture in test/fixtures/xapi/').toEqual([]);
}

/**
 * Saves and publishes the two-task Column: the package example's text and its MultiChoice twice.
 * @param server - From `openRealTypesServer`.
 * @returns The activity's content ID.
 */
export async function createTwoTaskColumn(server: RealTypesServer): Promise<string> {
  const example = (await packageExamples()).find((e) => e.library.startsWith('H5P.Column '));
  type Item = { content: { library: string; subContentId: string } };
  const items = (example?.params as { content?: Item[] } | undefined)?.content ?? [];
  const text = items.find((i) => i.content.library.startsWith('H5P.AdvancedText '));
  const task = items.find((i) => i.content.library.startsWith('H5P.MultiChoice '));
  if (!example || !text || !task)
    throw new Error('the Column example has changed; update the two-task Column');
  const second = { ...task, content: { ...task.content, subContentId: SECOND_TASK_ID } };
  return server.tb.activity(server.author, {
    published: true,
    library: example.library,
    params: { content: [text, task, second] },
    metadata: example.metadata,
  });
}
