# Draft: Lumi issue, the editor's asset list has the picture tool's style and not its script

| | |
|---|---|
| **Recipient** | Lumi's maintainers, repository `Lumieducation/H5P-Nodejs-library` |
| **Channel** | A public GitHub issue (a pull request with the one line is as good, if the owner prefers) |
| **Status** | Needs the owner's check: `master` has not been read for this; if it already lists the file, do not file, and say so in the release request instead |
| **Our records** | D-153; the `UPSTREAM:` tag in `apps/server/src/h5p/h5pAssets.ts` |
| **Checked** | 2026-11-27: `@lumieducation/h5p-server` 10.0.4 from npm (`build/src/editorAssetList.json`); the H5P editor at commit ab2daa18 (the one we pin). `master` not read |

---

## Title

The editor's asset list names `libs/cropper.css` and not `libs/cropper.js`: «Edit image» throws `Cropper is not defined`

## Body

### Versions

- `@lumieducation/h5p-server` 10.0.4.
- H5P editor (`h5p-editor-php-library`) at commit ab2daa18, with H5P Core 1.28.0.
- Chromium 159 (through Playwright 1.65.1), Linux.

### Steps to reproduce

1. Serve the editor with the H5P editor files of a version whose picture tool is the cropper
   (`scripts/h5peditor-image-popup.js` calls `new Cropper(…)`, and `libs/cropper.js` defines it).
2. Open any content type with an image field that has a picture, for example Image Hotspots.
3. Press «Edit image».

### Expected

The picture tool opens: rotate left, rotate right, crop, save.

### Actual

Nothing opens, and the editor's frame reports `Uncaught ReferenceError: Cropper is not defined`.

### Cause

`packages/h5p-server/src/editorAssetList.json` lists the tool's style and the script that uses it:

- `styles.editor` has `libs/cropper.css`;
- `scripts.editor` has `scripts/h5peditor-image-popup.js` and no `libs/cropper.js`.

So the frame that H5P's editor writes (`H5PIntegration.editor.assets.js`) never loads the file that defines
`Cropper`.

### Suggested fix

Add `"libs/cropper.js"` to `scripts.editor`, before `scripts/h5peditor-image-popup.js`.

### Our workaround

We add the file through `customization.global.scripts` of the editor (`editorLibraryFile('libs/cropper.js')`). Our
test `apps/server/test/h5p/H5pFactories.test.ts` («the editor frame loads the picture tool's script …») fails when
a release lists the file, so the workaround is removed then; `apps/server/e2e/editorImageTool.e2e.test.ts` turns,
crops and saves a picture in the real editor.
