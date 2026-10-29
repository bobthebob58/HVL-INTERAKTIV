/**
 * Tests for the public studio answers built from the loaded content (no HTTP, no services): a renamed phase label
 * reaches the overview that the phase matrix and the catalogue read; the fixture pattern appears in the overview and
 * has its own detail; the guide answer carries the fixture guide's tree and references, or nothing before a guide is
 * written; every answer has the contract's shape.
 *
 * Spec: PED-001, PED-002, PED-003, PED-011
 */
import { guideSchema, patternDetailSchema, studioOverviewSchema } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import { loadStudioContent } from '../../../src/learningDesign/content/loadStudioContent.js';
import {
  guideAnswer,
  patternDetailAnswer,
  studioOverviewAnswer,
  type PatternAvailabilityLookup,
} from '../../../src/learningDesign/http/studioContentAnswers.js';
import { FIXTURE_PATTERN_ID } from '../../support/fixturePattern.js';
import { studioContentWithFixtures } from '../../support/guideFixture.js';
import { RENAMED_FORARBEID_LABEL, studioContentWithRenamedLabel } from '../../support/renamedPhaseLabels.js';

/** Every pattern can be created, except the ones listed. */
const availableExcept = (...unavailable: string[]): PatternAvailabilityLookup => ({
  availability: async (id) => ({ available: !unavailable.includes(id), contentTypes: [] }),
});

describe('[PED-001] the studio answers', () => {
  it('[PED-001] a label renamed in phases.yaml is the label the overview gives the phase matrix and the catalogue', async () => {
    // Act
    const overview = await studioOverviewAnswer(studioContentWithRenamedLabel(), availableExcept());
    // Assert
    expect(overview.phases.map((phase) => phase.key)).toEqual(['forarbeid', 'underveis', 'etterarbeid']);
    expect(overview.phases[0]?.label).toEqual(RENAMED_FORARBEID_LABEL);
    expect(studioOverviewSchema.safeParse(overview).success).toBe(true);
  });

  it('[PED-011] a fixture pattern folder appears in the overview, with its availability, and has a detail', async () => {
    // Arrange
    const content = studioContentWithFixtures({ pattern: true });
    const creator = availableExcept(FIXTURE_PATTERN_ID);
    // Act
    const overview = await studioOverviewAnswer(content, creator);
    const detail = await patternDetailAnswer(content, creator, FIXTURE_PATTERN_ID);
    // Assert
    const card = overview.patterns.find((pattern) => pattern.id === FIXTURE_PATTERN_ID);
    expect(card).toMatchObject({ phases: ['forarbeid', 'etterarbeid'], available: false });
    expect(detail).toMatchObject({ id: FIXTURE_PATTERN_ID, available: false, studentMinutes: 10 });
    expect(detail?.references.map((reference) => reference.key)).toEqual(['fixture2026']);
    expect(JSON.stringify(detail?.whyItWorks.nb)).toContain('{"type":"citation","key":"fixture2026"}');
    expect(patternDetailSchema.safeParse(detail).success).toBe(true);
  });

  it('[PED-011] gives no detail for an unknown or malformed pattern ID', async () => {
    // Act
    const answers = await Promise.all(
      ['no-such-pattern', '../fa-video', ''].map((id) =>
        patternDetailAnswer(loadStudioContent(), availableExcept(), id),
      ),
    );
    // Assert
    expect(answers).toEqual([undefined, undefined, undefined]);
  });

  it('[PED-001] every real pattern’s card and detail have the contract’s shape', async () => {
    // Arrange
    const content = loadStudioContent();
    // Act
    const overview = await studioOverviewAnswer(content, availableExcept());
    const details = await Promise.all(
      overview.patterns.map(({ id }) => patternDetailAnswer(content, availableExcept(), id)),
    );
    // Assert: ALU writes the texts, so only the shapes are checked
    expect(studioOverviewSchema.safeParse(overview).success).toBe(true);
    for (const detail of details) expect(patternDetailSchema.safeParse(detail).success).toBe(true);
  });
});

describe('[PED-002] the guide answer', () => {
  it('[PED-002] carries the guide’s nodes and its cited references in the asked language, and the review status', () => {
    // Arrange
    const content = studioContentWithFixtures();
    // Act
    const guide = guideAnswer(content, 'en');
    // Assert
    expect(guide.locale).toBe('en');
    expect(guide.status).toBe(content.phases.status);
    expect(guide.nodes[0]).toEqual({
      type: 'heading',
      level: 2,
      children: [{ type: 'text', value: 'Fixture: why the guide exists' }],
    });
    expect(guide.references.map((reference) => reference.key)).toEqual([
      'fixture-guide2026',
      'fixture-box2026',
    ]);
    expect(guideSchema.safeParse(guide).success).toBe(true);
  });

  it('[PED-002] is empty, with no nodes and no references, while no guide is written yet', () => {
    // Arrange
    const content = { ...loadStudioContent(), guide: {} };
    // Act
    const guide = guideAnswer(content, 'nn');
    // Assert
    expect(guide).toEqual({ locale: 'nn', status: content.phases.status, nodes: [], references: [] });
    expect(guideSchema.safeParse(guide).success).toBe(true);
  });
});
