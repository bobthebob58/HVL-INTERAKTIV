/**
 * Unit tests of the insight CSV text (INS-009): a file that follows its language (`;` and a decimal comma in nn and
 * nb, `,` and a point in en), every field quoted and guarded against spreadsheet formulas, the formative note and
 * the scope at the top, the same suppression as the view, and a file name without personal data.
 *
 * Spec: INS-009, INS-006, PROD-011, PROD-012
 */
import { describe, expect, it } from 'vitest';
import { insightCsvRows } from '../../../src/insight/export/insightCsvRows.js';
import { insightCsvFilename, insightCsvText } from '../../../src/insight/http/insightCsvText.js';
import { QUESTION_SET } from '../fixtures/insightActivities.js';
import { questionSetRows } from '../fixtures/thirtyLearners.js';
import { reportOf } from '../support/insightFixtureReport.js';
import { cellsIn } from '../support/reportInvariants.js';
import { parseCsv } from './support/csvRecords.js';

/** Texts a spreadsheet could read as a formula, each with the text the file must hold instead. */
const HOSTILE: readonly (readonly [text: string, written: string])[] = [
  ['=HYPERLINK("https://example.com","klikk")', `'=HYPERLINK("https://example.com","klikk")`],
  ['+47 1', "'+47 1"],
  ['-2+3', "'-2+3"],
  ['@SUM(A1)', "'@SUM(A1)"],
  ['  =1+1', "  '=1+1"],
  ['svar; =1+1', "svar; '=1+1"],
  ['ja, -5 grader', "ja, '-5 grader"],
  ['Kva er «celle», sa "ho"?\r\nNy linje', 'Kva er «celle», sa "ho"?\r\nNy linje'],
];
/** One line of a file whose fields are all quoted, for the given separator. */
const quotedLine = (separator: string) => new RegExp(`^"(?:[^"]|"")*"(?:${separator}"(?:[^"]|"")*"){5}$`);

describe('[INS-009] the insight CSV text', () => {
  it('[INS-009] the file follows its language: `;` and decimal commas in nn and nb, `,` and points in en, every field quoted', () => {
    // Arrange
    const report = reportOf(QUESTION_SET, questionSetRows());
    const shares = (text: string, separator: ',' | ';') =>
      parseCsv(text.slice(1), separator)
        .map((record) => record[5] ?? '')
        .filter((value) => /^\d+[.,]\d+$/.test(value));
    // Act
    const [nn, nb, en] = (['nn', 'nb', 'en'] as const).map((locale) => insightCsvText(report, locale));
    // Assert: Norwegian spreadsheet programs split at `;` and read `1.5` as a date
    for (const text of [nn, nb]) {
      expect(
        text!
          .slice(1)
          .split('\r\n')
          .slice(0, -1)
          .every((line) => quotedLine(';').test(line)),
      ).toBe(true);
      expect(shares(text!, ';').length).toBeGreaterThan(0);
      expect(shares(text!, ';').every((value) => /^\d+,\d+$/.test(value))).toBe(true);
    }
    expect(
      en!
        .slice(1)
        .split('\r\n')
        .slice(0, -1)
        .every((line) => quotedLine(',').test(line)),
    ).toBe(true);
    expect(shares(en!, ',').every((value) => /^\d+\.\d+$/.test(value))).toBe(true);
    expect(shares(en!, ',').map((value) => value.replace('.', ','))).toEqual(shares(nn!, ';'));
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
    expect(values.map((record) => record[5]?.replace(',', '.'))).toEqual(
      insightCsvRows(report).map((row) => row.value),
    );
    expect(values.filter((record) => record[5] === '< 5')).toHaveLength(
      cellsIn(report).filter((cell) => cell.suppressed).length,
    );
    expect(records.every((record) => record.length === 6)).toBe(true);
  });

  it('[INS-009] SECURITY: an author’s or a learner’s text survives the quoting, guarded against formulas', () => {
    // Arrange
    const report = reportOf(QUESTION_SET, questionSetRows());
    const items = HOSTILE.map(([questionText], i) => ({
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
    expect([...labels]).toEqual(HOSTILE.map(([, written]) => written));
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
    const en = parseCsv(insightCsvText(report, 'en').slice(1), ',');
    // Assert
    expect(nb[0]).toEqual(['Del', 'Spørsmåls-ID', 'Nr. eller sekund', 'Tekst', 'Mål', 'Verdi']);
    expect(en[0]).toEqual(['Section', 'Question ID', 'No. or second', 'Text', 'Measure', 'Value']);
    expect(en[11]?.slice(0, 1).concat(en[11]?.[4] ?? '')).toEqual(['Participation', 'Started']);
    expect(en.flatMap((record) => record[4]).filter((measure) => /^[a-z]+[A-Z]/.test(measure ?? ''))).toEqual(
      [],
    );
  });
});
