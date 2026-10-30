/**
 * resetNeededWording — gives the 409 `hvl:learner-state-reset-needed` of a structural save the words of where the
 * save came from: the portal may also save the change as a new version, Canvas may only reset or cancel.
 *
 * Why: the contract's message (`learningDesign.error.learnerStateResetNeeded`) offers «Lagre som ny versjon», which
 *      Canvas does not have (D-098); an author in Canvas who reads the answer (a screen reader of the raw answer, an
 *      API client, the editor page when its dialog cannot run) must not be sent to a choice that is not there.
 * Spec: PROD-013, UD-013
 * Invariants:
 *   - Only that refusal changes, and only its message: the status (409) and the machine code stay, so the editor page
 *     branches the same way in both places.
 *   - "Canvas" is a request that came with an ltik (the H5P actor's URL token), as the editor page decides it.
 *   - The message says nothing about who or how many have progress (D-093).
 * Collaborators: ../../http/routes/contentRoutes.ts (the save route), ../../http/learningDesignErrors.ts,
 *   ../../i18n/locales/*.json (`safeEditing.resetNeededCanvas`).
 * Tests: apps/server/test/learningDesign/safeEditing/resetNeededWording.test.ts,
 *   apps/server/test/learningDesign/safeEditing/saveChoiceAccess.int.test.ts
 */
import { LEARNING_DESIGN_ERROR_STATUS } from '@hvl-interaktiv/api-contract';
import type { HvlH5pActor } from '../../h5p/HvlH5pUser.js';
import { HttpError } from '../../http/HttpError.js';
import { isLearningDesignError } from '../../http/learningDesignErrors.js';

const RESET_NEEDED = 'hvl:learner-state-reset-needed';

/**
 * The refusal of a save in the words of where it was sent.
 * @param error - What the save threw.
 * @param actor - The saver.
 * @returns The same error, or for a Canvas save the learner-state refusal with Canvas's message.
 * @spec PROD-013
 */
export function inWordsOfSaver(error: unknown, actor: HvlH5pActor): unknown {
  if (actor.urlToken?.name !== 'ltik' || !isLearningDesignError(error, RESET_NEEDED)) return error;
  return new HttpError(
    LEARNING_DESIGN_ERROR_STATUS[RESET_NEEDED],
    'safeEditing.resetNeededCanvas',
    {},
    RESET_NEEDED,
  );
}
