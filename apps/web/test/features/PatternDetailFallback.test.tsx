/**
 * Tests for a pattern's page when the studio overview (`GET /api/studio`, the phase labels) cannot be loaded: the
 * loaded pattern is still shown with its facts and texts, its phases are named by a neutral text and never by their
 * keys, no phase choice is offered, and creating still works with the phase the address carried.
 *
 * Spec: PED-010, PED-001, PROD-001
 */
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PatternDetailView } from '../../src/features/studio/PatternDetailView';
import { LocaleProvider } from '../../src/i18n/LocaleContext';
import { errorBody, fakeFetch } from '../support/fakeFetch';
import { resetNavigation } from '../support/nextNavigationMock';
import { DETAIL } from '../support/studioFixtures';

vi.mock('next/navigation', () => import('../support/nextNavigationMock'));

const CREATED = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
const SESSION = { status: 200, body: { roles: ['author'], locale: 'nn', csrfToken: 'csrf-1' } };
/** The neutral texts of apps/web/src/i18n/locales/nn.json (`patterns.phasesUnavailable`, `patterns.phaseLater`). */
const NO_NAMES = 'Namna på fasane kunne ikkje hentast no.';
const LATER = 'Når aktiviteten er laga, kan du velje fase på fana Læringsdesign.';

/** Opens the fixture pattern's page with the overview answering `overviewStatus`. */
const openWithoutOverview = (overviewStatus: number) => {
  resetNavigation('/laeringsdesign/monster/fixture-terms?fase=etterarbeid');
  const requests = fakeFetch({
    'GET /api/studio': { status: overviewStatus, body: errorBody(overviewStatus, 'error.internal') },
    'GET /api/studio/patterns/fixture-terms': { status: 200, body: DETAIL },
    'GET /auth/session': SESSION,
    'POST /api/patterns/fixture-terms/activities': { status: 201, body: { contentId: CREATED } },
  });
  const navigate = vi.fn();
  render(
    <LocaleProvider locale="nn">
      <PatternDetailView patternId="fixture-terms" navigate={navigate} />
    </LocaleProvider>,
  );
  return { requests, navigate };
};

describe('[PED-010] a pattern’s page without the studio overview', () => {
  afterEach(() => resetNavigation());

  it.each([500, 0])(
    '[PED-001] shows the pattern when GET /api/studio answers %i, naming no phase by its key',
    async (status) => {
      // Act
      openWithoutOverview(status);
      // Assert
      await screen.findByRole('heading', { level: 1, name: 'Mønster fixture-terms' });
      const facts = [...document.querySelectorAll('dt, dd')].map((element) => element.textContent);
      expect(facts.slice(0, 2)).toEqual(['Fase', NO_NAMES]);
      expect(screen.getByText('Når omgrepa er nye.')).toBeTruthy();
      expect(document.body.textContent).not.toMatch(/forarbeid|etterarbeid/);
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );

  it('[PROD-001] offers no phase choice without the labels, says where to choose it, and creates with the carried phase', async () => {
    // Arrange
    const { requests, navigate } = openWithoutOverview(500);
    const submit = await screen.findByRole('button', { name: 'Lag aktiviteten' });
    // Act
    fireEvent.click(submit);
    // Assert
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(`/aktivitet/${CREATED}?fane=edit`));
    expect(screen.queryByRole('group', { name: 'Fase' })).toBeNull();
    expect(screen.getByText((text) => text.endsWith(LATER))).toBeTruthy();
    const post = requests.find((request) => request.method === 'POST');
    expect(post?.body).toMatchObject({ language: 'nn', phase: 'etterarbeid' });
  });
});
