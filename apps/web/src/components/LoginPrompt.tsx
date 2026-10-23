/**
 * LoginPrompt — what a portal page shows when nobody is signed in: why, and the Feide login link back to this page.
 *
 * Why: portal pages fetch their data in the browser (D-068), so a signed-out visitor learns in the page that they
 *      must log in. Login uses Feide only, with no cognitive test (UD-013, WCAG 3.3.8), and returns to the same page.
 * Spec: AUTH-001, UD-013
 * Invariants:
 *   - `returnTo` is a local path; the server reduces it to one again (apps/server/src/auth/returnTo.ts).
 * Collaborators: ../config/paths.ts (`loginHref`), ../features/portal/PortalHome.tsx, ../features/activity/*.
 * Tests: apps/web/test/components/LoginPrompt.test.tsx
 */
import { loginHref } from '../config/paths';
import { t, type Locale } from '../i18n/translate';

/**
 * The signed-out state of a page.
 * @param props - The locale, the explanation to show and the path to return to.
 * @returns A paragraph and the login link.
 */
export function LoginPrompt({
  locale,
  message,
  returnTo,
}: {
  readonly locale: Locale;
  readonly message: string;
  readonly returnTo?: string;
}) {
  return (
    <div>
      <p>{message}</p>
      <p>
        <a href={loginHref(returnTo)} className="button-primary">
          {t('login.action', locale)}
        </a>
      </p>
    </div>
  );
}
