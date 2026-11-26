/**
 * Tests for the rules an audit exception must meet (D-145): it is complete, its expiry is a real date at most 120
 * days ahead, it covers one advisory for one package once, and the audit check holds an advisory to the package
 * its exception was written for.
 *
 * Spec: SEC-007
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  exceptionProblems,
  isCalendarDate,
  MAX_EXCEPTION_DAYS,
} from '../auditExceptionRules.mjs';
import { blockingAdvisories, evaluateAudit } from '../checkAudit.mjs';

const TODAY = '2026-11-26';
const ENTRY = {
  advisory: 'GHSA-aaaa-bbbb-cccc',
  package: 'image-size',
  decision: 'D-030',
  expires: '2027-01-31',
  mitigation: 'The parser is reached only after the upload check.',
};
const PLACE = 'audit-exceptions.json, entry 1 (GHSA-aaaa-bbbb-cccc)';
/** A copy of an entry that has no `expires` field at all. */
const withoutExpiry = (entry) =>
  Object.fromEntries(Object.entries(entry).filter(([field]) => field !== 'expires'));
const ADVISORY = { id: ENTRY.advisory, pkg: 'image-size', title: 'image-size is broken' };
const via = (name, ghsa) => ({
  source: 1,
  name,
  severity: 'high',
  title: `${name} is broken`,
  url: `https://github.com/advisories/${ghsa}`,
});

describe('[SEC-007] an audit exception is complete, dated and single', () => {
  it('[SEC-007] the committed exceptions meet the rules today', () => {
    const exceptions = JSON.parse(readFileSync(new URL('../audit-exceptions.json', import.meta.url), 'utf8'));
    expect(exceptionProblems(exceptions, new Date().toISOString().slice(0, 10))).toEqual([]);
    expect(exceptionProblems([ENTRY], TODAY)).toEqual([]);
  });

  it('[SEC-007] an exception without an expiry, or with one that is not a date, is refused', () => {
    // Arrange
    const undated = withoutExpiry(ENTRY);
    const dated = (expires) => exceptionProblems([{ ...ENTRY, expires }], TODAY);
    // Act
    const missing = exceptionProblems([undated], TODAY);
    // Assert
    expect(missing).toEqual([`${PLACE}: needs expires`]);
    expect(dated('')).toEqual([`${PLACE}: needs expires`]);
    expect(dated(20270131)).toEqual([`${PLACE}: needs expires`]);
    for (const text of ['never', '2027-1-31', '31.01.2027', '2027-02-30', '2027-13-01', '2027-01-31T00:00'])
      expect(dated(text)).toEqual([`${PLACE}: expires "${text}" is not a calendar date (YYYY-MM-DD)`]);
  });

  it('[SEC-007] an expiry more than 120 days ahead is refused, and one on the last day is not', () => {
    // Arrange: 120 days after 2026-11-26 is 2027-03-26
    const dated = (expires) => exceptionProblems([{ ...ENTRY, expires }], TODAY);
    // Act and assert
    expect(MAX_EXCEPTION_DAYS).toBe(120);
    expect(daysBetween(TODAY, '2027-03-26')).toBe(120);
    expect(dated('2027-03-26')).toEqual([]);
    expect(dated('2027-03-27')).toEqual([
      `${PLACE}: expires 2027-03-27 is more than 120 days ahead; review it sooner`,
    ]);
    expect(dated('2099-12-31')).toHaveLength(1);
  });

  it('[SEC-007] an entry needs every field, a GHSA ID and a decision ID', () => {
    // Act
    const empty = exceptionProblems([{}], TODAY);
    const ids = exceptionProblems([{ ...ENTRY, advisory: 'image-size', decision: 'D-30' }], TODAY);
    // Assert
    expect(empty).toEqual(
      ['advisory', 'package', 'decision', 'expires', 'mitigation'].map(
        (field) => `audit-exceptions.json, entry 1: needs ${field}`,
      ),
    );
    expect(ids).toEqual([
      'audit-exceptions.json, entry 1 (image-size): advisory is not an advisory ID (GHSA-xxxx-xxxx-xxxx)',
      'audit-exceptions.json, entry 1 (image-size): decision "D-30" is not a decision ID (D-123)',
    ]);
    expect(exceptionProblems([null, 'GHSA-aaaa-bbbb-cccc'], TODAY)).toEqual([
      'audit-exceptions.json, entry 1: must be an object',
      'audit-exceptions.json, entry 2: must be an object',
    ]);
    expect(exceptionProblems({ ...ENTRY }, TODAY)).toEqual([
      'audit-exceptions.json: must be a list of exceptions',
    ]);
  });

  it('[SEC-007] a second exception for the same advisory and package is refused', () => {
    expect(exceptionProblems([ENTRY, { ...ENTRY, expires: '2027-02-28' }], TODAY)).toEqual([
      'audit-exceptions.json, entry 2 (GHSA-aaaa-bbbb-cccc): a second exception for image-size',
    ]);
    expect(exceptionProblems([ENTRY, { ...ENTRY, package: 'sharp' }], TODAY)).toEqual([]);
  });

  it('[SEC-007] calendar dates are told from text that only looks like one', () => {
    expect(['2027-01-31', '2028-02-29'].map(isCalendarDate)).toEqual([true, true]);
    expect(['2027-02-29', '2027-00-10', '2027-01-32', ' 2027-01-31', undefined].map(isCalendarDate)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('[SEC-007] the audit check holds an exception to its package and its date', () => {
  const decisions = new Set(['D-030']);

  it('[SEC-007] an exception with a missing or misspelt expiry no longer covers its advisory', () => {
    // Arrange
    const undated = withoutExpiry(ENTRY);
    // Act
    const missing = evaluateAudit([ADVISORY], [undated], decisions, TODAY);
    const misspelt = evaluateAudit([ADVISORY], [{ ...ENTRY, expires: 'never' }], decisions, TODAY);
    const far = evaluateAudit([ADVISORY], [{ ...ENTRY, expires: '2099-12-31' }], decisions, TODAY);
    // Assert
    expect(missing).toEqual([`${PLACE}: needs expires`]);
    expect(misspelt).toEqual([`${PLACE}: expires "never" is not a calendar date (YYYY-MM-DD)`]);
    expect(far).toEqual([`${PLACE}: expires 2099-12-31 is more than 120 days ahead; review it sooner`]);
    expect(evaluateAudit([ADVISORY], [ENTRY], decisions, TODAY)).toEqual([]);
  });

  it('[SEC-007] an exception written for one package does not cover the advisory for another', () => {
    // Arrange: the advisory is reported for `sharp`, the exception names `image-size`
    const reported = { ...ADVISORY, pkg: 'sharp', title: 'sharp is broken' };
    // Act
    const problems = evaluateAudit([reported], [ENTRY], decisions, TODAY);
    // Assert
    expect(problems).toEqual([
      'GHSA-aaaa-bbbb-cccc (sharp): the exception is written for image-size, not for this package',
      'GHSA-aaaa-bbbb-cccc (image-size): no longer reported; remove the exception',
    ]);
  });

  it('[SEC-007] an advisory that names two packages needs an exception for each', () => {
    // Arrange
    const report = {
      vulnerabilities: {
        'image-size': { via: [via('image-size', 'GHSA-aaaa-bbbb-cccc')] },
        sharp: { via: [via('sharp', 'GHSA-aaaa-bbbb-cccc')] },
      },
    };
    // Act
    const advisories = blockingAdvisories(report);
    const one = evaluateAudit(advisories, [ENTRY], decisions, TODAY);
    const both = evaluateAudit(advisories, [ENTRY, { ...ENTRY, package: 'sharp' }], decisions, TODAY);
    // Assert
    expect(advisories.map((a) => a.pkg)).toEqual(['image-size', 'sharp']);
    expect(one).toEqual([
      'GHSA-aaaa-bbbb-cccc (sharp): the exception is written for image-size, not for this package',
    ]);
    expect(both).toEqual([]);
  });
});
