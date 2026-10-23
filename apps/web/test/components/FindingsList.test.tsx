/**
 * Component tests for FindingsList: findings grouped by severity (errors first), each with an icon and a severity
 * word, the server's message, an acknowledgement when one holds, and "Gå til feltet" for findings with a path.
 *
 * Spec: PROD-003, UD-003, UD-022
 */
// @vitest-environment jsdom
import type { FindingWithAcknowledgement } from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FindingsList, SEVERITY_ICON } from '../../src/components/FindingsList';
import { LocaleProvider } from '../../src/i18n/LocaleContext';

const FINDINGS: FindingWithAcknowledgement[] = [
  {
    ruleId: 'PED-H05',
    severity: 'hint',
    requirement: 'PED-020',
    path: 'questions[0].params.behaviour.feedbackOnWrong',
    message: 'Gi ei forklaring når svaret er feil.',
    acknowledgement: null,
  },
  {
    ruleId: 'V-IMG-ALT',
    severity: 'error',
    requirement: 'UD-021',
    path: 'content[1].content.params.alt',
    message: 'Biletet manglar alternativ tekst.',
    acknowledgement: null,
  },
  {
    ruleId: 'V-VID-CAPTIONS',
    severity: 'error',
    requirement: 'UD-021',
    path: 'interactiveVideo.video',
    message: 'Videoen manglar teksting.',
    acknowledgement: {
      reason: 'Tekstinga blir laga i Panopto.',
      at: '2026-10-23T10:00:00.000Z',
      expiresAt: '2026-11-06T10:00:00.000Z',
    },
  },
  {
    ruleId: 'V-LANG',
    severity: 'warning',
    requirement: 'UD-021',
    path: '',
    message: 'Aktiviteten har inga språkkode.',
    acknowledgement: null,
  },
];

describe('[PROD-003] the findings list', () => {
  it('[PROD-003] groups findings by severity, errors first, with counts', () => {
    // Act
    render(<FindingsList findings={FINDINGS} onGoToField={() => undefined} />);
    // Assert
    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
    expect(headings).toEqual(['Feil (2)', 'Åtvaringar (1)', 'Tips (1)']);
  });

  it('[UD-003] marks each finding with an icon and a severity word, not colour alone', () => {
    // Act
    render(<FindingsList findings={FINDINGS} onGoToField={() => undefined} />);
    // Assert
    const error = screen.getByText('Biletet manglar alternativ tekst.', { exact: false });
    expect(error.textContent).toBe(`${SEVERITY_ICON.error} Feil: Biletet manglar alternativ tekst.`);
    expect(within(error).getByText(SEVERITY_ICON.error).getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('Aktiviteten har inga språkkode.', { exact: false }).textContent).toContain(
      'Åtvaring:',
    );
    expect(screen.getByText('Gi ei forklaring når svaret er feil.', { exact: false }).textContent).toContain(
      'Tips:',
    );
  });

  it('[UD-022] shows the reason of an acknowledged error and until when it holds', () => {
    render(<FindingsList findings={FINDINGS} onGoToField={() => undefined} />);
    expect(screen.getByText(/Grunngjeve: «Tekstinga blir laga i Panopto.»/).textContent).toMatch(
      /gjeld til 6\. nov/,
    );
  });

  it('[PROD-003] "Gå til feltet" sends the finding’s path and is described by its message', () => {
    // Arrange
    const onGoToField = vi.fn();
    render(<FindingsList findings={FINDINGS} onGoToField={onGoToField} />);
    const buttons = screen.getAllByRole('button', { name: 'Gå til feltet' });
    // Act
    fireEvent.click(buttons[0] as HTMLElement);
    // Assert
    expect(buttons).toHaveLength(3);
    expect(onGoToField).toHaveBeenCalledWith('content[1].content.params.alt');
    const described = document.getElementById(buttons[0]?.getAttribute('aria-describedby') ?? '');
    expect(described?.textContent).toContain('Biletet manglar alternativ tekst.');
  });

  it('[PROD-003] offers no "Gå til feltet" to a person who may not edit', () => {
    render(<FindingsList findings={FINDINGS} onGoToField={() => undefined} canGoToField={false} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('[PROD-003] says so when there is nothing to fix, in the page language', () => {
    render(
      <LocaleProvider locale="en">
        <FindingsList findings={[]} onGoToField={() => undefined} />
      </LocaleProvider>,
    );
    expect(screen.getByText('The check found nothing to fix. The activity can be published.')).toBeTruthy();
  });
});
