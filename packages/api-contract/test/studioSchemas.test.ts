/**
 * Tests the studio's answer shapes: phases and texts in three languages, the guide's closed node tree with its safe
 * links, and the pattern cards and pages.
 *
 * Spec: PED-001, PED-002, PED-010
 */
import { describe, expect, it } from 'vitest';
import {
  guideBlockNodeSchema,
  guideHrefSchema,
  guideInlineNodeSchema,
  guideSchema,
  patternDetailSchema,
  patternSummarySchema,
  studioOverviewSchema,
} from '../src/index.js';

const text = (nn: string) => ({ nn, nb: `${nn} (nb)`, en: `${nn} (en)` });
const phase = (key: string, order: number) => ({
  key,
  order,
  label: text(key),
  description: text('Skildring.'),
  purpose: text('Føremål.'),
  canvasPlacement: text('I modulen.'),
});
const card = {
  id: 'fa-video',
  phases: ['forarbeid'],
  contentTypes: ['H5P.InteractiveVideo'],
  name: text('Kort video med kontrollspørsmål'),
  purpose: text('Segmenter og hent fram.'),
  buildMinutes: 30,
  available: true,
};
const words = (value: string) => [{ type: 'text', value }];
const paragraph = { type: 'paragraph', children: words('Tekst.') };

describe('[PED-001] phases and the overview', () => {
  it('[PED-001] an overview holds the three phases with texts in nn, nb and en, and refuses a missing language', () => {
    // Arrange
    const overview = {
      status: 'proposed',
      anchor: { label: text('Samling'), description: text('Den synkrone økta.') },
      phases: [phase('forarbeid', 1), phase('underveis', 2), phase('etterarbeid', 3)],
      patterns: [card],
    };
    const noEnglish = { ...overview, phases: [{ ...phase('forarbeid', 1), label: { nn: 'F', nb: 'F' } }] };
    // Act and assert
    expect(studioOverviewSchema.safeParse(overview).success).toBe(true);
    expect(studioOverviewSchema.safeParse(noEnglish).success).toBe(false);
    expect(studioOverviewSchema.safeParse({ ...overview, phases: overview.phases.slice(0, 2) }).success).toBe(
      false,
    );
    const renamed = [phase('samling', 1), phase('underveis', 2), phase('etterarbeid', 3)];
    expect(studioOverviewSchema.safeParse({ ...overview, phases: renamed }).success).toBe(false);
    const twice = [phase('forarbeid', 1), phase('forarbeid', 2), phase('etterarbeid', 3)];
    expect(studioOverviewSchema.safeParse({ ...overview, phases: twice }).success).toBe(false);
    expect(studioOverviewSchema.safeParse({ ...overview, status: 'draft' }).success).toBe(false);
  });
});

describe('[PED-002] the guide’s closed node tree', () => {
  it('[PED-002] every allowed node type parses, nested as the guide uses them', () => {
    // Arrange
    const nodes = [
      { type: 'heading', level: 2, children: words('Segmenter og hent fram') },
      {
        type: 'paragraph',
        children: [
          { type: 'strong', children: [{ type: 'emphasis', children: words('Kort') }] },
          {
            type: 'link',
            href: 'https://www.hvl.no/alu',
            children: [{ type: 'strong', children: words('ALU') }],
          },
          { type: 'citation', key: 'guo2014' },
        ],
      },
      { type: 'list', ordered: false, items: [{ type: 'listItem', children: [paragraph] }] },
      {
        type: 'box',
        children: [
          paragraph,
          { type: 'list', ordered: true, items: [{ type: 'listItem', children: [paragraph] }] },
        ],
      },
      { type: 'marker', name: 'phase-matrix' },
    ];
    // Act
    const guide = guideSchema.safeParse({ locale: 'nn', status: 'proposed', nodes, references: [] });
    // Assert
    expect(guide.success).toBe(true);
  });

  it('[PED-002] a guide with no nodes and no references is the answer while no guide is written yet', () => {
    const empty = { locale: 'nb', status: 'proposed', nodes: [], references: [] };
    expect(guideSchema.safeParse(empty).success).toBe(true);
    expect(guideSchema.safeParse({ ...empty, locale: 'se' }).success).toBe(false);
  });

  it('[PED-002] refuses unknown nodes and fields, h1 and h4, empty text, unknown markers and boxes in boxes', () => {
    // Arrange
    const refused = [
      { type: 'html', value: '<script>alert(1)</script>' },
      { type: 'image', src: 'https://x.no/a.png' },
      { type: 'heading', level: 1, children: words('Tittel') },
      { type: 'heading', level: 4, children: words('Djupt') },
      { type: 'paragraph', children: words('') },
      { type: 'paragraph', children: words('x'), html: '<b>x</b>' },
      { type: 'marker', name: 'insight' },
      { type: 'box', children: [{ type: 'box', children: [paragraph] }] },
      { type: 'list', ordered: false, items: [] },
    ];
    // Act and assert
    for (const node of refused)
      expect(guideBlockNodeSchema.safeParse(node).success, JSON.stringify(node)).toBe(false);
  });

  it('[PED-002] a link holds neither a link nor a citation', () => {
    const link = (children: unknown[]) => ({ type: 'link', href: '/laeringsdesign', children });
    expect(guideInlineNodeSchema.safeParse(link(words('Studio'))).success).toBe(true);
    expect(guideInlineNodeSchema.safeParse(link([link(words('x'))])).success).toBe(false);
    expect(guideInlineNodeSchema.safeParse(link([{ type: 'citation', key: 'guo2014' }])).success).toBe(false);
  });

  it.each([
    ['https://www.hvl.no/alu', true],
    ['HTTPS://www.hvl.no', true],
    ['mailto:alu@hvl.no', true],
    ['/laeringsdesign/monster/fa-video', true],
    ['/', true],
    ['http://www.hvl.no', false],
    ['javascript:alert(1)', false],
    ['data:text/html,x', false],
    ['//evil.example', false],
    ['/\\evil.example', false],
    ['laeringsdesign', false],
    ['https://a.no/x y', false],
  ])('[PED-002] the link target %s is allowed: %s', (href, allowed) => {
    expect(guideHrefSchema.safeParse(href).success).toBe(allowed);
  });
});

describe('[PED-010] pattern cards and pages', () => {
  it('[PED-010] a card has one or two phases and content types from the ten, and a build time of 1–600 minutes', () => {
    // Act and assert
    expect(patternSummarySchema.safeParse(card).success).toBe(true);
    expect(patternSummarySchema.safeParse({ ...card, phases: ['forarbeid', 'etterarbeid'] }).success).toBe(
      true,
    );
    const terms = { ...card, contentTypes: ['H5P.DragText', 'H5P.Blanks'] };
    expect(patternSummarySchema.safeParse(terms).success).toBe(true);
    for (const wrong of [
      { contentTypes: ['H5P.DragQuestion'] },
      { contentTypes: [] },
      { contentTypes: ['H5P.Blanks', 'H5P.Blanks'] },
      { phases: ['samling'] },
      { phases: ['forarbeid', 'forarbeid'] },
      { buildMinutes: 0 },
      { id: 'Fa_Video' },
    ]) {
      expect(patternSummarySchema.safeParse({ ...card, ...wrong }).success, JSON.stringify(wrong)).toBe(
        false,
      );
    }
  });

  it('[PED-010] a page adds when to use, why it works with citations, an example, student minutes and references', () => {
    // Arrange
    const whyItWorks = {
      nn: [paragraph],
      nb: [paragraph],
      en: [{ type: 'paragraph', children: [{ type: 'citation', key: 'guo2014' }] }],
    };
    const page = {
      ...card,
      whenToUse: text('Før ei samling.'),
      whyItWorks,
      example: text('Ein video om blodtrykk.'),
      studentMinutes: 15,
      references: [
        { key: 'guo2014', text: 'Guo, P. J., Kim, J. & Rubin, R. (2014). L@S ’14.', verify: true },
      ],
    };
    // Act and assert
    expect(patternDetailSchema.safeParse(page).success).toBe(true);
    expect(patternDetailSchema.safeParse({ ...page, whyItWorks: { ...whyItWorks, en: [] } }).success).toBe(
      false,
    );
    expect(patternDetailSchema.safeParse({ ...page, studentMinutes: 601 }).success).toBe(false);
  });
});
