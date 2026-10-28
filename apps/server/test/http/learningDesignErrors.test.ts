/**
 * Tests that every S5 error code of the API contract has a status, a message in nn, nb and en, and the right answer
 * shape, and that the contract's list of authorable types matches the server's.
 *
 * Spec: PROD-012, DOC-012, H5P-002
 */
import {
  AUTHORABLE_CONTENT_TYPES,
  LEARNING_DESIGN_ERROR_CODES,
  LEARNING_DESIGN_ERROR_STATUS,
} from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import { HVL_TOP10_CONTENT_TYPES } from '../../src/h5p/HvlTop10ContentTypeFilter.js';
import { HttpError } from '../../src/http/HttpError.js';
import { toErrorResponse } from '../../src/http/h5pErrorResponse.js';
import {
  isLearningDesignError,
  LEARNING_DESIGN_ERROR_KEYS,
  learningDesignError,
} from '../../src/http/learningDesignErrors.js';
import { LOCALES, t } from '../../src/i18n/translate.js';

describe('learningDesignErrors', () => {
  it('[PROD-012] every S5 code has a translated message in nn, nb and en, never the bare key', () => {
    // Act
    const missing = LEARNING_DESIGN_ERROR_CODES.flatMap((code) =>
      LOCALES.filter(
        (locale) => t(LEARNING_DESIGN_ERROR_KEYS[code], {}, locale) === LEARNING_DESIGN_ERROR_KEYS[code],
      ),
    );
    const texts = LEARNING_DESIGN_ERROR_CODES.map((code) => t(LEARNING_DESIGN_ERROR_KEYS[code], {}, 'nn'));
    // Assert
    expect(missing).toEqual([]);
    expect(Object.keys(LEARNING_DESIGN_ERROR_KEYS).sort()).toEqual([...LEARNING_DESIGN_ERROR_CODES].sort());
    expect(new Set(texts).size).toBe(texts.length);
  });

  it.each(LEARNING_DESIGN_ERROR_CODES.map((code) => [code, LEARNING_DESIGN_ERROR_STATUS[code]] as const))(
    '[DOC-012] %s answers with its contract status %i, its own code and a translated message',
    (code, status) => {
      // Act
      const error = learningDesignError(code);
      const answer = toErrorResponse(error, 'nb');
      // Assert
      expect(error).toBeInstanceOf(HttpError);
      expect(isLearningDesignError(error, code)).toBe(true);
      expect(answer).toEqual({
        status,
        body: {
          success: false,
          errorCode: code,
          httpStatusCode: status,
          message: t(LEARNING_DESIGN_ERROR_KEYS[code], {}, 'nb'),
        },
      });
    },
  );

  it('[PROD-012] only a deliberate code keeps a 5xx status; any other 5xx stays a generic fault', () => {
    // Arrange
    const pdfKey = LEARNING_DESIGN_ERROR_KEYS['hvl:pdf-unavailable'];
    // Act
    const wrongStatus = toErrorResponse(new HttpError(500, pdfKey, {}, 'hvl:pdf-unavailable'), 'nn');
    const notDeliberate = toErrorResponse(new HttpError(503, pdfKey, {}, 'hvl:pattern-unavailable'), 'nn');
    // Assert
    for (const answer of [wrongStatus, notDeliberate]) {
      expect(answer.status).toBe(500);
      expect(answer.body.errorCode).toBe('internal');
    }
    expect(isLearningDesignError(new Error('hvl:pdf-busy'), 'hvl:pdf-busy')).toBe(false);
  });

  it('[H5P-002] the contract lists exactly the ten authorable content types the server allows', () => {
    expect([...AUTHORABLE_CONTENT_TYPES]).toEqual([...HVL_TOP10_CONTENT_TYPES]);
    expect(AUTHORABLE_CONTENT_TYPES).not.toContain('H5P.DragQuestion');
  });
});
