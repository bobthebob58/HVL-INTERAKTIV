/**
 * feedbackTargetList — reads the entries of src/feedbackTargets.json for the prefix generator: which element shows a
 * correct or incorrect answer, where its visible prefix goes and whether the library draws its own ✓/✗ icon.
 *
 * Why: UD-003 asks for an icon and a text prefix on every answer state, also inside containers (QuestionSet,
 *      CoursePresentation, InteractiveVideo and Column offer TrueFalse, MarkTheWords, SingleChoiceSet, Summary,
 *      MultiMediaChoice and ImageHotspotQuestion as sub-content). Libraries differ: most leave the `::before` of
 *      some element free, so the prefix is drawn there; ImageHotspotQuestion's mark is a fixed-size circle that the
 *      image clips, so its label is the image's `::after` (`prefixPseudo: "after"`), placed beside the circle by
 *      the theme; TrueFalse, Summary and MultiMediaChoice use both pseudo-elements of the answer (or lay it out so
 *      a pseudo-element cannot hold text), so for them the script's label itself is shown (`prefixOn: "label"`).
 *      Some states exist only as `correct` (a missed word in MarkTheWords), so an entry may name one state.
 * Spec: UD-003
 * Invariants:
 *   - Every entry names at least one state; every selector is non-empty and has no quote or backslash, so it is safe
 *     inside a CSS string.
 *   - `prefixOn: "label"` requires `ownIcon: true`: shown text is the label alone, never an icon character that a
 *     screen reader would announce. It takes no `prefixPseudo`, since nothing is drawn.
 *   - `prefixPseudo` is `before` (the default) or `after`.
 *   - A selector list (with a comma) is wrapped in `:is()` before the pseudo-element is added, so every item gets it.
 * Collaborators: ./buildFeedbackPrefixes.mjs, ../src/feedbackTargets.json, ../src/feedbackPrefixes.js.
 * Tests: packages/hvl-h5p-theme/test/feedbackPrefixesCss.test.ts
 */

/** The two answer states, in output order. */
export const STATES = Object.freeze(['correct', 'incorrect']);
/** `prefixOn` value of an entry whose label the script shows as text instead of a `::before` prefix. */
export const LABEL_MODE = 'label';
/** The pseudo-elements a visible prefix may use; the first is the default. */
export const PSEUDOS = Object.freeze(['before', 'after']);
/** Characters that would end or escape a CSS string. */
export const UNSAFE_IN_CSS_STRING = /['"\\]/;

/**
 * Checks one selector.
 * @param {unknown} selector - The value from the JSON file.
 * @param {string} library - For the error message.
 * @throws {Error} When the selector is missing, empty or unsafe in a CSS string.
 */
function checkSelector(selector, library) {
  if (typeof selector !== 'string' || selector.trim() === '' || UNSAFE_IN_CSS_STRING.test(selector)) {
    throw new Error(`${library} has a missing or unsafe selector: ${selector}`);
  }
}

/**
 * Checks the target list and returns its entries.
 * @param {{targets?: unknown}} targets - Parsed src/feedbackTargets.json.
 * @returns {{library: string, correct?: string, incorrect?: string,
 *   prefixOn?: 'label' | {correct?: string, incorrect?: string}, prefixPseudo?: 'before' | 'after',
 *   ownIcon: boolean}[]} The entries.
 * @throws {Error} When an entry names no state, a selector is missing or unsafe, `ownIcon` is unclear or
 *   `prefixPseudo` is unknown.
 */
export function targetEntries(targets) {
  const entries = targets?.targets;
  if (!Array.isArray(entries) || entries.length === 0)
    throw new Error('feedbackTargets.json lists no targets');
  for (const entry of entries) {
    const library = entry.library ?? 'a target';
    const states = STATES.filter((state) => entry[state] !== undefined);
    if (states.length === 0) throw new Error(`${library} names neither a correct nor an incorrect state`);
    if (typeof entry.ownIcon !== 'boolean') throw new Error(`${library} must say ownIcon`);
    if (entry.prefixOn === LABEL_MODE && !entry.ownIcon) {
      throw new Error(`${library}: a shown label needs the library's own icon (ownIcon: true)`);
    }
    const pseudo = entry.prefixPseudo;
    if (pseudo !== undefined && (!PSEUDOS.includes(pseudo) || entry.prefixOn === LABEL_MODE)) {
      throw new Error(`${library}: prefixPseudo must be before or after, and a shown label draws none`);
    }
    for (const state of states) {
      checkSelector(entry[state], library);
      if (entry.prefixOn !== LABEL_MODE) checkSelector(entry.prefixOn?.[state] ?? entry[state], library);
    }
  }
  return entries;
}

/**
 * The elements that get the script's label for one state.
 * @param {ReturnType<typeof targetEntries>} entries - Checked entries.
 * @param {'correct' | 'incorrect'} state - The state.
 * @param {{shownOnly?: boolean}} [options] - Only the entries whose label is shown as text.
 * @returns {string[]} Selectors.
 */
export function stateTargets(entries, state, { shownOnly = false } = {}) {
  return entries
    .filter((e) => e[state] !== undefined && (!shownOnly || e.prefixOn === LABEL_MODE))
    .map((e) => e[state]);
}

/**
 * The pseudo-element selectors of the visible prefixes for one state (`::before`, or `::after` where the entry
 * says so).
 * @param {ReturnType<typeof targetEntries>} entries - Checked entries.
 * @param {'correct' | 'incorrect'} state - The state.
 * @param {boolean} ownIcon - The entries whose library draws its own icon, or the others.
 * @returns {string[]} Selectors ending in `::before` or `::after`.
 */
export function prefixSelectors(entries, state, ownIcon) {
  return entries
    .filter((e) => e[state] !== undefined && e.ownIcon === ownIcon && e.prefixOn !== LABEL_MODE)
    .map((e) => {
      const selector = e.prefixOn?.[state] ?? e[state];
      return `${selector.includes(',') ? `:is(${selector})` : selector}::${e.prefixPseudo ?? PSEUDOS[0]}`;
    });
}
