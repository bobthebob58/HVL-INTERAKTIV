/**
 * Tests that the content-bank part of the **Deling** tab copes with a re-read of the listing and a change that overlap:
 * a re-read sent before a change and answered after the change has rendered is dropped, so it neither undoes the
 * change on screen nor removes the control that has just got focus; and a re-read asked for while changes are on their
 * way is sent once, after the last of them has answered (a refused one too), so it shows the state they left.
 *
 * Spec: PROD-007, UD-006
 * Collaborators: ../support/commitOrder.tsx (`gate`, `holdAnswer`), ../support/fakeFetch.ts.
 */
// @vitest-environment jsdom
import type { BankListing, ContentDetail } from '@hvl-interaktiv/api-contract';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BankListingSection } from '../../src/features/sharing/BankListingSection';
import { gate, holdAnswer } from '../support/commitOrder';
import { errorBody, fakeFetch } from '../support/fakeFetch';
import { DETAIL, ID } from './learningDesignFixtures';

const PATH = `/api/content/${ID}/bank`;
const SHARED: ContentDetail = { ...DETAIL, status: 'published', visibility: 'organisation' };
const LISTED_AT = '2026-10-20T10:00:00.000Z';
const LISTED: BankListing = { listedAt: LISTED_AT, eligible: true };
const NOT_LISTED: BankListing = { listedAt: null, eligible: true };
// WHY: the server's Nynorsk message for `hvl:bank-not-eligible`, shown as the problem.
const REFUSED =
  'Berre publiserte aktivitetar som er delte med heile HVL eller fleire, kan leggjast i innhaldsbanken.';

describe('[PROD-007] the bank section when a re-read and a change overlap', () => {
  it('[PROD-007] a re-read sent before listing and answered after it neither undoes the listing nor takes focus away', async () => {
    // Arrange
    let reads = 0;
    let lateBodyRead = false;
    let release = () => {};
    const late = new Promise<void>((resolve) => (release = resolve));
    fakeFetch({
      [`GET ${PATH}`]: { status: 200, body: { listedAt: null, eligible: true } },
      [`PUT ${PATH}`]: { status: 200, body: { listedAt: LISTED_AT, eligible: true } },
    });
    const answer = globalThis.fetch;
    vi.stubGlobal('fetch', async (path: string, init: RequestInit = {}) => {
      // WHY: the first read answers at once; the re-read was read on the server before the listing and arrives late.
      if ((init.method ?? 'GET') !== 'GET' || (reads += 1) === 1) return answer(path, init);
      await late;
      const response = await answer(path, init);
      // WHY: marks the moment the API client has read the late answer's body.
      const read = response.json.bind(response);
      response.json = () => read().finally(() => (lateBodyRead = true));
      return response;
    });
    const announce = vi.fn();
    const section = (detail: ContentDetail) => <BankListingSection detail={detail} announce={announce} />;
    const { rerender } = render(section(SHARED));
    fireEvent.click(await screen.findByRole('checkbox'));
    rerender(section({ ...SHARED, visibility: 'feide' }));
    fireEvent.click(screen.getByRole('button', { name: 'Legg i innhaldsbanken' }));
    const unlist = await screen.findByRole('button', { name: 'Ta ut av innhaldsbanken' });
    await waitFor(() => expect(document.activeElement).toBe(unlist));
    // Act
    await act(async () => {
      release();
      // WHY: from the body read to the section, the answer passes through promise steps only (an assumption about
      // the API client), and polling runs on timers, so the section has handled the answer when this resolves.
      await vi.waitFor(() => expect(lateBodyRead).toBe(true));
    });
    // Assert
    expect(screen.getByText(/Aktiviteten har vore i innhaldsbanken sidan/)).toBeTruthy();
    expect(document.activeElement).toBe(unlist);
    expect(announce.mock.calls).toEqual([['Aktiviteten er lagd i innhaldsbanken.']]);
  });

  it('[PROD-007] a re-read asked for while listing is on its way waits for its answer, so a listing the server has ended is not shown', async () => {
    // Arrange
    const put = gate();
    let server: BankListing = { listedAt: null, eligible: true };
    const requests = fakeFetch({
      [`GET ${PATH}`]: () => ({ status: 200, body: server }),
      [`PUT ${PATH}`]: { status: 200, body: { listedAt: LISTED_AT, eligible: true } },
    });
    holdAnswer('PUT', put.opened);
    const announce = vi.fn();
    const section = (detail: ContentDetail) => <BankListingSection detail={detail} announce={announce} />;
    const { rerender } = render(section(SHARED));
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Legg i innhaldsbanken' }));
    // WHY: the server lists the activity; then the owner saves it as private, which ends the listing (D-091).
    server = { listedAt: null, eligible: false };
    rerender(section({ ...SHARED, visibility: 'private' }));
    const readsWhileListing = requests.filter((request) => request.method === 'GET').length;
    // Act
    put.open();
    // Assert
    await screen.findByText('Aktiviteten kan ikkje leggjast i innhaldsbanken før dette er på plass:');
    expect(readsWhileListing).toBe(1);
    expect(requests.map((request) => request.method)).toEqual(['GET', 'PUT', 'GET']);
    expect(screen.queryByRole('button', { name: 'Ta ut av innhaldsbanken' })).toBeNull();
    expect(announce.mock.calls).toEqual([['Aktiviteten er lagd i innhaldsbanken.']]);
  });

  it('[PROD-007] a re-read that waited for a listing the server refused is still sent, and its answer is shown', async () => {
    // Arrange
    const put = gate();
    let server: BankListing = NOT_LISTED;
    const requests = fakeFetch({
      [`GET ${PATH}`]: () => ({ status: 200, body: server }),
      [`PUT ${PATH}`]: { status: 409, body: errorBody(409, 'hvl:bank-not-eligible', REFUSED) },
    });
    holdAnswer('PUT', put.opened);
    const announce = vi.fn();
    const section = (detail: ContentDetail) => <BankListingSection detail={detail} announce={announce} />;
    const { rerender } = render(section(SHARED));
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Legg i innhaldsbanken' }));
    // WHY: the owner saves the activity as private before the server handles the listing, which it then refuses.
    server = { listedAt: null, eligible: false };
    rerender(section({ ...SHARED, visibility: 'private' }));
    // Act
    put.open();
    // Assert
    await screen.findByText('Aktiviteten kan ikkje leggjast i innhaldsbanken før dette er på plass:');
    expect(requests.map((request) => request.method)).toEqual(['GET', 'PUT', 'GET']);
    expect(screen.getByRole('alert').textContent).toContain(REFUSED);
    expect(screen.queryByRole('button', { name: 'Legg i innhaldsbanken' })).toBeNull();
    expect(announce).not.toHaveBeenCalled();
  });

  it('[PROD-007] a re-read asked for between two presses of «Legg i innhaldsbanken» is sent once, after both answers', async () => {
    // Arrange
    const [first, second] = [gate(), gate()];
    let server = NOT_LISTED;
    const requests = fakeFetch({
      [`GET ${PATH}`]: () => ({ status: 200, body: server }),
      // WHY: the first PUT lists the activity; the second finds it listed and answers so (contentBank.ts).
      [`PUT ${PATH}`]: () => ({ status: 200, body: (server = LISTED) }),
      [`DELETE ${PATH}`]: () => ({ status: 200, body: (server = NOT_LISTED) }),
    });
    const announce = vi.fn();
    const section = (detail: ContentDetail) => <BankListingSection detail={detail} announce={announce} />;
    const reads = () => requests.filter((request) => request.method === 'GET').length;
    // WHY: `act` renders the answer and runs the effects (where a re-read is sent) before the reads are counted.
    const answered = async (send: () => void, said: number) => {
      await act(async () => {
        send();
        await vi.waitFor(() => expect(announce).toHaveBeenCalledTimes(said));
      });
      return reads();
    };
    const { rerender } = render(section(SHARED));
    fireEvent.click(await screen.findByRole('checkbox'));
    const list = screen.getByRole('button', { name: 'Legg i innhaldsbanken' });
    holdAnswer('PUT', first.opened);
    fireEvent.click(list);
    rerender(section({ ...SHARED, visibility: 'feide' }));
    // WHY: a second hold wraps the first, so the second PUT waits for both gates; the first opens first.
    holdAnswer('PUT', second.opened);
    fireEvent.click(list);
    // Act
    const readsAfterFirst = await answered(first.open, 1);
    const readsAfterSecond = await answered(second.open, 2);
    const unlist = screen.getByRole('button', { name: 'Ta ut av innhaldsbanken' });
    const readsAfterUnlist = await answered(() => fireEvent.click(unlist), 3);
    // Assert
    expect([readsAfterFirst, readsAfterSecond, readsAfterUnlist]).toEqual([1, 2, 2]);
    expect(requests.map((request) => request.method)).toEqual(['GET', 'PUT', 'PUT', 'GET', 'DELETE']);
    expect(screen.getByText('Aktiviteten er ikkje i innhaldsbanken.')).toBeTruthy();
  });
});
