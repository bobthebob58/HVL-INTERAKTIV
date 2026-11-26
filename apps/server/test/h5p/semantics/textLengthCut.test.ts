/**
 * Unit tests of the cut of a cleaned text to its field's `maxLength` (D-140): a text within the length is left
 * alone, a longer one is cut as plain text, and the cut leaves no half character reference and no half character.
 *
 * Spec: SEC-008
 */
import { describe, expect, it } from 'vitest';
import { plainText } from '../../../src/h5p/semantics/lumiTextSanitizer.js';
import { cutToLength, wholeStart } from '../../../src/h5p/semantics/textLengthCut.js';

describe('[SEC-008] the cut of a text to its field length', () => {
  it('[SEC-008] a text within the length, or a field without a positive length, is returned as it is', () => {
    const rich = '<strong>Les</strong> meir';
    expect(cutToLength(rich, rich.length, plainText)).toBe(rich);
    for (const none of [undefined, 0, -3, 'lang', Number.NaN, null]) {
      expect(cutToLength(rich, none, plainText)).toBe(rich);
    }
  });

  it('[SEC-008] a cut inside a character reference takes the whole reference away', () => {
    // Arrange: "Ola & Kari" as a cleaner writes it; position 7 is inside `&amp;`
    const clean = 'Ola &amp; Kari';
    // Act + Assert
    expect(wholeStart(clean, 7)).toBe('Ola ');
    expect(wholeStart(clean, 9)).toBe('Ola &amp;');
    expect(wholeStart('2 &lt; 3', 4)).toBe('2 ');
  });

  it('[SEC-008] a cut inside a character outside the basic plane takes the whole character away', () => {
    expect(wholeStart('ab😀cd', 3)).toBe('ab');
    expect(wholeStart('ab😀cd', 4)).toBe('ab😀');
  });

  it('[SEC-008] a text with markup that is too long keeps its words, cut whole, and none of its markup', () => {
    // Arrange: the fixed cut Lumi makes would end inside the tag
    const clean = '<a href="https://hvl.no/">Les meir &amp; lær</a>';
    expect(clean.substring(0, 20)).toBe('<a href="https://hvl');
    // Act
    const cut = cutToLength(clean, 12, plainText);
    // Assert: "Les meir &amp; lær" cut at 12 would end in `&am`
    expect(cut).toBe('Les meir ');
    expect(cutToLength(clean, '14', plainText)).toBe('Les meir &amp;');
  });

  it('[SEC-008] at every length the result is within it, ends whole and is not changed by cleaning it again', () => {
    const clean = plainText('Ola & Kari < 3 😀 "sitat" &quot;meir&quot; > slutt &');
    for (let max = 1; max <= clean.length + 1; max += 1) {
      const cut = cutToLength(clean, max, plainText);
      expect(cut.length).toBeLessThanOrEqual(max);
      expect(plainText(cut)).toBe(cut);
      expect(cut.lastIndexOf('&') === -1 || cut.includes(';', cut.lastIndexOf('&'))).toBe(true);
      expect(JSON.parse(JSON.stringify(cut))).toBe(cut);
      expect(cut.isWellFormed()).toBe(true);
    }
  });
});
