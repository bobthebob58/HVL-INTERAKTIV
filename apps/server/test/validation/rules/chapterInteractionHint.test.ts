/**
 * Tests for PED-H10 (chapterInteractionHint): add a check to long chapters. Each fixture in apps/server/test/fixtures/content/PED-H10/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: PED-020
 */
import { describe, expect, it } from 'vitest';
import { chapterInteractionHint } from '../../../src/validation/rules/chapterInteractionHint.js';
import { walkContent } from '../../../src/validation/contentWalker.js';
import { fixturesOf, hitsOf, TEST_CONTEXT } from '../support/ruleFixtures.js';

describe('PED-H10', () => {
  it.each(fixturesOf('PED-H10'))('[PED-020][PED-H10] $name: $description', (fixture) => {
    expect(hitsOf(chapterInteractionHint, fixture)).toEqual(fixture.expected);
  });

  const text = (words: number) => ({
    content: { library: 'H5P.AdvancedText 1.1', params: { text: `<p>${'ord '.repeat(words)}</p>` } },
  });
  const task = { content: { library: 'H5P.MultiChoice 1.16', params: { question: 'Kva?' } } };
  const chapter = (...content: object[]) => ({ library: 'H5P.Column 1.18', params: { content } });
  const hitsFor = (chapters: object[]) =>
    chapterInteractionHint
      .check({
        nodes: walkContent('H5P.InteractiveBook 1.15', { chapters }),
        metadata: {},
        context: TEST_CONTEXT,
      })
      .map((hit) => [hit.path, hit.values?.count]);

  it('[PED-020][PED-H10] each chapter is judged by its own words and tasks, whatever its neighbours hold', () => {
    // Arrange: long without a task, long with a task, short, long in two texts, and an entry that is no chapter
    const chapters = [
      chapter(text(1600)),
      chapter(text(1600), task),
      chapter(text(200)),
      chapter(text(900), text(700)),
      { notAChapter: true },
      chapter(text(1501)),
    ];
    // Act
    const hits = hitsFor(chapters);
    // Assert
    expect(hits).toEqual([
      ['chapters[0]', 1600],
      ['chapters[3]', 1600],
      ['chapters[5]', 1501],
    ]);
  });

  it('[PED-020][PED-H10] a book with very many chapters is judged in time that follows its size', () => {
    // Arrange: 4 000 chapters of three short texts each, and one long chapter at the end
    const chapters = [
      ...Array.from({ length: 4000 }, () => chapter(text(5), text(5), text(5))),
      chapter(text(1600)),
    ];
    const nodes = walkContent('H5P.InteractiveBook 1.15', { chapters });
    // Act
    const started = performance.now();
    const hits = chapterInteractionHint.check({ nodes, metadata: {}, context: TEST_CONTEXT });
    const elapsed = performance.now() - started;
    // Assert
    expect(hits.map((hit) => hit.path)).toEqual(['chapters[4000]']);
    expect(elapsed).toBeLessThan(500);
  });
});
