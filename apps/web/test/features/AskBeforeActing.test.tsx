/**
 * Tests that the three controls which take something away ask before they act (D-125): going back to draft, removing
 * a co-author (someone else, or oneself) and taking an activity out of the content bank. One press opens a question
 * that says what it means; nothing is sent before the answer; «Avbryt» and Escape close it, send nothing and give
 * focus back to the control; the action's button sends the request once.
 *
 * Spec: UD-006, PROD-007, PROD-003
 */
// @vitest-environment jsdom
import type { CoAuthorList, ContentDetail } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiAuthProvider } from '../../src/api/ApiAuthContext';
import { CheckPanel } from '../../src/features/activity/CheckPanel';
import { BankListingSection } from '../../src/features/sharing/BankListingSection';
import { CoAuthorSection } from '../../src/features/sharing/CoAuthorSection';
import { confirmQuestion } from '../support/confirmQuestion';
import { fakeFetch, type FakeRoutes } from '../support/fakeFetch';

const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
const UPDATED = '2026-10-23T10:00:00.000Z';
const DETAIL: ContentDetail = {
  id: ID,
  title: 'Celler og vev',
  mainLibrary: 'H5P.Column',
  status: 'published',
  visibility: 'organisation',
  updatedAt: UPDATED,
  publishedAt: UPDATED,
  role: 'owner',
  mayEdit: true,
  mayPublish: true,
};
const OWNER = { userId: '0192f0c4-0000-7000-8000-00000000b001', displayName: 'Eva Eigar' };
const OLA = { userId: '0192f0c4-0000-7000-8000-00000000b002', displayName: 'Ola Kollega', isSelf: false };
const ME = { userId: '0192f0c4-0000-7000-8000-00000000b003', displayName: 'Kari Nordmann', isSelf: true };
const coAuthors = (list: Partial<CoAuthorList>): CoAuthorList => ({
  owner: OWNER,
  coAuthors: [],
  mayManage: false,
  ...list,
});
const COAUTHORS = `/api/content/${ID}/coauthors`;
const BANK = `/api/content/${ID}/bank`;

interface Case {
  readonly name: string;
  /** The control's text, which is also the text of the action in the question. */
  readonly control: string;
  readonly question: string;
  readonly consequence: string;
  /** The request the action sends, as `METHOD path`. */
  readonly request: string;
  readonly routes: FakeRoutes;
  readonly ui: ReactElement;
}
const CASES: Case[] = [
  {
    name: 'going back to draft',
    control: 'Gjer om til utkast',
    question: 'Gjere aktiviteten om til utkast?',
    consequence: 'Studentane kan ikkje opne aktiviteten før han er publisert på nytt.',
    request: `POST /api/content/${ID}/unpublish`,
    routes: {
      [`GET /api/content/${ID}/findings`]: { status: 200, body: { updatedAt: UPDATED, findings: [] } },
      [`POST /api/content/${ID}/unpublish`]: { status: 200, body: { status: 'draft', updatedAt: UPDATED } },
    },
    ui: (
      <ApiAuthProvider auth={{ kind: 'portal', csrfToken: 'csrf-1' }}>
        <CheckPanel
          detail={DETAIL}
          revision={0}
          onGoToField={() => undefined}
          onStatusChange={() => undefined}
        />
      </ApiAuthProvider>
    ),
  },
  {
    name: 'removing a co-author',
    control: 'Fjern Ola Kollega',
    question: 'Fjerne Ola Kollega som medforfattar?',
    consequence: 'Ola Kollega kan ikkje lenger redigere aktiviteten.',
    request: `DELETE ${COAUTHORS}/${OLA.userId}`,
    routes: {
      [`GET ${COAUTHORS}`]: { status: 200, body: coAuthors({ coAuthors: [OLA], mayManage: true }) },
      [`DELETE ${COAUTHORS}/${OLA.userId}`]: { status: 200, body: coAuthors({ mayManage: true }) },
    },
    ui: <CoAuthorSection contentId={ID} announce={() => undefined} />,
  },
  {
    name: 'removing oneself as co-author',
    control: 'Fjern meg',
    question: 'Fjerne deg sjølv som medforfattar?',
    consequence: 'Du kan ikkje lenger redigere aktiviteten.',
    request: `DELETE ${COAUTHORS}/${ME.userId}`,
    routes: {
      [`GET ${COAUTHORS}`]: { status: 200, body: coAuthors({ coAuthors: [ME] }) },
      [`DELETE ${COAUTHORS}/${ME.userId}`]: { status: 200, body: coAuthors({}) },
    },
    ui: <CoAuthorSection contentId={ID} announce={() => undefined} />,
  },
  {
    name: 'taking the activity out of the content bank',
    control: 'Ta ut av innhaldsbanken',
    question: 'Ta aktiviteten ut av innhaldsbanken?',
    consequence: 'Kollegaer finn han ikkje lenger i innhaldsbanken. Kopiar som alt er laga, blir verande.',
    request: `DELETE ${BANK}`,
    routes: {
      [`GET ${BANK}`]: { status: 200, body: { listedAt: UPDATED, eligible: true } },
      [`DELETE ${BANK}`]: { status: 200, body: { listedAt: null, eligible: true } },
    },
    ui: <BankListingSection detail={DETAIL} announce={() => undefined} />,
  },
];

describe('[UD-006] controls that take something away ask first', () => {
  it.each(CASES)(
    '[UD-006] $name: one press asks and sends nothing; «Avbryt» and Escape send nothing and return focus',
    async (c) => {
      // Arrange
      const requests = fakeFetch(c.routes);
      const sent = () =>
        requests.filter((request) => `${request.method} ${request.path}` === c.request).length;
      render(c.ui);
      const control = await screen.findByRole('button', { name: c.control });
      control.focus();
      // Act: press, and answer «Avbryt»
      fireEvent.click(control);
      const asked = screen.getByRole('dialog', { name: c.question });
      const said = asked.textContent ?? '';
      confirmQuestion('Avbryt');
      // Assert: the question said what it means, nothing was sent, and focus is back on the control
      expect(said).toContain(c.consequence);
      expect(screen.queryByRole('dialog')).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(control));
      // Act: press again, and close with Escape
      fireEvent.click(control);
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      // Assert
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(sent()).toBe(0);
    },
  );

  it.each(CASES)('[PROD-007] $name: the action in the question sends the request once', async (c) => {
    // Arrange
    const requests = fakeFetch(c.routes);
    const sent = () => requests.filter((request) => `${request.method} ${request.path}` === c.request).length;
    render(c.ui);
    // Act
    fireEvent.click(await screen.findByRole('button', { name: c.control }));
    confirmQuestion(c.control);
    // Assert
    await waitFor(() => expect(sent()).toBe(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
