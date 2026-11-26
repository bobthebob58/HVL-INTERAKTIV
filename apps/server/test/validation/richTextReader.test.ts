/**
 * Tests that one validation run parses each distinct text once (D-127): the walk and all rules read through the
 * run's reader on every fixture activity, no rule parses text itself, and a reader keeps nothing between runs.
 *
 * Spec: UD-020
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseRichText, richTextReader } from '../../src/validation/richText.js';
import { ruleScope } from '../../src/validation/rule.js';
import { RULES } from '../../src/validation/ruleSet.js';
import { contextOf, fixtureRuleIds, fixturesOf } from './support/ruleFixtures.js';

const RULES_DIR = fileURLToPath(new URL('../../src/validation/rules', import.meta.url));
const fixtures = fixtureRuleIds().flatMap((ruleId) =>
  fixturesOf(ruleId).map((fixture) => [`${ruleId}/${fixture.name}`, fixture] as const),
);
/** A reader that notes how often each text is parsed. */
function counting() {
  const parses = new Map<string, number>();
  const read = richTextReader((html) => {
    parses.set(html, (parses.get(html) ?? 0) + 1);
    return parseRichText(html);
  });
  return { parses, read };
}

describe('[UD-020] each text is parsed once per validation run', () => {
  it('[UD-020] finds the fixture activities to run', () => {
    expect(fixtures.length).toBeGreaterThan(60);
  });

  it.each(fixtures)('[UD-020] %s: the walk and all rules together parse no text twice', (_name, fixture) => {
    // Arrange
    const { parses, read } = counting();
    // Act
    const scope = ruleScope(fixture, contextOf(fixture), read);
    for (const rule of RULES) rule.check(scope);
    // Assert
    expect(Math.max(0, ...parses.values())).toBeLessThanOrEqual(1);
  });

  it('[UD-020] a text several rules read is parsed once: a chapter text with a link, counted and judged', () => {
    // Arrange: read by the walk, by V-LINK-TEXT, V-HEADING-ORDER, V-TABLE-HEADERS, PED-H10 and V-PLACEHOLDER
    const text = `<h2>Celler</h2><p>${'ord '.repeat(1600)}<a href="https://hvl.no">her</a></p>`;
    const column = {
      library: 'H5P.Column 1.18',
      params: { content: [{ content: { library: 'H5P.AdvancedText 1.1', params: { text } } }] },
    };
    const input = { mainLibrary: 'H5P.InteractiveBook 1.15', params: { chapters: [column] }, metadata: {} };
    const { parses, read } = counting();
    const [fixture] = fixturesOf('PED-H10');
    // Act
    const scope = ruleScope(input, contextOf(fixture as never), read);
    const hits = RULES.flatMap((rule) => rule.check(scope).map((hit) => hit.message));
    // Assert
    expect(hits).toEqual(expect.arrayContaining(['V-LINK-TEXT.vague', 'PED-H10.tooManyWords']));
    expect(parses.get(text)).toBe(1);
  });

  it('[UD-020] no rule parses text itself: every rule reads through its scope', () => {
    // Arrange
    const sources = readdirSync(RULES_DIR).map(
      (file) => [file, readFileSync(join(RULES_DIR, file), 'utf8')] as const,
    );
    // Act
    const parsing = sources.filter(([, source]) => /\b(?:plainTextOf|parseRichText)\(/.test(source));
    // Assert
    expect(sources.length).toBeGreaterThan(20);
    expect(parsing.map(([file]) => file)).toEqual([]);
  });

  it('[UD-020] a reader keeps what it read for its own run only', () => {
    // Arrange
    const first = counting();
    const second = counting();
    // Act
    const same = [first.read('<p>Hei</p>'), first.read('<p>Hei</p>'), second.read('<p>Hei</p>')];
    // Assert
    expect(same[0]).toBe(same[1]);
    expect(same[0]).toEqual(same[2]);
    expect([first.parses.get('<p>Hei</p>'), second.parses.get('<p>Hei</p>')]).toEqual([1, 1]);
  });
});
