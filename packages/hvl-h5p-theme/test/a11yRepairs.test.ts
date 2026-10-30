/**
 * Tests for the content types' markup repair script (src/a11yRepairs.js) in a simulated document (jsdom), on markup
 * copied from the real libraries (D-078): each barrier gets its name, role or level, the repair follows H5P's later
 * changes, a second copy does nothing and the script changes no node, handler or focus order. The editor's repairs:
 * ./a11yEditorRepairs.test.ts. Real H5P in Chromium and keyboard operation:
 * apps/server/test/h5p/a11yRepairs.browser.int.test.ts; axe: the suites in apps/server/a11y/.
 *
 * Spec: UD-030, UD-006
 */
import { describe, expect, it } from 'vitest';
import { codeOf, openRepairDocument, repairScript } from './support/repairDocument.js';

const SCRIPT = repairScript('a11yRepairs.js');

/** CoursePresentation 1.28's progress bar and a slide (slide 1 missing, like its summary slide), DragText 1.10's
 * drop zone and H5P.Question 1.5's explanation of a checked answer (explainer.js). */
const PLAYER = `<div class="h5p-course-presentation"><div class="h5p-progressbar" role="tablist" aria-label="Vel sida">
  <div class="h5p-progressbar-part h5p-progressbar-part-selected" id="p0" role="tab" aria-label="Tre fasar" aria-controls="slide-0" aria-selected="true"><a href="#" tabindex="0"><span class="h5p-progressbar-part-title"></span></a></div>
  <div class="h5p-progressbar-part" id="p1" role="tab" aria-label="Vurdering" aria-controls="slide-1" aria-selected="false"><a href="#" tabindex="-1"><span class="h5p-progressbar-part-title">Vurdering er ikkje fullført.</span></a></div>
</div><div class="h5p-slide" id="slide-0" role="tabpanel" aria-labelledby="p0"></div></div>
<div class="h5p-dropzone"><div aria-dropeffect="none" aria-label="Sleppsone 1 er tom." tabindex="-1" id="zone"></div></div>
<div class="h5p-question-explanation-container"><div class="h5p-question-explanation-title" role="heading" id="explained">Forklaring</div><ul class="h5p-question-explanation-list"><li class="h5p-question-explanation-item">Celle</li></ul></div>`;

const openDocument = (body: string) => openRepairDocument(SCRIPT, body);

describe('the H5P content markup repair script', () => {
  it("[UD-030] turns CoursePresentation's progress bar into a list of named links, the current one marked", () => {
    // Arrange
    const { attr } = openDocument(PLAYER);
    // Act
    const roles = [attr('.h5p-progressbar', 'role'), attr('#p0', 'role'), attr('#p1', 'role')];
    // Assert
    expect(roles).toEqual(['list', 'listitem', 'listitem']);
    expect([attr('#p0', 'aria-selected'), attr('#p1', 'aria-selected')]).toEqual([null, null]);
    expect([attr('#p0 > a', 'aria-current'), attr('#p1 > a', 'aria-current')]).toEqual(['step', null]);
    expect([attr('#p0 > a', 'aria-label'), attr('#p1 > a', 'aria-label')]).toEqual(['Tre fasar', null]);
    // WHY: H5P.Tooltip shows the part's aria-label, so it stays; only a reference to a missing slide goes.
    expect(attr('#p0', 'aria-label')).toBe('Tre fasar');
    expect([attr('#p0', 'aria-controls'), attr('#p1', 'aria-controls')]).toEqual(['slide-0', null]);
    // WHY: a tab panel without a tab; the slide stays named by its part.
    expect([attr('#slide-0', 'role'), attr('#slide-0', 'aria-labelledby')]).toEqual(['group', 'p0']);
  });

  it('[UD-030] follows the slide change and the task text CoursePresentation writes later', async () => {
    // Arrange
    const { $, attr, settle } = openDocument(PLAYER);
    // Act: what navigation-line.js does on a slide change and when a task is answered
    $('#p0').classList.remove('h5p-progressbar-part-selected');
    $('#p0').setAttribute('aria-selected', 'false');
    $('#p1').classList.add('h5p-progressbar-part-selected');
    $('#p1').setAttribute('aria-selected', 'true');
    $('#p0 .h5p-progressbar-part-title').textContent = 'Tre fasar er fullført.';
    await settle();
    // Assert
    expect([attr('#p0 > a', 'aria-current'), attr('#p1 > a', 'aria-current')]).toEqual([null, 'step']);
    expect([attr('#p0', 'aria-selected'), attr('#p1', 'aria-selected')]).toEqual([null, null]);
    expect(attr('#p0 > a', 'aria-label')).toBeNull();
  });

  it("[UD-030] gives DragText's drop zones a group role and keeps their names", () => {
    const { attr } = openDocument(PLAYER);
    expect([attr('#zone', 'role'), attr('#zone', 'aria-label')]).toEqual(['group', 'Sleppsone 1 er tom.']);
  });

  it("[UD-030] gives H5P.Question's explanation title a heading level, also when H5P writes it later", async () => {
    // Arrange
    const { document, attr, settle } = openDocument(PLAYER);
    const first = attr('#explained', 'aria-level');
    // Act: Check in DragText writes a new explanation (explainer.js createHTML)
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div class="h5p-question-explanation-title" role="heading" id="later">Forklaring</div>',
    );
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div class="h5p-question-explanation-title" role="heading" aria-level="3" id="own">Forklaring</div>',
    );
    await settle();
    // Assert
    expect([first, attr('#later', 'aria-level')]).toEqual(['2', '2']);
    expect(attr('#own', 'aria-level')).toBe('3');
    expect(attr('#explained', 'role')).toBe('heading');
  });

  it('[UD-030] gives BranchingScenario\'s default start and end pictures alt="", and leaves an author\'s image as H5P wrote it', async () => {
    // Arrange: genericScreen.js of BranchingScenario 1.10, without a start image (the end screen comes later)
    const library = '/h5p/libraries/H5P.BranchingScenario-1.10/dist/assets';
    const { document, attr, settle } = openDocument(
      `<div class="h5p-screen-background"><div class="h5p-screen-banner"></div><img class="h5p-background-image" src="${library}/start-screen-default.jpg" id="start"></div>
<img class="h5p-background-image" src="/h5p/content/1/images/own.jpg" id="own">
<img class="h5p-background-image" src="${library}/end-screen-default.jpg" aria-label="Avslutning" id="labelled">`,
    );
    // Act
    document.body.insertAdjacentHTML(
      'beforeend',
      `<img class="h5p-background-image" src="${library}/end-screen-default.jpg" id="end">`,
    );
    await settle();
    // Assert
    expect([attr('#start', 'alt'), attr('#end', 'alt')]).toEqual(['', '']);
    expect([attr('#own', 'alt'), attr('#labelled', 'alt')]).toEqual([null, null]);
  });

  it('[UD-030] is idempotent: a second copy and later changes write nothing more', async () => {
    // Arrange
    const { window, document, settle } = openDocument(PLAYER);
    const before = document.body.innerHTML;
    const writes: string[] = [];
    new window.MutationObserver((records) =>
      records.forEach((r) => writes.push(`${r.type} ${r.attributeName ?? ''}`)),
    ).observe(document.body, { subtree: true, attributes: true, childList: true });
    // Act
    window.eval(SCRIPT);
    document.querySelector('#zone')!.setAttribute('aria-label', 'Sleppsone 1 er tom.');
    await settle();
    // Assert
    expect(document.body.innerHTML).toBe(before);
    expect(writes).toEqual(['attributes aria-label']);
  });

  it('[UD-030] runs under the strict H5P policy and never adds nodes, handlers or focus stops', () => {
    const code = codeOf(SCRIPT);
    expect(code).not.toMatch(/\beval\s*\(|new Function|innerHTML|insertAdjacentHTML|addEventListener/);
    expect(code).not.toMatch(/appendChild|insertBefore|\.remove\(\)|createElement|tabindex|tabIndex|focus\(/);
    expect(code).not.toMatch(/\.on[a-z]+\s*=|classList\.(add|remove|toggle)|\binert\b/);
  });
});
