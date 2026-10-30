/**
 * Unit tests of the DATA-012 mapper and D-115's storing rules on probe P1's real statements of all ten content types:
 * what is stored per type and attempt, the stored fields, batch order, invalid items and duplicates.
 *
 * Spec: DATA-012, LTI-011, LTI-012
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { mainLibraryCategory } from '../../src/xapi/xapiRootTests.js';
import type { XapiBatchFacts } from '../../src/xapi/xapiStatementRow.js';
import { fixturePlay, rowLine } from './support/xapiBridgeItems.js';
import { XapiMemoryStore } from './support/xapiMemoryStore.js';

const CONTENT_ID = '0192f0c4-1111-7000-8000-00000000c0de';
const factsFor = (ubername: string, overrides: Partial<XapiBatchFacts> = {}): XapiBatchFacts => ({
  contentId: CONTENT_ID,
  contentVersion: 1,
  contextId: null,
  learnerKey: 'learner-key-of-a-test-learner-000000000000',
  academicYear: 2026,
  mainCategory: mainLibraryCategory(ubername),
  ...overrides,
});

/** Posts each recorded view as its own batch, as the bridge does across page loads. */
function play(type: string, bridgeOnly = false) {
  const { views, ubername, machineName } = fixturePlay(type, CONTENT_ID, { bridgeOnly });
  const store = new XapiMemoryStore(machineName);
  const plans = views.map((view) => store.post(view.statements, factsFor(ubername)));
  return { store, plans, views };
}

// WHY: what D-115 stores of each type, from the full stream H5P sent (the "Gradable root result per type" table).
const STORED: Readonly<Record<string, readonly string[]>> = {
  'H5P.MultiChoice': ['attempted root #1', 'answered root 1/1 #1'],
  'H5P.Blanks': ['attempted root #1', 'answered root 6/7 #1'],
  'H5P.DragText': ['attempted root #1', 'answered root 3/4 #1', 'attempted root #1'],
  'H5P.QuestionSet': [
    'attempted root #1',
    'answered part …7a11 1/1 #1',
    'answered part …4e22 2/3 #1',
    'answered part …0b33 1/3 #1',
    'answered part …2a44 2/2 #1',
    'completed root 6/9 #1',
  ],
  'H5P.Column': ['answered part …8b03 1/1 #1', 'answered part …8b04 0/1 #1', 'completed root 1/2 #1'],
  'H5P.CoursePresentation': [
    'attempted root #1',
    'answered part …0d22 1/1 #1',
    'completed root 1/1 #1',
    'attempted root #1',
  ],
  // WHY: «Send inn rapport» shows since step 3 turned `reportingIsEnabled` on for learners (D-115, Q18).
  'H5P.InteractiveBook': ['attempted root #1', 'answered part …e612 1/1 #1', 'completed root 1/4 #1'],
  'H5P.ImageHotspots': [],
  'H5P.BranchingScenario': ['attempted root #1', 'completed root 10/10 #1'],
  'H5P.InteractiveVideo': ['attempted root #1', 'answered part …9a51 1/1 #1'],
};

describe('[DATA-012] the xAPI mapper on probe P1’s statements', () => {
  it.each(Object.keys(STORED))('[DATA-012] stores what D-115 keeps of %s, and nothing else', (type) => {
    // Act
    const { store, plans } = play(type);
    // Assert
    expect(store.rows.map(rowLine)).toEqual(STORED[type]);
    for (const plan of plans) expect(plan.discarded.invalid).toBe(0);
  });

  it.each(Object.keys(STORED))('[LTI-011] stores the same rows of %s from what the bridge sends', (type) => {
    // Act
    const { store, plans } = play(type, true);
    // Assert
    expect(store.rows.map(rowLine)).toEqual(STORED[type]);
    for (const plan of plans) expect(plan.discarded.notStored + plan.discarded.noSubContentId).toBe(0);
  });

  it('[DATA-012] drops CoursePresentation’s scored completed that the resume re-sends with no learner action', () => {
    // Act
    const { plans, views } = play('H5P.CoursePresentation');
    // Assert
    expect(views).toHaveLength(2);
    expect(plans[1]?.discarded.replay).toBe(1);
    expect(plans[1]?.rows.map(rowLine)).toEqual(['attempted root #1']);
  });

  it('[DATA-012] keeps exactly DATA-012’s fields of a MultiChoice answer, decided by the server', () => {
    // Arrange
    const { views, ubername } = fixturePlay('H5P.MultiChoice', CONTENT_ID);
    const store = new XapiMemoryStore('H5P.MultiChoice');
    const view = views[0];
    // Act
    store.post(view?.statements ?? [], factsFor(ubername, { contextId: `${randomUUID()}:course-1` }));
    const answered = store.rows.find((row) => row.verb === 'answered');
    // Assert
    expect(Object.keys(answered ?? {}).sort()).toEqual(
      [
        'academicYear',
        'attemptId',
        'completion',
        'contentId',
        'contentVersion',
        'contextId',
        'durationMs',
        'id',
      ]
        .concat(['learnerKey', 'response', 'scaled', 'scoreMax', 'scoreRaw', 'subContentId', 'success'])
        .concat(['timestamp', 'verb'])
        .sort(),
    );
    expect(answered).toMatchObject({
      id: view?.statements[2]?.statementId,
      contentId: CONTENT_ID,
      subContentId: null,
      learnerKey: 'learner-key-of-a-test-learner-000000000000',
      verb: 'answered',
      scoreRaw: 1,
      scoreMax: 1,
      scaled: 1,
      success: true,
      completion: true,
      response: '0',
      durationMs: 950,
      attemptId: `${view?.viewId ?? ''}:1`,
      academicYear: 2026,
    });
    expect(answered?.contextId).toMatch(/:course-1$/);
  });

  it('[DATA-012] keeps the gaps of a Blanks answer in place, the empty last one too', () => {
    // Act
    const { store } = play('H5P.Blanks');
    // Assert
    expect(store.rows.find((row) => row.verb === 'answered')?.response).toBe(
      'quiz[,]samtale[,]refleksjon[,]formativ[,]vidare[,]teksting[,]',
    );
  });

  it('[DATA-012] stores a QuestionSet question’s part, success and gap answer, and the set’s pass mark at the root', () => {
    // Act
    const { store } = play('H5P.QuestionSet');
    const [, first, blanks, , multi, root] = store.rows;
    // Assert
    expect(first).toMatchObject({ subContentId: '6c1f0a52-3d8e-4b7a-9f21-5e4c8b0d7a11', success: true });
    expect(blanks).toMatchObject({
      response: 'undervegsvurdering[,]framover[,]zzz',
      success: null,
      scaled: 0.6667,
    });
    expect(multi?.response).toBe('0[,]1');
    expect(root).toMatchObject({ verb: 'completed', success: true, scaled: 0.6667, durationMs: 2500 });
  });

  it('[DATA-012] stamps each row with the receive time plus its place in the batch, never the browser’s clock', () => {
    // Arrange
    const { views, ubername } = fixturePlay('H5P.QuestionSet', CONTENT_ID);
    const store = new XapiMemoryStore('H5P.QuestionSet', Date.parse('2026-10-30T12:00:00.000Z'));
    const statements = views[0]?.statements ?? [];
    // Act
    store.post(statements, factsFor(ubername));
    // Assert
    const offsets = store.rows.map((row) => row.timestamp.getTime() - Date.parse('2026-10-30T12:00:00.000Z'));
    const places = store.rows.map((row) => statements.findIndex((s) => s.statementId === row.id));
    expect(offsets).toEqual(places);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });
});
