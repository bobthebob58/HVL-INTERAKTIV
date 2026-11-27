/**
 * xapiSingleChoiceSet — the answer of one question of an H5P.SingleChoiceSet as the set itself recorded it, for the
 * one statement the xAPI bridge does not send as the library wrote it.
 *
 * Why: H5P.SingleChoiceSet 1.11 shuffles a question's alternatives and keeps two records of an answer: the place on
 *      screen of the chosen alternative (`userResponses`) and its stored index (`userAnswerIndex`, 0 is the right
 *      one). Its `answered` statement is written from the first: `result.response` is the place on screen, and
 *      `success` and `score` say "right" when the alternative shown first was chosen. Insight (INS-002, INS-003)
 *      counts by the stored index, so a statement sent as written would show a share right that follows the
 *      shuffle. The bridge sends the stored index, read from the instance that raised the event, or no answer at
 *      all when it cannot read it: never the library's (D-151).
 * Spec: LTI-010, INS-002, INS-003, DATA-012
 * Invariants:
 *   - Only a statement that an H5P.SingleChoiceSet instance raised (`libraryInfo.machineName`, which
 *     H5P.newRunnable sets) and that carries a `subContentId` of its own is touched; every other result, the set's
 *     own included, is returned as it was given.
 *   - With the set's record: `response` is the stored index, `success` and `score.raw`/`score.scaled` follow it
 *     (index 0 is right). Without it (another version of the library, a question the set does not hold): the result
 *     keeps only `completion` and `duration`.
 *   - PRIVACY: nothing new leaves the page: an index replaces an index in the same fields (DATA-012, D-115).
 *   - Pure: reads only its arguments, changes neither, never throws. Defined once per window, as a read-only
 *     global, before ./xapiStatements.js reads it.
 * Collaborators: ./xapiStatements.js (`cut`, the only reader), ./xapiBridge.js (hands the raising instance on),
 *   apps/server/src/h5p/h5pAssets.ts (lists it first of the player-only scripts),
 *   apps/server/src/insight/content/questionShapes.ts (`singleChoiceQuestions` reads the same index).
 * Tests: packages/hvl-h5p-theme/test/xapiSingleChoiceSet.test.ts,
 *   apps/server/e2e/singleChoiceSetInsight.e2e.test.ts
 */
(function hvlXapiSingleChoiceSet() {
  'use strict';
  if (window.hvliXapiSingleChoiceSet) return;

  // UPSTREAM: https://github.com/h5p/h5p-single-choice-set/blob/d570a968fa9e3d944262f9bf5eed42ce2718f2bc/scripts/single-choice-set.js (no issue filed yet; SPEC-DEVIATION: D-151 says when this correction goes)
  // `handleQuestionFinished` gives `createXApiAnsweredEvent` `userResponses[index]`, the place on screen, where
  // `userAnswerIndex[index]` holds the stored index the statement's `correctResponsesPattern` ('0') is about.

  /** The stored index of the alternative chosen in the set's question, or null when its record does not give it. */
  function chosenIndex(set, subContentId) {
    try {
      var choices = set.options.choices;
      for (var i = 0; i < choices.length; i += 1) {
        if (choices[i] && choices[i].subContentId === subContentId) {
          var chosen = set.userAnswerIndex[i];
          return typeof chosen === 'number' && chosen >= 0 && chosen % 1 === 0 ? chosen : null;
        }
      }
    } catch {
      // WHY: another version of the library may keep its record elsewhere; then there is no answer to send.
    }
    return null;
  }

  function isSet(source) {
    try {
      return source.libraryInfo.machineName === 'H5P.SingleChoiceSet';
    } catch {
      return false;
    }
  }

  /**
   * The result to send for a statement.
   * `cut`: the result as ./xapiStatements.js cut it; `source`: the instance that raised the event; `subContentId`:
   * the statement's own. Returns `cut` itself unless a SingleChoiceSet raised the statement for one of its questions.
   */
  function result(cut, source, subContentId) {
    // WHY: a statement without an ID of its own is the set's own (its total), not a question's answer.
    if (!cut || typeof subContentId !== 'string' || subContentId === '' || !isSet(source)) return cut;
    var out = {};
    if (cut.completion !== undefined) out.completion = cut.completion;
    if (cut.duration !== undefined) out.duration = cut.duration;
    var chosen = chosenIndex(source, subContentId);
    if (chosen === null) return out;
    var raw = chosen === 0 ? 1 : 0;
    out.success = chosen === 0;
    out.score = Object.assign({ max: 1 }, cut.score, { raw: raw, scaled: raw });
    out.response = String(chosen);
    return out;
  }

  Object.defineProperty(window, 'hvliXapiSingleChoiceSet', { value: Object.freeze({ result: result }) });
})();
