/**
 * Unit tests of how insight reads an H5P.SingleChoiceSet: the library sends one `answered` per question of the set,
 * under that question's own `subContentId`, and none for the set, so each question with an ID is a question of the
 * catalogue, with its alternatives; a view counts its learners and their first answers like any choice question's;
 * its answer key is part of what a save compares; and in an InteractiveVideo the set is one interaction, answered
 * by a learner who answered any of its questions.
 *
 * Spec: INS-002, INS-003, INS-005, PROD-013
 */
import { describe, expect, it } from 'vitest';
import { videoInteractions } from '../../src/insight/content/activityCapabilities.js';
import { answerKeys, answerKeysDiffer } from '../../src/insight/content/answerKeys.js';
import { questionCatalogue } from '../../src/insight/content/questionCatalogue.js';
import { FIXTURE_NOW, learnerKey, type FixtureRow } from './fixtures/thirtyLearners.js';
import { reportOf, shown } from './support/insightFixtureReport.js';

const [SET, SUM, COMPARE] = ['set-1', 'question-sum', 'question-compare'];
const choice = (subContentId: string | undefined, question: unknown, answers: unknown) => ({
  subContentId,
  question,
  answers,
});
const setOf = (choices: unknown, id = SET) => ({
  library: 'H5P.SingleChoiceSet 1.11',
  subContentId: id,
  params: { choices },
});
const TWO = [
  choice(SUM, '<p>Kva er 2+2?</p>', ['<p>4</p>', '<p>5</p>', '<p>22</p>']),
  choice(undefined, '<p>Utan ID</p>', ['a', 'b']),
  choice(COMPARE, '<p>3 &lt; 4?</p>', ['Ja', 'Nei']),
];
const COLUMN = { mainLibrary: 'H5P.Column', params: { content: [{ content: setOf(TWO) }] } };
/** The set's own text, where it is shown as one thing: every question's. */
const SET_TEXT = 'Kva er 2+2? / Utan ID / 3 < 4?';

/** One learner's first answer to one question of the set: the stored index of the alternative they chose. */
const answer = (learner: number, item: string, chosen: number, minute = 0): FixtureRow => ({
  learnerKey: learnerKey(learner),
  attemptId: `attempt-${learner}`,
  subContentId: item,
  verb: 'answered',
  scoreRaw: chosen === 0 ? 1 : 0,
  scoreMax: 1,
  success: chosen === 0,
  response: String(chosen),
  timestamp: new Date(FIXTURE_NOW.getTime() - (600 - learner - minute) * 60_000),
});

describe('[INS-002] the questions of a SingleChoiceSet', () => {
  it('[INS-002] each question with an ID is a question of its own, with its alternatives; the set is none', () => {
    // Act
    const questions = questionCatalogue(COLUMN.mainLibrary, COLUMN.params);
    // Assert: the first stored alternative is the right one (the library's rule); no feedback field exists
    expect(questions).toEqual([
      {
        item: SUM,
        library: 'H5P.SingleChoiceSet',
        text: 'Kva er 2+2?',
        shape: {
          kind: 'choice',
          options: [
            { text: '4', correct: true, feedback: null },
            { text: '5', correct: false, feedback: null },
            { text: '22', correct: false, feedback: null },
          ],
        },
      },
      expect.objectContaining({ item: COMPARE, text: '3 < 4?' }),
    ]);
  });

  it('[INS-002] a set as the main library, a repeated ID and malformed questions never throw', () => {
    // Arrange
    const again = { a: setOf([TWO[0]]), b: setOf([choice(SUM, 'Sist', ['x'])], 'set-2') };
    const broken = { a: setOf('x'), b: setOf([null, 5, choice('', 'Tom ID', []), choice(SUM, 7, 'x')]) };
    // Act
    const asMain = questionCatalogue('H5P.SingleChoiceSet', { choices: TWO });
    // Assert
    expect(asMain.map(({ item }) => item)).toEqual([SUM, COMPARE]);
    expect(questionCatalogue('H5P.Column', again).map(({ item, text }) => [item, text])).toEqual([
      [SUM, 'Kva er 2+2?'],
    ]);
    expect(questionCatalogue('H5P.Column', broken)).toEqual([
      { item: SUM, library: 'H5P.SingleChoiceSet', text: '', shape: { kind: 'choice', options: [] } },
    ]);
  });

  it('[INS-002][INS-003] a view counts each question’s learners, share right and first answers', () => {
    // Arrange: six learners answer the sum right; five of them compare, all wrong; one changes the sum later
    const rows = [1, 2, 3, 4, 5, 6].flatMap((learner) => [
      answer(learner, SUM, 0),
      ...(learner < 6 ? [answer(learner, COMPARE, 1, 1)] : []),
    ]);
    // Act
    const report = reportOf(COLUMN, [...rows, answer(1, SUM, 2, 5)]);
    // Assert: hardest first; no row without a name, and none for the set itself
    expect(
      report.items.map((item) => [
        item.questionText,
        shown(item.learners),
        shown(item.firstCorrect),
        shown(item.latestCorrect),
      ]),
    ).toEqual([
      ['3 < 4?', 5, 0, 0],
      ['Kva er 2+2?', 6, 1, 0.8333],
    ]);
    const compare = report.misconceptions.find((entry) => entry.item === COMPARE);
    expect(compare?.kind === 'choice' && compare.options.map((option) => shown(option.learners))).toEqual([
      0, 5,
    ]);
    expect(report.misconceptions.map((entry) => entry.item)).toEqual([SUM, COMPARE]);
  });

  it('[PROD-013] a question’s answer key is its alternatives, so another number of them is another key', () => {
    // Arrange
    const fewer = [choice(SUM, 'Kva er 2+2?', ['4', '5']), TWO[2]];
    // Act
    const keys = answerKeys('H5P.Column 1.22', COLUMN.params);
    const after = answerKeys('H5P.Column 1.22', { content: [{ content: setOf(fewer) }] });
    // Assert
    expect([...keys]).toEqual([
      [SUM, '["choice",[true,false,false]]'],
      [COMPARE, '["choice",[true,false]]'],
    ]);
    expect([answerKeysDiffer(keys, keys), answerKeysDiffer(keys, after)]).toEqual([false, true]);
  });
});

describe('[INS-005] a SingleChoiceSet in an InteractiveVideo', () => {
  const interaction = { duration: { from: 30, to: 40 }, label: '<p>Sjekk</p>', action: setOf(TWO) };
  const unanswerable = { duration: { from: 90, to: 95 }, action: setOf([TWO[1]], 'set-without-ids') };
  const VIDEO = {
    mainLibrary: 'H5P.InteractiveVideo',
    params: { interactiveVideo: { assets: { interactions: [unanswerable, interaction], endscreens: [] } } },
  };

  it('[INS-005] the set is one interaction, answered through its questions; a set without IDs is not listed', () => {
    // Act
    const interactions = videoInteractions(VIDEO.params);
    // Assert
    expect(interactions).toEqual([
      {
        item: SET,
        library: 'H5P.SingleChoiceSet',
        label: 'Sjekk',
        atSeconds: 30,
        questionText: SET_TEXT,
        answeredBy: [SUM, COMPARE],
      },
    ]);
  });

  it('[INS-005] a learner who answered any question of the set answered the interaction, counted once', () => {
    // Arrange: learners 1–5 answer the sum, 4–7 compare: seven learners, two of them both
    const rows = [
      ...[1, 2, 3, 4, 5].map((learner) => answer(learner, SUM, 0)),
      ...[4, 5, 6, 7].map((learner) => answer(learner, COMPARE, 1, 1)),
      { ...answer(8, SUM, 0), subContentId: null, verb: 'attempted' as const },
    ];
    // Act
    const [entry] = reportOf(VIDEO, rows).videoEngagement ?? [];
    // Assert: seven of the eight who started
    expect(entry).toMatchObject({ item: SET, label: 'Sjekk', questionText: SET_TEXT });
    expect([shown(entry?.answered ?? null), shown(entry?.share ?? null)]).toEqual([7, 0.875]);
  });
});
