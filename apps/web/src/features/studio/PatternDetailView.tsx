/**
 * PatternDetailView — one pattern's page (`/laeringsdesign/monster/[patternId]`): its name and purpose, its facts,
 * when to use it, why it works (with its citations), an example, «Lag frå dette mønsteret» and the references.
 *
 * Why: authors choose a pattern before creating from it (PED-010, PROD-001). The page is public (D-089); creating
 *      from it asks a signed-out visitor to sign in, and opens the new activity on its **Rediger** tab (D-085,
 *      ../../config/paths.ts `activityPath(id, EDIT_TAB_ID)`).
 * Spec: PED-010, PROD-001, PED-002, UD-013
 * Invariants:
 *   - The page's only `h1`: «Mønster» while loading, then the pattern's name, or «Fann ikkje sida» for an unknown
 *     pattern; the document title follows (WCAG 2.4.2).
 *   - The ID has the pattern-ID form (the page answers 404 otherwise); the API decides whether the pattern exists.
 *   - The address may carry the phase and course to pre-fill (`?fase=&emne=`, ../../config/studioFilters.ts).
 *   - Texts are the pattern's in the page language; the draft banner shows while the content is proposed.
 *   - A loaded pattern is shown even when the overview (`GET /api/studio`, the phase labels and the draft status)
 *     fails: its phases are then named by a neutral text, never by their keys, and no phase choice is offered.
 * Collaborators: ../../app/(portal)/laeringsdesign/monster/[patternId]/page.tsx, ../../api/studioApi.ts,
 *   ./useApiLoad.ts, ./pattern/PatternFacts.tsx, ./pattern/CreateFromPattern.tsx, ./guide/GuideProse.tsx,
 *   ./guide/ReferenceList.tsx, ./DraftBanner.tsx.
 * Tests: apps/web/test/features/PatternDetailView.test.tsx, apps/web/test/features/studioPages.test.tsx
 */
'use client';

import type { PhaseKey } from '@hvl-interaktiv/api-contract';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { getPatternDetail, getStudioOverview } from '../../api/studioApi';
import { catalogueHref } from '../../config/paths';
import { readStudioFilters } from '../../config/studioFilters';
import { useLocale } from '../../i18n/LocaleContext';
import { pageTitle } from '../../i18n/pageTitle';
import { t } from '../../i18n/translate';
import { DraftBanner } from './DraftBanner';
import { citationNumbers } from './guide/guideCitations';
import { GuideProse } from './guide/GuideProse';
import { ReferenceList } from './guide/ReferenceList';
import { CreateFromPattern } from './pattern/CreateFromPattern';
import { PatternFacts } from './pattern/PatternFacts';
import { useApiLoad } from './useApiLoad';

/** What the pattern page needs. */
export interface PatternDetailViewProps {
  /** The pattern's ID from the address, already in the pattern-ID form. */
  readonly patternId: string;
  /** Where to go after creating; the browser's own navigation by default. */
  readonly navigate?: (path: string) => void;
}

/** A plain text in paragraphs: an empty line starts a new one. */
const paragraphs = (text: string) => text.split(/\n\s*\n/).map((part, index) => <p key={index}>{part}</p>);

/**
 * One pattern's page content.
 * @param props - The pattern's ID, and navigation for tests.
 * @returns The page.
 */
export function PatternDetailView({
  patternId,
  navigate = (path: string) => window.location.assign(path),
}: PatternDetailViewProps) {
  const locale = useLocale();
  const query = useSearchParams();
  const detail = useApiLoad(() => getPatternDetail(patternId), patternId);
  const overview = useApiLoad(getStudioOverview, 'overview');
  const notFound = detail.status === 'failed' && detail.httpStatus === 404;
  const name = detail.status === 'loaded' ? detail.data.name[locale] : undefined;
  useEffect(() => {
    // A11Y: WCAG 2.4.2: the title names the pattern once it has loaded, or says the page was not found.
    if (name) document.title = pageTitle(name, locale);
    else if (notFound) document.title = pageTitle(t('notFound.title', locale), locale);
  }, [name, notFound, locale]);
  if (notFound)
    return (
      <>
        <h1>{t('notFound.title', locale)}</h1>
        <p>{t('patterns.notFound', locale)}</p>
        <p>
          <Link href={catalogueHref()}>{t('patterns.backToCatalogue', locale)}</Link>
        </p>
      </>
    );
  if (detail.status !== 'loaded' || overview.status === 'loading')
    return (
      <>
        <h1>{t('patterns.heading', locale)}</h1>
        {detail.status === 'failed' ? (
          <p role="alert">{t('common.loadFailed', locale)}</p>
        ) : (
          <p role="status">{t('common.loading', locale)}</p>
        )}
      </>
    );
  const pattern = detail.data;
  const labels = new Map(
    overview.status === 'loaded' ? overview.data.phases.map((phase) => [phase.key, phase.label[locale]]) : [],
  );
  // PED-001: a phase is named by its content label or not at all, so a failed overview never shows a raw key.
  const named = pattern.phases.every((key) => labels.has(key));
  const phaseLabel = named ? (key: PhaseKey) => labels.get(key) ?? '' : undefined;
  const { phase, course } = readStudioFilters(query);
  const returnTo = `${window.location.pathname}${window.location.search}`;
  return (
    <>
      <h1>{pattern.name[locale]}</h1>
      {overview.status === 'loaded' ? <DraftBanner status={overview.data.status} locale={locale} /> : null}
      <p className="text-lg">{pattern.purpose[locale]}</p>
      <PatternFacts
        pattern={pattern}
        phaseNames={phaseLabel && pattern.phases.map(phaseLabel)}
        locale={locale}
      />
      <h2>{t('patterns.whenToUse', locale)}</h2>
      {paragraphs(pattern.whenToUse[locale])}
      <h2>{t('patterns.whyItWorks', locale)}</h2>
      <GuideProse
        nodes={pattern.whyItWorks[locale]}
        locale={locale}
        citationNumber={citationNumbers(pattern.references)}
      />
      <h2>{t('patterns.example', locale)}</h2>
      {paragraphs(pattern.example[locale])}
      <CreateFromPattern
        pattern={pattern}
        locale={locale}
        carried={{ phase, course }}
        phaseLabel={phaseLabel}
        navigate={navigate}
        returnTo={returnTo}
      />
      <ReferenceList references={pattern.references} locale={locale} />
    </>
  );
}
