/**
 * Tests for the decisions of a Branching Scenario on the Innsikt tab (INS-004): each decision with its question,
 * the learners' first choices per option as a summary, a chart and a table, «< k» for a hidden count, and how many
 * chose again; what an older version and a scenario without decisions say; and that other types have no such part.
 *
 * Spec: INS-004, INS-006, INS-008, UD-010
 */
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthoredLanguageContext } from '../../../src/features/insight/authoredLanguage';
import { BranchingSection } from '../../../src/features/insight/BranchingSection';
import { InsightPanel } from '../../../src/features/insight/InsightPanel';
import { LocaleProvider } from '../../../src/i18n/LocaleContext';
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
import { BRANCHING_REPORT } from './insightBranchingAnswers';
import { FINDINGS } from './insightOtherAnswers';

const HIDDEN_TEXT = '< 5 (skjult av omsyn til personvernet)';
const decisions = BRANCHING_REPORT.branching ?? [];
const rowsOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => [...row.children].map((cell) => plain(cell.textContent)));
/** The tab with this view. */
async function openTab(report: unknown) {
  fakeFetch({
    [`GET ${PORTAL_PATH}`]: { status: 200, body: report },
    [`GET ${CONTEXTS_PATH}`]: { status: 200, body: { contexts: CONTEXTS } },
    [`GET ${FINDINGS_PATH}`]: { status: 200, body: FINDINGS },
  });
  render(<InsightPanel contentId={ID} title="Planlegg samlinga" />);
  await screen.findByRole('heading', { name: 'Deltaking' });
}

describe('[INS-004] the decisions of a Branching Scenario on the Innsikt tab', () => {
  it('[INS-004] shows each decision: who chose, each option’s first choices, and who chose again', async () => {
    // Act
    await openTab(BRANCHING_REPORT);
    // Assert
    const section = screen.getByRole('region', { name: 'Val ved kvar avgjerd' });
    expect(
      within(section)
        .getAllByRole('heading', { level: 4 })
        .map((h) => h.textContent),
    ).toEqual([
      'Korleis vil du bruke tida før samlinga?',
      'Korleis gjer du materiellet tilgjengeleg?',
      'Avgjerd 3 (utan tekst)',
    ]);
    const [first, second] = within(section).getAllByRole('table');
    expect(first?.querySelector('caption')?.textContent).toBe(
      'Første val ved «Korleis vil du bruke tida før samlinga?»',
    );
    expect(rowsOf(first as HTMLElement)).toEqual([
      ['Ein kort video og ein quiz', '10'],
      ['Ei lang pensumliste', '9'],
    ]);
    expect(rowsOf(second as HTMLElement)).toEqual([
      ['Tekstar videoen', '11'],
      ['Eigne versjonar på førespurnad', HIDDEN_TEXT],
      ['Papir på samlinga', HIDDEN_TEXT],
    ]);
    const lines = [...section.querySelectorAll('p')].map((p) => plain(p.textContent));
    expect(lines).toContain('Studentar som valde: 19');
    expect(lines).toContain('Valde på nytt: 8');
    expect(lines).toContain('Valde på nytt: 0');
    expect(lines).toContain(`Valde på nytt: ${HIDDEN_TEXT}`);
  });

  it('[INS-008] each decision is a figure with a summary sentence, a hidden chart and a visible table; a hidden count has no bar', () => {
    // Act
    render(<BranchingSection decisions={decisions} k={5} olderVersion={false} />);
    // Assert
    const figures = screen.getAllByRole('figure');
    expect(figures.map((figure) => plain(figure.querySelector('figcaption')?.textContent))).toEqual([
      'Mest valt først av dei som kan visast: «Ein kort video og ein quiz», valt av 10 studentar.',
      'Mest valt først av dei som kan visast: «Tekstar videoen», valt av 11 studentar.',
      'Ingen alternativ er valde av nok studentar til at dei kan visast.',
    ]);
    for (const figure of figures) {
      // WHY: two columns fit a phone when the texts wrap; the wide tables' minimum width would make it scroll.
      expect(within(figure).getByRole('table').className).not.toContain('min-w-');
      expect(within(figure).getByRole('table').closest('[aria-hidden]')).toBeNull();
      expect(figure.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
    }
    const bars = (figure: HTMLElement | undefined) =>
      [...(figure?.querySelectorAll('[aria-hidden="true"] li') ?? [])].map(
        (row) => row.querySelectorAll('rect[class*="fill-hvl-accent"]').length,
      );
    expect(bars(figures[0])).toEqual([1, 1]);
    expect(bars(figures[1])).toEqual([1, 0, 0]);
  });

  it('[INS-008] two options chosen first by equally many are named as a tie, not one of them as the most chosen', () => {
    // Arrange
    const [first] = decisions;
    const tied = { ...first!, options: first!.options.map((option) => ({ ...option, learners: shown(9) })) };
    // Act
    render(<BranchingSection decisions={[tied]} k={5} olderVersion={false} />);
    // Assert
    expect(plain(screen.getByRole('figure').querySelector('figcaption')?.textContent)).toBe(
      'Fleire alternativ vart valde først av like mange av dei som kan visast: 9 studentar kvar.',
    );
  });

  it('[UD-010] the activity’s own texts carry its language; a decision or option without text is named by its place', () => {
    // Act
    render(
      <LocaleProvider locale="en">
        <AuthoredLanguageContext.Provider value="nn">
          <BranchingSection decisions={decisions} k={5} olderVersion={false} />
        </AuthoredLanguageContext.Provider>
      </LocaleProvider>,
    );
    // Assert
    const headings = screen.getAllByRole('heading', { level: 4 });
    expect(headings.map((h) => [h.textContent, h.getAttribute('lang')])).toEqual([
      ['Korleis vil du bruke tida før samlinga?', 'nn'],
      ['Korleis gjer du materiellet tilgjengeleg?', 'nn'],
      ['Decision 3 (no text)', null],
    ]);
    const last = screen.getAllByRole('table')[2] as HTMLElement;
    expect(
      within(last)
        .getAllByRole('rowheader')
        .map((th) => [th.textContent, th.getAttribute('lang')]),
    ).toEqual([
      ['Ja', 'nn'],
      ['Option 2 (no text)', null],
    ]);
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Choices at each decision');
  });

  it('[INS-004] an older version and a scenario without decisions say so; another type has no such part', async () => {
    // Act
    const { unmount } = render(<BranchingSection decisions={[]} k={5} olderVersion />);
    const older = screen.getByRole('region', { name: 'Val ved kvar avgjerd' }).textContent;
    unmount();
    const none = render(<BranchingSection decisions={[]} k={5} olderVersion={false} />);
    const empty = screen.getByRole('region', { name: 'Val ved kvar avgjerd' }).textContent;
    none.unmount();
    await openTab(REPORT);
    // Assert
    expect(older).toContain('Vala blir berre viste for den gjeldande versjonen av aktiviteten');
    expect(empty).toContain('Scenarioet har ingen avgjerder.');
    expect(screen.queryByRole('region', { name: 'Val ved kvar avgjerd' })).toBeNull();
  });
});
