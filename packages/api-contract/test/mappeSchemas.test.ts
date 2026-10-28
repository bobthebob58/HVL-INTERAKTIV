/**
 * Tests the pedagogisk mappe shapes: the picker list, the preview and export request with its limits, the export
 * format, and the word-count preview.
 *
 * Spec: MAPPE-001, MAPPE-002
 */
import { describe, expect, it } from 'vitest';
import {
  MAPPE_MAX_ACTIVITIES,
  mappeActivityListSchema,
  mappeExportQuerySchema,
  mappePreviewSchema,
  mappeRequestSchema,
} from '../src/index.js';

const id = (n: number) => `0192f0c4-0000-7000-8000-${String(n).padStart(12, '0')}`;

describe('[MAPPE-001] choosing activities and exporting', () => {
  it('[MAPPE-001] a request names 1 to 50 distinct activities and the language; the criteria set is optional', () => {
    // Arrange
    const request = (contentIds: string[], extra: object = {}) =>
      mappeRequestSchema.safeParse({ contentIds, locale: 'nn', ...extra }).success;
    const many = (n: number) => Array.from({ length: n }, (_, i) => id(i + 1));
    // Act and assert
    expect(request([id(1)])).toBe(true);
    expect(request(many(MAPPE_MAX_ACTIVITIES), { criteriaSet: 'hvl-merittering-2025' })).toBe(true);
    expect(request([])).toBe(false);
    expect(request(many(MAPPE_MAX_ACTIVITIES + 1))).toBe(false);
    expect(request([id(1), id(1)])).toBe(false);
    expect(request(['not-a-uuid'])).toBe(false);
    expect(request([id(1)], { criteriaSet: 'HVL 2025' })).toBe(false);
    expect(mappeRequestSchema.safeParse({ contentIds: [id(1)] }).success).toBe(false);
  });

  it('[MAPPE-001] the export format is md or pdf, and the picker shows course, phase and date', () => {
    // Arrange
    const item = { contentId: id(1), title: 'Quiz', mainLibrary: 'H5P.MultiChoice', status: 'published' };
    const dated = {
      ...item,
      phase: 'forarbeid',
      courseCode: 'SYK110',
      updatedAt: '2026-10-28T12:00:00.000Z',
    };
    // Act and assert
    expect(mappeExportQuerySchema.safeParse({ format: 'pdf' }).success).toBe(true);
    expect(mappeExportQuerySchema.safeParse({ format: 'docx' }).success).toBe(false);
    expect(mappeActivityListSchema.safeParse({ items: [dated] }).success).toBe(true);
    expect(mappeActivityListSchema.safeParse({ items: [{ ...dated, rationale: 'Fordi.' }] }).success).toBe(
      false,
    );
  });
});

describe('[MAPPE-002] the word-count preview', () => {
  it('[MAPPE-002] the preview gives counts and limits of the criteria set, and whether one is exceeded', () => {
    // Arrange
    const preview = {
      criteriaSet: 'hvl-merittering-2025',
      words: 7600,
      wordLimit: 7500,
      attachments: 3,
      attachmentLimit: 11,
      overLimit: true,
    };
    // Act and assert
    expect(mappePreviewSchema.safeParse(preview).success).toBe(true);
    expect(mappePreviewSchema.safeParse({ ...preview, words: -1 }).success).toBe(false);
    expect(mappePreviewSchema.safeParse({ ...preview, wordLimit: 0 }).success).toBe(false);
  });
});
