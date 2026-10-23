/**
 * HomePage — `/`, the portal's start page: Feide login when signed out; the person's activities when signed in.
 *
 * Why: Feide login returns here and logout ends here (AUTH-001, AUTH-003). The page is a shell; its content is
 *      fetched in the browser from the Express API, because the web app never sees the session cookie (D-068).
 * Spec: AUTH-001, AUTH-003, PROD-003
 * Collaborators: ../../features/portal/PortalHome.tsx.
 * Tests: apps/web/test/features/PortalHome.test.tsx, apps/server/test/web/webPages.browser.int.test.ts
 */
import { PortalHome } from '../../features/portal/PortalHome';

/**
 * The start page.
 * @returns The page content.
 */
export default function HomePage() {
  return <PortalHome />;
}
