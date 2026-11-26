/**
 * Tests that the count of tags a text has open at once is the HTML parser's own count, and that a text past the
 * limit is recognised in time that grows in step with its length (D-126).
 *
 * Spec: SEC-005, PROD-012
 */
import { describe, expect, it } from 'vitest';
import { opensMoreTagsThan } from '../../../src/h5p/semantics/markupDepth.js';

const nested = (depth: number): string => `${'<span>'.repeat(depth)}tekst${'</span>'.repeat(depth)}`;

describe('[SEC-005] the tags a text has open at once', () => {
  it('[SEC-005] a text as the editor writes it is far inside the limit', () => {
    // Arrange
    const text =
      '<h2>Celler</h2><p>Ei <strong>celle</strong> er <em>lita</em>.</p><ul><li>Kjerne</li><li>Membran</li></ul>' +
      '<table><tbody><tr><th>Del</th><td><a href="https://hvl.no">Les meir</a></td></tr></tbody></table>';
    // Act
    const passed = opensMoreTagsThan(text, 100);
    // Assert
    expect(passed).toBe(false);
  });

  it('[SEC-005] exactly the limit open at once is inside it, one more is past it', () => {
    // Arrange
    const atLimit = nested(100);
    const pastLimit = nested(101);
    // Act
    const results = [opensMoreTagsThan(atLimit, 100), opensMoreTagsThan(pastLimit, 100)];
    // Assert
    expect(results).toEqual([false, true]);
  });

  it('[SEC-005] tags the parser closes by itself, and tags that never stay open, do not add up', () => {
    // Arrange: a thousand paragraphs without an end tag, a thousand list items, a thousand line breaks
    const paragraphs = '<p>avsnitt'.repeat(1000);
    const items = `<ul>${'<li>punkt'.repeat(1000)}</ul>`;
    const breaks = '<br>linje<img src="a.png" alt="">'.repeat(1000);
    // Act
    const results = [paragraphs, items, breaks].map((text) => opensMoreTagsThan(text, 5));
    // Assert
    expect(results).toEqual([false, false, false]);
  });

  it('[SEC-005] what only looks like a tag is not counted: a comment, an attribute value, plain text', () => {
    // Arrange
    const comment = `<p><!-- ${'<span>'.repeat(50)} --></p>`;
    const attribute = `<a href="#" title="${'<span>'.repeat(50)}">lenke</a>`;
    const plain = 'a < b og b > c, '.repeat(50);
    // Act
    const results = [comment, attribute, plain].map((text) => opensMoreTagsThan(text, 5));
    // Assert
    expect(results).toEqual([false, false, false]);
  });

  it('[SEC-005] tags that are closed in another order than they were opened count as the parser keeps them', () => {
    // Arrange: each round leaves one <em> open, because </span> closes nothing that is open
    const rounds = '<em>tekst</span>'.repeat(20);
    // Act
    const results = [opensMoreTagsThan(rounds, 20), opensMoreTagsThan(rounds, 19)];
    // Assert
    expect(results).toEqual([false, true]);
  });

  it('[SEC-005] a long text of tags that are never closed is recognised in time that follows its length', () => {
    // Arrange: 200 000 characters, the longest text an activity may hold
    const text = '<span>'.repeat(200_000 / 6);
    // Act
    const started = performance.now();
    const passed = opensMoreTagsThan(text, 100);
    const elapsed = performance.now() - started;
    // Assert
    expect(passed).toBe(true);
    expect(elapsed).toBeLessThan(250);
  });

  it('[SEC-005] a long text inside the limit is read in time that follows its length', () => {
    // Arrange: 200 000 characters with 100 tags open throughout
    const pair = '</span><span>';
    const head = '<span>'.repeat(100);
    const text = head + pair.repeat(Math.floor((200_000 - head.length) / pair.length));
    // Act
    const started = performance.now();
    const passed = opensMoreTagsThan(text, 100);
    const elapsed = performance.now() - started;
    // Assert
    expect(passed).toBe(false);
    expect(elapsed).toBeLessThan(500);
  });
});
