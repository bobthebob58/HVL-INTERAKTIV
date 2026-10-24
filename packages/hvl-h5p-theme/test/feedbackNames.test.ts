/**
 * Tests for the prefix script with the markup of the libraries that use an answer's pseudo-elements or name it by
 * aria-label (TrueFalse 1.8, Summary 1.10, MultiMediaChoice 0.3) and of MarkTheWords 1.11, whose state is an
 * attribute: the label is shown as text, goes in front of an aria-label that does not already name the state, and
 * leaves everything as H5P wrote it when the state ends. Real H5P markup in Chromium:
 * apps/server/test/h5p/hvlFeedbackContainers.browser.int.test.ts.
 *
 * Spec: UD-003, UD-010
 */
import { describe, expect, it } from 'vitest';
import { openPrefixDocument } from './support/prefixDocument.js';

/** Markup shaped like the libraries write it (only what the script and the stylesheet look at). */
const MARKUP = `
  <div class="h5p-content">
    <div class="h5p-true-false-answers" role="radiogroup">
      <div class="h5p-true-false-answer" role="radio" id="tf">Rett<span class="aria-label"></span></div>
    </div>
    <div class="h5p-summary"><ul role="radiogroup">
      <li role="radio" class="summary-claim-unclicked" id="claim"><p>Undervegsvurdering er eksamen.</p></li>
      <li role="radio" class="summary-claim-unclicked" id="plain">Undervegsvurdering tel alltid.</li>
    </ul></div>
    <ul class="h5p-multi-media-choice-option-list" role="radiogroup">
      <li class="h5p-multi-media-choice-list-item" role="radio" aria-label="Eit hus" id="media">
        <div class="h5p-multi-media-choice-option"><div class="h5p-multi-media-choice-media-wrapper"></div></div>
      </li>
    </ul>
    <div class="h5p-mark-the-words"><span role="option" id="word">medan<span class="hidden-but-read"></span></span></div>
  </div>`;

const open = (lang = 'nn') => openPrefixDocument({ lang, body: MARKUP });

describe('labels shown as text and names given by aria-label', () => {
  it('[UD-003] TrueFalse: a wrong answer shows its label as the first child, and loses it on retry', async () => {
    // Arrange
    const { document, settle, labels } = open();
    const answer = document.getElementById('tf')!;
    // Act
    answer.classList.add('wrong');
    await settle();
    const marked = labels();
    answer.classList.remove('wrong');
    await settle();
    // Assert
    expect(marked).toEqual([['tf', 'incorrect', 'hvl-feedback-text', 'Feil: ']]);
    expect(answer.textContent).toBe('Rett');
  });

  it('[UD-003] Summary: the label goes into the claim paragraph, or the claim itself when it has none', async () => {
    const { document, settle, labels } = open();
    document.getElementById('claim')!.classList.replace('summary-claim-unclicked', 'summary-failed');
    document.getElementById('plain')!.classList.replace('summary-claim-unclicked', 'summary-failed');
    await settle();
    expect(labels()).toEqual([
      ['claim', 'incorrect', 'hvl-feedback-text', 'Feil: '],
      ['plain', 'incorrect', 'hvl-feedback-text', 'Feil: '],
    ]);
    expect(document.querySelector('#claim > p')!.firstElementChild!.className).toBe('hvl-feedback-text');
  });

  it('[UD-003] Summary: a name that already says the state keeps it; any other name gets the label', async () => {
    // Arrange
    const { document, settle } = open();
    const [claim, plain] = [document.getElementById('claim')!, document.getElementById('plain')!];
    // Act: H5P sets the class and then the aria-label in the same task
    claim.className = 'summary-failed';
    claim.setAttribute('aria-label', 'Feil. Undervegsvurdering er eksamen.');
    plain.className = 'summary-failed';
    plain.setAttribute('aria-label', 'Incorrect. Undervegsvurdering tel alltid.');
    await settle();
    // Assert
    expect(claim.getAttribute('aria-label')).toBe('Feil. Undervegsvurdering er eksamen.');
    expect(plain.getAttribute('aria-label')).toBe('Feil: Incorrect. Undervegsvurdering tel alltid.');
  });

  it('[UD-003][UD-010] MultiMediaChoice: the option name gets the label, follows the language and is restored', async () => {
    // Arrange
    const { document, settle, labels } = open();
    const [item, option] = [document.getElementById('media')!, document.querySelector('#media > div')!];
    // Act
    option.classList.add('h5p-multi-media-choice-wrong');
    await settle();
    const wrong = [item.getAttribute('aria-label'), labels()];
    document.documentElement.setAttribute('lang', 'en');
    await settle();
    const english = item.getAttribute('aria-label');
    option.classList.remove('h5p-multi-media-choice-wrong');
    await settle();
    // Assert
    expect(wrong).toEqual(['Feil: Eit hus', [['media', 'incorrect', 'hvl-feedback-text', 'Feil: ']]]);
    expect(english).toBe('Incorrect: Eit hus');
    expect([item.getAttribute('aria-label'), labels()]).toEqual(['Eit hus', []]);
  });

  it.each([
    ['en', 'Correct posture', 'Correct: Correct posture'],
    ['nn', 'Riktig handplassering', 'Riktig: Riktig handplassering'],
  ])(
    '[UD-003] MultiMediaChoice (%s): an alt text that merely begins with the word of the state still gets the label',
    async (lang, alt, named) => {
      const { document, settle } = open(lang);
      document.getElementById('media')!.setAttribute('aria-label', alt);
      document.querySelector('#media > div')!.classList.add('h5p-multi-media-choice-correct');
      await settle();
      expect(document.getElementById('media')!.getAttribute('aria-label')).toBe(named);
    },
  );

  it('[UD-003] MarkTheWords: the state is an attribute, and a missed word is labelled correct', async () => {
    const { document, settle, labels } = open();
    const word = document.getElementById('word')!;
    word.setAttribute('aria-describedby', 'h5p-description-incorrect');
    await settle();
    const incorrect = labels();
    word.setAttribute('aria-describedby', 'h5p-description-missed');
    await settle();
    expect(incorrect).toEqual([['word', 'incorrect', 'hvl-feedback-sr', 'Feil: ']]);
    expect(labels()).toEqual([['word', 'correct', 'hvl-feedback-sr', 'Riktig: ']]);
  });
});
