/**
 * Tests for the Session 5 environment variables: the minimum group size of exports and the PDF export's browser,
 * concurrency and sandbox switch.
 *
 * Spec: DOC-008, MAPPE-003, MAPPE-004
 */
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import { envProblems, VALID_ENV } from '../support/authEnv.js';

describe('[DOC-008] Session 5 configuration', () => {
  it('[DOC-008] applies the documented defaults: k = 5, two PDF renders, the sandbox on, no browser path', () => {
    // Act
    const env = loadEnv(VALID_ENV);
    // Assert
    expect(env).toMatchObject({ MIN_GROUP_SIZE: 5, PDF_MAX_CONCURRENCY: 2, PDF_ALLOW_NO_SANDBOX: false });
    expect(env.PDF_BROWSER_EXECUTABLE).toBeUndefined();
  });

  it('[DOC-008] reads the values .env.example documents, and treats empty values as unset', () => {
    // Act
    const set = loadEnv({
      ...VALID_ENV,
      MIN_GROUP_SIZE: '7',
      PDF_BROWSER_EXECUTABLE: '/usr/bin/chromium',
      PDF_MAX_CONCURRENCY: '8',
      PDF_ALLOW_NO_SANDBOX: 'true',
    });
    const empty = loadEnv({ ...VALID_ENV, MIN_GROUP_SIZE: '', PDF_BROWSER_EXECUTABLE: '' });
    // Assert
    expect(set).toMatchObject({
      MIN_GROUP_SIZE: 7,
      PDF_BROWSER_EXECUTABLE: '/usr/bin/chromium',
      PDF_MAX_CONCURRENCY: 8,
      PDF_ALLOW_NO_SANDBOX: true,
    });
    expect(empty.MIN_GROUP_SIZE).toBe(5);
    expect(empty.PDF_BROWSER_EXECUTABLE).toBeUndefined();
  });

  it.each([['2'], ['0'], ['-5'], ['4.5'], ['five']])(
    '[DOC-008] refuses MIN_GROUP_SIZE=%s: k is an integer of at least 3 (INS-006, D-095)',
    (value) => {
      expect(envProblems({ ...VALID_ENV, MIN_GROUP_SIZE: value }).map((p) => p.split(':')[0])).toEqual([
        'MIN_GROUP_SIZE',
      ]);
    },
  );

  it('[DOC-008] accepts the smallest k the specification allows', () => {
    expect(loadEnv({ ...VALID_ENV, MIN_GROUP_SIZE: '3' }).MIN_GROUP_SIZE).toBe(3);
  });

  it.each([['0'], ['9'], ['1.5'], ['many']])(
    '[DOC-008] refuses PDF_MAX_CONCURRENCY=%s: one to eight renders at a time',
    (value) => {
      expect(envProblems({ ...VALID_ENV, PDF_MAX_CONCURRENCY: value }).map((p) => p.split(':')[0])).toEqual([
        'PDF_MAX_CONCURRENCY',
      ]);
    },
  );

  it('[DOC-008] refuses a relative browser path and a sandbox switch other than true or false, by name', () => {
    // Act
    const problems = envProblems({
      ...VALID_ENV,
      PDF_BROWSER_EXECUTABLE: 'chromium',
      PDF_ALLOW_NO_SANDBOX: 'yes',
    });
    // Assert
    expect(problems).toHaveLength(2);
    expect(problems[0]).toBe('PDF_BROWSER_EXECUTABLE: must be an absolute path');
    expect(problems[1]).toMatch(/^PDF_ALLOW_NO_SANDBOX: /);
  });
});
