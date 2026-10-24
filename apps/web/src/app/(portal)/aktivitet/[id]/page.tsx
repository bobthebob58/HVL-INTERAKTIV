/**
 * ActivityPage — `/aktivitet/[id]`: play, edit, check and publish one activity.
 *
 * Why: PROD-003's check-and-publish gate and the editor live on the activity's own page (D-067). The page passes
 *      the ID from the address to the client view, which asks the API what the person may do with it.
 * Spec: PROD-003, LTI-006, UD-013
 * Invariants:
 *   - The ID is only passed on; the API decides whether the activity exists and may be seen (D-066).
 *   - The server knows no activity title (the web app never sees the session, D-068), so the page is titled
 *     "Aktivitet – HVL Interaktiv" until the view has loaded the activity and puts its title first (WCAG 2.4.2).
 * Collaborators: ../../../../features/activity/ActivityView.tsx.
 * Tests: apps/web/test/features/ActivityView.test.tsx, apps/server/test/web/webPages.browser.int.test.ts
 */
import type { Metadata } from 'next';
import { ActivityView } from '../../../../features/activity/ActivityView';
import { requestLocale } from '../../../../i18n/requestLocale';
import { t } from '../../../../i18n/translate';

/**
 * The page title until the activity has loaded.
 * @returns The page metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: t('activity.pageTitle', await requestLocale()) };
}

/**
 * The activity page.
 * @param props - The route parameters.
 * @returns The page content.
 */
export default async function ActivityPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ActivityView contentId={id} />;
}
