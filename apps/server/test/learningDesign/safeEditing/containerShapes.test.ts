/**
 * Unit tests for the container facts of the structure signature: go-to-slide elements, the branching graph, the
 * question pool and shuffling, the video's timeline and end summary, and the book's chapters.
 *
 * Spec: PROD-013
 */
import { describe, expect, it } from 'vitest';
import { structuralDifference } from '../../../src/learningDesign/safeEditing/structuralChange.js';
import { structureSignature } from '../../../src/learningDesign/safeEditing/structureSignature.js';

const node = (id: string, library = 'H5P.MultiChoice 1.16') => ({ library, params: {}, subContentId: id });
const differs = (library: string, before: unknown, after: unknown) =>
  structuralDifference(structureSignature(before, library), structureSignature(after, library));

describe('[PROD-013] the container facts', () => {
  it('[PROD-013] CoursePresentation: a go-to-slide button takes an element position, even after the last node', () => {
    // Arrange
    const slides = (...elements: object[][]) => ({
      presentation: { slides: elements.map((e) => ({ elements: e })) },
    });
    const goTo = { goToSlideType: 'next', x: 1 };
    const before = slides([{ action: node('a') }]);
    // Act and assert: an added button, a moved one, an added empty slide
    expect(differs('H5P.CoursePresentation 1.28', before, slides([{ action: node('a') }, goTo]))).toEqual({
      kind: 'facts',
      path: '',
    });
    expect(differs('H5P.CoursePresentation 1.28', slides([goTo]), slides([{ ...goTo, x: 50 }]))).toBeNull();
    expect(differs('H5P.CoursePresentation 1.28', before, slides([{ action: node('a') }], []))?.kind).toBe(
      'facts',
    );
  });

  it('[PROD-013] BranchingScenario: every nextContentId counts, the node’s own and each alternative’s', () => {
    // Arrange
    const scenario = (next: number, alternatives: number[]) => ({
      branchingScenario: {
        content: [
          { type: node('q', 'H5P.BranchingQuestion 1.0'), nextContentId: next },
          {
            type: {
              ...node('r', 'H5P.BranchingQuestion 1.0'),
              params: {
                branchingQuestion: { alternatives: alternatives.map((id) => ({ nextContentId: id })) },
              },
            },
          },
        ],
      },
    });
    const library = 'H5P.BranchingScenario 1.10';
    // Act and assert: unchanged, the node's own target, an alternative's target
    expect(differs(library, scenario(1, [0, -1]), scenario(1, [0, -1]))).toBeNull();
    expect(differs(library, scenario(1, [0, -1]), scenario(-1, [0, -1]))?.kind).toBe('facts');
    expect(differs(library, scenario(1, [0, -1]), scenario(1, [-1, 0]))?.kind).toBe('facts');
  });

  it('[PROD-013] BranchingScenario: a node’s missing nextContentId is the end (-1), as the player reads it', () => {
    // Arrange: H5P's editor drops a branching-question node's own `nextContentId: -1` on every save
    const scenario = (own: object) => ({
      branchingScenario: { content: [{ type: node('q', 'H5P.BranchingQuestion 1.0'), ...own }] },
    });
    const library = 'H5P.BranchingScenario 1.10';
    // Act and assert: -1 and missing are the same; another target is not
    expect(differs(library, scenario({ nextContentId: -1 }), scenario({}))).toBeNull();
    expect(differs(library, scenario({}), scenario({ nextContentId: 0 }))?.kind).toBe('facts');
  });

  it('[PROD-013] QuestionSet: the pool size is structural, shuffling is not (a resumed attempt keeps its order)', () => {
    const set = (extra: object) => ({ questions: [node('a'), node('b')], ...extra });
    const library = 'H5P.QuestionSet 1.21';
    expect(differs(library, set({ randomQuestions: false }), set({ randomQuestions: true }))).toBeNull();
    expect(differs(library, set({}), set({ poolSize: 0 }))).toBeNull();
    expect(differs(library, set({ poolSize: 2 }), set({ poolSize: 1 }))?.kind).toBe('facts');
  });

  it('[PROD-013] InteractiveVideo: the video, the start-time order and whether the end summary shows count', () => {
    // Arrange
    const video = (froms: number[], statements: string[], path = 'videos/a.mp4') => ({
      interactiveVideo: {
        video: { files: [{ path }] },
        assets: {
          interactions: froms.map((from, i) => ({ action: node(`i${i}`), duration: { from, to: from + 2 } })),
        },
        summary: {
          displayAt: 3,
          task: { ...node('s', 'H5P.Summary 1.10'), params: { summaries: [{ summary: statements }] } },
        },
      },
    });
    const library = 'H5P.InteractiveVideo 1.28';
    // Act and assert: retimed in order, reordered by time, the summary emptied, another video
    expect(differs(library, video([5, 20], ['A']), video([8, 25], ['A']))).toBeNull();
    expect(differs(library, video([5, 20], ['A']), video([30, 20], ['A']))?.kind).toBe('facts');
    expect(differs(library, video([5, 20], ['A']), video([5, 20], []))?.kind).toBe('facts');
    expect(differs(library, video([5], ['A']), video([5], ['A'], 'videos/b.mp4'))?.kind).toBe('facts');
  });

  it('[PROD-013] InteractiveBook: the number of sections in each chapter counts', () => {
    const chapter = (id: string, sections: number) => ({
      ...node(id, 'H5P.Column 1.22'),
      params: { content: Array.from({ length: sections }, () => ({ useSeparator: 'auto' })) },
    });
    const library = 'H5P.InteractiveBook 1.15';
    expect(differs(library, { chapters: [chapter('a', 2)] }, { chapters: [chapter('a', 3)] })?.kind).toBe(
      'facts',
    );
    expect(differs(library, { chapters: [chapter('a', 2)] }, { chapters: [chapter('a', 2)] })).toBeNull();
  });
});
