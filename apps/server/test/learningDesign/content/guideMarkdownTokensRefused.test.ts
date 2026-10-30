/**
 * Probe P5 (part 3): what markdown-it 14.3.3 produces for the constructs the guide refuses (D-083): raw HTML,
 * images, tables, code, level-1 and setext headings, thematic breaks, strikethrough, hard breaks and unsafe links.
 *
 * Why: the guide's loader must refuse these "naming the file and line" (D-083). That only works for a construct that
 *      produces a token of its own. The probe shows that the default preset gives every refused construct a distinct
 *      token, that `html: false` and the default link check do NOT (they turn raw HTML and javascript: links into
 *      plain text without a trace), and that disabling a rule makes its construct silent text instead of an error.
 *      Recommendation for the builder: keep the default rules on and refuse by token type; replace `validateLink` so
 *      every link reaches the builder's own https/mailto/same-site check; find raw HTML with `html: true` tokens (or
 *      a text scan when `html` stays false); and refuse reference definitions from `env.references`.
 * Spec: PED-002
 * Collaborators: ./guideMarkdownTokensSummary.ts (parser and summaries).
 * Tests: this file.
 */
import { describe, expect, it } from 'vitest';
import { blockSummary, guideParser, inlineOf, inlineTokens } from './guideMarkdownTokensSummary.js';

const RAW_HTML =
  'Tekst\n\n<div class="x">\nblokk\n</div>\n\n<script>alert(1)</script>\n\nInline <span onclick="x">html</span> og <!-- c -->.';

describe('[PED-002] probe P5: refused guide constructs in markdown-it 14.3.3', () => {
  it('[PED-002] with html: false raw HTML gives no html_* token: it is paragraph text, escaped when rendered', () => {
    // Act
    const md = guideParser();
    const tokens = md.parse(RAW_HTML, {});
    // Assert
    expect(tokens.some((token) => token.type.startsWith('html'))).toBe(false);
    expect(inlineTokens(tokens).map((token) => token.children?.map((child) => child.type).join(','))).toEqual(
      ['text', 'text,softbreak,text,softbreak,text', 'text', 'text'],
    );
    expect(inlineOf('<script>alert(1)</script>')).toEqual(['text "<script>alert(1)</script>"']);
    expect(md.render('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>\n');
  });

  it('[PED-002] with html: true raw HTML becomes html_block tokens with line maps and html_inline children', () => {
    // Act
    const tokens = guideParser({ html: true }).parse(RAW_HTML, {});
    // Assert
    expect(blockSummary(tokens)).toEqual([
      'paragraph_open p @0-1',
      'inline @0-1',
      'paragraph_close p',
      'html_block @2-5',
      'html_block @6-7',
      'paragraph_open p @8-9',
      'inline @8-9',
      'paragraph_close p',
    ]);
    expect(tokens[3]?.content).toBe('<div class="x">\nblokk\n</div>\n');
    expect(
      inlineOf('Inline <span onclick="x">html</span> og <!-- c -->.', guideParser({ html: true })),
    ).toEqual([
      'text "Inline "',
      'html_inline "<span onclick=\\"x\\">"',
      'text "html"',
      'html_inline "</span>"',
      'text " og "',
      'html_inline "<!-- c -->"',
      'text "."',
    ]);
  });

  it.each([
    ['# Nivå ein', 'heading_open h1 @0-1', '#'],
    ['Setext\n======', 'heading_open h1 @0-2', '='],
    ['Tekst\n---', 'heading_open h2 @0-2', '-'], // WHY: a paragraph line followed by --- is a setext h2, not a rule.
    ['***', 'hr hr @0-1', '***'],
    ['```js\nconst x = 1;\n```', 'fence code @0-3', '```'],
    ['    innrykka kode', 'code_block code @0-1', ''],
    ['| a | b |\n|---|---|\n| 1 | 2 |', 'table_open table @0-3', ''],
  ])('[PED-002] the default preset gives a refused block %j its own token', (source, summary, markup) => {
    const [first] = guideParser().parse(source, {});
    expect([blockSummary(first ? [first] : [])[0], first?.markup]).toEqual([summary, markup]);
  });

  it('[PED-002] the table rule is on in the default preset; cells and their inline tokens have no map, rows do', () => {
    // Act
    const lines = blockSummary(guideParser().parse('| a |\n|---|\n| 1 |', {}));
    // Assert
    expect(lines.filter((line) => !line.includes('_close'))).toEqual([
      'table_open table @0-3',
      'thead_open thead @0-1',
      'tr_open tr @0-1',
      'th_open th',
      'inline',
      'tbody_open tbody @2-3',
      'tr_open tr @2-3',
      'td_open td',
      'inline',
    ]);
  });

  it.each([
    ['![alt tekst](bilete.png)', ['image bilete.png alt="alt tekst"']],
    ['Bruk `kode` her.', ['text "Bruk "', 'code_inline "kode"', 'text " her."']],
    ['~~stroke~~', ['s_open', 'text "stroke"', 's_close']],
    ['linje  \nneste', ['text "linje"', 'hardbreak', 'text "neste"']],
    ['linje\\\nneste', ['text "linje"', 'hardbreak', 'text "neste"']],
    [
      '<https://auto.no> og www.hvl.no',
      ['link_open https://auto.no', 'text "https://auto.no"', 'link_close', 'text " og www.hvl.no"'],
    ],
  ])('[PED-002] the default preset gives a refused inline construct %j its own token', (source, expected) => {
    expect(inlineOf(source)).toEqual(expected);
  });

  it('[PED-002] the default link check silently leaves javascript:, vbscript:, file: and data:text links as plain text', () => {
    // Act
    const refused = inlineOf(
      '[a](javascript:alert(1)) [b](JaVaScRiPt:x) [c](vbscript:x) [d](file:///etc/passwd) [e](data:text/html,x)',
    );
    const passed = inlineOf(
      '[f](data:image/png;base64,AA) [g](//evil.example) [h](/\\evil.example) [i](http://x.no)',
    );
    // Assert
    expect(refused).toEqual([
      'text "[a](javascript:alert(1)) [b](JaVaScRiPt:x) [c](vbscript:x) [d](file:///etc/passwd) [e](data:text/html,x)"',
    ]);
    expect(passed.filter((line) => line.startsWith('link_open'))).toEqual([
      'link_open data:image/png;base64,AA',
      'link_open //evil.example', // WHY: protocol-relative, so "starts with /" is not a same-site test.
      'link_open /%5Cevil.example', // WHY: normalizeLink percent-encodes the backslash.
      'link_open http://x.no',
    ]);
  });

  it('[PED-002] replacing validateLink makes every link a link_open token, so the builder can refuse it by line', () => {
    // Arrange
    const md = guideParser();
    md.validateLink = () => true;
    // Act
    const links = inlineOf('[a](javascript:alert(1)) [b](data:text/html,x)', md);
    // Assert
    expect(links.filter((line) => line.startsWith('link_open'))).toEqual([
      'link_open javascript:alert(1)',
      'link_open data:text/html,x',
    ]);
  });

  it('[PED-002] hrefs arrive normalised: scheme case kept, IDN hosts in punycode, æøå percent-encoded; titles and autolinks marked', () => {
    // Arrange
    const md = guideParser();
    md.validateLink = () => true;
    // Act
    const source =
      '[a](HTTPS://x.no)[b](https://ø.no)[c](/m/mønster)[d](https://x.no "T") <https://a.no><alu@hvl.no>';
    const [link, idn, path, titled, auto, mail] =
      inlineTokens(md.parse(source, {}))[0]?.children?.filter((child) => child.type === 'link_open') ?? [];
    // Assert
    expect([link, idn, path].map((token) => token?.attrGet('href'))).toEqual([
      'HTTPS://x.no', // WHY: the builder's scheme check must ignore case.
      'https://xn--pda.no',
      '/m/m%C3%B8nster', // WHY: a same-site route check must decode the path first.
    ]);
    expect([titled?.attrGet('title'), auto?.markup, mail?.attrGet('href')]).toEqual([
      'T',
      'autolink',
      'mailto:alu@hvl.no',
    ]);
    // WHY: with html: true, prose such as `a<b og c>d` holds an open tag, so the builder refuses it by line.
    expect(inlineOf('a<b og c>d', guideParser({ html: true }))).toEqual([
      'text "a"',
      'html_inline "<b og c>"',
      'text "d"',
    ]);
  });

  it('[PED-002] disabling rules turns refused constructs into silent text (or a link), so they cannot raise errors', () => {
    // Arrange
    const md = guideParser().disable(['image', 'table', 'code', 'fence', 'hr', 'lheading', 'strikethrough']);
    // Act
    const image = inlineOf('![a](b)', md);
    const table = inlineTokens(md.parse('| a |\n|---|\n| 1 |', {})).map((token) => token.content);
    // Assert
    expect(image).toEqual(['text "!"', 'link_open b', 'text "a"', 'link_close']);
    expect(table).toEqual(['| a |\n|---|\n| 1 |']);
    expect(inlineOf('    kode', md)).toEqual(['text "kode"']);
    // WHY: 'code' is the indented code block; inline code is the separate 'backticks' rule, still on here.
    expect(inlineOf('`k`', md)).toEqual(['code_inline "k"']);
    expect(() => guideParser().disable('no-such-rule')).toThrow(/unknown rule/);
  });
});
