/**
 * Tests for the pedagogisk mappe's PDF HTML (D-096 probe P4 amendment): the document language and an escaped title,
 * table header cells with `scope="col"` and each body row's first cell a row header, no image even when Markdown
 * asks for one, raw HTML kept as text, and a style from the design tokens only.
 *
 * Spec: MAPPE-004
 */
import { describe, expect, it } from 'vitest';
import { mappeHtmlDocument } from '../../../src/learningDesign/mappe/pdf/mappeHtml.js';

const TABLE =
  '| Kriterium | Kvar | Vedlegg |\n| --- | --- | --- |\n| **1.1** Tekst | Del 1 | A |\n| 2.3 | Del 2 | B |\n';

describe('[MAPPE-004] the portfolio’s HTML', () => {
  it('[MAPPE-004] has the language and an escaped title, and gives every table header its scope', () => {
    // Act
    const html = mappeHtmlDocument(`# Mappe\n\n${TABLE}`, { lang: 'nb', title: 'Mappe </title><script>' });
    // Assert
    expect(html).toMatch(/^<!DOCTYPE html>\n<html lang="nb">/);
    expect(html).toContain('<title>Mappe &lt;/title&gt;&lt;script&gt;</title>');
    expect(html.match(/<th scope="col">/g)).toHaveLength(3);
    expect(html).toContain('<th scope="row"><strong>1.1</strong> Tekst</th>');
    expect(html).toContain('<th scope="row">2.3</th>');
    expect(html.match(/<td>/g)).toHaveLength(4);
  });

  it('[MAPPE-004] holds no image and no HTML of its own, whatever the Markdown says', () => {
    // Act
    const html = mappeHtmlDocument('![logo](https://evil.example/x.png)\n\n<img src=x onerror=alert(1)>\n', {
      lang: 'nn',
      title: 'T',
    });
    // Assert
    expect(html).not.toMatch(/<img|<script/);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('[MAPPE-004] styles the text with the HVL tokens: body font, line height 1.5, left-aligned', () => {
    // Act
    const html = mappeHtmlDocument('Tekst.\n', { lang: 'nn', title: 'T' });
    // Assert
    expect(html).toContain('font-family: Georgia, "Times New Roman", serif; line-height: 1.5;');
    expect(html).toContain('text-align: left;');
    expect(html).not.toMatch(/justify|uppercase/);
  });
});
