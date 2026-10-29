/**
 * MappeWorkspace — the pedagogisk mappe export for a signed-in author: the filters, the activity picker, the criteria
 * set and language, the live word count and the two downloads.
 *
 * Why: MAPPE-001 selects activities (filtered by course, phase or date) and exports Markdown and PDF; MAPPE-002
 *      shows Del 1's word count against the set's limit. The phase labels come from content (`GET /api/studio`,
 *      PED-001). While the mappe files are not in the content yet, the server answers `hvl:mappe-not-ready` and the
 *      page says so instead of offering an export that cannot work.
 * Spec: MAPPE-001, MAPPE-002, MAPPE-003, PED-001
 * Invariants:
 *   - Only the author's own and co-authored activities are offered: the server decides.
 *   - The request names the chosen activities in the list's order (newest change first), at most
 *     `MAPPE_MAX_ACTIVITIES`; the portfolio's language starts as the page's.
 *   - The note that students' results come later (D-095) is always shown with the export.
 * Collaborators: ./MappeView.tsx, ./MappeFilters.tsx, ./MappeActivityPicker.tsx, ./MappeOptions.tsx,
 *   ./MappeWordCount.tsx, ./MappeDownloads.tsx, ./useMappePreview.ts, ./mappeFilter.ts, ../../api/mappeApi.ts,
 *   ../../api/learningDesignApi.ts (`getStudioPhases`).
 * Tests: apps/web/test/features/MappeView.test.tsx, apps/web/test/features/MappeDownloads.test.tsx
 */
'use client';

import type {
  MappeActivityList,
  MappeCriteriaSetList,
  MappeRequest,
  PhaseKey,
  StudioOverview,
} from '@hvl-interaktiv/api-contract';
import { useEffect, useMemo, useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { getStudioPhases } from '../../api/learningDesignApi';
import { getMappeActivities, getMappeCriteriaSets } from '../../api/mappeApi';
import { useLocale } from '../../i18n/LocaleContext';
import { t, type Locale } from '../../i18n/translate';
import { MappeActivityPicker } from './MappeActivityPicker';
import { MappeDownloads } from './MappeDownloads';
import { courseCodesOf, filterMappeActivities, NO_FILTERS } from './mappeFilter';
import { MappeFilters } from './MappeFilters';
import { MappeOptions } from './MappeOptions';
import { MappeWordCount } from './MappeWordCount';
import { useMappePreview } from './useMappePreview';

/** The most activities one portfolio may include; the contract's `MAPPE_MAX_ACTIVITIES` (a test keeps them equal). */
export const MAPPE_PICK_LIMIT = 50;

type Loaded<T> = T | 'loading' | 'failed';

/**
 * The export for a signed-in author.
 * @returns The workspace, or a status while it loads, or why it cannot be shown.
 */
export function MappeWorkspace() {
  const locale = useLocale();
  const auth = useApiAuth();
  const [activities, setActivities] = useState<Loaded<MappeActivityList>>('loading');
  const [sets, setSets] = useState<Loaded<MappeCriteriaSetList> | 'not-ready'>('loading');
  const [overview, setOverview] = useState<Loaded<StudioOverview>>('loading');
  const [filters, setFilters] = useState(NO_FILTERS);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [criteriaSet, setCriteriaSet] = useState<string>();
  const [language, setLanguage] = useState<Locale>(locale);

  useEffect(() => {
    let active = true;
    void getMappeActivities(auth).then((r) => active && setActivities(r.ok ? r.data : 'failed'));
    void getMappeCriteriaSets(auth).then(
      (r) =>
        active &&
        setSets(r.ok ? r.data : r.error?.errorCode === 'hvl:mappe-not-ready' ? 'not-ready' : 'failed'),
    );
    void getStudioPhases(auth).then((r) => active && setOverview(r.ok ? r.data : 'failed'));
    return () => {
      active = false;
    };
  }, [auth]);

  const items = useMemo(() => (typeof activities === 'string' ? [] : activities.items), [activities]);
  const request = useMemo<MappeRequest | undefined>(() => {
    const contentIds = items.filter((item) => chosen.has(item.contentId)).map((item) => item.contentId);
    if (contentIds.length === 0 || typeof sets === 'string') return undefined;
    return { contentIds, criteriaSet: criteriaSet ?? sets.defaultSet, locale: language };
  }, [items, chosen, sets, criteriaSet, language]);
  const preview = useMappePreview(request, auth);

  if (sets === 'not-ready') return <p>{t('mappe.notReady', locale)}</p>;
  if (sets === 'loading' || activities === 'loading' || overview === 'loading')
    return <p role="status">{t('common.loading', locale)}</p>;
  if (sets === 'failed' || activities === 'failed' || overview === 'failed')
    return <p role="alert">{t('common.loadFailed', locale)}</p>;
  if (items.length === 0) return <p>{t('mappe.noActivities', locale)}</p>;

  const labels = new Map(overview.phases.map((phase) => [phase.key, phase.label[locale]]));
  const phaseLabel = (phase: PhaseKey): string => labels.get(phase) ?? phase;
  const shown = filterMappeActivities(items, filters);
  return (
    <>
      <MappeFilters
        filters={filters}
        onChange={setFilters}
        courseCodes={courseCodesOf(items)}
        phases={overview.phases.map((phase) => ({ key: phase.key, label: phase.label[locale] }))}
        shown={shown.length}
        total={items.length}
      />
      <MappeActivityPicker
        items={shown}
        chosen={chosen}
        onChange={setChosen}
        max={MAPPE_PICK_LIMIT}
        phaseLabel={phaseLabel}
      />
      <MappeOptions
        sets={sets.sets}
        criteriaSet={criteriaSet ?? sets.defaultSet}
        onCriteriaSet={setCriteriaSet}
        language={language}
        onLanguage={setLanguage}
      />
      <MappeWordCount state={preview} />
      <p>{t('mappe.noResultsNote', locale)}</p>
      <MappeDownloads request={request} />
    </>
  );
}
