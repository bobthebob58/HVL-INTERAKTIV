/**
 * csvRecords — a small RFC 4180 reader for the insight CSV tests: splits CSV text into records and fields, undoing
 * the quoting, so a test checks what a spreadsheet would read rather than the raw text.
 *
 * Why: INS-009's tests check that every value and label survives the quoting (commas, quotes, line breaks) and that
 *      the formula guard is the only change; reading the file the way a spreadsheet does makes that a plain
 *      comparison.
 * Spec: INS-009
 * Invariants:
 *   - Records end with CRLF; a quoted field may hold commas, doubled quotes and line breaks. The final CRLF ends the
 *     last record and does not start an empty one.
 * Tests: used by ../insightCsvText.test.ts, ../insightRoutes.int.test.ts and
 *   ../insightSuppressionApi.property.test.ts.
 */

/**
 * Reads CSV text (without its byte-order mark) into records.
 * @param text - The file's text.
 * @returns One array of fields per record.
 * @throws Error when a quoted field is not closed.
 */
export function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\r' && text[i + 1] === '\n') {
      records.push([...record, field]);
      record = [];
      field = '';
      i += 1;
    } else field += char;
  }
  if (quoted) throw new Error('csvRecords: a quoted field is not closed');
  if (field !== '' || record.length > 0) records.push([...record, field]);
  return records;
}
