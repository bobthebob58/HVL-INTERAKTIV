/**
 * Property test of the formula guard of the insight CSV: whatever text a field holds, and at whichever of `,`,
 * `;`, tab or line break a spreadsheet program splits the written file, no piece starts with a formula character.
 *
 * Spec: INS-009
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { csvField, guardFormulas } from '../../../src/insight/http/insightCsvFields.js';

/** Texts made mostly of the characters that matter: formula starts, cell breaks, quotes, spaces and a few letters. */
const text = fc
  .array(fc.constantFrom('=', '+', '-', '@', ';', ',', '\t', '\r', '\n', '"', "'", ' ', 'a', 'æ', '1'), {
    maxLength: 40,
  })
  .map((chars) => chars.join(''));
const CELL_BREAK = /[;,\t\r\n]/;
/** What a program that drops leading white space and quotes would read as the start of a cell. */
const cellStart = (piece: string): string => piece.replace(/^[\s"]+/, '').charAt(0);

describe('[INS-009] the formula guard holds for any text', () => {
  it('[INS-009] SECURITY: split at any cell break, no piece of a written field starts with a formula character', () => {
    fc.assert(
      fc.property(text, (value) => {
        // Act
        const pieces = csvField(value).split(CELL_BREAK);
        // Assert
        for (const piece of pieces) expect(['=', '+', '-', '@']).not.toContain(cellStart(piece));
      }),
      { numRuns: 2000 },
    );
  });

  it('[INS-009] the guard only adds apostrophes: without them the text is the one it was given', () => {
    fc.assert(
      fc.property(text, (value) => {
        // Arrange: the positions where the guard may have put an apostrophe
        const guarded = guardFormulas(value);
        let rest = guarded;
        // Act: walk the original through the guarded text, skipping only apostrophes the original lacks
        for (const char of value) {
          while (rest.charAt(0) === "'" && char !== "'") rest = rest.slice(1);
          expect(rest.charAt(0)).toBe(char);
          rest = rest.slice(1);
        }
        // Assert
        expect(rest).toBe('');
        expect(guarded.length - value.length).toBeLessThanOrEqual(value.length + 1);
      }),
      { numRuns: 1000 },
    );
  });
});
