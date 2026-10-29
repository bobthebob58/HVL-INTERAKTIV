/**
 * DraftBanner — says that the studio's texts, phases and patterns are a draft while ALU has not confirmed them.
 *
 * Why: the studio's content is ALU's proposal until it is confirmed (D-082, open question Q17); while `phases.yaml`
 *      says `status: proposed`, the guide and pattern pages say so, so no teacher takes a draft for HVL's word.
 * Spec: PED-001, PED-002
 * Invariants:
 *   - Shown only while the status is `proposed`; the word «Utkast» and an icon carry the meaning, not colour (UD-003).
 *   - It is information, not an interruption: a labelled note, never an alert.
 * Collaborators: ./GuideView.tsx, ./PatternDetailView.tsx.
 * Tests: apps/web/test/features/GuideView.test.tsx
 */
import type { ContentReviewStatus } from '@hvl-interaktiv/api-contract';
import { t, type Locale } from '../../i18n/translate';

/** The icon before the banner's title (a pencil, as a draft's status badge has). */
export const DRAFT_ICON = '✎';

/**
 * The draft banner.
 * @param props - The content's review status and the locale.
 * @returns The banner while the status is `proposed`, else nothing.
 */
export function DraftBanner({
  status,
  locale,
}: {
  readonly status: ContentReviewStatus;
  readonly locale: Locale;
}) {
  if (status !== 'proposed') return null;
  return (
    <p role="note" className="mb-6 rounded bg-hvl-band p-4 text-hvl-ink">
      <strong>
        <span aria-hidden="true">{DRAFT_ICON} </span>
        {t('studio.draftTitle', locale)}:
      </strong>{' '}
      {t('studio.draftBody', locale)}
    </p>
  );
}
