/**
 * Tests for the validator's findings on the Innsikt tab: counted by severity, each with its severity as an icon and a
 * word and the reason that holds, the way to the check tab, and what it says when the findings are refused or fail.
 *
 * Spec: INS-010, UD-022, UD-003
 */
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InsightFindings } from '../../../src/features/insight/InsightFindings';
import { errorBody, fakeFetch } from '../../support/fakeFetch';
import { FINDINGS_PATH, ID } from './insightAnswers';
import { FINDINGS } from './insightOtherAnswers';

describe('[INS-010] validator findings on the Innsikt tab', () => {
  it('[INS-010][UD-003] counts the findings and lists each with its severity in words and the reason that holds', async () => {
    // Arrange
    fakeFetch({ [`GET ${FINDINGS_PATH}`]: { status: 200, body: FINDINGS } });
    // Act
    render(<InsightFindings contentId={ID} onOpenCheck={() => undefined} />);
    const section = screen.getByRole('region', { name: 'Tilgjengelegheit og kvalitet' });
    await within(section).findByText(/Biletet manglar alternativ tekst/);
    // Assert
    expect(within(section).getByText('Feil: 1. Åtvaringar: 0. Tips: 1.')).toBeTruthy();
    const items = within(section).getAllByRole('listitem');
    expect(items.map((item) => item.firstElementChild?.textContent)).toEqual([
      '✗ Feil: Biletet manglar alternativ tekst.',
      'ℹ︎ Tips: Legg gjerne til tilbakemelding på kvart svar.',
    ]);
    for (const icon of section.querySelectorAll('strong span'))
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(items[0]?.textContent).toContain(
      'Grunngjeve: «Biletet er pynt.». Grunngjevinga gjeld til 15. nov. 2026.',
    );
    expect(within(section).getByRole('button', { name: 'Opne Sjekk og publiser' })).toBeTruthy();
  });

  it.each([403, 404])(
    '[INS-010] findings refused (%i) to someone who may not edit say they are for editors, with no way to the check tab',
    async (status) => {
      // Arrange
      fakeFetch({ [`GET ${FINDINGS_PATH}`]: { status, body: errorBody(status, 'hvl:edit-not-allowed') } });
      // Act
      render(<InsightFindings contentId={ID} onOpenCheck={() => undefined} />);
      // Assert
      expect(await screen.findByText(/berre for dei som kan redigere/)).toBeTruthy();
      expect(screen.queryByRole('button')).toBeNull();
    },
  );

  it('[INS-010] findings that fail to load say so in an alert; none found says there is nothing to fix', async () => {
    // Arrange and act
    fakeFetch({ [`GET ${FINDINGS_PATH}`]: { status: 500, body: errorBody(500, 'error.internal') } });
    const { unmount } = render(<InsightFindings contentId={ID} />);
    // Assert
    expect((await screen.findByRole('alert')).textContent).toBe('Klarte ikkje å hente funna frå sjekken.');
    unmount();
    fakeFetch({ [`GET ${FINDINGS_PATH}`]: { status: 200, body: { ...FINDINGS, findings: [] } } });
    render(<InsightFindings contentId={ID} />);
    expect(await screen.findByText('Sjekken fann ingenting å rette.')).toBeTruthy();
  });
});
