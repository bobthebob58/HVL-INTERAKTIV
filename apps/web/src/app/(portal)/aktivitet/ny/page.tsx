/**
 * NewActivityPage — `/aktivitet/ny`: create an activity in H5P's editor; after the first save, go to its page.
 *
 * Why: authors start new activities here (H5P-002); the editor is Express's `/h5p/new` page in a frame (D-067).
 * Spec: H5P-002, PROD-011
 * Collaborators: ../../../../features/activity/NewActivityView.tsx.
 * Tests: apps/web/test/features/NewActivityView.test.tsx, apps/server/test/web/webPages.browser.int.test.ts
 */
import { NewActivityView } from '../../../../features/activity/NewActivityView';

/**
 * The new-activity page.
 * @returns The page content.
 */
export default function NewActivityPage() {
  return <NewActivityView />;
}
