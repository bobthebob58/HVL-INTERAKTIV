/**
 * placeholderMarkerStored — what probe P6 found stored and sent for the guidance marker `⟦…⟧` (D-086) on the real
 * content types (D-078), pinned so a library, Lumi or editor update that changes it fails the probe.
 *
 * Why: V-PLACEHOLDER (W2) is built on these facts: after any save through the editor's save path every marker is
 *      the raw characters U+27E6 and U+27E7 (a `&` stays `&amp;`), while H5P's editor itself re-sends a plain text
 *      field exactly as it loaded it and only rich-text fields come back decoded.
 * Spec: PROD-001
 * Invariants: paths are those of ./placeholderMarkerActivities.ts `markerLeaves`; the values are exact strings.
 * Collaborators: ./placeholderMarker.browser.int.test.ts, ./placeholderMarkerActivities.ts.
 * Tests: apps/server/test/learningDesign/patterns/placeholderMarker.browser.int.test.ts
 */
import { markerLeaves, type MarkedActivity } from './placeholderMarkerActivities.js';

/** Each type's marked fields as every save stores them, whichever way the marker was written. */
export const STORED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  MultiChoice: {
    question: '<p>⟦Skriv spørsmålet her⟧</p>',
    'answers[0].text': '<div>⟦Rett svar⟧</div>',
    'answers[0].tipsAndFeedback.chosenFeedback': '<div>⟦Forklar kvifor svaret er rett⟧</div>',
    'UI.checkAnswerButton': '⟦Sjekk &amp; send⟧',
  },
  CoursePresentation: {
    'presentation.slides[0].elements[0].action.params.text': '<p>⟦Skriv teksten på lysbiletet⟧</p>',
  },
  Blanks: {
    text: '<p>⟦Skriv kva studenten skal fylle inn⟧</p>',
    'questions[0]': '<p>⟦Skriv setninga⟧ med *omgrep* og *⟦svar⟧*</p>',
  },
  DragText: {
    taskDescription: '<p>⟦Skriv oppgåva⟧</p>',
    textField: '⟦Skriv teksten⟧ med *dra* og *⟦ord⟧*.',
    distractors: '*⟦distraktor⟧*',
  },
};

/** The fields among them that are plain text or a textarea, not rich text (no CKEditor). */
export const PLAIN_TEXT_PATHS: ReadonlySet<string> = new Set([
  'UI.checkAnswerButton',
  'textField',
  'distractors',
]);

/** The one field Lumi's semantics enforcer never reaches: a text that is a list item (D-039). */
export const LIST_ITEM_PATH = 'questions[0]';

/** How many marked rich-text fields per type ran CKEditor in the probe (CoursePresentation: its slide text). */
export const CKEDITOR_FIELDS: Readonly<Record<string, number>> = {
  MultiChoice: 3,
  CoursePresentation: 1,
  Blanks: 2,
  DragText: 1,
};

/**
 * The stored metadata title of a probe activity (h5p.json also gets `extraTitle`, the same text, from the editor).
 * @param type - The activity's type, e.g. `Blanks`.
 * @returns `⟦Tittel: <type>⟧`.
 */
export const storedTitle = (type: string): string => `⟦Tittel: ${type}⟧`;

/**
 * What H5P's editor sends for an activity on an unchanged save: rich text decoded, plain text as it loaded.
 * @param activity - The activity as it was stored (its marked strings are what the editor loaded).
 * @param loaded - The marked strings as stored before the save.
 * @returns Path → string, with `metadata.title` and `metadata.extraTitle`.
 */
export function sentOnUnchangedSave(
  activity: MarkedActivity,
  loaded: Readonly<Record<string, string>>,
): Record<string, string> {
  const fields = Object.entries(STORED[activity.type] ?? {}).map(([path, stored]) => [
    `params.${path}`,
    PLAIN_TEXT_PATHS.has(path) ? loaded[path] : stored,
  ]);
  const title = storedTitle(activity.type);
  return { ...Object.fromEntries(fields), 'metadata.title': title, 'metadata.extraTitle': title };
}

/**
 * The marked strings of an activity exactly as written (what a store without the save path keeps).
 * @param activity - The activity.
 * @returns Path → string.
 */
export const asWritten = (activity: MarkedActivity): Record<string, string> => markerLeaves(activity.params);
