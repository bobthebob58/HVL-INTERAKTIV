/**
 * Tests for the language of the texts the Innsikt tab quotes from the activity: an English activity on a Nynorsk page
 * gives its question, option, feedback and answer texts `lang="en"`, in the tables, the headings and the shortlist,
 * while the tab's own words and its fallbacks for a missing text stay in the page's language.
 *
 * Spec: UD-010, INS-002, INS-003, INS-005
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthoredLanguageContext } from '../../../src/features/insight/authoredLanguage';
import { InsightPanel } from '../../../src/features/insight/InsightPanel';
import { VideoEngagementSection } from '../../../src/features/insight/VideoEngagementSection';
import { fakeFetch } from '../../support/fakeFetch';
import { CONTEXTS, CONTEXTS_PATH, FINDINGS_PATH, ID, PORTAL_PATH, REPORT } from './insightAnswers';
import { FINDINGS, VIDEO_REPORT } from './insightOtherAnswers';

/** The language a text is read in: the nearest `lang`, or null for the page's own. */
const langOf = (element: Element | null | undefined) =>
  element?.closest('[lang]')?.getAttribute('lang') ?? null;

const openTab = async (language: string) => {
  fakeFetch({
    [`GET ${PORTAL_PATH}`]: { status: 200, body: REPORT },
    [`GET ${CONTEXTS_PATH}`]: { status: 200, body: { contexts: CONTEXTS } },
    [`GET ${FINDINGS_PATH}`]: { status: 200, body: FINDINGS },
  });
  render(<InsightPanel contentId={ID} title="Cells" language={language} />);
  await screen.findByRole('heading', { name: 'Deltaking' });
};

describe('[UD-010] the language of the activity’s texts on the Innsikt tab', () => {
  it('[UD-010] marks the question, option, feedback and answer texts of an English activity, not the tab’s words', async () => {
    // Act
    await openTab('en');
    // Assert: the question heading and the item table's row headers, but not the name of a gone question
    expect(langOf(screen.getByRole('heading', { name: 'Kva gjer mitokondriane?' }))).toBe('en');
    const items = screen.getByRole('table', { name: 'Spørsmåla, vanskelegast først' });
    expect(within(items).getAllByRole('rowheader').map(langOf)).toEqual(['en', 'en', null]);
    // Assert: options and the teacher's feedback, not «Inga tilbakemelding»
    const question = screen.getByRole('region', { name: 'Kva gjer mitokondriane?' });
    const options = within(question).getByRole('table', { name: 'Svara på «Kva gjer mitokondriane?»' });
    expect(langOf(within(options).getByRole('rowheader', { name: 'Lagrar arvestoff' }))).toBe('en');
    expect(langOf(within(options).getByText('Arvestoffet ligg i cellekjernen.'))).toBe('en');
    expect(langOf(within(options).getByText('Inga tilbakemelding'))).toBeNull();
    // Assert: a gap's accepted and wrong answers, not «Riktig:», «eller» or the tab's row names
    const accepted = screen.getByText(/^Riktig: /);
    expect(accepted.textContent).toBe('Riktig: «mitokondrie» eller «mitokondria»');
    expect([...accepted.querySelectorAll('[lang="en"]')].map((part) => part.textContent)).toEqual([
      '«mitokondrie»',
      '«mitokondria»',
    ]);
    expect(langOf(screen.getByRole('rowheader', { name: 'ribosom' }))).toBe('en');
    expect(langOf(screen.getByRole('rowheader', { name: 'Riktige svar' }))).toBeNull();
    expect(langOf(screen.getByRole('heading', { name: 'Innsikt før samlinga' }))).toBeNull();
  });

  it('[UD-010] marks a question’s text on the shortlist and in its button, not the name of a gone question', async () => {
    // Arrange
    await openTab('en-GB');
    const items = screen.getByRole('table', { name: 'Spørsmåla, vanskelegast først' });
    const [first, , gone] = within(items).getAllByRole('button');
    // Act
    fireEvent.click(first!);
    // Assert
    expect(langOf(first?.querySelector('.sr-only'))).toBe('en-GB');
    expect(langOf(gone?.querySelector('.sr-only'))).toBeNull();
    const list = screen.getByRole('region', { name: /^Ta opp i samlinga \(/ });
    expect(langOf(within(list).getByText('Kva gjer mitokondriane?'))).toBe('en-GB');
  });

  it('[UD-010] marks nothing when the activity is in the page’s language', async () => {
    // Act
    await openTab('nn');
    // Assert
    expect(document.querySelectorAll('[lang]')).toHaveLength(0);
  });

  it('[UD-010][INS-005] marks a video task’s own name, not «Oppgåve utan tittel»', () => {
    // Act
    render(
      <AuthoredLanguageContext.Provider value="en">
        <VideoEngagementSection interactions={VIDEO_REPORT.videoEngagement ?? []} k={5} />
      </AuthoredLanguageContext.Provider>,
    );
    // Assert
    const table = screen.getByRole('table', { name: 'Oppgåvene i videoen' });
    expect(within(table).getAllByRole('rowheader').map(langOf)).toEqual(['en', 'en', null]);
  });
});
