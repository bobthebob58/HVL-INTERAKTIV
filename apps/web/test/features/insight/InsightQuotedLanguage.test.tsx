/**
 * Tests for the language of a text the Innsikt tab quotes inside one of its own sentences: for an English activity on
 * a Nynorsk page, only the quoted part of a chart summary, a table caption, a chart label, a shortlist line, the
 * list's title and an announcement carries `lang="en"`, never the words around it or a fallback name.
 *
 * Spec: UD-010, INS-002, INS-003, INS-005
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthoredLanguageContext } from '../../../src/features/insight/authoredLanguage';
import { InsightPanel } from '../../../src/features/insight/InsightPanel';
import { VideoEngagementSection } from '../../../src/features/insight/VideoEngagementSection';
import { fakeFetch } from '../../support/fakeFetch';
import { treatSpansAsInline } from '../../support/inlineSpans';
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
import { FINDINGS, VIDEO_REPORT } from './insightOtherAnswers';

/** The texts of the parts of an element marked as English. */
const english = (element: Element | null | undefined) =>
  [...(element?.querySelectorAll('[lang="en"]') ?? [])].map((part) => part.textContent);

/** The whole sentence of an element, with ordinary spaces and without a repeat's trailing no-break space. */
const sentence = (element: Element | null | undefined) => plain(element?.textContent).trimEnd();

/** The tab's polite status region. */
const region = () => document.querySelector('p.sr-only[role="status"]');

const openTab = async (language: string) => {
  fakeFetch({
    [`GET ${PORTAL_PATH}`]: { status: 200, body: REPORT },
    [`GET ${CONTEXTS_PATH}`]: { status: 200, body: { contexts: CONTEXTS } },
    [`GET ${FINDINGS_PATH}`]: { status: 200, body: FINDINGS },
  });
  render(<InsightPanel contentId={ID} title="Cells" language={language} />);
  await screen.findByRole('heading', { name: 'Deltaking' });
  const items = screen.getByRole('table', { name: 'Spørsmåla, vanskelegast først' });
  return within(items).getAllByRole('button');
};

describe('[UD-010] the quoted part of the Innsikt tab’s own sentences', () => {
  beforeEach(treatSpansAsInline);

  it('[UD-010][INS-002][INS-003] marks only the quoted text in the chart summaries, the caption and the labels', async () => {
    // Act
    await openTab('en');
    // Assert: the item chart's summary
    const items = screen.getByText(/^Av spørsmåla der delen riktige/);
    expect(sentence(items)).toBe(
      'Av spørsmåla der delen riktige kan visast, er spørsmål 1 vanskelegast, «Kva gjer mitokondriane?»: 40 % riktig på første forsøk og 65 % på siste.',
    );
    expect(english(items)).toEqual(['Kva gjer mitokondriane?']);
    // Assert: the choice summary and the choice table's caption, which still names its region
    const choice = screen.getByText(/^Vanlegaste feilsvar/);
    expect(sentence(choice)).toBe(
      'Vanlegaste feilsvar av dei som kan visast: «Lagrar arvestoff», valt av 9 studentar.',
    );
    expect(english(choice)).toEqual(['Lagrar arvestoff']);
    const table = screen.getByRole('table', { name: 'Svara på «Kva gjer mitokondriane?»' });
    expect(sentence(table.querySelector('caption'))).toBe('Svara på «Kva gjer mitokondriane?»');
    expect(english(table.querySelector('caption'))).toEqual(['Kva gjer mitokondriane?']);
    expect(screen.getByRole('region', { name: 'Svara på «Kva gjer mitokondriane?»' })).toBeTruthy();
    // Assert: the gap summary
    const gap = screen.getByText(/^Luke 1: vanlegaste/);
    expect(sentence(gap)).toBe(
      'Luke 1: vanlegaste feilsvar av dei som kan visast, er «ribosom» (6 studentar).',
    );
    expect(english(gap)).toEqual(['ribosom']);
    // Assert: the chart labels: options and the listed answer, not «Spm. 1», «Ingen av alternativa» or «Riktige svar»
    const labels = [...document.querySelectorAll('[aria-hidden="true"] [lang]')];
    expect(labels.map((label) => [label.getAttribute('lang'), label.textContent])).toEqual([
      ['en', 'Lagar energi'],
      ['en', 'Lagrar arvestoff'],
      ['en', 'Byggjer protein'],
      ['en', 'ribosom'],
    ]);
  });

  it('[UD-010][INS-003] marks only the quoted text in the shortlist’s lines, its title and its announcements', async () => {
    // Arrange
    const [cell, gapItem] = await openTab('en');
    // Act
    fireEvent.click(cell!);
    fireEvent.click(gapItem!);
    // Assert: the announcement of the second question
    expect(sentence(region())).toBe(
      '«Fyll inn namnet på organellen.» er lagt til i lista til samlinga (2 spørsmål).',
    );
    expect(english(region())).toEqual(['Fyll inn namnet på organellen.']);
    // Assert: the lines, in the list and in the open projection
    const list = screen.getByRole('region', { name: /^Ta opp i samlinga \(/ });
    fireEvent.click(screen.getByRole('button', { name: 'Vis lista på storskjerm' }));
    const dialog = screen.getByRole('dialog', { name: 'Til samlinga: Cells' });
    for (const place of [within(list), within(dialog)]) {
      const feedback = place.getByText(/^Tilbakemeldinga di:/);
      expect(sentence(feedback)).toBe('Tilbakemeldinga di: «Arvestoffet ligg i cellekjernen.»');
      expect(english(feedback)).toEqual(['Arvestoffet ligg i cellekjernen.']);
      expect(english(place.getByText(/^Vanlegaste feilsvar/))).toEqual(['Lagrar arvestoff']);
      expect(english(place.getByText(/^Luke 1: vanlegaste/))).toEqual(['ribosom']);
      for (const line of place.getAllByText(/riktig på første forsøk og/)) expect(english(line)).toEqual([]);
    }
    // Assert: the list's title, printed and as the dialog's heading
    const title = within(list).getByText(/^Til samlinga:/);
    expect(sentence(title)).toBe('Til samlinga: Cells');
    expect(english(title)).toEqual(['Cells']);
    const heading = within(dialog).getByRole('heading', { name: 'Til samlinga: Cells' });
    expect(english(heading)).toEqual(['Cells']);
  });

  it('[UD-010][INS-003] never marks the updated message or a gone question’s name, and a repeat is heard', async () => {
    // Arrange
    const [, , gone] = await openTab('en');
    const show = () => fireEvent.click(screen.getByRole('button', { name: 'Vis innsikt' }));
    show();
    await waitFor(() => expect(sentence(region())).toMatch(/^Innsikta er oppdatert: /));
    const first = region()?.textContent;
    // Act: the same view again, then the gone question
    show();
    await waitFor(() => expect(region()?.textContent).not.toBe(first));
    expect(sentence(region())).toBe(first);
    expect(region()?.querySelectorAll('[lang]')).toHaveLength(0);
    fireEvent.click(gone!);
    // Assert
    expect(sentence(region())).toBe(
      '«Spørsmål 3 (finst ikkje lenger i aktiviteten)» er lagt til i lista til samlinga (1 spørsmål).',
    );
    expect(region()?.querySelectorAll('[lang]')).toHaveLength(0);
  });

  it('[UD-010][INS-005] marks a video task’s own name in the summary, never «Oppgåve utan tittel»', () => {
    // Arrange
    const tasks = VIDEO_REPORT.videoEngagement ?? [];
    const untitled = [...tasks.slice(0, 2), { ...tasks[2]!, answered: shown(2), share: shown(0.1) }];
    const section = (interactions: typeof tasks) => (
      <AuthoredLanguageContext.Provider value="en">
        <VideoEngagementSection interactions={interactions} k={5} />
      </AuthoredLanguageContext.Provider>
    );
    // Act
    const { rerender } = render(section(tasks));
    const named = screen.getByText(/^Av oppgåvene der delen kan visast/);
    // Assert
    expect(sentence(named)).toBe(
      'Av oppgåvene der delen kan visast, svarte minst del på «Skriv namnet.» (5:10): 40 %.',
    );
    expect(english(named)).toEqual(['Skriv namnet.']);
    expect(document.querySelectorAll('[aria-hidden="true"] [lang]')).toHaveLength(0);
    // Act
    rerender(section(untitled));
    const fallback = screen.getByText(/^Av oppgåvene der delen kan visast/);
    // Assert
    expect(sentence(fallback)).toBe(
      'Av oppgåvene der delen kan visast, svarte minst del på «Oppgåve utan tittel» (Slutten): 10 %.',
    );
    expect(english(fallback)).toEqual([]);
  });

  it('[UD-010] marks nothing on the tab, the shortlist or the projection when the activity is in the page’s language', async () => {
    // Arrange
    const [cell, gapItem] = await openTab('nn');
    // Act
    fireEvent.click(cell!);
    fireEvent.click(gapItem!);
    fireEvent.click(screen.getByRole('button', { name: 'Vis lista på storskjerm' }));
    // Assert
    expect(screen.getByRole('dialog', { name: 'Til samlinga: Cells' })).toBeTruthy();
    expect(document.querySelectorAll('[lang]')).toHaveLength(0);
  });
});
