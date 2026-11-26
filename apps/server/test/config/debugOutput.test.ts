/**
 * Tests for the debug switches: production does not start with `DEBUG` or `NODE_DEBUG` set, because their output
 * goes around the logger that removes personal data and secrets.
 *
 * Spec: DATA-009, NFR-006
 */
import { describe, expect, it } from 'vitest';
import { debugOutputProblems } from '../../src/config/debugOutput.js';
import { envProblems, productionEnv, VALID_ENV } from '../support/authEnv.js';

const AUTUMN_2026 = new Date('2026-10-22T12:00:00Z');

describe('[DATA-009] debug output outside the logger', () => {
  it('[DATA-009] production refuses DEBUG and NODE_DEBUG by name, without showing their values', () => {
    // Act
    const problems = envProblems(
      productionEnv({ DEBUG: 'express:*,h5p:*', NODE_DEBUG: 'http' }),
      AUTUMN_2026,
    );
    // Assert
    expect(problems.map((p) => p.split(':')[0])).toEqual(['DEBUG', 'NODE_DEBUG']);
    expect(problems.join('\n')).not.toMatch(/express|h5p:|http\b/);
    expect(problems[0]).toContain('must be unset in production');
  });

  it('[DATA-009] an empty switch is unset, and development may use both', () => {
    expect(envProblems(productionEnv({ DEBUG: '', NODE_DEBUG: '' }), AUTUMN_2026)).toEqual([]);
    expect(envProblems({ ...VALID_ENV, DEBUG: 'express:*', NODE_DEBUG: 'http' })).toEqual([]);
    expect(debugOutputProblems({})).toEqual([]);
  });
});
