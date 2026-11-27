/**
 * End-to-end test of a Single Choice Set in the teacher's insight (INS-002, INS-003): five Canvas learners play a
 * Column that holds a set of two questions in the real player, each answering the first right and the second
 * wrong; the xAPI bridge posts what the library sends, and the course's teacher then reads the view. Each question
 * of the set is a row of its own, with its text, its learners and its share right, and each has its distribution
 * over the alternatives. The set sends one `answered` per question under that question's own `subContentId` and
 * none for itself, so a view that listed the set as one question showed no learner for it. The whole server with
 * the built web app and the real content types (../test/support/realWebApp.ts).
 *
 * Spec: INS-002, INS-003, LTI-010
 */
import { randomUUID } from 'node:crypto';
import type { IContentMetadata } from '@lumieducation/h5p-server';
import type { Browser, Frame } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, type LaunchSpec } from '../../../tools/mock-platform/mockPlatform.mjs';
import { asAccountUser } from '../src/h5p/HvlH5pUser.js';
import { withSemanticDefaults } from '../src/learningDesign/patterns/semanticDefaults.js';
import { newCanvasLearner } from '../test/support/insightLearners.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { moveStatementsToYesterday } from '../test/support/statementsToYesterday.js';
import { testActor } from '../test/support/testActors.js';
import { launchCookieTestChromium } from '../test/support/thirdPartyCookies.js';
import { recordBridgePosts, startedPlayer } from './support/gradeBridgeFlow.js';
import { insightAsLaunch } from './support/insightFlow.js';

const LEARNERS = 5;
/** The set's two questions; the first stored alternative is the right one (SingleChoiceSet's rule). */
const FIRST = {
  id: randomUUID(),
  question: 'Kva er formativ vurdering?',
  answers: ['Undervegs', 'Til slutt'],
};
const SECOND = {
  id: randomUUID(),
  question: 'Kven gjev framovermelding?',
  answers: ['Alle', 'Berre læraren'],
};
const SET_ID = randomUUID();

const setParams = {
  choices: [FIRST, SECOND].map(({ id, question, answers }) => ({
    subContentId: id,
    question: `<p>${question}</p>`,
    answers: answers.map((answer) => `<p>${answer}</p>`),
  })),
  // WHY: the set moves on by itself after an answer; short waits keep five plays quick. No sound in a test.
  behaviour: { autoContinue: true, timeoutCorrect: 500, timeoutWrong: 500, soundEffectsEnabled: false },
};
const columnParams = {
  content: [
    {
      useSeparator: 'auto',
      content: {
        library: 'H5P.SingleChoiceSet 1.11',
        subContentId: SET_ID,
        metadata: { title: 'Vurdering', license: 'U', contentType: 'Single Choice Set' },
        params: setParams,
      },
    },
  ],
};

/** Picks the alternative with this text in the question the set shows now, and waits until the set has moved on. */
async function choose(player: Frame, question: string, answer: string): Promise<void> {
  // WHY: the result slide repeats every question's text, so the question is looked for as a question, not as text.
  const asked = player.locator('.h5p-sc-current-slide .h5p-sc-question', { hasText: question });
  await asked.waitFor();
  await player.locator('.h5p-sc-current-slide .h5p-sc-alternative', { hasText: answer }).click();
  await expect.poll(() => asked.count(), { timeout: 15_000 }).toBe(0);
}

describeWithRealWebApp('[INS-002] the questions of a Single Choice Set in the teacher’s insight', () => {
  let browser: Browser;
  let app: RealWebApp;
  let contentId: string;
  const course = { id: `e2e-scs-${randomUUID()}`, label: 'SETT101', title: 'Sett' };
  const launchAs = (user: LaunchSpec['user']) => ({
    user,
    course,
    resourceLinkId: `e2e-scs-${course.id}`,
    custom: { contentId },
    platformStorage: true,
  });
  beforeAll(async () => {
    browser = await launchCookieTestChromium();
    app = await openRealWebApp(browser);
    // Arrange: a published Column with the set, saved through the editor's own save as the run's author
    const { editor } = app.tb.runtime;
    const library = 'H5P.Column 1.22';
    const params = await withSemanticDefaults(columnParams, library, editor.libraryManager, 'nn');
    const metadata = { title: 'Kolonne med sett', license: 'U', defaultLanguage: 'nn' };
    const author = asAccountUser(testActor('author', { accountId: app.authorId }));
    contentId = await editor.saveOrUpdateContent(
      undefined,
      params,
      metadata as unknown as IContentMetadata,
      library,
      author,
    );
    await app.tb.db.h5PContent.update({
      where: { id: contentId },
      data: { status: 'published', visibility: 'organisation' },
    });
  }, 240_000);
  afterAll(async () => {
    await app?.close();
    await browser?.close();
  });

  it('[INS-002][INS-003] each question of the set has its learners, its share right and its alternatives', async () => {
    // Act: five learners answer the first question right and the second wrong, in the real player
    for (let learner = 0; learner < LEARNERS; learner += 1) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const posts = recordBridgePosts(page);
      await page.goto(app.tb.mock.canvas.coursePageUrl(launchAs(newCanvasLearner())));
      const player = await startedPlayer(page, '/lti/play');
      await choose(player, FIRST.question, FIRST.answers[0] ?? '');
      await choose(player, SECOND.question, SECOND.answers[1] ?? '');
      // WHY: the bridge posts within its 2-second tick; the context may close only after both answers are stored.
      const answered = () =>
        posts
          .filter((post) => post.status === 202)
          .flatMap((post) => post.verbs)
          .filter((verb) => verb === 'answered');
      await expect.poll(() => answered().length, { timeout: 20_000 }).toBe(2);
      await context.close();
    }
    const stored = await app.tb.db.xapiStatement.findMany({ where: { contentId, verb: 'answered' } });
    // WHY: a view holds the data up to and including yesterday (D-106's amendment), so today's plays move back.
    await moveStatementsToYesterday(app.tb.db, contentId);
    const view = await insightAsLaunch(app, launchAs(CANVAS_USERS.teacher));
    const body = view.body as {
      items: { item: string; library: string | null; questionText: string | null }[];
      misconceptions: { item: string; kind: string; options: { text: string; correct: boolean }[] }[];
    };
    // Assert: the library sent one answer per question and learner, under the question's own ID, none for the set
    expect(stored.map((row) => row.subContentId).sort()).toEqual(
      [...Array<string>(LEARNERS).fill(FIRST.id), ...Array<string>(LEARNERS).fill(SECOND.id)].sort(),
    );
    // Assert: the view lists the two questions, hardest first, each with five learners and its share right
    expect(view.status).toBe(200);
    const shown = (value: number) => ({ suppressed: false, value });
    expect(body.items).toMatchObject([
      { item: SECOND.id, questionText: SECOND.question, learners: shown(LEARNERS), firstCorrect: shown(0) },
      { item: FIRST.id, questionText: FIRST.question, learners: shown(LEARNERS), firstCorrect: shown(1) },
    ]);
    expect(body.items.every((item) => item.library === 'H5P.SingleChoiceSet')).toBe(true);
    // Assert: each question has its alternatives in stored order, the first one right, with the learners who chose it
    const wrong = body.misconceptions.find((entry) => entry.item === SECOND.id);
    expect(wrong).toMatchObject({
      kind: 'choice',
      questionText: SECOND.question,
      options: [
        { text: SECOND.answers[0], correct: true, learners: shown(0) },
        { text: SECOND.answers[1], correct: false, learners: shown(LEARNERS) },
      ],
    });
    expect(body.misconceptions.map((entry) => entry.item)).toEqual([FIRST.id, SECOND.id]);
  }, 300_000);
});
