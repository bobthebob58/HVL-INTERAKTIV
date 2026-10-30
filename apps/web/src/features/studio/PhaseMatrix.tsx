/**
 * PhaseMatrix — the phase matrix on the guide page (spec 04 §3): the three phases as columns around the *samling*,
 * with each phase's description, pedagogical purpose, recommended patterns and Canvas placement, and a link per phase
 * that filters the pattern catalogue by it.
 *
 * Why: the matrix shows authors where an activity belongs before they pick a pattern (PED-002). Its texts and labels
 *      come only from `phases.yaml` (PED-001); the recommended patterns come from the patterns' own phases, so the
 *      matrix and the catalogue cannot disagree (D-082).
 * Spec: PED-002, PED-001, PED-003
 * Invariants:
 *   - A real `<table>` with a `<caption>`, `th scope="col"` for the phases and `th scope="row"` for the aspects
 *     (WCAG 1.3.1); inside a focusable, labelled region that scrolls sideways on narrow screens (WCAG 1.4.10).
 *   - The *samling* stands between the first and the second phase, as a column of its own that says it is not
 *     authored; it is never a filter.
 *   - Each phase's filter link keeps the catalogue's other filters and the course (`catalogueHref`), and moves focus
 *     to the catalogue's heading (`focusCatalogueHeading`, WCAG 2.4.3).
 * Collaborators: ./GuideView.tsx, ../../config/paths.ts (`catalogueHref`, `patternPath`),
 *   ./catalogue/PatternCatalogue.tsx (`focusCatalogueHeading`).
 * Tests: apps/web/test/features/PhaseMatrix.test.tsx, apps/web/test/features/PatternCatalogue.test.tsx
 */
import type { Phase, PhaseKey, StudioOverview } from '@hvl-interaktiv/api-contract';
import Link from 'next/link';
import { useId, type ReactNode } from 'react';
import { catalogueHref, patternPath, type StudioFilters } from '../../config/paths';
import { t, type Locale, type MessageKey } from '../../i18n/translate';
import { focusCatalogueHeading } from './catalogue/PatternCatalogue';

/** What the matrix needs. */
export interface PhaseMatrixProps {
  readonly overview: StudioOverview;
  /** The catalogue's current filters, kept by each phase's filter link. */
  readonly filters: StudioFilters;
  readonly locale: Locale;
}

const CELL = 'border border-hvl-ink-muted p-2 align-top text-left';

function PatternLinks({ phase, overview, filters, locale }: PhaseMatrixProps & { readonly phase: PhaseKey }) {
  const label = overview.phases.find((candidate) => candidate.key === phase)?.label[locale] ?? phase;
  const patterns = overview.patterns.filter((pattern) => pattern.phases.includes(phase));
  return (
    <>
      {patterns.length === 0 ? (
        <p>{t('studio.matrixNoPatterns', locale)}</p>
      ) : (
        <ul className="mb-2 list-disc pl-5">
          {patterns.map((pattern) => (
            <li key={pattern.id}>
              <Link href={patternPath(pattern.id, { phase, course: filters.course })}>
                {pattern.name[locale]}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={catalogueHref({ ...filters, phase })} onClick={focusCatalogueHeading}>
        {t('studio.matrixFilterLink', locale, { phase: label })}
      </Link>
    </>
  );
}

/**
 * The phase matrix.
 * @param props - The overview, the catalogue's filters and the locale.
 * @returns The table in its scroll region.
 */
export function PhaseMatrix({ overview, filters, locale }: PhaseMatrixProps) {
  const captionId = useId();
  const { phases } = overview;
  const rows: readonly (readonly [MessageKey, (phase: Phase) => ReactNode])[] = [
    ['studio.matrixRowDescription', (phase) => phase.description[locale]],
    ['studio.matrixRowPurpose', (phase) => phase.purpose[locale]],
    [
      'studio.matrixRowPatterns',
      (phase) => <PatternLinks phase={phase.key} overview={overview} filters={filters} locale={locale} />,
    ],
    ['studio.matrixRowCanvas', (phase) => phase.canvasPlacement[locale]],
  ];
  // WHY: the samling's one cell spans every row, in the column after the first phase (spec 04 §1).
  const anchor = (
    <td key="samling" rowSpan={rows.length} className={`${CELL} bg-hvl-band text-hvl-ink`}>
      <p>{overview.anchor.description[locale]}</p>
      <p className="m-0">{t('studio.matrixAnchorNote', locale)}</p>
    </td>
  );
  return (
    <div role="region" aria-labelledby={captionId} tabIndex={0} className="mb-6 overflow-x-auto">
      <table className="min-w-[48rem] border-collapse bg-hvl-surface text-hvl-ink">
        <caption id={captionId} className="mb-2 text-left text-lg font-bold text-hvl-primary-dark">
          {t('studio.matrixCaption', locale)}
        </caption>
        <thead>
          <tr>
            <td className={CELL} />
            {phases.map((phase, index) => [
              <th key={phase.key} scope="col" className={CELL}>
                {phase.label[locale]}
              </th>,
              index === 0 ? (
                <th key="samling" scope="col" className={`${CELL} bg-hvl-band`}>
                  {overview.anchor.label[locale]}
                </th>
              ) : null,
            ])}
          </tr>
        </thead>
        <tbody>
          {rows.map(([labelKey, cell], row) => (
            <tr key={labelKey}>
              <th scope="row" className={`${CELL} font-bold`}>
                {t(labelKey, locale)}
              </th>
              {phases.map((phase, index) => [
                <td key={phase.key} className={CELL}>
                  {cell(phase)}
                </td>,
                index === 0 && row === 0 ? anchor : null,
              ])}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
