/**
 * Tests for what the activity page hands a tab of the registry (`ActivityTabProps`), with a stand-in tab added to the
 * registry the way the S5 workstreams add **Læringsdesign** and **Deling**: selecting another tab, and ignoring one the
 * person does not get; announcing in the page's status region; loading the activity again; and the portal credential
 * for the tab's own API calls.
 *
 * Spec: UD-006, LTI-006
 */
// @vitest-environment jsdom
import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useApiAuth } from '../../src/api/ApiAuthContext';
import { ActivityView } from '../../src/features/activity/ActivityView';
import type { ActivityTabProps } from '../../src/features/activity/tabs/activityTab';
import { fakeFetch, type FakeRoutes } from '../support/fakeFetch';

vi.mock('../../src/features/activity/tabs/activityTabs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/activity/tabs/activityTabs')>();
  const probe = {
    id: 'probe',
    // WHY: a label no real tab has, so the stand-in is never confused with a workstream's tab.
    labelKey: 'studio.navPlanner',
    shows: actual.forEveryone,
    Panel: ProbePanel,
  } as const;
  return {
    ...actual,
    activityTabsFor: (detail: ContentDetail) =>
      actual.activityTabsFor(detail, [...actual.ACTIVITY_TABS, probe]),
  };
});

/** A stand-in tab panel that uses every prop a workstream's tab may use. */
function ProbePanel({ selectTab, announce, reloadDetail }: ActivityTabProps) {
  const auth = useApiAuth();
  return (
    <>
      <p>{auth.kind === 'portal' ? `token ${auth.csrfToken ?? 'none'}` : 'lti'}</p>
      <button type="button" onClick={() => selectTab('check')}>
        Til sjekk
      </button>
      <button type="button" onClick={() => announce('Lagra.')}>
        Sei frå
      </button>
      <button type="button" onClick={() => void reloadDetail()}>
        Last på nytt
      </button>
    </>
  );
}

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

const routes = (detail: ContentDetail): FakeRoutes => ({
  'GET /auth/session': { status: 200, body: { roles: ['author'], locale: 'nn', csrfToken: 'csrf-1' } },
  [`GET /api/content/${ID}`]: { status: 200, body: detail },
  [`GET /api/content/${ID}/findings`]: { status: 200, body: { updatedAt: detail.updatedAt, findings: [] } },
  'GET /api/me': {
    status: 200,
    body: { kind: 'portal', locale: 'nn', roles: ['author'], dismissedNotices: [] },
  },
});

const selected = () => screen.getByRole('tab', { selected: true }).textContent;

describe('[UD-006] what the activity page gives a registered tab', () => {
  it('[UD-006] a tab can select another tab, and nothing happens for a tab the person does not get', async () => {
    // Arrange
    fakeFetch(routes(VIEWER));
    const viewer = render(<ActivityView contentId={ID} />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Planleggar' }));
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Til sjekk' }));
    const viewerTab = selected();
    viewer.unmount();
    fakeFetch(routes(DETAIL));
    render(<ActivityView contentId={ID} />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Planleggar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Til sjekk' }));
    // Assert
    expect(viewerTab).toBe('Planleggar');
    expect(selected()).toBe('Sjekk og publiser');
  });

  it('[LTI-006] a tab announces in the page’s status region, reloads the activity and has the credential', async () => {
    // Arrange
    const requests = fakeFetch(routes(DETAIL));
    render(<ActivityView contentId={ID} />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Planleggar' }));
    const loads = () => requests.filter((request) => request.path === `/api/content/${ID}`).length;
    const before = loads();
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Sei frå' }));
    fireEvent.click(screen.getByRole('button', { name: 'Last på nytt' }));
    // Assert
    expect(screen.getByText('token csrf-1')).toBeTruthy();
    expect(screen.getAllByRole('status').map((region) => region.textContent)).toContain('Lagra.');
    await waitFor(() => expect(loads()).toBe(before + 1));
  });
});
