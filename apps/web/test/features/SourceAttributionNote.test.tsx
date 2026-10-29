/**
 * Tests for the attribution sign on a copy's page («Kopi av <tittel> av <namn>»): with a link to the original while
 * it can be opened, the unknown parts said in words, nothing on an original, and on the activity page itself, where
 * it stays after «Lagre som ny versjon» opened the copy.
 *
 * Spec: PROD-007, PROD-013
 */
// @vitest-environment jsdom
import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivityView } from '../../src/features/activity/ActivityView';
import { SourceAttributionNote } from '../../src/features/activity/SourceAttributionNote';
import { fakeFetch } from '../support/fakeFetch';
import { DETAIL, ID } from './learningDesignFixtures';

const SOURCE_ID = '0192f0c4-0000-7000-8000-00000000e001';
const COPY: ContentDetail = {
  ...DETAIL,
  sourceContentId: SOURCE_ID,
  sourceTitle: 'Celler og vev',
  sourceAuthorName: 'Ola Opphav',
};

describe('[PROD-007] the attribution sign of a copy', () => {
  it('[PROD-007] names the source and its author, with a link to the original', () => {
    render(<SourceAttributionNote detail={COPY} />);
    expect(screen.getByText(/Kopi av «Celler og vev» av Ola Opphav\./)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Opne originalen' }).getAttribute('href')).toBe(
      `/aktivitet/${SOURCE_ID}`,
    );
  });

  it.each([
    [
      'a source the person may no longer open',
      { sourceAuthorName: 'Ola Opphav' },
      'Kopi av ein aktivitet av Ola Opphav. Du har ikkje tilgang til originalen lenger.',
    ],
    [
      'an author without a known name',
      { sourceContentId: SOURCE_ID, sourceTitle: 'Celler og vev' },
      'Kopi av «Celler og vev» av ein ukjend forfattar.',
    ],
  ])('[PROD-007] says so in words for %s', (_name, fields, text) => {
    render(<SourceAttributionNote detail={{ ...DETAIL, ...fields }} />);
    expect(screen.getByText(text, { exact: false })).toBeTruthy();
  });

  it('[PROD-007] shows nothing on an original', () => {
    const { container } = render(<SourceAttributionNote detail={DETAIL} />);
    expect(container.textContent).toBe('');
  });

  it('[PROD-013] the copy’s own page shows the sign to its editor, as after «Lagre som ny versjon»', async () => {
    // Arrange
    fakeFetch({
      'GET /auth/session': { status: 200, body: { roles: ['author'], locale: 'nn', csrfToken: 'c' } },
      [`GET /api/content/${ID}`]: { status: 200, body: COPY },
      'GET /api/me': {
        status: 200,
        body: { kind: 'portal', locale: 'nn', roles: ['author'], dismissedNotices: [] },
      },
    });
    // Act
    render(<ActivityView contentId={ID} />);
    // Assert
    expect(await screen.findByText(/Kopi av «Celler og vev» av Ola Opphav\./)).toBeTruthy();
  });
});
