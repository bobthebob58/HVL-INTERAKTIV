/**
 * newlineSplitter.test — the line cutter the backup tool counts a dump's rows with (D-132): lines end at the
 * newline byte and nowhere else, whatever a value holds and however the bytes arrive.
 * Spec: NFR-002
 */
import { describe, expect, it } from 'vitest';
import { newlineSplitter } from '../toolProcess.mjs';

/** The lines the splitter hands over for the given chunks. */
const linesOf = (chunks) => {
  const lines = [];
  const splitter = newlineSplitter((line) => lines.push(line));
  for (const chunk of chunks) splitter.write(Buffer.from(chunk));
  splitter.end();
  return lines;
};

describe('the newline splitter (NFR-002)', () => {
  it('[NFR-002] cuts at every newline byte and keeps empty lines', () => {
    // Act
    const lines = linesOf(['a\tb\n\nc\n']);
    // Assert
    expect(lines).toEqual(['a\tb', '', 'c']);
  });

  it('[NFR-002] leaves U+2028, U+2029, U+0085 and a carriage return inside their line', () => {
    // Arrange: one row of a dump whose value holds each of them
    const row = 'id-1\tfør etter slutt\u0085og\rvidare';
    // Act
    const lines = linesOf([`${row}\n\\.\n`]);
    // Assert
    expect(lines).toEqual([row, '\\.']);
  });

  it('[NFR-002] joins a line, and a character, that arrive in several chunks', () => {
    // Arrange: «blåbær» cut in the middle of the two bytes of «å», and the newline in a chunk of its own
    const bytes = Buffer.from('blåbær\nneste');
    const cut = bytes.indexOf(0xc3) + 1;
    // Act
    const lines = linesOf([bytes.subarray(0, cut), bytes.subarray(cut, cut + 3), bytes.subarray(cut + 3)]);
    // Assert
    expect(lines).toEqual(['blåbær', 'neste']);
  });

  it('[NFR-002] hands over a last line without a newline, and nothing for an empty stream', () => {
    // Act
    const answers = [linesOf(['a\nb']), linesOf(['a\n']), linesOf([]), linesOf([''])];
    // Assert
    expect(answers).toEqual([['a', 'b'], ['a'], [], []]);
  });
});
