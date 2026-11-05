# Design note: the Lumi path, before 2027-01-31

| | |
|---|---|
| **Status** | Open. Lumi stays at `@lumieducation/h5p-server@10.0.4` (D-112); the release request is drafted for the owner |
| **Deadline** | **2027-01-31**: the reviewed audit exceptions for `image-size` (D-030, R-08) expire, and `npm run check:audit`, and so CI, fails |
| **Decisions to read first** | D-003 (our own file security for CVE-2025-7062), D-022 (pinning a reviewed editor commit, the model for a server commit), D-030, D-081, D-112 and its amendment of 2026-11-05 |
| **Drafts** | [docs/upstream/README.md](../upstream/README.md), in particular [lumi-release-request.md](../upstream/lumi-release-request.md) |
| **Risk register** | R-08, R-09 in PROGRESS.md |

## The situation

Lumi's newest npm release is 10.0.4 (2025-03-08). Its repository's `master` has moved on: it fixes the three Core 1.28
adapters of spec 01 §1 (F1–F3), decides SVG sanitising by the uploaded file's own name, and depends on
`probe-image-size` instead of `image-size`, so a release from it would also end the audit exceptions. It still has the
bugs our adapters work around (`deleteAllContentUserDataByUser` deleting the acting user's state, `alterLibraryLanguageFile`
dropping `libraryStrings`, the ClamAV scanner accepting a scan without a verdict). CLAUDE.md names 10.0.4 as an
invariant, and `check:pins` accepts registry versions only.

## The three choices (D-112)

| Choice | What it takes | Then |
|---|---|---|
| **A Lumi release** with a fixed `image-size` | The owner files the release request; Lumi's maintainers publish | Upgrade by its own decision; review the release notes against our adapters; remove each adapter whose bug is fixed, with its `UPSTREAM:` tag; the full gate |
| **A reviewed Lumi commit, pinned** | A review of about 620 commits in D-022's manner; a build from source; `check:pins` and CLAUDE.md amended; the sanitiser, Redis-lock and ClamAV packages moved with it (`master` changed the malware-scanner interface) | Its own decision first; the full gate |
| **A renewed exception** | A review of the two `image-size` advisories again (only authenticated uploads reach it; our magic-byte checks run first), a new expiry date | The exception's entry and R-08 updated; the next deadline written down |

Recommended order: ask early in the term whether a release is coming (the draft is ready); if not by mid-January,
renew the exception with a short new expiry rather than rush a commit review. A commit pin is a good project of its own
but not a deadline task.

## Tests it needs

Whatever is chosen: `npm run check:audit`, `check:pins` and `check:licences`; `npm run boot-check --workspace
apps/server`; the ten real content types (`realTypes.browser.int.test.ts`, D-078); the upload and SVG suites
(`apps/server/test/security/`); the language overlay's and the data-subject tool's tests, whose adapters exist because
of Lumi's bugs; and the full gate.
