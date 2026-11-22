/**
 * insightCsvFields — how one field of the insight CSV is written: the separator and decimal mark of the file's
 * language, quotes around every field, and a guard wherever a spreadsheet could start a formula.
 *
 * Why: the file is opened in a spreadsheet program and holds text that authors and learners wrote (INS-009). A
 *      Norwegian spreadsheet splits columns at `;` and reads `1.5` as a date, so a comma-separated file was left
 *      to its guessing: a text with a `;` could be cut in two, and the piece after the cut started a cell of its
 *      own, where a leading `=` is a formula. The file now follows its language, and no piece of a field can
 *      start a formula however a program splits it (D-136).
 * Spec: INS-009, PROD-012
 * Invariants:
 *   - nn and nb: `;` between fields and a decimal comma; en: `,` and a decimal point.
 *   - Every field is quoted and its quotes are doubled (RFC 4180), also an empty one.
 *   - SECURITY: a formula character (`=`, `+`, `-`, `@`) gets a `'` before it when it is the first character of
 *     the field or follows a `;`, `,`, tab or line break, with only white space or quotes in between: the places
 *     where a program that splits at another character than the writer's would start a cell. A field that starts
 *     with a tab or a carriage return gets a leading `'` too (OWASP, "CSV Injection").
 *   - One pass over the text, a character at a time: the cost is linear in its length.
 * Collaborators: ./insightCsvText.ts (writes the file with these fields).
 * Tests: apps/server/test/insight/http/insightCsvFields.test.ts,
 *   apps/server/test/insight/http/insightCsvFields.property.test.ts
 */
import type { Locale } from '../../i18n/translate.js';

/** How the spreadsheet programs of a language read a file. */
export interface CsvDialect {
  /** The character between two fields. */
  readonly separator: ',' | ';';
  /** The decimal mark of a number. */
  readonly decimalMark: '.' | ',';
}

/** The dialect of each language: Norwegian programs split at `;` and read a decimal comma. */
export const CSV_DIALECTS: Readonly<Record<Locale, CsvDialect>> = {
  nn: { separator: ';', decimalMark: ',' },
  nb: { separator: ';', decimalMark: ',' },
  en: { separator: ',', decimalMark: '.' },
};

const FORMULA_STARTS: ReadonlySet<string> = new Set(['=', '+', '-', '@']);
/** Characters at which some spreadsheet program may end one cell and start the next. */
const CELL_BREAKS: ReadonlySet<string> = new Set([';', ',', '\t', '\r', '\n']);
const SPACE_OR_QUOTE = /[\s"]/;

/**
 * Guards a text against being read as a formula, wherever a cell could start in it.
 * @param text - The field's text.
 * @returns The text with a `'` before every formula character a cell could start with.
 * @spec INS-009
 */
export function guardFormulas(text: string): string {
  // SECURITY: some programs drop a leading tab or carriage return and then read what follows as the cell.
  const parts: string[] = text.startsWith('\t') || text.startsWith('\r') ? ["'"] : [];
  let cellMayStart = true;
  for (const char of text) {
    if (cellMayStart && FORMULA_STARTS.has(char)) parts.push("'");
    if (CELL_BREAKS.has(char)) cellMayStart = true;
    // WHY: white space and quotes before the formula character do not stop a program from reading it as one.
    else if (!SPACE_OR_QUOTE.test(char)) cellMayStart = false;
    parts.push(char);
  }
  return parts.join('');
}

/**
 * One CSV field: guarded against formulas and quoted.
 * @param text - The field's text.
 * @returns The field as it is written between separators.
 * @spec INS-009
 */
export function csvField(text: string): string {
  return `"${guardFormulas(text).replaceAll('"', '""')}"`;
}

/**
 * A value in the number form of a dialect.
 * @param value - A row's value: a number written with a point, `< k`, or ''.
 * @param dialect - The file's dialect.
 * @returns The value with the dialect's decimal mark; anything that is not a decimal number as it is.
 */
export function csvNumber(value: string, dialect: CsvDialect): string {
  return /^\d+\.\d+$/.test(value) ? value.replace('.', dialect.decimalMark) : value;
}
