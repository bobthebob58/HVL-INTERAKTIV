/**
 * ActivityList — the person's activities on the start page: title (a link to the activity), status, type, role and
 * when it last changed.
 *
 * Why: authors work from their own and co-authored activities (PROD-003, PROD-007); each one's status must be
 *      visible as a word, not colour alone (UD-003). A list of headed items reflows at 320 px, where a table would
 *      scroll sideways (UD-008).
 * Spec: PROD-003, UD-003, UD-008
 * Invariants:
 *   - Items keep the server's order (newest change first).
 *   - The type is the content type's name in the page language; an unknown type shows its machine name.
 * Collaborators: ./PortalHome.tsx, ../../components/StatusBadge.tsx, ../../i18n/contentTypeName.ts.
 * Tests: apps/web/test/features/PortalHome.test.tsx
 */
'use client';

import type { ContentSummary } from '@hvl-interaktiv/api-contract';
import { StatusBadge } from '../../components/StatusBadge';
import { activityPath } from '../../config/paths';
import { contentTypeName } from '../../i18n/contentTypeName';
import { formatDateTime } from '../../i18n/formatDate';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/**
 * The list of activities.
 * @param props - The activities from `GET /api/content`.
 * @returns The list, or a sentence when there are none.
 */
export function ActivityList({ items }: { readonly items: readonly ContentSummary[] }) {
  const locale = useLocale();
  if (items.length === 0) return <p>{t('home.empty', locale)}</p>;
  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {items.map((item) => (
        <li key={item.id} className="rounded bg-hvl-surface p-4">
          <h3 className="mb-1">
            <a href={activityPath(item.id)} className="link-target">
              {item.title}
            </a>
          </h3>
          <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusBadge status={item.status} locale={locale} />
            <span>{t('home.type', locale, { type: contentTypeName(item.mainLibrary, locale) })}</span>
            <span>{t('home.role', locale, { role: t(`role.${item.role}`, locale) })}</span>
            <span className="text-hvl-ink-muted">
              {t('home.updated', locale, { date: formatDateTime(item.updatedAt, locale) })}
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}
