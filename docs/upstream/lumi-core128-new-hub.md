# Draft: Lumi issue, H5P Core 1.28 and the new Hub in 10.0.x (file only if no release is coming)

| | |
|---|---|
| **Recipient** | Lumi's maintainers, repository `Lumieducation/H5P-Nodejs-library` |
| **Channel** | A public GitHub issue |
| **Status** | Needs the owner's check: file it only if Lumi declines the release request or does not answer it within about four weeks. `master` already fixes all three points, so the issue asks for a 10.0.x backport, not for a fix |
| **Our records** | Spec 01 §1 (F1–F3), `docs/reference/h5p-core-1.28-seed-packages/README.md` §4, D-047, D-081, D-112; CLAUDE.md §5 |
| **Checked** | 2026-11-05: 10.0.4 from npm; `master` at 493cd3e |

---

## Title

10.0.x with H5P Core 1.28 and `hub-api.h5p.org`: three incompatibilities fixed on `master` but not released

## Body

### Environment

- `@lumieducation/h5p-server` 10.0.4 (npm), configured for `coreApiVersion` 1.28 and the Hub endpoints
  `https://hub-api.h5p.org/v1/content-types/` and `https://hub-api.h5p.org/v1/sites`.
- H5P Core `h5p-php-library` tag 1.28.0 (commit 2aeb0b83); editor client at `h5p-editor-php-library` commit
  ab2daa18. Node.js 24.

### Steps to reproduce, expected and actual

1. **`local_id` length.** Start the editor with the default `getLocalIdOverride`. 10.0.4 sends `machineIdSync()`,
   64 hexadecimal characters, as `local_id` (`ContentTypeCache.js` line 246 in the build). *Expected:* at most 15
   characters, the new Hub's limit. *Actual:* 64. `master` truncates to 15 (commit fcc7063).
2. **Site registration answer.** Register at `https://hub-api.h5p.org/v1/sites`. The new Hub answers with a 2xx
   status other than 200. *Expected:* any 2xx is accepted. *Actual:* 10.0.4 throws `error-registering-at-hub`
   because it checks `response.status !== 200` (`ContentTypeCache.js` lines 181–186; the content-type list call has
   the same check at line 94). `master` relies on the HTTP client's own 2xx check.
3. **Core 1.28's theme styles.** Render a player or the editor with Core 1.28. *Expected:* the asset lists include
   `styles/h5p-fonts.css`, `styles/h5p-theme.css` and `styles/h5p-theme-variables.css`, as Core 1.28's
   `H5PCore::$styles` does (`h5p.classes.php` lines 2084–2093). *Actual:* 10.0.4's `playerAssetList.json` and
   `editorAssetList.json` have none of them, so content is unstyled by Core 1.28's theme. `master` adds them
   (commit 28e35fd), and also `h5p-tooltip.css` and `h5p-table.css` to the editor list.

### Request

A 10.0.x patch release with these three changes, if a release from `master` is not planned soon.

### Our workaround

- A 15-character `local_id` passed through `getLocalIdOverride`, and a site UUID set in the configuration before
  the editor starts, so that 10.0.4 never sends the registration
  (`apps/server/src/h5p/H5pConfigFactory.ts`, `localIdFor`, marked `UPSTREAM:`).
- The three stylesheets are added to the player's and the editor's styles
  (`apps/server/src/h5p/h5pAssets.ts`, `PLAYER_MISSING_CORE_STYLES`, marked `UPSTREAM:`).

Our tests `H5pConfigFactory.test.ts` and `H5pFactories.test.ts` (whose first test fails once a pinned release lists
the stylesheets itself) and `hubCheck.test.ts` cover them.
