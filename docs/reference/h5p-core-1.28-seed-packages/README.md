# Item 6: H5P Core 1.28 seed packages (status)

Provenance date: 2026-10-21. Prepared for `docs/reference/h5p-core-1.28-seed-packages/` (spec 01, `H5P-003`).
**No `.h5p` package is in this folder yet**: the H5P Hub is blocked by the build container's network policy
(re-checked 2026-10-23: the egress proxy refuses hub-api.h5p.org with 403). When the packages and their
`SHA256SUMS` are here, `npm run seed:libraries` installs them offline, and `npm run hub:check` records the
registration status for F2 (Session 2).

## 1. Summary

- **No seed package was obtained.** The proxy blocks `hub-api.h5p.org` and `h5p.org` (CONNECT 403). It also blocks
  the GitHub REST API, github.com web pages, codeload, wordpress.org and moodle.org. No `.h5p` file published by
  H5P is reachable from here. H5P content-type repositories publish git tags, not `.h5p` release assets that I
  could find. The spec forbids building packages from source.
- **The download request is known.** It is `GET https://hub-api.h5p.org/v1/content-types/<machineName>`, with no
  body and no site UUID. Three independent sources agree: Lumi 10.0.4, the official PHP editor and WordPress
  plugin, and an h5p.org answer from June 2026 (section 3).
- **The script is ready.** `fetch-seed-packages.sh` downloads, checks and hashes the ten packages. It passed
  `bash -n`, a `--dry-run` (no network) and offline tests of its zip checks. It has **not** been run against the Hub.
- **Core 1.28 has a release tag.** It is `h5p-php-library` tag `1.28.0`: annotated by an h5p.group employee on
  2026-03-09 and pointing to commit `2aeb0b83…`. Per-file SHA-256 hashes of the tag are in
  [`h5p-php-library-1.28.0.files.sha256`](h5p-php-library-1.28.0.files.sha256). **The editor has no 1.28 release tag** (section 5).
- **Three findings affect Risk R-01 and `H5P-001`.** With h5p-server 10.0.4: (a) the new Hub rejects the default
  `local_id`, which is longer than 15 characters; (b) site registration fails, because `/v1/sites` answers with a
  2xx status other than 200; (c) the Core 1.28 theme CSS files are not in the player and editor asset lists.
  Lumi has fixed all three on `master`, but those fixes are **not in any release** (section 4).

## 2. Latest known versions compared with our minimums

The Hub is the only authority on what it serves, and I could not reach it. The columns below come from H5P's
own git repositories: the `version` fields in `library.json` (read-only, nothing built). The table gives the
commit and its date for each value. "Feb 2026 bump" comes from Kelly Choi's Moodle forum post of 12 Feb 2026
(<https://moodle.org/mod/forum/discuss.php?d=473262>, as summarised by search; I could not open the full list).

| Machine name | Our min | Feb 2026 bump | `release` branch | `master` | Highest semver tag | Meets min? | Notes |
|---|---|---|---|---|---|---|---|
| H5P.CoursePresentation | 1.27 | 1.26 → 1.27 | **1.27.27** (64640e64fa, 2026-10-01, coreApi 1.28) | same | 1.28.25 (2025-10-16, coreApi 1.27) | yes | Minor version was **lowered 1.28 → 1.27** in dfcde2e (2025-11-17): "Should only bump once per release". The 1.28.x tags are superseded. |
| H5P.InteractiveVideo | 1.28 | 1.27 → 1.28 (medium) | **1.28.37** (bcfa06d2b0, 2026-08-19) | 1.28.37 (2026-10-02) | 1.28.37 | yes | |
| H5P.QuestionSet | 1.21 | 1.20 → 1.21 | 1.20.31 (2025-06-27, stale) | **1.21.14** (a961bacde0, 2026-10-14) | 1.21.13 (2026-09-24) | yes (1.21.x) | `release` branch not updated. |
| H5P.InteractiveBook | 1.12 | 1.11 → 1.12 | **1.15.1** (90efced9d1, 2026-09-14) | same | 1.15.1 | yes | |
| H5P.Column | 1.19 | 1.18 → 1.19 | **1.22.0** (d0a0b7b80f, 2026-06-02) | same | 1.18.8 | yes | Display title is now **"Page"**; the machine name is unchanged. h5p.org (June 2026): "latest version of Column (which is 1.22 currently)". |
| H5P.DragText | 1.10 | not in snippet | **1.10.52** (3d3eb6d759, 2026-08-18) | 1.10.52 (2026-10-02) | 1.10.52 | yes | |
| H5P.MultiChoice | 1.16 | not in snippet | 1.16.14 (2024-09-17, stale) | **1.16.27** (d9c8cd3077, 2026-10-13) | 1.16.14 | yes | An h5p.org report mentions a breaking patch "between versions 1.16.6 and 1.16.27". |
| H5P.Blanks | 1.14 | not in snippet | **1.14.37** (adcc9f886d, 2026-03-09) | 1.14.37 (2026-08-21) | 1.14.13 | yes | |
| H5P.ImageHotspots | 1.10 | not in snippet | **1.11.6** (41ae62bfe3, 2026-05-27) | 1.11.6 (2026-08-28) | 1.11.6 | yes | |
| H5P.BranchingScenario | 1.9 | not in snippet | **1.11.1** (b71cec66c8, 2026-05-27) | 1.11.2 (c17821b98f, 2026-10-14) | 1.10.1 (2026-04-22) | yes | |

Confidence: **high** for what each git ref contains (read directly). **Low** for "this is what the Hub serves".
The one exception is Column 1.22 (**medium**, from one h5p.org forum post). The raw data was collected from read-only shallow clones of each repository on 2026-10-21; re-run
`git ls-remote --tags` on each repository to reproduce it.

**Sub-content and H5P-002.** The `semantics.json` on the `release` branch mentions `H5P.DragQuestion` in
CoursePresentation, InteractiveVideo, QuestionSet and Column. It does not mention it in InteractiveBook or
BranchingScenario. The Hub packages for those four types will therefore probably bundle DragQuestion as a
dependency (low confidence: I have not seen a package). The spec already allows this, and `H5P-002` removes
DragQuestion from the selectors.

## 3. How a content-type package is downloaded from the Hub

### 3.1 The request

```
GET https://hub-api.h5p.org/v1/content-types/<machineName>      e.g. .../content-types/H5P.MultiChoice
→ 200, body = .h5p (zip) with the content type and its dependency libraries
```

| Source | Evidence | Confidence |
|---|---|---|
| @lumieducation/h5p-server 10.0.4 (npm tarball sha256 `3b1e520d…3025`) | `build/src/ContentTypeInformationRepository.js:105`: `this.httpClient.get(this.config.hubContentTypesEndpoint + machineName, { responseType: 'stream' })`. No UUID, no body, **no status check** before the stream is written to a temp `.h5p` file (lines 108-120), then `PackageImporter.installLibrariesFromPackage`. | high |
| H5P core 1.28.0 + editor (tag `moodle-1.28.2`) | `h5p.classes.php:2063` `const CONTENT_TYPES = 'hub-api.h5p.org/v1/content-types/';` · `h5peditor-ajax.class.php:307` `$this->callHubEndpoint(H5PHubEndpoints::CONTENT_TYPES . $machineName)` → `:415` `fetchExternalData(H5PHubEndpoints::createURL($endpoint), NULL, TRUE, …path)`, so the data argument is NULL. | high |
| H5P WordPress plugin (master 0583b6f, 2026-10-20) | `public/class-h5p-wordpress.php:956-971`: `if ($data !== NULL) { // Post … wp_remote_post } else { // Get … wp_safe_remote_get($url, $options) }`. So the official PHP integration downloads with **GET**. | high |
| h5p.org forum, June 2026 (<https://h5p.org/node/1563872>) | "You can get the latest version of Column (which is 1.22 currently) by pointing your browser to https://hub-api.h5p.org/v1/content-types/H5P.Column" (as quoted by search). This means a plain GET with no UUID works on the new Hub. | medium |
| Catharsis (otacke/catharsis, a third-party Hub server) | The client uses `fetch(url, { method: 'POST' })` with no body (`services/h5p-content-type-hub-utils.js:37`). The server accepts **both** GET and POST on `/content-types/:machineName` (`commands/server-process.js:117-118`). | medium (third party) |

The script defaults to GET. If the Hub ever answers 405, run it with `H5P_HUB_METHOD=POST`.

### 3.2 Site registration and the content-type list (needed by the editor's Hub view, not by seeding)

- `POST https://hub-api.h5p.org/v1/sites` (form data). The fields are `uuid` (empty to register), `platform_name`,
  `platform_version`, `h5p_version`, `disabled`, `local_id`, `type` and `core_api_version`. Sources: core
  1.28.0 `h5p.classes.php:2948-2966` and Lumi 10.0.4 `ContentTypeCache.js:212-223`. The response contains `{ uuid }`.
- `POST https://hub-api.h5p.org/v1/content-types/` (x-www-form-urlencoded) with the registration data
  (+ `current_cache` in PHP, `h5p.classes.php:3385-3387`). The response contains `{ contentTypes: [...] }`.
  Lumi reads `entry.id`, `version.{major,minor,patch}`, `coreApiVersionNeeded` and other fields
  (`ContentTypeCache.js:47-72`).
- Catharsis README:384 says of the **old** Hub: "Any UUID can be used. It seems that H5P Group does not limit
  access to a 'valid' id." This has not been verified for hub-api.

### 3.3 Exact procedure once the Hub is reachable

1. Run this on a workstation, or ask IT to allow `hub-api.h5p.org:443` for the build container. The host
   used here (2026-10-21) gets a 403 from the proxy. **Do not run the script here.**
2. From the repository root: `bash tools/seed/fetch-seed-packages.sh --dry-run`, then
   `bash tools/seed/fetch-seed-packages.sh`.
3. For each type, the script runs `GET <hub>/<machineName>` over https only (also for redirects), with a size
   limit of 200 MB (SEC-005). It then checks that:
   - the file has zip magic bytes;
   - no zip entry has an absolute path, `..` or a backslash;
   - the uncompressed size is within the limit;
   - `<machineName>-<maj>.<min>/library.json` is present and names the requested machine name;
   - the version is at least our minimum;
   - `coreApi` is at most 1.28.

   It saves the file as `<machineName>-<maj>.<min>.<patch>.h5p` and writes `SOURCES.tsv` (URL, method,
   HTTP code, UTC time and sha256) and `SHA256SUMS` (`sha256sum *.h5p` format). It never extracts or
   executes any part of a package.
4. Add a provenance row to `docs/reference/README.md` (file, source URL, retrieval date, person) and commit.
5. The seeder (`H5P-003`) should check `SHA256SUMS`. It should then install each package with
   `new PackageImporter(libraryManager, config, permissionSystem).installLibrariesFromPackage(path)`
   (`PackageImporter.js:53, 154-160`). This is the same call the Hub install uses after downloading. Set
   `config.coreApiVersion` to 1.28 **first**: `PackageValidator.js:194-208` rejects any library whose `coreApi` is
   newer than the config, and the default is 1.27 (`H5PConfig.js:34-36`).

## 4. Compatibility findings for h5p-server 10.0.4 and the new Hub (affect Risk R-01)

| # | Finding | Evidence | Confidence | Workaround without patching node_modules |
|---|---|---|---|---|
| F1 | The new Hub limits `local_id` to **15 characters**. By default, 10.0.4 sends `machineIdSync()`, a 64-character hex string (`ContentTypeCache.js:246`). | Lumi master fcc7063 (2026-02-15, "feat: updated content type hub endpoint (#4386)"): "fix(h5p-server): conform to the h5p hub's character limit of local ids", plus `const maxLength = 15` and `machineIdSync().substring(0, maxLength)`. PHP core uses `hash('crc32', …)` (8 characters, `h5p.classes.php:2958`). | medium (one source; the Hub itself was not seen) | Pass `options.getLocalIdOverride: () => '<≤15 chars>'` to `H5PEditor` (`H5PEditor.js:94`, `types.d.ts:2107`). |
| F2 | `/v1/sites` on the new Hub answers with a **2xx status other than 200**. 10.0.4 throws `error-registering-at-hub` if `response.status !== 200` (`ContentTypeCache.js:181-186`). The content-type list call has the same strict check (`:94`). | WordPress plugin changelog 1.17.3: "Accept response sent by the new content type hub (hub-api.h5p.org/v1/sites) affecting new installations"; commit 79235d0 (2026-03-05) changes `=== 200` to `>= 200 && < 300`. Lumi fcc7063 replaced its `status !== 200` checks with try/catch. | medium-high (two repos react to it; exact status code unknown) | Set `config.uuid` beforehand so that `registerOrGetUuid` returns early (`ContentTypeCache.js:177-179`). The list call may still fail if it also returns a non-200 2xx; this is unverified. |
| F3 | The 10.0.4 asset lists lack the Core 1.28 theme CSS. Core 1.28.0 `H5PCore::$styles` (`h5p.classes.php:2084-2093`) adds `styles/h5p-fonts.css`, `h5p-theme.css` and `h5p-theme-variables.css`. 10.0.4's `playerAssetList.json` and `editorAssetList.json` contain none of them. | Lumi master 28e35fd (2026-03-12, "feat: update H5P core from 1.27 to 1.28 (#4424)") adds exactly these files to both lists (plus `h5p-tooltip.css` and `h5p-table.css` to the editor list). | high | Inject them through the player and editor custom-style options, or use a documented `patch-package` patch (R-01 rule). |
| F4 | The upstream fixes are **unreleased**. npm `latest` is still 10.0.4 (published 2025-03-08). Lumi master (493cd3e, 2026-10-13) already defaults to Core 1.28 and `hub-api.h5p.org` (`H5PConfig.ts:35-37, 73-75`). | `npm view @lumieducation/h5p-server`; the shallow clone. | high | Keep the pin (D-002). Note in R-01 that F1-F3 are known. |

Related reports: Moodle 5.2 gets HTTP 405 on `hub-api.h5p.org/v1/sites` (<https://h5p.org/node/1562925>,
<https://github.com/moodlebox/moodlebox/issues/425>), cause not established. Drupal fatal error with
h5p-core 1.28 (`resetHubOrganizationData`), <https://www.drupal.org/i/3578071>.

## 5. Core and editor 1.28 client files

| Item | Location | Identifiers | Notes |
|---|---|---|---|
| **Core 1.28.0** (h5p-php-library) | `https://github.com/h5p/h5p-php-library`, tag `1.28.0`. Lumi downloads `https://github.com/h5p/h5p-php-library/archive/<ref>.zip` (`packages/h5p-examples/download-core.sh`). Packagist `h5p/h5p-core` 1.28.0, dated 2026-03-03 (search). | Tag object `e733dc9496382bd933a3e2205ce2702a7e02876c`, commit `2aeb0b83fa603e331381b3a6b8bf42c3773ba140` (2026-03-03, "Remove required patchVersionInLibraryName feature"), tree `19cec2b377e9c25ba04e84a60e773666c9e3eff2`. Tagger: Maris <maris.akmentins@h5p.group>, 2026-03-09. Message: "Support for new content design and updated H5P Hub endpoints". Not GPG-signed. | No build step: 67 plain files, no `package.json`. `coreApi` 1.28 at `h5p.classes.php:2080-2083`. Lumi master pins the same commit (28e35fd). |
| Local archive of that tag | Made during research with `git archive` (2 263 040 bytes, git 2.43.0, prefix `h5p-php-library-1.28.0/`); not committed | sha256 `70131399a74274f80fd9094fe26826362c25e6ff66dada303f9707522b1d2bba`. Per-file hashes: `h5p-php-library-1.28.0.files.sha256` (67 files; e.g. `js/h5p.js` `8474d16c…4c01`, `h5p.classes.php` `dead4f5b…edb6`). | **Not** a GitHub release asset. I generated it from H5P's annotated tag. The tar hash depends on the git version; the per-file hashes do not, and can be checked against GitHub's zip. |
| Core changes after 1.28.0 | Core `master` 1e21b7a (2026-10-20) | Includes "secfix/AU-8104-wordpress-xss-prevention" (2026-10-20), AU-7859 path-cloning fix, AU-7823 Daylight hover colour and others. **None of these is tagged.** | Owner decision: pin 1.28.0 exactly (spec wording) or wait for 1.28.1. |
| **Editor 1.28** (h5p-editor-php-library) | **No 1.28 release tag exists.** The newest semver tag is `1.25`. Platform tags: `moodle-1.28.2` (73dfed6073…, 2026-06-25, on the `moodle` branch) and `Drupal-7.x-1.29`. The `release`/`stable` branch dates from 2022. | Lumi master pins editor `ab2daa18bd61b19e7f8729e22eec88f3b637a868`, an untagged `master` merge commit (2026-03-11, dependabot PR #343). The WordPress plugin 1.17.10 (2026-10-20) pins editor `9400c71d…` (head of the `wordpress` branch). | The editor commits its compiled CSS (`styles/css/`), so no build is needed. `H5P-001` ("released, versioned 1.28 package; never git master") **cannot be met with a tag**. This needs a `DECISIONS.md` entry. |

## 6. What I could not do or verify

- I could not reach `hub-api.h5p.org`, so the following are unverified: the response shape of
  `/v1/content-types/`, the exact `/v1/sites` status code, whether GET with no UUID works (only the June 2026
  forum quote says so), package sizes, and the versions the Hub actually serves.
- I could not list GitHub Releases (the REST API is blocked for unattached repos) to rule out `.h5p` release
  assets. I found no search evidence that H5P publishes any.
- npm has no H5P-published `.h5p` packages. `h5p-cli` (maintainer maris.akmentins@h5p.group) is a developer
  tool that builds from source, so it is out of scope.
- The rest of the Feb 2026 bump list (IV, DragText, MultiChoice, Blanks, ImageHotspots, BranchingScenario) was not visible in the search snippets.
- **Density vs. the spec:** core 1.28.0 `js/h5p.js:108` reads `let density = H5PIntegration.theme?.density ?? 'large';`,
  and the CSS defines only `.h5p-large` and `.h5p-medium`. The word "Wide" (spec 01 §1, quoting the blog) does
  not appear in the core code. "Wide" may be the UI name for `large`; this is unverified.

## 7. Files

- `docs/reference/h5p-core-1.28-seed-packages/README.md`: this status note.
- [`h5p-php-library-1.28.0.files.sha256`](h5p-php-library-1.28.0.files.sha256): per-file SHA-256 of core tag `1.28.0`
  (67 files). Check the core files you install against it; the tag archive itself is not committed.
- `tools/seed/fetch-seed-packages.sh`: the download, check and hash script (tested with `--dry-run` only).
- The `.h5p` packages, `SOURCES.tsv` and `SHA256SUMS` will appear here when the script is run on a machine that can
  reach `hub-api.h5p.org`.

## Sources

- https://h5p.org/h5p-february-2026-update: the Hub moved to hub-api.h5p.org; "The old Hub (api.h5p.org) will not receive any new updates."
- https://moodle.org/mod/forum/discuss.php?d=473262: the Feb 2026 version bumps (Core 1.27→1.28, Column 1.18→1.19, CoursePresentation 1.26→1.27, InteractiveBook 1.11→1.12, QuestionSet 1.20→1.21).
- https://h5p.org/node/1563872: Column 1.22, and a browser GET to hub-api content-types.
- https://h5p.org/node/1562925 and https://github.com/moodlebox/moodlebox/issues/425: HTTP 405 on /v1/sites.
- https://h5p.org/node/1562122: MultiChoice 1.16.6 → 1.16.27.
- https://root.packagist.org/packages/h5p/h5p-core: h5p-core 1.28.0, 2026-03-03.
- https://help.lumi.education/articles/0242912-h5p-core-version-compatibility: the core versions different platforms ran.
- https://help.h5p.com/hc/en-us/articles/33829345654173-Release-note-February-2026
- https://www.drupal.org/i/3578071
- https://github.com/otacke/catharsis (README "Background")
- https://github.com/Lumieducation/H5P-Nodejs-library/wiki/Communication-with-the-H5P-Hub (wiki commit af2f7f3, 2022)
- Git repositories read anonymously: github.com/h5p/{h5p-php-library, h5p-editor-php-library, h5p-wordpress-plugin, h5p-course-presentation, h5p-interactive-video, h5p-question-set, h5p-interactive-book, h5p-column, h5p-drag-text, h5p-multi-choice, h5p-blanks, h5p-image-hotspots, h5p-branching-scenario}, github.com/Lumieducation/H5P-Nodejs-library, github.com/otacke/catharsis.
