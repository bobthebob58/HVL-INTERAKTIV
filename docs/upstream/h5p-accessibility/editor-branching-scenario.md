# Draft: H5P accessibility report, H5PEditor.BranchingScenario 1.5

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-editor-branching-scenario` |
| **Channel** | A public GitHub issue on that repository, with H5P's Bug Report form (see the README) |
| **Status** | Ready |
| **WCAG 2.2** | 2.4.3 Focus Order; 2.4.7 Focus Visible; 4.1.2 Name, Role, Value; 1.4.3 Contrast (Minimum) |
| **Our records** | D-080 (repair (j), amendment THEME-V3, the register's `color-contrast` entry), D-112 |
| **Checked** | 2026-11-05 against 1.5.13 (tag 1.5.13, commit 8fcd92d0) |

---

## Title

[Bug]: Accessibility: the guided tour leaves faded controls reachable, and the disabled "Paste" item is disabled by a class only

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 141, through Playwright 1.56.1)
- **Operating system:** Linux (Debian), Ubuntu 24.04

### Versions

- H5PEditor.BranchingScenario 1.5.13 (commit 8fcd92d0) with H5P.BranchingScenario 1.10.1; H5P Core 1.28.0 and the
  editor client at `h5p-editor-php-library` commit ab2daa18.
- Chromium 141 (Playwright 1.56.1), axe-core 4.13.0, also with forced colours. Our host runs Lumi's Node.js server;
  the markup comes from the library.

### Steps to reproduce

1. Create a new Branching Scenario in the editor, in a browser that has not seen the guided tour.
2. While the tour shows a step, press Tab repeatedly.
3. Close the tour and run axe on the editor document, with nothing copied to the clipboard.

### Expected

- While the tour shows a step, the parts it fades cannot take focus or be read, as they cannot be clicked
  (`pointer-events: none`); focus stays in the tour's dialog.
- An unavailable "Paste" item is announced as unavailable (`aria-disabled="true"` or a disabled button), and then
  needs no text contrast.

### Actual

1. The tour fades the rest of the editor with `.tour-fade` (`opacity: .15; pointer-events: none`,
   `src/scripts/components/Editor.scss`), but the faded controls stay in the Tab order and in the accessibility tree,
   so keyboard focus moves onto controls that are all but invisible, with an all but invisible focus ring.
2. The reuse toolbar's "Paste" item is `<li class="reuse-question disabled">`: unavailable by a class and
   `opacity: .5` only. Assistive technology does not hear that it is unavailable, and axe counts its text as that of
   an active control: 3.99 : 1, and 3.94 : 1 under forced colours, which keep the opacity (`color-contrast`,
   serious).

### Suggested fix

- Make the faded parts `inert` while the tour shows a step (and give them back when it ends), or move focus into the
  tour's dialog and keep it there.
- Mark the unavailable "Paste" item with `aria-disabled="true"` (or make it a `<button disabled>`).

### Our workaround

`packages/hvl-h5p-theme/src/a11yEditorRepairs.js` makes each part with `.tour-fade` `inert` while it has the class
and gives back only what it made inert. The "Paste" item is not repaired: it stays in our register of upstream
barriers (`apps/server/a11y/support/upstreamRegister.ts`), which our accessibility suite prints in every run.

Our tests: `a11yRepairsTour.test.ts`; `branchingTour.browser.int.test.ts`; `axeEditor.a11y.test.ts` (the editor with
the tour open and after it, in both colour modes); `upstreamRegister.a11y.test.ts`.
