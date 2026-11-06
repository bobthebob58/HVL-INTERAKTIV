/**
 * Unit tests of the insight CSV text (INS-009): RFC 4180 quoting, the guard against spreadsheet formulas, the
 * formative note and the scope at the top, the same suppression as the view, and a file name without personal data.
 *
 * Spec: INS-009, INS-006, PROD-011
 */
import { describe, expect, it } from 'vitest';
import { insightCsvRows } from '../../../src/insight/export/insightCsvRows.js';
import { csvField, insightCsvFilename, insightCsvText } from '../../../src/insight/http/insightCsvText.js';
import { QUESTION_SET } from '../fixtures/insightActivities.js';
import { questionSetRows } from '../fixtures/thirtyLearners.js';
import { reportOf } from '../support/insightFixtureReport.js';
import { cellsIn } from '../support/reportInvariants.js';
import { parseCsv } from './support/csvRecords.js';

const HOSTILE = [
  '=HYPERLINK("https://example.com","klikk")',
  '+47 1',
  '-2+3',
  '@SUM(A1)',
  '  =1+1',
  '\t=1',
  '\r=1',
  '\tklikk',
  'Kva er «celle», sa "ho"?\r\nNy linje',
];

describe('[INS-009] the insight CSV text', () => {
  it('[INS-009] a field with a comma, quote or line break is quoted, and a quote is doubled', () => {
    // Act and assert
    expect(csvField('celle')).toBe('celle');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('sa "ho"')).toBe('"sa ""ho"""');
    expect(csvField('to\r\nlinjer')).toBe('"to\r\nlinjer"');
    expect(csvField('0.4667')).toBe('0.4667');
    expect(csvField('< 5')).toBe('< 5');
    expect(csvField('')).toBe('');
  });

  it('[INS-009] SECURITY: a field a spreadsheet could run as a formula gets a leading apostrophe', () => {
    // Act
    const guarded = HOSTILE.map((text) => parseCsv(`${csvField(text)}\r\n`)[0]?.[0]);
    // Assert
    expect(guarded).toEqual(HOSTILE.map((text, i) => (i === HOSTILE.length - 1 ? text : `'${text}`)));
  });

  it('[INS-009] the file is the view’s rows after the note and the scope, with the same «< k» cells', () => {
    // Arrange
    const report = reportOf(QUESTION_SET, questionSetRows());
    // Act
    const text = insightCsvText(report, 'nn');
    const records = parseCsv(text.slice(1));
    // Assert
    expect(text.startsWith('﻿')).toBe(true);
    expect(text.endsWith('\r\n')).toBe(true);
    expect(records[0]).toEqual(['Del', 'Spørsmål-ID', 'Nr. eller sekund', 'Tekst', 'Mål', 'Verdi']);
    expect(records[1]?.slice(3, 5)).toEqual([
      'H5P-aktivitetar blir retta i nettlesaren. Poenga er meinte for læring undervegs (undervegsvurdering), ' +
        'ikkje for eksamen eller karakterar.',
      'Undervegsvurdering',
    ]);
    expect(records.slice(3, 11).map((record) => [record[0], record[4], record[5]])).toEqual([
      ['Utval', 'Aktivitet (ID)', report.scope.contentId],
      ['Utval', 'Versjon', '1'],
      ['Utval', 'Gjeldande versjon', '1'],
      ['Utval', 'Periode', '7d'],
      ['Utval', 'Frå', report.scope.periodStart],
      ['Utval', 'Til (ikkje med)', report.scope.periodEnd],
      ['Utval', 'Emne', 'portal'],
      ['Utval', 'Minste gruppe (k)', '5'],
    ]);
    const values = records.slice(11);
    expect(values.map((record) => record[5])).toEqual(insightCsvRows(report).map((row) => row.value));
    expect(values.filter((record) => record[5] === '< 5')).toHaveLength(
      cellsIn(report).filter((cell) => cell.suppressed).length,
    );
    expect(records.every((record) => record.length === 6)).toBe(true);
  });

  it('[INS-009] SECURITY: an author’s or a learner’s text survives the quoting, guarded against formulas', () => {
    // Arrange
    const report = reportOf(QUESTION_SET, questionSetRows());
    const items = HOSTILE.map((questionText, i) => ({
      ...report.items[0]!,
      item: `item-${i}`,
      questionText,
    }));
    // Act
    const records = parseCsv(insightCsvText({ ...report, items, misconceptions: [] }, 'nn').slice(1));
    // Assert
    const labels = new Set(
      records.filter((record) => record[1]?.startsWith('item-')).map((record) => record[3]),
    );
    expect([...labels]).toEqual(HOSTILE.map((text, i) => (i === HOSTILE.length - 1 ? text : `'${text}`)));
  });

  it('[INS-001] the completion rate names its base: the course’s NRPS count or those who started', () => {
    // Arrange
    const rateOf = (courseLearners?: number) =>
      parseCsv(insightCsvText(reportOf(QUESTION_SET, questionSetRows(), { courseLearners }), 'nn').slice(1))
        .filter((record) => record[0] === 'Deltaking')
        .map((record) => record[4])
        .find((measure) => measure?.startsWith('Fullføringsgrad'));
    // Act and assert
    expect(rateOf()).toBe('Fullføringsgrad (del av dei som starta)');
    expect(rateOf(40)).toBe('Fullføringsgrad (del av studentane i emnet)');
  });

  it('[INS-009] PRIVACY: the file name holds a fixed word, the period and the date only, in the person’s language', () => {
    // Arrange
    const { scope } = reportOf(QUESTION_SET, []);
    // Act and assert
    expect(insightCsvFilename(scope, 'nn')).toBe('innsikt-7d-2026-11-04.csv');
    expect(insightCsvFilename({ ...scope, period: 'semester' }, 'en')).toBe(
      'insight-semester-2026-11-04.csv',
    );
    expect(insightCsvFilename(scope, 'nb')).toMatch(/^[a-z0-9-]+\.csv$/);
  });

  it('[PROD-012] the header, sections and measures are in Bokmål and English too', () => {
    // Arrange
    const report = reportOf(QUESTION_SET, questionSetRows());
    // Act
    const nb = parseCsv(insightCsvText(report, 'nb').slice(1));
    const en = parseCsv(insightCsvText(report, 'en').slice(1));
    // Assert
    expect(nb[0]).toEqual(['Del', 'Spørsmåls-ID', 'Nr. eller sekund', 'Tekst', 'Mål', 'Verdi']);
    expect(en[0]).toEqual(['Section', 'Question ID', 'No. or second', 'Text', 'Measure', 'Value']);
    expect(en[11]?.slice(0, 1).concat(en[11]?.[4] ?? '')).toEqual(['Participation', 'Started']);
    expect(en.flatMap((record) => record[4]).filter((measure) => /^[a-z]+[A-Z]/.test(measure ?? ''))).toEqual(
      [],
    );
  });
});
