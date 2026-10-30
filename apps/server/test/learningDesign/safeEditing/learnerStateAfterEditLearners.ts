/**
 * learnerStateAfterEditLearners — what the learner does in each real type before the author edits it: the clicks,
 * drags and typing in Chromium, and how to tell that H5P has saved them.
 *
 * Why: probe P3 (PROD-013, D-093) must start from state that H5P itself saved after real learner input, not from
 *      state the test made up, so the shapes it reports are the shapes learners' rows really have.
 * Spec: PROD-013, H5P-005
 * Invariants:
 *   - Every script answers something other than the first option or the correct word where it can, so a resume
 *     that shifts by one position shows up as a different answer.
 *   - Button names are the Nynorsk H5P texts of the packages' examples.
 * Collaborators: ./learnerStateAfterEditPlayer.ts (runs them), ../../support/realPackages.ts (the examples).
 * Tests: ./learnerStateAfterEdit.browser.int.test.ts, ./learnerStateAfterEditComposite.browser.int.test.ts,
 *   ./learnerStateAfterEditNavigation.browser.int.test.ts, ./learnerStateAfterEditPaths.browser.int.test.ts
 */
import type { Locator, Page } from 'playwright-core';

/** A learner's input and the sign that H5P has stored it. */
export interface LearnerScript {
  /** Answers in the open player page. */
  readonly play: (page: Page) => Promise<void>;
  /** Tells whether a parsed saved state already holds that input. */
  readonly saved: (state: unknown) => boolean;
}

const holds =
  (...parts: string[]) =>
  (state: unknown): boolean =>
    parts.every((part) => JSON.stringify(state).includes(part));

/** Picks the second option (a wrong one) of the example question. */
export const MULTI_CHOICE: LearnerScript = {
  play: (page) => page.locator('.h5p-answer').nth(1).click(),
  saved: holds('[1]'),
};

/** Types into the first two blanks. */
export const BLANKS: LearnerScript = {
  play: async (page) => {
    await page.locator('.h5p-text-input').nth(0).fill('quiz');
    await page.locator('.h5p-text-input').nth(1).fill('samtale');
  },
  saved: holds('"samtale"'),
};

/** A box once it has stopped moving (the same position and size twice, 100 ms apart). */
const settledBox = async (page: Page, locator: Locator) => {
  let last = await locator.boundingBox();
  for (let tries = 0; tries < 30; tries++) {
    await page.waitForTimeout(100);
    const box = await locator.boundingBox();
    if (box && last && JSON.stringify(box) === JSON.stringify(last)) return box;
    last = box;
  }
  return last;
};

const dragWord = async (page: Page, word: string, zone: number): Promise<void> => {
  const source = page.locator('.h5p-drag-draggables-container .h5p-draggable', { hasText: word });
  // WHY: a dropped word moves out of the draggables container into its zone (drag-text.js:1111, draggable.js:86),
  // so a drag is repeated until the word has left the container, each time from boxes that have stopped moving.
  for (let attempt = 0; attempt < 3 && (await source.count()) > 0; attempt++) {
    // WHY: jQuery UI does not cancel the press, so a drag whose pointer crosses text leaves a text selection over the
    // words (whether it does depends on H5P's shuffled order). Pressing on selected text and moving starts a native
    // drag of the selection, which Playwright carries out as HTML5 drag and drop: jQuery UI gets no more mouse events
    // and the word snaps back, on every try (here in 2 of 8 plays; CI run 58's missed drop fits it). The probe needs
    // jQuery UI's drag.
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
    await source.scrollIntoViewIfNeeded();
    const from = await settledBox(page, source);
    const to = await settledBox(page, page.locator('.h5p-dropzone').nth(zone));
    if (!from || !to) throw new Error(`cannot drag ${word} to zone ${zone}`);
    // WHY: jQuery UI's draggable needs real pointer moves between press and release, not a synthetic drop event.
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
    await page.mouse.up();
  }
  if ((await source.count()) > 0) throw new Error(`${word} did not land in zone ${zone}`);
};

/** Drags the second text word into the first zone and the distractor into the second (the words are shuffled). */
export const DRAG_TEXT: LearnerScript = {
  play: async (page) => {
    await dragWord(page, 'samlinga', 0);
    await dragWord(page, 'sluttvurdering', 1);
  },
  saved: holds('"draggable":4'),
};

/** Answers both questions of the Column example (the probe adds the second one). */
export const COLUMN: LearnerScript = {
  play: async (page) => {
    await page.locator('.h5p-multichoice').nth(0).locator('.h5p-answer').nth(1).click();
    await page.locator('.h5p-multichoice').nth(1).locator('.h5p-answer').nth(0).click();
  },
  saved: holds('{"answers":[1]}', '{"answers":[0]}'),
};

/** Starts the set, answers the first question, moves on and types into the first blank of the second. */
export const QUESTION_SET: LearnerScript = {
  play: async (page) => {
    await page.getByRole('button', { name: 'Start' }).click();
    await page.locator('.h5p-answer:visible').nth(1).click();
    await page.locator('.h5p-theme-next:visible').click();
    await page.locator('.h5p-text-input:visible').nth(0).fill('quiz');
  },
  saved: holds('"quiz"'),
};

/** Starts a set whose questions are shuffled (H5P then saves the order) and moves on to the second question. */
export const QUESTION_SET_SHUFFLED: LearnerScript = {
  play: async (page) => {
    await page.getByRole('button', { name: 'Start' }).click();
    await page.locator('.h5p-theme-next:visible').click();
  },
  saved: holds('"order"'),
};

/** Goes to the second slide and answers its question. */
export const COURSE_PRESENTATION: LearnerScript = {
  play: async (page) => {
    await page.getByRole('button', { name: 'Neste side' }).click();
    await page.locator('.h5p-current .h5p-answer').nth(1).click();
  },
  saved: holds('{"answers":[1]}'),
};

/** Opens the book and answers the question in the first chapter. */
export const INTERACTIVE_BOOK: LearnerScript = {
  play: async (page) => {
    await page.getByRole('button', { name: 'Les' }).click();
    await page.locator('.h5p-answer:visible').nth(1).click();
  },
  saved: holds('{"answers":[1]}'),
};

/** Starts the scenario, goes on to the question, picks the first path and reaches the node after it. */
export const BRANCHING_SCENARIO: LearnerScript = {
  play: async (page) => {
    await page.getByRole('button', { name: 'Start scenarioet' }).click();
    await page.getByRole('button', { name: 'Gå vidare' }).click();
    await page.locator('.h5p-branching-question-alternative').first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Gå vidare' }).click();
  },
  saved: holds('"userPath":[0,1,2]'),
};

/** Plays the video until the question appears and answers it. */
export const INTERACTIVE_VIDEO: LearnerScript = {
  play: async (page) => {
    await page.getByRole('button', { name: 'Spel av (k)' }).first().click();
    // WHY: the button appears when the video, streamed through the server, has played to 3 s; a busy runner is slow.
    await page.getByRole('button', { name: 'Spørsmål om undervegsvurdering' }).click({ timeout: 30_000 });
    await page.locator('.h5p-answer:visible').nth(1).click();
  },
  saved: holds('{"answers":[1]}'),
};
