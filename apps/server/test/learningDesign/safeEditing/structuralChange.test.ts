/**
 * Unit tests for comparing two structure signatures: the text-list rule (length and moved texts) and the kind and
 * path of the first difference.
 *
 * Spec: PROD-013
 */
import { describe, expect, it } from 'vitest';
import {
  isListStructural,
  structuralDifference,
} from '../../../src/learningDesign/safeEditing/structuralChange.js';
import { structureSignature } from '../../../src/learningDesign/safeEditing/structureSignature.js';

const MC = 'H5P.MultiChoice 1.16';
const choice = (...texts: string[]) => ({
  question: '<p>Kva?</p>',
  answers: texts.map((text, index) => ({ text: `<div>${text}</div>`, correct: index === 0 })),
});
const differs = (before: unknown, after: unknown) =>
  structuralDifference(structureSignature(before, MC), structureSignature(after, MC));

describe('[PROD-013] isListStructural', () => {
  it.each([
    ['the same list', ['A', 'B'], ['A', 'B'], false],
    ['a text reworded in place', ['A', 'B'], ['A', 'B, betre sagt'], false],
    ['every text reworded in place', ['A', 'B'], ['C', 'D'], false],
    ['one of two equal texts reworded', ['A', 'A'], ['A', 'C'], false],
    ['an item appended', ['A', 'B'], ['A', 'B', 'C'], true],
    ['an item removed', ['A', 'B'], ['A'], true],
    ['two items swapped', ['A', 'B', 'C'], ['B', 'A', 'C'], true],
    ['an item replaced by a copy of another', ['A', 'B'], ['A', 'A'], true],
    ['the first removed and a new one appended', ['A', 'B', 'C'], ['B', 'C', 'D'], true],
  ])('[PROD-013] %s', (_name, before, after, structural) => {
    expect(isListStructural(before, after)).toBe(structural);
  });
});

describe('[PROD-013] structuralDifference', () => {
  it('[PROD-013] is null for a text-only edit: question, feedback and an option reworded in place', () => {
    const after = choice('Ja, heilt sikkert', 'Nei');
    after.question = '<p>Kva meiner du?</p>';
    expect(differs(choice('Ja', 'Nei'), after)).toBeNull();
  });

  it('[PROD-013] names a moved or added option by the node path and the list name, never by its text', () => {
    const moved = { ...choice('Ja', 'Nei'), answers: [...choice('Ja', 'Nei').answers].reverse() };
    expect(differs(choice('Ja', 'Nei'), moved)).toEqual({ kind: 'list', path: '#options' });
    expect(differs(choice('Ja', 'Nei'), choice('Ja', 'Nei', 'Kanskje'))).toEqual({
      kind: 'list',
      path: '#options',
    });
  });

  it('[PROD-013] names a changed fact, such as single becoming multiple choice, by the node path', () => {
    const both = choice('Ja', 'Nei');
    both.answers.forEach((answer) => (answer.correct = true));
    expect(differs(choice('Ja', 'Nei'), both)).toEqual({ kind: 'facts', path: '' });
  });

  it('[PROD-013] counts another number of nodes before anything else', () => {
    const one = { content: [{ content: { library: 'H5P.Text 1.1', params: {}, subContentId: 'a' } }] };
    const two = {
      content: [...one.content, { content: { library: 'H5P.Text 1.1', params: {}, subContentId: 'b' } }],
    };
    const signature = (params: unknown) => structureSignature(params, 'H5P.Column 1.22');
    expect(structuralDifference(signature(one), signature(two))).toEqual({ kind: 'node-count', path: '' });
  });
});
