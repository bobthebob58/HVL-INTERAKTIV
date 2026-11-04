/**
 * Tests for «Ta opp i samlinga»: the toggle by each question, the shortlist with the question's aggregates and the
 * teacher's feedback, each change announced, taking a question off with focus on the list's heading, printing the
 * list alone and showing it in large type for projecting; and the list's entries as written from a view.
 *
 * Spec: INS-003, INS-006, UD-006
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InsightPanel } from '../../../src/features/insight/InsightPanel';
import { printShortlist, PRINT_MARK } from '../../../src/features/insight/printShortlist';
import { ACTIVITY_ITEM, shortlistEntry } from '../../../src/features/insight/shortlistEntries';
import { fakeFetch } from '../../support/fakeFetch';
import {
  CONTEXTS,
  CONTEXTS_PATH,
  FINDINGS_PATH,
  ID,
  plain,
  PORTAL_PATH,
  REPORT,
  shown,
} from './insightAnswers';
import { FINDINGS } from './insightOtherAnswers';

const QUESTION = 'Kva gjer mitokondriane?';
/**
 * The accessible name of a button about the question: its visible label and the question in brackets.
 * @param label - The visible label.
 * @returns The name.
 */
const named = (label: string) => `${label} (${QUESTION})`;

const openPanel = async () => {
  fakeFetch({
    [`GET ${PORTAL_PATH}`]: { status: 200, body: REPORT },
    [`GET ${CONTEXTS_PATH}`]: { status: 200, body: { contexts: CONTEXTS } },
    [`GET ${FINDINGS_PATH}`]: { status: 200, body: FINDINGS },
  });
  render(<InsightPanel contentId={ID} title="Celler og vev" />);
  await screen.findByRole('heading', { name: 'Deltaking' });
};

const shortlist = () => screen.getByRole('region', { name: /^Ta opp i samlinga \(/ });
const region = () => screen.getAllByRole('status').find((status) => status.classList.contains('sr-only'));

describe('[INS-003] Ta opp i samlinga', () => {
  it('[INS-003][UD-006] the toggle by a question adds it with its aggregates and feedback, is pressed, and is announced', async () => {
    // Arrange
    await openPanel();
    const question = screen.getByRole('region', { name: QUESTION });
    const toggle = within(question).getByRole('button', { name: named('Ta opp i samlinga') });
    // Act
    fireEvent.click(toggle);
    // Assert
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.textContent).toBe(`✓ Ta opp i samlinga (${QUESTION})`);
    const items = within(shortlist()).getAllByRole('listitem');
    expect(items.map((item) => [...item.querySelectorAll('p')].map((p) => plain(p.textContent)))).toEqual([
      [
        QUESTION,
        'Tal frå Portalen (spelt utanom Canvas), siste 7 dagar (frå 28. okt. 2026), versjon 3.',
        '40 % riktig på første forsøk og 65 % på siste (20 studentar svarte).',
        'Vanlegaste feilsvar: «Lagrar arvestoff», valt av 9 studentar.',
        'Tilbakemeldinga di: «Arvestoffet ligg i cellekjernen.»',
      ],
    ]);
    expect(within(shortlist()).getByRole('heading', { level: 3 }).textContent).toBe(
      'Ta opp i samlinga (1 spørsmål)',
    );
    expect(region()?.textContent).toBe(`«${QUESTION}» er lagt til i lista til samlinga (1 spørsmål).`);
    // Act and assert: the item table's toggle for the same question shows it is on the list too
    const table = screen.getByRole('table', { name: 'Spørsmåla, vanskelegast først' });
    expect(
      within(table)
        .getByRole('button', { name: named('Ta opp i samlinga') })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('[INS-003][UD-006] «Ta ut av lista» takes the question off, says so and moves focus to the list’s heading', async () => {
    // Arrange
    await openPanel();
    fireEvent.click(
      within(screen.getByRole('region', { name: QUESTION })).getByRole('button', { name: /^Ta opp/ }),
    );
    // Act
    const remove = within(shortlist()).getByRole('button', { name: named('Ta ut av lista') });
    remove.focus();
    fireEvent.click(remove);
    // Assert
    expect(within(shortlist()).queryAllByRole('listitem')).toHaveLength(0);
    expect(within(shortlist()).getByText(/^Lista er tom/)).toBeTruthy();
    expect(document.activeElement?.textContent).toBe('Ta opp i samlinga (0 spørsmål)');
    // WHY: a second announcement ends with a no-break space, so the region speaks again (useAnnouncement).
    expect(plain(region()?.textContent).trimEnd()).toBe(
      `«${QUESTION}» er teke ut av lista til samlinga (0 spørsmål).`,
    );
  });

  it('[INS-003] prints the list alone: the document is marked while printing and unmarked after', async () => {
    // Arrange
    await openPanel();
    fireEvent.click(
      within(screen.getByRole('region', { name: QUESTION })).getByRole('button', { name: /^Ta opp/ }),
    );
    let markedWhilePrinting = false;
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      markedWhilePrinting = document.documentElement.hasAttribute(PRINT_MARK);
    });
    // Act
    fireEvent.click(within(shortlist()).getByRole('button', { name: 'Skriv ut lista' }));
    window.dispatchEvent(new Event('afterprint'));
    // Assert
    expect(print).toHaveBeenCalledTimes(1);
    expect(markedWhilePrinting).toBe(true);
    expect(document.documentElement.hasAttribute(PRINT_MARK)).toBe(false);
    expect(shortlist().classList.contains('insight-shortlist')).toBe(true);
    expect(within(shortlist()).getByText('Til samlinga: Celler og vev').className).toContain('print:block');
  });

  it('[INS-003] printing that throws leaves no mark behind', () => {
    // Arrange
    vi.spyOn(window, 'print').mockImplementation(() => {
      throw new Error('no printer');
    });
    // Act
    printShortlist();
    // Assert
    expect(document.documentElement.hasAttribute(PRINT_MARK)).toBe(false);
  });

  it('[INS-003][UD-006] shows the list in large type in a dialog for projecting, and returns focus on close', async () => {
    // Arrange
    await openPanel();
    fireEvent.click(
      within(screen.getByRole('region', { name: QUESTION })).getByRole('button', { name: /^Ta opp/ }),
    );
    const project = within(shortlist()).getByRole('button', { name: 'Vis lista på storskjerm' });
    project.focus();
    // Act
    fireEvent.click(project);
    // Assert
    const dialog = await screen.findByRole('dialog', { name: 'Til samlinga: Celler og vev' });
    expect(within(dialog).getByRole('list').className).toContain('text-2xl');
    expect(within(dialog).getByText(QUESTION)).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: /^Ta ut av lista/ })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lukk' }));
    await waitFor(() => expect(document.activeElement).toBe(project));
  });

  it('[INS-006] an entry holds only shown aggregates, «< k» for a hidden one, and the activity itself has its own key', () => {
    // Arrange
    const report = {
      ...REPORT,
      items: [
        { ...REPORT.items[0]!, item: null, latestCorrect: { suppressed: true as const }, learners: shown(9) },
      ],
      misconceptions: [],
    };
    // Act
    const entry = shortlistEntry(report, ACTIVITY_ITEM, 'nn');
    // Assert
    expect(entry?.lines.map(plain)).toEqual([
      '40 % riktig på første forsøk og < 5 på siste (9 studentar svarte).',
    ]);
    expect(shortlistEntry(report, 'no-such-item', 'nn')).toBeUndefined();
  });
});
