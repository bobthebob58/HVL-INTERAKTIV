/**
 * SourceAttributionNote — the sign on a copied activity's page: «Kopi av <tittel> av <namn>», with a link to the
 * original while the person may still open it.
 *
 * Why: PROD-007 keeps a duplicate's link to its source and the original author's attribution (D-092). The server
 *      fills the source's title and author only for people who may edit the copy, so learners and viewers never see
 *      a colleague's name; the sign stays on the copy's page, also after «Lagre som ny versjon» opened it (D-093),
 *      where the announcement before the navigation could be cut off.
 * Spec: PROD-007, UD-010
 * Invariants:
 *   - Shown only when the detail carries any attribution field; an original shows nothing.
 *   - A source the person may no longer view is not named (the server leaves its title out); a missing author is
 *     "an unknown author". The title keeps the page's language (the source's own language is not known here).
 * Collaborators: ./ActivityView.tsx, ../../config/paths.ts (`activityPath`), packages/api-contract
 *   `sourceAttribution.ts`.
 * Tests: apps/web/test/features/SourceAttributionNote.test.tsx
 */
'use client';

import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { activityPath } from '../../config/paths';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/**
 * The attribution sign of a copy, or nothing for an original.
 * @param props - The activity detail (its attribution fields, when the person may edit it).
 * @returns The sign.
 */
export function SourceAttributionNote({ detail }: { readonly detail: ContentDetail }) {
  const locale = useLocale();
  const { sourceContentId, sourceTitle, sourceAuthorName } = detail;
  if (!sourceContentId && !sourceTitle && !sourceAuthorName) return null;
  const author = sourceAuthorName ?? t('sharing.attributionUnknownAuthor', locale);
  const text = sourceTitle
    ? t('sharing.attribution', locale, { title: sourceTitle, author })
    : t('sharing.attributionNoTitle', locale, { author });
  return (
    <p className="border-l-4 border-hvl-primary-dark bg-hvl-surface-alt p-3">
      {text}
      {sourceContentId ? (
        <>
          {' '}
          <a href={activityPath(sourceContentId)}>{t('sharing.attributionOpen', locale)}</a>
        </>
      ) : null}
    </p>
  );
}
