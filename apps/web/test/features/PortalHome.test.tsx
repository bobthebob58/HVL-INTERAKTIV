/**
 * Tests for the start page's content: Feide login when signed out; the person's activities with status, "Ny
 * aktivitet" for authors, and logout as a POST form with the CSRF token when signed in.
 *
 * Spec: AUTH-001, AUTH-003, PROD-003
 */
// @vitest-environment jsdom
import type { ContentSummary } from '@hvl-interaktiv/api-contract';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PortalHome } from '../../src/features/portal/PortalHome';
import { errorBody, fakeFetch } from '../support/fakeFetch';

const session = (roles: string[]) => ({
  status: 200,
  body: { roles, locale: 'nn', hvlMember: true, studentAuthor: false, csrfToken: 'csrf-1' },
});
const ITEM: ContentSummary = {
  id: '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f',
  title: 'Celler og vev',
  mainLibrary: 'H5P.MultiChoice',
  status: 'published',
  visibility: 'private',
  updatedAt: '2026-10-23T10:00:00.000Z',
  publishedAt: '2026-10-23T10:00:00.000Z',
  role: 'coAuthor',
};

describe('[AUTH-003] the start page', () => {
  it('[AUTH-001] signed out: offers Feide login', async () => {
    fakeFetch({ 'GET /auth/session': { status: 401, body: errorBody(401, 'hvl:unauthenticated') } });
    render(<PortalHome />);
    expect((await screen.findByRole('link', { name: 'Logg inn med Feide' })).getAttribute('href')).toBe(
      '/auth/feide/login',
    );
  });

  it('[PROD-003] signed in: lists own and co-authored activities with status, type and role', async () => {
    // Arrange
    fakeFetch({
      'GET /auth/session': session(['author']),
      'GET /api/content': { status: 200, body: { items: [ITEM] } },
    });
    // Act
    render(<PortalHome />);
    // Assert
    const link = await screen.findByRole('link', { name: 'Celler og vev' });
    expect(link.getAttribute('href')).toBe(`/aktivitet/${ITEM.id}`);
    const item = link.closest('li') as HTMLElement;
    expect(within(item).getByText('Publisert', { exact: false })).toBeTruthy();
    expect(within(item).getByText('Type: Fleirval')).toBeTruthy();
    expect(within(item).getByText('Rolle: Medforfattar')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ny aktivitet' }).getAttribute('href')).toBe('/aktivitet/ny');
  });

  it('[AUTH-003] logout is a POST form to /auth/logout with the CSRF token in the field csrf', async () => {
    // Arrange
    fakeFetch({
      'GET /auth/session': session(['author']),
      'GET /api/content': { status: 200, body: { items: [] } },
    });
    // Act
    render(<PortalHome />);
    // Assert
    const button = await screen.findByRole('button', { name: 'Logg ut' });
    const form = button.closest('form') as HTMLFormElement;
    expect(form.getAttribute('method')).toBe('post');
    expect(form.getAttribute('action')).toBe('/auth/logout');
    expect((form.elements.namedItem('csrf') as HTMLInputElement).value).toBe('csrf-1');
    expect(await screen.findByText('Du har ingen aktivitetar enno.')).toBeTruthy();
  });

  it('[AUTH-003] a learner gets no "Ny aktivitet" and is pointed to Canvas', async () => {
    fakeFetch({
      'GET /auth/session': session(['learner']),
      'GET /api/content': { status: 200, body: { items: [] } },
    });
    render(<PortalHome />);
    expect(await screen.findByText(/logga inn som student/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Ny aktivitet' })).toBeNull();
  });

  it('[AUTH-003] a failed list says so in an alert', async () => {
    fakeFetch({ 'GET /auth/session': session(['author']), 'GET /api/content': { status: 500, body: {} } });
    render(<PortalHome />);
    expect((await screen.findByRole('alert')).textContent).toContain('Klarte ikkje å hente innhaldet');
  });
});
