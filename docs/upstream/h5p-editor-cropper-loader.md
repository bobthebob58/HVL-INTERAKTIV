# Draft: H5P editor report, «Edit image» needs inline script: a page policy without it gets `Cropper is not defined`

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-editor-php-library` |
| **Channel** | A public GitHub issue, with H5P's Bug Report form (see the README) |
| **Status** | Needs the owner's check: the editor's `master` has not been read for this; if it already loads the file another way, do not file |
| **Our records** | D-153, D-070 (our page policy); the `UPSTREAM:` tag in `apps/server/src/h5p/h5pAssets.ts` |
| **Checked** | 2026-11-28 against the H5P editor at commit ab2daa18 (the one we pin), with H5P Core 1.28.0 and its jQuery 3.5.1. `master` not read |

---

## Title

«Edit image» loads `libs/cropper.js` with jQuery's `dataType: 'script'`, which a Content-Security-Policy without `'unsafe-inline'` refuses: `Cropper is not defined`

## Body

### Versions

- H5P editor (`h5p-editor-php-library`) at commit ab2daa18, with H5P Core 1.28.0 (jQuery 3.5.1).
- Chromium 159 (through Playwright 1.65.1), Linux.

### Steps to reproduce

1. Serve the editor's page with a policy that allows scripts from its own origin and no inline script, for example
   `Content-Security-Policy: script-src 'self'`.
2. Open any content type with an image field that has a picture, for example Image Hotspots.
3. Press «Edit image».

### Expected

The picture tool opens: rotate left, rotate right, crop, save.

### Actual

Nothing opens. The browser reports that an inline script was refused (from `jquery.js`), and then
`Uncaught ReferenceError: Cropper is not defined`.

### Cause

`scripts/h5peditor-image-popup.js` loads the tool's script when the tool is first opened:

```js
var loadScript = function (path, callback) {
  $.ajax({ url: path, dataType: 'script', success: …, async: true });
};
…
loadScript(H5PEditor.basePath + 'libs/cropper.js', …);
```

For a script of the page's own origin, jQuery fetches the text and runs it by adding a `<script>` element with that
text (`globalEval`). That is an inline script, so a policy without `'unsafe-inline'` (or a matching nonce or hash)
refuses it. jQuery still calls `success`, and the tool goes on to `new Cropper(…)`.

### Suggested fix

Load the file as a script element with a `src`, which `script-src 'self'` allows: for example
`document.createElement('script')` with `src` and an `onload` handler, or the same `$.ajax` call with
`crossDomain: true`, which makes jQuery use a script element instead of running the text.

### Our workaround

We keep the policy and load `libs/cropper.js` up front, as one of the editor frame's script files. The tool's own
load is still refused at its first opening, with no effect, since `Cropper` is then defined. Our tests:
`apps/server/test/h5p/H5pFactories.test.ts` (the file is among the editor frame's scripts, and the pinned tool still
loads it this way) and `apps/server/e2e/editorImageTool.e2e.test.ts` (turn, crop and save in the real editor).
