/**
 * Tests for reading H5P rich text with htmlparser2 (richText).
 *
 * Spec: UD-020, UD-021
 */
import { describe, expect, it } from 'vitest';
import { countWords, parseRichText, plainTextOf } from '../../src/validation/richText.js';

describe('[UD-020] richText', () => {
  it('[UD-020] reads headings, links and tables in document order', () => {
    // Arrange
    const html =
      '<h2>Fasar</h2><p><a id="top"></a>Sjå <a href="https://www.hvl.no/">emneplanen</a>.</p><h3>Før</h3>' +
      '<table><tr><th>Fase</th></tr></table><table><tr><td>Før</td></tr></table>';
    // Act
    const rich = parseRichText(html);
    // Assert
    expect(rich.headings).toEqual([2, 3]);
    expect(rich.links).toEqual([{ text: 'emneplanen', href: 'https://www.hvl.no/' }]);
    expect(rich.tables).toEqual([{ hasHeaderCell: true }, { hasHeaderCell: false }]);
  });

  it('[UD-020] separates block elements, decodes entities and collapses whitespace', () => {
    expect(
      plainTextOf('<p>Før&nbsp;samlinga</p><p>Under &amp; etter</p>\n<ul><li>a</li><li>b</li></ul>'),
    ).toBe('Før samlinga Under & etter a b');
  });

  it('[UD-020] reads plain text without tags the same way', () => {
    expect(plainTextOf('  Summary &amp; submit ')).toBe('Summary & submit');
  });

  it('[UD-020] never throws on malformed HTML and reads what it can', () => {
    const rich = parseRichText('<p>Open <a href="x">link <table><tr><td>cell');
    expect(rich.text).toBe('Open link cell');
    expect(rich.tables).toEqual([{ hasHeaderCell: false }]);
  });

  it.each([
    ['Tre fasar i samlingsbasert undervisning.', 5],
    ['— 3 – fasar', 2],
    ['', 0],
  ])('[PED-020] counts the words of «%s» as %d', (text, words) => {
    expect(countWords(text)).toBe(words);
  });
});
