/**
 * Unit tests of the answer keys insight judges by, and of what counts as a change of one: a save that changes a key
 * starts a new content version, so answers judged against one key are never shown against another (D-137).
 *
 * Spec: INS-003, PROD-013
 */
import { describe, expect, it } from 'vitest';
import { answerKeyOf, answerKeys, answerKeysDiffer } from '../../src/insight/content/answerKeys.js';
import { INTERACTIVE_VIDEO, IV1, IV3 } from './fixtures/insightActivities.js';

const node = (library: string, subContentId: string, params: object) => ({ library, subContentId, params });

const choice = (correct: readonly boolean[], texts: readonly string[] = ['Ja', 'Nei', 'Kanskje']) =>
  node('H5P.MultiChoice 1.16', 'q-choice', {
    question: '<p>Kva?</p>',
    answers: correct.map((isCorrect, index) => ({
      text: texts[index],
      correct: isCorrect,
      tipsAndFeedback: { chosenFeedback: 'Sjå læreboka.' },
    })),
  });
const blanks = (line: string, caseSensitive = false) =>
  node('H5P.Blanks 1.14', 'q-blanks', { text: 'Fyll inn.', questions: [line], behaviour: { caseSensitive } });
const dragText = (textField: string) =>
  node('H5P.DragText 1.10', 'q-drag', { taskDescription: 'Dra orda.', textField });
const trueFalse = node('H5P.TrueFalse 1.8', 'q-tf', { question: 'Stemmer det?', correct: 'true' });

const keysOf = (...questions: object[]) => answerKeys('H5P.QuestionSet 1.21', { questions });
const STORED = [
  choice([true, false, false]),
  blanks('<p>Hovudstaden er *Oslo/Kristiania:Tips*.</p>'),
  dragText('Ei *samling* kjem etter *forarbeid:Før samlinga*.'),
  trueFalse,
];
const changes = (...edited: object[]) => answerKeysDiffer(keysOf(...STORED), keysOf(...edited));

/** The same value with every object's keys in the opposite order, as another serialiser might hand it back. */
const reordered = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(reordered);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, inner]) => [key, reordered(inner)]),
  );
};

describe('[INS-003] the answer keys of an activity', () => {
  it('[INS-003] reads a key for every choice question and gap task, and none for other questions', () => {
    expect([...keysOf(...STORED)]).toEqual([
      ['q-choice', '["choice",[true,false,false]]'],
      ['q-blanks', '["gaps",false,[["kristiania","oslo"]]]'],
      ['q-drag', '["gaps",true,[["samling"],["forarbeid"]]]'],
    ]);
    expect(answerKeyOf({ kind: 'other' })).toBeNull();
  });

  it('[INS-003] finds the questions at any depth, and the activity itself when it is one question', () => {
    // Act
    const video = answerKeys(INTERACTIVE_VIDEO.mainLibrary, INTERACTIVE_VIDEO.params);
    const single = answerKeys('H5P.MultiChoice 1.16', choice([false, true]).params);
    // Assert: the video's TrueFalse and its empty Summary have no key
    expect([...video.keys()].sort()).toEqual([IV1, IV3].sort());
    expect([...single]).toEqual([[null, '["choice",[false,true]]']]);
  });
});

describe('[PROD-013] a change of an answer key', () => {
  it('[PROD-013] is not a reworded question, option, tip or feedback, nor alternatives in another order', () => {
    // Arrange
    const reworded = [
      choice([true, false, false], ['Ja, alltid', 'Nei, aldri', 'Av og til']),
      blanks('<p>Noreg sin hovudstad heiter *Kristiania/Oslo:Eit nytt tips*.</p>'),
      dragText('Ei *samling* kjem alltid etter *forarbeid:Eit anna tips*.'),
      trueFalse,
    ];
    // Act and assert
    expect(changes(...reworded)).toBe(false);
  });

  it('[PROD-013] is not another letter case in a task that ignores case, nor another order of the object keys', () => {
    // Arrange
    const otherCase = STORED.map((question, index) =>
      index === 1 ? blanks('<p>Hovudstaden er *OSLO/kristiania*.</p>') : question,
    );
    // Act and assert
    expect(changes(...otherCase)).toBe(false);
    expect(changes(...(reordered(STORED) as object[]))).toBe(false);
    expect(changes(...[...STORED].reverse())).toBe(false);
  });

  it.each([
    ['another option marked correct', 0, choice([false, true, false])],
    ['one more option marked correct', 0, choice([true, true, false])],
    ['another accepted answer of a gap', 1, blanks('<p>Hovudstaden er *Oslo/Christiania*.</p>')],
    ['an accepted answer taken away', 1, blanks('<p>Hovudstaden er *Oslo*.</p>')],
    ['upper and lower case made to count', 1, blanks('<p>Hovudstaden er *Oslo/Kristiania*.</p>', true)],
    ['another word for a drop zone', 2, dragText('Ei *førelesing* kjem etter *forarbeid*.')],
  ])('[PROD-013] is %s', (_what, index, edited) => {
    expect(changes(...STORED.map((question, at) => (at === index ? edited : question)))).toBe(true);
  });

  it('[PROD-013] is a question with a key that only one of the two versions holds', () => {
    // Arrange
    const renamed = { ...choice([true, false, false]), subContentId: 'q-other' };
    // Act and assert
    expect(changes(...STORED.slice(1))).toBe(true);
    expect(changes(renamed, ...STORED.slice(1))).toBe(true);
  });
});
