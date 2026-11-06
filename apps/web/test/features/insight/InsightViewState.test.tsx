/**
 * Tests for how the Innsikt tab moves from one view to the next: only the newest answer is shown when two cross, a
 * refused view (403 or 404) says so, a repeated refusal is announced again, an invalid version keeps the versions
 * to choose from, the CSV is of the view on screen rather than the form's unapplied choice, and the shortlist keeps
 * its entries, each naming its view, when the view changes or fails.
 *
 * Spec: INS-007, PROD-013, INS-009, INS-003, LTI-003, UD-013
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiAuthProvider } from '../../../src/api/ApiAuthContext';
import { InsightPanel } from '../../../src/features/insight/InsightPanel';
import { errorBody, fakeFetch, type FakeRoutes } from '../../support/fakeFetch';
import {
  CANVAS_PATH,
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

const VIEW = `/api/content/${ID}/insight`;
const routes = (extra: FakeRoutes = {}): FakeRoutes => ({
  [`GET ${PORTAL_PATH}`]: { status: 200, body: REPORT },
  [`GET ${CONTEXTS_PATH}`]: { status: 200, body: { contexts: CONTEXTS } },
  [`GET ${FINDINGS_PATH}`]: { status: 200, body: FINDINGS },
  ...extra,
});
const ofPeriod = (period: '14d' | '30d') => ({ ...REPORT, scope: scope({ period }) });
const choose = (name: string, value: string) =>
  fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });
const show = () => fireEvent.click(screen.getByRole('button', { name: 'Vis innsikt' }));
const openPortal = async () => {
  render(<InsightPanel contentId={ID} title="Celler og vev" />);
  await screen.findByRole('heading', { name: 'Deltaking' });
};

describe('[INS-007] the Innsikt tab from one view to the next', () => {
  it('[INS-007] shows only the newest view when an earlier answer arrives after it', async () => {
    // Arrange: the 14-day and 30-day answers wait until the test releases them
    fakeFetch(routes());
    const answered = globalThis.fetch;
    const waiting = new Map<string, (response: Response) => void>();
    vi.stubGlobal('fetch', (path: string, init?: RequestInit) =>
      path.includes('period=14d') || path.includes('period=30d')
        ? new Promise<Response>((resolve) => waiting.set(path.includes('14d') ? '14d' : '30d', resolve))
        : answered(path, init),
    );
    await openPortal();
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    // Act: ask for 14 days, then 30 days; the 30-day answer comes first
    choose('Periode', '14d');
    show();
    choose('Periode', '30d');
    show();
    await waitFor(() => expect(waiting.size).toBe(2));
    waiting.get('30d')?.(json(ofPeriod('30d')));
    await waitFor(() => expect(screen.getByText(/^Viser .*siste 30 dagar/)).toBeTruthy());
    waiting.get('14d')?.(json(ofPeriod('14d')));
    // Assert
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByText(/^Viser /).textContent).toMatch(/siste 30 dagar/);
  });

  it.each([403, 404])(
    '[INS-007] a first view refused with %i says there is no access and offers no choices',
    async (status) => {
      // Arrange
      fakeFetch(routes({ [`GET ${PORTAL_PATH}`]: { status, body: errorBody(status, 'error.forbidden') } }));
      // Act
      render(<InsightPanel contentId={ID} title="Celler og vev" />);
      // Assert
      expect((await screen.findByRole('alert')).textContent).toMatch(/^Du har ikkje tilgang/);
      expect(screen.queryByRole('button', { name: 'Vis innsikt' })).toBeNull();
    },
  );

  it.each([400, 403, 500])(
    '[UD-013] the same refusal (%i) twice mounts a new alert, so it is announced again',
    async (status) => {
      // Arrange
      const refused = { status, body: errorBody(status, 'error.x') };
      fakeFetch(routes({ [`GET ${VIEW}?period=14d&context=portal`]: refused }));
      await openPortal();
      choose('Periode', '14d');
      show();
      const first = await screen.findByRole('alert');
      // Act
      show();
      // Assert: the same words, but in a new alert element, which screen readers announce
      await waitFor(() => expect(screen.getByRole('alert')).not.toBe(first));
      expect(screen.getByRole('alert').textContent).toBe(first.textContent);
    },
  );

  it('[PROD-013] after an invalid version the versions stay, and the current one is asked for without a version', async () => {
    // Arrange
    const invalid = { status: 400, body: errorBody(400, 'hvl:insight-version-unavailable') };
    const requests = fakeFetch(routes({ [`GET ${PORTAL_PATH}&version=2`]: invalid }));
    await openPortal();
    // Act
    choose('Versjon av aktiviteten', '2');
    show();
    await screen.findByRole('alert');
    // Assert: the versions are still offered; the current one asks with no version and shows the view again
    choose('Versjon av aktiviteten', '3');
    show();
    await screen.findByRole('heading', { name: 'Deltaking' });
    expect(requests.filter((request) => request.path === PORTAL_PATH)).toHaveLength(2);
  });

  it('[INS-007] a later view refused for a course keeps the choices, so another can be chosen', async () => {
    // Arrange
    const refused = { status: 404, body: errorBody(404, 'error.notFound') };
    fakeFetch(routes({ [`GET ${VIEW}?period=7d&context=${encodeURIComponent(SYK_KEY)}`]: refused }));
    await openPortal();
    // Act
    choose('Emne', SYK_KEY);
    show();
    // Assert
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Du har ikkje tilgang/);
    expect(screen.getByRole('combobox', { name: 'Emne' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vis innsikt' })).toBeTruthy();
  });
});

describe('[INS-009] the CSV and the shortlist across views', () => {
  it('[INS-009] the CSV is of the view on screen, with its context and version, not an unapplied choice', async () => {
    // Arrange
    const requests = fakeFetch(routes());
    await openPortal();
    // Act: a period is picked but not applied
    choose('Periode', '30d');
    fireEvent.click(screen.getByRole('button', { name: /CSV/ }));
    // Assert
    await waitFor(() => expect(requests.some((request) => request.path.includes('/export'))).toBe(true));
    expect(requests.find((request) => request.path.includes('/export'))?.path).toBe(
      `${VIEW}/export?period=7d&context=portal&version=3`,
    );
  });

  it('[LTI-003][INS-009] in Canvas the CSV carries the Bearer ltik and the view’s version, and no context', async () => {
    // Arrange
    const report = { ...REPORT, scope: scope({ context: { key: SYK_KEY, label: 'SYK110' } }) };
    const requests = fakeFetch({
      [`GET ${CANVAS_PATH}`]: { status: 200, body: report },
      [`GET ${FINDINGS_PATH}`]: { status: 200, body: FINDINGS },
    });
    render(
      <ApiAuthProvider auth={{ kind: 'lti', ltik: 'ltik-1' }}>
        <InsightPanel contentId={ID} title="Celler og vev" fixedContext />
      </ApiAuthProvider>,
    );
    await screen.findByRole('heading', { name: 'Deltaking' });
    // Act
    fireEvent.click(screen.getByRole('button', { name: /CSV/ }));
    // Assert
    await waitFor(() => expect(requests.some((request) => request.path.includes('/export'))).toBe(true));
    const csv = requests.find((request) => request.path.includes('/export'));
    expect(csv?.path).toBe(`${VIEW}/export?period=7d&version=3`);
    expect(csv?.headers.Authorization).toBe('Bearer ltik-1');
  });

  it('[INS-003] the shortlist keeps an entry, with the view it came from, when the view changes and when one fails', async () => {
    // Arrange
    const failed = { status: 500, body: errorBody(500, 'error.internal') };
    fakeFetch(
      routes({
        [`GET ${VIEW}?period=14d&context=portal`]: { status: 200, body: ofPeriod('14d') },
        [`GET ${VIEW}?period=30d&context=portal`]: failed,
      }),
    );
    await openPortal();
    const question = screen.getByRole('region', { name: 'Kva gjer mitokondriane?' });
    fireEvent.click(within(question).getByRole('button', { name: /^Ta opp/ }));
    const list = () => screen.getByRole('region', { name: /^Ta opp i samlinga \(/ });
    // Act: another period, then one that fails
    choose('Periode', '14d');
    show();
    await screen.findByText(/^Viser .*siste 14 dagar/);
    choose('Periode', '30d');
    show();
    await screen.findByRole('alert');
    // Assert: the entry still names the 7-day view it was taken from, and the list can still be printed
    expect(within(list()).getAllByRole('listitem')).toHaveLength(1);
    expect(plain(within(list()).getByText(/^Tal frå /).textContent)).toBe(
      'Tal frå portalen (spelt utanom Canvas), siste 7 dagar (frå 28. okt. 2026), versjon 3.',
    );
    expect(within(list()).getByRole('button', { name: 'Skriv ut lista' })).toBeTruthy();
  });
});
