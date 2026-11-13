# Draft: Lumi release request

| | |
|---|---|
| **Recipient** | Lumi's maintainers, repository `Lumieducation/H5P-Nodejs-library` |
| **Channel** | A GitHub issue (or a discussion, if the maintainers prefer them for release questions) |
| **Status** | Ready. The owner fills in the bracketed parts and chooses the account (D-112) |
| **Our records** | D-002, D-030, D-081, D-112; risks R-01, R-08, R-09; spec 01 §1 (F1–F3) |
| **Checked** | 2026-11-05: npm `latest` is 10.0.4; `master` at 493cd3e (2026-10-13) |

Before filing, check again: `npm view @lumieducation/h5p-server version time` and the newest commit on `master`. If
a release has appeared, do not file this; open a decision to upgrade instead (D-112).

---

## Title

Request: a release with the file-security and H5P Core 1.28 work on `master`

## Body

Hello, and thank you for `@lumieducation/h5p-server`.

We use it at [HVL, Western Norway University of Applied Sciences, in the project HVL Interaktiv: an H5P service for
teachers, used from Canvas through LTI 1.3 and on its own site]. We pin exact versions and run only released code
that we have reviewed, so we are on 10.0.4, the newest version on npm (published 2025-03-08). `master` has moved a
long way since then (about 620 commits when we counted on 2026-10-24), and several of its changes are ones we need.
Would you consider publishing a release from `master`?

### Environment

- `@lumieducation/h5p-server` 10.0.4 with `@lumieducation/h5p-svg-sanitizer`, `h5p-clamav-scanner` and
  `h5p-redis-lock` 10.0.4, on Node.js 24 and Express 5 with our own routes on `H5PAjaxEndpoint` (we do not use
  `h5p-express`).
- H5P Core `h5p-php-library` tag 1.28.0 (commit 2aeb0b83) and the editor client at
  `h5p-editor-php-library` commit ab2daa18, the commit `master`'s own setup uses.
- The new Hub, `hub-api.h5p.org`.

### What on `master` we would use

Read at commit 493cd3e:

1. **File security.** The buffer sanitizer and malware-scanner interface (#4600), and the later changes to how SVG
   uploads are handled. By the commit log (read 2026-10-24), SVG uploads with an XML prolog are accepted (a commit
   of 2026-10-04), and packages with unsatisfied library dependencies are refused (#4625).
2. **H5P Core 1.28 and the new Hub.** The player and editor asset lists include Core 1.28's theme styles
   (`h5p-fonts.css`, `h5p-theme.css`, `h5p-theme-variables.css`; commit 28e35fd); `local_id` is at most 15
   characters, as the new Hub requires (commit fcc7063); and the site registration accepts the Hub's 2xx answers
   other than 200.
3. **`image-size`.** `master` depends on `probe-image-size` instead of `image-size` 1.x. Every `image-size` version
   up to 2.0.2 is affected by GHSA-5p2g-fcmc-qvqq and GHSA-w3rx-r6r6-pgpr, and 10.0.4 cannot take the fixed 2.0.3
   (its API changed). We accept these two advisories in our audit until **2027-01-31**; a release would end that.

### What a release would let us remove

| Our workaround for 10.0.4 | Made unnecessary by |
|---|---|
| A short `local_id` passed through `getLocalIdOverride`, and a site UUID set before the editor starts, so 10.0.4 never sends its registration | fcc7063 and the registration change in item 2 |
| Injecting Core 1.28's three theme stylesheets into the player and the editor | 28e35fd |
| A workaround in how we hand SVG uploads to 10.0.4's sanitizer (our stricter pipeline around it stays) | The SVG changes on `master` (item 1) |
| Two audit exceptions for `image-size` | `probe-image-size` (item 3) |

Each workaround is in our code with a comment that names the 10.0.4 source it works around. Two have a test that
fails when a new version makes them unnecessary (`H5pFactories.test.ts` for the theme styles,
`lumiSvgSanitizer.test.ts` for the SVG copy); the `local_id` is checked by `H5pConfigFactory.test.ts`, and the audit
exceptions carry an expiry date in our audit exception list.

### Our question

- Could you publish a release from `master` (a new major version is fine for us)?
- If a release from `master` is far off, for example because of the ESM migration we saw planned there, would a
  10.0.x patch release with items 2 and 3 be possible?
- Is there a list of the changes on `master` that integrators must adapt to? We saw that the malware-scanner
  interface gained `scanBuffer` and that `h5p-clamav-scanner` changed with it.

[Only if the owner has sent the private report first: We have also written to your security address about other
findings.]

We will report the two bugs we found in 10.0.4 that are still on `master` separately:
`deleteAllContentUserDataByUser` deletes the acting user's state, and `alterLibraryLanguageFile` drops
`libraryStrings` [links once filed].

Thank you!
