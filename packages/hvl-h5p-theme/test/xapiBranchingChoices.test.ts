/**
 * Tests for the one statement the bridge sends that H5P did not dispatch: the `answered` statement an
 * H5P.BranchingScenario keeps for each choice at a decision (D-154). In a simulated player document (jsdom), with a
 * stand-in scenario whose shapes the probe recorded from the real libraries; the real libraries in Chromium:
 * apps/server/test/h5p/xapiBranchingChoices.browser.int.test.ts.
 *
 * Spec: INS-004, LTI-010, DATA-012
 */
import { xapiStatementItemSchema } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import {
  FIRST_DECISION,
  LAST_DECISION,
  fakeScenario,
  keptChoice,
  keptPage,
} from './support/branchingScenario.js';
import { CONTENT_ID, openBridgeDocument, statement, type Statement } from './support/bridgeDocument.js';

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
    // Act: option 1, the loop back, option 0; then back (`reverse`) and option 1 once more; then a new run
    run.move({ nextContentId: 3, chosenAlternative: 1 }, keptChoice(FIRST_DECISION, 1));
    run.move({ nextContentId: 1 });
    run.move({ nextContentId: 2, chosenAlternative: 0 }, keptChoice(FIRST_DECISION, 0));
    run.move({ reverse: true });
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

describe('[LTI-010] a choice through the bridge', () => {
  const category = [{ id: 'http://h5p.org/libraries/H5P.BranchingScenario-1.10' }];
  const ROOT = { context: { contextActivities: { category } } };
  /** A learner's page with a scenario that has raised its first event, as H5P does when it attaches. */
  function playing() {
    const page = openBridgeDocument({ mainLibrary: 'H5P.BranchingScenario 1.10' });
    const run = fakeScenario();
    page.dispatch(statement('attempted', ROOT), run.scenario);
    return { page, run };
  }
  const sent = async (page: ReturnType<typeof openBridgeDocument>) => {
    page.tick();
    await page.settle();
    return page.requests.flatMap((request) => request.body.statements);
  };

  it('[LTI-010][DATA-012] is cut like a dispatched answer: the index leaves the page, no text does', async () => {
    // Arrange
    const { page, run } = playing();
    // Act
    run.move({ nextContentId: 3, chosenAlternative: 1 }, keptChoice(FIRST_DECISION, 1));
    const [attempted, choice, ...rest] = await sent(page);
    // Assert
    expect(rest).toEqual([]);
    expect(choice).toEqual({
      statementId: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
      attemptId: attempted?.attemptId,
      verb: { id: 'http://adlnet.gov/expapi/verbs/answered' },
      object: {
        id: `${CONTENT_ID}?subContentId=${FIRST_DECISION}`,
        definition: { interactionType: 'choice' },
      },
      context: {
        contextActivities: {
          parent: [{ id: CONTENT_ID }],
          category: [{ id: 'http://h5p.org/libraries/H5P.BranchingQuestion-1.0' }],
        },
      },
      result: { completion: true, duration: 'PT1.2S', response: '1' },
    });
    expect(JSON.stringify(choice)).not.toMatch(/samlinga|video|pensum|førebudde|mailto/);
    expect(xapiStatementItemSchema.safeParse(choice).success).toBe(true);
  });

  it('[LTI-010] the choice that ends a run belongs to the attempt its root result closed', async () => {
    // Arrange
    const { page, run } = playing();
    const result = { completion: true, score: { raw: 5, min: 0, max: 10, scaled: 0.5 } };
    const completed = statement('completed', { ...ROOT, result });
    // Act: H5P raises the root result inside the move, before the choice is handed on; later a new run's choice
    page.dispatch(completed, run.scenario);
    run.move({ nextContentId: -1, chosenAlternative: 2 }, keptChoice(LAST_DECISION, 2));
    await page.settle();
    run.move({ nextContentId: 3, chosenAlternative: 1 }, keptChoice(FIRST_DECISION, 1));
    const items = await sent(page);
    // Assert
    expect(items.map((item) => String(item.attemptId).split(':')[1])).toEqual(['1', '1', '1', '2']);
  });

  it('[LTI-010] a choice does not end an attempt, and an event from H5P’s own frame starts no watch', async () => {
    // Arrange
    const { page, run } = playing();
    const framed = fakeScenario();
    // Act
    run.move({ nextContentId: 3, chosenAlternative: 1 }, keptChoice(FIRST_DECISION, 1));
    run.move({ nextContentId: 1 });
    run.move({ nextContentId: 2, chosenAlternative: 0 }, keptChoice(FIRST_DECISION, 0));
    page.h5p.externalEmbed = false;
    page.dispatch(statement('attempted'), framed.scenario);
    const items = await sent(page);
    // Assert
    expect(items.map((item) => (item.result as { response?: unknown } | undefined)?.response)).toEqual([
      undefined,
      '1',
      '0',
    ]);
    expect(new Set(items.map((item) => item.attemptId)).size).toBe(1);
    expect([run.listening(), framed.listening()]).toEqual([1, 0]);
  });
});
