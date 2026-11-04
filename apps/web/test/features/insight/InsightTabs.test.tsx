/**
 * Tests for where the Innsikt tab appears: on the activity page for the owner and co-authors only (not an admin
 * through the role, D-106), with the way to the check tab for those who may publish; and in Canvas for authors next
 * to Rediger, not for learners.
 *
 * Spec: PROD-010, INS-007, LTI-006
 */
// @vitest-environment jsdom
import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { activityTabsFor } from '../../../src/features/activity/tabs/activityTabs';
import type { ActivityTabProps } from '../../../src/features/activity/tabs/activityTab';
import { INSIGHT_TAB_ID, InsightTab } from '../../../src/features/activity/tabs/InsightTab';
import { resetTakenLtikForTests } from '../../../src/features/lti/ltikFromAddress';
import { LtiPlayView } from '../../../src/features/lti/LtiPlayView';
import { fakeFetch } from '../../support/fakeFetch';
import { FINDINGS_PATH, ID } from './insightAnswers';
import { FINDINGS } from './insightOtherAnswers';

const DETAIL: ContentDetail = {
  id: ID,
  title: 'Celler og vev',
  mainLibrary: 'H5P.QuestionSet',
  status: 'published',
  visibility: 'private',
  updatedAt: '2026-11-01T10:00:00.000Z',
  publishedAt: '2026-11-01T10:00:00.000Z',
  role: 'coAuthor',
  mayEdit: true,
  mayPublish: true,
};

const props = (
  detail: ContentDetail,
  selectTab: (id: string) => void = () => undefined,
): ActivityTabProps => ({
  detail,
  revision: 0,
  reloadDetail: async () => undefined,
  goToField: () => undefined,
  selectTab,
  announce: () => undefined,
  frames: { playerRef: { current: null }, editorRef: { current: null }, onEditorLoad: () => undefined },
});

afterEach(() => {
  resetTakenLtikForTests();
  window.history.replaceState(null, '', '/');
});

describe('[PROD-010] the Innsikt tab’s place', () => {
  it.each([
    ['a co-author', DETAIL, true],
    ['an owner who may not publish', { ...DETAIL, role: 'owner' as const, mayPublish: false }, true],
    ['an admin who neither owns nor co-authors it', { ...DETAIL, role: null }, false],
    ['a colleague who may only view', { ...DETAIL, role: null, mayEdit: false, mayPublish: false }, false],
  ])('[INS-007] the activity page gives %s the tab: %s', (_who, detail, expected) => {
    expect(activityTabsFor(detail).some((tab) => tab.id === INSIGHT_TAB_ID)).toBe(expected);
  });

  it('[INS-010] the tab offers the way to Sjekk og publiser only to those who may publish', async () => {
    // Arrange
    fakeFetch({ [`GET ${FINDINGS_PATH}`]: { status: 200, body: FINDINGS } });
    let selected = '';
    // Act
    const { unmount } = render(<InsightTab {...props(DETAIL, (id) => (selected = id))} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Opne Sjekk og publiser' }));
    // Assert
    expect(selected).toBe('check');
    unmount();
    render(<InsightTab {...props({ ...DETAIL, mayPublish: false })} />);
    await screen.findByText(/Biletet manglar alternativ tekst/);
    expect(screen.queryByRole('button', { name: 'Opne Sjekk og publiser' })).toBeNull();
  });

  it('[LTI-006] Canvas gives authors Innsikt next to Rediger, and learners no tabs', () => {
    // Arrange
    fakeFetch({
      'GET /api/me': {
        status: 200,
        body: { kind: 'lti', locale: 'nn', roles: ['author'], dismissedNotices: [] },
      },
    });
    const launch = { contentId: ID, title: 'Celler og vev', mayEdit: true, locale: 'nn' as const };
    window.history.replaceState(null, '', '/app/play?ltik=abc');
    // Act
    const { unmount } = render(<LtiPlayView launch={launch} />);
    // Assert
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toContain('Innsikt');
    unmount();
    resetTakenLtikForTests();
    window.history.replaceState(null, '', '/app/play?ltik=abc');
    render(<LtiPlayView launch={{ ...launch, mayEdit: false }} />);
    expect(screen.queryByRole('tab', { name: 'Innsikt' })).toBeNull();
  });
});
