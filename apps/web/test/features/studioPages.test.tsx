/**
 * Tests for the studio pages' views: each has its one `h1` in every language; the guide and a pattern's page are
 * public: the guide reads only the public studio routes and never asks who is signed in, and a pattern's page shows
 * the pattern to anyone and asks who is signed in only for «Lag frå dette mønsteret»; the planner, the content bank
 * and the portfolio ask signed-out visitors to log in and come back, and refuse people who are not authors (D-089).
 * The pages' own requirements (PED-002, PED-031, PROD-007, MAPPE-001) are tested by the workstreams that fill them,
 * so these tests carry only the access IDs.
 *
 * Spec: AUTH-001, AUTH-003, UD-013
 */
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STUDIO_NAV_ITEMS } from '../../src/components/StudioNav';
import { BankView } from '../../src/features/bank/BankView';
import { MappeView } from '../../src/features/mappe/MappeView';
import { PlannerView } from '../../src/features/planner/PlannerView';
import { GuideView } from '../../src/features/studio/GuideView';
import { PatternDetailView } from '../../src/features/studio/PatternDetailView';
import { LocaleProvider } from '../../src/i18n/LocaleContext';
import type { Locale } from '../../src/i18n/translate';
import { errorBody, fakeFetch } from '../support/fakeFetch';
import { DETAIL, OVERVIEW, studioRoutes } from '../support/studioFixtures';

vi.mock('next/navigation', () => import('../support/nextNavigationMock'));

const PatternView = () => <PatternDetailView patternId="fa-video" />;
const SIGNED_OUT = { 'GET /auth/session': { status: 401, body: errorBody(401, 'hvl:unauthenticated') } };

const AUTHOR_PAGES = [
  ['PlannerView', PlannerView, 'Planleggar for læringsutbytte og fasar', '/laeringsdesign/planlegg'],
  ['BankView', BankView, 'Innhaldsbanken til HVL', '/laeringsdesign/innhaldsbank'],
  ['MappeView', MappeView, 'Pedagogisk mappe', '/mappe'],
] as const;

const inLocale = (locale: Locale, View: ComponentType) =>
  render(
    <LocaleProvider locale={locale}>
      <View />
    </LocaleProvider>,
  );

describe('[UD-013] the studio pages', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it.each([
    [
      'GuideView',
      GuideView,
      ['Studentaktiv læring med «HVL læringsdesign»', 'Student-active learning with “HVL læringsdesign”'],
    ],
    ['PatternDetailView', PatternView, ['Mønster', 'Pattern']],
    [
      'PlannerView',
      PlannerView,
      ['Planleggar for læringsutbytte og fasar', 'Planner for learning outcomes and phases'],
    ],
    ['BankView', BankView, ['Innhaldsbanken til HVL', 'The HVL content bank']],
    ['MappeView', MappeView, ['Pedagogisk mappe', 'Teaching portfolio']],
  ] as const)('[UD-013] %s has one h1 in Nynorsk and in English', (_name, View, [nn, en]) => {
    // Arrange
    fakeFetch(SIGNED_OUT);
    // Act
    const { unmount } = inLocale('nn', View);
    const nynorsk = screen.getAllByRole('heading', { level: 1 }).map((heading) => heading.textContent);
    unmount();
    inLocale('en', View);
    // Assert
    expect(nynorsk).toEqual([nn]);
    expect(screen.getAllByRole('heading', { level: 1 }).map((heading) => heading.textContent)).toEqual([en]);
  });

  it('[AUTH-003] GuideView is public: it reads only the public studio routes, sends no credential and never asks who is signed in', async () => {
    // Arrange
    const requests = fakeFetch(studioRoutes());
    // Act
    inLocale('nn', GuideView);
    await screen.findByRole('region', { name: 'Mønsterkatalogen' });
    // Assert
    expect(requests.map((request) => request.path).sort()).toEqual(['/api/studio', '/api/studio/guide/nn']);
    expect(requests.every(({ headers }) => !headers.Authorization && !headers['x-csrf-token'])).toBe(true);
    expect(screen.queryByRole('link', { name: 'Logg inn med Feide' })).toBeNull();
  });

  it('[AUTH-003] PatternDetailView shows the pattern signed out; only «Lag frå dette mønsteret» asks who is signed in', async () => {
    // Arrange
    const requests = fakeFetch({
      ...SIGNED_OUT,
      'GET /api/studio': { status: 200, body: OVERVIEW },
      'GET /api/studio/patterns/fa-video': { status: 200, body: { ...DETAIL, id: 'fa-video' } },
    });
    // Act
    inLocale('nn', PatternView);
    const create = await screen.findByRole('region', { name: 'Lag frå dette mønsteret' });
    // Assert
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(DETAIL.name.nn);
    expect(requests.map((request) => request.path).sort()).toEqual([
      '/api/studio',
      '/api/studio/patterns/fa-video',
      '/auth/session',
    ]);
    expect(await within(create).findByRole('link', { name: 'Logg inn med Feide' })).toBeTruthy();
  });

  it.each(AUTHOR_PAGES)(
    '[AUTH-001] %s asks a signed-out visitor to log in and come back to it',
    async (_name, View, heading, path) => {
      // Arrange
      window.history.replaceState(null, '', path);
      fakeFetch(SIGNED_OUT);
      // Act
      inLocale('nn', View);
      // Assert
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(heading);
      const link = await screen.findByRole('link', { name: 'Logg inn med Feide' });
      expect(link.getAttribute('href')).toBe(`/auth/feide/login?returnTo=${encodeURIComponent(path)}`);
    },
  );

  it.each(AUTHOR_PAGES)('[AUTH-003] %s refuses a signed-in learner', async (_name, View) => {
    fakeFetch({
      'GET /auth/session': { status: 200, body: { roles: ['learner'], locale: 'nn', csrfToken: 'c' } },
    });
    inLocale('nn', View);
    expect((await screen.findByRole('alert')).textContent).toContain('forfattarrolle');
  });

  it.each(AUTHOR_PAGES)(
    '[AUTH-003] %s shows a signed-in author no refusal and no login link',
    async (_name, View) => {
      // Arrange
      const requests = fakeFetch({
        'GET /auth/session': { status: 200, body: { roles: ['author'], locale: 'nn', csrfToken: 'c' } },
        // WHY: the planner (W3) first lists the author's course codes; an author with none gets the chooser's text.
        'GET /api/learning-design/course-codes': { status: 200, body: { inUse: [], fromCanvas: [] } },
      });
      // Act
      inLocale('nn', View);
      // Assert
      await screen.findByRole('heading', { level: 1 });
      await expect.poll(() => screen.queryByRole('status')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByRole('link', { name: 'Logg inn med Feide' })).toBeNull();
      // WHY: the session comes first; a page's own data comes from the Express API only (D-068).
      const paths = requests.map((request) => request.path);
      expect(paths[0]).toBe('/auth/session');
      expect(paths.slice(1).every((path) => path.startsWith('/api/'))).toBe(true);
    },
  );

  it('[UD-013] every author page is in the main menu for authors, in the same order', () => {
    expect(AUTHOR_PAGES.map(([, , , path]) => path)).toEqual(
      STUDIO_NAV_ITEMS.filter((item) => item.authorsOnly).map((item) => item.href),
    );
  });
});
