/**
 * Tests for the author-only gate: loading, the Feide login link back to the page with its query, the refusal for
 * people who are not authors, and the content wrapped in the session's credential.
 *
 * Spec: AUTH-001, AUTH-003, UD-013
 */
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useApiAuth } from '../../src/api/ApiAuthContext';
import { AuthorGate } from '../../src/components/AuthorGate';
import { errorBody, fakeFetch } from '../support/fakeFetch';

const session = (roles: readonly string[]) => ({
  'GET /auth/session': { status: 200, body: { roles, locale: 'nn', csrfToken: 'csrf-1' } },
});

function Credential() {
  const auth = useApiAuth();
  return <p>{auth.kind === 'portal' ? `token ${auth.csrfToken ?? 'none'}` : 'lti'}</p>;
}

describe('[AUTH-001] the author-only gate', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('[AUTH-001] signed out: the Feide login link returns to the page with its query', async () => {
    // Arrange
    window.history.replaceState(null, '', '/laeringsdesign/planlegg?emne=SYK110');
    fakeFetch({ 'GET /auth/session': { status: 401, body: errorBody(401, 'hvl:unauthenticated') } });
    // Act
    render(<AuthorGate>{() => <p>Innhald</p>}</AuthorGate>);
    // Assert
    const link = await screen.findByRole('link', { name: 'Logg inn med Feide' });
    expect(link.getAttribute('href')).toBe(
      `/auth/feide/login?returnTo=${encodeURIComponent('/laeringsdesign/planlegg?emne=SYK110')}`,
    );
    expect(screen.getByText('Du må logge inn for å sjå denne sida.')).toBeTruthy();
    expect(screen.queryByText('Innhald')).toBeNull();
  });

  it('[AUTH-001] an explicit return path wins over the address', async () => {
    fakeFetch({ 'GET /auth/session': { status: 401, body: errorBody(401, 'hvl:unauthenticated') } });
    render(<AuthorGate returnTo="/mappe">{() => null}</AuthorGate>);
    const link = await screen.findByRole('link', { name: 'Logg inn med Feide' });
    expect(link.getAttribute('href')).toBe('/auth/feide/login?returnTo=%2Fmappe');
  });

  it('[AUTH-003] a signed-in learner is refused, and sees no content', async () => {
    fakeFetch(session(['learner']));
    render(<AuthorGate>{() => <p>Innhald</p>}</AuthorGate>);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Berre tilsette og studentar med forfattarrolle har tilgang til denne sida.',
    );
    expect(screen.queryByText('Innhald')).toBeNull();
  });

  it.each([['author'], ['admin']])(
    '[AUTH-003] an %s gets the content, with the session’s CSRF token for its requests',
    async (role) => {
      fakeFetch(session([role]));
      render(<AuthorGate>{(signedIn) => <Credential key={signedIn.csrfToken} />}</AuthorGate>);
      expect(await screen.findByText('token csrf-1')).toBeTruthy();
    },
  );

  it('[AUTH-003] while the session loads it says so; when it cannot be asked it says that', async () => {
    // Arrange
    fakeFetch({ 'GET /auth/session': { status: 500, body: errorBody(500, 'error.internal') } });
    // Act
    render(<AuthorGate>{() => null}</AuthorGate>);
    // Assert
    expect(screen.getByRole('status').textContent).toBe('Hentar …');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Klarte ikkje å hente innhaldet. Last sida på nytt.',
    );
  });
});
