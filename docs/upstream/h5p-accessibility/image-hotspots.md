# Draft: H5P accessibility report, H5P.ImageHotspots 1.11

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-image-hotspots` |
| **Channel** | A public GitHub issue on that repository, with H5P's Bug Report form (see the README) |
| **Status** | Ready |
| **WCAG 2.2** | 3.1.2 Language of Parts |
| **Our records** | D-080 (amendments of 2026-10-28 and 2026-10-29, `UPSTREAM_ENGLISH_TEXTS`), D-111, D-112 |
| **Checked** | 2026-11-05 against 1.11.6 (tag 1.11.6, commit adc855f1) |

---

## Title

[Bug]: "Missing required background image" is hard-coded in English and cannot be translated

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 141, through Playwright 1.56.1)
- **Operating system:** Linux (Debian), Ubuntu 24.04

### Versions

- H5P.ImageHotspots 1.11.6 (commit adc855f1); H5P Core 1.28.0; content language Nynorsk (`nn`), the same with any
  other language.
- Chromium 141 (Playwright 1.56.1). Our host runs Lumi's Node.js server; the text comes from the library.

### Steps to reproduce

1. Create an Image Hotspots in a language other than English, without a background image.
2. View it.

### Expected

The message is in the content's language, from a field in `semantics.json` and the language files.

### Actual

`scripts/image-hotspots.js` writes "Missing required background image" into the markup in English. It has no field
in the semantics or the language files, so no translation can reach it.

### Suggested fix

Add the text to `semantics.json` (a field under the library's texts, `common: true`) and the language files, and use
it.

### Our workaround

None in the library. Our content check shows the author a missing background image as an error before publishing (one
the author can acknowledge), so a learner should rarely meet it; the text is listed in our register of upstream
barriers (`apps/server/a11y/support/upstreamRegister.ts`, `UPSTREAM_ENGLISH_TEXTS`). Our test
`upstreamRegister.a11y.test.ts` ("[UD-010] "Missing required background image" is still written by the pinned library,
so its entry still holds") fails once a pinned version stops writing it.
