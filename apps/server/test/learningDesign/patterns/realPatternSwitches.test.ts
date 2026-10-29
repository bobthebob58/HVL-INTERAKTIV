/**
 * Tests for the formative rules the real-pattern tests apply (./realPatternSwitches.ts): each rule names a switched-off
 * retry or «Vis svar», a pass mark that cannot be retried, a forced completion, a timer, a presentation without
 * keyboard navigation and case-sensitive matching in a fill-in task, at the node where it is, and leaves formative
 * content alone, including a fill-in task without typo tolerance (D-084 amendment). Without these, a rule that never
 * fires would let the integration test pass on anything.
 *
 * Spec: PROD-009
 */
import { describe, expect, it } from 'vitest';
import { walkContent } from '../../../src/validation/contentWalker.js';
import { formativeViolations } from './realPatternSwitches.js';

const violationsOf = (library: string, params: object) => formativeViolations(walkContent(library, params));

describe('[PROD-009] the formative rules of the real-pattern tests', () => {
  it('[PROD-009] names a set without retry, its gating pass mark, a task without «Vis svar» and a timer, at their nodes', () => {
    // Arrange: a question set whose result page offers no retry, holding a task with its solutions off
    const params = {
      questions: [
        {
          library: 'H5P.MultiChoice 1.16',
          params: { behaviour: { enableRetry: true, enableSolutionsButton: false, passPercentage: 100 } },
        },
      ],
      passPercentage: 80,
      endGame: { showResultPage: true, showRetryButton: false, showSolutionButton: true },
      timeLimit: 60,
    };
    // Act
    const violations = violationsOf('H5P.QuestionSet 1.21', params);
    // Assert
    expect(violations).toEqual([
      'H5P.QuestionSet 1.21 at "": endGame.showRetryButton is not on',
      'H5P.QuestionSet 1.21 at "": passPercentage is set, but a missed pass mark cannot be retried',
      'H5P.MultiChoice 1.16 at "questions[0].params": behaviour.enableSolutionsButton is not on',
      'params.timeLimit looks like a time limit',
    ]);
  });

  it.each([
    [
      'a presentation in Active Surface Mode, with its summary retry off',
      'H5P.CoursePresentation 1.28',
      { override: { activeSurface: true, summarySlideRetryButton: false, retryButton: 'off' } },
      [
        'override.retryButton is off',
        'override.summarySlideRetryButton is false',
        'override.activeSurface is true',
      ],
    ],
    [
      'a video that must be watched and an interaction that must be completed',
      'H5P.InteractiveVideo 1.28',
      {
        interactiveVideo: { assets: { interactions: [{ adaptivity: { requireCompletion: true } }] } },
        override: { preventSkippingMode: 'both' },
      },
      ['override.preventSkippingMode is both', 'interaction 0 must be completed before the video goes on'],
    ],
    [
      'a case that forces every screen to be finished',
      'H5P.BranchingScenario 1.10',
      {
        branchingScenario: {
          behaviour: { forceContentFinished: true },
          content: [{ forceContentFinished: 'enabled' }],
        },
      },
      [
        'branchingScenario.behaviour.forceContentFinished is true',
        'content 0 must be finished before the learner may go on',
      ],
    ],
    [
      'a case-sensitive fill-in task',
      'H5P.Blanks 1.14',
      { behaviour: { enableRetry: true, enableSolutionsButton: true, caseSensitive: true } },
      ['behaviour.caseSensitive is true'],
    ],
    [
      'a book without retry',
      'H5P.InteractiveBook 1.15',
      { behaviour: { enableRetry: false } },
      ['behaviour.enableRetry is not on'],
    ],
  ])('[PROD-009] names %s', (_, library, params, expected) => {
    // Act
    const violations = violationsOf(library, params);
    // Assert
    expect(violations).toEqual(expected.map((problem) => `${library} at "": ${problem}`));
  });

  it('[PROD-009] finds nothing in formative content, where container overrides may stay empty', () => {
    // Arrange
    const params = {
      questions: [
        {
          library: 'H5P.Blanks 1.14',
          params: {
            behaviour: {
              enableRetry: true,
              enableSolutionsButton: true,
              caseSensitive: false,
              acceptSpellingErrors: true,
            },
          },
        },
      ],
      passPercentage: 80,
      endGame: { showResultPage: true, showRetryButton: true, showSolutionButton: true },
      override: {},
    };
    // Act
    const violations = violationsOf('H5P.QuestionSet 1.21', params);
    // Assert
    expect(violations).toEqual([]);
  });

  it('[PROD-009] leaves typo tolerance to the pattern: a fill-in task that matches exactly is still formative', () => {
    // Arrange: PEDAGOGY: exact matching keeps a number with one wrong digit wrong (D-084 amendment, 2026-10-29)
    const params = {
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        caseSensitive: false,
        acceptSpellingErrors: false,
      },
    };
    // Act
    const violations = violationsOf('H5P.Blanks 1.14', params);
    // Assert
    expect(violations).toEqual([]);
  });
});
