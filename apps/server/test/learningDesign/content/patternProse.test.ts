/**
 * Tests for a pattern's "why it works" as the guide's prose nodes (D-083): the fixture pattern's text builds into a
 * paragraph with its citation in every language, and a heading, raw HTML or an unsafe link in one language's text
 * stops the pattern loader with the file, the YAML line and key, and the line inside the text.
 *
 * Spec: PED-010, PED-002
 */
import { guideProseNodeSchema } from '@hvl-interaktiv/api-contract';
import { afterAll, describe, expect, it } from 'vitest';
import { patternProseNodes } from '../../../src/learningDesign/content/patternProse.js';
import {
  editedPatternFixture,
  FIXTURE_PATTERN_DIR,
  fixturePatterns,
  loadFixturePatterns,
  removePatternFixtureCopies,
} from '../../support/fixturePattern.js';

const YAML = `${FIXTURE_PATTERN_DIR}/pattern.yaml`;

afterAll(removePatternFixtureCopies);

describe('[PED-010] why a pattern works, as prose nodes', () => {
  it('[PED-010] builds each language of the fixture pattern’s text into a paragraph that holds its citation', () => {
    // Arrange
    const [pattern] = fixturePatterns().patterns;
    if (!pattern) throw new Error('fixture missing');
    // Act
    const nodes = (['nn', 'nb', 'en'] as const).map((language) =>
      patternProseNodes(pattern.whyItWorks[language]),
    );
    // Assert
    for (const prose of nodes) {
      expect(prose.map((node) => node.type)).toEqual(['paragraph']);
      expect(JSON.stringify(prose)).toContain('{"type":"citation","key":"fixture2026"}');
      for (const node of prose) expect(guideProseNodeSchema.safeParse(node).success).toBe(true);
    }
  });

  it('[PED-010] stops the loader on a heading, raw HTML or an unsafe link, at the text’s key and line', () => {
    // Arrange
    const edit = (text: string) =>
      text
        .replace(/ {2}nb: >-\n.*\n/, '  nb: |-\n    ## Overskrift\n    Tekst [@fixture2026].\n')
        .replace(/ {2}en: >-\n.*\n/, '  en: >-\n    See <b>this</b> [here](http://x.no) [@fixture2026].\n');
    // Act
    const loaded = loadFixturePatterns(editedPatternFixture({ [YAML]: edit }));
    // Assert
    expect(loaded.ok).toBe(false);
    const problems = loaded.ok ? [] : loaded.problems.filter(({ key }) => key?.startsWith('whyItWorks'));
    expect(problems).toEqual([
      expect.objectContaining({
        key: 'whyItWorks.nb',
        line: 29,
        message: expect.stringMatching(
          /^line 1 of the text holds a heading; this text holds paragraphs and lists only/,
        ),
      }),
      expect.objectContaining({
        key: 'whyItWorks.en',
        line: 32,
        message: expect.stringMatching(/holds HTML/),
      }),
      expect.objectContaining({
        key: 'whyItWorks.en',
        line: 32,
        message: expect.stringMatching(/holds HTML/),
      }),
      expect.objectContaining({
        key: 'whyItWorks.en',
        message: expect.stringMatching(/use an https: address/),
      }),
    ]);
  });
});
