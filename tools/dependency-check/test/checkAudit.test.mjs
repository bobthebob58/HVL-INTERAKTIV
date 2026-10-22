/**
 * Tests for the audit check with reviewed, expiring exceptions.
 *
 * Spec: SEC-007
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { assertAuditReport, blockingAdvisories, evaluateAudit } from '../checkAudit.mjs';

const advisory = (name, severity, ghsa) => ({
  source: 1,
  name,
  severity,
  title: `${name} is broken`,
  url: `https://github.com/advisories/${ghsa}`,
});
const REPORT = {
  vulnerabilities: {
    'h5p-server': { via: ['image-size'] },
    'image-size': { via: [advisory('image-size', 'high', 'GHSA-aaaa-bbbb-cccc')] },
    lodash: { via: [advisory('lodash', 'moderate', 'GHSA-dddd-eeee-ffff')] },
    tar: { via: [advisory('tar', 'critical', 'GHSA-gggg-hhhh-iiii')] },
  },
};
const EXCEPTION = {
  advisory: 'GHSA-aaaa-bbbb-cccc',
  package: 'image-size',
  decision: 'D-001',
  expires: '2027-01-31',
};

describe('[SEC-007] npm audit with reviewed exceptions', () => {
  it('[SEC-007] keeps only high and critical advisories, once each', () => {
    expect(blockingAdvisories(REPORT).map((a) => a.id)).toEqual([
      'GHSA-aaaa-bbbb-cccc',
      'GHSA-gggg-hhhh-iiii',
    ]);
  });

  it('[SEC-007] fails on an advisory without an exception', () => {
    const problems = evaluateAudit(blockingAdvisories(REPORT), [EXCEPTION], new Set(['D-001']), '2026-10-21');
    expect(problems).toEqual(['GHSA-gggg-hhhh-iiii (tar): unreviewed — tar is broken']);
  });

  it('[SEC-007] fails when an exception has expired or names an unknown decision', () => {
    const [a] = blockingAdvisories(REPORT);
    expect(evaluateAudit([a], [EXCEPTION], new Set(['D-001']), '2027-02-01')).toEqual([
      'GHSA-aaaa-bbbb-cccc (image-size): exception expired on 2027-01-31; review it again',
    ]);
    expect(evaluateAudit([a], [EXCEPTION], new Set(), '2026-10-21')).toEqual([
      'GHSA-aaaa-bbbb-cccc (image-size): exception names unknown decision D-001',
    ]);
  });

  it('[SEC-007] fails on an exception that is no longer needed', () => {
    expect(evaluateAudit([], [EXCEPTION], new Set(['D-001']), '2026-10-21')).toEqual([
      'GHSA-aaaa-bbbb-cccc (image-size): no longer reported; remove the exception',
    ]);
  });

  it('[SEC-007] every committed exception names a decision and an expiry date', () => {
    const exceptions = JSON.parse(readFileSync(new URL('../audit-exceptions.json', import.meta.url), 'utf8'));
    for (const e of exceptions) {
      expect(e.decision).toMatch(/^D-\d{3}$/);
      expect(e.expires).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.mitigation.length).toBeGreaterThan(20);
    }
  });

  it('[SEC-007] treats a failed audit as an error, never as "no advisories"', () => {
    const offline = {
      message: 'request to https://registry.npmjs.org failed, reason: ECONNREFUSED',
      error: { summary: '' },
    };
    expect(() => assertAuditReport(offline)).toThrow('npm audit did not produce a report: request to');
    expect(() => assertAuditReport({})).toThrow('unexpected output');
    expect(assertAuditReport({ vulnerabilities: {}, metadata: {} })).toEqual({
      vulnerabilities: {},
      metadata: {},
    });
  });

  it('[SEC-007] an exception is valid up to and including its expiry date', () => {
    const [a] = blockingAdvisories(REPORT);
    expect(evaluateAudit([a], [EXCEPTION], new Set(['D-001']), '2027-01-31')).toEqual([]);
  });
});
