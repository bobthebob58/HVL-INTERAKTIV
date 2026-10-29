/**
 * Unit tests for the editor's learner-state step: which saves keep state, which ask first, which reset it, and
 * whose state counts as someone else's.
 *
 * Spec: PROD-013
 */
import type { IUser } from '@lumieducation/h5p-server';
import { describe, expect, it } from 'vitest';
import { asAccountUser } from '../../../src/h5p/HvlH5pUser.js';
import { claimLearnerStateReset } from '../../../src/h5p/storage/learnerStateResetWrite.js';
import {
  LearnerStateGate,
  type SaveChoice,
} from '../../../src/learningDesign/safeEditing/LearnerStateGate.js';
import { testActor } from '../../support/testActors.js';

const STORED = { question: '<p>Kva?</p>', answers: [{ text: 'Ja', correct: true }] };
const METADATA = {
  mainLibrary: 'H5P.MultiChoice',
  preloadedDependencies: [{ machineName: 'H5P.MultiChoice', majorVersion: 1, minorVersion: 16 }],
};

/** A gate on a stored MultiChoice whose other learners have state when `othersHaveState`. */
function gateWith(othersHaveState: boolean) {
  const asked: (string | undefined)[] = [];
  const resets: string[] = [];
  const gate = new LearnerStateGate(
    {
      getContentParameters: async () => STORED,
      getContentMetadata: async () => METADATA as never,
    } as never,
    {
      hasOtherLearnersState: async (_id, ownKey) => {
        asked.push(ownKey);
        return othersHaveState;
      },
      resetLearnerState: async (id) => void resets.push(id),
    },
  );
  const save = async (params: object, user: IUser, choice?: SaveChoice) =>
    gate.runSave(await gate.admit('c1', params, 'H5P.MultiChoice 1.16', user, choice), async () => 'saved');
  return { gate, asked, resets, save };
}

const author = asAccountUser(testActor('author', { learnerKey: 'k'.repeat(43) }));
const twoOptions = { ...STORED, answers: [...STORED.answers, { text: 'Nei', correct: false }] };

describe('[PROD-013] LearnerStateGate', () => {
  it('[PROD-013] keeps all state for a new activity and for a text-only edit, without asking whose state there is', async () => {
    const { gate, asked, resets, save } = gateWith(true);
    expect(await gate.admit(undefined, twoOptions, 'H5P.MultiChoice 1.16', author)).toEqual({});
    await save({ ...STORED, question: '<p>Kva meiner du?</p>' }, author);
    expect({ asked, resets }).toEqual({ asked: [], resets: [] });
  });

  it('[PROD-013] refuses an unconfirmed structural edit with 409 while others have state, and resets nothing', async () => {
    const { asked, resets, save } = gateWith(true);
    await expect(save(twoOptions, author)).rejects.toMatchObject({
      status: 409,
      errorCode: 'hvl:learner-state-reset-needed',
      params: {},
    });
    expect({ asked, resets }).toEqual({ asked: ['k'.repeat(43)], resets: [] });
  });

  it('[PROD-013] resets the state after a confirmed structural edit, and after one nobody else has state for', async () => {
    const confirmed = gateWith(true);
    await confirmed.save(twoOptions, author, { confirmLearnerStateReset: true });
    const ownOnly = gateWith(false);
    await ownOnly.save(twoOptions, author);
    expect([confirmed.resets, ownOnly.resets]).toEqual([['c1'], ['c1']]);
  });

  it('[PROD-013] leaves the reset to a storage that claims it with its write, and resets after a write that did not', async () => {
    // Arrange
    const claimed = gateWith(false);
    const unclaimed = gateWith(false);
    const plan = await claimed.gate.admit('c1', twoOptions, 'H5P.MultiChoice 1.16', author);
    // Act
    const results = [
      await claimed.gate.runSave(plan, async () => claimLearnerStateReset('C1') && 'claimed'),
      await unclaimed.gate.runSave(plan, async () => claimLearnerStateReset('other') || 'unclaimed'),
    ];
    // Assert
    expect({ results, resets: [claimed.resets, unclaimed.resets] }).toEqual({
      results: ['claimed', 'unclaimed'],
      resets: [[], ['c1']],
    });
  });

  it('[PROD-013] counts every row as someone else’s when the saver is not a user it can read a learnerKey from', async () => {
    const { asked, save } = gateWith(false);
    await save(twoOptions, { id: 'x', name: '', email: '', type: 'local' });
    expect(asked).toEqual([undefined]);
  });
});
