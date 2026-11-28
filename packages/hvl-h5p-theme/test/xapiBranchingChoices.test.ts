/**
 * Tests for the one statement the bridge sends that H5P did not dispatch: the `answered` statement an
 * H5P.BranchingScenario keeps for each choice at a decision (D-154): when the module hands a choice on, and what it
 * hands on. In a simulated player document (jsdom), with a stand-in scenario whose shapes the probe recorded from
 * the real libraries; through the bridge: ./xapiBranchingChoicesBridge.test.ts; the real libraries in Chromium:
 * apps/server/test/h5p/xapiBranchingChoices.browser.int.test.ts.
 *
 * Spec: INS-004, LTI-010, DATA-012
 */
import { describe, expect, it } from 'vitest';
import {
  FIRST_DECISION,
  LAST_DECISION,
  fakeScenario,
  keptChoice,
  keptPage,
} from './support/branchingScenario.js';
import { openBridgeDocument, type Statement } from './support/bridgeDocument.js';

interface Choices {
  watch(source: unknown, send: (statement: Statement) => void): void;
}
const choices = (
  openBridgeDocument({ config: null }).dom.window as unknown as { hvliXapiBranchingChoices: Choices }
).hvliXapiBranchingChoices;

/** A watched scenario and what the module handed on, as `<decision's last two characters>=<index>`. */
function watched(restored: Statement[] = []) {
  const run = fakeScenario(restored);
  const sent: string[] = [];
  choices.watch(run.scenario, (kept) => {
    const id = (kept.object as { id: string }).id;
    sent.push(`${id.slice(-2)}=${String((kept.result as { response: unknown }).response)}`);
  });
  return { ...run, sent };
}

describe('[INS-004] the choices of a Branching Scenario', () => {
  it('[INS-004][DATA-012] hands on the verb, the object, the context and the index of a kept choice, nothing else', () => {
    // Arrange
    const run = fakeScenario();
    const handed: Statement[] = [];
    choices.watch(run.scenario, (kept) => handed.push(kept));
    const kept = keptChoice(FIRST_DECISION, 1);
    // Act
    run.move({ nextContentId: 3, chosenAlternative: 1 }, kept);
    // Assert: a copy, so the scenario's own statement is neither sent whole nor changed
    expect(handed).toEqual([
      { verb: kept.verb, object: kept.object, context: kept.context, result: { response: 1 } },
    ]);
    expect(handed[0]).not.toBe(kept);
    expect(kept.result).toEqual({ completion: true, duration: 'PT1.2S', response: 1 });
  });

  it('[INS-004] each choice hands on the statement the scenario kept for it, the last one before the end too', () => {
    // Arrange
    const run = watched();
    // Act: a page, the first decision (option 1), a page, the last decision (option 2), which ends the scenario
    run.move({ nextContentId: 1 });
    run.move({ nextContentId: 3, chosenAlternative: 1 }, keptChoice(FIRST_DECISION, 1));
    run.move({ nextContentId: 4 }, keptPage());
    run.move({ nextContentId: -1, chosenAlternative: 2 }, keptChoice(LAST_DECISION, 2));
    // Assert
    expect(run.sent).toEqual(['02=1', '05=2']);
  });

  it('[INS-004] a decision made again is handed on again, after a loop, the back button or a restart', () => {
    // Arrange
    const run = watched();
    // Act: option 1, the loop back, option 0; then back (`reverse`, which keeps the page's own entry) and option 1
    // once more; then a new run
    run.move({ nextContentId: 3, chosenAlternative: 1 }, keptChoice(FIRST_DECISION, 1));
    run.move({ nextContentId: 1 });
    run.move({ nextContentId: 2, chosenAlternative: 0 }, keptChoice(FIRST_DECISION, 0));
    run.move({ reverse: true }, keptPage());
    run.move({ nextContentId: 3, chosenAlternative: 1 }, keptChoice(FIRST_DECISION, 1));
    run.restart();
    run.move({ nextContentId: 3, chosenAlternative: 1 }, keptChoice(FIRST_DECISION, 1));
    // Assert
    expect(run.sent).toEqual(['02=1', '02=0', '02=1', '02=1']);
  });

  it('[INS-004] a resumed scenario sends only the choices made after the resume', () => {
    // Arrange: the saved state gave the list one choice back
    const run = watched([keptChoice(FIRST_DECISION, 0)]);
    // Act: H5P's two resume moves, then a page and a choice
    run.move({ nextContentId: 1, isResuming: true });
    run.move({ nextContentId: 2, isResuming: true });
    run.move({ nextContentId: 4 });
    run.move({ nextContentId: -1, chosenAlternative: 2 }, keptChoice(LAST_DECISION, 2));
    // Assert
    expect(run.sent).toEqual(['05=2']);
  });

  it('[INS-004][DATA-012] a move the scenario kept no matching choice for sends nothing, never a guess', () => {
    // Arrange
    const run = watched([keptChoice(FIRST_DECISION, 1)]);
    const other = {
      ...keptChoice(FIRST_DECISION, 1),
      verb: { id: 'http://adlnet.gov/expapi/verbs/interacted' },
    };
    // Act: nothing kept (the old entry answers with 1 too); another index kept; a page's statement kept; another
    // verb; a resume that names a choice; an index that is no whole number; a move without data
    run.move({ nextContentId: 3, chosenAlternative: 1 });
    run.move({ nextContentId: 3, chosenAlternative: 1 }, keptChoice(FIRST_DECISION, 0));
    run.move({ nextContentId: 3, chosenAlternative: 1 }, keptPage());
    run.move({ nextContentId: 3, chosenAlternative: 1 }, other);
    run.move({ nextContentId: 3, chosenAlternative: 1, isResuming: true }, keptChoice(FIRST_DECISION, 1));
    for (const index of ['1', 1.5, -1, null]) {
      run.move({ nextContentId: 3, chosenAlternative: index }, keptChoice(FIRST_DECISION, index));
    }
    run.move(undefined, keptChoice(FIRST_DECISION, 1));
    // Assert
    expect(run.sent).toEqual([]);
  });

  it('[INS-004] only a Branching Scenario is watched, once, and an instance it cannot read is left alone', () => {
    // Arrange
    const run = fakeScenario();
    const other = fakeScenario();
    other.scenario.libraryInfo.machineName = 'H5P.CoursePresentation';
    const broken = { libraryInfo: { machineName: 'H5P.BranchingScenario' } };
    // Act
    choices.watch(run.scenario, () => undefined);
    choices.watch(run.scenario, () => undefined);
    choices.watch(other.scenario, () => undefined);
    const unreadable = () =>
      [undefined, null, 'text', {}, broken].forEach((source) => choices.watch(source, () => undefined));
    // Assert
    expect(unreadable).not.toThrow();
    expect([run.listening(), other.listening()]).toEqual([1, 0]);
  });
});
