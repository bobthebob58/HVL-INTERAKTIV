/**
 * Component tests for the formative-use notice: its text in nn, nb and en, hidden once dismissed in the current
 * version, dismissal stored per user with the page's credential, and a failed dismissal that keeps the notice.
 *
 * Spec: PROD-011, UD-006
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiAuthProvider } from '../../src/api/ApiAuthContext';
import type { ApiAuth } from '../../src/api/apiRequest';
import { Notice, NOTICE_VERSIONS } from '../../src/components/Notice';
import { LocaleProvider } from '../../src/i18n/LocaleContext';
import type { Locale } from '../../src/i18n/translate';
import { errorBody, fakeFetch } from '../support/fakeFetch';

const me = (dismissed: { noticeId: string; version: number }[] = []) => ({
  status: 200,
  body: { kind: 'portal', locale: 'nn', roles: ['author'], dismissedNotices: dismissed },
});

const show = (auth: ApiAuth = { kind: 'portal', csrfToken: 'csrf-1' }, locale: Locale = 'nn') =>
  render(
    <LocaleProvider locale={locale}>
      <ApiAuthProvider auth={auth}>
        <Notice />
      </ApiAuthProvider>
    </LocaleProvider>,
  );

describe('[PROD-011] the formative-use notice', () => {
  it.each([
    ['nn', 'Til undervegsvurdering', /ikkje for eksamen/],
    ['nb', 'Til underveisvurdering', /ikke for eksamen/],
    ['en', 'For formative use', /not for exams/],
  ] as const)(
    '[PROD-011] says in %s that scores are formative, not for exams',
    async (locale, title, body) => {
      fakeFetch({ 'GET /api/me': me() });
      show(undefined, locale);
      expect(await screen.findByRole('region', { name: new RegExp(title) })).toBeTruthy();
      expect(screen.getByText(body)).toBeTruthy();
    },
  );

  it('[PROD-011] stays hidden for a person who dismissed the current version', async () => {
    // Arrange
    const requests = fakeFetch({ 'GET /api/me': me([{ noticeId: 'formative-use', version: 1 }]) });
    // Act
    show();
    // Assert
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('[PROD-011] shows again when the text has a newer version than the one dismissed', async () => {
    fakeFetch({
      'GET /api/me': me([{ noticeId: 'formative-use', version: NOTICE_VERSIONS['formative-use'] - 1 }]),
    });
    show();
    expect(await screen.findByRole('region')).toBeTruthy();
  });

  it('[PROD-011] dismissing stores the version for the user with the CSRF token, and hides it', async () => {
    // Arrange
    const requests = fakeFetch({ 'GET /api/me': me(), 'PUT /api/me/notices/formative-use': { status: 204 } });
    show();
    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Ikkje vis meldinga igjen' }));
    // Assert
    await waitFor(() => expect(screen.queryByRole('region')).toBeNull());
    const put = requests.find((request) => request.method === 'PUT');
    expect(put?.body).toEqual({ version: 1 });
    expect(put?.headers['x-csrf-token']).toBe('csrf-1');
    expect(put?.credentials).toBe('same-origin');
  });

  it('[PROD-011] in Canvas the requests carry the ltik as a Bearer token and no cookie', async () => {
    // Arrange
    const requests = fakeFetch({ 'GET /api/me': me(), 'PUT /api/me/notices/formative-use': { status: 204 } });
    show({ kind: 'lti', ltik: 'ltik-abc' });
    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Ikkje vis meldinga igjen' }));
    // Assert
    await waitFor(() => expect(requests).toHaveLength(2));
    for (const request of requests) {
      expect(request.headers.Authorization).toBe('Bearer ltik-abc');
      expect(request.credentials).toBe('omit');
    }
  });

  it('[PROD-011] a failed dismissal keeps the notice and says so', async () => {
    // Arrange
    fakeFetch({
      'GET /api/me': me(),
      'PUT /api/me/notices/formative-use': { status: 401, body: errorBody(401, 'hvl:csrf-invalid') },
    });
    show();
    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Ikkje vis meldinga igjen' }));
    // Assert
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Klarte ikkje å hugse valet ditt. Prøv igjen.',
    );
    expect(screen.getByRole('region')).toBeTruthy();
  });

  it('[PROD-011] is shown when the dismissals cannot be read', async () => {
    fakeFetch({ 'GET /api/me': { status: 401, body: errorBody(401, 'hvl:unauthenticated') } });
    show();
    expect(await screen.findByRole('region')).toBeTruthy();
  });
});
