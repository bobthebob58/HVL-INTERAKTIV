/**
 * chapterInteractionHint (PED-H10) — an InteractiveBook chapter has more than
 * `maxChapterWordsWithoutInteraction` (1 500) words and no learner task.
 *
 * Why: a check per chapter turns reading into retrieval practice, which strengthens long-term retention
 *      (Roediger & Karpicke 2006).
 * Spec: PED-020
 * Invariants:
 *   - A chapter is one item of `chapters` (an H5P.Column). Its words are those of every reading-text node inside
 *     it, at any depth (also in an Accordion); its tasks are learner tasks at any depth (../contentKinds.ts).
 *   - One hint per chapter, at `chapters[n]`.
 *   - One pass over the nodes of a book tallies all its chapters.
 * Collaborators: ../contentWalker.ts (the nodes, in pre-order), ../contentPath.ts, ../contentKinds.ts,
 *   ../richText.ts, ../hintThresholds.ts.
 * Tests: apps/server/test/validation/rules/chapterInteractionHint.test.ts
 */
import { isLearnerTask, READING_TEXT_LIBRARIES } from '../contentKinds.js';
import { isWithin, pathOf } from '../contentPath.js';
import { thresholdOf } from '../hintThresholds.js';
import { asArray, asString, fieldAt } from '../paramReaders.js';
import { countWords, plainTextOf } from '../richText.js';
import type { RuleHit, ValidationRule } from '../rule.js';

/** What one chapter holds: whether a learner task, and the words of its reading texts. */
interface ChapterTally {
  task: boolean;
  words: number;
}

/**
 * The chapter a node of a book lies in.
 * @param nodePath - The node's path.
 * @param chaptersPath - The path of the book's `chapters` list.
 * @returns The index when the node is at or below `chapters[n].params`, else undefined.
 */
function chapterOf(nodePath: string, chaptersPath: string): number | undefined {
  if (!nodePath.startsWith(`${chaptersPath}[`)) return undefined;
  const close = nodePath.indexOf(']', chaptersPath.length);
  const index = nodePath.slice(chaptersPath.length + 1, close);
  const inChapter = isWithin(nodePath.slice(close + 1), '.params');
  return inChapter && /^\d+$/.test(index) ? Number(index) : undefined;
}

/** PED-H10: add a check to long chapters. */
export const chapterInteractionHint: ValidationRule = {
  id: 'PED-H10',
  requirement: 'PED-020',
  severity: 'hint',
  messages: ['PED-H10.tooManyWords'],
  check(scope) {
    // PEDAGOGY: 1 500 words by default; a check per chapter (Roediger & Karpicke 2006).
    const max = thresholdOf(scope.context, 'maxChapterWordsWithoutInteraction');
    const hits: RuleHit[] = [];
    scope.nodes.forEach((book, at) => {
      if (book.machineName !== 'H5P.InteractiveBook') return;
      const chaptersPath = pathOf(book.path, 'chapters');
      const tallies = asArray(fieldAt(book.params, 'chapters')).map((): ChapterTally => ({
        task: false,
        words: 0,
      }));
      // WHY: nodes come in pre-order, so what a book holds follows it without a gap; one pass tallies every
      // chapter, where a pass per chapter cost chapters times nodes (D-127).
      for (let next = at + 1; next < scope.nodes.length; next += 1) {
        const node = scope.nodes[next];
        if (!node || !isWithin(node.path, book.path)) break;
        const tally = tallies[chapterOf(node.path, chaptersPath) ?? -1];
        if (!tally) continue;
        if (isLearnerTask(node.machineName)) tally.task = true;
        else if (node.machineName !== undefined && READING_TEXT_LIBRARIES.has(node.machineName))
          tally.words += countWords(plainTextOf(asString(fieldAt(node.params, 'text')) ?? ''));
      }
      tallies.forEach(({ task, words: count }, index) => {
        if (task || count <= max) return;
        const path = pathOf(chaptersPath, index);
        hits.push({ path, message: 'PED-H10.tooManyWords', values: { count, max } });
      });
    });
    return hits;
  },
};
