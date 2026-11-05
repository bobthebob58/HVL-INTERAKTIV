/**
 * Tests for the Innsikt tab's charts: every chart has a one-sentence summary and a visible data table, the drawn
 * chart is hidden from assistive technology, bars use the single `accent` hue (the second series striped), each value
 * is written by its bar, and a hidden value has «< k» and no bar; then the item and video tables in detail.
 *
 * Spec: INS-008, INS-006, INS-002, INS-005, UD-003
 */
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ItemDifficultySection } from '../../../src/features/insight/ItemDifficultySection';
import { InsightPanel } from '../../../src/features/insight/InsightPanel';
import { VideoEngagementSection } from '../../../src/features/insight/VideoEngagementSection';
import { fakeFetch } from '../../support/fakeFetch';
import { CONTEXTS, CONTEXTS_PATH, FINDINGS_PATH, ID, plain, PORTAL_PATH, REPORT } from './insightAnswers';
import { FINDINGS, VIDEO_REPORT } from './insightOtherAnswers';

const HIDDEN_TEXT = '< 5 (skjult av omsyn til personvernet)';
/** The colour classes a chart may use: the accent hue, the surface and the track's outline (D-106, D-017). */
const ALLOWED_COLOUR =
  /^(?:forced-colors:)?(?:fill|stroke)-(?:hvl-accent|hvl-surface|hvl-ink-muted|\[Canvas\]|\[CanvasText\])$/;

const rowsOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => [...row.children].map((cell) => plain(cell.textContent)));

describe('[INS-008] the Innsikt tab’s charts', () => {
  it('[INS-008] gives every chart a text summary and a visible data table, and hides the drawing from assistive technology', async () => {
    // Arrange
    fakeFetch({
      [`GET ${PORTAL_PATH}`]: { status: 200, body: REPORT },
      [`GET ${CONTEXTS_PATH}`]: { status: 200, body: { contexts: CONTEXTS } },
      [`GET ${FINDINGS_PATH}`]: { status: 200, body: FINDINGS },
    });
    // Act
    render(<InsightPanel contentId={ID} title="Celler og vev" />);
    await screen.findByRole('heading', { name: 'Deltaking' });
    // Assert: three charts (the items, the choice question and the gap), each with a summary and a table
    const figures = screen.getAllByRole('figure');
    expect(figures).toHaveLength(3);
    for (const figure of figures) {
      const caption = figure.querySelector('figcaption');
      expect(caption?.textContent?.length).toBeGreaterThan(20);
      expect(figure.getAttribute('aria-labelledby') ?? caption).toBeTruthy();
      const table = within(figure).getByRole('table');
      expect(table.querySelector('caption')?.textContent).toBeTruthy();
      // UD-008: the table scrolls in its own region, named by the caption and reachable with the keyboard
      const region = table.closest('[role="region"]');
      expect(region?.getAttribute('tabindex')).toBe('0');
      expect(region?.getAttribute('aria-labelledby')).toBe(table.querySelector('caption')?.id);
      expect(table.closest('[aria-hidden]')).toBeNull();
      const chart = figure.querySelector('[aria-hidden="true"]');
      expect(chart?.querySelectorAll('svg').length).toBeGreaterThan(0);
    }
  });

  it('[INS-008][UD-003] draws one hue with each value written by its bar, the latest attempt striped and named in a legend', () => {
    // Act
    const { container } = render(<ItemDifficultySection items={REPORT.items} k={5} />);
    const chart = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    // Assert
    const classes = [...chart.querySelectorAll('rect')].flatMap((rect) =>
      (rect.getAttribute('class') ?? '').split(/\s+/).filter(Boolean),
    );
    for (const name of classes) expect(name).toMatch(ALLOWED_COLOUR);
    const stripes = chart.querySelector('pattern');
    expect(stripes?.querySelector('rect')?.getAttribute('class')).toContain('fill-hvl-accent');
    const first = chart.querySelector('li');
    expect(plain(first?.textContent)).toBe('Spm. 140 %65 %');
    const bars = first?.querySelectorAll('svg rect:not([class*="stroke"])') ?? [];
    expect([...bars].map((bar) => bar.getAttribute('width'))).toEqual(['40', '65']);
    expect(bars[1]?.getAttribute('fill')).toBe(`url(#${stripes?.id})`);
    expect(plain(chart.querySelector('p')?.textContent)).toBe('Første forsøkSiste forsøk (stripete)');
  });

  it('[INS-006][INS-008] a hidden value has «< k» and no bar, in the chart and in the table', () => {
    // Act
    const { container } = render(<ItemDifficultySection items={REPORT.items} k={5} />);
    // Assert
    const hiddenRow = container.querySelectorAll('[aria-hidden="true"] li')[2];
    expect(plain(hiddenRow?.textContent)).toBe('Spm. 3< 5< 5');
    expect(hiddenRow?.querySelectorAll('svg rect:not([class*="stroke"])')).toHaveLength(0);
    const table = screen.getByRole('table', { name: 'Spørsmåla, vanskelegast først' });
    expect(rowsOf(table)[2]?.slice(0, 5)).toEqual([
      '3',
      'Spørsmål 3 (finst ikkje lenger i aktiviteten)',
      HIDDEN_TEXT,
      HIDDEN_TEXT,
      HIDDEN_TEXT,
    ]);
  });

  it('[INS-002] lists the questions hardest first with their text, learners and both shares, after a summary of the hardest', () => {
    // Act
    render(<ItemDifficultySection items={REPORT.items} k={5} />);
    // Assert
    const table = screen.getByRole('table', { name: 'Spørsmåla, vanskelegast først' });
    expect(rowsOf(table).map((row) => row.slice(0, 5))).toEqual([
      ['1', 'Kva gjer mitokondriane?', '20', '40 %', '65 %'],
      ['2', 'Fyll inn namnet på organellen.', '19', '53 %', '79 %'],
      ['3', 'Spørsmål 3 (finst ikkje lenger i aktiviteten)', HIDDEN_TEXT, HIDDEN_TEXT, HIDDEN_TEXT],
    ]);
    expect(within(table).getAllByRole('rowheader')[0]?.textContent).toBe('Kva gjer mitokondriane?');
    // WHY: the order is by shown shares only, so the text says where a hidden one goes (D-106's amendment).
    expect(screen.getByRole('figure').querySelector('figcaption')?.textContent).toContain(
      'Spørsmål der delen ikkje kan visast, står til slutt.',
    );
    expect(plain(screen.getByRole('figure').querySelector('strong')?.textContent)).toBe(
      'Av spørsmåla der delen riktige kan visast, er spørsmål 1 vanskelegast, «Kva gjer mitokondriane?»: 40 % riktig på første forsøk og 65 % på siste.',
    );
  });

  it('[INS-002] names a question without text by its place, so no row header or button name is empty or repeated', () => {
    // Arrange: a SingleChoiceSet whose text the server could not read, twice, then a gone question
    const untitled = { ...REPORT.items[0]!, questionText: '' };
    const items = [untitled, { ...untitled, item: 'q-two' }, REPORT.items[2]!];
    // Act
    render(<ItemDifficultySection items={items} k={5} />);
    // Assert
    const table = screen.getByRole('table', { name: 'Spørsmåla, vanskelegast først' });
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual([
      'Spørsmål 1 (utan tekst)',
      'Spørsmål 2 (utan tekst)',
      'Spørsmål 3 (finst ikkje lenger i aktiviteten)',
    ]);
    const names = within(table)
      .getAllByRole('button')
      .map((button) => plain(button.textContent));
    expect(names[0]).toBe('+ Ta opp i samlinga (Spørsmål 1 (utan tekst))');
    expect(new Set(names).size).toBe(3);
    expect(plain(screen.getByRole('figure').querySelector('strong')?.textContent)).toContain(
      'er spørsmål 1 vanskelegast, «Spørsmål 1 (utan tekst)»:',
    );
  });

  it('[INS-005] lists the video’s tasks in time order with the share who answered, and names the smallest share', () => {
    // Act
    render(<VideoEngagementSection interactions={VIDEO_REPORT.videoEngagement ?? []} k={5} />);
    // Assert
    const table = screen.getByRole('table', { name: 'Oppgåvene i videoen' });
    expect(rowsOf(table)).toEqual([
      ['0:45', 'Kva ser du?', '20', '90 %'],
      ['5:10', 'Skriv namnet.', '9', '40 %'],
      ['Slutten', 'Oppgåve utan tittel', HIDDEN_TEXT, HIDDEN_TEXT],
    ]);
    expect(plain(screen.getByRole('figure').querySelector('strong')?.textContent)).toBe(
      'Av oppgåvene der delen kan visast, svarte minst del på «Skriv namnet.» (5:10): 40 %.',
    );
    const bars = [...document.querySelectorAll('[aria-hidden="true"] li')].map((row) =>
      [...row.querySelectorAll('svg rect:not([class*="stroke"])')].map((bar) => bar.getAttribute('width')),
    );
    expect(bars).toEqual([['90'], ['40'], []]);
  });
});
