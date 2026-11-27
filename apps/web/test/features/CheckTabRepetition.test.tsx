/**
 * Tests for the repetition suggestion on the activity page's **Sjekk og publiser** tab: it is shown for a published
 * activity whose phase is *Etterarbeid* and for no other, appears when the activity is published (the status says
 * so), and goes when the activity is made a draft again.
 *
 * Spec: PROD-014, UD-006
 */
// @vitest-environment jsdom
import type { ContentDetail, LearningDesign } from '@hvl-interaktiv/api-contract';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivityView } from '../../src/features/activity/ActivityView';
import { fakeFetch, type FakeAnswer } from '../support/fakeFetch';
import { DETAIL, ID, METADATA_PATH, OVERVIEW, STORED } from './learningDesignFixtures';

const PUBLISHED_AT = '2026-11-27T19:00:00.000Z';
const PUBLISHED: ContentDetail = { ...DETAIL, status: 'published', publishedAt: PUBLISHED_AT };
const ETTERARBEID: LearningDesign = { ...STORED, phase: 'etterarbeid' };
const HEADING = 'Forslag til repetisjon';

/** Opens the tab on an activity the fake server keeps: publishing and unpublishing change what it answers next. */
const openTab = async (start: ContentDetail, metadata: FakeAnswer) => {
  let detail = start;
  const became = (next: ContentDetail): FakeAnswer => {
    detail = next;
    return {
      status: 200,
      body: { status: next.status, updatedAt: next.updatedAt, publishedAt: next.publishedAt },
    };
  };
  const requests = fakeFetch({
    'GET /auth/session': { status: 200, body: { roles: ['author'], locale: 'nn', csrfToken: 'c' } },
    [`GET /api/content/${ID}`]: () => ({ status: 200, body: detail }),
    [`GET /api/content/${ID}/findings`]: { status: 200, body: { updatedAt: DETAIL.updatedAt, findings: [] } },
    [`POST /api/content/${ID}/publish`]: () => became(PUBLISHED),
    [`POST /api/content/${ID}/unpublish`]: () => became(DETAIL),
    [`GET ${METADATA_PATH}`]: metadata,
    'GET /api/studio': { status: 200, body: OVERVIEW },
    'GET /api/learning-design/course-codes': { status: 200, body: { inUse: [], fromCanvas: [] } },
  });
  render(<ActivityView contentId={ID} />);
  fireEvent.click(await screen.findByRole('tab', { name: 'Sjekk og publiser' }));
  const main = await screen.findByRole('button', {
    name: start.status === 'draft' ? 'Publiser' : 'Gjer om til utkast',
  });
  await waitFor(() => expect(requests.some((request) => request.path === METADATA_PATH)).toBe(true));
  // WHY: the request is recorded when it is sent; the tab has read the phase only once its answer has been handled.
  await act(() => new Promise<void>((resolve) => void setTimeout(resolve, 0)));
  return { requests, main };
};
const suggestion = () => screen.queryByRole('region', { name: HEADING });

describe('[PROD-014] the repetition suggestion on Sjekk og publiser', () => {
  it('[PROD-014] publishing an Etterarbeid activity shows the dates and says where they are', async () => {
    // Arrange
    await openTab(DETAIL, { status: 200, body: ETTERARBEID });
    expect(suggestion()).toBeNull();
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Publiser' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publiser no' }));
    // Assert: one status message for both, and the block after the main action in reading order
    const status = await screen.findByText(
      'Aktiviteten er publisert. Forslag til repetisjon står under knappen.',
    );
    expect(status.getAttribute('role')).toBe('status');
    const region = await screen.findByRole('region', { name: HEADING });
    expect(within(region).getAllByRole('listitem')).toHaveLength(2);
    const main = screen.getByRole('button', { name: 'Gjer om til utkast' });
    expect(main.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('[PROD-014] a published Etterarbeid activity shows the dates whenever the tab is opened', async () => {
    // Act
    await openTab(PUBLISHED, { status: 200, body: ETTERARBEID });
    // Assert
    const region = await screen.findByRole('region', { name: HEADING });
    expect(within(region).getByText(/fredag 4\. desember 2026/)).toBeTruthy();
    expect(within(region).getByRole('button', { name: 'Lag ein kopi' })).toBeTruthy();
  });

  it.each([
    ['another phase', PUBLISHED, { status: 200, body: STORED }],
    ['no phase', PUBLISHED, { status: 200, body: { outcomes: [], updatedAt: null } }],
    ['a learning design that cannot be read', PUBLISHED, { status: 403, body: {} }],
    ['a draft', DETAIL, { status: 200, body: ETTERARBEID }],
    ['no time of publishing', { ...PUBLISHED, publishedAt: null }, { status: 200, body: ETTERARBEID }],
  ])('[PROD-014] shows nothing for %s', async (_what, start, metadata) => {
    // Act
    await openTab(start, metadata);
    // Assert
    expect(suggestion()).toBeNull();
  });

  it('[PROD-014] publishing an activity of another phase says only that it is published', async () => {
    // Arrange
    await openTab(DETAIL, { status: 200, body: STORED });
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Publiser' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publiser no' }));
    // Assert
    expect((await screen.findByText('Aktiviteten er publisert.')).getAttribute('role')).toBe('status');
    expect(suggestion()).toBeNull();
  });

  it('[PROD-014] the suggestion goes when the activity is made a draft again', async () => {
    // Arrange
    const { main } = await openTab(PUBLISHED, { status: 200, body: ETTERARBEID });
    await screen.findByRole('region', { name: HEADING });
    // Act
    fireEvent.click(main);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Gjer om til utkast' }));
    // Assert
    await screen.findByRole('button', { name: 'Publiser' });
    await waitFor(() => expect(suggestion()).toBeNull());
  });
});
