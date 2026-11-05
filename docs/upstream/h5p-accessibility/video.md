# Draft: H5P accessibility report, H5P.Video 1.6

| | |
|---|---|
| **Recipient** | H5P Group, repository `h5p/h5p-video` |
| **Channel** | A public GitHub issue on that repository, with H5P's Bug Report form (see the README) |
| **Status** | Ready |
| **WCAG 2.2** | 3.1.2 Language of Parts |
| **Our records** | D-080 (amendments of 2026-10-28 and 2026-10-29, `UPSTREAM_ENGLISH_TEXTS`), D-111, D-112 |
| **Checked** | 2026-11-05 against 1.6.80 (tag 1.6.80, commit af25aef6) |

---

## Title

[Bug]: "Video source is missing." is always English: the defaults are merged over the translation

## Body

### Form fields

- **Environment:** Other (Lumi's Node.js H5P server, `@lumieducation/h5p-server` 10.0.4)
- **LMS:** Canvas (the same outside it)
- **Browsers:** Chrome (Chromium 141, through Playwright 1.56.1)
- **Operating system:** Linux (Debian), Ubuntu 24.04

### Versions

- H5P.Video 1.6.80 (commit af25aef6), inside H5P.InteractiveVideo 1.28; H5P Core 1.28.0; content language Nynorsk
  (`nn`), the same with any other language.
- Chromium 141 (Playwright 1.56.1). Our host runs Lumi's Node.js server; the text comes from the library.

### Steps to reproduce

1. Create an Interactive Video in a language other than English, without a video source.
2. View it.

### Expected

The message is in the content's language, from the language file or the `l10n` passed to H5P.Video.

### Actual

`scripts/video.js` merges its English defaults over the `l10n` it is given
(`parameters = $.extend(true, parameters, { l10n: { … } })`, lines 34–53), so the English text wins whatever
translation is passed. A learner sees "Video source is missing." in English in a page in another language, and
assistive technology reads it with that language's pronunciation. The same merge overwrites every other `l10n` text
of H5P.Video (its loading text and its error messages, such as "Media playback has been aborted."), so all of them
are English too; "Video source is missing." is the one we saw on a page.

### Suggested fix

Merge the other way round: the English defaults first, the given `l10n` over them.

### Our workaround

None in the library. Our content check shows the author a missing video as an error before publishing (one the author
can acknowledge), so a learner should rarely meet it; the text is listed in our register of upstream barriers
(`apps/server/a11y/support/upstreamRegister.ts`, `UPSTREAM_ENGLISH_TEXTS`). Our test `upstreamRegister.a11y.test.ts`
("[UD-010] "Video source is missing." is still written by the pinned library, so its entry still holds") fails once a
pinned version stops writing it.
