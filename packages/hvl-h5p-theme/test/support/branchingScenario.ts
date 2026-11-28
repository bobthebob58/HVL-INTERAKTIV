/**
 * branchingScenario — a stand-in for a running H5P.BranchingScenario 1.10 as the bridge sees it: its list of kept
 * statements, its `navigated` event, and the `answered` statement H5P.BranchingQuestion 1.0 writes for a choice.
 *
 * Why: the bridge's tests for a scenario's choices (INS-004, D-154) drive the scenario's moves by hand. The shapes
 *      are the ones the probe of 2026-11-28 recorded from the real libraries, texts and feedback included, so a
 *      test can show that none of them leaves the page.
 * Spec: INS-004, LTI-010
 * Invariants:
 *   - `move` does what the scenario does: it puts the statement of the node it leaves last on `xAPIData`, then calls
 *     the `navigated` listeners in the order they were added, with the move's data as `event.data`.
 *   - `restart` gives the scenario a new, empty list, as its `resetTask` does.
 * Collaborators: ../../src/xapiBranchingChoices.js, ./bridgeDocument.ts.
 * Tests: packages/hvl-h5p-theme/test/xapiBranchingChoices.test.ts
 */
import { CONTENT_ID, type Statement } from './bridgeDocument.js';

/** The two decisions of the stand-in scenario (the nodes' `subContentId`s). */
export const [FIRST_DECISION, LAST_DECISION] = [
  'b3a7c1d2-4e5f-4a6b-8c7d-9e0f1a2b3c02',
  'b3a7c1d2-4e5f-4a6b-8c7d-9e0f1a2b3c05',
];

/** The data of a `navigated` event. */
export interface Move {
  readonly nextContentId?: number;
  readonly chosenAlternative?: unknown;
  readonly reverse?: boolean;
  readonly isResuming?: boolean;
}

/**
 * The statement H5P.BranchingQuestion 1.0 writes for a choice (`getXAPIData()`), with the texts it carries.
 * @param decision - The node's `subContentId`.
 * @param index - The chosen option's index.
 * @returns The statement as the scenario keeps it.
 */
export function keptChoice(decision: string, index: unknown): Statement {
  return {
    actor: { name: '', mbox: 'mailto:', objectType: 'Agent' },
    verb: { id: 'http://adlnet.gov/expapi/verbs/answered', display: { 'en-US': 'answered' } },
    object: {
      id: `${CONTENT_ID}?subContentId=${decision}`,
      objectType: 'Activity',
      definition: {
        extensions: {
          'https://h5p.org/x-api/no-correct-answer': 1,
          'https://h5p.org/x-api/branching-choice-feedback': { title: 'Studentane kjem førebudde' },
        },
        description: { 'en-US': 'Korleis vil du bruke tida før samlinga?' },
        type: 'http://adlnet.gov/expapi/activities/cmi.interaction',
        interactionType: 'choice',
        correctResponsesPattern: [],
        choices: [
          { id: '0', description: { 'en-US': 'Eg lagar ein kort video.' } },
          { id: '1', description: { 'en-US': 'Eg sender ut ei lang pensumliste.' } },
        ],
      },
    },
    context: {
      contextActivities: {
        parent: [{ id: CONTENT_ID, objectType: 'Activity' }],
        category: [{ id: 'http://h5p.org/libraries/H5P.BranchingQuestion-1.0', objectType: 'Activity' }],
      },
    },
    result: { completion: true, duration: 'PT1.2S', response: index },
    timestamp: '2026-11-28T09:53:56.049Z',
  };
}

/** The statement the scenario keeps for a content page that is a question, which dispatches its own `answered`. */
export const keptPage = (): Statement => ({
  verb: { id: 'http://adlnet.gov/expapi/verbs/answered' },
  object: { id: `${CONTENT_ID}?subContentId=b3a7c1d2-4e5f-4a6b-8c7d-9e0f1a2b3c01` },
  context: {
    contextActivities: { category: [{ id: 'http://h5p.org/libraries/H5P.MultiChoice-1.16' }] },
  },
  result: { completion: true, response: '1' },
});

/**
 * A running scenario.
 * @param restored - Statements its list holds from the start, as after a resume from saved state.
 * @returns The instance the bridge is handed, with `move` and `restart` to drive it and `listening` to count.
 */
export function fakeScenario(restored: Statement[] = []) {
  const listeners: ((event: { data: Move | undefined }) => void)[] = [];
  const scenario = {
    libraryInfo: { machineName: 'H5P.BranchingScenario', majorVersion: 1, minorVersion: 10 },
    xAPIData: restored.map((statement) => ({ statement })),
    on: (type: string, listener: (event: { data: Move | undefined }) => void) => {
      if (type === 'navigated') listeners.push(listener);
    },
  };
  return {
    scenario,
    /** One move: `kept` is the statement of the node the learner leaves, when the scenario keeps one. */
    move: (data: Move | undefined, kept?: Statement) => {
      if (kept) scenario.xAPIData.push({ statement: kept });
      for (const listener of listeners) listener({ data });
    },
    restart: () => {
      scenario.xAPIData = [];
    },
    listening: () => listeners.length,
  };
}
