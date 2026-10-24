/**
 * AppPlayPage — `/app/play`, the page Canvas shows in its iframe after a resource-link launch: the player and, for
 * authors, the editor, inside the Canvas chrome.
 *
 * Why: LTI-006 and D-067: Express resolves the ltik and the View right before Next.js runs, and passes the launch in
 *      the `x-hvli-launch` header (./../../../lti/launchHeader.ts). Without a valid header there is no launch, and
 *      the page says to open the activity again from Canvas.
 * Spec: LTI-006, LTI-003, DATA-006
 * Invariants:
 *   - The server component never sees the ltik; the client view reads it from the address bar (D-069).
 * Collaborators: ../../../lti/launchHeader.ts, ../../../features/lti/LtiPlayView.tsx, ../../../features/lti/LtiChrome.tsx.
 * Tests: apps/web/test/lti/launchHeader.test.ts, apps/server/test/web/webPages.browser.int.test.ts
 */
import type { Metadata } from 'next';
import { LtiChrome } from '../../../features/lti/LtiChrome';
import { LtiPlayView, NoLaunch } from '../../../features/lti/LtiPlayView';
import { requestLocale } from '../../../i18n/requestLocale';
import { t } from '../../../i18n/translate';
import { requestLaunch } from '../../../lti/launchHeader';

/**
 * The page title: the activity's title when there is a launch, else what to do (WCAG 2.4.2; the root layout adds
 * the site name).
 * @returns The page metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [locale, launch] = await Promise.all([requestLocale(), requestLaunch()]);
  return { title: launch ? launch.title : t('lti.noLaunchTitle', locale) };
}

/**
 * The Canvas page.
 * @returns The page content.
 */
export default async function AppPlayPage() {
  const [locale, launch] = await Promise.all([requestLocale(), requestLaunch()]);
  return <LtiChrome locale={locale}>{launch ? <LtiPlayView launch={launch} /> : <NoLaunch />}</LtiChrome>;
}
