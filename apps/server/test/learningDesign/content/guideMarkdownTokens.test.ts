/**
 * Probe P5 (part 1): the markdown-it 14.3.3 tokens for a guide that uses every allowed convention.
 *
 * Why: the guide's node-tree builder (D-083) maps markdown-it tokens to a closed set of nodes. These tests pin which
 *      tokens the allowed constructs produce, where `token.map` gives line numbers and where it does not, so the
 *      builder is written from facts, and an upgrade that changes them fails here first.
 * Spec: PED-002
 * Collaborators: ./guideMarkdownTokensSummary.ts (parser and summaries).
 * Tests: this file; markers and citations in ./guideMarkdownTokensMarkers.test.ts, refused constructs in
 *   ./guideMarkdownTokensRefused.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { blockSummary, guideParser, inlineSummary, inlineTokens } from './guideMarkdownTokensSummary.js';

/** A guide excerpt with ## and ### headings, emphasis, a citation, nested and numbered lists, a box and markers. */
const GUIDE = [
  '## Kvifor asynkront arbeid sviktar', // line 0
  '',
  'Passivt materiale gir **høg** kognitiv *last* [@guo2014].', // line 2
  'Neste linje i same avsnitt.',
  '',
  '### Segmenter og hent fram', // line 5
  '',
  '- Del opp videoen', // line 7
  '  - maks seks minutt',
  '- Still spørsmål',
  '',
  '1. Planlegg', // line 11
  '2. Gjennomfør',
  '',
  '> Kva dette betyr: legg inn eit spørsmål [@kirschner2006].', // line 14
  '',
  '{{phase-matrix}}', // line 16
  '',
  'Sjå [ALU](https://www.hvl.no/alu), [e-post](mailto:alu@hvl.no) og [mønster](/laeringsdesign/monster/fa-video).',
  '',
  '{{pattern-catalogue}}', // line 20
  '',
].join('\n');

describe('[PED-002] probe P5: markdown-it 14.3.3 tokens for the guide conventions', () => {
  it('[PED-002] block tokens: headings, paragraphs, nested and numbered lists, a blockquote and marker paragraphs, each opening token with its line map', () => {
    // Act
    const opening = blockSummary(guideParser().parse(GUIDE, {})).filter((line) => !line.includes('_close'));
    // Assert
    expect(opening).toEqual([
      'heading_open h2 @0-1',
      'inline @0-1',
      'paragraph_open p @2-4',
      'inline @2-4',
      'heading_open h3 @5-6',
      'inline @5-6',
      // WHY: a list's and its last item's map run on over the blank line that ends the list.
      'bullet_list_open ul @7-11',
      'list_item_open li @7-9',
      'paragraph_open p @7-8 hidden',
      'inline @7-8',
      'bullet_list_open ul @8-9',
      'list_item_open li @8-9',
      'paragraph_open p @8-9 hidden',
      'inline @8-9',
      'list_item_open li @9-11',
      'paragraph_open p @9-10 hidden',
      'inline @9-10',
      'ordered_list_open ol @11-14',
      'list_item_open li @11-12',
      'paragraph_open p @11-12 hidden',
      'inline @11-12',
      'list_item_open li @12-14',
      'paragraph_open p @12-13 hidden',
      'inline @12-13',
      'blockquote_open blockquote @14-15',
      'paragraph_open p @14-15',
      'inline @14-15',
      'paragraph_open p @16-17',
      'inline @16-17',
      'paragraph_open p @18-19',
      'inline @18-19',
      'paragraph_open p @20-21',
      'inline @20-21',
    ]);
  });

  it('[PED-002] closing tokens and inline children never carry a map; only tight-list paragraphs are hidden', () => {
    // Act
    const tokens = guideParser().parse(GUIDE, {});
    const children = inlineTokens(tokens).flatMap((token) => token.children ?? []);
    // Assert
    expect(tokens.filter((token) => token.nesting === -1).every((token) => token.map === null)).toBe(true);
    expect(children.length).toBeGreaterThan(20);
    expect(children.every((child) => child.map === null)).toBe(true);
    const hidden = tokens.filter((token) => token.hidden).map((token) => token.type);
    expect(new Set(hidden)).toEqual(new Set(['paragraph_open', 'paragraph_close']));
  });

  it('[PED-002] inline children: emphasis pairs, a soft break, a citation kept inside a text token, and links', () => {
    // Act
    const [, paragraph, , , , , , , box, , links] = inlineTokens(guideParser().parse(GUIDE, {}));
    // Assert
    expect(inlineSummary(paragraph)).toEqual([
      'text "Passivt materiale gir "',
      'strong_open',
      'text "høg"',
      'strong_close',
      'text " kognitiv "',
      'em_open',
      'text "last"',
      'em_close',
      'text " [@guo2014]."',
      'softbreak',
      'text "Neste linje i same avsnitt."',
    ]);
    expect(inlineSummary(box)).toEqual(['text "Kva dette betyr: legg inn eit spørsmål [@kirschner2006]."']);
    expect(inlineSummary(links)).toEqual([
      'text "Sjå "',
      'link_open https://www.hvl.no/alu',
      'text "ALU"',
      'link_close',
      'text ", "',
      'link_open mailto:alu@hvl.no',
      'text "e-post"',
      'link_close',
      'text " og "',
      'link_open /laeringsdesign/monster/fa-video',
      'text "mønster"',
      'link_close',
      'text "."',
    ]);
  });

  it('[PED-002] the heading level is in `tag` (h2, h3) and the ATX marker in `markup`; a closing # run is dropped', () => {
    // Act
    const [h2, , , h3] = guideParser().parse('## To ##\n\n### Tre', {});
    // Assert
    expect([h2?.tag, h2?.markup, h3?.tag, h3?.markup]).toEqual(['h2', '##', 'h3', '###']);
    expect(inlineSummary(guideParser().parse('## To ##', {})[1])).toEqual(['text "To"']);
  });

  it('[PED-002] an ordered list keeps a start other than 1 as the `start` attribute and each number in `info`', () => {
    // Act
    const tokens = guideParser().parse('3. tre\n4. fire', {});
    // Assert
    // WHY: at runtime `start` is the number 3, although @types/markdown-it 14.2.0 types attribute values as strings.
    expect(tokens[0]?.attrGet('start')).toBe(3);
    expect(tokens.filter((token) => token.type === 'list_item_open').map((token) => token.info)).toEqual([
      '3',
      '4',
    ]);
    expect(guideParser().parse('1. ein', {})[0]?.attrGet('start')).toBeNull();
  });

  it('[PED-002] a loose list (blank lines between items) has visible paragraphs, unlike a tight one', () => {
    const tokens = guideParser().parse('- a\n\n- b', {});
    expect(tokens.filter((token) => token.type === 'paragraph_open').map((token) => token.hidden)).toEqual([
      false,
      false,
    ]);
  });
});
