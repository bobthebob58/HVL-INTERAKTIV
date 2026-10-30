/**
 * mappeFixtures — answers of the pedagogisk mappe routes for the web app's component tests: a few activities, two
 * criteria sets and a preview, plus the fake routes of a signed-in author on `/mappe`.
 *
 * Why: the `/mappe` page's tests (MAPPE-001, MAPPE-002) need the same small, readable data; these are test texts,
 *      never ALU's content.
 * Spec: MAPPE-001, MAPPE-002
 * Tests: used by apps/web/test/features/MappeView.test.tsx, apps/web/test/features/MappeDownloads.test.tsx and
 *   apps/web/test/features/studioPages.test.tsx.
 */
import type { MappeActivity, MappeCriteriaSetList, MappePreview } from '@hvl-interaktiv/api-contract';
import type { FakeRoutes } from './fakeFetch';
import { OVERVIEW } from './studioFixtures';

/** A UUID for test activity `n`. */
export const activityId = (n: number): string => `0192f0c4-0000-7000-8000-${String(n).padStart(12, '0')}`;

/** Three activities: two in SYK110 (forarbeid in October, etterarbeid in September), one without course or phase. */
export const MAPPE_ACTIVITIES: readonly MappeActivity[] = [
  {
    contentId: activityId(1),
    title: 'Blodtrykk før samlinga',
    mainLibrary: 'H5P.InteractiveVideo',
    status: 'published',
    language: 'nn',
    phase: 'forarbeid',
    courseCode: 'SYK110',
    updatedAt: '2026-10-20T10:00:00.000Z',
  },
  {
    contentId: activityId(2),
    title: 'Repetisjon etter samlinga',
    mainLibrary: 'H5P.QuestionSet',
    status: 'draft',
    language: 'nb',
    phase: 'etterarbeid',
    courseCode: 'SYK110',
    updatedAt: '2026-09-15T10:00:00.000Z',
  },
  {
    contentId: activityId(3),
    title: 'Quiz without a course',
    mainLibrary: 'H5P.MultiChoice',
    status: 'draft',
    language: 'en',
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
];

/** Two criteria sets; the second has limits that are not confirmed. */
export const MAPPE_CRITERIA_SETS: MappeCriteriaSetList = {
  defaultSet: 'hvl-merittering-2025',
  sets: [
    {
      id: 'hvl-merittering-2025',
      title: { nn: 'Testsett 2025', nb: 'Testsett 2025', en: 'Test set 2025' },
      wordLimit: 7500,
      attachmentLimit: 11,
      limitsToVerify: false,
    },
    {
      id: 'fixture-2027',
      title: { nn: 'Testsett 2027', nb: 'Testsett 2027', en: 'Test set 2027' },
      wordLimit: 100,
      attachmentLimit: 2,
      limitsToVerify: true,
    },
  ],
};

/**
 * A preview answer.
 * @param overrides - Fields to change.
 * @returns The preview.
 */
export const mappePreview = (overrides: Partial<MappePreview> = {}): MappePreview => ({
  criteriaSet: 'hvl-merittering-2025',
  words: 2345,
  wordLimit: 7500,
  attachments: 3,
  attachmentLimit: 11,
  overLimit: false,
  ...overrides,
});

/**
 * The fake routes of a signed-in author on `/mappe`.
 * @param extra - More or replaced routes.
 * @returns The routes.
 */
export const mappeRoutes = (extra: FakeRoutes = {}): FakeRoutes => ({
  'GET /auth/session': { status: 200, body: { roles: ['author'], locale: 'nn', csrfToken: 'csrf-1' } },
  'GET /api/mappe/activities': { status: 200, body: { items: MAPPE_ACTIVITIES } },
  'GET /api/mappe/criteria-sets': { status: 200, body: MAPPE_CRITERIA_SETS },
  'GET /api/studio': { status: 200, body: OVERVIEW },
  'POST /api/mappe/preview': { status: 200, body: mappePreview() },
  ...extra,
});
