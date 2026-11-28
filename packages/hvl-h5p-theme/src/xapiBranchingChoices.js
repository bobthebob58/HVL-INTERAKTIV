/**
 * xapiBranchingChoices — hands the xAPI bridge the `answered` statement an H5P.BranchingScenario keeps for each
 * choice at a decision: the one statement the bridge sends that H5P made and did not dispatch.
 *
 * Why: insight shows how many learners chose each option at each decision of a scenario (INS-004). The scenario
 *      dispatches no statement that says which option was chosen: a choice with a feedback screen raises
 *      `interacted` without a result, and the last choice before an end screen raises nothing (D-115, probe P1).
 *      But for every choice it makes the question's `answered` statement (H5P's report contract, `getXAPIData()`)
 *      and puts it last on its own list `xAPIData`, and it fires its own `navigated` event with the chosen
 *      option's index (probe of 2026-11-28, D-154). This module watches that event and hands the kept statement
 *      to the bridge, which cuts and queues it like a dispatched one.
 * Spec: INS-004, LTI-010, DATA-012
 * Invariants:
 *   - Only an instance whose `libraryInfo.machineName` (set by H5P.newRunnable) is `H5P.BranchingScenario` is
 *     watched, and each instance once.
 *   - A statement is handed on only for a `navigated` event with a whole-number `chosenAlternative` and no
 *     `isResuming`, and only when the list's last entry is new since the last move, is an `answered` of an
 *     H5P.BranchingQuestion and answers with that same index. Anything else hands on nothing: a decision then has
 *     no learners in insight, never a wrong count.
 *   - A resume sends nothing again: the entries the saved state gave back are there before the first move. A
 *     decision made again (a loop, the back button, a restart) is a new entry and is handed on again.
 *   - PRIVACY: the statement holds the question's and the options' texts; ./xapiStatements.js `cut` keeps the
 *     verb, the IDs, the interaction type, `completion`, `duration` and the index only (DATA-012).
 *   - Changes nothing in the scenario, never throws into H5P. Defined once per window, as a read-only global,
 *     before ./xapiBridge.js reads it.
 * SPEC-DEVIATION: D-154 — LTI-010's bridge sends what `H5P.externalDispatcher` raises; this statement is read
 *   from the scenario, since H5P dispatches none for a choice.
 * Collaborators: ./xapiBridge.js (calls `watch` with the instance that raised an event, and queues what it is
 *   handed), ./xapiStatements.js (`cut`), apps/server/src/h5p/h5pAssets.ts (a player-only script),
 *   apps/server/src/insight/aggregate/branchingChoices.ts (counts the stored choices).
 * Tests: packages/hvl-h5p-theme/test/xapiBranchingChoices.test.ts,
 *   apps/server/test/h5p/xapiBranchingChoices.browser.int.test.ts
 */
(function hvlXapiBranchingChoices() {
  'use strict';
  if (window.hvliXapiBranchingChoices) return;
  var ANSWERED = 'http://adlnet.gov/expapi/verbs/answered';
  var QUESTION = 'http://h5p.org/libraries/H5P.BranchingQuestion-';
  var watching = new WeakSet();

  // UPSTREAM: https://github.com/h5p/h5p-branching-scenario/blob/6860e97e916054c09e9f2c4bb824ca958521213a/src/scripts/h5p-branching-scenario.js (no issue filed yet; draft in docs/upstream/h5p-branching-scenario-choice-statement.md)
  // The `navigated` handler pushes `libraryScreen.getXAPIData(currentId)` onto `xAPIData` and dispatches nothing
  // for a choice. Remove when: a pinned BranchingScenario dispatches an `answered` with the chosen index itself.

  /** The scenario's last kept entry, or undefined when it keeps none (or keeps its record elsewhere). */
  function lastKept(scenario) {
    var kept = scenario.xAPIData;
    return Array.isArray(kept) && kept.length > 0 ? kept[kept.length - 1] : undefined;
  }

  function isIndex(value) {
    return typeof value === 'number' && value >= 0 && value % 1 === 0;
  }

  /** Whether a kept statement is a branching question's answer with this index. */
  function isChoice(statement, index) {
    return (
      statement.verb.id === ANSWERED &&
      statement.context.contextActivities.category[0].id.indexOf(QUESTION) === 0 &&
      statement.result.response === index
    );
  }

  /**
   * Watches a scenario's choices.
   * `source`: the instance that raised an xAPI event; `send`: called with the kept statement of each choice made
   * from now on. Does nothing for any other instance, or one already watched.
   */
  function watch(source, send) {
    try {
      if (source.libraryInfo.machineName !== 'H5P.BranchingScenario' || watching.has(source)) return;
      if (typeof source.on !== 'function') return;
      var last = lastKept(source);
      // WHY: the scenario's own listener was added first, so it has kept the statement when this one runs.
      source.on('navigated', (event) => {
        try {
          var previous = last;
          last = lastKept(source);
          var data = event && event.data;
          if (!data || data.isResuming || !isIndex(data.chosenAlternative)) return;
          // WHY: an entry that was there before this move belongs to an earlier choice, whatever it answers.
          if (last && last !== previous && isChoice(last.statement, data.chosenAlternative))
            send(last.statement);
        } catch {
          // WHY: another version of the library may keep its record otherwise; then there is no choice to send.
        }
      });
      watching.add(source);
    } catch {
      // WHY: not an H5P instance the module can read; nothing is watched.
    }
  }

  Object.defineProperty(window, 'hvliXapiBranchingChoices', { value: Object.freeze({ watch: watch }) });
})();
