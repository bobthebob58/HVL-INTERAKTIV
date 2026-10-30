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
 *     "an unknown author".
 *   - A11Y: the title is the source author's text; it carries `lang` when the source's language (`sourceLanguage`)
 *     differs from the page's (WCAG 3.1.2, UD-010, D-092 amendment 2026-10-29).
 * Collaborators: ./ActivityView.tsx, ../../config/paths.ts (`activityPath`), ../../i18n/partLanguage.ts,
 *   packages/api-contract `sourceAttribution.ts`.
 * Tests: apps/web/test/features/SourceAttributionNote.test.tsx
 */
'use client';

import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { activityPath } from '../../config/paths';
import { useLocale } from '../../i18n/LocaleContext';
import { partLanguage } from '../../i18n/partLanguage';
import { t, type Locale } from '../../i18n/translate';

const TITLE_PLACEHOLDER = '{{title}}';

/**
 * «Kopi av «<tittel>» av <namn>.», with the title in its own language.
 * @param title - The source's title.
 * @param language - The source's language tag, if known.
 * @param author - The author's name, or the words for an unknown one.
 * @param locale - The page's locale.
 * @returns The sentence, with the title as its own part.
 */
const titledSign = (title: string, language: string | undefined, author: string, locale: Locale) => {
  // WHY: `t` leaves a placeholder it is not given, so the sentence is split around the title.
  const sentence = t('sharing.attribution', locale, { author });
  const at = sentence.indexOf(TITLE_PLACEHOLDER);
  if (at < 0) return t('sharing.attribution', locale, { title, author });
  const lang = partLanguage(language, locale);
  return (
    <>
      {sentence.slice(0, at)}
      {lang ? <span lang={lang}>{title}</span> : title}
      {sentence.slice(at + TITLE_PLACEHOLDER.length)}
    </>
  );
};

/**
 * The attribution sign of a copy, or nothing for an original.
 * @param props - The activity detail (its attribution fields, when the person may edit it).
 * @returns The sign.
 */
export function SourceAttributionNote({ detail }: { readonly detail: ContentDetail }) {
  const locale = useLocale();
  const { sourceContentId, sourceTitle, sourceLanguage, sourceAuthorName } = detail;
  if (!sourceContentId && !sourceTitle && !sourceAuthorName) return null;
  const author = sourceAuthorName ?? t('sharing.attributionUnknownAuthor', locale);
  const text = sourceTitle
    ? titledSign(sourceTitle, sourceLanguage, author, locale)
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
