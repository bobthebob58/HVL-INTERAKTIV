/**
 * Tests that the repository's own pedagogisk mappe (`content/mappe/`, ALU's drafts) renders in Nynorsk, Bokmål and
 * English with the structure the renderer promises: a reader's guide with one row per criterion of the default set,
 * a Del 1 word count without the reader's guide and the references, the same headings and suggested attachments in
 * every language, and no tag, HTML or empty heading left over. The tests read the loaded criteria and never assert
 * ALU's texts, labels or counts (D-082, Q17).
 *
 * Spec: MAPPE-002, PROD-012
 */
import { DEFAULT_CRITERIA_SET } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../../../src/i18n/translate.js';
import { deepFreeze } from '../../../src/learningDesign/content/deepFreeze.js';
import {
  loadStudioContent,
  type StudioContent,
} from '../../../src/learningDesign/content/loadStudioContent.js';
import type { MappeCriteriaSet } from '../../../src/learningDesign/content/mappeContent.js';
import { citedReferences } from '../../../src/learningDesign/content/patternAccessors.js';
import { mappeHeadings, readersGuideRows, templateLeftovers } from './mappeMarkdownFacts.js';
import { benchRender, sourceActivity, type BenchActivity } from './mappeRenderBench.js';

const content = loadStudioContent();
const set = content.mappe.portfolio?.criteriaSets.find(({ id }) => id === DEFAULT_CRITERIA_SET);
// WHY: a pattern that cites references, so the references block really has words for the count to leave out.
const citingPattern = content.patterns.patterns.find(
  (pattern) => citedReferences(pattern, content.references).length > 0,
);
const patternId = citingPattern?.id;

/** Two activities like a teacher's: one from a pattern, on a course and in a phase, and one with nothing filled in. */
const activities = (fromPattern = true): BenchActivity[] => [
  {
    activity: sourceActivity({
      courseCode: 'SYK110',
      phase: content.phases.phases[0]?.key,
      ...(fromPattern && patternId ? { patternId } : {}),
      collaborative: true,
      outcomes: [{ text: 'Forklare blodtrykk', category: 'kunnskap' }],
      rationale: 'Studentane ser videoen før samlinga.',
    }),
  },
  {
    activity: sourceActivity({
      id: '0192f0c4-0000-7000-8000-000000000002',
      title: 'Åtte spørsmål',
      status: 'draft',
    }),
  },
];

/** The content with every criterion text of the default set made longer in every language. */
function withLongerCriteria(base: StudioContent, extra: string): StudioContent {
  const portfolio = base.mappe.portfolio;
  if (!portfolio) throw new Error('the real content has no mappe');
  const longer = (criteriaSet: MappeCriteriaSet): MappeCriteriaSet => ({
    ...criteriaSet,
    criteria: criteriaSet.criteria.map((criterion) => ({
      ...criterion,
      text: Object.fromEntries(
        LOCALES.map((locale) => [locale, `${criterion.text[locale]} ${extra}`]),
      ) as MappeCriteriaSet['criteria'][number]['text'],
    })),
  });
  return deepFreeze({
    ...base,
    mappe: { portfolio: { ...portfolio, criteriaSets: portfolio.criteriaSets.map(longer) } },
  });
}

describe('[MAPPE-002] the repository’s own pedagogisk mappe', () => {
  it('[MAPPE-002] loads its template in nn, nb and en, the default criteria set with its limits, and a citing pattern', () => {
    // Assert
    expect(Object.keys(content.mappe.portfolio?.templates ?? {}).sort()).toEqual(['en', 'nb', 'nn']);
    expect(set?.criteria.length).toBeGreaterThan(0);
    expect(set?.limits.del1Words.value).toBeGreaterThan(0);
    expect(set?.limits.attachments.value).toBeGreaterThan(0);
    expect(citingPattern).toBeDefined();
  });

  it.each(LOCALES)(
    '[MAPPE-002] in %s, the reader’s guide has one row per criterion of the default set, in order',
    (locale) => {
      // Act
      const rendered = benchRender({ content, locale, set: DEFAULT_CRITERIA_SET, activities: activities() });
      // Assert
      const rows = readersGuideRows(rendered.markdown, locale) ?? [];
      expect(rows.map((row) => row[0]?.split(' ')[0])).toEqual(set?.criteria.map(({ id }) => id));
      expect(rows.every((row) => row.length === 3 && row.every((cell) => cell.trim() !== ''))).toBe(true);
    },
  );

  it.each(LOCALES)(
    '[MAPPE-002] in %s, the Del 1 word count leaves out the reader’s guide and the references',
    (locale) => {
      // Arrange
      const longer = withLongerCriteria(content, 'ein to tre fire fem seks sju åtte ni ti');
      // Act
      const plain = benchRender({ content, locale, activities: activities(false) });
      const withBlocks = benchRender({ content: longer, locale, activities: activities(true) });
      // Assert
      expect(withBlocks.markdown.length).toBeGreaterThan(plain.markdown.length);
      expect(withBlocks.markdown).toContain('ein to tre fire fem seks sju åtte ni ti');
      expect(plain.words).toBeGreaterThan(0);
      expect(withBlocks.words).toBe(plain.words);
    },
  );

  it('[PROD-012] the three languages have the same headings by level and the same suggested attachments, within the limit', () => {
    // Act
    const rendered = LOCALES.map((locale) => benchRender({ content, locale, activities: activities() }));
    // Assert
    const levels = rendered.map(({ markdown }) => mappeHeadings(markdown).map(({ level }) => level));
    expect(levels[1]).toEqual(levels[0]);
    expect(levels[2]).toEqual(levels[0]);
    expect(levels[0]?.filter((level) => level === 1).length).toBeGreaterThan(0);
    const attachments = rendered.map((render) => render.attachments);
    expect(new Set(attachments).size).toBe(1);
    expect(attachments[0]).toBeGreaterThan(0);
    expect(attachments[0]).toBeLessThanOrEqual(set?.limits.attachments.value ?? 0);
  });

  it.each(LOCALES)(
    '[MAPPE-002] in %s, every tag is filled in: no tag, HTML or empty heading is left',
    (locale) => {
      // Act
      const rendered = benchRender({ content, locale, activities: activities() });
      // Assert
      expect(templateLeftovers(rendered.markdown)).toEqual([]);
      expect(mappeHeadings(rendered.markdown).map(({ text }) => text)).toEqual(
        expect.arrayContaining(['Blåbærquiz', 'Åtte spørsmål']),
      );
    },
  );
});
