/**
 * Tests for the guide's node-tree builder on what it refuses (D-083 amendment): raw HTML, images, tables, code,
 * rules, strikethrough, hard breaks, level-1, level-4 and setext headings, `{{` outside a marker line, malformed
 * citations, reference definitions, unsafe links and a link split over lines; each with the line it stands on.
 * Prose mode (a pattern's "why it works") also refuses headings, boxes and markers.
 *
 * Spec: PED-002, PED-010
 */
import { describe, expect, it } from 'vitest';
import { buildGuideTree } from '../../../src/learningDesign/content/guideMarkdownTree.js';

/** The problems of a text whose third line holds the construct. */
const problemsAtLineThree = (construct: string, mode: 'guide' | 'prose' = 'guide') =>
  buildGuideTree(`Første avsnitt.\n\n${construct}\n`, mode).problems;

describe('[PED-002] what the guide node tree refuses', () => {
  it.each([
    ['a raw HTML block', '<div>x</div>', /holds HTML/],
    ['a script tag', '<script>alert(1)</script>', /holds HTML/],
    ['inline HTML in prose', 'Tekst <span onclick="x">her</span>', /holds HTML/],
    ['a < before a letter', 'a<b og c>d', /write < as &lt;/],
    ['an image', '![alt](bilete.png)', /holds an image/],
    ['a table', '| a |\n|---|\n| 1 |', /holds a table/],
    ['a fenced code block', '```\nkode\n```', /holds a code block/],
    ['an indented code block', '    kode', /indented code block/],
    ['inline code', 'Bruk `kode`.', /inline code/],
    ['a rule', '***', /horizontal rule/],
    ['strikethrough', '~~vekk~~', /struck-through/],
    ['a hard break', 'linje  \nneste', /hard line break/],
    ['a level-1 heading', '# Tittel', /level-1 heading/],
    ['a level-4 heading', '#### Djupt', /level-4 heading/],
    ['a setext heading', 'Tittel\n===', /underlined with === or ---/],
    ['{{ outside a marker line', 'Sjå {{phase-matrix}} her.', /holds \{\{/],
    ['a marker in emphasis', '**{{pattern-catalogue}}**', /holds \{\{/],
    ['an unknown marker', '{{insight}}', /\{\{insight\}\} is not a marker/],
    ['a citation with a capital', '[@Guo2014]', /\[@Guo2014\], which is not a citation/],
    ['an unclosed citation', 'Sjå [@guo2014 og', /does not end it with \]/],
    ['a citation inside a link', '[sjå [@guo2014]](https://x.no)', /inside a link's text/],
    ['a javascript: link', '[a](javascript:alert(1))', /links to javascript:/],
    ['an http: link', '[a](http://www.hvl.no)', /use an https: address/],
    ['a data: link', '[a](data:text/html,x)', /links to data:/],
    ['a protocol-relative link', '[a](//evil.example)', /links to \/\/evil/],
    ['a backslash path', '[a](/\\evil.example)', /a page of this site/],
    ['an encoded double slash', '[a](/%2F%2Fevil.example)', /a page of this site/],
    ['a link without text', '[](https://x.no)', /link without text/],
    ['a link whose text is only spaces', '[ ](https://x.no)', /link without text/],
  ])('[PED-002] refuses %s on the line it is on', (_name, construct, message) => {
    // Act
    const problems = problemsAtLineThree(construct);
    // Assert
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toEqual({ line: 3, message: expect.stringMatching(message) });
  });

  it('[PED-002] names the line of a construct after soft breaks, and refuses a link whose address spans lines', () => {
    // Act
    const late = buildGuideTree('A\nB\nC `kode`', 'guide').problems;
    const split = buildGuideTree('L1 [a](\nhttps://x.no) y\nL3 *her*', 'guide').problems;
    // Assert
    expect(late).toEqual([{ line: 3, message: expect.stringMatching(/inline code/) }]);
    expect(split).toEqual([{ line: 1, message: expect.stringMatching(/runs over more than one line/) }]);
  });

  it('[PED-002] refuses a reference definition at its line, since it would turn a citation into a link', () => {
    const problems = buildGuideTree('Sjå [@guo2014].\n\n[@guo2014]: https://doi.org/x', 'guide').problems;
    expect(problems).toEqual([{ line: 3, message: expect.stringMatching(/reference definition/) }]);
  });

  it('[PED-002] refuses a heading or a box inside a list, and a box inside a box, once each', () => {
    // Act
    const inList = buildGuideTree('- ## Overskrift', 'guide').problems;
    const nested = buildGuideTree('> > indre', 'guide').problems;
    // Assert
    expect(inList).toEqual([{ line: 1, message: expect.stringMatching(/heading inside a list or a box/) }]);
    expect(nested).toEqual([{ line: 1, message: expect.stringMatching(/inside a list or another box/) }]);
  });

  it.each([
    ['a heading', '## Overskrift', /paragraphs and lists only/],
    ['a box', '> Boks', /box/],
    ['a marker line', '{{phase-matrix}}', /holds \{\{/],
  ])('[PED-010] prose mode refuses %s', (_name, construct, message) => {
    expect(problemsAtLineThree(construct, 'prose')).toEqual([
      { line: 3, message: expect.stringMatching(message) },
    ]);
  });
});
