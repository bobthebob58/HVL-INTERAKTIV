/**
 * Probe P5 (part 2): how markdown-it 14.3.3 tokenises the guide's own conventions, the `{{phase-matrix}}` and
 * `{{pattern-catalogue}}` marker lines and `[@key]` citations, and how to get a line number for an inline token.
 *
 * Why: markers and citations are not Markdown syntax, so the guide's node-tree builder (D-083) recognises them in
 *      text tokens. These tests pin what those text tokens look like, which neighbouring syntax changes them (a
 *      reference definition turns a citation into a link) and how the builder can name a line for an inline error,
 *      including where counting break tokens falls short (a line break inside a link destination or raw HTML).
 * Spec: PED-002
 * Collaborators: ./guideMarkdownTokensSummary.ts (parser and summaries).
 * Tests: this file.
 */
import { describe, expect, it } from 'vitest';
import { blockSummary, guideParser, inlineOf, inlineTokens } from './guideMarkdownTokensSummary.js';

describe('[PED-002] probe P5: guide markers and citations in markdown-it 14.3.3 tokens', () => {
  it('[PED-002] a marker line alone is a top-level paragraph whose inline token has exactly one text child', () => {
    // Act
    const tokens = guideParser().parse('Før.\n\n   {{phase-matrix}}   \n\nEtter.', {});
    const marker = inlineTokens(tokens)[1];
    // Assert
    expect(marker?.level).toBe(1); // WHY: the inline token sits one level below its paragraph_open (level 0).
    expect(marker?.map).toEqual([2, 3]);
    // WHY: markdown-it trims the paragraph, so spaces around the marker do not matter.
    expect(inlineOf('   {{phase-matrix}}   ')).toEqual(['text "{{phase-matrix}}"']);
  });

  it('[PED-002] a marker with text on the next line shares its paragraph, so the builder must require a lone text child', () => {
    expect(inlineOf('{{phase-matrix}}\nTekst rett etter')).toEqual([
      'text "{{phase-matrix}}"',
      'softbreak',
      'text "Tekst rett etter"',
    ]);
  });

  it('[PED-002] a marker inside a list item or inside emphasis is not a top-level lone text paragraph', () => {
    // Act
    const inList = blockSummary(guideParser().parse('- {{phase-matrix}}', {}));
    const inStrong = inlineOf('**{{pattern-catalogue}}**');
    // Assert
    expect(inList).toEqual([
      'bullet_list_open ul @0-1',
      'list_item_open li @0-1',
      'paragraph_open p @0-1 hidden',
      'inline @0-1',
      'paragraph_close p hidden',
      'list_item_close li',
      'bullet_list_close ul',
    ]);
    // WHY: emphasis around a whole paragraph leaves empty text tokens on both sides; the builder drops them.
    expect(inStrong).toEqual([
      'text ""',
      'strong_open',
      'text "{{pattern-catalogue}}"',
      'strong_close',
      'text ""',
    ]);
  });

  it('[PED-002] a citation stays inside one text token: next to another, after an unmatched *, or written with escapes', () => {
    expect(inlineOf('Sjå [@a][@b] og [@a] [@b].')).toEqual(['text "Sjå [@a][@b] og [@a] [@b]."']);
    expect(inlineOf('Sjå *[@guo2014] og _x_[@a-b]_y')).toEqual([
      'text "Sjå *[@guo2014] og "',
      'em_open',
      'text "x"',
      'em_close',
      'text "[@a-b]_y"',
    ]);
    // WHY: the text_join core rule merges escapes into the text, so `\[@x\]` cannot be told from `[@x]`.
    expect(inlineOf('\\[@x\\] og [@guo\\_2014]')).toEqual(['text "[@x] og [@guo_2014]"']);
  });

  it('[PED-002] a citation followed by (url) is a link, and one inside link text stays in the link text', () => {
    expect(inlineOf('[@guo2014](https://a.no)')).toEqual([
      'link_open https://a.no',
      'text "@guo2014"',
      'link_close',
    ]);
    expect(inlineOf('[sjå [@guo2014]](https://x.no)')).toEqual([
      'link_open https://x.no',
      'text "sjå [@guo2014]"',
      'link_close',
    ]);
  });

  it('[PED-002] a reference definition leaves no token, fills env.references and silently turns a citation into a link', () => {
    // Arrange
    const source = '[@guo2014]: https://doi.org/x\n\nSjå [@guo2014].';
    const env: { references?: Record<string, unknown> } = {};
    // Act
    const tokens = guideParser().parse(source, env);
    // Assert
    expect(blockSummary(tokens)).toEqual(['paragraph_open p @2-3', 'inline @2-3', 'paragraph_close p']);
    expect(inlineOf(source)).toEqual([
      'text "Sjå "',
      'link_open https://doi.org/x',
      'text "@guo2014"',
      'link_close',
      'text "."',
    ]);
    // WHY: labels are normalised to upper case, so the builder can name the offending definition from env.
    expect(env.references).toEqual({ '@GUO2014': { title: '', href: 'https://doi.org/x' } });
  });

  it("[PED-002] with the 'reference' rule disabled a definition is plain paragraph text and env stays empty", () => {
    // Arrange
    const md = guideParser().disable('reference');
    const env = {};
    // Act
    const tokens = md.parse('[@guo2014]: https://doi.org/x\n\nSjå [@guo2014].', env);
    // Assert
    expect(inlineTokens(tokens).map((token) => token.content)).toEqual([
      '[@guo2014]: https://doi.org/x',
      'Sjå [@guo2014].',
    ]);
    expect(env).toEqual({});
  });

  it('[PED-002] an inline token has no map; its line is the inline map start plus the soft and hard breaks before it', () => {
    // Arrange
    const source = 'Intro.\n\nLinje 2\nlinje 3 med *vekt*  \nlinje 4 med `kode`.';
    const inline = inlineTokens(guideParser().parse(source, {}))[1];
    const children = inline?.children ?? [];
    // Act
    const index = children.findIndex((child) => child.type === 'code_inline');
    const breaks = children.slice(0, index).filter((child) => /^(soft|hard)break$/.test(child.type)).length;
    // Assert
    expect(children[index]?.map).toBeNull();
    expect((inline?.map?.[0] ?? 0) + breaks).toBe(4); // WHY: 0-based; the editor shows line 5.
  });

  it('[PED-002] a line break inside a link destination or raw HTML leaves no break token, so counting breaks undercounts', () => {
    // Arrange
    const lineOfEm = (source: string, html: boolean): number => {
      const children = inlineTokens(guideParser({ html }).parse(source, {}))[0]?.children ?? [];
      const before = children.slice(
        0,
        children.findIndex((child) => child.type === 'em_open'),
      );
      return before.filter((child) => /^(soft|hard)break$/.test(child.type)).length;
    };
    // Act and assert: `*her*` is on line 2 in both sources, but only one break token precedes it.
    expect(lineOfEm('L0 [a](\nhttps://x.no) y\nL2 *her*', false)).toBe(1);
    expect(lineOfEm('L0 <span\nclass="x">y</span>\nL2 *her*', true)).toBe(1);
    // WHY: an html_inline token keeps its newline in `content`; a link destination's newline leaves no trace.
    expect(inlineOf('a <span\nclass="x">', guideParser({ html: true }))[1]).toBe(
      'html_inline "<span\\nclass=\\"x\\">"',
    );
  });

  it('[PED-002] entities are decoded into text and CRLF line endings count as one line each', () => {
    expect(inlineOf('a &amp; b &lt;script&gt; &#x41;')).toEqual(['text "a & b <script> A"']);
    const crlf = blockSummary(guideParser().parse('a\r\nb\r\n\r\n## c', {}));
    expect(crlf.filter((line) => line.includes('@'))).toEqual([
      'paragraph_open p @0-2',
      'inline @0-2',
      'heading_open h2 @3-4',
      'inline @3-4',
    ]);
  });
});
