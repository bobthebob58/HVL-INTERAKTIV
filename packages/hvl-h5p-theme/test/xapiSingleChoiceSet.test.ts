/**
 * Tests for the bridge's one correction of a library's statement: H5P.SingleChoiceSet 1.11 writes the place on
 * screen of the chosen alternative as the answer and judges by it; the bridge sends the stored index the set itself
 * recorded, or no answer at all when it cannot read it. In a simulated player document (jsdom); the real library in
 * Chromium: apps/server/e2e/singleChoiceSetInsight.e2e.test.ts.
 *
 * Spec: LTI-010, INS-002, INS-003, DATA-012
 */
import { describe, expect, it } from 'vitest';
import { CONTENT_ID, openBridgeDocument, portalConfig, statement } from './support/bridgeDocument.js';

type Result = Record<string, unknown>;
interface Correction {
  result(cut: Result | undefined, source: unknown, subContentId: unknown): Result | undefined;
}
const correction = (
  openBridgeDocument({ config: null }).dom.window as unknown as { hvliXapiSingleChoiceSet: Correction }
).hvliXapiSingleChoiceSet;

const [SUM, COMPARE] = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
/** A set after two answers, as single-choice-set.js keeps them: the stored index of each chosen alternative. */
const setInstance = (userAnswerIndex: unknown = [2, 0]) => ({
  libraryInfo: { machineName: 'H5P.SingleChoiceSet', majorVersion: 1, minorVersion: 11 },
  options: { choices: [{ subContentId: SUM }, { subContentId: COMPARE }] },
  // WHY: the place on screen of each chosen alternative, which the library writes into its statement.
  userResponses: [0, 1],
  userAnswerIndex,
});
/** The result as the library writes it for the alternative shown at `place`: "right" when it was shown first. */
const written = (place: number): Result => ({
  completion: true,
  duration: 'PT3.5S',
  success: place === 0,
  score: { raw: place === 0 ? 1 : 0, min: 0, max: 1, scaled: place === 0 ? 1 : 0 },
  response: String(place),
});

describe('[INS-002] the answer of a SingleChoiceSet question', () => {
  it('[INS-002] is the stored index of the chosen alternative, judged by it, not its place on screen', () => {
    // Arrange: the learner chose stored alternative 2 (wrong), shown first, then alternative 0 (right), shown second
    const set = setInstance();
    // Act
    const [sum, compare] = [
      correction.result(written(0), set, SUM),
      correction.result(written(1), set, COMPARE),
    ];
    // Assert
    expect(sum).toEqual({
      completion: true,
      duration: 'PT3.5S',
      success: false,
      score: { raw: 0, min: 0, max: 1, scaled: 0 },
      response: '2',
    });
    expect(compare).toMatchObject({ success: true, score: { raw: 1, max: 1, scaled: 1 }, response: '0' });
  });

  it('[INS-002] a statement no SingleChoiceSet raised is left as it is', () => {
    // Arrange
    const given = written(1);
    const other = { ...setInstance(), libraryInfo: { machineName: 'H5P.MultiChoice' } };
    // Act
    const results = [undefined, null, {}, other, 'text'].map((source) =>
      correction.result(given, source, SUM),
    );
    // Assert
    expect(results.every((result) => result === given)).toBe(true);
    expect(correction.result(undefined, setInstance(), SUM)).toBeUndefined();
    // WHY: a statement without an ID of its own is the set's (its total), or a question's that no row can take;
    // neither is a question's answer to correct, also when the set's questions have no ID themselves.
    const withoutIds = { ...setInstance(), options: { choices: [{}, {}] } };
    expect([undefined, '', 7].map((id) => correction.result(given, withoutIds, id))).toEqual([
      given,
      given,
      given,
    ]);
  });

  it('[INS-002][DATA-012] an answer the set’s record does not give is not sent at all, never the library’s', () => {
    // Arrange: no record, a record of another kind, an index that is no whole number, a question it does not hold
    const thrower = Object.defineProperty(setInstance(), 'userAnswerIndex', {
      get: () => {
        throw new Error('gone');
      },
    });
    const sources = [setInstance(null), setInstance('0'), setInstance([1.5, -1]), thrower];
    // Act
    const results = [
      ...sources.map((source) => correction.result(written(0), source, SUM)),
      correction.result(written(0), setInstance(), 'another-question'),
    ];
    // Assert: what says nothing about the answer stays
    expect(results).toEqual(Array(5).fill({ completion: true, duration: 'PT3.5S' }));
  });

  it('[INS-002] changes neither the result nor the set it reads', () => {
    // Arrange
    const [given, set] = [written(0), setInstance()];
    const before = JSON.stringify([given, set]);
    // Act
    correction.result(given, set, SUM);
    // Assert
    expect(JSON.stringify([given, set])).toBe(before);
  });
});

describe('[LTI-010] the bridge and a SingleChoiceSet', () => {
  it('[LTI-010][INS-002] sends the stored index for the set’s question, read from the instance that raised the event', async () => {
    // Arrange: H5P Core calls a listener of its outside dispatcher with the raising instance as `this`
    const page = openBridgeDocument({ config: portalConfig() });
    const answered = statement('answered', {
      object: {
        id: `${CONTENT_ID}?subContentId=${SUM}`,
        definition: {
          interactionType: 'choice',
          extensions: {
            'http://h5p.org/x-api/h5p-local-content-id': CONTENT_ID,
            'http://h5p.org/x-api/h5p-subContentId': SUM,
          },
        },
      },
      context: { contextActivities: { parent: [{ id: `${CONTENT_ID}?subContentId=set` }] } },
      result: written(0),
    });
    // Act
    page.dispatch(answered, setInstance());
    page.dispatch(answered);
    page.tick();
    await page.settle();
    // Assert: the corrected answer from the set; the same statement from no set as written
    const sent = page.requests[0]?.body.statements.map((item) => item.result as Result) ?? [];
    expect(sent.map((result) => [result.response, result.success])).toEqual([
      ['2', false],
      ['0', true],
    ]);
  });
});
