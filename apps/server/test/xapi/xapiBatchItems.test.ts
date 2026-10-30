/**
 * Unit tests of D-115's item-by-item checks on probe P1's MultiChoice statements: an invalid item discarded on its
 * own, a statement ID stored once, and statements about another activity refused.
 *
 * Spec: LTI-011, DATA-012
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isGradableResult, mainLibraryCategory } from '../../src/xapi/xapiRootTests.js';
import type { XapiBatchFacts } from '../../src/xapi/xapiStatementRow.js';
import { fixturePlay, rowLine } from './support/xapiBridgeItems.js';
import { XapiMemoryStore } from './support/xapiMemoryStore.js';

const CONTENT_ID = '0192f0c4-1111-7000-8000-00000000c0de';
const factsFor = (ubername: string): XapiBatchFacts => ({
  contentId: CONTENT_ID,
  contentVersion: 1,
  contextId: null,
  learnerKey: 'learner-key-of-a-test-learner-000000000000',
  academicYear: 2026,
  mainCategory: mainLibraryCategory(ubername),
});

describe('[LTI-011] items checked one by one', () => {
  const ubername = 'H5P.MultiChoice 1.16';

  it('[LTI-011] discards an invalid item on its own and stores the rest of its batch', () => {
    // Arrange
    const statements = fixturePlay('H5P.MultiChoice', CONTENT_ID).views[0]?.statements ?? [];
    const [attempted, , answered] = statements;
    const forged = {
      ...answered,
      statementId: randomUUID(),
      result: { score: { raw: 1, max: 1, scaled: 0.5 } },
    };
    // Act
    const plan = new XapiMemoryStore('H5P.MultiChoice').post(
      [attempted, forged, 'not a statement', answered],
      factsFor(ubername),
    );
    // Assert
    expect(plan.rows.map(rowLine)).toEqual(['attempted root #1', 'answered root 1/1 #1']);
    expect(plan.discarded.invalid).toBe(2);
  });

  it('[LTI-011] stores a statement ID once: a repeat in the batch and one stored before are skipped', () => {
    // Arrange
    const statements = fixturePlay('H5P.MultiChoice', CONTENT_ID).views[0]?.statements ?? [];
    const store = new XapiMemoryStore('H5P.MultiChoice');
    const first = statements[0];
    // Act
    const once = store.post(
      [first, { ...first, statementId: first?.statementId.toUpperCase() }],
      factsFor(ubername),
    );
    const again = store.post(statements, factsFor(ubername));
    // Assert
    expect(once.rows).toHaveLength(1);
    expect(once.discarded.duplicate).toBe(1);
    expect(again.discarded.duplicate).toBe(1);
    expect(store.rows.map(rowLine)).toEqual(['attempted root #1', 'answered root 1/1 #1']);
  });

  it('[LTI-011] discards a statement about another activity, by object ID or by H5P’s content-ID extension', () => {
    // Arrange
    const [attempted] = fixturePlay('H5P.MultiChoice', CONTENT_ID).views[0]?.statements ?? [];
    const other = randomUUID();
    const byObject = { ...attempted, statementId: randomUUID(), object: { id: other } };
    const byExtension = {
      ...attempted,
      statementId: randomUUID(),
      object: {
        id: CONTENT_ID,
        definition: { extensions: { 'http://h5p.org/x-api/h5p-local-content-id': other } },
      },
    };
    // Act
    const plan = new XapiMemoryStore('H5P.MultiChoice').post([byObject, byExtension], factsFor(ubername));
    // Assert
    expect(plan.rows).toEqual([]);
    expect(plan.discarded.otherActivity).toBe(2);
  });

  it('[LTI-011] stores a no-score ending (maximum 0, no scaled) as a root result that is not gradable', () => {
    // Arrange
    const bs = 'H5P.BranchingScenario 1.10';
    const ending = {
      statementId: randomUUID(),
      attemptId: `${randomUUID()}:1`,
      verb: { id: 'http://adlnet.gov/expapi/verbs/completed' },
      object: { id: CONTENT_ID },
      context: {
        contextActivities: { category: [{ id: 'http://h5p.org/libraries/H5P.BranchingScenario-1.10' }] },
      },
      result: { score: { raw: 0, max: 0, min: 0 } },
    };
    // Act
    const plan = new XapiMemoryStore('H5P.BranchingScenario').post([ending], factsFor(bs));
    // Assert
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]).toMatchObject({ verb: 'completed', scoreRaw: 0, scoreMax: 0, scaled: null });
    expect(plan.rows.filter(isGradableResult)).toEqual([]);
  });
});
