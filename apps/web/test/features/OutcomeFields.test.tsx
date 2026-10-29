/**
 * Tests for adding and removing learning outcomes on the **Læringsdesign** tab: focus moves to what took the place
 * of the control that went away, each change is announced, every control names its outcome's number, and the list
 * stops at 20.
 *
 * Spec: PED-030, UD-006
 */
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { OutcomeDraft } from '../../src/features/learningDesign/learningDesignForm';
import { OutcomeFields } from '../../src/features/learningDesign/OutcomeFields';

let next = 0;
const draft = (text: string): OutcomeDraft => ({ key: `k${(next += 1)}`, text, category: 'kunnskap' });

/** The list with its own state, as the form holds it, recording what is announced. */
function Harness({ initial, said }: { readonly initial: readonly OutcomeDraft[]; readonly said: string[] }) {
  const [outcomes, setOutcomes] = useState(initial);
  return (
    <OutcomeFields
      outcomes={outcomes}
      onChange={setOutcomes}
      newKey={() => `n${(next += 1)}`}
      fieldId={(key) => `outcome-${key}`}
      errors={new Map()}
      announce={(message) => said.push(message)}
    />
  );
}
const show = (texts: string[]) => {
  const said: string[] = [];
  render(<Harness initial={texts.map(draft)} said={said} />);
  return said;
};
const focusedValue = () => (document.activeElement as HTMLTextAreaElement | null)?.value;

describe('[UD-006] adding and removing learning outcomes', () => {
  it('[UD-006] adding puts focus on the new outcome’s text and announces it', () => {
    // Arrange
    const said = show(['Ein']);
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Legg til læringsutbytte' }));
    // Assert
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Læringsutbytte 2' }));
    expect(said).toEqual(['Læringsutbytte 2 er lagt til.']);
  });

  it('[UD-006] removing puts focus on the outcome that took its place, else the one before, else the add button', () => {
    // Arrange
    const said = show(['Ein', 'To', 'Tre']);
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Fjern læringsutbytte 2' }));
    const afterMiddle = focusedValue();
    fireEvent.click(screen.getByRole('button', { name: 'Fjern læringsutbytte 2' }));
    const afterLast = focusedValue();
    fireEvent.click(screen.getByRole('button', { name: 'Fjern læringsutbytte 1' }));
    // Assert
    expect([afterMiddle, afterLast]).toEqual(['Tre', 'Ein']);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Legg til læringsutbytte' }));
    expect(said).toEqual([
      'Læringsutbytte 2 er fjerna.',
      'Læringsutbytte 2 er fjerna.',
      'Læringsutbytte 1 er fjerna.',
    ]);
    expect(screen.getByText('Ingen læringsutbytte er lagt til.')).toBeTruthy();
  });

  it('[PED-030] each outcome has a numbered text, a category select with the three NKR categories and a remove button', () => {
    // Act
    show(['Ein', 'To']);
    // Assert
    const select = screen.getByRole('combobox', { name: 'Kategori for læringsutbytte 2' });
    expect([...select.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      'Kunnskap',
      'Ferdigheiter',
      'Generell kompetanse',
    ]);
    expect(screen.getAllByRole('button', { name: /^Fjern læringsutbytte \d$/ })).toHaveLength(2);
  });

  it('[PED-030] at 20 outcomes the add button gives way to a sentence, and removing one brings it back', () => {
    // Arrange
    show(Array.from({ length: 20 }, (_, index) => `Utbyte ${index + 1}`));
    // Act
    const full = screen.queryByRole('button', { name: 'Legg til læringsutbytte' });
    const sentence = screen.queryByText('Aktiviteten har 20 læringsutbytte, som er det meste han kan ha.');
    fireEvent.click(screen.getByRole('button', { name: 'Fjern læringsutbytte 20' }));
    // Assert
    expect(full).toBeNull();
    expect(sentence).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Legg til læringsutbytte' })).toBeTruthy();
  });
});
