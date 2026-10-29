/**
 * Unit tests for the answer shapes of the question types: MultiChoice's mode as the player derives it, and what
 * each leaf rule counts as structural.
 *
 * Spec: PROD-013
 */
import { describe, expect, it } from 'vitest';
import { multiChoiceMode } from '../../../src/learningDesign/safeEditing/leafShapes.js';
import { structuralDifference } from '../../../src/learningDesign/safeEditing/structuralChange.js';
import { structureSignature } from '../../../src/learningDesign/safeEditing/structureSignature.js';

const answers = (...correct: boolean[]) =>
  correct.map((value, index) => ({ text: `Svar ${index}`, correct: value }));
const differs = (library: string, before: unknown, after: unknown) =>
  structuralDifference(structureSignature(before, library), structureSignature(after, library)) !== null;

describe('[PROD-013] multiChoiceMode', () => {
  it.each([
    ['auto with one correct option', { type: 'auto' }, [true, false], 'single'],
    ['auto with two correct options', { type: 'auto' }, [true, true], 'multi'],
    ['auto with no correct option', { type: 'auto' }, [false, false], 'multi'],
    ['no type at all (the default is auto)', {}, [false, true], 'single'],
    ['single with two correct options', { type: 'single' }, [true, true], 'single'],
    ['multi with one correct option', { type: 'multi' }, [true, false], 'multi'],
  ])('[PROD-013] %s', (_name, behaviour, correct, mode) => {
    expect(multiChoiceMode({ behaviour, answers: answers(...correct) })).toBe(mode);
  });
});

describe('[PROD-013] the leaf rules', () => {
  it('[PROD-013] MultiChoice: moving the answer key keeps the mode and is not structural; changing the mode is', () => {
    const before = { behaviour: { type: 'auto' }, answers: answers(true, false) };
    expect(differs('H5P.MultiChoice 1.16', before, { ...before, answers: answers(false, true) })).toBe(false);
    expect(differs('H5P.MultiChoice 1.16', before, { ...before, answers: answers(true, true) })).toBe(true);
  });

  it('[PROD-013] Summary: rewording statements is not structural; another number of groups is', () => {
    const group = (...statements: string[]) => ({ summary: statements, tip: '' });
    const before = { summaries: [group('A', 'B'), group('C', 'D')] };
    expect(differs('H5P.Summary 1.10', before, { summaries: [group('A!', 'B'), group('C', 'D!')] })).toBe(
      false,
    );
    expect(differs('H5P.Summary 1.10', before, { summaries: [group('A', 'B')] })).toBe(true);
  });

  it('[PROD-013] BranchingQuestion: rewording an alternative is not structural; adding or moving one is', () => {
    const question = (...texts: string[]) => ({
      branchingQuestion: { question: '<p>Kva vel du?</p>', alternatives: texts.map((text) => ({ text })) },
    });
    const library = 'H5P.BranchingQuestion 1.0';
    expect(differs(library, question('Ja', 'Nei'), question('Ja, gjerne', 'Nei'))).toBe(false);
    expect(differs(library, question('Ja', 'Nei'), question('Nei', 'Ja'))).toBe(true);
    expect(differs(library, question('Ja', 'Nei'), question('Ja', 'Nei', 'Kanskje'))).toBe(true);
  });
});
