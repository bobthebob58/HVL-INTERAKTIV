/**
 * Tests for the Innsikt tab's period note (D-106's amendment of 2026-11-04): every view says its numbers run up to and
 * including yesterday, with that day's date; a 7-, 14- or 30-day view whose start the server moved to 1 August says
 * it is shortened and why; and the panel shows the note under the scope line.
 *
 * Spec: INS-006, INS-001, PROD-010
 */
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PeriodInsightNote } from '../../../src/features/insight/InsightNotes';
import { InsightPanel } from '../../../src/features/insight/InsightPanel';
import { isShortenedPeriod, lastDayOf } from '../../../src/features/insight/insightPeriods';
import { LocaleProvider } from '../../../src/i18n/LocaleContext';
import { fakeFetch } from '../../support/fakeFetch';
import { CONTEXTS, CONTEXTS_PATH, FINDINGS_PATH, ID, PORTAL_PATH, REPORT, scope } from './insightAnswers';
import { FINDINGS } from './insightOtherAnswers';

/** A 7-day view on 4 August 2027 (Oslo, summer time): shortened to start on 1 August. */
const AUGUST = scope({ periodStart: '2027-07-31T22:00:00.000Z', periodEnd: '2027-08-03T22:00:00.000Z' });

describe('[INS-006] the period note', () => {
  it('[INS-006] says the numbers run up to and including yesterday, with its date, and nothing more for a whole period', () => {
    // Act
    render(<PeriodInsightNote scope={scope()} />);
    // Assert: the view ends at midnight on 4 November 2026, so its last day is 3 November
    expect(screen.getByText(/^Tal til og med i går \(3\. nov\. 2026\)\./)).toBeTruthy();
    expect(screen.queryByText(/forkorta/)).toBeNull();
  });

  it('[INS-006] says when the period is shortened to start on 1 August, and why, in each language', () => {
    // Act
    const { unmount } = render(<PeriodInsightNote scope={AUGUST} />);
    const nn = document.body.textContent ?? '';
    unmount();
    render(
      <LocaleProvider locale="en">
        <PeriodInsightNote scope={AUGUST} />
      </LocaleProvider>,
    );
    // Assert
    expect(nn).toContain('Perioden er forkorta og startar 1. aug. 2027');
    expect(nn).toContain('nye anonyme nøklar frå 1. august');
    expect(screen.getByText(/^The period is shortened and starts on 1 Aug 2027/)).toBeTruthy();
  });

  it.each([
    ['7d', '2027-07-31T22:00:00.000Z', '2027-08-07T22:00:00.000Z', false],
    ['7d', '2027-07-31T22:00:00.000Z', '2027-08-06T22:00:00.000Z', true],
    ['30d', '2027-07-31T22:00:00.000Z', '2027-08-30T22:00:00.000Z', false],
    ['14d', '2026-10-20T22:00:00.000Z', '2026-11-03T23:00:00.000Z', false],
    ['7d', '2026-03-24T23:00:00.000Z', '2026-03-31T22:00:00.000Z', false],
    ['semester', '2027-07-31T22:00:00.000Z', '2027-08-01T22:00:00.000Z', false],
  ] as const)(
    '[INS-006] a %s view from %s to %s is shortened: %s',
    (period, periodStart, periodEnd, expected) => {
      // WHY: the last two cross a daylight-saving change and the start of a semester, which are not shortenings.
      expect(isShortenedPeriod({ period, periodStart, periodEnd })).toBe(expected);
    },
  );

  it('[INS-006] the last day is the Oslo day before the end, a midnight', () => {
    expect(lastDayOf('2026-11-03T23:00:00.000Z')).toBe('2026-11-03T22:59:59.999Z');
  });

  it('[PROD-010] the panel shows the note under the scope line', async () => {
    // Arrange
    fakeFetch({
      [`GET ${PORTAL_PATH}`]: { status: 200, body: REPORT },
      [`GET ${CONTEXTS_PATH}`]: { status: 200, body: { contexts: CONTEXTS } },
      [`GET ${FINDINGS_PATH}`]: { status: 200, body: FINDINGS },
    });
    // Act
    render(<InsightPanel contentId={ID} title="Celler" />);
    const note = await screen.findByText(/^Tal til og med i går/);
    // Assert
    const scopeLine = screen.getByText(/^Viser /);
    expect(scopeLine.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
