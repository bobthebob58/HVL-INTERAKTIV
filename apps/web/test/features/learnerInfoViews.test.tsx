/**
 * Tests for what learners see before an activity starts: the estimated time and the purpose, in the portal's
 * **Spel** tab and on the Canvas page, before the player, with the purpose in the activity's own language.
 *
 * Spec: PED-032, UD-010
 */
// @vitest-environment jsdom
import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LearnerInfo } from '../../src/components/LearnerInfo';
import { ActivityView } from '../../src/features/activity/ActivityView';
import { LtiPlayView } from '../../src/features/lti/LtiPlayView';
import { resetTakenLtikForTests } from '../../src/features/lti/ltikFromAddress';
import { LocaleProvider } from '../../src/i18n/LocaleContext';
import { fakeFetch } from '../support/fakeFetch';

const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
const PURPOSE = 'You practise before the seminar.';
const DETAIL: ContentDetail = {
  id: ID,
  title: 'Cells',
  mainLibrary: 'H5P.Column',
  status: 'published',
  visibility: 'organisation',
  updatedAt: '2026-10-23T10:00:00.000Z',
  publishedAt: '2026-10-23T10:00:00.000Z',
  role: null,
  mayEdit: false,
  mayPublish: false,
  language: 'en',
  estimatedStudentMinutes: 15,
  learnerPurpose: PURPOSE,
};

afterEach(() => {
  resetTakenLtikForTests();
  window.history.replaceState(null, '', '/');
});

/** The section before the frame, and whether it comes first in the document. */
const infoBeforeFrame = (frameTitle: string) => {
  const section = screen.getByRole('region', { name: 'Før du startar' });
  const frame = screen.getByTitle(frameTitle);
  return {
    section,
    first: Boolean(section.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING),
  };
};

describe('[PED-032] the time and purpose before the activity', () => {
  it('[PED-032] the portal’s Spel tab shows them before the player, the purpose in the activity’s language', async () => {
    // Arrange
    fakeFetch({
      'GET /auth/session': { status: 200, body: { roles: ['learner'], locale: 'nn', csrfToken: 'c' } },
      [`GET /api/content/${ID}`]: { status: 200, body: DETAIL },
    });
    // Act
    render(<ActivityView contentId={ID} />);
    await screen.findByRole('heading', { level: 1, name: 'Cells' });
    // Assert
    const { section, first } = infoBeforeFrame('Spel: Cells');
    expect(first).toBe(true);
    expect(within(section).getByText('Om lag 15 minutt')).toBeTruthy();
    expect(within(section).getByText(PURPOSE).getAttribute('lang')).toBe('en');
  });

  it('[PED-032] the Canvas page shows them from the launch, before the player', () => {
    // Arrange
    window.history.replaceState(null, '', '/app/play?ltik=abc');
    const launch = {
      contentId: ID,
      title: 'Cells',
      mayEdit: false,
      locale: 'nn' as const,
      language: 'en',
      estimatedStudentMinutes: 1,
      learnerPurpose: PURPOSE,
    };
    // Act
    render(<LtiPlayView launch={launch} />);
    // Assert
    const { section, first } = infoBeforeFrame('Spel: Cells');
    expect(first).toBe(true);
    expect(within(section).getByText('Om lag 1 minutt')).toBeTruthy();
    expect(within(section).getByText(PURPOSE).getAttribute('lang')).toBe('en');
  });

  it('[UD-010] the purpose has no lang of its own when the activity is in the page’s language', () => {
    render(
      <LocaleProvider locale="nb">
        <LearnerInfo estimatedStudentMinutes={20} learnerPurpose="Du øver." language="nb-NO" />
      </LocaleProvider>,
    );
    expect(screen.getByText('Du øver.').hasAttribute('lang')).toBe(false);
    expect(screen.getByText('Omtrent 20 minutter')).toBeTruthy();
  });

  it('[PED-032] nothing is shown when neither is set', () => {
    const { container } = render(<LearnerInfo language="nn" />);
    expect(container.innerHTML).toBe('');
  });
});
