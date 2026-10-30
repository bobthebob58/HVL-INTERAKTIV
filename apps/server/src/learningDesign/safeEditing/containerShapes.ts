/**
 * containerShapes — what the container types add to the structure signature beyond the position of each child:
 * the parts of their parameters that the learner's saved state points into by number.
 *
 * Why: probe P3 (D-093) showed each container keeping its children's states and its own progress by index:
 *      CoursePresentation by slide and element (go-to-slide buttons take an element index too), BranchingScenario
 *      the path as node indices, QuestionSet by question and pool, InteractiveVideo by list position and the
 *      video's time, InteractiveBook by chapter and section. The children themselves are in the signature's node
 *      list (./structureSignature.ts); these facts cover what is not a child node. Everything else in a container's
 *      parameters (texts, settings, shuffling, backgrounds, keywords) is not structural.
 * Spec: PROD-013
 * Invariants:
 *   - CoursePresentation: per slide, one kind per element (`node` or `go-to-slide`), so the slide count, the element
 *     count and every non-node element's position count.
 *   - BranchingScenario: the node count and every `nextContentId`, the node's own (`-1` when absent, as the player
 *     sets it, h5p-branching-scenario.js:64) and each branching-question alternative's (`null` when absent).
 *   - QuestionSet: `poolSize` (0 when no pool); `randomQuestions` is not structural (questionset.js:391 shuffles only
 *     a new attempt, a resumed one keeps its saved order).
 *   - InteractiveVideo: the video's file paths, and the interactions by start time (stable, as interactive-video.js
 *     sorts them) with the end summary after them when it is shown (`hasMainSummary`, interactive-video.js:1213).
 *   - InteractiveBook: the section count of each chapter, in order; Column adds nothing.
 * Collaborators: ./subContentNodes.ts, ./leafShapes.ts (`ShapeRule`), ./nodeShapes.ts.
 * Tests: apps/server/test/learningDesign/safeEditing/containerShapes.test.ts,
 *   apps/server/test/learningDesign/safeEditing/structuralChangeRealTypes.test.ts,
 *   apps/server/test/learningDesign/safeEditing/editorRoundTrip.browser.int.test.ts
 */
import type { ShapeRule } from './leafShapes.js';
import { isObject, listOf, numberOf, objectOf } from './subContentNodes.js';

const coursePresentation: ShapeRule = (params) => ({
  facts: {
    slides: listOf(objectOf(params.presentation).slides).map((slide) =>
      // WHY: a go-to-slide button has no `action`, but takes an element index in the slide's saved answers.
      listOf(objectOf(slide).elements).map((element) =>
        isObject(objectOf(element).action) ? 'node' : 'go-to-slide',
      ),
    ),
  },
});

const nextOf = (value: unknown): number | null => numberOf(objectOf(value).nextContentId) ?? null;

// WHY: H5P's editor drops a branching-question node's own `nextContentId: -1` on every save, and the player reads a
// missing one as -1 (h5p-branching-scenario.js:64), so both are the same end and an unchanged save stays text-only.
const nodeNextOf = (node: unknown): number | null =>
  objectOf(node).nextContentId === undefined ? -1 : nextOf(node);

const branchingScenario: ShapeRule = (params) => {
  const nodes = listOf(objectOf(params.branchingScenario).content);
  return {
    facts: {
      nodes: nodes.length,
      next: nodes.map((node) => {
        const question = objectOf(objectOf(objectOf(objectOf(node).type).params).branchingQuestion);
        return { next: nodeNextOf(node), alternatives: listOf(question.alternatives).map(nextOf) };
      }),
    },
  };
};

const questionSet: ShapeRule = (params) => {
  const poolSize = numberOf(params.poolSize) ?? 0;
  return { facts: { poolSize: poolSize > 0 ? poolSize : 0 } };
};

/** The end summary is shown only when its first group has statements (interactive-video.js:1213). */
function hasMainSummary(summary: Record<string, unknown>): boolean {
  if (summary.displayAt === undefined) return false;
  const groups = listOf(objectOf(objectOf(summary.task).params).summaries);
  return listOf(objectOf(groups[0]).summary).length > 0;
}

const interactiveVideo: ShapeRule = (params) => {
  const video = objectOf(params.interactiveVideo);
  const interactions = listOf(objectOf(video.assets).interactions);
  const startOf = (index: number) => numberOf(objectOf(objectOf(interactions[index]).duration).from) ?? 0;
  // WHY: Array.prototype.sort is stable, as the player's own sort (interactive-video.js:670) relies on.
  const byStart = interactions.map((_, index) => index).sort((a, b) => startOf(a) - startOf(b));
  return {
    facts: {
      video: listOf(objectOf(video.video).files).map((file) => {
        const path = objectOf(file).path;
        return typeof path === 'string' ? path.trim() : '';
      }),
      timeline: [...byStart, ...(hasMainSummary(objectOf(video.summary)) ? ['summary'] : [])],
    },
  };
};

const interactiveBook: ShapeRule = (params) => ({
  facts: {
    chapters: listOf(params.chapters).map(
      (chapter) => listOf(objectOf(objectOf(chapter).params).content).length,
    ),
  },
});

/**
 * The container rules by machine name.
 * @spec PROD-013
 */
export const CONTAINER_SHAPE_RULES: Readonly<Record<string, ShapeRule>> = Object.freeze({
  'H5P.CoursePresentation': coursePresentation,
  'H5P.BranchingScenario': branchingScenario,
  'H5P.QuestionSet': questionSet,
  'H5P.InteractiveVideo': interactiveVideo,
  'H5P.InteractiveBook': interactiveBook,
  'H5P.Column': () => ({}),
});
