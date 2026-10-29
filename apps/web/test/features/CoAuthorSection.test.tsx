/**
 * Tests for the co-author list on the **Deling** tab: the owner's remove buttons and search, a co-author's «Fjern
 * meg», and where focus goes after adding and removing, with each change announced; also when a 0 ms timer runs
 * before React renders, as in Chromium.
 *
 * Spec: PROD-007, UD-006, UD-013
 */
// @vitest-environment jsdom
import type { CoAuthorList } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CoAuthorSection } from '../../src/features/sharing/CoAuthorSection';
import { errorBody, fakeFetch } from '../support/fakeFetch';

const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
const PATH = `/api/content/${ID}/coauthors`;
const OWNER = { userId: '0192f0c4-0000-7000-8000-00000000b001', displayName: 'Eva Eigar' };
const OLA = { userId: '0192f0c4-0000-7000-8000-00000000b002', displayName: 'Ola Kollega', isSelf: false };
const KARI = { userId: '0192f0c4-0000-7000-8000-00000000b003', displayName: 'Kari Nordmann' };
const AS_OWNER: CoAuthorList = { owner: OWNER, coAuthors: [OLA], mayManage: true };

const show = () => {
  const announce = vi.fn();
  render(<CoAuthorSection contentId={ID} announce={announce} />);
  return announce;
};

describe('[PROD-007] the co-author list', () => {
  it('[PROD-007] the owner adds a colleague from the search; focus returns to the search field', async () => {
    // Arrange
    const requests = fakeFetch({
      [`GET ${PATH}`]: { status: 200, body: AS_OWNER },
      'GET /api/people?q=Kari': { status: 200, body: { people: [KARI] } },
      [`POST ${PATH}`]: {
        status: 200,
        body: { ...AS_OWNER, coAuthors: [OLA, { ...KARI, isSelf: false }] },
      },
    });
    const announce = show();
    const search = await screen.findByRole('searchbox', { name: 'Søk etter tilsette ved HVL' });
    // Act
    fireEvent.change(search, { target: { value: 'Kari' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Legg til Kari Nordmann' }));
    // Assert
    await waitFor(() => expect(document.activeElement).toBe(search));
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({ userId: KARI.userId });
    expect(announce).toHaveBeenCalledWith('Kari Nordmann er lagd til som medforfattar.');
    expect(screen.getByRole('button', { name: 'Fjern Kari Nordmann' })).toBeTruthy();
  });

  it('[PROD-007] removing a co-author moves focus to the list’s heading and announces it', async () => {
    // Arrange
    const requests = fakeFetch({
      [`GET ${PATH}`]: { status: 200, body: AS_OWNER },
      [`DELETE ${PATH}/${OLA.userId}`]: { status: 200, body: { ...AS_OWNER, coAuthors: [] } },
    });
    const announce = show();
    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Fjern Ola Kollega' }));
    // Assert
    const heading = screen.getByRole('heading', { name: 'Medforfattarar' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(requests.at(-1)?.method).toBe('DELETE');
    expect(announce).toHaveBeenCalledWith('Ola Kollega er ikkje lenger medforfattar.');
    expect(screen.getByText('Aktiviteten har ingen medforfattarar.')).toBeTruthy();
  });

  it('[PROD-007] a co-author gets only «Fjern meg» and no search; afterwards a lasting message with a link home', async () => {
    // Arrange
    const self = { ...KARI, isSelf: true };
    fakeFetch({
      [`GET ${PATH}`]: { status: 200, body: { owner: OWNER, coAuthors: [OLA, self], mayManage: false } },
      [`DELETE ${PATH}/${KARI.userId}`]: {
        status: 200,
        body: { owner: OWNER, coAuthors: [OLA], mayManage: false },
      },
    });
    const announce = show();
    // Act
    const list = within(await screen.findByRole('list'));
    const buttons = list.getAllByRole('button').map((button) => button.textContent);
    fireEvent.click(list.getByRole('button', { name: 'Fjern meg' }));
    // Assert
    expect(buttons).toEqual(['Fjern meg']);
    expect(screen.queryByRole('searchbox')).toBeNull();
    const message = await screen.findByText(/Du er ikkje lenger medforfattar på aktiviteten\./);
    await waitFor(() => expect(document.activeElement).toBe(message));
    expect(screen.getByRole('link', { name: 'Til aktivitetane dine' }).getAttribute('href')).toBe('/');
    expect(announce).toHaveBeenCalledWith('Du er ikkje lenger medforfattar på aktiviteten.');
  });

  it('[UD-006] after «Fjern meg», focus moves to the lasting message, not to the page, whatever runs first', async () => {
    // Arrange
    const self = { ...KARI, isSelf: true };
    fakeFetch({
      [`GET ${PATH}`]: { status: 200, body: { owner: OWNER, coAuthors: [OLA, self], mayManage: false } },
      [`DELETE ${PATH}/${KARI.userId}`]: {
        status: 200,
        body: { owner: OWNER, coAuthors: [OLA], mayManage: false },
      },
    });
    show();
    const removeSelf = within(await screen.findByRole('list')).getByRole('button', { name: 'Fjern meg' });
    removeSelf.focus();
    // WHY: Chromium ran a 0 ms timer before React rendered the bank listing (real-browser probe, S5 review); a
    // microtask models that order, so focus must not wait on a timer.
    const realTimeout = window.setTimeout;
    vi.spyOn(window, 'setTimeout').mockImplementation(((run: () => void, ms?: number) =>
      ms ? realTimeout(run, ms) : (queueMicrotask(run), 0)) as typeof window.setTimeout);
    // Act
    fireEvent.click(removeSelf);
    // Assert
    const message = await screen.findByText(/Du er ikkje lenger medforfattar på aktiviteten\./);
    await waitFor(() => expect(document.activeElement).toBe(message));
  });

  it('[PROD-007] a refused change shows the server’s reason with the ✗ icon and keeps the list', async () => {
    // Arrange
    fakeFetch({
      [`GET ${PATH}`]: { status: 200, body: AS_OWNER },
      [`DELETE ${PATH}/${OLA.userId}`]: {
        status: 403,
        body: errorBody(403, 'hvl:owner-only', 'Berre eigaren av aktiviteten kan gjere dette.'),
      },
    });
    show();
    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Fjern Ola Kollega' }));
    // Assert
    expect((await screen.findByRole('alert')).textContent).toBe(
      '✗ Berre eigaren av aktiviteten kan gjere dette.',
    );
    expect(screen.getByRole('button', { name: 'Fjern Ola Kollega' })).toBeTruthy();
  });
});
