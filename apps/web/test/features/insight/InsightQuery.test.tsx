/**
 * Tests for the Innsikt tab's choices: fixed periods only and no date field (D-106), the content versions from the
 * current one down (PROD-013), the context on the activity page, the request «Vis innsikt» makes and its announcement,
 * and a version or context the activity lacks.
 *
 * Spec: INS-006, INS-007, PROD-013, UD-006
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InsightPanel } from '../../../src/features/insight/InsightPanel';
import { errorBody, fakeFetch, type FakeRoutes } from '../../support/fakeFetch';
import {
  CONTEXTS,
  CONTEXTS_PATH,
  FINDINGS_PATH,
  ID,
  plain,
  PORTAL_PATH,
  REPORT,
  scope,
  SYK_KEY,
} from './insightAnswers';
import { FINDINGS } from './insightOtherAnswers';

const CHOSEN_PATH = `/api/content/${ID}/insight?period=14d&context=${encodeURIComponent(SYK_KEY)}&version=2`;
const CHOSEN = {
  ...REPORT,
  scope: scope({
    period: '14d',
    contentVersion: 2,
    context: { key: SYK_KEY, label: 'SYK110' },
    periodStart: '2026-10-20T22:00:00.000Z',
  }),
};

const routes = (extra: FakeRoutes = {}): FakeRoutes => ({
  [`GET ${PORTAL_PATH}`]: { status: 200, body: REPORT },
  [`GET ${CONTEXTS_PATH}`]: { status: 200, body: { contexts: CONTEXTS } },
  [`GET ${FINDINGS_PATH}`]: { status: 200, body: FINDINGS },
  ...extra,
});

const optionTexts = (name: string) =>
  [...screen.getByRole('combobox', { name }).querySelectorAll('option')].map((option) => option.textContent);

describe('[INS-007] the Innsikt tab’s choices', () => {
  it('[INS-006] offers four fixed periods, says why, and has no date field anywhere', async () => {
    // Arrange
    fakeFetch(routes());
    // Act
    const { container } = render(<InsightPanel contentId={ID} title="Celler og vev" />);
    await screen.findByRole('heading', { name: 'Deltaking' });
    // Assert
    expect(optionTexts('Periode')).toEqual([
      'Siste 7 dagar',
      'Siste 14 dagar',
      'Siste 30 dagar',
      'Sidan semesterstart',
    ]);
    const hint = screen.getByRole('combobox', { name: 'Periode' }).getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(hint)?.textContent).toMatch(/to utval til saman peike ut éin student/);
    expect(container.querySelector('input[type=date], input[type=datetime-local]')).toBeNull();
    expect(screen.getByRole('group', { name: 'Kva vil du sjå?' })).toBeTruthy();
  });

  it('[INS-007] offers the portal alone when the activity’s contexts cannot be loaded', async () => {
    // Arrange
    fakeFetch(routes({ [`GET ${CONTEXTS_PATH}`]: { status: 500, body: errorBody(500, 'error.internal') } }));
    // Act
    render(<InsightPanel contentId={ID} title="Celler og vev" />);
    await screen.findByRole('heading', { name: 'Deltaking' });
    // Assert
    await waitFor(() => expect(optionTexts('Emne')).toEqual(['Portalen (spelt utanom Canvas)']));
  });

  it('[PROD-013] offers the versions from the current one down, and only when there is more than one', async () => {
    // Arrange and act
    fakeFetch(routes());
    const { unmount } = render(<InsightPanel contentId={ID} title="Celler og vev" />);
    await screen.findByRole('heading', { name: 'Deltaking' });
    // Assert
    expect(optionTexts('Versjon av aktiviteten')).toEqual([
      'Versjon 3 (gjeldande)',
      'Versjon 2',
      'Versjon 1',
    ]);
    unmount();
    fakeFetch(
      routes({
        [`GET ${PORTAL_PATH}`]: {
          status: 200,
          body: { ...REPORT, scope: scope({ contentVersion: 1, currentVersion: 1 }) },
        },
      }),
    );
    render(<InsightPanel contentId={ID} title="Celler og vev" />);
    await screen.findByRole('heading', { name: 'Deltaking' });
    expect(screen.queryByRole('combobox', { name: 'Versjon av aktiviteten' })).toBeNull();
  });

  it('[INS-007][PROD-013] «Vis innsikt» asks for the chosen period, course and version, and says the view is updated', async () => {
    // Arrange
    const requests = fakeFetch(routes({ [`GET ${CHOSEN_PATH}`]: { status: 200, body: CHOSEN } }));
    render(<InsightPanel contentId={ID} title="Celler og vev" />);
    await screen.findByRole('heading', { name: 'Deltaking' });
    // Act
    fireEvent.change(screen.getByRole('combobox', { name: 'Periode' }), { target: { value: '14d' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Versjon av aktiviteten' }), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Emne' }), { target: { value: SYK_KEY } });
    fireEvent.click(screen.getByRole('button', { name: 'Vis innsikt' }));
    // Assert
    await waitFor(() => expect(requests.map((request) => request.path)).toContain(CHOSEN_PATH));
    const said =
      'Innsikta er oppdatert: Viser SYK110 i Canvas, siste 14 dagar (frå 21. okt. 2026), versjon 2.';
    // WHY: the tab's own region (visually hidden), not the CSV download's status below the view.
    const region = () => screen.getAllByRole('status').find((status) => status.classList.contains('sr-only'));
    await waitFor(() => expect(plain(region()?.textContent)).toBe(said));
    expect(plain(screen.getByText(/^Viser SYK110/).textContent)).toBe(
      said.replace('Innsikta er oppdatert: ', ''),
    );
  });

  it('[PROD-013] a version or course the activity lacks says so and keeps the choices', async () => {
    // Arrange
    const refused = { status: 400, body: errorBody(400, 'hvl:insight-version-unavailable') };
    fakeFetch(routes({ [`GET ${CHOSEN_PATH}`]: refused }));
    render(<InsightPanel contentId={ID} title="Celler og vev" />);
    await screen.findByRole('heading', { name: 'Deltaking' });
    // Act
    fireEvent.change(screen.getByRole('combobox', { name: 'Periode' }), { target: { value: '14d' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Versjon av aktiviteten' }), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Emne' }), { target: { value: SYK_KEY } });
    fireEvent.click(screen.getByRole('button', { name: 'Vis innsikt' }));
    // Assert
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /^Versjonen eller emnet du valde, finst ikkje/,
    );
    expect(screen.getByRole('button', { name: 'Vis innsikt' })).toBeTruthy();
  });
});
