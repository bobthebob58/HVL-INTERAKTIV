/**
 * Tests for the grade-sync panel's retry: its request, the outcome in the status region, the counts read again, focus
 * on the heading once the button is gone and on the button while it stays, one retry at a time across placements, and
 * a refusal as an alert (also twice).
 *
 * Spec: LTI-012, UD-003, UD-006
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GradeSyncPanel } from '../../../src/features/gradeSync/GradeSyncPanel';
import { errorBody, fakeFetch } from '../../support/fakeFetch';
import { AFTER, BEFORE, ID, NAT, PATH, status, SYK, syk } from './gradeSyncAnswers';

const RETRY = 'Send feila poeng på nytt';

/**
 * Holds every POST until `release` is called, so a test can act while a retry is on its way.
 * @returns The function that lets the held requests through.
 */
function holdPosts(): () => void {
  const answer = globalThis.fetch;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal('fetch', async (path: string, init?: RequestInit) => {
    if (init?.method === 'POST') await held;
    return answer(path, init);
  });
  return release;
}

describe('[LTI-012] retrying on the grade-sync panel', () => {
  it('[LTI-012] a retry requeues, is announced, reads the counts again and moves focus to the heading', async () => {
    // Arrange
    let reads = 0;
    const requests = fakeFetch({
      [`GET ${PATH}`]: () => (reads++ === 0 ? status(BEFORE) : status(AFTER)),
      [`POST ${PATH}/retry`]: { status: 200, body: { requeued: 2, stillFailed: 0 } },
    });
    render(<GradeSyncPanel contentId={ID} />);
    const button = await screen.findByRole('button', { name: RETRY });
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

  it('[UD-006] while failed scores remain that cannot be sent, the button stays and keeps focus', async () => {
    // Arrange
    let reads = 0;
    fakeFetch({
      [`GET ${PATH}`]: () =>
        reads++ === 0 ? status(BEFORE) : status(syk({ sent: 12, pending: 4, failed: 1, orphaned: 1 })),
      [`POST ${PATH}/retry`]: { status: 200, body: { requeued: 1, stillFailed: 1 } },
    });
    render(<GradeSyncPanel contentId={ID} />);
    const button = await screen.findByRole('button', { name: RETRY });
    button.focus();
    // Act
    fireEvent.click(button);
    // Assert: the outcome is said, the counts are read again, and focus stays where the person pressed
    await waitFor(() =>
      expect(screen.getAllByRole('status').some((s) => s.textContent?.includes('1 poeng kan ikkje'))).toBe(
        true,
      ),
    );
    await waitFor(() => expect(screen.getAllByRole('definition')[2]?.textContent).toBe('1'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: RETRY }));
  });

  it('[LTI-012] one retry at a time: while one runs, every retry button is aria-disabled and a press sends nothing', async () => {
    // Arrange: two placements with failed scores; the retry's answer is held back
    const natFailed = {
      ...syk({ sent: 0, pending: 0, failed: 1, orphaned: 0 }),
      placementId: NAT,
      contextLabel: 'NAT200',
    };
    const requests = fakeFetch({
      [`GET ${PATH}`]: status(BEFORE, natFailed),
      [`POST ${PATH}/retry`]: { status: 200, body: { requeued: 2, stillFailed: 0 } },
    });
    const release = holdPosts();
    render(<GradeSyncPanel contentId={ID} />);
    const sections = [
      await screen.findByRole('region', { name: 'SYK110 i HVL Canvas' }),
      screen.getByRole('region', { name: 'NAT200 i HVL Canvas' }),
    ];
    // Act
    fireEvent.click(within(sections[0] as HTMLElement).getByRole('button', { name: RETRY }));
    const sending = within(sections[0] as HTMLElement).getByRole('button', { name: 'Sender …' });
    const other = within(sections[1] as HTMLElement).getByRole('button', { name: RETRY });
    fireEvent.click(sending);
    fireEvent.click(other);
    // Assert: both are marked, and only the first press went out
    expect(sending.getAttribute('aria-disabled')).toBe('true');
    expect(other.getAttribute('aria-disabled')).toBe('true');
    release();
    await waitFor(() => expect(other.getAttribute('aria-disabled')).toBeNull());
    expect(requests.filter((r) => r.method === 'POST').map((r) => r.body)).toEqual([{ placementId: SYK }]);
  });

  it('[UD-003] a refused retry is an alert with ✗ in the server’s words, and a second refusal is a new alert', async () => {
    // Arrange
    const message = 'Du har prøvd mange gonger. Vent litt.';
    fakeFetch({
      [`GET ${PATH}`]: status(BEFORE),
      [`POST ${PATH}/retry`]: { status: 429, body: errorBody(429, 'hvl:rate-limited', message) },
    });
    render(<GradeSyncPanel contentId={ID} />);
    const button = await screen.findByRole('button', { name: RETRY });
    // Act
    fireEvent.click(button);
    const first = await screen.findByRole('alert');
    fireEvent.click(await screen.findByRole('button', { name: RETRY }));
    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).not.toBe(first));
    expect(screen.getByRole('alert').textContent).toBe(`✗ ${message}`);
    expect(screen.getByRole('button', { name: RETRY })).toBeTruthy();
  });
});
