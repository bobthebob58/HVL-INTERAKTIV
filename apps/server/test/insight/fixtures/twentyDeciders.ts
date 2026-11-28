/**
 * twentyDeciders — a Branching Scenario with two decisions and the synthetic stored rows of 20 learners (L01–L20)
 * who play it, for INS-004. The expected values are worked out by hand in ./README.md.
 *
 * Why: INS-004's figures (each learner's first choice per option, and who chose again) are checked against numbers
 *      worked out by hand, as INS-001's are. The rows are what the bridge sends for a scenario and D-154 stores: a
 *      root `attempted` per page load, one `answered` per choice under the decision's `subContentId` with the
 *      option's index as the response and no score, and a root `completed` at an end screen.
 * Spec: INS-004, INS-006
 * Tests: apps/server/test/insight/branchingChoices.test.ts, apps/server/test/insight/branchingDecisions.test.ts,
 *   apps/server/test/insight/insightCsvRows.test.ts
 */
import type { FixtureRow } from './thirtyLearners.js';

/** The scenario's decisions: D1 (two options; option 1 leads back to it) and D2 (three options, each an ending). */
export const D1 = 'b3a7c1d2-4e5f-4a6b-8c7d-9e0f1a2b3c02';
export const D2 = 'b3a7c1d2-4e5f-4a6b-8c7d-9e0f1a2b3c05';
const TEXT = 'b3a7c1d2-4e5f-4a6b-8c7d-9e0f1a2b3c0';

const page = (n: number, nextContentId: number) => ({
  type: { library: 'H5P.AdvancedText 1.1', subContentId: `${TEXT}${n}`, params: { text: '<p>Tekst</p>' } },
  nextContentId,
});
const decision = (subContentId: string, question: string, alternatives: [string, number][]) => ({
  type: {
    library: 'H5P.BranchingQuestion 1.0',
    subContentId,
    params: {
      branchingQuestion: {
        question,
        alternatives: alternatives.map(([text, nextContentId]) => ({ text, nextContentId, feedback: {} })),
      },
    },
  },
});

/** The scenario: node 1 is D1, node 4 is D2; node 3 leads back to D1. */
export const BRANCHING_SCENARIO_ACTIVITY = {
  mainLibrary: 'H5P.BranchingScenario',
  params: {
    branchingScenario: {
      content: [
        page(1, 1),
        decision(D1, '<p>Korleis vil du bruke tida <em>før</em> samlinga?</p>', [
          ['<p>Ein kort video og ein quiz</p>', 2],
          ['<p>Ei lang pensumliste</p>', 3],
        ]),
        page(3, 4),
        page(4, 1),
        decision(D2, '<p>Korleis gjer du materiellet tilgjengeleg?</p>', [
          ['<p>Tekstar videoen</p>', -1],
          ['<p>Eigne versjonar på førespurnad</p>', -1],
          ['<p>Papir på samlinga</p>', -1],
        ]),
      ],
    },
  },
};

const key = (n: number): string => `fixture-decider-${String(n).padStart(2, '0')}`;
const viewId = (n: number, view: number): string =>
  `00000000-0000-4000-8000-${String(n * 100 + view).padStart(12, '0')}`;

type Step = [verb: FixtureRow['verb'], item: string | null, response: string | null];
const chose = (item: string, option: number | string): Step => ['answered', item, String(option)];
const START: Step = ['attempted', null, null];
const END: Step = ['completed', null, null];

/** One page load of learner `n`, a minute between its rows. */
function pageLoad(n: number, view: number, steps: readonly Step[]): FixtureRow[] {
  const start = Date.parse('2026-11-02T08:00:00.000Z') + (n * 20 + view * 60) * 60_000;
  return steps.map(([verb, item, response], i) => ({
    learnerKey: key(n),
    attemptId: `${viewId(n, view)}:1`,
    subContentId: item,
    verb,
    scoreRaw: verb === 'completed' ? 10 : null,
    scoreMax: verb === 'completed' ? 10 : null,
    success: null,
    response,
    timestamp: new Date(start + i * 60_000),
  }));
}

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** The rows of L01–L20 (./README.md says who does what). */
export function deciderRows(): FixtureRow[] {
  /** D2's option per learner of groups A and B. */
  const last = (n: number): number => (n <= 6 || (n >= 10 && n <= 14) ? 0 : n === 9 ? 2 : 1);
  return [
    ...range(1, 9).flatMap((n) => pageLoad(n, 1, [START, chose(D1, 0), chose(D2, last(n)), END])),
    ...range(10, 16).flatMap((n) =>
      pageLoad(n, 1, [START, chose(D1, 1), chose(D1, 0), chose(D2, last(n)), END]),
    ),
    ...range(17, 18).flatMap((n) => pageLoad(n, 1, [START, chose(D1, 1)])),
    ...pageLoad(19, 1, [START, chose(D1, 0)]),
    ...pageLoad(19, 2, [START, chose(D1, 1)]),
    // L20 starts and sends three answers that are no choice: an index D1 does not have, an empty one and a word.
    ...pageLoad(20, 1, [START, chose(D1, 7), chose(D1, ''), chose(D1, 'ein')]),
  ];
}
