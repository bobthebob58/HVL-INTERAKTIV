/**
 * ShortlistButton — «Ta opp i samlinga» by a question: a toggle button that puts the question on the tab's shortlist,
 * or takes it off again.
 *
 * Why: INS-003's «Ta opp i samlinga» ("bring to seminar") adds the item to a shortlist that can be printed or
 *      projected. A toggle keeps one button per question whose state is said by `aria-pressed`, shown by a ✓ and
 *      bold text rather than colour alone (UD-003), and its accessible name names the question in brackets, so the
 *      many buttons of a tab can be told apart (WCAG 2.4.6) while the visible label starts the name (WCAG 2.5.3).
 *      WHY: brackets, not a colon: a browser puts a space before the visually hidden part, which «: » would show.
 * Spec: INS-003, UD-003, UD-006, UD-010
 * Invariants:
 *   - A11Y: the label stays the same; only `aria-pressed`, the ✓ and the weight change. The icon is `aria-hidden`.
 *   - At least 24 px high (the shared button styles, UD-005).
 *   - The question in the name carries `lang` only when it is the activity's own text (UD-010), never a fallback.
 * Collaborators: ./shortlistContext.tsx, ./ItemDifficultySection.tsx, ./MisconceptionSection.tsx.
 * Tests: apps/web/test/features/insight/InsightShortlist.test.tsx
 */
'use client';

import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { useShortlist } from './shortlistContext';

/** The icon before the label: ✓ when the question is on the list, + when it is not; always `aria-hidden`. */
export const TOGGLE_ICON = { on: '✓ ', off: '+ ' } as const;

/**
 * The toggle of one question.
 * @param props - The question's key, its text for the accessible name, and that text's `lang` when it is the
 *   activity's own text in another language than the page's.
 * @returns The button.
 */
export function ShortlistButton({
  itemKey,
  question,
  lang,
}: {
  readonly itemKey: string;
  readonly question: string;
  readonly lang?: string;
}) {
  const locale = useLocale();
  const shortlist = useShortlist();
  const pressed = shortlist.has(itemKey);
  return (
    <button
      type="button"
      className="button-secondary aria-pressed:font-bold"
      aria-pressed={pressed}
      onClick={() => shortlist.toggle(itemKey)}
    >
      <span aria-hidden="true">{pressed ? TOGGLE_ICON.on : TOGGLE_ICON.off}</span>
      {t('insight.shortlist.add', locale)}
      <span className="sr-only" lang={lang}>
        {' '}
        ({question})
      </span>
    </button>
  );
}
