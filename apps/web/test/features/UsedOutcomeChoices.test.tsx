/**
 * Tests for the outcomes already used in the course once the form holds the most outcomes it may (20): the group says
 * so, an unticked box stays reachable, is marked `aria-disabled`, is described by that sentence and adds nothing, and
 * a ticked box can still be unticked.
 *
 * Spec: PED-030, UD-006
 */
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MAX_OUTCOMES, type OutcomeDraft } from '../../src/features/learningDesign/learningDesignForm';
import { UsedOutcomeChoices } from '../../src/features/learningDesign/UsedOutcomeChoices';
import { fakeFetch } from '../support/fakeFetch';

const IN_FORM: readonly OutcomeDraft[] = Array.from({ length: MAX_OUTCOMES }, (_, index) => ({
  key: `k${index}`,
  text: `Utbytte ${index + 1}`,
  category: 'kunnskap',
}));
const USED = [
  { text: 'Utbytte 1', category: 'kunnskap' },
  { text: 'Reflektere', category: 'generell-kompetanse' },
];

/** Renders the choices for SYK110 with the form full, and waits for the group. */
const showFull = async () => {
  fakeFetch({
    'GET /api/learning-design/outcomes?courseCode=SYK110': {
      status: 200,
      body: { courseCode: 'SYK110', outcomes: USED },
    },
  });
  const onToggle = vi.fn();
  render(<UsedOutcomeChoices courseCode="SYK110" outcomes={IN_FORM} onToggle={onToggle} />);
  const group = await screen.findByRole('group', { name: 'Læringsutbytte du alt brukar i SYK110' });
  return { group, onToggle };
};

describe('[PED-030] the outcomes already used, at the limit', () => {
  it('[UD-006] says the limit in the group and describes the blocked box with it, keeping the box focusable', async () => {
    // Act
    const { group } = await showFull();
    // Assert
    const sentence = within(group).getByText(
      'Aktiviteten har 20 læringsutbytte, som er det meste han kan ha.',
    );
    const blocked = within(group).getByRole('checkbox', { name: 'Reflektere (Generell kompetanse)' });
    expect(blocked.getAttribute('aria-disabled')).toBe('true');
    expect(blocked.getAttribute('aria-describedby')).toBe(sentence.id);
    expect((blocked as HTMLInputElement).disabled).toBe(false);
    blocked.focus();
    expect(document.activeElement).toBe(blocked);
  });

  it('[PED-030] a press on the blocked box adds nothing, and a ticked box can still be unticked', async () => {
    // Arrange
    const { group, onToggle } = await showFull();
    const blocked = within(group).getByRole('checkbox', { name: 'Reflektere (Generell kompetanse)' });
    const ticked = within(group).getByRole('checkbox', { name: 'Utbytte 1 (Kunnskap)' });
    // Act
    fireEvent.click(blocked);
    fireEvent.click(ticked);
    // Assert
    expect((blocked as HTMLInputElement).checked).toBe(false);
    expect(onToggle.mock.calls).toEqual([[USED[0], false]]);
    expect(ticked.getAttribute('aria-disabled')).toBeNull();
  });
});
