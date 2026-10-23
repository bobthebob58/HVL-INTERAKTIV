/**
 * StatusBadge — shows whether an activity is a draft or published, with a word and an icon, not colour alone.
 *
 * Why: learners see only published activities (PROD-004), so authors must see the status at a glance; WCAG 1.4.1
 *      (UD-003) means the word carries the meaning and colour only supports it.
 * Spec: PROD-003, UD-003
 * Invariants:
 *   - Colours only from declared token pairings: ink on band (draft), correct-fg on correct-bg (published).
 * Collaborators: ../features/portal/ActivityList.tsx, ../features/activity/ActivityView.tsx.
 * Tests: apps/web/test/components/StatusBadge.test.tsx
 */
import type { ContentStatus } from '@hvl-interaktiv/api-contract';
import { t, type Locale } from '../i18n/translate';

const STYLE: Readonly<Record<ContentStatus, string>> = {
  draft: 'bg-hvl-band text-hvl-ink',
  published: 'bg-hvl-feedback-correct-bg text-hvl-feedback-correct-fg',
};

/** The icon before each status word: a pencil for a draft, a tick for published. */
export const STATUS_ICON: Readonly<Record<ContentStatus, string>> = { draft: '✎', published: '✓' };

/**
 * The status of an activity.
 * @param props - The status and the locale.
 * @returns A badge with icon and word.
 */
export function StatusBadge({ status, locale }: { readonly status: ContentStatus; readonly locale: Locale }) {
  return (
    <span className={`inline-block rounded px-2 font-bold ${STYLE[status]}`}>
      <span aria-hidden="true">{STATUS_ICON[status]} </span>
      {t(`status.${status}`, locale)}
    </span>
  );
}
