/**
 * loadProfiles.test — the load profiles and thresholds against NFR-001's own numbers in spec 00, and the k6 options
 * they become.
 * Spec: NFR-001, LTI-003
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { k6Options, NFR_001, PROFILES, profileOf, SYSTEM_TAGS, THRESHOLDS } from '../k6/loadProfiles.js';

const spec = readFileSync(new URL('../../../docs/specs/00-product-and-pedagogy.md', import.meta.url), 'utf8');
const nfr001 = /#### NFR-001[\s\S]*?(?=\n#### )/.exec(spec)?.[0] ?? '';

describe('the load profiles (NFR-001)', () => {
  it('[NFR-001] takes its numbers from the spec: 200 learners, 3 s at p95, API p95 300 ms', () => {
    // Act
    const learners = Number(/(\d+) concurrent learners/.exec(nfr001)?.[1]);
    const seconds = Number(/≤ (\d+) s at p95/.exec(nfr001)?.[1]);
    const apiMs = Number(/API p95 is ≤ (\d+) ms/.exec(nfr001)?.[1]);

    // Assert
    expect(NFR_001).toEqual({ learners, playerReadyP95Ms: seconds * 1000, apiP95Ms: apiMs });
    expect(THRESHOLDS).toEqual({
      hvli_player_ready: ['p(95)<3000'],
      'http_req_duration{kind:api}': ['p(95)<300'],
      http_req_failed: ['rate<0.01'],
      checks: ['rate>0.99'],
    });
  });

  it('[NFR-001] runs the full profile at 200 learners for 10 minutes, ramped up and down', () => {
    // Act
    const { scenarios } = k6Options('full');

    // Assert
    expect(PROFILES.full.learners).toBe(200);
    expect(scenarios.learners.stages).toEqual([
      { duration: '60s', target: 200 },
      { duration: '10m', target: 200 },
      { duration: '30s', target: 0 },
    ]);
    expect(PROFILES.full).toMatchObject({ thinkSeconds: [5, 15], rounds: 6 });
  });

  it('[NFR-001] runs the smoke at 20 learners for 30 s with the same thresholds as the full run', () => {
    // Act
    const smoke = k6Options('smoke');
    const full = k6Options('full');

    // Assert
    expect(smoke.scenarios.learners).toMatchObject({ executor: 'constant-vus', vus: 20, duration: '30s' });
    expect(PROFILES.smoke.learners).toBe(smoke.scenarios.learners.vus);
    expect(smoke.thresholds).toEqual(full.thresholds);
    for (const [metric, limits] of Object.entries(THRESHOLDS))
      expect(smoke.thresholds[metric]).toEqual(limits);
    expect(smoke.batchPerHost).toBe(6);
  });

  it('[LTI-003] never makes a URL a tag, so no ltik can reach a metric', () => {
    // Act
    const { systemTags } = k6Options('smoke');

    // Assert
    expect(systemTags).toEqual([...SYSTEM_TAGS]);
    expect(systemTags).not.toContain('url');
    expect(systemTags).toContain('name');
  });

  it('[NFR-001] refuses a profile it does not know', () => {
    // Act and assert
    expect(() => profileOf('huge')).toThrow(/smoke or full/);
    expect(() => k6Options(undefined)).toThrow(/smoke or full/);
  });
});
