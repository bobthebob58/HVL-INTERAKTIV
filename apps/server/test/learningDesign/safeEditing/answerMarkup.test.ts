/**
 * Unit tests for reading the blanks of H5P.Blanks and the words of H5P.DragText as their players do.
 *
 * Spec: PROD-013
 */
import { describe, expect, it } from 'vitest';
import { blankSolutions, dragTextWords } from '../../../src/learningDesign/safeEditing/answerMarkup.js';

describe('[PROD-013] blankSolutions', () => {
  it('[PROD-013] reads one solution per blank across the questions, without the tip', () => {
    const questions = [
      '<p>Før samlinga tek studentane ein *quiz/test:Ei kort oppgåve.* og ser ein *video*.</p>',
      '<p>Etter samlinga skriv dei ein *refleksjon : Om eiga læring*.</p>',
    ];
    expect(blankSolutions(questions)).toEqual(['quiz/test', 'video', 'refleksjon']);
  });

  it('[PROD-013] trims alternatives, decodes entities, removes tags in a blank and skips an empty pair', () => {
    expect(blankSolutions(['<p>Ein ** og *<strong>alt-tekst</strong> /  alt&amp;tekst*.</p>'])).toEqual([
      'alt-tekst/alt&tekst',
    ]);
  });

  it('[PROD-013] finds no blanks in a value that is not a list of strings', () => {
    expect(blankSolutions('*ikkje ei liste*')).toEqual([]);
    expect(blankSolutions([{ text: '*x*' }, 3])).toEqual([]);
  });
});

describe('[PROD-013] dragTextWords', () => {
  it('[PROD-013] reads one word per drop zone, without its tip or feedback, across lines', () => {
    const text =
      'Læring krev *aktivitet:Kva studentane gjer\\+Ja.\\-Nei.*.\nI tre *fasar*: før, under og etter.';
    expect(dragTextWords(text)).toEqual(['aktivitet', 'fasar']);
  });

  it('[PROD-013] reads distractors only as parts between asterisks', () => {
    expect(dragTextWords('*sluttvurdering* *eksamen:tips* laus tekst')).toEqual([
      'sluttvurdering',
      'eksamen',
    ]);
    expect(dragTextWords(undefined)).toEqual([]);
  });
});
