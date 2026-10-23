/**
 * Tests for the new-activity page: authors get the editor frame with the formative notice; after the first save the
 * page goes to the new activity; learners and signed-out visitors get an explanation instead.
 *
 * Spec: H5P-002, PROD-011, PROD-003
 */
// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NewActivityView } from '../../src/features/activity/NewActivityView';
import { CONTENT_SAVED } from '../../src/messaging/frameMessages';
import { errorBody, fakeFetch } from '../support/fakeFetch';

const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
const session = (roles: string[]) => ({ status: 200, body: { roles, locale: 'nn', csrfToken: 'csrf-1' } });
const ME = { status: 200, body: { kind: 'portal', locale: 'nn', roles: ['author'], dismissedNotices: [] } };

describe('[H5P-002] the new-activity page', () => {
  it('[PROD-003] frames the editor with the notice and goes to the activity after the first save', async () => {
    // Arrange
    fakeFetch({ 'GET /auth/session': session(['author']), 'GET /api/me': ME });
    const navigate = vi.fn();
    render(<NewActivityView navigate={navigate} />);
    const frame = (await screen.findByTitle('Lag ny aktivitet')) as HTMLIFrameElement;
    // Act
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: CONTENT_SAVED, contentId: ID },
          origin: window.location.origin,
          source: frame.contentWindow,
        }),
      );
    });
    // Assert
    expect(frame.getAttribute('src')).toBe('/h5p/new');
    expect(await screen.findByRole('region', { name: /Til undervegsvurdering/ })).toBeTruthy();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(`/aktivitet/${ID}`));
    expect(screen.getByText('Opnar aktiviteten …')).toBeTruthy();
  });

  it('[H5P-002] a learner gets an explanation and no editor', async () => {
    fakeFetch({ 'GET /auth/session': session(['learner']) });
    render(<NewActivityView navigate={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Berre tilsette og studentar med forfattarrolle',
    );
    expect(screen.queryByTitle('Lag ny aktivitet')).toBeNull();
  });

  it('[H5P-002] signed out: the login link returns to this page', async () => {
    fakeFetch({ 'GET /auth/session': { status: 401, body: errorBody(401, 'hvl:unauthenticated') } });
    render(<NewActivityView navigate={vi.fn()} />);
    expect((await screen.findByRole('link', { name: 'Logg inn med Feide' })).getAttribute('href')).toBe(
      '/auth/feide/login?returnTo=%2Faktivitet%2Fny',
    );
  });
});
