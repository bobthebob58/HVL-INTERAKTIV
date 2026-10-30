/**
 * Unit tests of D-115's replay rule over several batches: what H5P re-sends without a learner action is dropped,
 * while a first submission after a reload, a check after changed answers and BranchingScenario's endings are kept.
 *
 * Spec: DATA-012, LTI-012
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { XapiBatchFacts } from '../../src/xapi/xapiStatementRow.js';
import { rowLine } from './support/xapiBridgeItems.js';
import { XapiMemoryStore } from './support/xapiMemoryStore.js';

const C = '0192f0c4-5555-7000-8000-00000000c0de';
const PART = '6c1f0a52-3d8e-4b7a-9f21-5e4c8b0d7a11';

/** A page load of a test activity, posting statements as the bridge would. */
function pageLoad(library: string) {
  const viewId = randomUUID();
  const category = `http://h5p.org/libraries/${library.replace(' ', '-')}`;
  const statement = (verb: string, n: number, score?: [number, number], part?: string) => ({
    statementId: randomUUID(),
    attemptId: `${viewId}:${n}`,
    verb: { id: `http://adlnet.gov/expapi/verbs/${verb}` },
    object: { id: part ? `${C}?subContentId=${part}` : C },
    context: {
      contextActivities: { category: [{ id: category }], ...(part ? { parent: [{ id: C }] } : {}) },
    },
    ...(score ? { result: { score: { raw: score[0], max: score[1], scaled: score[0] / score[1] } } } : {}),
  });
  return {
    completed: (n: number, score: [number, number]) => statement('completed', n, score),
    answeredRoot: (n: number, score: [number, number]) => statement('answered', n, score),
    answeredPart: (n: number, score: [number, number]) => statement('answered', n, score, PART),
  };
}

const facts = (library: string, overrides: Partial<XapiBatchFacts> = {}): XapiBatchFacts => ({
  contentId: C,
  contentVersion: 1,
  contextId: null,
  learnerKey: 'replay-test-learner',
  academicYear: 2026,
  mainCategory: `http://h5p.org/libraries/${library.replace(' ', '-')}`,
  ...overrides,
});

describe('[DATA-012] replays of a root result (D-115)', () => {
  const QS = 'H5P.QuestionSet 1.21';

  it('[DATA-012] drops a QuestionSet re-submitted after a reload with no new answers and the same score', () => {
    // Arrange
    const store = new XapiMemoryStore('H5P.QuestionSet');
    const [first, second] = [pageLoad(QS), pageLoad(QS)];
    // Act
    store.post([first.answeredPart(1, [1, 1]), first.completed(1, [6, 9])], facts(QS));
    const resend = store.post([second.completed(1, [6, 9])], facts(QS));
    const changed = store.post([second.completed(1, [7, 9])], facts(QS));
    // Assert
    expect(resend.discarded.replay).toBe(1);
    expect(changed.rows.map(rowLine)).toEqual(['completed root 7/9 #1']);
  });

  it('[DATA-012] keeps the first submission after a reload when there is no earlier result', () => {
    const store = new XapiMemoryStore('H5P.QuestionSet');
    const plan = store.post([pageLoad(QS).completed(1, [6, 9])], facts(QS));
    expect(plan.rows.map(rowLine)).toEqual(['completed root 6/9 #1']);
  });

  it('[DATA-012] keeps a result with the same score when the page load answered again since its last result', () => {
    // Arrange
    const store = new XapiMemoryStore('H5P.Column');
    const view = pageLoad('H5P.Column 1.18');
    // Act
    store.post([view.answeredPart(1, [1, 1]), view.completed(1, [1, 2])], facts('H5P.Column 1.18'));
    const check = store.post(
      [view.answeredPart(2, [1, 1]), view.completed(2, [1, 2])],
      facts('H5P.Column 1.18'),
    );
    // Assert
    expect(check.rows.map(rowLine)).toEqual(['answered part …7a11 1/1 #2', 'completed root 1/2 #2']);
  });

  it('[DATA-012] drops a second arrival on the summary slide in the same page load with no answer between', () => {
    const store = new XapiMemoryStore('H5P.CoursePresentation');
    const view = pageLoad('H5P.CoursePresentation 1.28');
    const plan = store.post(
      [view.answeredPart(1, [1, 1]), view.completed(1, [1, 1]), view.completed(2, [1, 1])],
      facts('H5P.CoursePresentation 1.28'),
    );
    expect(plan.rows.map(rowLine)).toEqual(['answered part …7a11 1/1 #1', 'completed root 1/1 #1']);
    expect(plan.discarded.replay).toBe(1);
  });

  it('[DATA-012] never treats a root answered as a replay: each MultiChoice check is a result', () => {
    const store = new XapiMemoryStore('H5P.MultiChoice');
    const view = pageLoad('H5P.MultiChoice 1.16');
    const plan = store.post(
      [view.answeredRoot(1, [1, 1]), view.answeredRoot(2, [1, 1])],
      facts('H5P.MultiChoice 1.16'),
    );
    expect(plan.rows).toHaveLength(2);
  });

  it('[DATA-012] keeps every BranchingScenario ending, which navigation alone reaches', () => {
    const store = new XapiMemoryStore('H5P.BranchingScenario');
    const bs = 'H5P.BranchingScenario 1.10';
    store.post([pageLoad(bs).completed(1, [10, 10])], facts(bs));
    const again = store.post([pageLoad(bs).completed(1, [10, 10])], facts(bs));
    expect(again.rows).toHaveLength(1);
  });

  it('[DATA-012] compares with the latest result of the same context and version only', () => {
    // Arrange
    const store = new XapiMemoryStore('H5P.QuestionSet');
    store.post([pageLoad(QS).completed(1, [6, 9])], facts(QS));
    // Act
    const otherCourse = store.post(
      [pageLoad(QS).completed(1, [6, 9])],
      facts(QS, { contextId: `${randomUUID()}:k` }),
    );
    const newVersion = store.post([pageLoad(QS).completed(1, [6, 9])], facts(QS, { contentVersion: 2 }));
    // Assert
    expect(otherCourse.rows).toHaveLength(1);
    expect(newVersion.rows).toHaveLength(1);
  });
});
