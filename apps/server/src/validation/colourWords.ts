/**
 * colourWords — finds text that points to something by its colour alone ("the red option", «det grøne feltet»),
 * and choices that consist of nothing but a colour.
 *
 * Why: WCAG 1.4.1 (Use of Color): learners who cannot tell colours apart, and screen-reader users, cannot follow
 *      an instruction that only names a colour. V-COLOUR-WORDS hints on such phrases; V-BRANCH-COLOUR warns when
 *      a BranchingScenario choice is only a colour.
 * Spec: UD-021
 * Invariants:
 *   - Matching is case-insensitive on plain text, in nn, nb and en, with Unicode word boundaries (å, ø, æ).
 *   - A phrase is a colour word followed by a pointing noun (option, field, knappen …), or "in red" / «i raudt».
 *     A colour word on its own is not a phrase: "What colour is the sky? Blue" is fine.
 * Collaborators: ./rules/colourWordsRule.ts, ./rules/branchColourRule.ts.
 * Tests: apps/server/test/validation/rules/colourWordsRule.test.ts, apps/server/test/validation/rules/branchColourRule.test.ts
 */

const COLOURS = [
  // en
  'red|green|blue|yellow|orange|purple|violet|pink|brown|grey|gray|black|white',
  // nn and nb, with their inflected forms
  'raud|raude|raudt|rød|røde|rødt|grøn|grøne|grønt|grønn|grønne|blå|blått|blåe|gul|gule|gult|oransje',
  'lilla|fiolett|fiolette|rosa|brun|brune|brunt|grå|grått|svart|svarte|kvit|kvite|kvitt|hvit|hvite|hvitt',
].join('|');

const NOUNS = [
  // en
  'options?|answers?|choices?|alternatives?|box(?:es)?|fields?|buttons?|areas?|parts?|words?|texts?|lines?',
  'circles?|squares?|markers?|arrows?|dots?|ones?|cards?|cells?|columns?|rows?|sections?|highlights?',
  // nn and nb
  'alternativ(?:et|a|ene)?|svar(?:et|a|ene)?|felt(?:et|a|ene)?|knapp(?:en|ar|ane|er|ene)?|boks(?:en|ar|ane|er|ene)?',
  'område(?:t|ne)?|del(?:en|ar|ane|er|ene)?|ord(?:et|a|ene)?|tekst(?:en|ar|ane|er|ene)?|linj(?:a|e|en|er|ene)',
  'sirk(?:el|elen|lar|lane|ler|lene)|rut(?:a|e|en|er|ene)|markør(?:en|ar|ane|er|ene)?|pil(?:a|en|ar|ane|er|ene)?',
  'prikk(?:en|ar|ane|er|ene)?|kort(?:et|a|ene)?|val(?:et|a)?|valg(?:et|ene)?|kolonn(?:a|e|en|er|ene)|rad(?:a|en|er|ene)?',
  'markering(?:a|en|ar|ane|er|ene)?',
].join('|');

const LETTER = '[\\p{L}\\p{N}]';
const PHRASE = new RegExp(
  `(?<!${LETTER})(?:(?:${COLOURS})\\s+(?:${NOUNS})|(?:in|i|med|marked|merkt|merka)\\s+(?:${COLOURS}))(?!${LETTER})`,
  'iu',
);
const COLOUR_WORD = new RegExp(`(?<!${LETTER})(?:${COLOURS})(?!${LETTER})`, 'giu');
// WHY: coloured circles, squares and hearts stand for a colour as much as the word does.
const COLOUR_EMOJI =
  /[\u{1F534}-\u{1F535}\u{1F7E0}-\u{1F7EB}\u{26AA}\u{26AB}\u{2B1B}\u{2B1C}\u{2764}\u{1F499}-\u{1F49C}\u{1F5A4}\u{1F90D}\u{1F90E}\u{1F9E1}]/gu;
// WHY: emoji such as a red heart carry an invisible variation selector (U+FE0F) that is neither a letter nor a colour.
const VARIATION_SELECTOR = /\u{FE0F}/gu;
const FILLER = new RegExp(
  `(?<!${LETTER})(?:the|a|an|one|option|choice|button|choose|pick|den|det|dei|de|ein|eit|en|et|valet|valget|alternativet|knappen|vel|velg)(?!${LETTER})`,
  'giu',
);

/**
 * Finds a phrase that refers to something by colour alone.
 * @param text - Plain text.
 * @returns The first such phrase as written, or `undefined`.
 */
export function findColourPhrase(text: string): string | undefined {
  return PHRASE.exec(text)?.[0];
}

/**
 * Tells whether a choice's text is nothing but a colour (and filler words such as "the" or «den»).
 * @param text - Plain text of the choice.
 * @returns True for e.g. «Raud», "The green one" or a red circle emoji; false for blank text.
 */
export function isColourOnlyChoice(text: string): boolean {
  const hasColour = text.search(COLOUR_WORD) >= 0 || text.search(COLOUR_EMOJI) >= 0;
  if (!hasColour) return false;
  const rest = text
    .replace(COLOUR_WORD, ' ')
    .replace(COLOUR_EMOJI, ' ')
    .replace(FILLER, ' ')
    .replace(VARIATION_SELECTOR, '');
  return !/[\p{L}\p{N}]/u.test(rest);
}
