/**
 * Tests for the guide's node-tree builder on what it allows (D-083): headings, paragraphs, emphasis, safe links,
 * citations, nested and numbered lists, boxes and the two marker lines become the contract's closed nodes, with an
 * outline that carries each heading's, marker's and citation's line; the result passes the contract's schema.
 *
 * Spec: PED-002, PED-010
 */
import { guideBlockNodeSchema, guideProseNodeSchema } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import { buildGuideTree } from '../../../src/learningDesign/content/guideMarkdownTree.js';

const text = (value: string) => ({ type: 'text', value });
const paragraph = (...children: unknown[]) => ({ type: 'paragraph', children });

describe('[PED-002] the guide node tree', () => {
  it('[PED-002] builds headings, emphasis, citations and a soft break as a space, with the outline lines', () => {
    // Arrange
    const source = '## Kvifor\n\nGir **høg** *last* [@guo2014].\nNeste linje.\n\n### Korleis';
    // Act
    const { nodes, outline, problems } = buildGuideTree(source, 'guide');
    // Assert
    expect(problems).toEqual([]);
    expect(nodes).toEqual([
      { type: 'heading', level: 2, children: [text('Kvifor')] },
      paragraph(
        text('Gir '),
        { type: 'strong', children: [text('høg')] },
        text(' '),
        { type: 'emphasis', children: [text('last')] },
        text(' '),
        { type: 'citation', key: 'guo2014' },
        text('. Neste linje.'),
      ),
      { type: 'heading', level: 3, children: [text('Korleis')] },
    ]);
    expect(outline).toEqual({
      headings: [
        { level: 2, line: 1 },
        { level: 3, line: 6 },
      ],
      markers: [],
      citations: [{ key: 'guo2014', line: 3 }],
    });
  });

  it('[PED-002] builds nested and numbered lists (the start number ignored), a box with a list, and marker lines', () => {
    // Arrange
    const source =
      '- a\n  - b\n\n3. c\n4. d\n\n> Boks.\n>\n> - e\n\n   {{phase-matrix}}   \n\n{{pattern-catalogue}}';
    // Act
    const { nodes, outline, problems } = buildGuideTree(source, 'guide');
    // Assert
    expect(problems).toEqual([]);
    const item = (...children: unknown[]) => ({ type: 'listItem', children });
    expect(nodes).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [
          item(paragraph(text('a')), { type: 'list', ordered: false, items: [item(paragraph(text('b')))] }),
        ],
      },
      { type: 'list', ordered: true, items: [item(paragraph(text('c'))), item(paragraph(text('d')))] },
      {
        type: 'box',
        children: [
          paragraph(text('Boks.')),
          { type: 'list', ordered: false, items: [item(paragraph(text('e')))] },
        ],
      },
      { type: 'marker', name: 'phase-matrix' },
      { type: 'marker', name: 'pattern-catalogue' },
    ]);
    expect(outline.markers).toEqual([
      { name: 'phase-matrix', line: 11 },
      { name: 'pattern-catalogue', line: 13 },
    ]);
    for (const node of nodes) expect(guideBlockNodeSchema.safeParse(node).success).toBe(true);
  });

  it('[PED-002] keeps https, mailto and same-site links (any scheme case), drops a title, and allows strong text in a link', () => {
    // Arrange
    const source =
      '[**ALU**](HTTPS://www.hvl.no/alu "Tittel") [e-post](mailto:alu@hvl.no) [studio](/laeringsdesign) <https://a.no>';
    // Act
    const { nodes, problems } = buildGuideTree(source, 'guide');
    // Assert
    expect(problems).toEqual([]);
    expect(nodes).toEqual([
      paragraph(
        {
          type: 'link',
          href: 'HTTPS://www.hvl.no/alu',
          children: [{ type: 'strong', children: [text('ALU')] }],
        },
        text(' '),
        { type: 'link', href: 'mailto:alu@hvl.no', children: [text('e-post')] },
        text(' '),
        { type: 'link', href: '/laeringsdesign', children: [text('studio')] },
        text(' '),
        { type: 'link', href: 'https://a.no', children: [text('https://a.no')] },
      ),
    ]);
  });

  it('[PED-002] decodes entities into text, so `&lt;script&gt;` is shown as text and never as HTML', () => {
    const { nodes, problems } = buildGuideTree('Skriv &lt;script&gt; &amp; meir.', 'guide');
    expect(problems).toEqual([]);
    expect(nodes).toEqual([paragraph(text('Skriv <script> & meir.'))]);
  });

  it('[PED-002] ignores a byte-order mark that an editor saved before the first heading', () => {
    const { nodes, problems } = buildGuideTree('\uFEFF## Kvifor', 'guide');
    expect(problems).toEqual([]);
    expect(nodes).toEqual([{ type: 'heading', level: 2, children: [text('Kvifor')] }]);
  });

  it('[PED-010] prose mode builds paragraphs and lists that pass the contract’s prose schema', () => {
    // Act
    const { nodes, problems } = buildGuideTree('Hent fram [@roediger2006].\n\n- Kort\n- Ofte', 'prose');
    // Assert
    expect(problems).toEqual([]);
    expect(nodes.map((node) => node.type)).toEqual(['paragraph', 'list']);
    for (const node of nodes) expect(guideProseNodeSchema.safeParse(node).success).toBe(true);
  });
});
