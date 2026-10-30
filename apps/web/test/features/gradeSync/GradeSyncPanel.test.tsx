/**
 * Tests for the grade-sync panel: its headings and formative label, each state's count in words with an icon, a link
 * without a gradebook column, no placements, a refused view; and the retry: its request, the outcome in the status
 * region, the counts read again, focus on the heading once the button is gone, a refusal as an alert (also twice),
 * and the Bearer ltik in Canvas.
 *
 * Spec: LTI-012, LTI-013, UD-003, UD-006
 */
// @vitest-environment jsdom
import type { GradeSyncPlacement, GradeSyncStatusResponse } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiAuthProvider } from '../../../src/api/ApiAuthContext';
import { GradeSyncPanel } from '../../../src/features/gradeSync/GradeSyncPanel';
import { errorBody, fakeFetch, type FakeAnswer } from '../../support/fakeFetch';

const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
const PATH = `/api/content/${ID}/grade-sync`;
const SYK = '0192f0c4-0000-7000-8000-0000000000a1';
const NAT = '0192f0c4-0000-7000-8000-0000000000b2';

const syk = (counts: GradeSyncPlacement['counts']): GradeSyncPlacement => ({
  placementId: SYK,
  platformName: 'HVL Canvas',
  contextLabel: 'SYK110',
  graded: true,
  attemptPolicy: 'best',
  masteryThreshold: null,
  counts,
});
const NAT_UNGRADED: GradeSyncPlacement = {
  ...syk({ sent: 0, pending: 0, failed: 0, orphaned: 0 }),
  placementId: NAT,
  contextLabel: 'NAT200',
  graded: false,
};
const status = (...placements: GradeSyncPlacement[]): FakeAnswer => ({
  status: 200,
  body: { contentId: ID, placements } satisfies GradeSyncStatusResponse,
});
const BEFORE = syk({ sent: 12, pending: 3, failed: 2, orphaned: 1 });
const AFTER = syk({ sent: 12, pending: 5, failed: 0, orphaned: 1 });

describe('[LTI-012] the grade-sync panel', () => {
  it('[UD-006] has one h2, the formative label and a section per placement, named by course and Canvas', async () => {
    // Arrange
    fakeFetch({ [`GET ${PATH}`]: status(BEFORE, NAT_UNGRADED) });
    // Act
    render(<GradeSyncPanel contentId={ID} />);
    await screen.findByRole('heading', { name: 'SYK110 i HVL Canvas' });
    // Assert
    expect(screen.getAllByRole('heading').map((h) => `${h.tagName} ${h.textContent}`)).toEqual([
      'H2 Poeng til karakterboka i Canvas',
      'H3 ℹ︎ Til undervegsvurdering',
      'H3 SYK110 i HVL Canvas',
      'H3 NAT200 i HVL Canvas',
    ]);
    const label = screen.getByRole('region', { name: 'Til undervegsvurdering' });
    expect(label.textContent).toContain('ikkje for eksamen eller karakterar');
    expect(label.textContent).toContain('Canvas viser poenga i karakterboka, men dei er ikkje karakterar.');
  });

  it('[UD-003] gives each state its count with words and an icon, never by colour alone', async () => {
    // Arrange
    fakeFetch({ [`GET ${PATH}`]: status(BEFORE) });
    // Act
    render(<GradeSyncPanel contentId={ID} />);
    await screen.findByRole('heading', { name: 'SYK110 i HVL Canvas' });
    const section = screen.getByRole('region', { name: 'SYK110 i HVL Canvas' });
    // Assert
    const terms = within(section)
      .getAllByRole('term')
      .map((term) => term.textContent);
    const values = within(section)
      .getAllByRole('definition')
      .map((value) => value.textContent);
    expect(terms).toEqual([
      '✓ Sendt til Canvas',
      '◷ Ventar på å bli sendt',
      '✗ Feila',
      '⊘ Oppgåva er sletta i Canvas',
    ]);
    expect(values).toEqual(['12', '3', '2', '1']);
    for (const icon of section.querySelectorAll('dt span'))
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(within(section).getByText('Poengregel:').parentElement?.textContent).toBe(
      'Poengregel: Det beste forsøket blir sendt.',
    );
    expect(within(section).getByText(/Canvas tok ikkje imot desse poenga/)).toBeTruthy();
    expect(within(section).getByText(/Oppgåva finst ikkje lenger i Canvas/)).toBeTruthy();
  });

  it('[LTI-012] a link without a gradebook column says so and has no counts or button', async () => {
    // Arrange
    fakeFetch({ [`GET ${PATH}`]: status(NAT_UNGRADED) });
    // Act
    render(<GradeSyncPanel contentId={ID} />);
    // Assert
    expect(await screen.findByText(/Denne lenkja har inga kolonne i karakterboka/)).toBeTruthy();
    expect(screen.queryByRole('term')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('[LTI-012] an activity in no Canvas course says so; a refused view says the person has no access', async () => {
    // Arrange and act
    fakeFetch({ [`GET ${PATH}`]: status() });
    const { unmount } = render(<GradeSyncPanel contentId={ID} />);
    // Assert
    expect(await screen.findByText(/Aktiviteten er ikkje lagd inn i noko Canvas-emne enno/)).toBeTruthy();
    unmount();
    fakeFetch({ [`GET ${PATH}`]: { status: 403, body: errorBody(403, 'error.forbidden') } });
    render(<GradeSyncPanel contentId={ID} />);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Du har ikkje tilgang til poengsendinga for denne aktiviteten.',
    );
  });

  it('[LTI-012] a retry requeues, is announced, reads the counts again and moves focus to the heading', async () => {
    // Arrange
    let reads = 0;
    const requests = fakeFetch({
      [`GET ${PATH}`]: () => (reads++ === 0 ? status(BEFORE) : status(AFTER)),
      [`POST ${PATH}/retry`]: { status: 200, body: { requeued: 2, stillFailed: 0 } },
    });
    render(<GradeSyncPanel contentId={ID} />);
    const button = await screen.findByRole('button', { name: 'Send feila poeng på nytt' });
    button.focus();
    // Act
    fireEvent.click(button);
    // Assert
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({ placementId: SYK });
    expect(requests.find((r) => r.method === 'POST')?.headers['Content-Type']).toBe('application/json');
    const said = 'SYK110 i HVL Canvas: 2 poeng ventar no på å bli sende på nytt.';
    await waitFor(() => expect(screen.getAllByRole('status').some((s) => s.textContent === said)).toBe(true));
    expect(screen.getByText('2 poeng ventar no på å bli sende på nytt.')).toBeTruthy();
    expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual([
      '12',
      '5',
      '0',
      '1',
    ]);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'SYK110 i HVL Canvas' })),
    );
  });

  it('[UD-003] a refused retry is an alert with ✗ in the server’s words, and a second refusal is a new alert', async () => {
    // Arrange
    const message = 'Du har prøvd mange gonger. Vent litt.';
    fakeFetch({
      [`GET ${PATH}`]: status(BEFORE),
      [`POST ${PATH}/retry`]: { status: 429, body: errorBody(429, 'hvl:rate-limited', message) },
    });
    render(<GradeSyncPanel contentId={ID} />);
    const button = await screen.findByRole('button', { name: 'Send feila poeng på nytt' });
    // Act
    fireEvent.click(button);
    const first = await screen.findByRole('alert');
    fireEvent.click(await screen.findByRole('button', { name: 'Send feila poeng på nytt' }));
    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).not.toBe(first));
    expect(screen.getByRole('alert').textContent).toBe(`✗ ${message}`);
    expect(screen.getByRole('button', { name: 'Send feila poeng på nytt' })).toBeTruthy();
  });

  it('[LTI-012] in Canvas the requests carry the Bearer ltik and no cookie', async () => {
    // Arrange
    const requests = fakeFetch({ [`GET ${PATH}`]: status(BEFORE) });
    // Act
    render(
      <ApiAuthProvider auth={{ kind: 'lti', ltik: 'ltik-1' }}>
        <GradeSyncPanel contentId={ID} />
      </ApiAuthProvider>,
    );
    await screen.findByRole('heading', { name: 'SYK110 i HVL Canvas' });
    // Assert
    expect(requests[0]?.headers.Authorization).toBe('Bearer ltik-1');
    expect(requests[0]?.credentials).toBe('omit');
    expect(requests[0]?.path).toBe(PATH);
  });
});
