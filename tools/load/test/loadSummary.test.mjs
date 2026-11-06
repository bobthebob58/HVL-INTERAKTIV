/**
 * loadSummary.test — the run's text summary from k6's end-of-test data: each threshold's verdict and value, and the
 * measured values beside them.
 * Spec: NFR-001
 */
import { describe, expect, it } from 'vitest';
import { loadSummaryText, thresholdLines } from '../k6/loadSummary.js';

const trend = (p95, med) => ({
  type: 'trend',
  contains: 'time',
  values: { 'p(95)': p95, med, max: p95 + 10, avg: med },
});

/** k6 summary data in the shape k6 2.3.0 hands to `handleSummary` (seen in the smoke's summary.json). */
const data = (playerOk = true) => ({
  state: { testRunDurationMs: 41_300 },
  metrics: {
    hvli_player_ready: { ...trend(1351, 161), thresholds: { 'p(95)<3000': { ok: playerOk } } },
    'http_req_duration{kind:api}': { ...trend(38, 9), thresholds: { 'p(95)<300': { ok: true } } },
    http_req_failed: { type: 'rate', values: { rate: 0 }, thresholds: { 'rate<0.01': { ok: true } } },
    checks: { type: 'rate', values: { rate: 1 }, thresholds: { 'rate>0.99': { ok: true } } },
    hvli_launch: trend(400, 20),
    'http_req_duration{name:xapi}': trend(45, 10),
    iterations: { type: 'counter', values: { count: 60, rate: 1.45 } },
    http_reqs: { type: 'counter', values: { count: 6180, rate: 149.6 } },
    hvli_visit_bytes: { type: 'trend', values: { avg: 1_532_000 } },
  },
});

describe('the load summary (NFR-001)', () => {
  it('[NFR-001] gives each threshold its verdict and measured value', () => {
    // Act
    const { lines, passed } = thresholdLines(data());

    // Assert
    expect(passed).toBe(true);
    expect(lines).toEqual([
      '  PASS  hvli_player_ready p(95)<3000: 1351 ms',
      '  PASS  http_req_duration{kind:api} p(95)<300: 38 ms',
      '  PASS  http_req_failed rate<0.01: 0.00 %',
      '  PASS  checks rate>0.99: 100.00 %',
    ]);
  });

  it('[NFR-001] says so when a threshold fails, and when a metric is missing', () => {
    // Act
    const failed = thresholdLines(data(false));
    const empty = thresholdLines({ metrics: {} });

    // Assert
    expect(failed.passed).toBe(false);
    expect(failed.lines[0]).toBe('  FAIL  hvli_player_ready p(95)<3000: 1351 ms');
    expect(empty.passed).toBe(false);
    expect(empty.lines.every((line) => line.startsWith('  FAIL') && line.endsWith(': –'))).toBe(true);
  });

  it('[NFR-001] writes the profile, the visits, the requests and the bytes per visit', () => {
    // Act
    const text = loadSummaryText(data(), { profile: 'smoke', learners: 20 });

    // Assert
    expect(text).toMatch(/^HVL Interaktiv load test \(NFR-001\), profile smoke: 20 learners, 41 s\n/);
    expect(text).toContain('Thresholds (all passed):');
    expect(text).toContain('http_req_duration{name:xapi}: p95 45 ms, median 10 ms');
    expect(text).toContain('Visits: 60 (1.45/s), requests: 6180, checks passed: 100.00 %');
    expect(text).toContain('Bytes per visit (page, scripts, styles): 1496 KiB');
    expect(text.endsWith('\n')).toBe(true);
  });
});
