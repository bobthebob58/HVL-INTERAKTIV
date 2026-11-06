/**
 * Unit tests for `PURGE_RUN_DATE`, the day of the yearly purge (D-107): its default, a later day, and the refusal of
 * any day outside 31 August to 31 December, by the variable's name and never its value.
 *
 * Spec: DATA-003
 */
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import { envProblems, VALID_ENV } from '../support/authEnv.js';

describe('[DATA-003] PURGE_RUN_DATE', () => {
  it('[DATA-003] the purge runs on 31 August unless a later day is set (D-107)', () => {
    // Act
    const env = loadEnv(VALID_ENV);
    // Assert
    expect(env.PURGE_RUN_DATE).toEqual({ month: 8, day: 31 });
    expect(loadEnv({ ...VALID_ENV, PURGE_RUN_DATE: '09-15' }).PURGE_RUN_DATE).toEqual({ month: 9, day: 15 });
    expect(loadEnv({ ...VALID_ENV, PURGE_RUN_DATE: '12-31' }).PURGE_RUN_DATE).toEqual({ month: 12, day: 31 });
  });

  it('[DATA-003] a day before 31 August, after the year, or not written MM-DD stops the start, named without its value', () => {
    for (const value of ['08-15', '08-30', '01-10', '07-31', '09-31', '13-01', '9-15', 'tomorrow']) {
      // Act
      const problems = envProblems({ ...VALID_ENV, PURGE_RUN_DATE: value });
      // Assert
      expect(problems, value).toHaveLength(1);
      expect(problems[0]).toMatch(/^PURGE_RUN_DATE: must be a day from 08-31 to 12-31/);
      expect(problems[0]).not.toContain(value);
    }
  });
});
