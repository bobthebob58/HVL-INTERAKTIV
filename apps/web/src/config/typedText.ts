/**
 * typedText — takes out of typed or pasted text the characters the server refuses in it, before a form checks
 * and sends the text.
 *
 * Why: the server holds every text a person types to one rule (packages/api-contract `textRules`, D-142): no
 *      control characters, no line or paragraph separator (U+2028, U+2029), no bidirectional control. Nobody types
 *      these, but text copied from a PDF, a chat or a document can carry them, and the author cannot see them. A
 *      form that sent them would get a 400 it could not explain, so the forms clean the text first, as the
 *      learner-purpose field already did for a pasted tab (D-087).
 * Spec: PED-030, PED-032, UD-022, PROD-007
 * Invariants:
 *   - The classes are the contract's own (`ONE_LINE_TEXT_PATTERN`, `FREE_TEXT_PATTERN`); the web app imports only
 *     types from the contract, so a test keeps the copies equal: what these functions return, the patterns accept
 *     (a CR or LF left in one line is for the form to report, as before).
 *   - A bidirectional control is dropped; a hidden line break becomes a line break in free text and a space on
 *     one line; any other control character becomes a space. The result is trimmed, as the server trims.
 *   - A soft hyphen, the joiner inside an emoji and every visible character stay.
 *   - Each pattern is one character class, so cleaning takes time in step with the text's length.
 * Collaborators: ../features/learningDesign/learningDesignForm.ts, ../components/publishReasons.ts,
 *   ../features/sharing/PeopleSearch.tsx.
 * Tests: apps/web/test/config/typedText.test.tsx
 */

const BIDI_CONTROLS = /\p{Bidi_Control}+/gu;
const HIDDEN_LINE_BREAKS = /[\p{Zl}\p{Zp}]/gu;
// WHY: line breaks are left for the form, which has its own message for them in a one-line field.
const CONTROLS_EXCEPT_LINE_BREAKS = /[^\P{Cc}\r\n]+/gu;
const CONTROLS_EXCEPT_TABS_AND_LINE_BREAKS = /[^\P{Cc}\t\r\n]+/gu;

/**
 * A one-line text as it is checked and sent.
 * @param value - As typed or pasted.
 * @returns The text without bidirectional controls, with every other control character and hidden line break as
 *   a space, trimmed; a CR or LF stays.
 */
export const cleanOneLine = (value: string): string =>
  value
    .replace(BIDI_CONTROLS, '')
    .replace(HIDDEN_LINE_BREAKS, ' ')
    .replace(CONTROLS_EXCEPT_LINE_BREAKS, ' ')
    .trim();

/**
 * A text that may have line breaks, as it is checked and sent.
 * @param value - As typed or pasted.
 * @returns The text without bidirectional controls, with a hidden line break as a line break and every control
 *   character other than a tab or a line break as a space, trimmed.
 */
export const cleanFreeText = (value: string): string =>
  value
    .replace(BIDI_CONTROLS, '')
    .replace(HIDDEN_LINE_BREAKS, '\n')
    .replace(CONTROLS_EXCEPT_TABS_AND_LINE_BREAKS, ' ')
    .trim();
