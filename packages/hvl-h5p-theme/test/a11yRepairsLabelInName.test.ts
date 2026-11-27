/**
 * Tests for the two repairs of src/a11yRepairs.js that put the words a control shows into its accessible name
 * (WCAG 2.5.3 Label in Name), in a simulated document (jsdom) on markup copied from the real libraries (D-078):
 * CoursePresentation 1.28's slide-menu button and H5P.Question 1.5's buttons. Real H5P in Chromium:
 * apps/server/test/h5p/a11yRepairs.browser.int.test.ts; axe's rule: the suites in apps/server/a11y/.
 *
 * Spec: UD-030
 */
import { describe, expect, it } from 'vitest';
import { openRepairDocument, repairScript } from './support/repairDocument.js';

const SCRIPT = repairScript('a11yRepairs.js');

/** navigation-line.js: the footer's menu button shows the current slide's title and is labelled by what it does. */
const MENU = `<div class="h5p-course-presentation"><div class="h5p-footer"><div class="h5p-footer-button h5p-footer-toggle-keywords" aria-expanded="false" aria-label="Vis sidemeny" role="button" tabindex="0"><span class="h5p-icon-menu"></span><span class="current-slide-title">Tre fasar</span></div></div></div>`;

const ENGLISH = 'Check the answers. The responses will be marked as correct, incorrect, or unanswered.';
/** question.js `addButton`: the shown word is the button's text, the content's `a11yCheck` its aria-label. */
const BUTTONS = `<div class="h5p-question-buttons h5p-question-visible">
  <button class="h5p-question-check-answer h5p-joubelui-button" aria-label="${ENGLISH}" type="button" id="check">Sjekk</button>
  <button class="h5p-question-show-solution h5p-joubelui-button" aria-label="Sjå løysinga. Oppgåva blir merkt med den rette løysinga." type="button" id="solution">sjå  løysinga</button>
  <button class="h5p-question-try-again h5p-joubelui-button" aria-label="Retry the task." type="button" id="icon"></button>
  <button class="h5p-question-plain h5p-joubelui-button" type="button" id="plain">Vis</button>
</div>`;

const openDocument = (body: string) => openRepairDocument(SCRIPT, body);

describe('the repairs that put a control’s shown words in its name', () => {
  it("[UD-030] names CoursePresentation's slide-menu button by the title it shows and by its own label", () => {
    // Arrange
    const { $, attr } = openDocument(MENU);
    // Act
    const [title, button] = [$('.current-slide-title').id, $('.h5p-footer-toggle-keywords').id];
    // Assert: the title first, then the button itself, whose aria-label a self-reference reads
    expect(title).not.toBe('');
    expect(button).not.toBe('');
    expect(attr('.h5p-footer-toggle-keywords', 'aria-labelledby')).toBe(`${title} ${button}`);
    // WHY: H5P.Tooltip shows the button's aria-label, so the label stays what CoursePresentation wrote.
    expect(attr('.h5p-footer-toggle-keywords', 'aria-label')).toBe('Vis sidemeny');
  });

  it('[UD-030] the slide-menu button’s name follows a new slide and the open menu without another write', async () => {
    // Arrange
    const { window, document, $, attr, settle } = openDocument(MENU);
    const named = attr('.h5p-footer-toggle-keywords', 'aria-labelledby');
    const writes: string[] = [];
    new window.MutationObserver((records) =>
      records.forEach((record) => writes.push(`${record.type} ${record.attributeName ?? ''}`)),
    ).observe(document.body, { subtree: true, attributes: true });
    // Act: what cp.js and navigation-line.js do when the menu opens and the slide changes
    $('.h5p-footer-toggle-keywords').setAttribute('aria-label', 'Skjul sidemeny');
    $('.current-slide-title').textContent = 'Undervegsvurdering';
    await settle();
    // Assert: the references still point at the title and the button; only H5P's own write happened
    expect(attr('.h5p-footer-toggle-keywords', 'aria-labelledby')).toBe(named);
    expect(attr('.h5p-footer-toggle-keywords', 'aria-label')).toBe('Skjul sidemeny');
    expect(writes).toEqual(['attributes aria-label']);
  });

  it('[UD-030] a second slide-menu button in the document gets references of its own', () => {
    // Arrange
    const { document } = openDocument(MENU + MENU);
    // Act
    const names = [...document.querySelectorAll('.h5p-footer-toggle-keywords')].map((button) =>
      button.getAttribute('aria-labelledby'),
    );
    // Assert
    expect(new Set(names).size).toBe(2);
    expect(names.every((name) => name?.split(' ').every((id) => document.getElementById(id)))).toBe(true);
  });

  it('[UD-030] puts the word a question button shows first in its name when its label does not hold it', () => {
    // Arrange
    const { attr } = openDocument(BUTTONS);
    // Act
    const check = attr('#check', 'aria-label');
    // Assert
    expect(check).toBe(`Sjekk. ${ENGLISH}`);
    // WHY: a label that holds the shown words, whatever their case and spacing, is the library's to keep.
    expect(attr('#solution', 'aria-label')).toBe('Sjå løysinga. Oppgåva blir merkt med den rette løysinga.');
    expect([attr('#icon', 'aria-label'), attr('#plain', 'aria-label')]).toEqual(['Retry the task.', null]);
  });

  it('[UD-030] follows the label and the word H5P writes later, and writes nothing when nothing changed', async () => {
    // Arrange
    const { window, document, $, attr, settle } = openDocument(BUTTONS);
    // Act: H5P writes its label again, then shows another word, then a label that holds the shown word
    $('#check').setAttribute('aria-label', ENGLISH);
    await settle();
    const again = attr('#check', 'aria-label');
    $('#check').textContent = 'Kontroller';
    await settle();
    const otherWord = attr('#check', 'aria-label');
    $('#check').setAttribute('aria-label', 'Kontroller svara.');
    await settle();
    const own = attr('#check', 'aria-label');
    const writes: string[] = [];
    new window.MutationObserver((records) => records.forEach((record) => writes.push(record.type))).observe(
      document.body,
      { subtree: true, attributes: true, childList: true },
    );
    window.eval(SCRIPT);
    await settle();
    // Assert
    expect([again, otherWord, own]).toEqual([
      `Sjekk. ${ENGLISH}`,
      `Kontroller. ${ENGLISH}`,
      'Kontroller svara.',
    ]);
    expect(writes).toEqual([]);
  });

  it('[UD-030] a button whose remembered label is gone is named from the label it has, and the next one still is', () => {
    // Arrange: another script took the remembered label away; the button after it has an English label
    const { attr } = openDocument(
      `<div class="h5p-question-buttons"><button aria-label="Sjekk. ${ENGLISH}" data-hvl-named="Sjekk. ${ENGLISH}" id="lost">Sjekk</button>
       <button aria-label="Retry the task." id="next">Prøv igjen</button></div>`,
    );
    // Act
    const names = [attr('#lost', 'aria-label'), attr('#next', 'aria-label')];
    // Assert
    expect(names).toEqual([`Sjekk. ${ENGLISH}`, 'Prøv igjen. Retry the task.']);
  });
});
