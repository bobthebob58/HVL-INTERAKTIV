/**
 * Tests for the activity page while the editor's save choice is open (PROD-013, D-093): the page's own controls are
 * inert and the editor frame is not, until the dialog closes or the frame loads another document; after «Lagre som
 * ny versjon» the page says so and opens the new version's Rediger tab; a message from anywhere else changes nothing.
 * The Canvas page does the same without a copy.
 *
 * Spec: PROD-013, UD-006
 */
// @vitest-environment jsdom
import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActivityView } from '../../src/features/activity/ActivityView';
import { resetTakenLtikForTests } from '../../src/features/lti/ltikFromAddress';
import { LtiPlayView } from '../../src/features/lti/LtiPlayView';
import { t } from '../../src/i18n/translate';
import { CONTENT_COPIED, MODAL_CLOSED, MODAL_OPEN } from '../../src/messaging/frameMessages';
import { fakeFetch } from '../support/fakeFetch';

const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
const COPY = '0f9e8d7c-6b5a-4c3d-8e2f-1a0b9c8d7e6f';
const DETAIL: ContentDetail = {
  id: ID,
  title: 'Celler og vev',
  mainLibrary: 'H5P.MultiChoice',
  status: 'published',
  visibility: 'organisation',
  updatedAt: '2026-10-29T10:00:00.000Z',
  publishedAt: '2026-10-28T10:00:00.000Z',
  role: 'owner',
  mayEdit: true,
  mayPublish: true,
};

/** The activity page on its Rediger tab, and a way to post a message as a window would. */
const openEditTab = async (navigate = vi.fn()) => {
  fakeFetch({
    'GET /auth/session': { status: 200, body: { roles: ['author'], locale: 'nn', csrfToken: 'csrf-1' } },
    [`GET /api/content/${ID}`]: { status: 200, body: DETAIL },
    'GET /api/me': {
      status: 200,
      body: { kind: 'portal', locale: 'nn', roles: ['author'], dismissedNotices: [] },
    },
  });
  render(<ActivityView contentId={ID} navigate={navigate} />);
  fireEvent.click(await screen.findByRole('tab', { name: 'Rediger' }));
  const frame = screen.getByTitle('Rediger: Celler og vev') as HTMLIFrameElement;
  const post = (data: unknown, source: MessageEventSource | null = frame.contentWindow) =>
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data, origin: window.location.origin, source }));
    });
  return { frame, post, navigate };
};

/** Whether the element or one of its ancestors is inert, so nothing can reach it. */
const unreachable = (element: Element): boolean => element.closest('[inert]') !== null;

describe('[PROD-013] the activity page and the editor’s save choice', () => {
  it('[UD-006] while the dialog is open, the page’s heading and tabs are out of reach and the editor frame is not', async () => {
    // Arrange
    const { frame, post } = await openEditTab();
    // Act
    post({ type: MODAL_OPEN });
    // Assert
    expect(unreachable(screen.getByRole('heading', { level: 1 }))).toBe(true);
    expect(unreachable(document.querySelector('[role="tablist"]') as Element)).toBe(true);
    expect(unreachable(frame)).toBe(false);
    post({ type: MODAL_CLOSED });
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
  });

  it('[UD-006] a frame that loads another document leaves the page reachable, though it never said it closed', async () => {
    const { frame, post } = await openEditTab();
    post({ type: MODAL_OPEN });
    fireEvent.load(frame);
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
  });

  it('[PROD-013] after «Lagre som ny versjon» the page says it opens the new version and goes to its Rediger tab', async () => {
    // Arrange
    const { post, navigate } = await openEditTab();
    // Act
    post({ type: MODAL_OPEN });
    post({ type: MODAL_CLOSED });
    post({ type: CONTENT_COPIED, contentId: COPY });
    // Assert
    expect(navigate).toHaveBeenCalledWith(`/aktivitet/${COPY}?fane=edit`);
    const opening = t('safeEditing.openingCopy', 'nn');
    expect(screen.getAllByRole('status').some((s) => s.textContent === opening)).toBe(true);
  });

  it('[PROD-013] a message from another window, or a copy ID that is not one, changes nothing', async () => {
    // Arrange
    const { post, navigate } = await openEditTab();
    // Act
    post({ type: MODAL_OPEN }, window);
    post({ type: CONTENT_COPIED, contentId: COPY }, window);
    post({ type: CONTENT_COPIED, contentId: '../admin' });
    // Assert
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('[PROD-013] the Canvas page and the editor’s save choice', () => {
  it('[UD-006] keeps its own heading and tabs out of reach while the dialog is open, and opens no copy', () => {
    // Arrange
    resetTakenLtikForTests();
    window.history.replaceState(null, '', '/app/play?ltik=abc');
    fakeFetch({
      'GET /api/me': {
        status: 200,
        body: { kind: 'lti', locale: 'nn', roles: ['author'], dismissedNotices: [] },
      },
    });
    const launch = { contentId: ID, title: 'Celler og vev', mayEdit: true, locale: 'nn' } as const;
    render(<LtiPlayView launch={launch} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Rediger' }));
    const frame = screen.getByTitle('Rediger: Celler og vev') as HTMLIFrameElement;
    const post = (data: unknown) =>
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', { data, origin: window.location.origin, source: frame.contentWindow }),
        );
      });
    // Act
    post({ type: MODAL_OPEN });
    const during = unreachable(screen.getByRole('heading', { level: 1 }));
    post({ type: MODAL_CLOSED });
    post({ type: CONTENT_COPIED, contentId: COPY });
    // Assert
    expect([during, unreachable(frame)]).toEqual([true, false]);
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    expect(window.location.pathname).toBe('/app/play');
    resetTakenLtikForTests();
    window.history.replaceState(null, '', '/');
  });
});
