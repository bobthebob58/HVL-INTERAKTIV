/**
 * Tests for the **Deling** tab as a whole: its headings in order, saving the visibility (and a student author's
 * refusal, which a second press shows as a new alert), and «Lag ein kopi», which copies the activity and opens the
 * copy's Rediger tab.
 *
 * Spec: PROD-007, PROD-006, UD-006, UD-013
 */
// @vitest-environment jsdom
import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SharingPanel } from '../../src/features/sharing/SharingPanel';
import { errorBody, fakeFetch, type FakeRoutes } from '../support/fakeFetch';
import { DETAIL, ID } from './learningDesignFixtures';

const COPY_ID = '0192f0c4-0000-7000-8000-00000000c0f1';
const routes = (extra: FakeRoutes = {}): FakeRoutes => ({
  [`GET /api/content/${ID}/coauthors`]: {
    status: 200,
    body: { owner: { userId: COPY_ID, displayName: 'Eva Eigar' }, coAuthors: [], mayManage: true },
  },
  [`GET /api/content/${ID}/bank`]: { status: 200, body: { listedAt: null, eligible: false } },
  ...extra,
});
const show = (detail: ContentDetail = DETAIL) => {
  const reloadDetail = vi.fn(async () => undefined);
  const navigate = vi.fn();
  const announce = vi.fn();
  render(
    <SharingPanel detail={detail} announce={announce} reloadDetail={reloadDetail} navigate={navigate} />,
  );
  return { reloadDetail, navigate, announce };
};

describe('[PROD-007] the Deling tab', () => {
  it('[UD-006] has one h2 and a part per heading, in a fixed order', async () => {
    // Arrange
    fakeFetch(routes());
    // Act
    show();
    await screen.findByRole('heading', { name: 'Medforfattarar' });
    // Assert
    const headings = screen.getAllByRole('heading').map((h) => `${h.tagName} ${h.textContent}`);
    expect(headings).toEqual([
      'H2 Deling og samarbeid',
      'H3 Medforfattarar',
      'H3 Innhaldsbanken',
      'H3 Lag ein kopi',
    ]);
    expect(screen.getByRole('group', { name: 'Kven kan finne aktiviteten' })).toBeTruthy();
  });

  it('[PROD-006] saves the chosen visibility with the button, announces it and loads the activity again', async () => {
    // Arrange
    const requests = fakeFetch(
      routes({
        [`PATCH /api/content/${ID}/sharing`]: {
          status: 200,
          body: { contentId: ID, visibility: 'organisation' },
        },
      }),
    );
    const { reloadDetail, announce } = show();
    // Act
    fireEvent.click(screen.getByRole('radio', { name: 'Alle ved HVL' }));
    const beforeSave = requests.filter((r) => r.method === 'PATCH').length;
    fireEvent.click(screen.getByRole('button', { name: 'Lagre delinga' }));
    // Assert: nothing is saved by choosing alone (WCAG 3.2.2)
    await waitFor(() => expect(reloadDetail).toHaveBeenCalled());
    expect(beforeSave).toBe(0);
    expect(requests.find((r) => r.method === 'PATCH')?.body).toEqual({ visibility: 'organisation' });
    expect(announce).toHaveBeenCalledWith('Delinga er lagra.');
    expect(screen.getByText('Delinga er lagra.')).toBeTruthy();
  });

  it('[PROD-006] a student author’s refusal is shown in the server’s words', async () => {
    // Arrange
    const message = 'Som student kan du førebels berre ha aktivitetane dine private.';
    fakeFetch(
      routes({
        [`PATCH /api/content/${ID}/sharing`]: {
          status: 403,
          body: errorBody(403, 'hvl:sharing-not-allowed', message),
        },
      }),
    );
    const { reloadDetail } = show();
    // Act
    fireEvent.click(screen.getByRole('radio', { name: 'Alle med Feide-innlogging' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lagre delinga' }));
    // Assert
    expect((await screen.findByRole('alert')).textContent).toBe(`✗ ${message}`);
    expect(reloadDetail).not.toHaveBeenCalled();
  });

  it('[PROD-006] the same refusal a second time is a new alert, so it is announced again', async () => {
    // Arrange
    const message = 'Du kan ikkje dele.';
    const requests = fakeFetch(
      routes({
        [`PATCH /api/content/${ID}/sharing`]: {
          status: 403,
          body: errorBody(403, 'hvl:sharing-not-allowed', message),
        },
      }),
    );
    show();
    fireEvent.click(screen.getByRole('radio', { name: 'Alle ved HVL' }));
    const save = screen.getByRole('button', { name: 'Lagre delinga' });
    fireEvent.click(save);
    const first = await screen.findByRole('alert');
    // Act
    fireEvent.click(save);
    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).not.toBe(first));
    expect(screen.getByRole('alert').textContent).toBe(`✗ ${message}`);
    expect(requests.filter((r) => r.method === 'PATCH')).toHaveLength(2);
  });

  it('[PROD-007] «Lag ein kopi» copies the activity once and opens the copy’s Rediger tab', async () => {
    // Arrange
    const requests = fakeFetch(
      routes({ [`POST /api/content/${ID}/duplicate`]: { status: 201, body: { contentId: COPY_ID } } }),
    );
    const { navigate, announce } = show();
    const button = screen.getByRole('button', { name: 'Lag ein kopi' });
    // Act
    fireEvent.click(button);
    fireEvent.click(button);
    // Assert
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(`/aktivitet/${COPY_ID}?fane=edit`));
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(1);
    expect(screen.getByText('Kopien er laga. Opnar han no.')).toBeTruthy();
    expect(announce.mock.calls.map(([message]) => message)).toEqual([
      'Lagar kopien …',
      'Kopien er laga. Opnar han no.',
    ]);
    expect(
      within(screen.getByRole('region', { name: 'Lag ein kopi' })).queryAllByRole('status'),
    ).toHaveLength(0);
  });

  it('[PROD-007] a refused copy says why and opens nothing', async () => {
    // Arrange
    const message = 'Kopien kunne ikkje lagast, så ingenting vart lagra. Prøv igjen.';
    fakeFetch(
      routes({
        [`POST /api/content/${ID}/duplicate`]: {
          status: 500,
          body: errorBody(500, 'hvl:duplicate-failed', message),
        },
      }),
    );
    const { navigate } = show();
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Lag ein kopi' }));
    // Assert
    expect((await screen.findByRole('alert')).textContent).toBe(`✗ ${message}`);
    expect(navigate).not.toHaveBeenCalled();
  });
});
