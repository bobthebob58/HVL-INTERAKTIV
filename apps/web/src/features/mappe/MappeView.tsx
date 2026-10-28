/**
 * MappeView — the pedagogisk mappe page's content (`/mappe`): pick activities, see the word count, and export the
 * portfolio draft as Markdown or PDF.
 *
 * Why: MAPPE-001 turns an author's activities and their reasoning into a draft for a teaching portfolio (D-094). It
 *      reads the author's own and co-authored activities, so it is for signed-in authors only (D-089). The export
 *      is a file answer (../../api/apiRequest.ts `apiFileRequest`, D-099) that the server never stores (MAPPE-003).
 * Spec: MAPPE-001, MAPPE-003, AUTH-001
 * Invariants:
 *   - The heading is always shown; the content only to a signed-in author (../../components/AuthorGate.tsx).
 * Collaborators: ../../app/(portal)/mappe/page.tsx, ../../components/AuthorGate.tsx, ../../api/apiRequest.ts.
 * Tests: apps/web/test/features/studioPages.test.tsx
 */
'use client';

import { AuthorGate } from '../../components/AuthorGate';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';

/**
 * The portfolio page's content.
 * @returns The heading and, for authors, the export.
 */
export function MappeView() {
  const locale = useLocale();
  return (
    <>
      <h1>{t('mappe.heading', locale)}</h1>
      <AuthorGate>{() => null}</AuthorGate>
    </>
  );
}
