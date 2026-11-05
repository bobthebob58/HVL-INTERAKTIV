# Draft: H5P accessibility report, the content-type list ("hub") in the editor

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-hub-client` (its build ships in `h5p-editor-php-library` as `scripts/h5p-hub-client.js`) |
| **Channel** | A public GitHub issue on `h5p/h5p-hub-client`, with H5P's Bug Report form (see the README) |
| **Status** | Ready |
| **WCAG 2.2** | 4.1.2 Name, Role, Value; 1.3.1 Info and Relationships |
| **Our records** | D-080 (repair (i), the register's `nested-interactive` entry), D-112 |
| **Checked** | 2026-11-05 against the build in `h5p-editor-php-library` commit ab2daa18 |

---

## Title

[Bug]: Accessibility: hub tabs and content types nest interactive elements, and the content-type list is not a list

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 141, through Playwright 1.56.1)
- **Operating system:** Linux (Debian), Ubuntu 24.04

### Versions

- `h5p-editor-php-library` at commit ab2daa18, `scripts/h5p-hub-client.js` (built from `h5p/h5p-hub-client`); H5P
  Core 1.28.0.
- Chromium 141 (Playwright 1.56.1), axe-core 4.13.0. Our host runs Lumi's Node.js server and lists only the content
  types it allows; the markup comes from the hub client.

### Steps to reproduce

1. Open the editor for new content, so that the content-type list is shown.
2. Run axe on the editor document.

### Expected

No interactive element inside another, and a list whose items are list items (or a group of buttons).

### Actual

1. Each hub tab is an `<li class="h5p-hub-tab-button" role="tab">` that holds the focusable `<a href>` its keyboard
   handling uses, and each content type is an `<li role="button">` that holds its own "Details" button (axe
   `nested-interactive`, serious). Screen readers announce the outer element and may not reach the inner one, or the
   other way round. The hub's CSS lays the tabs out by `[role=tab]` on the `<li>` and `[role=tab] > a`, so a host
   cannot move the role without unstyling them.
2. The content-type list is an `<ol>` whose items are `role="button"`, so it is no list (axe `list`, serious).

### Suggested fix

- Tabs: put `role="tab"` on the focusable element itself (the link or a button) and make the `<li>`
  `role="presentation"`; style by a class.
- Content types: make the item a list item that holds two separate buttons (choose, details), or one button with the
  details reached another way.
- Keep the `<ol>` a list once its items are list items again, or name it as a group.

### Our workaround

`packages/hvl-h5p-theme/src/a11yEditorRepairs.js` makes the content-type list a group named by its heading. The
nested tabs and content types cannot be repaired by attributes without removing a control, so they stay in our
register of upstream barriers (`apps/server/a11y/support/upstreamRegister.ts`), which our accessibility suite prints
in every run. Our tests: `a11yEditorRepairs.test.ts`; `a11yRepairs.browser.int.test.ts` ("[UD-006] the hub: a
content type is still chosen with the arrow keys and Space from its named group"); `axeEditor.a11y.test.ts`;
`upstreamRegister.a11y.test.ts`.
