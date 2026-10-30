/**
 * PatternPage — `/laeringsdesign/monster/[patternId]`: one pattern, and «Lag frå dette mønsteret», for everyone.
 *
 * Why: a pattern's page explains when to use it and why it works before an author creates from it (PED-010,
 *      PROD-001). It is public like the catalogue (D-089); creating asks a signed-out visitor to sign in.
 * Spec: PED-010, PROD-001, UD-013
 * Invariants:
 *   - An ID that cannot be a pattern ID (../../../../../config/studioFilters.ts `isPatternId`) answers 404 at once;
 *     any other ID is passed on, and the API decides whether the pattern exists.
 *   - Titled "Mønster – HVL Interaktiv" until the view has loaded the pattern, and "Fann ikkje sida – HVL Interaktiv"
 *     with the 404 (WCAG 2.4.2).
 * Collaborators: ../../../../../features/studio/PatternDetailView.tsx, ../../../../not-found.tsx.
 * Tests: apps/web/test/features/studioPages.test.tsx, apps/server/test/web/webPages.browser.int.test.ts
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isPatternId } from '../../../../../config/studioFilters';
import { PatternDetailView } from '../../../../../features/studio/PatternDetailView';
import { requestLocale } from '../../../../../i18n/requestLocale';
import { t } from '../../../../../i18n/translate';

/** The route parameters of a pattern's page. */
type PatternPageProps = { readonly params: Promise<{ patternId: string }> };

/**
 * The page title until the pattern has loaded, or the 404 page's title for an ID that cannot exist.
 * @param props - The route parameters.
 * @returns The page metadata.
 */
export async function generateMetadata({ params }: PatternPageProps): Promise<Metadata> {
  const [{ patternId }, locale] = await Promise.all([params, requestLocale()]);
  // WHY: Next.js keeps the page's own metadata when the page then calls `notFound()`.
  return { title: t(isPatternId(patternId) ? 'patterns.pageTitle' : 'notFound.title', locale) };
}

/**
 * The pattern page.
 * @param props - The route parameters.
 * @returns The page content, or the 404 page for an ID that cannot exist.
 */
export default async function PatternPage({ params }: PatternPageProps) {
  const { patternId } = await params;
  if (!isPatternId(patternId)) notFound();
  return <PatternDetailView patternId={patternId} />;
}
