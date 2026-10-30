/**
 * skeletonCreationQuestions — the question and text sub-content that probe P1's skeletons are built from: guidance
 * placeholders marked `⟦…⟧`, as a pattern's skeleton holds them (D-086).
 *
 * Why: the probe needs realistic skeletons of three patterns (fa-video, uv-case, uv-module) whose questions look
 *      like what W2 will write: only the fields a pattern is about, everything else left to the semantics defaults.
 * Spec: PED-010, PROD-001
 * Invariants: no `subContentId` anywhere (the creation step adds them); no `params` defaults beyond what a pattern
 *   would set (retry and solutions on, PROD-009); every text a learner would read is a `⟦…⟧` placeholder.
 * Collaborators: ./skeletonCreationSkeletons.ts.
 * Tests: apps/server/test/learningDesign/patterns/skeletonCreation.browser.int.test.ts
 */

/**
 * Marks a guidance text as a placeholder (D-086).
 * @param text - The guidance in Nynorsk.
 * @returns `⟦text⟧`.
 */
export const guidance = (text: string): string => `⟦${text}⟧`;

/**
 * A guidance paragraph as H5P's rich-text fields store it.
 * @param text - The guidance.
 * @returns `<p>⟦text⟧</p>`.
 */
export const guidanceParagraph = (text: string): string => `<p>${guidance(text)}</p>`;

/**
 * A text block (H5P.AdvancedText) holding guidance.
 * @param title - The block's title in the editor.
 * @param text - The guidance.
 * @returns Sub-content.
 */
export function guidanceText(title: string, text: string): object {
  return {
    library: 'H5P.AdvancedText 1.1',
    params: { text: guidanceParagraph(text) },
    metadata: { contentType: 'Text', license: 'U', title },
  };
}

const answer = (n: number, correct: boolean) => ({
  text: `<div>${guidance(correct ? `Rett svar ${n}` : `Feil svar ${n}: ei vanleg misoppfatning`)}</div>`,
  correct,
  tipsAndFeedback: {
    chosenFeedback: `<div>${guidance(correct ? 'Forklar kvifor svaret er rett' : 'Forklar misoppfatninga')}</div>`,
  },
});

/**
 * A MultiChoice with one right and two wrong options, each with its own feedback.
 * @param title - Its title.
 * @returns Sub-content.
 */
export function guidanceMultiChoice(title: string): object {
  return {
    library: 'H5P.MultiChoice 1.16',
    params: {
      question: guidanceParagraph(
        'Skriv eit spørsmål som får studenten til å bruke omgrepet, ikkje berre kjenne det att',
      ),
      answers: [answer(1, true), answer(2, false), answer(3, false)],
      behaviour: { enableRetry: true, enableSolutionsButton: true },
    },
    metadata: { contentType: 'Multiple Choice', license: 'U', title },
  };
}

/**
 * A fill-in-the-blanks task with one sentence.
 * @param title - Its title.
 * @returns Sub-content.
 */
export function guidanceBlanks(title: string): object {
  return {
    library: 'H5P.Blanks 1.14',
    params: {
      text: guidanceParagraph('Skriv kva studenten skal fylle inn'),
      questions: [`<p>${guidance('Skriv ei setning der studenten fyller inn *omgrepet*')}</p>`],
      behaviour: { enableRetry: true, enableSolutionsButton: true },
    },
    metadata: { contentType: 'Fill in the Blanks', license: 'U', title },
  };
}

/**
 * A summary task (H5P.Summary) with two groups of statements; its groups carry no `subContentId`.
 * @param title - Its title.
 * @returns Sub-content.
 */
export function guidanceSummary(title: string): object {
  const statements = (n: number) => ({
    summary: [guidanceParagraph(`Rett påstand ${n}`), guidanceParagraph(`Feil påstand ${n}`)],
  });
  return {
    library: 'H5P.Summary 1.10',
    params: {
      intro: guidanceParagraph('Skriv kva studenten skal oppsummere'),
      summaries: [statements(1), statements(2)],
    },
    metadata: { contentType: 'Summary', license: 'U', title },
  };
}

/**
 * A question set (H5P.QuestionSet) of three MultiChoice checks, as each chapter of uv-module ends with.
 * @param title - Its title.
 * @returns Sub-content.
 */
export function guidanceCheck(title: string): object {
  return {
    library: 'H5P.QuestionSet 1.21',
    params: {
      introPage: { showIntroPage: false },
      questions: [1, 2, 3].map((n) => guidanceMultiChoice(`${title}: spørsmål ${n}`)),
    },
    metadata: { contentType: 'Question Set', license: 'U', title },
  };
}
