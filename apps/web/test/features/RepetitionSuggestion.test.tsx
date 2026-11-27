/**
 * Tests for the repetition suggestion of a published *Etterarbeid* activity: the two suggested dates as dates a
 * screen reader and a parser can read, in the page's language, and the one-press copy that opens for editing.
 *
 * Spec: PROD-014, UD-006, DOC-009
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RepetitionSuggestion } from '../../src/features/learningDesign/RepetitionSuggestion';
import { LocaleProvider } from '../../src/i18n/LocaleContext';
import type { Locale } from '../../src/i18n/translate';
import { errorBody, fakeFetch } from '../support/fakeFetch';
import { ID } from './learningDesignFixtures';

const COPY_ID = '0192f0c4-0000-7000-8000-00000000c0f1';
const PUBLISHED_AT = '2026-11-27T19:00:00.000Z';

const show = (locale: Locale = 'nn') => {
  const navigate = vi.fn();
  const announce = vi.fn();
  render(
    <LocaleProvider locale={locale}>
      <RepetitionSuggestion
        contentId={ID}
        publishedAt={PUBLISHED_AT}
        announce={announce}
        navigate={navigate}
      />
    </LocaleProvider>,
  );
  return { navigate, announce };
};
const listed = (region: HTMLElement) =>
  within(region)
    .getAllByRole('listitem')
    .map((item) => [item.querySelector('time')?.getAttribute('datetime'), item.textContent]);

describe('[PROD-014] the repetition suggestion', () => {
  it('[PROD-014] is a region with a heading that lists the two dates, each a date with its distance in days', () => {
    // Act
    show();
    // Assert
    const region = screen.getByRole('region', { name: 'Forslag til repetisjon' });
    expect(within(region).getByRole('heading', { level: 3, name: 'Forslag til repetisjon' })).toBeTruthy();
    expect(listed(region)).toEqual([
      ['2026-12-04', 'fredag 4. desember 2026 (7 dagar etter publisering)'],
      ['2026-12-18', 'fredag 18. desember 2026 (21 dagar etter publisering)'],
    ]);
    expect(within(region).getByText(/Rekn frå dagen studentane først gjer aktiviteten/)).toBeTruthy();
    expect(within(region).getByText(/Kopien opnar seg som utkast\./)).toBeTruthy();
  });

  it.each([
    ['nb', 'Forslag til repetisjon', /^fredag 4\. desember 2026 \(7 dager etter publisering\)$/],
    ['en', 'Suggested repetition', /^Friday 4 December 2026 \(7 days after publishing\)$/],
  ] as const)('[PROD-014][DOC-009] reads in %s', (locale, heading, first) => {
    // Act
    show(locale);
    // Assert
    const region = screen.getByRole('region', { name: heading });
    expect(listed(region)[0]?.[1]).toMatch(first);
  });

  it('[PROD-014] one press on «Lag ein kopi» copies the activity and opens the copy for editing', async () => {
    // Arrange
    const requests = fakeFetch({
      [`POST /api/content/${ID}/duplicate`]: { status: 201, body: { contentId: COPY_ID } },
    });
    const { navigate, announce } = show();
    const button = screen.getByRole('button', { name: 'Lag ein kopi' });
    // Act
    fireEvent.click(button);
    // Assert: one request, the copy opened, and the page's status region told
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(`/aktivitet/${COPY_ID}?fane=edit`));
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      `POST /api/content/${ID}/duplicate`,
    ]);
    expect(announce.mock.calls.at(-1)).toEqual(['Kopien er laga. Opnar han no.']);
    // A11Y: a native button in the tab order, so Enter and Space press it (UD-006)
    expect([button.tagName, button.getAttribute('type'), button.tabIndex]).toEqual(['BUTTON', 'button', 0]);
  });

  it('[PROD-014] a copy the server refuses is said in an alert, and nothing opens', async () => {
    // Arrange
    fakeFetch({
      [`POST /api/content/${ID}/duplicate`]: {
        status: 429,
        body: errorBody(429, 'hvl:rate-limited', 'For mange kopiar. Prøv igjen om litt.'),
      },
    });
    const { navigate } = show();
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Lag ein kopi' }));
    // Assert
    expect((await screen.findByRole('alert')).textContent).toContain('For mange kopiar. Prøv igjen om litt.');
    expect(navigate).not.toHaveBeenCalled();
  });
});
