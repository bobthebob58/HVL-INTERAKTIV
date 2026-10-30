/**
 * Tests for a pattern's page (from a fixture pattern): its name as heading and title, facts, texts and why it works
 * with citations into its reference list; «Lag frå dette mønsteret» for a signed-in author (pre-filled from the
 * address, POST with the CSRF token, then the activity's Rediger tab), for a signed-out visitor (the login link back),
 * for a learner and for a pattern that cannot be created now; and an unknown pattern's not-found state.
 *
 * Spec: PED-010, PROD-001, UD-013
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PatternDetailView } from '../../src/features/studio/PatternDetailView';
import { LocaleProvider } from '../../src/i18n/LocaleContext';
import { errorBody, fakeFetch, type FakeRoutes } from '../support/fakeFetch';
import { resetNavigation } from '../support/nextNavigationMock';
import { DETAIL, OVERVIEW } from '../support/studioFixtures';

vi.mock('next/navigation', () => import('../support/nextNavigationMock'));

const CREATED = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
const session = (roles: string[]) => ({
  'GET /auth/session': { status: 200, body: { roles, locale: 'nn', csrfToken: 'csrf-1' } },
});
const SIGNED_OUT = { 'GET /auth/session': { status: 401, body: errorBody(401, 'hvl:unauthenticated') } };

/** Opens the fixture pattern's page at an address, with the API answers given. */
const openPattern = (
  routes: FakeRoutes,
  address = '/laeringsdesign/monster/fixture-terms',
  detail = DETAIL,
) => {
  resetNavigation(address);
  const requests = fakeFetch({
    'GET /api/studio': { status: 200, body: OVERVIEW },
    'GET /api/studio/patterns/fixture-terms': { status: 200, body: detail },
    ...routes,
  });
  const navigate = vi.fn();
  render(
    <LocaleProvider locale="nn">
      <PatternDetailView patternId="fixture-terms" navigate={navigate} />
    </LocaleProvider>,
  );
  return { requests, navigate };
};

describe('[PED-010] a pattern’s page', () => {
  afterEach(() => resetNavigation());

  it('[PED-010] names the pattern in its heading and title, with its facts, texts, citations and references', async () => {
    // Act
    openPattern(SIGNED_OUT);
    // Assert
    await screen.findByRole('heading', { level: 1, name: 'Mønster fixture-terms' });
    await vi.waitFor(() => expect(document.title).toBe('Mønster fixture-terms – HVL Interaktiv'));
    const facts = [...document.querySelectorAll('dt, dd')].map((element) => element.textContent);
    expect(facts).toEqual([
      'Fase',
      'Før, Etter',
      'Innhaldstype',
      'Dra orda, Fyll inn orda',
      'Byggjetid',
      'om lag 15 minutt',
      'Tid for studentane',
      'om lag 10 minutt',
    ]);
    expect(screen.getByText('Når omgrepa er nye.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Kjelde [1]' }).getAttribute('href')).toBe('#kjelde-ref-a');
    expect(within(screen.getByRole('region', { name: 'Kjelder' })).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('note').textContent).toContain('Utkast:');
  });

  it('[PROD-001] lets an author create in the chosen language, type and phase, pre-filled from the address, then opens Rediger', async () => {
    // Arrange
    const { requests, navigate } = openPattern(
      {
        ...session(['author']),
        'POST /api/patterns/fixture-terms/activities': { status: 201, body: { contentId: CREATED } },
      },
      '/laeringsdesign/monster/fixture-terms?fase=etterarbeid&emne=syk110',
    );
    // Act
    const form = await screen.findByRole('button', { name: 'Lag aktiviteten' });
    expect((screen.getByRole('combobox', { name: 'Språket i aktiviteten' }) as HTMLSelectElement).value).toBe(
      'nn',
    );
    expect((screen.getByRole('radio', { name: 'Etter' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('textbox', { name: 'Emnekode (valfri)' }) as HTMLInputElement).value).toBe(
      'SYK110',
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Fyll inn orda' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Språket i aktiviteten' }), {
      target: { value: 'nb' },
    });
    fireEvent.click(form);
    // Assert
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(`/aktivitet/${CREATED}?fane=edit`));
    const post = requests.find((request) => request.method === 'POST');
    expect(post?.body).toEqual({
      language: 'nb',
      phase: 'etterarbeid',
      contentType: 'H5P.Blanks',
      courseCode: 'SYK110',
    });
    expect(post?.headers['x-csrf-token']).toBe('csrf-1');
  });

  it('[PROD-001] reports a course code that is not one on the field, and sends nothing', async () => {
    // Arrange
    const { requests } = openPattern(session(['author']));
    const field = await screen.findByRole('textbox', { name: 'Emnekode (valfri)' });
    // Act
    fireEvent.change(field, { target: { value: 'ikkje ein kode!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lag aktiviteten' }));
    // Assert
    const summary = await screen.findByRole('alert');
    expect(summary.textContent).toContain('Skriv emnekoden med bokstavar og tal');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('[PROD-001] shows the server’s refusal in an alert and stays on the page', async () => {
    // Arrange
    const { navigate } = openPattern({
      ...session(['author']),
      'POST /api/patterns/fixture-terms/activities': {
        status: 409,
        body: errorBody(409, 'hvl:pattern-unavailable', 'Mønsteret kan ikkje brukast no.'),
      },
    });
    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Lag aktiviteten' }));
    // Assert
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Klarte ikkje å lage aktiviteten: Mønsteret kan ikkje brukast no.',
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('[AUTH-001] asks a signed-out visitor to log in and come back to the page with its address', async () => {
    // Act
    openPattern(SIGNED_OUT, '/laeringsdesign/monster/fixture-terms?emne=SYK110');
    // Assert
    const link = await screen.findByRole('link', { name: 'Logg inn med Feide' });
    expect(link.getAttribute('href')).toBe(
      `/auth/feide/login?returnTo=${encodeURIComponent('/laeringsdesign/monster/fixture-terms?emne=SYK110')}`,
    );
    expect(screen.getByText('Logg inn for å lage ein aktivitet frå dette mønsteret.')).toBeTruthy();
  });

  it.each([
    [
      'a signed-in learner',
      session(['learner']),
      DETAIL,
      'Berre tilsette og studentar med forfattarrolle kan lage aktivitetar frå mønster.',
    ],
    [
      'an author, for a pattern that cannot be created now',
      session(['author']),
      { ...DETAIL, available: false },
      'Du kan ikkje lage frå dette mønsteret no',
    ],
  ])('[AUTH-003] explains to %s why there is no form', async (_who, routes, detail, explanation) => {
    // Act
    openPattern(routes, undefined, detail);
    // Assert
    expect(await screen.findByText((text) => text.startsWith(explanation))).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lag aktiviteten' })).toBeNull();
  });

  it('[UD-013] says an unknown pattern was not found, in the heading and the title', async () => {
    // Act
    openPattern({
      ...SIGNED_OUT,
      'GET /api/studio/patterns/fixture-terms': { status: 404, body: errorBody(404, 'error.notFound') },
    });
    // Assert
    expect((await screen.findByRole('heading', { level: 1, name: 'Fann ikkje sida' })).tagName).toBe('H1');
    expect(screen.getByText('Det finst ikkje noko mønster med denne adressa.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Til mønsterkatalogen' }).getAttribute('href')).toBe(
      '/laeringsdesign#monsterkatalog',
    );
    await vi.waitFor(() => expect(document.title).toBe('Fann ikkje sida – HVL Interaktiv'));
  });
});
