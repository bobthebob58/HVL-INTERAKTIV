/**
 * Tests for the misconceptions on the Innsikt tab: a choice question's options with right and wrong in words and an
 * icon, the learners' first answers and the teacher's feedback by each wrong option; a gap task's accepted answers,
 * listed wrong answers, other wrong answers and empty gaps; and each question named by its heading, by its place in
 * the item table when it has no text.
 *
 * Spec: INS-003, INS-006, INS-008, UD-003, PROD-013
 */
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MisconceptionSection } from '../../../src/features/insight/MisconceptionSection';
import { HIDDEN, plain, REPORT, shown } from './insightAnswers';

const HIDDEN_TEXT = '< 5 (skjult av omsyn til personvernet)';

/**
 * The widths of the drawn bars, row by row, in a question's chart.
 * @param question - The question's region.
 * @returns One list of widths per chart row; empty for a value drawn without a bar.
 */
const barWidths = (question: HTMLElement) =>
  [...question.querySelectorAll('[aria-hidden="true"] li')].map((row) =>
    [...row.querySelectorAll('svg rect:not([class*="stroke"])')].map((bar) => bar.getAttribute('width')),
  );

const rowsOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => [...row.children].map((cell) => plain(cell.textContent)));

describe('[INS-003] misconceptions', () => {
  it('[INS-003][UD-003] shows each option with right or wrong in words, the first answers and the teacher’s feedback by each wrong one', () => {
    // Act
    render(
      <MisconceptionSection
        misconceptions={REPORT.misconceptions}
        items={REPORT.items}
        k={5}
        olderVersion={false}
      />,
    );
    // Assert
    const question = screen.getByRole('region', { name: 'Kva gjer mitokondriane?' });
    const table = within(question).getByRole('table', { name: 'Svara på «Kva gjer mitokondriane?»' });
    expect(rowsOf(table)).toEqual([
      ['Lagar energi', '✓ Riktig', '8', ''],
      ['Lagrar arvestoff', '✗ Feil', '9', 'Arvestoffet ligg i cellekjernen.'],
      ['Byggjer protein', '✗ Feil', HIDDEN_TEXT, 'Inga tilbakemelding'],
      ['Ingen av alternativa', '', HIDDEN_TEXT, ''],
    ]);
    for (const icon of table.querySelectorAll('td span[aria-hidden="true"]'))
      expect(icon.textContent).toMatch(/^[✓✗] $/);
    expect(plain(within(question).getByRole('figure').querySelector('figcaption')?.textContent)).toBe(
      'Vanlegaste feilsvar av dei som kan visast: «Lagrar arvestoff», valt av 9 studentar.',
    );
    // INS-008: the learners the bars are a share of are said in words; a hidden count draws no bar
    expect(within(question).getByText(/^Studentar som svarte første gong:/).textContent).toBe(
      'Studentar som svarte første gong: 20',
    );
    expect(barWidths(question)).toEqual([['40'], ['45'], [], []]);
  });

  it('[INS-003][INS-008] leaves out «Ingen av alternativa» when nobody gave such an answer, and draws bars against the largest shown count when the total is hidden', () => {
    // Arrange
    const [choice] = REPORT.misconceptions;
    if (choice?.kind !== 'choice') throw new Error('the fixture starts with a choice question');
    const question = { ...choice, learners: HIDDEN, noAnswer: shown(0) };
    // Act
    render(
      <MisconceptionSection misconceptions={[question]} items={REPORT.items} k={5} olderVersion={false} />,
    );
    // Assert
    const region = screen.getByRole('region', { name: 'Kva gjer mitokondriane?' });
    expect(
      within(region)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Lagar energi', 'Lagrar arvestoff', 'Byggjer protein']);
    expect(barWidths(region)).toEqual([[String((8 / 9) * 100)], ['100'], []]);
  });

  it('[INS-003][INS-006] shows a gap’s accepted answers, the listed wrong answers, the other wrong answers hidden below k, and empty gaps', () => {
    // Act
    render(
      <MisconceptionSection
        misconceptions={REPORT.misconceptions}
        items={REPORT.items}
        k={5}
        olderVersion={false}
      />,
    );
    // Assert
    const question = screen.getByRole('region', { name: 'Fyll inn namnet på organellen.' });
    const gap = within(question).getByRole('region', { name: 'Luke 1' });
    expect(within(gap).getByText(/^Riktig: /).textContent).toBe('Riktig: «mitokondrie» eller «mitokondria»');
    expect(rowsOf(within(gap).getByRole('table', { name: 'Svara i luke 1' }))).toEqual([
      ['Riktige svar', '10'],
      ['ribosom', '6'],
      ['Andre feil svar', HIDDEN_TEXT],
      ['Tom luke', HIDDEN_TEXT],
    ]);
    expect(plain(within(gap).getByRole('figure').querySelector('figcaption')?.textContent)).toBe(
      'Luke 1: vanlegaste feilsvar av dei som kan visast, er «ribosom» (6 studentar).',
    );
  });

  it('[INS-003] a question where no wrong answer reaches k says none can be shown, and one nobody got wrong says so', () => {
    // Arrange
    const [choice] = REPORT.misconceptions;
    if (choice?.kind !== 'choice') throw new Error('the fixture starts with a choice question');
    const hidden = {
      ...choice,
      item: 'h',
      options: choice.options.map((o) => ({ ...o, learners: o.correct ? shown(9) : HIDDEN })),
    };
    const allRight = {
      ...choice,
      item: 'r',
      questionText: 'Alle rett',
      options: choice.options.map((o) => ({ ...o, learners: o.correct ? shown(9) : shown(0) })),
    };
    // Act
    render(
      <MisconceptionSection
        misconceptions={[hidden, allRight]}
        items={REPORT.items}
        k={5}
        olderVersion={false}
      />,
    );
    // Assert
    const captions = screen
      .getAllByRole('figure')
      .map((figure) => figure.querySelector('figcaption')?.textContent);
    expect(captions).toEqual([
      'Ingen feil svar er valde av nok studentar til at dei kan visast.',
      'Ingen studentar valde eit feil svar.',
    ]);
  });

  it('[INS-002][INS-003] names a question without text by its place in its heading, button and table', () => {
    // Arrange: the item table's first question, with no text in the activity
    const [choice] = REPORT.misconceptions;
    if (choice?.kind !== 'choice') throw new Error('the fixture starts with a choice question');
    // Act
    render(
      <MisconceptionSection
        misconceptions={[{ ...choice, questionText: '' }]}
        items={REPORT.items}
        k={5}
        olderVersion={false}
      />,
    );
    // Assert
    const region = screen.getByRole('region', { name: 'Spørsmål 1 (utan tekst)' });
    expect(
      within(region).getByRole('button', { name: 'Ta opp i samlinga (Spørsmål 1 (utan tekst))' }),
    ).toBeTruthy();
    expect(within(region).getByRole('table', { name: 'Svara på «Spørsmål 1 (utan tekst)»' })).toBeTruthy();
  });

  it('[INS-003] says so when no choice or gap question has answers', () => {
    // Act
    render(<MisconceptionSection misconceptions={[]} items={[]} k={5} olderVersion={false} />);
    // Assert
    expect(
      screen.getByText('Ingen fleirvals- eller utfyllingsspørsmål har svar i denne perioden.'),
    ).toBeTruthy();
    expect(screen.queryByRole('figure')).toBeNull();
  });

  it('[INS-003][PROD-013] says that answer distributions are for the current version only when an older one is viewed', () => {
    // Act
    render(<MisconceptionSection misconceptions={[]} items={[]} k={5} olderVersion />);
    // Assert
    expect(screen.getByText(/^Svarfordelinga blir berre vist for den gjeldande versjonen/)).toBeTruthy();
    expect(screen.queryByText(/Ingen fleirvals- eller utfyllingsspørsmål/)).toBeNull();
  });
});
