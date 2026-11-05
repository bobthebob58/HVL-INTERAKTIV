/**
 * xapiBatches.test — the load's xAPI batches against the contract's schema (`xapiBatchSchema`) and the server's own
 * root tests, the learner-state form, and the UUIDs.
 * Spec: NFR-001, LTI-011
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { xapiBatchSchema } from '../../../packages/api-contract/src/xapi.ts';
import {
  isRootResult,
  isRootStatement,
  subContentIdOf,
} from '../../../apps/server/src/xapi/xapiRootTests.ts';
import {
  answeredBatch,
  attemptedBatch,
  completedBatch,
  stateSaveForm,
  uuidFromBytes,
} from '../k6/xapiBatches.js';

const page = {
  contentId: randomUUID(),
  contentVersion: 1,
  endpoint: '/api/h5p/xapi',
  category: 'http://h5p.org/libraries/H5P.QuestionSet-1.21',
  questions: [
    { subContentId: '6c1f0a52-3d8e-4b7a-9f21-5e4c8b0d7a11', library: 'H5P.MultiChoice 1.16' },
    { subContentId: 'a83e5d27-91b4-4c6f-8e02-7d3b1f9c4e22', library: 'H5P.Blanks 1.14' },
    { subContentId: '2f7b9c41-6e0a-4d58-b3c7-9a1e5d8f0b33', library: 'H5P.DragText 1.10' },
  ],
};
const view = { viewId: randomUUID(), uuid: randomUUID };

describe('the load sends what the bridge sends', () => {
  it('[LTI-011] builds batches the contract accepts, with the page activity and version', () => {
    // Act
    const batches = [
      attemptedBatch(page, view),
      ...page.questions.map((question, i) => answeredBatch(page, view, question, i % 2 === 0)),
      completedBatch(page, view, { raw: 2, max: 3, seconds: 12.4 }),
      completedBatch(page, view, { raw: 0, max: 0, seconds: 1 }),
    ];

    // Assert
    for (const batch of batches) {
      const parsed = xapiBatchSchema.safeParse(batch);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      expect(parsed.data).toEqual(batch);
      expect(batch).toMatchObject({ contentId: page.contentId, contentVersion: 1 });
      expect(batch.statements[0].attemptId).toBe(`${view.viewId}:1`);
    }
  });

  it('[NFR-001] makes the opening and the total root statements and each answer a part, as the server reads them', () => {
    // Act
    const [attempted] = attemptedBatch(page, view).statements;
    const [answered] = answeredBatch(page, view, page.questions[1], true).statements;
    const [completed] = completedBatch(page, view, { raw: 1, max: 3, seconds: 30 }).statements;

    // Assert
    expect(isRootStatement(attempted, page.contentId)).toBe(true);
    expect(isRootStatement(answered, page.contentId)).toBe(false);
    expect(subContentIdOf(answered)).toBe(page.questions[1].subContentId);
    expect(isRootResult(completed, page.contentId, page.category)).toBe(true);
    expect(completed.result.score).toEqual({ raw: 1, max: 3, min: 0, scaled: 0.3333 });
  });

  it('[NFR-001] saves a learner state H5P can read back, with no personal data', () => {
    // Act
    const form = stateSaveForm(2, 4);

    // Assert
    expect(form).toMatchObject({ preload: '1', invalidate: '1' });
    expect(JSON.parse(form.data)).toEqual({
      progress: 2,
      answers: [[0], [0], [], []],
      questions: [{}, {}, {}, {}],
    });
  });

  it('[LTI-011] makes version 4 UUIDs the contract accepts', () => {
    // Act
    const ids = Array.from({ length: 50 }, () => uuidFromBytes(randomBytes(16)));

    // Assert
    for (const id of ids)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Set(ids).size).toBe(50);
    expect(uuidFromBytes(new Uint8Array(16))).toBe('00000000-0000-4000-8000-000000000000');
  });
});
