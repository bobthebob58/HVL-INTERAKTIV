/**
 * NewActivityPage — `/aktivitet/ny`: create an activity in H5P's editor; after the first save, go to its page.
 *
 * Why: authors start new activities here (H5P-002); the editor is Express's `/h5p/new` page in a frame (D-067).
 * Spec: H5P-002, PROD-011, UD-013
 * Collaborators: ../../../../features/activity/NewActivityView.tsx, ../../../layout.tsx (title template).
 * Tests: apps/web/test/features/NewActivityView.test.tsx, apps/server/test/web/webPages.browser.int.test.ts
 */
import type { Metadata } from 'next';
import { NewActivityView } from '../../../../features/activity/NewActivityView';
import { requestLocale } from '../../../../i18n/requestLocale';
import { t } from '../../../../i18n/translate';

/**
 * The page title, "Ny aktivitet – HVL Interaktiv" (WCAG 2.4.2).
 * @returns The page metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
  return { title: t('newActivity.title', await requestLocale()) };
}

/**
 * The new-activity page.
 * @returns The page content.
 */
export default function NewActivityPage() {
  return <NewActivityView />;
}
