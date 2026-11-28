/**
 * Tests for a Branching Scenario's choice on its way through the xAPI bridge (D-154), in a simulated player
 * document (jsdom): what leaves the page for a choice the module handed on, which attempt it carries, also the one
 * that ends a run, and that an event from H5P's own frame starts no watch. The module by itself:
 * ./xapiBranchingChoices.test.ts.
 *
 * Spec: LTI-010, INS-004, DATA-012
 */
import { xapiStatementItemSchema } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import { FIRST_DECISION, LAST_DECISION, fakeScenario, keptChoice } from './support/branchingScenario.js';
import { CONTENT_ID, openBridgeDocument, statement } from './support/bridgeDocument.js';

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
      result: { response: '1' },
    });
    // PRIVACY: the time the learner spent at the decision, which H5P's statement holds, does not leave the page.
    expect(JSON.stringify(choice)).not.toMatch(
      /samlinga|video|pensum|førebudde|mailto|PT1|completion|timestamp/,
    );
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
