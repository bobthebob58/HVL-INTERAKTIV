/**
 * Tests the grade-sync shapes: the counts per placement that authors see, and the retry of a placement's failed jobs.
 *
 * Spec: LTI-012, LTI-013
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  DEFAULT_MASTERY_THRESHOLD,
  gradeSyncRetryRequestSchema,
  gradeSyncRetryResponseSchema,
  gradeSyncStatusResponseSchema,
} from '../src/index.js';

const CONTENT = '0192f0c4-0000-7000-8000-000000000001';
const PLACEMENT = '0192f0c4-0000-7000-8000-000000000002';

const placement = (extra: object = {}) => ({
  placementId: PLACEMENT,
  platformName: 'HVL Canvas',
  contextLabel: 'SYK110',
  graded: true,
  attemptPolicy: 'mastery',
  masteryThreshold: DEFAULT_MASTERY_THRESHOLD,
  counts: { sent: 12, pending: 1, failed: 2, orphaned: 0 },
  ...extra,
});

/** Every property name in a JSON Schema, at any depth. */
const propertyNames = (node: unknown): string[] =>
  typeof node !== 'object' || node === null
    ? []
    : Object.entries(node).flatMap(([key, value]) =>
        key === 'properties' && typeof value === 'object' && value !== null
          ? [...Object.keys(value), ...propertyNames(value)]
          : propertyNames(value),
      );

describe('[LTI-012] grade-sync status and retry', () => {
  it('[LTI-012] shows sent, pending, failed and orphaned jobs per placement, with its policy', () => {
    // Act and assert
    expect(
      gradeSyncStatusResponseSchema.safeParse({ contentId: CONTENT, placements: [placement()] }).success,
    ).toBe(true);
    expect(
      gradeSyncStatusResponseSchema.safeParse({
        contentId: CONTENT,
        placements: [placement({ attemptPolicy: 'best', masteryThreshold: null, contextLabel: null })],
      }).success,
    ).toBe(true);
    expect(gradeSyncStatusResponseSchema.safeParse({ contentId: CONTENT, placements: [] }).success).toBe(
      true,
    );
    expect(DEFAULT_MASTERY_THRESHOLD).toBe(0.8);
  });

  it('[LTI-012] refuses a count that is negative or fractional, an unknown policy or state, and a threshold above 1', () => {
    // Arrange
    const parses = (extra: object) =>
      gradeSyncStatusResponseSchema.safeParse({ contentId: CONTENT, placements: [placement(extra)] }).success;
    // Act and assert
    expect(parses({ counts: { sent: -1, pending: 0, failed: 0, orphaned: 0 } })).toBe(false);
    expect(parses({ counts: { sent: 1.5, pending: 0, failed: 0, orphaned: 0 } })).toBe(false);
    expect(parses({ counts: { sent: 1, pending: 0, failed: 0, orphaned: 0, superseded: 0 } })).toBe(false);
    expect(parses({ attemptPolicy: 'first' })).toBe(false);
    expect(parses({ masteryThreshold: 1.2 })).toBe(false);
  });

  it('[LTI-012] no answer carries a learner key, a Canvas user ID or a score: the counts are of jobs', () => {
    // Act
    const names = [gradeSyncStatusResponseSchema, gradeSyncRetryResponseSchema].flatMap((schema) =>
      propertyNames(z.toJSONSchema(schema)),
    );
    // Assert
    expect(names.length).toBeGreaterThan(5);
    expect(names.filter((name) => /learner|sub|user|score|attempt(?!Policy)/i.test(name))).toEqual([]);
  });

  it('[LTI-012] a retry names one placement and says how many jobs are pending again and how many stay failed', () => {
    // Act and assert
    expect(gradeSyncRetryRequestSchema.safeParse({ placementId: PLACEMENT }).success).toBe(true);
    expect(gradeSyncRetryRequestSchema.safeParse({}).success).toBe(false);
    expect(gradeSyncRetryRequestSchema.safeParse({ placementId: 'all' }).success).toBe(false);
    expect(gradeSyncRetryRequestSchema.safeParse({ placementId: PLACEMENT, force: true }).success).toBe(
      false,
    );
    expect(gradeSyncRetryResponseSchema.safeParse({ requeued: 2, stillFailed: 1 }).success).toBe(true);
    expect(gradeSyncRetryResponseSchema.safeParse({ requeued: 2 }).success).toBe(false);
  });
});
