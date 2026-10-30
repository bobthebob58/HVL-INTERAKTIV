/**
 * skeletonCreationExpected — what probe P1 found on the real content types (D-078), pinned so a library update that
 * changes it fails the probe and is looked at again.
 *
 * Why: the pattern work (W2) builds on these facts: which version of each type the editor offers, what the editor
 *      still adds when it saves a server-created activity, and which defaults stay English in Nynorsk (D-084).
 * Spec: PED-010, PROD-001, H5P-008
 * Invariants: paths are collapsed (`[]` for list indices) and sorted, as ./skeletonCreationDiff.ts makes them.
 * Collaborators: ./skeletonCreation.browser.int.test.ts.
 * Tests: apps/server/test/learningDesign/patterns/skeletonCreation.browser.int.test.ts
 */

/** The version of each of the ten types the editor offers: the newest installed minor and patch. */
export const OFFERED_VERSIONS: Readonly<Record<string, string>> = {
  'H5P.BranchingScenario': '1.10.1',
  'H5P.Blanks': '1.14.13',
  'H5P.Column': '1.22.0',
  'H5P.CoursePresentation': '1.28.25',
  'H5P.DragText': '1.10.52',
  'H5P.ImageHotspots': '1.11.6',
  'H5P.InteractiveBook': '1.15.1',
  'H5P.InteractiveVideo': '1.28.37',
  'H5P.MultiChoice': '1.16.14',
  'H5P.QuestionSet': '1.21.13',
};

/** Older minors that are installed (as other packages' dependencies) but never offered. */
export const INSTALLED_NOT_OFFERED: Readonly<Record<string, string>> = {
  'H5P.Column': '1.18.8',
  'H5P.CoursePresentation': '1.27.27',
  'H5P.ImageHotspots': '1.10.31',
};

/** Sub-content IDs in each created activity (sub-content nodes plus sub-content groups). */
export const SUB_CONTENT_ID_COUNTS: Readonly<Record<string, number>> = {
  // 3 questions + the summary task + its 2 statement groups
  'fa-video': 6,
  // 5 nodes
  'uv-case': 5,
  // 3 chapters + 3 × (text + question set) + 9 questions
  'uv-module': 18,
  // 5 hotspot texts
  'fa-hotspots': 5,
};

const SUMMARY = 'interactiveVideo.summary.task.params.';
const CHECK = 'chapters[].params.content[].content.params.';
const QUESTION = `${CHECK}questions[].params.`;

/** Parameter fields the editor still adds when the author saves an activity unchanged (cosmetic metadata aside). */
export const EDITOR_ADDED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  'fa-video': [
    `${SUMMARY}overallFeedback[].from`,
    `${SUMMARY}overallFeedback[].to`,
    `${SUMMARY}summaries[].tip`,
    'interactiveVideo.video.textTracks.videoTrack[].kind',
    'interactiveVideo.video.textTracks.videoTrack[].label',
    'interactiveVideo.video.textTracks.videoTrack[].srcLang',
  ],
  'uv-case': [],
  'uv-module': [
    `${CHECK}endGame.overallFeedback[].from`,
    `${CHECK}endGame.overallFeedback[].to`,
    `${CHECK}endGame.showAnimations`,
    `${CHECK}endGame.skippable`,
    `${CHECK}introPage.introduction`,
    `${QUESTION}answers[].tipsAndFeedback.notChosenFeedback`,
    `${QUESTION}answers[].tipsAndFeedback.tip`,
    `${QUESTION}overallFeedback[].from`,
    `${QUESTION}overallFeedback[].to`,
  ],
  // WHY: the hotspot texts have no metadata, so the editor names them «Untitled Tekst» with licence U.
  'fa-hotspots': ['hotspots[].content[].metadata.license', 'hotspots[].content[].metadata.title'],
};

/**
 * Sub-content metadata fields the editor writes on save, which no player or check of ours reads. `title` and
 * `license` are not cosmetic (InteractiveBook shows a chapter's title as its heading), so a change to them shows.
 */
export const EDITOR_METADATA_FIELDS: ReadonlySet<string> = new Set([
  'authors',
  'changes',
  'contentType',
  'extraTitle',
]);

const MC = 'interactiveVideo.assets.interactions[].action.params.UI.';
const BOOK_MC = `${QUESTION}UI.`;

/** Learner-facing defaults whose Nynorsk value is the library's English text (H5P-008). */
export const ENGLISH_IN_NYNORSK: Readonly<Record<string, readonly string[]>> = {
  'fa-video': [
    `${MC}a11yCheck`,
    `${MC}a11yRetry`,
    `${MC}a11yShowSolution`,
    `${MC}submitAnswerButton`,
    'l10n.endcardQuestion',
    // WHY: "Pause" is also the Nynorsk word; listed because it is the same text.
    'l10n.pause',
  ],
  'uv-case': [
    'branchingScenario.content[].proceedButtonText',
    'branchingScenario.l10n.disableProceedButtonText',
    'branchingScenario.l10n.fullscreenAria',
    'branchingScenario.l10n.replayButtonText',
  ],
  'uv-module': [
    `${CHECK}endGame.amountCorrect`,
    `${CHECK}endGame.message`,
    `${CHECK}endGame.scoreHeader`,
    `${BOOK_MC}a11yCheck`,
    `${BOOK_MC}a11yRetry`,
    `${BOOK_MC}a11yShowSolution`,
    `${BOOK_MC}submitAnswerButton`,
    `${CHECK}texts.next`,
    `${CHECK}texts.noQuestionAdded`,
    `${CHECK}texts.previous`,
    `${CHECK}texts.questionSetInstruction`,
    'next',
    'page',
    'previous',
  ],
  'fa-hotspots': ['containsAudioVideoLabel', 'untitledHotspotLabel'],
};
