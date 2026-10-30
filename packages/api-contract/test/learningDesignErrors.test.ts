/**
 * Tests the table of S5 error codes the server and the web app share.
 *
 * Spec: DOC-012
 */
import { describe, expect, it } from 'vitest';
import {
  isLearningDesignErrorCode,
  LEARNING_DESIGN_ERROR_CODES,
  LEARNING_DESIGN_ERROR_STATUS,
} from '../src/index.js';

describe('[DOC-012] S5 error codes', () => {
  it('[DOC-012] every code is a stable hvl: code with a 4xx or 5xx status, and the list matches the table', () => {
    // Act
    const malformed = LEARNING_DESIGN_ERROR_CODES.filter((code) => !/^hvl:[a-z]+(?:-[a-z]+)*$/.test(code));
    const statuses = Object.values(LEARNING_DESIGN_ERROR_STATUS);
    // Assert
    expect(malformed).toEqual([]);
    expect(statuses.every((status) => status >= 400 && status <= 599)).toBe(true);
    expect([...LEARNING_DESIGN_ERROR_CODES]).toEqual(Object.keys(LEARNING_DESIGN_ERROR_STATUS));
    expect(Object.isFrozen(LEARNING_DESIGN_ERROR_CODES)).toBe(true);
  });

  it('[DOC-012] only the deliberate faults are 5xx: no PDF browser, every PDF slot busy, a failed duplicate', () => {
    // Act
    const faults = LEARNING_DESIGN_ERROR_CODES.filter((code) => LEARNING_DESIGN_ERROR_STATUS[code] >= 500);
    // Assert
    expect(faults.sort()).toEqual(['hvl:duplicate-failed', 'hvl:pdf-busy', 'hvl:pdf-unavailable']);
    expect(LEARNING_DESIGN_ERROR_STATUS['hvl:pdf-unavailable']).toBe(503);
  });

  it('[DOC-012] recognises the S5 codes only, not older codes or prototype keys', () => {
    expect(isLearningDesignErrorCode('hvl:learning-design-conflict')).toBe(true);
    for (const code of ['hvl:content-changed', 'error.badRequest', 'toString', '__proto__']) {
      expect(isLearningDesignErrorCode(code), code).toBe(false);
    }
  });
});
