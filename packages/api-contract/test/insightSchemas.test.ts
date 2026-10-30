/**
 * Tests the shapes every insight answer shares: a suppressed cell carries no value, the period is one of the fixed
 * choices, the context is the portal or a platform-scoped course, and nothing has a per-learner field.
 *
 * Spec: INS-006, INS-007, PROD-013
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  DEFAULT_INSIGHT_PERIOD,
  INSIGHT_PERIODS,
  insightCellSchema,
  insightContextKeySchema,
  insightCountCellSchema,
  insightMedianCellSchema,
  insightQuerySchema,
  insightRateCellSchema,
  insightScopeSchema,
} from '../src/index.js';

const PLATFORM = '0192f0c4-0000-7000-8000-00000000aaaa';
const CONTENT = '0192f0c4-0000-7000-8000-000000000001';

const scope = (extra: object = {}) => ({
  contentId: CONTENT,
  contentVersion: 2,
  currentVersion: 3,
  context: { key: `${PLATFORM}:4dde05e8ca1973bcca9bffc13e1548820eee93a3`, label: 'SYK110' },
  period: '7d',
  periodStart: '2026-10-22T22:00:00.000Z',
  periodEnd: '2026-10-30T12:00:00.000Z',
  k: 5,
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

describe('[INS-006] insight cells and scope', () => {
  it('[INS-006] a suppressed cell is `{ suppressed: true }` alone: no value, count or reason travels with it', () => {
    // Act and assert
    for (const cell of [insightCountCellSchema, insightRateCellSchema, insightMedianCellSchema]) {
      expect(cell.safeParse({ suppressed: true }).success).toBe(true);
      expect(cell.safeParse({ suppressed: true, value: 3 }).success).toBe(false);
      expect(cell.safeParse({ suppressed: true, value: null }).success).toBe(false);
      expect(cell.safeParse({ suppressed: true, reason: 'below-k' }).success).toBe(false);
      expect(cell.safeParse({ value: 7 }).success).toBe(false);
    }
  });

  it('[INS-006] a shown cell has its value: a count of learners, a share from 0 to 1, or a median', () => {
    // Act and assert
    expect(insightCountCellSchema.safeParse({ suppressed: false, value: 12 }).success).toBe(true);
    expect(insightCountCellSchema.safeParse({ suppressed: false, value: 1.5 }).success).toBe(false);
    expect(insightRateCellSchema.safeParse({ suppressed: false, value: 0 }).success).toBe(true);
    expect(insightRateCellSchema.safeParse({ suppressed: false, value: 1 }).success).toBe(true);
    expect(insightRateCellSchema.safeParse({ suppressed: false, value: 1.01 }).success).toBe(false);
    expect(insightMedianCellSchema.safeParse({ suppressed: false, value: 7.5 }).success).toBe(true);
    expect(insightCellSchema(z.string()).safeParse({ suppressed: false, value: 'B' }).success).toBe(true);
    expect(insightCellSchema(z.string()).safeParse({ suppressed: false }).success).toBe(false);
  });

  it('[INS-006] the shared shapes have no learner key, attempt ID, account or other per-learner field', () => {
    // Act
    const names = [
      insightScopeSchema,
      insightQuerySchema,
      insightCountCellSchema,
      insightRateCellSchema,
    ].flatMap((schema) => propertyNames(z.toJSONSchema(schema, { io: 'input' })));
    // Assert
    expect(names).toEqual(expect.arrayContaining(['suppressed', 'value', 'k', 'period']));
    expect(names.filter((name) => /learner|attempt|user|sub(?!Content)|actor|response/i.test(name))).toEqual(
      [],
    );
  });

  it('[INS-006] k is at least 3, as INS-006 allows the setting', () => {
    // Act and assert
    expect(insightScopeSchema.safeParse(scope()).success).toBe(true);
    expect(insightScopeSchema.safeParse(scope({ k: 3 })).success).toBe(true);
    expect(insightScopeSchema.safeParse(scope({ k: 2 })).success).toBe(false);
  });
});

describe('[INS-007] what one view covers', () => {
  it('[INS-007] the period is 7, 14 or 30 days or the semester, 7 days by default, never a date', () => {
    // Act and assert
    expect(INSIGHT_PERIODS).toEqual(['7d', '14d', '30d', 'semester']);
    expect(DEFAULT_INSIGHT_PERIOD).toBe('7d');
    for (const period of INSIGHT_PERIODS) expect(insightQuerySchema.safeParse({ period }).success).toBe(true);
    expect(insightQuerySchema.safeParse({ period: '2026-10-01' }).success).toBe(false);
    expect(insightQuerySchema.safeParse({ period: '60d' }).success).toBe(false);
    expect(insightQuerySchema.safeParse({ since: '2026-10-01' }).success).toBe(false);
    expect(insightQuerySchema.safeParse({}).success).toBe(true);
  });

  it('[INS-007] a context is the portal or `<platformId>:<contextId>`, never a bare Canvas course ID', () => {
    // Act and assert
    expect(insightContextKeySchema.safeParse('portal').success).toBe(true);
    expect(insightContextKeySchema.safeParse(`${PLATFORM}:course-1`).success).toBe(true);
    expect(insightContextKeySchema.safeParse(`${PLATFORM}:a:b`).success).toBe(true);
    expect(insightContextKeySchema.safeParse('course-1').success).toBe(false);
    expect(insightContextKeySchema.safeParse(`${PLATFORM}:`).success).toBe(false);
    expect(insightContextKeySchema.safeParse(`${PLATFORM.toUpperCase()}:course-1`).success).toBe(false);
    expect(insightContextKeySchema.safeParse(`${PLATFORM}:${'x'.repeat(256)}`).success).toBe(false);
  });

  it('[PROD-013] a view names one content version, from 1, and the current one for the version picker', () => {
    // Act and assert
    expect(insightQuerySchema.safeParse({ version: '2' }).success).toBe(true);
    expect(insightQuerySchema.safeParse({ version: '0' }).success).toBe(false);
    expect(insightQuerySchema.safeParse({ version: '02' }).success).toBe(false);
    expect(insightScopeSchema.safeParse(scope({ contentVersion: 0 })).success).toBe(false);
    expect(insightScopeSchema.safeParse(scope({ currentVersion: undefined })).success).toBe(false);
  });
});
