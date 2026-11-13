# Upstream reports: drafts for the owner to file

This folder holds the reports HVL Interaktiv owes the projects it builds on: a release request and bug reports for
Lumi's H5P server (`@lumieducation/h5p-server`), accessibility reports for H5P's libraries, and a few smaller
reports. They are **drafts**. The owner files them, from an account of the owner's choice; no agent files anything
(D-112). Decisions: D-112 and its amendment of 2026-11-05, D-080 (the barrier register), D-081, D-111, D-115.

Rules for every draft:

- English, as the upstream projects work in English.
- No personal data: no names of students or staff, no e-mail addresses, Feide IDs or log lines with them. The owner
  adds the sender's own details only where a bracket asks for them.
- Our tests are named by file and title, without links; our code by its path in this repository.
- Before filing, search the upstream's open and closed issues for the same report, and check the versions again
  (commands at the end). If a newer release already fixes it, do not file; update the record instead.

## Security reports: not in this folder

This repository is public, so a security report written here would be published before its vendor reads it. Two
drafts are security reports and are kept **outside the repository** (D-112's amendment of 2026-11-05). The session
that wrote them (2026-11-05) hands them to the owner outside the repository; if the owner does not have them, they
are redrafted from the private record the owner holds (D-112's amendment of 2026-11-13), not copied into this
folder. The owner sends them
privately, to a security contact the owner has confirmed, never as a public issue first. A public issue, or a copy
here, follows only once the vendor has published a fix or agreed.

| Draft (held privately) | Recipient | Status |
|---|---|---|
| Security report on a fault in the build of two H5P libraries (D-110, D-112) | H5P Group. No security contact is published in the two repositories or in H5P's contribution guide; the draft lists where to look | Needs the owner's check: the contact, and one question the draft names |
| Security report on three findings in Lumi 10.0.4 (D-112) | Lumi, at the address in Lumi's `SECURITY.md` | Needs the owner's check: the address is still current; whether one of the three goes there or into a public issue |

## The drafts

**Ready** means the facts were reproduced or read on 2026-11-05 and the text can be filed as it stands. **Needs the
owner's check** means a decision or a fact only the owner can settle comes first; the draft's table says which.

### Lumi (`Lumieducation/H5P-Nodejs-library`)

| Draft | What it asks | Status |
|---|---|---|
| [lumi-release-request.md](lumi-release-request.md) | A release with `master`'s file-security and Core 1.28 work, which also ends the `image-size` audit exceptions | Ready (the owner fills in two brackets) |
| [lumi-delete-user-data-acting-user.md](lumi-delete-user-data-acting-user.md) | `deleteAllContentUserDataByUser` deletes the acting user's state (D-108) | Ready |
| [lumi-alter-language-file.md](lumi-alter-language-file.md) | `alterLibraryLanguageFile` drops `libraryStrings` and every other key (D-111) | Ready |
| [lumi-core128-new-hub.md](lumi-core128-new-hub.md) | A 10.0.x backport of `master`'s three Core 1.28 and new-Hub fixes (spec 01 §1, F1–F3) | Needs the owner's check: only if the release request is declined or not answered in about four weeks |
| [lumi-small-api-issues.md](lumi-small-api-issues.md) | Eight small API, typing and save-order gaps our `UPSTREAM:` tags work around | Needs the owner's check: whether to file, and as one issue or several |

### H5P (one GitHub repository per library)

H5P takes bug reports as GitHub issues on each library's repository, with the Bug Report form of its organisation
(`h5p/.github`, read at e979edf): a title starting `[Bug]: `, a description and steps to reproduce (both required;
H5P asks for a link to public test content and screenshots where possible), environment, LMS, browsers and operating
system (the last two required), log output, and the Code of Conduct box, which must be ticked. Blank issues are
turned off, so the form is the only way in. Each draft has a "Form fields" block for the choice fields; put its
steps, expected and actual result in "Steps to reproduce", and the rest in "Description". Our server is not public:
where H5P asks for a link to test content, the owner may make a small public example on H5P's own site, or attach
the content as an exported `.h5p` file.

| Draft | Library and version | Barrier (WCAG 2.2) | Status |
|---|---|---|---|
| [course-presentation.md](h5p-accessibility/course-presentation.md) | H5P.CoursePresentation 1.28.25 | Progress bar as a tab list of non-tabs, empty links; bar and footer under 24 px; answered-dot contrast (4.1.2, 1.3.1, 2.5.8, 1.4.11) | Ready |
| [components.md](h5p-accessibility/components.md) | H5P.Components 1.0.99 | Drop zones named without a role; empty-zone border 1.38 : 1; navigation cuts its buttons (4.1.2, 1.4.11, 2.5.8) | Ready |
| [question.md](h5p-accessibility/question.md) | H5P.Question 1.5.47 | Explanation title without `aria-level` (1.3.1, 4.1.2) | Ready |
| [branching-scenario.md](h5p-accessibility/branching-scenario.md) | H5P.BranchingScenario 1.10.1 | Default start and end pictures without `alt` (1.1.1) | Ready |
| [editor-branching-scenario.md](h5p-accessibility/editor-branching-scenario.md) | H5PEditor.BranchingScenario 1.5.13 | Tour leaves faded controls reachable; "Paste" disabled by a class only (2.4.3, 2.4.7, 4.1.2, 1.4.3) | Ready |
| [editor-mode-switch.md](h5p-accessibility/editor-mode-switch.md) | H5P editor, `h5p-editor-php-library` ab2daa18 | Mode switch: no keyboard, `tabindex="1"`, state by colour (2.1.1, 2.4.3, 4.1.2, 1.4.1) | Ready |
| [hub-client.md](h5p-accessibility/hub-client.md) | `h5p/h5p-hub-client` (in the editor at ab2daa18) | Nested interactive tabs and content types; list that is no list (4.1.2, 1.3.1) | Ready |
| [editor-vertical-tabs.md](h5p-accessibility/editor-vertical-tabs.md) | H5PEditor.VerticalTabs 1.3.16 | Tab list holding other buttons; no Enter (2.1.1, 4.1.2, 1.3.1) | Ready |
| [editor-range-list.md](h5p-accessibility/editor-range-list.md) | H5PEditor.RangeList 1.0.13 | Score range "to" field without a label (1.3.1, 4.1.2, 3.3.2) | Ready |
| [editor-image-coordinate-selector.md](h5p-accessibility/editor-image-coordinate-selector.md) | H5PEditor.ImageCoordinateSelector 1.2.7 | Hotspot position by pointer only; image without `alt` (2.1.1, 1.1.1) | Ready |
| [drag-n-bar.md](h5p-accessibility/drag-n-bar.md) | H5P.DragNBar 1.5.23 | Paste button without a name (4.1.2, 2.4.4) | Ready |
| [video.md](h5p-accessibility/video.md) | H5P.Video 1.6.80 | "Video source is missing." always English (3.1.2) | Ready |
| [image-hotspots.md](h5p-accessibility/image-hotspots.md) | H5P.ImageHotspots 1.11.6 | "Missing required background image" not translatable (3.1.2) | Ready |
| [interactive-video.md](h5p-accessibility/interactive-video.md) | H5P.InteractiveVideo 1.28.37 | End screen: a scored question's summary always English, a misnamed key (3.1.2) | Ready |
| [h5p-questionset-retry-several-sets.md](h5p-questionset-retry-several-sets.md) | H5P.QuestionSet 1.21.13 | Not a barrier: "Retry" throws when a page holds several sets (D-115, Q20) | Ready |

These cover every entry of D-080's register (`apps/server/a11y/support/upstreamRegister.ts`: its two findings and
three English texts; InteractiveVideo's was found by D-111's review and added at step 7's integration), every run-time repair of `a11yRepairs.js` and `a11yEditorRepairs.js`, the theme's upstream
contrast and target-size rules, and the keyboard barriers that axe cannot see (D-080; the manual test protocol §8).

Texts H5P lacks in Nynorsk and Bokmål (for example DragNBar's "Paste") are not issues. H5P's contribution guide
asks for a pull request to the library's language files (`language/nn.json`, `language/nb.json`). D-111's drafts in
`content/h5p-tekstar/` are the source, once HVL's language advisers and ALU have reviewed them (Q2, Q17).

### Other upstreams

| Draft | Recipient | Status |
|---|---|---|
| [clamscan-tls-and-stderr.md](clamscan-tls-and-stderr.md) | `kylefarris/clamscan`: TLS without SNI; errors on stderr without debug mode | Needs the owner's check: whether to file (outside D-112's first list) |
| [ltijs-launch-storage.md](ltijs-launch-storage.md) | `Cvmcosta/ltijs`: the launch page's unguarded `localStorage.removeItem` (D-050) | Needs the owner's check: whether to file, and whether to add the eager database drivers |

Not drafted: `UPSTREAM:` tags that record how pinned upstream code works rather than a fault (D-080's V2D-5
amendment, (b)), such as the Next.js router note in `apps/web/src/features/lti/ltikFromAddress.ts`, the
`openid-client` note in our tests, the editor-widget notes in `apps/server/src/h5p/render/client/`, the editors' UI
flags in `apps/server/src/http/routes/userDataRoutes.ts`, the Lumi patterns we keep in step (`pasteSourcePaths.ts`,
`contentFileReferences.ts`, `safeCopyName.ts`, `savedForm.ts`, `libraryReferences.ts`) and the validator's models of
how players order and show content (`apps/server/src/validation/`); the theme's restyling of libraries' own feedback
colours with HVL's tokens (`hvl-h5p-feedback.css`, a brand choice, not a barrier); and its note on how axe reads text
colour under forced colours (`hvl-h5p-theme.css`, a measurement matter).

## After filing: where each link goes

Put the issue's link where the next reader looks for it; until then the code says "no issue filed yet".

| Filed draft | Put the link in |
|---|---|
| A register entry (Paste, hub, the three English texts) | Its `UPSTREAM:` comment in `apps/server/a11y/support/upstreamRegister.ts`, as the second link; `npm run a11y:report` then shows it in the `UD-040` report |
| A run-time repair | Its `UPSTREAM:` tag in `packages/hvl-h5p-theme/src/a11yRepairs.js` or `a11yEditorRepairs.js`, in place of "no issue filed yet" (D-080's DOC-13 amendment); for the contrast and size rules, the tags in `hvl-h5p-indicators.css` and `hvl-h5p-targets.css` |
| QuestionSet | D-115 (an amendment) and the header of `apps/server/test/learningDesign/patterns/uvModuleBookRetry.browser.int.test.ts` |
| Lumi's release request | D-112 (an amendment) and R-09 in `PROGRESS.md` |
| A Lumi issue | The `UPSTREAM:` tags of its workaround: `apps/server/src/privacy/dsr/subjectErasure.ts`; `apps/server/src/h5p/storage/LanguageOverlayLibraryStorage.ts` (its `UPSTREAM:` tag names the bug: add the link there); `apps/server/src/h5p/H5pConfigFactory.ts` and `h5pAssets.ts`; the files named in the small-issues draft |
| `clamscan` or ltijs | `apps/server/src/security/malware/clamdClient.ts`, `docs/ops/clamav.md`; `apps/server/src/lti/http/ExpressRouterHttpHandler.ts` |

Then mark the draft here as filed, with the date and the link.

## Checking the facts again

Each draft says what it was checked against. To check again:

- Lumi's newest release: `npm view @lumieducation/h5p-server version time`; `master`'s newest commit:
  `git ls-remote https://github.com/Lumieducation/H5P-Nodejs-library HEAD`.
- An H5P library's pinned version and commit: `tools/h5p-libraries/libraries.manifest.json`; its default branch:
  `git ls-remote https://github.com/h5p/<repository> HEAD`.
- The barriers: `npm run test:a11y` (the register's entries print in every run) and the browser tests named in each
  draft.

Before **2027-01-31**, HVL or the bachelor students choose how the `image-size` audit exceptions end: a Lumi release
(the release request), a reviewed Lumi commit pinned by a decision of its own, or a reviewed renewal (D-112).
