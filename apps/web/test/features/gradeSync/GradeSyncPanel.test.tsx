/**
 * Tests for the grade-sync panel: its headings and formative label, each state's count in words with an icon, a link
 * without a gradebook column, no placements, a refused view, and the Bearer ltik in Canvas. The retry is tested in
 * ./GradeSyncPanelRetry.test.tsx.
 *
 * Spec: LTI-012, LTI-013, UD-003, UD-006
 */
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiAuthProvider } from '../../../src/api/ApiAuthContext';
import { GradeSyncPanel } from '../../../src/features/gradeSync/GradeSyncPanel';
import { errorBody, fakeFetch } from '../../support/fakeFetch';
import { BEFORE, ID, NAT_UNGRADED, PATH, status } from './gradeSyncAnswers';

describe('[LTI-012] the grade-sync panel', () => {
  it('[UD-006] has one h2, the formative label and a section per placement, named by course and Canvas', async () => {
    // Arrange
    fakeFetch({ [`GET ${PATH}`]: status(BEFORE, NAT_UNGRADED) });
    // Act
    render(<GradeSyncPanel contentId={ID} />);
    await screen.findByRole('heading', { name: 'SYK110 i HVL Canvas' });
    // Assert
    expect(screen.getAllByRole('heading').map((h) => `${h.tagName} ${h.textContent}`)).toEqual([
      'H2 Poeng til karakterboka i Canvas',
      'H3 ℹ︎ Til undervegsvurdering',
      'H3 SYK110 i HVL Canvas',
      'H3 NAT200 i HVL Canvas',
    ]);
    const label = screen.getByRole('region', { name: 'Til undervegsvurdering' });
    expect(label.textContent).toContain('ikkje for eksamen eller karakterar');
    expect(label.textContent).toContain('Canvas viser poenga i karakterboka, men dei er ikkje karakterar.');
  });

  it('[UD-003] gives each state its count with words and an icon, never by colour alone', async () => {
    // Arrange
    fakeFetch({ [`GET ${PATH}`]: status(BEFORE) });
    // Act
    render(<GradeSyncPanel contentId={ID} />);
    await screen.findByRole('heading', { name: 'SYK110 i HVL Canvas' });
    const section = screen.getByRole('region', { name: 'SYK110 i HVL Canvas' });
    // Assert
    const terms = within(section)
      .getAllByRole('term')
      .map((term) => term.textContent);
    const values = within(section)
      .getAllByRole('definition')
      .map((value) => value.textContent);
    expect(terms).toEqual([
      '✓ Sendt til Canvas',
      '◷ Ventar på å bli sendt',
      '✗ Feila',
      '⊘ Oppgåva er sletta i Canvas',
    ]);
    expect(values).toEqual(['12', '3', '2', '1']);
    for (const icon of section.querySelectorAll('dt span'))
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(within(section).getByText('Poengregel:').parentElement?.textContent).toBe(
      'Poengregel: Det beste forsøket blir sendt.',
    );
    expect(within(section).getByText(/Canvas tok ikkje imot desse poenga/)).toBeTruthy();
    expect(within(section).getByText(/Oppgåva finst ikkje lenger i Canvas/)).toBeTruthy();
  });

  it('[LTI-012] a link without a gradebook column says so and has no counts or button', async () => {
    // Arrange
    fakeFetch({ [`GET ${PATH}`]: status(NAT_UNGRADED) });
    // Act
    render(<GradeSyncPanel contentId={ID} />);
    // Assert
    expect(await screen.findByText(/Denne lenkja har inga kolonne i karakterboka/)).toBeTruthy();
    expect(screen.queryByRole('term')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('[LTI-012] an activity in no Canvas course says so; a refused view says the person has no access', async () => {
    // Arrange and act
    fakeFetch({ [`GET ${PATH}`]: status() });
    const { unmount } = render(<GradeSyncPanel contentId={ID} />);
    // Assert
    expect(await screen.findByText(/Aktiviteten er ikkje lagd inn i noko Canvas-emne enno/)).toBeTruthy();
    unmount();
    fakeFetch({ [`GET ${PATH}`]: { status: 403, body: errorBody(403, 'error.forbidden') } });
    render(<GradeSyncPanel contentId={ID} />);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Du har ikkje tilgang til poengsendinga for denne aktiviteten.',
    );
  });

  it('[LTI-012] in Canvas the requests carry the Bearer ltik and no cookie', async () => {
    // Arrange
    const requests = fakeFetch({ [`GET ${PATH}`]: status(BEFORE) });
    // Act
    render(
      <ApiAuthProvider auth={{ kind: 'lti', ltik: 'ltik-1' }}>
        <GradeSyncPanel contentId={ID} />
      </ApiAuthProvider>,
    );
    await screen.findByRole('heading', { name: 'SYK110 i HVL Canvas' });
    // Assert
    expect(requests[0]?.headers.Authorization).toBe('Bearer ltik-1');
    expect(requests[0]?.credentials).toBe('omit');
    expect(requests[0]?.path).toBe(PATH);
  });
});
