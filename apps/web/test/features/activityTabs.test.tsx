/**
 * Tests for the activity page's tab registry: the tabs and their order, who gets each one, the tab the address asks
 * for, and that a tab panel gets the page's shared props (so a workstream's tab is one file and one registry line).
 *
 * Spec: UD-006, LTI-006, PROD-003
 */
// @vitest-environment jsdom
import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ActivityView } from '../../src/features/activity/ActivityView';
import type { ActivityTab } from '../../src/features/activity/tabs/activityTab';
import {
  ACTIVITY_TABS,
  activityTabsFor,
  forEditors,
  selectableTabId,
} from '../../src/features/activity/tabs/activityTabs';
import { errorBody, fakeFetch } from '../support/fakeFetch';

const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
const DETAIL: ContentDetail = {
  id: ID,
  title: 'Celler og vev',
  mainLibrary: 'H5P.Column',
  status: 'draft',
  visibility: 'private',
  updatedAt: '2026-10-23T10:00:00.000Z',
  publishedAt: null,
  role: 'owner',
  mayEdit: true,
  mayPublish: true,
};
const VIEWER: ContentDetail = { ...DETAIL, role: null, mayEdit: false, mayPublish: false };
const ids = (tabs: readonly ActivityTab[]) => tabs.map((tab) => tab.id);

const routes = (detail: ContentDetail) => ({
  'GET /auth/session': { status: 200, body: { roles: ['author'], locale: 'nn', csrfToken: 'csrf-1' } },
  [`GET /api/content/${ID}`]: { status: 200, body: detail },
  [`GET /api/content/${ID}/findings`]: { status: 200, body: { updatedAt: detail.updatedAt, findings: [] } },
  'GET /api/me': {
    status: 200,
    body: { kind: 'portal', locale: 'nn', roles: ['author'], dismissedNotices: [] },
  },
});

describe('[UD-006] the activity page’s tab registry', () => {
  it('[UD-006] lists Spel, Rediger, Læringsdesign and Sjekk og publiser in that order, each id once', () => {
    expect(ids(ACTIVITY_TABS)).toEqual(['play', 'edit', 'learning-design', 'check']);
    expect(new Set(ids(ACTIVITY_TABS)).size).toBe(ACTIVITY_TABS.length);
  });

  it.each([
    ['an owner', DETAIL, ['play', 'edit', 'learning-design', 'check']],
    ['an editor who may not publish', { ...DETAIL, mayPublish: false }, ['play', 'edit', 'learning-design']],
    ['a viewer', VIEWER, ['play']],
  ] as const)('[LTI-006] %s gets the tabs the server’s answer allows', (_case, detail, expected) => {
    expect(ids(activityTabsFor(detail))).toEqual(expected);
  });

  it('[UD-006] the tab asked for is selected only when the person gets it; otherwise Spel', () => {
    expect(selectableTabId('check', activityTabsFor(DETAIL))).toBe('check');
    expect(selectableTabId('edit', activityTabsFor(VIEWER))).toBe('play');
    expect(selectableTabId('no-such-tab', activityTabsFor(DETAIL))).toBe('play');
    expect(selectableTabId(undefined, activityTabsFor(DETAIL))).toBe('play');
  });

  it('[UD-006] a registered tab’s panel gets the activity and can select another tab', () => {
    // Arrange
    const Extra: ActivityTab = {
      id: 'extra',
      labelKey: 'studio.navPlanner',
      shows: forEditors,
      Panel: ({ detail, selectTab }) => (
        <button type="button" onClick={() => selectTab('play')}>
          {detail.title}
        </button>
      ),
    };
    // Act
    const shown = activityTabsFor(DETAIL, [...ACTIVITY_TABS, Extra]);
    const Panel = shown[4]?.Panel;
    let selected = '';
    render(Panel ? <Panel {...panelProps(DETAIL, (id) => (selected = id))} /> : null);
    fireEvent.click(screen.getByRole('button', { name: 'Celler og vev' }));
    // Assert
    expect(ids(shown)).toEqual(['play', 'edit', 'learning-design', 'check', 'extra']);
    expect(selected).toBe('play');
    expect(ids(activityTabsFor(VIEWER, [...ACTIVITY_TABS, Extra]))).toEqual(['play']);
  });
});

describe('[LTI-006] the activity page opened on a tab', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('[LTI-006] `?fane=edit` opens the editor tab for an editor, as after creating from a pattern', async () => {
    // Arrange
    window.history.replaceState(null, '', `/aktivitet/${ID}?fane=edit`);
    fakeFetch(routes(DETAIL));
    // Act
    render(<ActivityView contentId={ID} />);
    // Assert
    const tab = await screen.findByRole('tab', { name: 'Rediger' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTitle('Rediger: Celler og vev').getAttribute('src')).toBe(`/h5p/edit/${ID}`);
  });

  it('[LTI-006] a tab the person does not get falls back to Spel', async () => {
    // Arrange
    window.history.replaceState(null, '', `/aktivitet/${ID}?fane=check`);
    fakeFetch(routes(VIEWER));
    // Act
    render(<ActivityView contentId={ID} />);
    // Assert
    const tab = await screen.findByRole('tab', { name: 'Spel' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });

  it('[LTI-006] signed out, the login link comes back to the tab the address asked for', async () => {
    // Arrange
    window.history.replaceState(null, '', `/aktivitet/${ID}?fane=edit`);
    fakeFetch({ 'GET /auth/session': { status: 401, body: errorBody(401, 'hvl:unauthenticated') } });
    // Act
    render(<ActivityView contentId={ID} />);
    // Assert
    const link = await screen.findByRole('link', { name: 'Logg inn med Feide' });
    expect(link.getAttribute('href')).toBe(
      `/auth/feide/login?returnTo=${encodeURIComponent(`/aktivitet/${ID}?fane=edit`)}`,
    );
  });
});

function panelProps(detail: ContentDetail, selectTab: (id: string) => void) {
  return {
    detail,
    revision: 0,
    reloadDetail: async () => undefined,
    goToField: () => undefined,
    selectTab,
    announce: () => undefined,
    frames: { playerRef: { current: null }, editorRef: { current: null }, onEditorLoad: () => undefined },
  };
}
