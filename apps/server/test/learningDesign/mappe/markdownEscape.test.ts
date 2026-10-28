/**
 * Tests for the pedagogisk mappe's Markdown escaper: hostile titles stay text in every place a template can put
 * them, and ordinary Norwegian prose comes back unchanged.
 *
 * Spec: MAPPE-002
 */
import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';
import { escapeMarkdownText, escapeMarkdownValue } from '../../../src/learningDesign/mappe/markdownEscape.js';

// WHY: the worst case for an exported .md file is a renderer with raw HTML on; tables and ~~ are on by default.
const md = new MarkdownIt({ html: true, linkify: false, typographer: false });
const html = (text: string): string => md.utils.escapeHtml(text);

/** Where a template can put a value, and the HTML that value must render to there: plain text T, nothing more. */
const CONTEXTS: ReadonlyArray<[string, (v: string) => string, (t: string) => string]> = [
  ['paragraph', (v) => v, (t) => `<p>${t}</p>\n`],
  ['heading', (v) => `## ${v}`, (t) => `<h2>${t}</h2>\n`],
  ['list item', (v) => `- ${v}`, (t) => `<ul>\n<li>${t}</li>\n</ul>\n`],
  ['block quote', (v) => `> ${v}`, (t) => `<blockquote>\n<p>${t}</p>\n</blockquote>\n`],
  ['line after text', (v) => `Før\n${v}`, (t) => `<p>Før\n${t}</p>\n`],
  ['line before text', (v) => `${v}\nEtter`, (t) => `<p>${t}\nEtter</p>\n`],
  ['mid-line', (v) => `Tittel: ${v} (slutt)`, (t) => `<p>Tittel: ${t} (slutt)</p>\n`],
  [
    'link text',
    (v) => `[${v}](https://www.hvl.no/)`,
    (t) => `<p><a href="https://www.hvl.no/">${t}</a></p>\n`,
  ],
  [
    'table cell',
    (v) => `| A |\n|---|\n| ${v} |`,
    (t) =>
      `<table>\n<thead>\n<tr>\n<th>A</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>${t}</td>\n</tr>\n</tbody>\n</table>\n`,
  ],
  [
    // WHY: no space between the value and `|`, as code that builds the reader's guide table may write it.
    'table cells without spaces',
    (v) => `|A|B|\n|-|-|\n|${v}|${v}|`,
    (t) =>
      `<table>\n<thead>\n<tr>\n<th>A</th>\n<th>B</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>${t}</td>\n<td>${t}</td>\n</tr>\n</tbody>\n</table>\n`,
  ],
  // WHY: a line that holds a `|` could become a table header if the next line were a delimiter row such as `:-:`.
  ['line after a pipe', (v) => `Merknad |\n${v}`, (t) => `<p>Merknad |\n${t}</p>\n`],
];

/** Hostile inputs, with the text they must render as when it differs from the input. */
const HOSTILE: ReadonlyArray<[string, string?]> = [
  ['# Overskrift'],
  ['###### Seks'],
  ['Tittel #'],
  ['Tittel ##   ', 'Tittel ##'],
  ['- punkt'],
  ['* punkt'],
  ['+ punkt'],
  ['1. punkt'],
  ['1) punkt'],
  ['2026.'],
  ['**sterk** og *kursiv* og __under__ og _u_'],
  ['~~stroke~~'],
  ['`kode` og ```js'],
  ['[lenke](https://evil.example)'],
  ['![bilete](https://evil.example/x.png)'],
  ['[ref]: https://evil.example'],
  ['[@guo2014] og [x][y]'],
  ['<script>alert(1)</script>'],
  ['<img src=x onerror=alert(1)>'],
  ['<https://evil.example>'],
  ['<!-- kommentar -->'],
  ['&lt;b&gt; &amp; &#x41; &copy;'],
  ['| a | b |'],
  ['> sitat'],
  ['---'],
  ['***'],
  ['___'],
  ['- - -'],
  ['==='],
  ['    innrykka kode', 'innrykka kode'],
  ['\tinnrykk med tabulator', 'innrykk med tabulator'],
  ['linje ein\nlinje to', 'linje ein linje to'],
  ['hard  \nbreak', 'hard break'],
  ['a\r\n\r\n# b', 'a # b'],
  ['slutt med omvendt skråstrek\\'],
  ['\\'],
  [':-:'],
  [':--'],
  ['C:\\mappe\\fil'],
  ['{{phase-matrix}} og {{{raw}}} og {{& x}}'],
  ['null\u0000teikn og\u007fslett', 'null teikn og slett'],
];

describe('[MAPPE-002] Markdown escaper for portfolio values', () => {
  it.each(HOSTILE)(
    '[MAPPE-002] %j renders as plain text in every template position',
    (input, text = input) => {
      // Act
      const escaped = escapeMarkdownText(input);
      const wrong = CONTEXTS.filter(
        ([, place, expected]) => md.render(place(escaped)) !== expected(html(text)),
      );
      // Assert
      expect(wrong.map(([name, place]) => `${name}: ${md.render(place(escaped))}`)).toEqual([]);
    },
  );

  it.each([
    'Studentane kan forklare korleis økt bruk av læringsressursar påverkar ståstaden til den einskilde.',
    'Kapittel 3.2 (sjå side 14): Æ, Ø og Å er bokstavar!',
    'Kva betyr «formativ»? Ho sa: \'undervegs\' – og "no".',
    'MAT101 – haust 2026, 45 min / 90 % gjennomføring; 3.5 timar.',
    'Forsking & utvikling, e-post: alu@hvl.no',
    'Kva skjer > 5 gonger? 2 + 2 = 4, og 1 - 1 = 0.',
    'To  mellomrom står att.',
  ])('[MAPPE-002] ordinary prose %j is not escaped at all', (prose) => {
    expect(escapeMarkdownText(prose)).toBe(prose);
    expect(md.render(prose)).toBe(`<p>${html(prose)}</p>\n`);
  });

  it('[MAPPE-002] escapes only where it must: inline syntax anywhere, block syntax at the start', () => {
    expect(escapeMarkdownText('# Quiz [1](x)')).toBe('\\# Quiz \\[1\\](x)');
    expect(escapeMarkdownText('- a - b')).toBe('\\- a - b');
    expect(escapeMarkdownText('3. del og 3.5 timar')).toBe('3\\. del og 3.5 timar');
    expect(escapeMarkdownText('3.5 timar')).toBe('3.5 timar');
    expect(escapeMarkdownText('AT&T og &amp;')).toBe('AT&T og \\&amp;');
    expect(escapeMarkdownText(': x og C:\\mappe\\')).toBe('\\: x og C:\\\\mappe&#92;');
  });

  it('[MAPPE-002] white space and control characters alone become empty text', () => {
    expect(escapeMarkdownText(' \n\t\r ')).toBe('');
  });

  it('[MAPPE-002] an empty value leaves only the template syntax around it, which can be structure of its own', () => {
    // WHY: Mustache renders a missing value as '' too, so the renderer or the template must not depend on a value.
    const empty = escapeMarkdownText(' ');
    expect([md.render(`**${empty}**`), md.render(`## ${empty}`)]).toEqual(['<hr>\n', '<h2></h2>\n']);
  });

  it('[MAPPE-002] a long run of spaces is handled in linear time', () => {
    // WHY: a backtracking pattern would take minutes here and hit the test timeout.
    expect(escapeMarkdownText(`${' '.repeat(200_000)}x${' '.repeat(200_000)}`)).toBe('x');
  });

  it('[MAPPE-002] Mustache values: numbers and booleans become escaped text; objects, arrays and symbols throw', () => {
    // Act and assert
    expect(escapeMarkdownValue(3.5)).toBe('3.5');
    expect(escapeMarkdownValue(-1)).toBe('\\-1');
    expect(escapeMarkdownValue(10n)).toBe('10');
    expect(escapeMarkdownValue(false)).toBe('false');
    expect(escapeMarkdownValue('# x')).toBe('\\# x');
    expect(() => escapeMarkdownValue({ title: 'x' })).toThrow(TypeError);
    expect(() => escapeMarkdownValue(['x'])).toThrow(TypeError);
    expect(() => escapeMarkdownValue(Symbol('x'))).toThrow(TypeError);
  });
});
