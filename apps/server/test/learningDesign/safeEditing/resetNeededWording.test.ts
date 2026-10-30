/**
 * Unit tests for the words of a structural save's 409 (D-093, D-098): from Canvas it offers reset or cancel and no
 * new version; from the portal, and for every other error, nothing changes.
 *
 * Spec: PROD-013, UD-013
 */
import { describe, expect, it } from 'vitest';
import { HttpError } from '../../../src/http/HttpError.js';
import { learningDesignError } from '../../../src/http/learningDesignErrors.js';
import { LOCALES, t } from '../../../src/i18n/translate.js';
import { inWordsOfSaver } from '../../../src/learningDesign/safeEditing/resetNeededWording.js';
import { testActor } from '../../support/testActors.js';

const canvas = testActor('author', { urlToken: { name: 'ltik', value: 'l' } });
const portal = testActor('author', { urlToken: { name: 'csrf', value: 'c' } });

describe('[PROD-013] the words of a structural save’s 409', () => {
  it('[PROD-013] from Canvas: the same status and code, with Canvas’s message', () => {
    // Act
    const answer = inWordsOfSaver(learningDesignError('hvl:learner-state-reset-needed'), canvas);
    // Assert
    expect(answer).toBeInstanceOf(HttpError);
    expect(answer).toMatchObject({
      status: 409,
      errorCode: 'hvl:learner-state-reset-needed',
      messageKey: 'safeEditing.resetNeededCanvas',
    });
  });

  it('[PROD-013] from the portal, and any other refusal from Canvas, stay as they are', () => {
    const portalAnswer = learningDesignError('hvl:learner-state-reset-needed');
    const other = learningDesignError('hvl:duplicate-not-allowed');
    expect(inWordsOfSaver(portalAnswer, portal)).toBe(portalAnswer);
    expect(inWordsOfSaver(other, canvas)).toBe(other);
  });

  it.each(LOCALES)(
    '[UD-013] in %s, Canvas’s message does not offer the portal’s «Lagre som ny versjon»',
    (locale) => {
      const text = t('safeEditing.resetNeededCanvas', {}, locale);
      expect(text).not.toBe(t('learningDesign.error.learnerStateResetNeeded', {}, locale));
      expect(text).not.toContain(t('safeEditing.dialog.saveAsCopy', {}, locale));
    },
  );
});
