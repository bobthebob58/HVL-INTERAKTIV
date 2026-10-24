/**
 * Tests for the prefix script in a simulated document (jsdom) with the generated prefix stylesheet: it adds one
 * visually hidden label per answer state, in the element's language, follows H5P's changes and stays inert
 * without its stylesheet. Shown labels and names: ./feedbackNames.test.ts. Real H5P markup in Chromium:
 * apps/server/test/h5p/hvlFeedback.browser.int.test.ts.
 *
 * Spec: UD-003, UD-010
 */
import { describe, expect, it } from 'vitest';
import { openPrefixDocument, SCRIPT } from './support/prefixDocument.js';

/** A MultiChoice-shaped answer list and a Blanks-shaped field, as H5P 1.16 / 1.14 write them. */
const ANSWERS = `
  <div class="h5p-content"><div class="h5p-multichoice"><ul>
    <li class="h5p-answer" id="a1"><div class="h5p-alternative-container"><span class="h5p-alternative-inner"><div>Ja</div></span></div></li>
    <li class="h5p-answer" id="a2"><div class="h5p-alternative-container"><span class="h5p-alternative-inner"><div>Nei</div></span></div></li>
  </ul></div>
  <div class="h5p-blanks"><span class="h5p-input-wrapper" id="b1"><input type="text"></span></div></div>`;

/** Opens a document with the stylesheet (or not) and runs the script in it; `prefixes()` lists hidden labels. */
function openDocument(lang: string, withStylesheet = true) {
  const opened = openPrefixDocument({ lang, body: ANSWERS, withStylesheet });
  const prefixes = () =>
    opened
      .labels()
      .flatMap(([id, state, className, text]) =>
        className === 'hvl-feedback-sr' ? [[id, state, text]] : [],
      );
  return { ...opened, prefixes };
}

describe('the feedback prefix script', () => {
  it('[UD-003] adds a hidden label as the first child of each correct and incorrect answer', async () => {
    // Arrange
    const { document, settle, prefixes } = openDocument('nn');
    // Act
    document.getElementById('a1')!.classList.add('h5p-correct');
    document.getElementById('b1')!.classList.add('h5p-wrong');
    await settle();
    // Assert
    expect(prefixes()).toEqual([
      ['a1', 'correct', 'Riktig: '],
      ['b1', 'incorrect', 'Feil: '],
    ]);
    expect(document.querySelector('#a1 .h5p-alternative-inner')!.firstElementChild!.className).toBe(
      'hvl-feedback-sr',
    );
  });

  it.each([
    ['nb', 'Riktig: ', 'Feil: '],
    ['en', 'Correct: ', 'Incorrect: '],
    ['en-GB', 'Correct: ', 'Incorrect: '],
    ['de', 'Riktig: ', 'Feil: '],
  ])(
    '[UD-010] labels a %s document in its language (nn when it has none)',
    async (lang, correct, incorrect) => {
      const { document, settle, prefixes } = openDocument(lang);
      document.getElementById('a1')!.classList.add('h5p-correct');
      document.getElementById('a2')!.classList.add('h5p-wrong');
      await settle();
      expect(prefixes()).toEqual([
        ['a1', 'correct', correct],
        ['a2', 'incorrect', incorrect],
      ]);
    },
  );

  it('[UD-010] follows a lang attribute on the content container', async () => {
    const { document, settle, prefixes } = openDocument('nn');
    document.querySelector('.h5p-content')!.setAttribute('lang', 'en');
    document.getElementById('a1')!.classList.add('h5p-correct');
    await settle();
    expect(prefixes()).toEqual([['a1', 'correct', 'Correct: ']]);
  });

  it('[UD-003] is idempotent: repeated changes and a second copy of the script add nothing', async () => {
    // Arrange
    const { window, document, settle, prefixes } = openDocument('nn');
    document.getElementById('a1')!.classList.add('h5p-correct');
    await settle();
    // Act
    document.getElementById('a1')!.classList.add('h5p-selected');
    window.eval(SCRIPT);
    document.body.appendChild(document.createElement('div'));
    await settle();
    // Assert
    expect(prefixes()).toEqual([['a1', 'correct', 'Riktig: ']]);
  });

  it('[UD-003] removes the label when H5P clears the state (retry) and replaces it when the state changes', async () => {
    // Arrange
    const { document, settle, prefixes } = openDocument('nn');
    const answer = document.getElementById('a1')!;
    answer.classList.add('h5p-correct');
    await settle();
    // Act
    answer.classList.remove('h5p-correct');
    await settle();
    const afterRetry = prefixes();
    answer.classList.add('h5p-wrong');
    await settle();
    // Assert
    expect(afterRetry).toEqual([]);
    expect(prefixes()).toEqual([['a1', 'incorrect', 'Feil: ']]);
  });

  it('[UD-003] labels an answer that H5P re-renders inside a state element', async () => {
    const { document, settle, prefixes } = openDocument('nn');
    const answer = document.getElementById('a2')!;
    answer.classList.add('h5p-wrong');
    await settle();
    answer.querySelector('.h5p-alternative-inner')!.innerHTML = '<div>Nei, ikkje</div>';
    await settle();
    expect(prefixes()).toEqual([['a2', 'incorrect', 'Feil: ']]);
  });

  it('[UD-003] does nothing without its stylesheet, and never throws', async () => {
    const { document, settle, prefixes } = openDocument('nn', false);
    document.getElementById('a1')!.classList.add('h5p-correct');
    await settle();
    expect(prefixes()).toEqual([]);
  });

  it('[UD-003] runs under the strict H5P policy: no eval, no inline handlers, no HTML strings', () => {
    const code = SCRIPT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\beval\s*\(|new Function|setTimeout\s*\(\s*['"]|innerHTML|insertAdjacentHTML/);
    expect(code).not.toMatch(/\.on[a-z]+\s*=|setAttribute\(\s*['"]on/);
  });
});
