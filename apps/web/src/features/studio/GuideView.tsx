/**
 * GuideView — the læringsdesign guide's content (`/laeringsdesign`): the page heading, the draft banner, the guide in
 * the page's language with the phase matrix and the pattern catalogue where its markers stand, and the references it
 * cites.
 *
 * Why: the guide explains why asynchronous work often fails and what helps, with the phase matrix and the pattern
 *      catalogue (PED-002, PED-003). Its texts live in `content/` and come from the server as a closed node tree
 *      (D-082, D-083). The guide and the catalogue are public (D-089), so nothing here asks who is signed in.
 * Spec: PED-002, PED-003, PED-001
 * Invariants:
 *   - The page's only `h1`; the guide's own headings start at `h2` (D-083).
 *   - Before a guide is written (no nodes), and if it cannot be loaded, the matrix and the catalogue are shown alone;
 *     a marker the guide lacks is placed at its end, so neither component is ever missing.
 *   - The catalogue's filters live in the address (./catalogue/useCatalogueFilters.ts); its section has the `id`
 *     `CATALOGUE_ID` (../../config/paths.ts).
 * Collaborators: ../../app/(portal)/laeringsdesign/page.tsx, ../../api/studioApi.ts, ./useApiLoad.ts,
 *   ./guide/GuideBlocks.tsx, ./guide/ReferenceList.tsx, ./PhaseMatrix.tsx, ./catalogue/PatternCatalogue.tsx,
 *   ./DraftBanner.tsx.
 * Tests: apps/web/test/features/GuideView.test.tsx, apps/web/test/features/studioPages.test.tsx
 */
'use client';

import type { GuideBlockNode, StudioOverview } from '@hvl-interaktiv/api-contract';
import { getStudioGuide, getStudioOverview } from '../../api/studioApi';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { PatternCatalogue } from './catalogue/PatternCatalogue';
import { useCatalogueFilters } from './catalogue/useCatalogueFilters';
import { DraftBanner } from './DraftBanner';
import { GuideBlocks, type GuideMarkerName } from './guide/GuideBlocks';
import { citationNumbers } from './guide/guideCitations';
import { ReferenceList } from './guide/ReferenceList';
import { PhaseMatrix } from './PhaseMatrix';
import { useApiLoad } from './useApiLoad';

const MARKERS: readonly GuideMarkerName[] = ['phase-matrix', 'pattern-catalogue'];

/** The guide's nodes with every marker it lacks added at the end, in the page's order. */
const withEveryMarker = (nodes: readonly GuideBlockNode[]): GuideBlockNode[] => [
  ...nodes,
  ...MARKERS.filter((name) => !nodes.some((node) => node.type === 'marker' && node.name === name)).map(
    (name): GuideBlockNode => ({ type: 'marker', name }),
  ),
];

/**
 * The guide page's content.
 * @returns The heading, then the guide with the matrix and the catalogue, or the loading or failed state.
 */
export function GuideView() {
  const locale = useLocale();
  const overview = useApiLoad(getStudioOverview, 'overview');
  const guide = useApiLoad(() => getStudioGuide(locale), locale);
  const [filters, setFilters] = useCatalogueFilters();
  const loading = overview.status === 'loading' || guide.status === 'loading';
  const failed = overview.status === 'failed' || guide.status === 'failed';
  const nodes = guide.status === 'loaded' ? guide.data.nodes : [];
  const references = guide.status === 'loaded' ? guide.data.references : [];
  const renderMarker = (studio: StudioOverview) => (name: GuideMarkerName) =>
    name === 'phase-matrix' ? (
      <PhaseMatrix overview={studio} filters={filters} locale={locale} />
    ) : (
      <PatternCatalogue overview={studio} filters={filters} onFiltersChange={setFilters} locale={locale} />
    );
  return (
    <>
      <h1>{t('studio.heading', locale)}</h1>
      {loading ? <p role="status">{t('common.loading', locale)}</p> : null}
      {!loading && failed ? <p role="alert">{t('common.loadFailed', locale)}</p> : null}
      {!loading && overview.status === 'loaded' ? (
        <>
          <DraftBanner status={overview.data.status} locale={locale} />
          {guide.status === 'loaded' && nodes.length === 0 ? <p>{t('studio.noGuideYet', locale)}</p> : null}
          <GuideBlocks
            nodes={withEveryMarker(nodes)}
            locale={locale}
            citationNumber={citationNumbers(references)}
            renderMarker={renderMarker(overview.data)}
          />
          <ReferenceList references={references} locale={locale} />
        </>
      ) : null}
    </>
  );
}
