/**
 * textRules — which characters a text typed by a person may hold when the server stores it or searches with it.
 *
 * Why: a typed text is shown to other people (a learner purpose before an activity, a rationale in a portfolio, a
 *      reason beside a finding) and is stored in PostgreSQL. Three kinds of character are never typed on purpose
 *      and do harm there: U+0000 and the other control characters (PostgreSQL refuses U+0000, so a request that
 *      held one ended as a server fault), the line and paragraph separators U+2028 and U+2029 (a line break that a
 *      «one line» rule looking for CR and LF does not see), and the bidirectional controls (they reorder the text a
 *      reader sees, so a reason can read differently from what is stored). One rule refuses them for every such
 *      field (D-142); the web forms take them out of pasted text before they check and send it.
 * Spec: PED-030, PED-032, UD-022, PROD-007
 * Invariants:
 *   - One line: no control character (Unicode `Cc`: C0, DEL, C1), no line or paragraph separator (`Zl`, `Zp`) and
 *     no bidirectional control (`Bidi_Control`: U+061C, U+200E, U+200F, U+202A–U+202E, U+2066–U+2069).
 *   - Free text: the same, except that a tab and the line breaks CR and LF are text.
 *   - Other format characters stay allowed: a soft hyphen and the joiners inside an emoji or a word are text.
 *   - Each pattern is one pass over the text: its alternatives never match the same character.
 *   - A leaf module (imports only zod), so ./learnerInfo.ts can use it without an import cycle.
 * Collaborators: ./learnerInfo.ts, ./learningDesign.ts, ./publishing.ts, ./collaboration.ts;
 *   apps/web/src/config/typedText.ts (the web forms' copy of these classes; a test keeps them equal).
 * Tests: packages/api-contract/test/textRules.test.ts
 */
import type { z } from 'zod';

/** A text on one line: no control character, no line or paragraph separator, no bidirectional control. */
export const ONE_LINE_TEXT_PATTERN = /^[^\p{Cc}\p{Zl}\p{Zp}\p{Bidi_Control}]*$/u;

/** A text that may have tabs and line breaks (CR, LF), and otherwise holds what a one-line text may hold. */
export const FREE_TEXT_PATTERN = /^(?:[\t\n\r]|[^\p{Cc}\p{Zl}\p{Zp}\p{Bidi_Control}])*$/u;

/**
 * Holds a text field to one line of typed text.
 * @param schema - The field's string schema, with its trimming and length limits.
 * @returns The schema, which now refuses control characters, U+2028, U+2029 and bidirectional controls.
 */
export const oneLineText = <T extends z.ZodString>(schema: T): T => schema.regex(ONE_LINE_TEXT_PATTERN) as T;

/**
 * Holds a text field to typed text that may have tabs and line breaks.
 * @param schema - The field's string schema, with its trimming and length limits.
 * @returns The schema, which now refuses every other control character, U+2028, U+2029 and bidirectional controls.
 */
export const freeText = <T extends z.ZodString>(schema: T): T => schema.regex(FREE_TEXT_PATTERN) as T;
