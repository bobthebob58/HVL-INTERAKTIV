/**
 * Tests for rendering the pedagogisk mappe (D-094): switching the criteria set changes every criterion text and the
 * reader's guide; the Del 1 word count leaves out the reader's guide and the references; an author's title such as
 * `# x` or `[a](b)` stays text; and the counting rules (a number is one word, syntax is no word, nested items are not
 * attachments).
 *
 * Spec: MAPPE-002
 */
import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';
import type { MappeCriteriaSet } from '../../../src/learningDesign/content/mappeContent.js';
import { cutAtMarkers } from '../../../src/learningDesign/content/mappeTemplateSegments.js';
import { readersGuideBlock } from '../../../src/learningDesign/mappe/mappeBlocks.js';
import { renderMappeOnce } from '../../../src/learningDesign/mappe/mappeRender.js';
import type { MappeView } from '../../../src/learningDesign/mappe/mappeVariables.js';
import {
  countListItems,
  countMarkdownWords,
  countTextWords,
  firstTopHeading,
} from '../../../src/learningDesign/mappe/mappeWordCount.js';
import { FIXTURE_PATTERN_ID } from '../../support/fixturePattern.js';
import { studioContentWithFixtures } from '../../support/guideFixture.js';
import { FIXTURE_SETS, studioContentWithMappe } from '../../support/mappeFixture.js';
import { benchContent, benchRender, sourceActivity } from './mappeRenderBench.js';

const markdown = new MarkdownIt({ html: true });
const content = benchContent();
const sets = content.mappe.portfolio?.criteriaSets ?? [];

describe('[MAPPE-002] rendering the pedagogisk mappe', () => {
  it('[MAPPE-002] switching the criteria set changes every criterion text and the reader’s guide, with no code change', () => {
    // Act
    const first = benchRender({ set: FIXTURE_SETS.default }).markdown;
    const second = benchRender({ set: FIXTURE_SETS.other }).markdown;
    // Assert
    const [setA, setB] = sets;
    for (const criterion of setA?.criteria ?? []) {
      expect(first).toContain(criterion.text.nn);
      expect(second).not.toContain(criterion.text.nn);
    }
    for (const criterion of setB?.criteria ?? []) expect(second).toContain(criterion.text.nn);
    const guideRows = (text: string) => text.split('\n').filter((line) => line.startsWith('| **'));
    expect(guideRows(first)).toHaveLength(setA?.criteria.length ?? -1);
    expect(guideRows(second)).toHaveLength(setB?.criteria.length ?? -1);
    expect(guideRows(first)[1]).toContain('\\[fyll inn vedlegg\\]');
  });

  it('[MAPPE-002] the Del 1 word count leaves out the reader’s guide and the references', () => {
    // Arrange: the fixture pattern, which cites one test reference, beside the real ones
    const withPattern = studioContentWithMappe(studioContentWithFixtures({ pattern: true }));
    // Act
    const plain = benchRender({ set: FIXTURE_SETS.default });
    const otherGuide = benchRender({ set: FIXTURE_SETS.other });
    const withReferences = benchRender({
      content: withPattern,
      activities: [{ activity: sourceActivity({ patternId: FIXTURE_PATTERN_ID }) }],
    });
    const longerTitle = benchRender({
      activities: [{ activity: sourceActivity({ title: 'Blåbærquiz med fem ord til' }) }],
    });
    // Assert
    expect(withReferences.markdown).toContain(
      '## Referansar\n\n- Fixture, A. (2026). A reference that exists only for the tests of the pattern loader.',
    );
    expect(plain.markdown).toContain(
      'Ingen av dei valde aktivitetane er laga frå eit mønster med referansar.',
    );
    expect(otherGuide.words).toBe(plain.words);
    expect(withReferences.words).toBe(plain.words);
    // WHY: the fixture shows the title once in Del 1 (its heading); Del 2 and the attachments are outside Del 1.
    expect(longerTitle.words).toBe(plain.words + 4);
    expect(plain.markdown).toMatch(new RegExp(`Ordtal: ${plain.words} av 7\\s500\\.`, 'u'));
  });

  it('[MAPPE-002] an author’s title such as `# x`, `[a](b)` or `<b>` stays text: no heading, link or HTML of its own', () => {
    // Arrange
    const title = '# x [a](b) <b>fet</b> | celle';
    // Act
    const rendered = benchRender({ activities: [{ activity: sourceActivity({ title }) }] }).markdown;
    // Assert
    const tokens = markdown.parse(rendered, {});
    // WHY: a heading's text is what its inline children say, with the escapes already undone.
    const textOf = (index: number) =>
      (tokens[index + 1]?.children ?? [])
        .map((child) => (child.type === 'text' ? child.content : `<${child.type}>`))
        .join('');
    const headings = tokens.flatMap((token, index) =>
      token.type === 'heading_open' ? [`${token.tag} ${textOf(index)}`] : [],
    );
    expect(headings).toContain(`h3 ${title}`);
    expect(headings.filter((heading) => heading.startsWith('h1'))).toHaveLength(4);
    const html = markdown.renderer.render(tokens, markdown.options, {});
    expect(html).not.toContain('href="b"');
    expect(html).not.toContain('<b>');
    expect(html).toContain('# x [a](b) &lt;b&gt;fet&lt;/b&gt; | celle');
  });

  it('[MAPPE-002] leaves the reader’s guide out of the count even when its marker stands inside Del 1', () => {
    // Arrange: a template whose guide and references stand between the Del 1 markers
    const template = {
      segments: cutAtMarkers(
        '{{del1_start}}\nTo ord\n\n{{lesarrettleiing}}\n\n{{referansar}}\n{{del1_slutt}}\n' +
          '{{vedlegg_start}}\n- Brev\n{{vedlegg_slutt}}\n',
      ),
    };
    // WHY: the template uses no value, so the view's content does not matter here.
    const view = {} as MappeView;
    const render = (set: MappeCriteriaSet) =>
      renderMappeOnce(template, view, {
        lesarrettleiing: readersGuideBlock(set, 'nn'),
        referansar: '- Ein referanse med fleire ord i seg',
      });
    // Act
    const [first, second] = sets.map(render);
    // Assert
    expect(first?.markdown).toContain('| Kriterium | Kvar i mappa | Vedlegg |');
    expect(first?.markdown).not.toBe(second?.markdown);
    expect([first?.words, second?.words, first?.attachments]).toEqual([2, 2, 1]);
  });

  it('[MAPPE-002] counts a grouped number as one word and no syntax, and only the outermost list items', () => {
    // Arrange
    const nbsp = String.fromCharCode(0xa0);
    // Act and assert
    expect(countTextWords(`Del 1 har 7${nbsp}500 ord – ikkje fleire.`)).toBe(7);
    expect(
      countMarkdownWords('## Tittel\n\n| **A** | B |\n|---|---|\n| [lenke](https://x.no) | `kode` |\n'),
    ).toBe(5);
    expect(countListItems('1. Brev\n2. Dokumentasjon\n   - del\n   - del\n3. Samandrag\n')).toBe(3);
    expect(firstTopHeading('Tekst\n\n# Pedagogisk *mappe*\n')).toBe('Pedagogisk mappe');
    expect(firstTopHeading('## Berre nivå 2\n')).toBeUndefined();
  });

  it('[MAPPE-002] lays the blocks out with one blank line around them and never two in a row', () => {
    // Act
    const rendered = benchRender().markdown;
    // Assert
    expect(rendered).not.toMatch(/\n[ \t]*\n[ \t]*\n/);
    expect(rendered.endsWith('\n')).toBe(true);
    expect(rendered).toMatch(/## Lesarrettleiing\n\n\| Kriterium \| Kvar i mappa \| Vedlegg \|/);
    expect(benchRender().attachments).toBe(3);
  });
});
