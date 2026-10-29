/**
 * Tests for V-PLACEHOLDER (placeholderRule): pattern guidance `⟦…⟧` left in an activity, and a required video or
 * background image that is missing. Each fixture in apps/server/test/fixtures/content/V-PLACEHOLDER/ is a whole
 * activity with exactly the hits it must give; the cases below pin how a string is read (D-086 amendment, probe P6).
 *
 * Spec: PROD-001, UD-020
 */
import { describe, expect, it } from 'vitest';
import { walkContent } from '../../../src/validation/contentWalker.js';
import { guidanceExcerpt, guidanceFields } from '../../../src/validation/guidanceMarkers.js';
import { placeholderRule } from '../../../src/validation/rules/placeholderRule.js';
import { validateContent } from '../../../src/validation/validateContent.js';
import { fixturesOf, hitsOf, TEST_CONTEXT } from '../support/ruleFixtures.js';

const hitsFor = (mainLibrary: string, params: unknown, title = 'Quiz') =>
  placeholderRule
    .check({ nodes: walkContent(mainLibrary, params), metadata: { title }, context: TEST_CONTEXT })
    .map((hit) => hit.path);

describe('V-PLACEHOLDER', () => {
  it.each(fixturesOf('V-PLACEHOLDER'))('[PROD-001][V-PLACEHOLDER] $name: $description', (fixture) => {
    expect(hitsOf(placeholderRule, fixture)).toEqual(fixture.expected);
  });

  it.each([
    ['a raw marker', '⟦Skriv⟧'],
    ['a zero-padded reference without a semicolon', '&#010214;Skriv&#10215'],
    ['a hexadecimal reference', '&#x27e6;Skriv&#x27E7;'],
    ['a named reference', '&LeftDoubleBracket;Skriv&RightDoubleBracket;'],
    ['a marker split by a tag', '⟦<strong>Rett</strong> svar⟧'],
    ['a lone opening mark', '⟦Skriv spørsmålet her'],
  ])('[PROD-001][V-PLACEHOLDER] reports %s', (_, text) => {
    expect(hitsFor('H5P.MultiChoice 1.16', { question: text })).toEqual(['question']);
  });

  it.each([
    ['the literal text of a reference, as an author writes it', '&amp;#10214;Skriv&amp;#10215;'],
    ['white square brackets of another script', '〚Skriv〛'],
    ['ordinary brackets', '[Skriv] (her) {no}'],
  ])('[PROD-001][V-PLACEHOLDER] does not report %s, because references are decoded once', (_, text) => {
    expect(hitsFor('H5P.MultiChoice 1.16', { question: text })).toEqual([]);
  });

  it('[PROD-001][V-PLACEHOLDER] reads the label groups the shared walker skips, and every sub-content title', () => {
    // Arrange
    const params = {
      l10n: { play: '⟦Spel av⟧' },
      texts: { next: '⟦Neste⟧' },
      a11y: { check: '⟦Sjekk⟧' },
      confirmCheck: { header: '⟦Ferdig?⟧' },
      confirmRetry: { header: '⟦Prøv igjen?⟧' },
      chapters: [{ library: 'H5P.Column 1.22', params: {}, metadata: { title: '⟦Kapittel 1⟧' } }],
    };
    // Act
    const paths = hitsFor('H5P.InteractiveBook 1.15', params);
    // Assert
    expect(paths).toEqual([
      'l10n.play',
      'texts.next',
      'a11y.check',
      'confirmCheck.header',
      'confirmRetry.header',
      'chapters[0].metadata.title',
    ]);
  });

  it.each([
    ['nn', '«Skriv kva studenten skal fylle inn»'],
    ['nb', '«Skriv kva studenten skal fylle inn»'],
    ['en', '“Skriv kva studenten skal fylle inn”'],
  ] as const)('[PROD-001][V-PLACEHOLDER] is an error that quotes the guidance, in %s', (locale, quoted) => {
    // Arrange
    const params = { text: '<p>⟦Skriv kva studenten skal fylle inn⟧</p>' };
    const metadata = { title: 'Utfylling', defaultLanguage: 'nn' };
    // Act
    const findings = validateContent(
      { mainLibrary: 'H5P.Blanks 1.14', params, metadata, locale },
      TEST_CONTEXT,
    );
    // Assert
    const [finding] = findings.filter((f) => f.ruleId === 'V-PLACEHOLDER');
    expect([finding?.severity, finding?.requirement, finding?.path]).toEqual(['error', 'PROD-001', 'text']);
    expect(finding?.message).toContain(quoted);
  });

  it('[PROD-001][V-PLACEHOLDER] shortens long guidance and quotes a field with a lone mark as it is', () => {
    expect(guidanceExcerpt(`⟦${'a'.repeat(100)}⟧`)).toBe(`${'a'.repeat(79)}…`);
    expect(guidanceExcerpt('Kva spørsmålet her⟧')).toBe('Kva spørsmålet her⟧');
  });

  it('[UD-020][V-PLACEHOLDER] never follows a cycle or nesting deeper than the limit', () => {
    // Arrange
    const cyclic: Record<string, unknown> = { text: '⟦a⟧' };
    cyclic.self = cyclic;
    let deep: unknown = '⟦deep⟧';
    for (let i = 0; i < 150; i += 1) deep = { inner: deep };
    // Act and assert
    expect(guidanceFields(cyclic, undefined).map((f) => f.path)).toEqual(['text']);
    expect(guidanceFields(deep, undefined)).toEqual([]);
  });
});
