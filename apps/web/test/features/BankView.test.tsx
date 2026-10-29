/**
 * Tests for the content bank page: each entry with what colleagues choose by (the phase label from content), the
 * owner's name and a «Lag ein kopi» named after the activity; the student author's refusal explained; the empty
 * state.
 *
 * Spec: PROD-007, PED-001, UD-010, UD-013
 */
// @vitest-environment jsdom
import type { BankEntry } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BankView } from '../../src/features/bank/BankView';
import { errorBody, fakeFetch, type FakeAnswer } from '../support/fakeFetch';
import { OVERVIEW } from './learningDesignFixtures';

const SESSION = { status: 200, body: { roles: ['author'], locale: 'nn', csrfToken: 'csrf-1' } };
const COPY_ID = '0192f0c4-0000-7000-8000-00000000d0f1';
const ENTRY: BankEntry = {
  contentId: '0192f0c4-0000-7000-8000-00000000d001',
  title: 'Cells and tissue',
  mainLibrary: 'H5P.MultiChoice',
  language: 'en',
  phase: 'etterarbeid',
  learnerPurpose: 'You recall what you learnt.',
  estimatedStudentMinutes: 15,
  outcomes: [{ text: 'Explain the term', category: 'kunnskap' }],
  ownerName: 'Ola Kollega',
  updatedAt: '2026-10-20T10:00:00.000Z',
  listedAt: '2026-10-21T10:00:00.000Z',
};

const show = (bank: FakeAnswer, extra = {}) => {
  const requests = fakeFetch({
    'GET /auth/session': SESSION,
    'GET /api/bank': bank,
    'GET /api/studio': { status: 200, body: OVERVIEW },
    ...extra,
  });
  const navigate = vi.fn();
  render(<BankView navigate={navigate} />);
  return { requests, navigate };
};

describe('[PROD-007] the content bank page', () => {
  it('[PROD-007] shows each entry with type, phase from content, time, purpose, outcomes and the owner', async () => {
    // Arrange and act
    show({
      status: 200,
      body: { items: [ENTRY, { ...ENTRY, contentId: COPY_ID, title: 'Andre', ownerName: null }] },
    });
    // Assert
    const article = await screen.findByRole('article', { name: 'Cells and tissue' });
    const card = within(article);
    expect(card.getByRole('heading', { level: 2 }).getAttribute('lang')).toBe('en');
    expect(article.textContent).toContain('Type: Fleirval');
    await waitFor(() => expect(article.textContent).toContain('Fase: Testfase etter'));
    expect(article.textContent).toContain('Tid: 15 minutt');
    expect(card.getByText('You recall what you learnt.').getAttribute('lang')).toBe('en');
    expect(card.getByText('Explain the term')).toBeTruthy();
    expect(article.textContent).toContain('Delt av: Ola Kollega');
    expect(screen.getByRole('article', { name: 'Andre' }).textContent).toContain(
      'Delt av: Namnet er ikkje kjent',
    );
    expect(screen.getByText('Aktivitetar i banken: 2')).toBeTruthy();
  });

  it('[PROD-007] «Lag ein kopi» is named after the activity, copies it and opens the copy', async () => {
    // Arrange
    const { requests, navigate } = show(
      { status: 200, body: { items: [ENTRY] } },
      { [`POST /api/content/${ENTRY.contentId}/duplicate`]: { status: 201, body: { contentId: COPY_ID } } },
    );
    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Lag ein kopi av Cells and tissue' }));
    // Assert
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(`/aktivitet/${COPY_ID}?fane=edit`));
    expect(requests.find((r) => r.method === 'POST')?.headers).toMatchObject({ 'x-csrf-token': 'csrf-1' });
  });

  it('[PROD-007] explains the refusal to a student author', async () => {
    show({ status: 403, body: errorBody(403, 'hvl:sharing-not-allowed') });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      'Innhaldsbanken er for tilsette ved HVL, fordi han viser namna til kollegaer.',
    );
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('[PROD-007] says when the bank is empty', async () => {
    show({ status: 200, body: { items: [] } });
    expect(await screen.findByText(/Innhaldsbanken er tom enno\./)).toBeTruthy();
    expect(screen.queryByRole('article')).toBeNull();
  });
});
