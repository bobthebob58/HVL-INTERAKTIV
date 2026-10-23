/**
 * feedbackText — tells whether feedback explains anything: blank, or only a verdict such as «Riktig!», «Feil»,
 * "Correct" or "Try again".
 *
 * Why: PED-H05 and PED-H11 hint when feedback marks an answer without saying why. Feedback that explains is one
 *      of the strongest levers for learning (Hattie & Timperley 2007; Shute 2008).
 * Spec: PED-020
 * Invariants:
 *   - Text is judged on its plain text (HTML removed), case-insensitively, in nn, nb and en.
 *   - A verdict is non-empty text made only of verdict words and score placeholders (`@score`); any other word
 *     counts as an explanation, so the check errs towards silence.
 * Collaborators: ./richText.ts, ./rules/wrongOptionFeedbackHint.ts, ./rules/overallFeedbackHint.ts.
 * Tests: apps/server/test/validation/rules/overallFeedbackHint.test.ts
 */
import { plainTextOf } from './richText.js';

const VERDICT_WORDS: ReadonlySet<string> = new Set(
  [
    // nn and nb
    'riktig rett feil galt gale bra flott supert perfekt jobba jobbet godt svært veldig heilt helt nesten',
    'prøv igjen på nytt ikkje ikke du hadde har svart svarte svara gratulerer fekk fikk av poeng svar svaret',
    'ja nei dessverre',
    // en
    'correct incorrect wrong right well done good great job nice excellent perfect try again not quite almost',
    "you you're got it are congratulations answer answers your is of points score scored yes no sorry",
  ]
    .join(' ')
    .split(' '),
);

/**
 * Tells whether text is empty once HTML and whitespace are removed.
 * @param value - Feedback (HTML or plain text); a missing value is blank.
 * @returns True when nothing would be shown.
 */
export const isBlankText = (value: string | undefined): boolean =>
  value === undefined || plainTextOf(value) === '';

/**
 * Tells whether feedback is only a verdict, with no explanation.
 * @param value - Feedback (HTML or plain text).
 * @returns True for e.g. `<p>Feil!</p>` or "Correct, well done!"; false for blank text and for any explanation.
 */
export function isBareVerdict(value: string | undefined): boolean {
  if (value === undefined) return false;
  const words = plainTextOf(value)
    .toLowerCase()
    .split(/[^\p{L}\p{N}@']+/u)
    .filter((word) => word !== '');
  return words.length > 0 && words.every((word) => word.startsWith('@') || VERDICT_WORDS.has(word));
}
