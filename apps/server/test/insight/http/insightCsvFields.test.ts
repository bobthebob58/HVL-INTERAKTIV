/**
 * Unit tests of one field of the insight CSV: quotes around every field, a guard wherever a spreadsheet could
 * start a formula in it, and numbers in the form of the file's language.
 *
 * Spec: INS-009, PROD-012
 */
import { describe, expect, it } from 'vitest';
import {
  CSV_DIALECTS,
  csvField,
  csvNumber,
  guardFormulas,
} from '../../../src/insight/http/insightCsvFields.js';

describe('[INS-009] one field of the insight CSV', () => {
  it('[INS-009] every field is quoted, also an empty one and a number, and a quote is doubled', () => {
    expect(csvField('celle')).toBe('"celle"');
    expect(csvField('a,b;c')).toBe('"a,b;c"');
    expect(csvField('sa "ho"')).toBe('"sa ""ho"""');
    expect(csvField('to\r\nlinjer')).toBe('"to\r\nlinjer"');
    expect(csvField('0,4667')).toBe('"0,4667"');
    expect(csvField('< 5')).toBe('"< 5"');
    expect(csvField('')).toBe('""');
  });

  it('[INS-009] SECURITY: a formula character at the start of a text is guarded, also after white space or quotes', () => {
    expect(guardFormulas('=1+1')).toBe("'=1+1");
    expect(guardFormulas('+47 1')).toBe("'+47 1");
    expect(guardFormulas('-2+3')).toBe("'-2+3");
    expect(guardFormulas('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(guardFormulas('  =1+1')).toBe("  '=1+1");
    expect(guardFormulas('"=1+1"')).toBe(`"'=1+1"`);
    // OWASP: a program may drop a leading tab or carriage return and read what follows as the cell
    expect(guardFormulas('\t=1')).toBe("'\t'=1");
    expect(guardFormulas('\r=1')).toBe("'\r'=1");
    expect(guardFormulas('\tklikk')).toBe("'\tklikk");
  });

  it('[INS-009] SECURITY: a formula character after `;`, `,`, a tab or a line break is guarded too', () => {
    // Arrange: a program that splits the file at another character than the writer's starts a cell at each
    const cases: readonly (readonly [string, string])[] = [
      ['svar;=1+1', "svar;'=1+1"],
      ['svar; =cmd', "svar; '=cmd"],
      ['ja, -5 grader', "ja, '-5 grader"],
      ['x\t@SUM(A1)', "x\t'@SUM(A1)"],
      ['linje\r\n+47', "linje\r\n'+47"],
      ['a;"=1', `a;"'=1`],
      ['=;=', "'=;'="],
    ];
    // Act and assert
    for (const [text, guarded] of cases) expect(guardFormulas(text), JSON.stringify(text)).toBe(guarded);
  });

  it('[INS-009] ordinary text is left as it is', () => {
    for (const text of ['e-post: kari@hvl.no', '1 + 1 = 2', 'ikkje -5, men 5', 'a - b', '< 5', '']) {
      expect(guardFormulas(text), text).toBe(text);
    }
  });

  it('[PROD-012] a decimal number takes the decimal mark of the file’s language; anything else stays', () => {
    // Act and assert
    expect(csvNumber('0.4667', CSV_DIALECTS.nn)).toBe('0,4667');
    expect(csvNumber('1.5', CSV_DIALECTS.nb)).toBe('1,5');
    expect(csvNumber('0.4667', CSV_DIALECTS.en)).toBe('0.4667');
    for (const value of ['12', '< 5', '', '2026-11-04T10:00:00.000Z', 'v1.2']) {
      expect(csvNumber(value, CSV_DIALECTS.nn), value).toBe(value);
    }
    expect([CSV_DIALECTS.nn.separator, CSV_DIALECTS.nb.separator, CSV_DIALECTS.en.separator]).toEqual([
      ';',
      ';',
      ',',
    ]);
  });
});
