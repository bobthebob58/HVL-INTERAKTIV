/**
 * Tests that focus after a change on the **Deling** tab waits for the commit that renders the server's answer, also
 * when the answer is handled while the passive effects (`useEffect`) of an earlier commit still wait (that earlier
 * effect must neither move focus nor use up the request, `useFocusAfterChange`), and that focus the owner has moved
 * elsewhere while the change was on its way stays there.
 *
 * Why: the S5 gate failed once under CPU load: after «Fjern meg» the lasting message was shown, but focus stayed on
 *      `body`. React runs a commit's passive effects in a later Scheduler task (it yields to paint after a commit),
 *      and Testing Library's `findBy*` resolves on a 0 ms timer, which a busy machine may run before that task.
 *      These tests force the same orders on every run instead of waiting for a busy machine, and the first two
 *      check, at the moment the section has handled the answer, that the order was forced before they check focus.
 * Spec: UD-006, PROD-007
 * Collaborators: ../support/commitOrder.tsx (forces the orders), ../support/fakeFetch.ts.
 */
// @vitest-environment jsdom
import type { CoAuthorList, ContentDetail } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BankListingSection } from '../../src/features/sharing/BankListingSection';
import { CoAuthorSection } from '../../src/features/sharing/CoAuthorSection';
import { gate, holdAnswer, watchCommits } from '../support/commitOrder';
import { fakeFetch } from '../support/fakeFetch';
import { DETAIL, ID } from './learningDesignFixtures';

const COAUTHORS = `/api/content/${ID}/coauthors`;
const BANK = `/api/content/${ID}/bank`;
const OWNER = { userId: '0192f0c4-0000-7000-8000-00000000b001', displayName: 'Eva Eigar' };
const OLA = { userId: '0192f0c4-0000-7000-8000-00000000b002', displayName: 'Ola Kollega', isSelf: false };
const KARI = { userId: '0192f0c4-0000-7000-8000-00000000b003', displayName: 'Kari Nordmann', isSelf: true };
const AS_CO_AUTHOR: CoAuthorList = { owner: OWNER, coAuthors: [OLA, KARI], mayManage: false };
const SHARED: ContentDetail = { ...DETAIL, status: 'published', visibility: 'organisation' };
const LISTED_AT = '2026-10-20T10:00:00.000Z';
// WHY: a re-read that still lists the activity says so with another date, which marks its answer on screen.
const REREAD_LISTED_AT = '2026-10-21T10:00:00.000Z';

describe('[UD-006] focus after a sharing change, whatever runs first', () => {
  it('[UD-006] «Fjern meg» answered while the list’s effects still wait: focus waits for the lasting message and lands on it', async () => {
    // Arrange
    const watch = watchCommits();
    let flushesAtHandled = -1;
    fakeFetch({
      [`GET ${COAUTHORS}`]: { status: 200, body: AS_CO_AUTHOR },
      [`DELETE ${COAUTHORS}/${KARI.userId}`]: { status: 200, body: { ...AS_CO_AUTHOR, coAuthors: [OLA] } },
    });
    const announce = () => (flushesAtHandled = watch.flushes);
    render(watch.wrap(<CoAuthorSection contentId={ID} announce={announce} />));
    const flushesBefore = watch.flushes;
    // Act
    // WHY: pressed in a microtask right after the list has rendered; the fake DELETE answers through microtasks only,
    // so it is handled before the Scheduler task that runs the list's passive effects.
    watch.next = () => {
      const removeSelf = screen.getByRole('button', { name: 'Fjern meg' });
      removeSelf.focus();
      removeSelf.click();
    };
    // Assert
    const message = await screen.findByText(/Du er ikkje lenger medforfattar på aktiviteten\./);
    // WHY: `announce` runs right after `setList`; a React that stopped calling `onPostCommit` fails here loudly.
    expect(flushesBefore).toBeGreaterThan(0);
    expect(flushesAtHandled).toBe(flushesBefore);
    await waitFor(() => expect(document.activeElement).toBe(message));
  });

  it('[UD-006] listing answered while an earlier re-read’s effects still wait: focus waits for «Ta ut av innhaldsbanken» and lands on it', async () => {
    // Arrange
    const watch = watchCommits();
    const get = gate();
    const put = gate();
    let flushesAtHandled = -1;
    fakeFetch({
      [`GET ${BANK}`]: { status: 200, body: { listedAt: null, eligible: true } },
      [`PUT ${BANK}`]: { status: 200, body: { listedAt: LISTED_AT, eligible: true } },
    });
    const announce = () => (flushesAtHandled = watch.flushes);
    const section = (detail: ContentDetail) =>
      watch.wrap(<BankListingSection detail={detail} announce={announce} />);
    const { rerender } = render(section(SHARED));
    // WHY: the owner first presses the button without ticking the box, so the press that lists clears the problem
    // shown and renders at once; React has run every pending effect when that press returns. (A press that changes
    // nothing leaves its update to the next render, whose effects React then runs at once.)
    fireEvent.click(await screen.findByRole('button', { name: 'Legg i innhaldsbanken' }));
    fireEvent.click(screen.getByRole('checkbox'));
    holdAnswer('GET', get.opened);
    holdAnswer('PUT', put.opened);
    // WHY: a visibility change (another tab, or the visibility control above) makes the section read the listing
    // again, and the owner presses the list button while that read is on its way.
    rerender(section({ ...SHARED, visibility: 'feide' }));
    const list = screen.getByRole('button', { name: 'Legg i innhaldsbanken' });
    list.focus();
    fireEvent.click(list);
    const flushesBefore = watch.flushes;
    // Act
    // WHY: the re-read's answer renders first (outside an event, so React runs that commit's effects in a later
    // task); the listing's answer arrives right after that commit, before its passive effects.
    watch.next = put.open;
    get.open();
    // Assert
    const unlist = await screen.findByRole('button', { name: 'Ta ut av innhaldsbanken' });
    expect(flushesBefore).toBeGreaterThan(0);
    expect(flushesAtHandled).toBe(flushesBefore);
    await waitFor(() => expect(document.activeElement).toBe(unlist));
  });

  it.each([
    ['still lists it', 'feide', { listedAt: REREAD_LISTED_AT, eligible: true }, /sidan 21\. okt\. 2026/],
    [
      'has ended the listing',
      'private',
      { listedAt: null, eligible: false },
      'Aktiviteten kan ikkje leggjast i innhaldsbanken før dette er på plass:',
    ],
  ] as const)(
    '[UD-006] the owner who saves the visibility while listing is on its way keeps focus on «Lagre delinga»; the server %s',
    async (_name, visibility, reread, rereadState) => {
      // Arrange
      const put = gate();
      let reads = 0;
      fakeFetch({
        [`GET ${BANK}`]: () => ({
          status: 200,
          body: (reads += 1) > 1 ? reread : { listedAt: null, eligible: true },
        }),
        [`PUT ${BANK}`]: { status: 200, body: { listedAt: LISTED_AT, eligible: true } },
      });
      holdAnswer('PUT', put.opened);
      const section = (detail: ContentDetail) => (
        <>
          <button type="button">Lagre delinga</button>
          <BankListingSection detail={detail} announce={() => {}} />
        </>
      );
      const { rerender } = render(section(SHARED));
      fireEvent.click(await screen.findByRole('checkbox'));
      fireEvent.click(screen.getByRole('button', { name: 'Legg i innhaldsbanken' }));
      const save = screen.getByRole('button', { name: 'Lagre delinga' });
      save.focus();
      rerender(section({ ...SHARED, visibility }));
      expect(reads).toBe(1);
      // Act
      put.open();
      // Assert
      // WHY: the re-read waited for the listing's answer, so its answer renders after the listing's effects ran.
      await screen.findByText(rereadState);
      expect(reads).toBe(2);
      expect(document.activeElement).toBe(save);
    },
  );
});
