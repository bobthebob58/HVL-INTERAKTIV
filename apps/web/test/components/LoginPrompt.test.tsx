/**
 * Component tests for LoginPrompt: the signed-out state explains why and links to Feide login, returning to the page.
 *
 * Spec: AUTH-001, UD-013
 */
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoginPrompt } from '../../src/components/LoginPrompt';

describe('[AUTH-001] the login prompt', () => {
  it('[AUTH-001] links to Feide login with the page to come back to', () => {
    render(<LoginPrompt locale="nn" message="Du må logge inn." returnTo="/aktivitet/ny" />);
    expect(screen.getByText('Du må logge inn.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Logg inn med Feide' }).getAttribute('href')).toBe(
      '/auth/feide/login?returnTo=%2Faktivitet%2Fny',
    );
  });

  it('[UD-013] the start page logs in without a return path, in the page language', () => {
    render(<LoginPrompt locale="en" message="Log in." />);
    expect(screen.getByRole('link', { name: 'Log in with Feide' }).getAttribute('href')).toBe(
      '/auth/feide/login',
    );
  });
});
