/**
 * Tests that the repository's own guide (`content/laeringsdesign/guide.{nn,nb,en}.md`) loads as the server loads it:
 * in nn, nb and en, with both markers, in PED-002's order told by its heading structure (the `##` sections, the three
 * mechanisms as `###` each with its own box, the two markers, the links at the end), and with every citation resolved
 * to a reference, and served by the guide route as the API contract says. The guide is ALU's draft (open question
 * Q17), so no test reads its texts or its addresses: rewording it breaks nothing here; only moving away from PED-002's
 * structure does.
 *
 * Spec: PED-002, PED-001
 */
import { guideSchema, type GuideBlockNode } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import { describeGuideContent } from '../../../src/learningDesign/content/guideContent.js';
import { loadStudioContent } from '../../../src/learningDesign/content/loadStudioContent.js';
import { guideAnswer } from '../../../src/learningDesign/http/studioContentAnswers.js';

/** Any node of the tree, read only for its type, its link target and its citation key. */
interface TreeNode {
  readonly type: string;
  readonly href?: string;
  readonly key?: string;
  readonly children?: readonly TreeNode[];
  readonly items?: readonly TreeNode[];
}

/** One `##` section of the guide, by its structure only. */
interface SectionShape {
  readonly subheadings: number;
  readonly boxes: number;
  readonly markers: readonly string[];
}

const descendants = (nodes: readonly TreeNode[]): TreeNode[] =>
  nodes.flatMap((node) => [node, ...descendants([...(node.children ?? []), ...(node.items ?? [])])]);

/** The guide's top-level nodes split at each `##` heading; nodes before the first one form no section. */
const sectionsOf = (nodes: readonly GuideBlockNode[]): GuideBlockNode[][] =>
  nodes.reduce<GuideBlockNode[][]>((sections, node) => {
    if (node.type === 'heading' && node.level === 2) sections.push([]);
    sections.at(-1)?.push(node);
    return sections;
  }, []);

const shapeOf = (section: readonly GuideBlockNode[]): SectionShape => ({
  subheadings: section.filter((node) => node.type === 'heading' && node.level === 3).length,
  boxes: section.filter((node) => node.type === 'box').length,
  markers: section.flatMap((node) => (node.type === 'marker' ? [node.name] : [])),
});

const httpsLinksIn = (section: readonly GuideBlockNode[] = []): number =>
  descendants(section).filter((node) => node.type === 'link' && /^https:/i.test(node.href ?? '')).length;

const content = loadStudioContent();
const documents = Object.entries(content.guide.documents ?? {});

describe('[PED-002] the guide in content/laeringsdesign/', () => {
  it('[PED-002] loads in nn, nb and en, which the content check reports and the guide route serves', () => {
    // Act
    const languages = documents.map(([language]) => language);
    const served = (['nn', 'nb', 'en'] as const).map((locale) =>
      guideSchema.safeParse(guideAnswer(content, locale)),
    );
    // Assert
    expect(languages).toEqual(['nn', 'nb', 'en']);
    expect(served.map((answer) => answer.success)).toEqual([true, true, true]);
    expect(describeGuideContent(content.guide)).toMatch(
      /^guide in nn, nb and en \(\d+ sections, \d+ citations\)$/,
    );
  });

  it('[PED-002] places the phase matrix, then the catalogue, each once, with no heading of its own before it', () => {
    for (const [language, { nodes }] of documents) {
      // Act
      const markers = nodes.flatMap((node, at) => (node.type === 'marker' ? [{ name: node.name, at }] : []));
      // Assert
      expect(
        markers.map(({ name }) => name),
        language,
      ).toEqual(['phase-matrix', 'pattern-catalogue']);
      for (const { at } of markers) expect(nodes[at - 1]?.type, language).not.toBe('heading');
    }
  });

  it('[PED-002] follows PED-002 order: why, the model, three mechanisms with a box each, the matrix and catalogue, links', () => {
    for (const [language, { nodes }] of documents) {
      // Act
      const sections = sectionsOf(nodes);
      // WHY: in the mechanisms' section, after its own ## heading, only the ### headings and the boxes count.
      const mechanisms = (sections[2] ?? []).slice(1).flatMap((node) => {
        if (node.type === 'heading') return [`h${node.level}`];
        return node.type === 'box' ? ['box'] : [];
      });
      // Assert: the guide starts at its first ## section, and each mechanism's box follows its own ### heading
      expect(nodes[0], language).toMatchObject({ type: 'heading', level: 2 });
      expect(sections.map(shapeOf), language).toEqual([
        { subheadings: 0, boxes: 0, markers: [] },
        { subheadings: 0, boxes: 0, markers: [] },
        { subheadings: 3, boxes: 3, markers: [] },
        { subheadings: 0, boxes: 0, markers: ['phase-matrix', 'pattern-catalogue'] },
        { subheadings: 0, boxes: 0, markers: [] },
      ]);
      // WHY: the last section links to ALU's support and to the Emnedesign module (UPED854).
      expect(httpsLinksIn(sections.at(-1)), language).toBeGreaterThanOrEqual(2);
      expect(mechanisms, language).toEqual(['h3', 'box', 'h3', 'box', 'h3', 'box']);
    }
  });

  it('[PED-002] cites Møgelvang & Isaksen (2025) on the model, and resolves every citation to one reference', () => {
    // Arrange
    const known = new Map(content.references.references.map((reference) => [reference.key, reference]));
    for (const [language, document] of documents) {
      // Act
      const cited = descendants(document.nodes).flatMap((node) =>
        node.type === 'citation' ? [node.key] : [],
      );
      const onTheModel = descendants(sectionsOf(document.nodes)[1] ?? []).filter(
        (node) => node.type === 'citation',
      );
      // Assert
      expect(
        onTheModel.map((node) => node.key),
        language,
      ).toContain('mogelvang2025');
      expect(
        cited.filter((key) => !known.has(key ?? '')),
        language,
      ).toEqual([]);
      expect(
        document.references.map((reference) => reference.key),
        language,
      ).toEqual([...new Set(cited)]);
      expect(
        document.references.every((reference) => reference.text.length > 0),
        language,
      ).toBe(true);
    }
  });
});
