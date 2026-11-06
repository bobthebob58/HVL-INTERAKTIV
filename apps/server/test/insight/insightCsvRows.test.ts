/**
 * Unit tests of the CSV rows of an insight report (INS-009): the same values as the report, «< k» for a suppressed
 * cell, an empty value for one that is not available, and stable measure keys for the API to translate.
 *
 * Spec: INS-009, INS-006
 */
import { describe, expect, it } from 'vitest';
import { csvValue, insightCsvRows } from '../../src/insight/export/insightCsvRows.js';
import { INTERACTIVE_VIDEO, IV3, Q1, Q3, QUESTION_SET } from './fixtures/insightActivities.js';
import { questionSetRows, videoRows } from './fixtures/thirtyLearners.js';
import { reportOf } from './support/insightFixtureReport.js';

const rows = insightCsvRows(reportOf(QUESTION_SET, questionSetRows(), { courseLearners: 40 }));
const valueOf = (section: string, measure: string, item = '', part = '') =>
  rows.find(
    (row) => row.section === section && row.measure === measure && row.item === item && row.part === part,
  )?.value;

describe('[INS-009] CSV rows', () => {
  it('[INS-009] writes participation with the same numbers as the report', () => {
    expect(
      rows.filter(({ section }) => section === 'participation').map(({ measure, value }) => [measure, value]),
    ).toEqual([
      ['started', '28'],
      ['completed', '23'],
      ['completionRate', '0.5750'],
      ['courseLearners', '40'],
      ['medianMinutesOnTask', '11'],
      ['medianAttempts', '1'],
    ]);
  });

  it('[INS-009] writes «< k» for a suppressed cell and keeps the activity’s own texts as labels', () => {
    expect(valueOf('choices', 'wrongOption', Q1, '3')).toBe('< 5');
    expect(
      rows.find(({ item, part, measure }) => item === Q1 && part === '3' && measure === 'wrongOption')?.label,
    ).toBe('Gi karakter');
    expect(valueOf('gaps', 'otherWrong', Q3, '2')).toBe('< 5');
    expect(valueOf('gaps', 'wrongAnswer', Q3, '2')).toBe('8');
    expect(valueOf('items', 'firstCorrect', Q1)).toBe('0.4615');
  });

  it('[INS-009] leaves a value that is not available empty and writes the video interactions', () => {
    const video = insightCsvRows(reportOf(INTERACTIVE_VIDEO, videoRows()));
    expect(video.find(({ measure }) => measure === 'completed')?.value).toBe('');
    expect(
      video.find(({ section, item, measure }) => section === 'video' && item === IV3 && measure === 'share'),
    ).toMatchObject({
      part: '450',
      label: 'Til slutt',
      value: '< 5',
    });
  });

  it('[INS-006] never writes a hidden value in any form', () => {
    expect(csvValue({ suppressed: true }, 5, 4)).toBe('< 5');
    expect(csvValue(null, 5)).toBe('');
    expect(csvValue({ suppressed: false, value: 0.5 }, 5, 4)).toBe('0.5000');
    expect(JSON.stringify(rows)).not.toContain('etterarbeid');
  });
});
