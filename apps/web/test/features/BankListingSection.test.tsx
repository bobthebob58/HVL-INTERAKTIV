/**
 * Tests for the content-bank part of the **Deling** tab: the consent required before listing (with the consent
 * text's version), unlisting, the unmet conditions in words, and a co-author who sees the state but no buttons.
 *
 * Spec: PROD-007, UD-013, UD-003
 */
// @vitest-environment jsdom
import { BANK_CONSENT_VERSION, type ContentDetail } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BankListingSection, SHOWN_CONSENT_VERSION } from '../../src/features/sharing/BankListingSection';
import { fakeFetch } from '../support/fakeFetch';
import { DETAIL, ID } from './learningDesignFixtures';

const PATH = `/api/content/${ID}/bank`;
const SHARED: ContentDetail = { ...DETAIL, status: 'published', visibility: 'organisation' };
const LISTED_AT = '2026-10-20T10:00:00.000Z';

const show = (detail: ContentDetail = SHARED) => {
  const announce = vi.fn();
  render(<BankListingSection detail={detail} announce={announce} />);
  return announce;
};

describe('[PROD-007] the activity in the content bank', () => {
  it('[PROD-007] listing needs the box ticked: otherwise nothing is sent and the box gets focus', async () => {
    // Arrange
    const requests = fakeFetch({
      [`GET ${PATH}`]: { status: 200, body: { listedAt: null, eligible: true } },
    });
    show();
    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Legg i innhaldsbanken' }));
    // Assert
    const box = screen.getByRole('checkbox', {
      name: 'Eg har lese teksten og vil leggje aktiviteten i innhaldsbanken',
    });
    expect(document.activeElement).toBe(box);
    expect(screen.getByRole('alert').textContent).toContain('Kryss av for at du har lese teksten');
    expect(requests.map((r) => r.method)).toEqual(['GET']);
  });

  it('[PROD-007] with the box ticked it lists the activity with the consent text’s version and announces it', async () => {
    // Arrange
    const requests = fakeFetch({
      [`GET ${PATH}`]: { status: 200, body: { listedAt: null, eligible: true } },
      [`PUT ${PATH}`]: { status: 200, body: { listedAt: LISTED_AT, eligible: true } },
    });
    const announce = show();
    // Act
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Legg i innhaldsbanken' }));
    // Assert
    await screen.findByText(/Aktiviteten har vore i innhaldsbanken sidan/);
    expect(requests.find((r) => r.method === 'PUT')?.body).toEqual({ consentVersion: BANK_CONSENT_VERSION });
    expect(SHOWN_CONSENT_VERSION).toBe(BANK_CONSENT_VERSION);
    expect(announce).toHaveBeenCalledWith('Aktiviteten er lagd i innhaldsbanken.');
    expect(screen.getByRole('button', { name: 'Ta ut av innhaldsbanken' })).toBeTruthy();
  });

  it('[PROD-007] the owner takes a listed activity out of the bank', async () => {
    // Arrange
    const requests = fakeFetch({
      [`GET ${PATH}`]: { status: 200, body: { listedAt: LISTED_AT, eligible: true } },
      [`DELETE ${PATH}`]: { status: 200, body: { listedAt: null, eligible: true } },
    });
    const announce = show();
    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Ta ut av innhaldsbanken' }));
    // Assert
    await screen.findByText('Aktiviteten er ikkje i innhaldsbanken.');
    expect(requests.at(-1)?.method).toBe('DELETE');
    expect(announce).toHaveBeenCalledWith(
      'Aktiviteten er teken ut av innhaldsbanken. Kopiar som alt er laga, blir verande.',
    );
  });

  it.each([
    [
      'a draft',
      { status: 'draft', visibility: 'private' },
      [
        'Aktiviteten må vere publisert.',
        'Aktiviteten må vere delt med alle ved HVL eller alle med Feide-innlogging.',
      ],
    ],
    [
      'a published private activity',
      { status: 'published', visibility: 'private' },
      ['Aktiviteten må vere delt med alle ved HVL eller alle med Feide-innlogging.'],
    ],
    [
      'a shared activity whose owner is not HVL staff',
      { status: 'published', visibility: 'feide' },
      ['Eigaren må vere tilsett ved HVL.'],
    ],
  ] as const)(
    '[PROD-007] %s says in words what is missing, with no list button',
    async (_name, change, missing) => {
      // Arrange
      fakeFetch({ [`GET ${PATH}`]: { status: 200, body: { listedAt: null, eligible: false } } });
      // Act
      show({ ...DETAIL, ...change });
      // Assert
      const items = await screen.findAllByRole('listitem');
      expect(items.map((item) => item.textContent)).toEqual(missing);
      expect(screen.queryByRole('button')).toBeNull();
    },
  );

  it('[PROD-007] a co-author sees the state and who may change it, without buttons', async () => {
    fakeFetch({ [`GET ${PATH}`]: { status: 200, body: { listedAt: null, eligible: true } } });
    show({ ...SHARED, role: 'coAuthor' });
    await screen.findByText('Aktiviteten er ikkje i innhaldsbanken.');
    expect(screen.getByText(/Berre eigaren kan leggje aktiviteten i innhaldsbanken/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
  });
});
