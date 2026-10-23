/**
 * ActivityPage — `/aktivitet/[id]`: play, edit, check and publish one activity.
 *
 * Why: PROD-003's check-and-publish gate and the editor live on the activity's own page (D-067). The page passes
 *      the ID from the address to the client view, which asks the API what the person may do with it.
 * Spec: PROD-003, LTI-006
 * Invariants:
 *   - The ID is only passed on; the API decides whether the activity exists and may be seen (D-066).
 * Collaborators: ../../../../features/activity/ActivityView.tsx.
 * Tests: apps/web/test/features/ActivityView.test.tsx, apps/server/test/web/webPages.browser.int.test.ts
 */
import { ActivityView } from '../../../../features/activity/ActivityView';

/**
 * The activity page.
 * @param props - The route parameters.
 * @returns The page content.
 */
export default async function ActivityPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ActivityView contentId={id} />;
}
