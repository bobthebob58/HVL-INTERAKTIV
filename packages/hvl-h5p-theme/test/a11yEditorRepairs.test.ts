/**
 * Tests for the editor's markup repair script (src/a11yEditorRepairs.js) in a simulated document (jsdom), on markup
 * copied from the real libraries (D-078): each barrier of H5P's editor widgets, DragNBar and the hub gets its name,
 * role or label, the repair follows H5P's and React's later changes, a second copy does nothing and the script
 * changes no node, handler or focus order (BranchingScenario's tour, the one exception, is in
 * ./a11yRepairsTour.test.ts). Real H5P in Chromium: apps/server/test/h5p/a11yRepairs.browser.int.test.ts.
 *
 * Spec: UD-030, UD-006
 */
import { describe, expect, it } from 'vitest';
import { codeOf, openRepairDocument, repairScript } from './support/repairDocument.js';

const SCRIPT = repairScript('a11yEditorRepairs.js');

/** The editor's score-range table (its first heading carries H5P's required marker), editor-mode switch, vertical
 * tabs and their forms, hotspot position picker, hub list and DragNBar 1.5's paste button (whose tooltip DragNBar
 * 1.5 leaves in English in nn and nb). */
const EDITOR = `<table class="h5p-editor-table-list h5p-editor-range-list"><thead><tr><th class="h5peditor-required">Poengområde</th><th class="h5peditor-dash"></th><th></th><th>Tilbakemelding</th></tr></thead><tbody>
  <tr><td><div class="h5peditor-input-text">51 %</div><input id="field-from-1" style="display: none"></td><td class="h5peditor-dash">–</td><td><label for="field-to-2"></label><input id="field-to-2"></td><td></td></tr></tbody></table>
<ul class="h5peditor-widget-select" title="Redigeringsmodus"><li class="h5peditor-widget-option h5peditor-widget-active" role="button" tabindex="1" id="w0">Standard</li><li class="h5peditor-widget-option" role="button" tabindex="1" id="w1">Tekstleg</li></ul>
<div class="h5p-vtabs"><div class="h5p-vtabs-container"><ol id="tabs" role="tablist" class="h5p-ul">
  <li class="h5p-vtab-li h5p-current"><div class="h5p-vtab-a" role="tab" tabindex="0" id="t0">1. Quiz</div><div class="vtab-remove-wrapper"><div class="h5peditor-button remove" role="button" tabindex="0" aria-label="Fjern element"></div></div></li>
  <li class="h5p-vtab-li"><div class="h5p-vtab-a" role="tab" tabindex="0" id="t1">2. Blanks</div></li></ol></div></div>
<div class="h5p-vtab-forms"><fieldset role="tabpanel" class="h5p-vtab-form" id="f0"></fieldset></div>
<div class="image-coordinate-selector"><div class="image-coordinate-hotspot"></div><img src="diagram.png" id="picker"></div>
<div class="h5p-hub-content-type-section"><div class="h5p-hub-result-header">Alle innhaldstypar</div><div class="h5p-hub-content-type-list"><ol id="hub"><li id="h5p-blanks" class="h5p-hub-media" tabindex="0" role="button"><button type="button" tabindex="0">Detaljar</button></li></ol></div></div>
<ul class="h5p-dragnbar-ul"><li class="h5p-dragnbar-li"><a href="#" class="h5p-dragnbar-a h5p-dragnbar-text-button" aria-label="Tekst"></a><span class="h5p-dragnbar-tooltip">Tekst</span></li>
  <li class="h5p-dragnbar-li paste-button disabled"><a href="#" class="h5p-dragnbar-a h5p-dragnbar-paste-button" id="paste"></a><span class="h5p-dragnbar-tooltip">Paste</span></li></ul>`;

const openDocument = (body: string) => openRepairDocument(SCRIPT, body);

describe('the H5P editor markup repair script', () => {
  it('[UD-030] names the score range "to" field by the heading, the "from" value and the dash', () => {
    const { labelledBy, attr } = openDocument(EDITOR);
    // WHY: jsdom has no CSS; in Chromium the heading's required marker adds "*" (the browser test checks the name).
    expect(labelledBy('#field-to-2')).toBe('Poengområde 51 % –');
    expect(attr('#field-to-2', 'aria-labelledby')?.split(' ')).toHaveLength(3);
  });

  it('[UD-030] makes the vertical tabs a list of buttons, the open item marked current, their forms plain groups', async () => {
    // Arrange
    const { $, attr, settle } = openDocument(EDITOR);
    const before = [
      attr('#tabs', 'role'),
      attr('#t0', 'role'),
      attr('#t0', 'aria-current'),
      attr('#f0', 'role'),
    ];
    // Act: VerticalTabs' openTab moves h5p-current, addItem appends an item and its form
    $('#t0').parentElement!.classList.remove('h5p-current');
    $('#t1').parentElement!.classList.add('h5p-current');
    $('#tabs').insertAdjacentHTML(
      'beforeend',
      '<li class="h5p-vtab-li"><div class="h5p-vtab-a" role="tab" id="t2">3.</div></li>',
    );
    $('.h5p-vtab-forms').insertAdjacentHTML(
      'beforeend',
      '<fieldset role="tabpanel" class="h5p-vtab-form" id="f2"></fieldset>',
    );
    await settle();
    // Assert
    expect(before).toEqual(['list', 'button', 'true', null]);
    expect([$('#f0').tagName, attr('#f2', 'role')]).toEqual(['FIELDSET', null]);
    expect([attr('#t0', 'aria-current'), attr('#t1', 'aria-current'), attr('#t2', 'role')]).toEqual([
      null,
      'true',
      'button',
    ]);
    expect(attr('#t0', 'tabindex')).toBe('0');
  });

  it('[UD-030] makes the editor-mode switch a named group whose active mode is pressed', async () => {
    const { $, attr, settle } = openDocument(EDITOR);
    expect([
      attr('.h5peditor-widget-select', 'role'),
      attr('#w0', 'aria-pressed'),
      attr('#w1', 'aria-pressed'),
    ]).toEqual(['group', 'true', 'false']);
    $('#w0').classList.remove('h5peditor-widget-active');
    $('#w1').classList.add('h5peditor-widget-active');
    await settle();
    expect([attr('#w0', 'aria-pressed'), attr('#w1', 'aria-pressed')]).toEqual(['false', 'true']);
  });

  it("[UD-030] marks the position picker's copy of the image decorative and keeps an author's alt text", () => {
    const { attr } = openDocument(
      `${EDITOR}<div class="image-coordinate-selector"><img alt="Kart" id="own"></div>`,
    );
    expect([attr('#picker', 'alt'), attr('#own', 'alt')]).toEqual(['', 'Kart']);
  });

  it("[UD-030] gives DragNBar's paste button its tooltip's text and keeps the other buttons' names", () => {
    const { attr } = openDocument(EDITOR);
    expect(attr('#paste', 'aria-label')).toBe('Paste');
    expect(attr('.h5p-dragnbar-text-button', 'aria-label')).toBe('Tekst');
  });

  it("[UD-030] makes the hub's content-type list a group named by its heading, also after React renders a new one", async () => {
    // Arrange
    const { $, labelledBy, attr, settle } = openDocument(EDITOR);
    const before = [attr('#hub', 'role'), labelledBy('#hub')];
    // Act: a search renders a new <ol>
    $('.h5p-hub-content-type-list').innerHTML =
      '<ol id="hub2"><li role="button" tabindex="0">Blanks</li></ol>';
    await settle();
    // Assert
    expect(before).toEqual(['group', 'Alle innhaldstypar']);
    expect([attr('#hub2', 'role'), labelledBy('#hub2')]).toEqual(['group', 'Alle innhaldstypar']);
  });

  it('[UD-030] is idempotent: a second copy and later changes write nothing more', async () => {
    // Arrange
    const { window, document, settle } = openDocument(EDITOR);
    const before = document.body.innerHTML;
    const writes: string[] = [];
    new window.MutationObserver((records) =>
      records.forEach((r) => writes.push(`${r.type} ${r.attributeName ?? ''}`)),
    ).observe(document.body, { subtree: true, attributes: true, childList: true });
    // Act
    window.eval(SCRIPT);
    document.querySelector('#w0')!.setAttribute('role', 'button');
    await settle();
    // Assert
    expect(document.body.innerHTML).toBe(before);
    expect(writes).toEqual(['attributes role']);
  });

  it('[UD-030] runs under the strict H5P policy and never adds nodes, handlers or focus stops', () => {
    const code = codeOf(SCRIPT);
    expect(code).not.toMatch(/\beval\s*\(|new Function|innerHTML|insertAdjacentHTML|addEventListener/);
    expect(code).not.toMatch(/appendChild|insertBefore|\.remove\(\)|createElement|tabindex|tabIndex|focus\(/);
    expect(code).not.toMatch(/\.on[a-z]+\s*=|classList\.(add|remove|toggle)/);
  });
});
