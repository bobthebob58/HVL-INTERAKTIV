/**
 * Tests for the Innsikt tab when a period holds more answers than one view covers (422, D-122): the tab says so
 * and what to do, keeps the period, version and course choices (also when it is the first view), shows a view
 * again once a shorter period is chosen, and announces a repeated refusal again.
 *
 * Spec: INS-001, UD-013
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InsightPanel } from '../../../src/features/insight/InsightPanel';
import { errorBody, fakeFetch, type FakeRoutes } from '../../support/fakeFetch';
import { CONTEXTS, CONTEXTS_PATH, FINDINGS_PATH, ID, PORTAL_PATH, REPORT, scope } from './insightAnswers';
import { FINDINGS } from './insightOtherAnswers';

const VIEW = `/api/content/${ID}/insight`;
const TOO_LARGE = { status: 422, body: errorBody(422, 'insight.viewTooLarge') };
const routes = (extra: FakeRoutes = {}): FakeRoutes => ({
  [`GET ${PORTAL_PATH}`]: { status: 200, body: REPORT },
  [`GET ${CONTEXTS_PATH}`]: { status: 200, body: { contexts: CONTEXTS } },
  [`GET ${FINDINGS_PATH}`]: { status: 200, body: FINDINGS },
  ...extra,
});
const choose = (name: string, value: string) =>
  fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });
const show = () => fireEvent.click(screen.getByRole('button', { name: 'Vis innsikt' }));

describe('[INS-001] the Innsikt tab for a period with more answers than one view covers', () => {
  it('[INS-001] says so and what to do, keeps the choices, and shows a view again for a shorter period', async () => {
    // Arrange
    fakeFetch(routes({ [`GET ${VIEW}?period=semester&context=portal`]: TOO_LARGE }));
    render(<InsightPanel contentId={ID} title="Celler og vev" />);
    await screen.findByRole('heading', { name: 'Deltaking' });
    // Act
    choose('Periode', 'semester');
    show();
    const alert = await screen.findByRole('alert');
    // Assert: the message, in place of the view, with the choices still there
    expect(alert.textContent).toBe(
      'Denne perioden har for mange svar til at innsikta kan visast samla. Vel ein kortare periode og trykk ' +
        '«Vis innsikt». Hjelper ikkje det, ta kontakt med ein administrator.',
    );
    expect(screen.queryByRole('heading', { name: 'Deltaking' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Periode' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Versjon av aktiviteten' })).toBeTruthy();
    // Act: a shorter period
    choose('Periode', '7d');
    show();
    // Assert
    await screen.findByRole('heading', { name: 'Deltaking' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('[INS-001] keeps the choices when the first view is the one refused', async () => {
    // Arrange: the first view (7 days) is over the limit, 14 days is not
    const fortnight = { status: 200, body: { ...REPORT, scope: scope({ period: '14d' }) } };
    fakeFetch(
      routes({ [`GET ${PORTAL_PATH}`]: TOO_LARGE, [`GET ${VIEW}?period=14d&context=portal`]: fortnight }),
    );
    // Act
    render(<InsightPanel contentId={ID} title="Celler og vev" />);
    const alert = await screen.findByRole('alert');
    // Assert: the period can still be chosen, and another one shows its view
    expect(alert.textContent).toMatch(/^Denne perioden har for mange svar/);
    choose('Periode', '14d');
    show();
    await screen.findByRole('heading', { name: 'Deltaking' });
  });

  it('[UD-013] the same refusal twice mounts a new alert, so it is announced again', async () => {
    // Arrange
    fakeFetch(routes({ [`GET ${VIEW}?period=30d&context=portal`]: TOO_LARGE }));
    render(<InsightPanel contentId={ID} title="Celler og vev" />);
    await screen.findByRole('heading', { name: 'Deltaking' });
    choose('Periode', '30d');
    show();
    const first = await screen.findByRole('alert');
    // Act
    show();
    // Assert: the same words in a new alert element, which screen readers announce
    await waitFor(() => expect(screen.getByRole('alert')).not.toBe(first));
    expect(screen.getByRole('alert').textContent).toBe(first.textContent);
  });
});
