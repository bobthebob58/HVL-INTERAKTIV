/**
 * Tests for the pedagogisk mappe template loader's tags (D-094 and its probe P5 amendment): comments and front matter
 * are removed; only allowlisted values, lists and comments pass; triple braces, `{{&…}}`, partials, delimiter changes,
 * raw HTML and images are refused; a value inside backticks, in a link address, after a backslash or at the start of
 * a line after a table line is refused. Every problem names the file and the line.
 *
 * Spec: MAPPE-002
 */
import { afterAll, describe, expect, it } from 'vitest';
import {
  editedMappeFixture,
  loadFixtureMappe,
  removeMappeFixtureCopies,
} from '../../support/mappeFixture.js';
import { MIN, onLine1, templateProblems } from './mappeTemplateBench.js';

afterAll(removeMappeFixtureCopies);

describe('[MAPPE-002] the mappe template loader', () => {
  it('[MAPPE-002] removes comments and front matter, so names inside them are never checked', () => {
    // Arrange
    const template = `---\nordgrense: 9000\n---\n<!-- {{ikkje_kjent}} over\n to linjer -->\n${MIN}`;
    // Act
    const loaded = loadFixtureMappe(
      editedMappeFixture({
        'mappe/template.nn.md': template,
        'mappe/template.nb.md': MIN,
        'mappe/template.en.md': MIN,
      }),
    );
    // Assert
    expect(loaded.ok ? Object.keys(loaded.value.portfolio?.templates ?? {}) : loaded.problems).toEqual([
      'nn',
      'nb',
      'en',
    ]);
  });

  it.each([
    [
      '{{ukjent}}',
      '{{ukjent}} is not a name the portfolio knows (see content/mappe/README.md for the names)',
    ],
    [
      '{{{forfattar}}}',
      'triple braces and {{&…}} are not allowed: every value is shown as plain text, so write {{name}}',
    ],
    [
      '{{&forfattar}}',
      'triple braces and {{&…}} are not allowed: every value is shown as plain text, so write {{name}}',
    ],
    ['{{> del}}', 'partials ({{>…}}) are not allowed'],
    ['{{=<% %>=}}', 'changing the tag delimiters ({{=… =}}) is not allowed'],
    ['{{aktivitetar}}', '{{aktivitetar}} is a list: write {{#aktivitetar}} … {{/aktivitetar}}'],
    [
      '{{#forfattar}}x{{/forfattar}}',
      '{{#forfattar}} is a value, not a list: a section opens one of the lists',
    ],
    [
      '{{#uu_merknader}}x{{/uu_merknader}}',
      '{{#uu_merknader}} cannot stand here: it belongs inside {{#aktivitetar}} … {{/aktivitetar}}',
    ],
    ['{{tittel}}', '{{tittel}} cannot stand here: it belongs inside {{#aktivitetar}} … {{/aktivitetar}}'],
    [
      '{{#aktivitetar}}{{#emneoversikt}}x{{/emneoversikt}}{{/aktivitetar}}',
      '{{#emneoversikt}} cannot stand here: it belongs outside every section',
    ],
    ['Tekst {{del1_start}}', 'the marker {{del1_start}} must stand alone on its own line, outside sections'],
    [
      '`kode {{dato}}`',
      'a value cannot stand inside backticks or a code block, where its text could end the code',
    ],
    [
      '[lenke](https://hvl.no/{{dato}})',
      'a value cannot stand in a link address; put it in the link text or after the link',
    ],
    ['\\{{dato}}', 'a value cannot follow a backslash, which would escape its first character'],
    [
      'Sjå <{{dato}}>',
      'a value cannot follow <, where its text could become HTML or a link; write the address as plain text',
    ],
    [
      '[Opne aktiviteten]{{dato}}',
      'a value cannot follow ] straight away, where its text could turn the brackets into a link; add a space',
    ],
    [
      '<b>{{dato}}</b>',
      'raw HTML is not allowed in the template; write &lt; for a literal <, and [text](https://…) for a link',
    ],
    ['![bilete](x.png)', 'images are not allowed in the template'],
    ['{{dato', 'a tag that opens with {{ is not closed'],
    ['{{/aktivitetar}}', '{{/aktivitetar}} closes a section that is not open'],
  ])('[MAPPE-002] refuses %j on its line', (bad, message) => {
    expect(onLine1(bad)).toContainEqual({ file: 'template.nn.md', line: 1, message });
  });

  it('[MAPPE-002] refuses a value at the start of a line right after a table line, and a value in a fenced block', () => {
    // Act
    const table = templateProblems(`| A |\n{{dato}}\n${MIN}`);
    const fenced = templateProblems(`\`\`\`\n{{dato}}\n\`\`\`\n${MIN}`);
    // Assert
    expect(table).toEqual([
      expect.objectContaining({
        line: 2,
        message: expect.stringMatching(/^a value cannot start a line right after a table line/),
      }),
    ]);
    expect(fenced).toEqual([
      expect.objectContaining({
        line: 2,
        message: expect.stringMatching(/inside backticks or a code block/),
      }),
    ]);
  });

  it('[MAPPE-002] allows values in a list, inside a list item’s nested list, in table cells and in link text', () => {
    // Arrange
    const good = [
      '| {{dato}} | {{k}} |',
      '|---|---|',
      '{{#aktivitetar}}',
      '- [{{tittel}}](https://www.hvl.no/) {{k}}',
      '{{#uu_merknader}}',
      '  - {{alvor}}: {{melding}}',
      '{{/uu_merknader}}',
      '{{/aktivitetar}}',
      MIN,
    ].join('\n');
    // Act
    const loaded = loadFixtureMappe(
      editedMappeFixture({
        'mappe/template.nn.md': good,
        'mappe/template.nb.md': good,
        'mappe/template.en.md': good,
      }),
    );
    // Assert
    expect(loaded.ok ? 'loaded' : loaded.problems).toBe('loaded');
  });
});
