# Human review: what has been reviewed, and what people should review first

| | |
|---|---|
| **For** | HVL IT (security and operations), the DPO, and anyone HVL asks to review the code, including HVL's bachelor students |
| **Status** | **Draft for HVL IT to correct.** The plan, the checklists, the time estimates and the definitions of "reviewed" in §4–§6 are proposals |
| **Written** | 2026-11-05 by the same AI assistant (Claude) that wrote the code, from the repository at commit `92ca2c5`. Updated 2026-11-06 at commit `8d4eaf0` with the commit counts, pull request #18 and its GitHub CI runs (§2.1, §2.3, §2.4, §3). No file under `apps/server/src`, `apps/web`, `packages/`, `deploy/` or `content/` changed between those commits (`git diff --stat 92ca2c5 8d4eaf0`). Updated again on 2026-11-06 at commit `43c6673`, after pull requests #18 and #21 were merged: §2.1, §2.3, §3, the line counts in §4 (only area A2's changed materially) and the new controls in A2 and C4 |
| **Reviewed by** | Nobody yet. A second AI pass checked the facts and evidence against the repository on 2026-11-05; that is not a human review |
| **Overview** | [README.md](README.md); the risks this review lowers are ROS-01 and ROS-02 in the [ROS-analyse](ros-analyse.md) |

## 1. In short

- **No review by a person is recorded** for the code, its tests, the deployment files, the threat model, the DPIA
  input or this pack.
- **Every review in the repository was done by AI agents**: the same model that wrote the code, run as separate
  reviewers, skeptics and verifiers. Where `PROGRESS.md` says "independent review" and `docs/privacy/DPIA-INPUT.md` §10
  says "independent reviews with mutation checks", they mean separate AI passes, not people.
- **Those reviews found and fixed real defects** (§2), but one author's code, tests and reviews can share blind spots,
  and full test runs kept finding faults the reviews had missed.
- **What we ask:** a human security review first, then privacy, operations and a manual accessibility test (§4),
  recorded so that HVL can tell what was checked (§5, §6).

## 2. What has been reviewed, by whom and how

### 2.1 Who did what

- **The code, the tests and the documents:** 221 of the repository's 224 commits are by `Claude
  <noreply@anthropic.com>`. The other three are GitHub's merges of pull requests #8, #18 and #21 by the owner's account
  (`git log --format='%an'` at `43c6673`, 2026-11-06).
- **The owner** approved the plans of S2–S6 (`PROGRESS.md`; none is recorded for S1), made the product decisions (for
  example the licence, D-015, and one Node.js system, D-081), asked for the simplification pass (S4+), protected `main`
  with a ruleset that requires a pull request and the «Session gate» check, and merged pull request #8 after that
  check passed (`PROGRESS.md`, Q16). The pull request has **no review** on GitHub (0 reviews, read through GitHub's
  API on 2026-11-05). Pull request #18, which carries S6, and pull request #21, the security follow-ups, have no
  review either (0 reviews each, read through GitHub's API on 2026-11-06); the owner merged both on 2026-11-06 after
  the check passed, and every commit is now on `main` (`git rev-list --count origin/main..HEAD` is 0 at `43c6673`).
- **The owner also tried the app** in a Codespace (commit `0943a73`: "The owner's first try ran in the browser
  editor") and received screenshots of the views as they were built (CLAUDE.md §4; `PROGRESS.md`, S4–S6). That is
  using the app, not reviewing its code.

### 2.2 How the AI reviews worked

Most rounds used this method (`PROGRESS.md`, the S1–S6 checklists; S4+ was a simplification pass, not a defect
review):

1. Reviewers each read the code through one "lens" (for example security, privacy, accessibility, documentation).
2. A **skeptic** tried to refute each finding; only confirmed findings were fixed.
3. Each fix came with a **regression test that fails on the old code**.
4. **Verification passes** re-checked the fixes and looked for new problems.
5. From S6, each workstream's skeptic **changed the code on purpose** (mutation checks) to show that the tests catch
   the change; in S6 step 10 an adversarial re-check put back the old code for each fix, re-ran its test and restored
   the file byte for byte.

### 2.3 Per session

| Session | What the AI review did | Findings | Evidence (`PROGRESS.md`) |
|---|---|---|---|
| S0 (2026-10-16) | No code review. Versions, APIs and CVEs were checked against npm and advisories | — | «S0» |
| S1 (2026-10-22) | Three reviewers (correctness and security, privacy and spec, documentation), a skeptic per finding, one verification pass | 16 confirmed and fixed, plus the valid low-severity ones and the verification pass's new findings | «S1» checklist |
| S2 (2026-10-23) | Three reviewers, a skeptic per finding, three verification passes; the third audited H5P's HTML sinks and fuzzed Chromium with more than 60 variants | No total recorded. Fixed, among others: author metadata ran as script in H5P's «Rights of use» dialog; a truncated upload could end the process; package paths could leave the package. Pass 3 found no further script, but five inputs that answered 500 | Session log, 2026-10-23 · S2 |
| S3 (2026-10-23) | Two review rounds (Feide, LTI, privacy, app wiring, spec conformance), a skeptic per finding, three adversarial verification passes | No total recorded. Fixed, among others: Canvas–Feide linking trusted any `feide_login`; a one-step key rotation would break LTI (now three steps, D-056); a test that failed about 1 run in 128 | Session log, 2026-10-23 · S3 |
| S4 (2026-10-24) | An early server review, a theme round, a final review of all of S4 with five lenses, a verifier of the groups' requests, and a second verification | 36 + 11 + 48 + 6 + 19 = 120 confirmed and fixed | «S4» checklist; session log |
| S4+ (2026-10-25) | A simplification pass, not a defect review; two skeptics per proposal | 84 proposals, 62 survived both skeptics, merged into 60, 59 applied | «S4+» |
| S5 (2026-10-29/30) | Seven reviewers (security, privacy, accessibility, pedagogy and content, correctness, tests, documentation), a skeptic per finding, two verification passes and a cross-group round | 49 found: 33 fixed, 13 rejected, 1 overturned, 2 duplicates | «S5», step 6 |
| S6 step 3 (2026-11-04) | Six workstreams, each with a mutating skeptic; then a security and privacy review | Review fixes, among them a replay race and a same-origin check that let `'/\t/host'` through. The security and privacy review fixed 1 issue and left 4 findings (1 medium, 2 low, 1 info): findings 1, 2 and 4 were decided by amendments to D-104, and finding 3 was recorded for the DPO as DPIA residual R1 (Q22) | «S6», step 3 |
| S6 step 4 | Four workstreams with mutating skeptics; then a privacy and security review | The core's review found two ways to work out hidden counts. The privacy review fixed one leak and left three design findings (high, medium, low to medium), decided and built | «S6», step 4 |
| S6 step 5 | Four workstreams with one or two mutating skeptics each; then a privacy and security review | 2 fixes (medium; medium to low); the follow-ups were done in step 6 | «S6», step 5 |
| S6 step 6 | Six workstreams with mutating skeptics; then a security review | No high or medium defect; 1 low fix (a NUL byte in a file path gave 500); the other findings fixed in step 7 or listed under «Still open» | «S6», step 6 |
| S6 step 7 | Five workstreams with mutating skeptics | No counts recorded | «S6», step 7 |
| S6 step 8 | A run of the accessibility suite over every S6 view | 1 violation found and fixed (a chart label cut off under text spacing) | «S6», step 8 |
| S6 step 10 | Five lenses read `git diff 47e235e`; a skeptic per finding, a fixer, an adversarial re-check | 20 found, 18 confirmed, 2 refuted, 18 fixed. The check "does the code read as if a careful human wrote it?" was **not run** | «S6», step 10 |
| S6 gate | The full gate in ten parts (D-113), 144 steps; passed on 2026-11-06 | Three fixes: TypeDoc warnings (`f5fa12b`) and three tests that depended on test order (`92ca2c5`, `5a5b8c3`) | «S6», step 11; session log «2026-11-06 · S6 gate»; `git log` |
| After the gate (2026-11-06) | Not a review: the local test that pins `ci.yml` to the last finished session (`tools/doc-lint/test/ciWorkflow.test.mjs`) | 1 fault: after `cbfd859` marked S6 done, the test failed (`[5]` instead of `[6]`), because CI still checked traceability through S5. `3eeea8d` raised the CI step to S6 and the same test passed. CI's run on `cbfd859` (42165369085) was cancelled by that push before its test step, so CI never reported it | `git show 3eeea8d`; `.github/workflows/ci.yml`, lines 18–20 and 184 |
| GitHub CI, pull request #18, first finished run (2026-11-06) | Not a review: GitHub runs the committed workflow on a fresh runner. CI run 42166052880 (job 127722909215) on `3eeea8d` | Failed 1 of 27,933 tests (`apps/server/test/privacy/purge/purgeCliFailure.test.ts`, line 70, expects one line of standard error). GitHub's runner has no `apps/server/.env`, so Node's `--env-file-if-exists` printed ".env not found. Continuing without it." twice before the purge CLI's failure line. The local gate could not see it, because a developer `.env` exists there | GitHub run 42166052880; `apps/server/package.json`, line 23 |
| The fix, and CI again | `8d4eaf0`: reproduced by moving `.env` aside; the test helper drops that exact Node notice; the test's assertions are unchanged; the test passes with and without `.env`. Then CI run 42170423046 (job 127736690226) on `8d4eaf0` | **Passed**, every step, 05:46:51–06:45:23 UTC: 712 test files, 27,932 tests passed and 1 skipped of 27,933 (CI ran the 2 real-clamd tests and skipped the 1 test that runs only as root); e2e 22 files, 33 tests; the live seam against the mocks 36 tests; accessibility 18 files, 558 tests; traceability through S6 (126 requirements). This is GitHub's record that the committed tests pass there, not a review | `git show 8d4eaf0`; `apps/server/test/support/serverCli.ts`, line 30; GitHub run 42170423046 |
| `docker.yml` on GitHub, pull request #18 | Not a review: the image build and app-stack smoke test on GitHub's runner. The first run (42165369079, on `cbfd859`) was cancelled by the next push | First pass on GitHub in run 42166052745 on `3eeea8d` (05:03–05:12 UTC); passed again in run 42170423045 on `8d4eaf0`. Both logs: image 1994 MB, 7 of 7 migrations, 77 library folders seeded, clamd refused EICAR, the PDF printed with Chromium's sandbox (seen in `/proc`), Chromium 141.0.7390.37 as uid 10001 | GitHub runs 42166052745 (job 127722905949) and 42170423045 (job 127736690022) |
| The merge of pull request #18 (2026-11-06) | Not a review: CI and `docker.yml` on the pull request's last head, `eb79b30` (documents only), then on `main` after the owner's merge, `38b1743` | Passed: CI run 42183630447 and Docker run 42183630572 on `eb79b30`; on `main`, CI run 42205391766 (job 127850607830, 10:47–11:48 UTC) and Docker run 42205391749 | GitHub runs; `git log` |
| Pull request #21, security follow-ups (2026-11-06) | Two workstreams by AI agents, the build-secret scan on every way a library gets in and the clamd settings probe, decided first in D-110's amendments of 2026-11-06; each reviewed by two adversarial reviewers (bypass and correctness; the tests by mutation and revert-run-restore), then fixed. Commit `9ad481e` also closed out the old AudioRecorder builds (threat model T-81) | 13 findings confirmed and fixed on the scan, 9 on the probe. Locally: 725 test files, 28,007 tests with the services and a strict and a lax real clamd, and the full Docker smoke; the accessibility suite was not run locally. On GitHub, CI run 42253214678 (every step of the job «Session gate») and Docker run 42253214575 passed on `9bfa1b2`; on `main` after the merge (`43c6673`), Docker run 42266303382 passed and CI run 42266303529 passed, every step (17:57–18:44 UTC). No review on GitHub | Session log «2026-11-06 · The build-secret scan on every way in, and a clamd settings probe»; pull request #21's description; GitHub runs |

**A pattern IT should know about.** Since S3, every session gate has found something the AI reviews missed, and so have
some other full test runs: 33 TypeDoc warnings and 2 order-dependent tests at the S3 gate, 2 undocumented API names at
the S4 gate, 3 faults under full CPU load at the S5 gate, the grade worker claiming 3 jobs with a limit of 1 in the full
server run of S6 step 4's checks (recorded under step 3), and three fixes in the S6 gate (`PROGRESS.md`, session log and
S6 steps). GitHub CI's first finished run on S6 then found one fault that the local gate could not see: a test that
relied on the developer's `.env` file (run 42166052880; fixed in `8d4eaf0`, after which run 42170423046 passed). The
later full CI runs found nothing new: 42183630447 on `eb79b30`, 42253214678 on `9bfa1b2` (pull request #21), and
42205391766 and 42266303529 on `main` passed every step. Machines checking machines catch a lot; a person reading the
riskiest parts is the cheapest way to catch what this method does not.

### 2.4 Two kinds of automated check

The local session gate and GitHub CI run the same committed tests, but in different places, in different ways and
with different witnesses, and each has caught faults the other could not: the gate's per-requirement runs found tests
that depended on test order (`92ca2c5`, `5a5b8c3`), and CI's fresh runner found the test that relied on a developer
`.env` (`8d4eaf0`). How they differ in full, and what the method behind both cannot catch:
[how-it-was-built.md](how-it-was-built.md) §5. In short:

- **Local gate:** the AI runs it on its development container at the end of each session; for S6, 144 steps in ten
  parts over about 11 hours, among them 19 filtered and 89 per-requirement runs, the load smoke, the Docker smoke and
  the running-server walk, which CI does not do. The same AI pasted the output into `PROGRESS.md`; nobody else saw the
  runs (`PROGRESS.md`, session log «2026-11-06 · S6 gate»).
- **GitHub CI:** GitHub runs the committed workflow on a fresh runner for every pull request and push to `main`, each
  command once as one full suite in its default order, and keeps the result and logs under a run ID that anyone with
  access can check; `main` accepts only a pull request with a green «Session gate» check (`.github/workflows/ci.yml`,
  lines 10–13; `PROGRESS.md`, Q16).
- **Shared limit:** both run tests the same AI wrote, against mock Canvas and Feide it also wrote, in Chromium only. A
  green result means the code does what those tests expect, not that they expect the right thing. Neither is a human
  review (§6).

## 3. What has had no human review

| Item | State on 2026-11-06 | Evidence |
|---|---|---|
| The code: `apps/`, `packages/`, `tools/` | No review by a person is recorded. The planned "an HVL developer reads a sample" has not happened | `PROGRESS.md`, S6 step 10; §2.1 |
| The tests | Written and mutation-checked by the same AI. "Tested" in `docs/TRACEABILITY.md` only means that a test title carries the requirement ID | `docs/TRACEABILITY.md`, lines 6–7; [hand-off](../handoff/README.md) §4 |
| The deployment files and CI | `deploy/` and `.github/workflows/` were read only by AI reviewers (among them step 6's security review, step 10's review of everything since `47e235e` and pull request #21's reviewers, who added CI's second, lax clamd). `docker.yml` has now run on GitHub and passed, also on `main` (§2.3), which shows that the image builds and its smoke test passes there, not that a person has read the files | `PROGRESS.md`, S6 steps 6 and 10; GitHub runs 42166052745, 42170423045, 42205391749 and 42253214575 |
| Pull requests #18 (S6) and #21 (security follow-ups) | No review on GitHub; the owner merged both on 2026-11-06. CI ran on each head (CI tests the head merged into `main`, not each commit on its own): on #18, run 42166052880 on `3eeea8d` failed one test, and runs 42170423046 on `8d4eaf0` and 42183630447 on `eb79b30` passed; on #21, run 42253214678 on `9bfa1b2` passed; on `main`, runs 42205391766 after #18's merge and 42266303529 after #21's passed (§2.3). A green run is not a review (§6) | GitHub's API, 2026-11-06 (0 reviews on each); `git log`; `.github/workflows/ci.yml`, lines 10–13 |
| The threat model, the ROS-analyse and this pack | Drafts by the AI | [threat-model.md](threat-model.md), [ros-analyse.md](ros-analyse.md) |
| The DPIA input (residuals R1–R40) | Not reviewed by the DPO | Q6; `docs/privacy/DPIA-INPUT.md` |
| Accessibility for real users | No manual run recorded; all 56 verdicts are *Not yet determined* | `docs/accessibility/results/README.md`; [conformance report](../accessibility/WCAG-CONFORMANCE-REPORT.md) |
| The studio's texts (phases, guide, patterns, mappe template, the content bank's consent text) | Requested from ALU, not done | Q17; `docs/reference/alu-review-s5.md` |
| Canvas and Feide | Tested against the mocks in `tools/mock-platform` only; the live-contract seam has never run against a real Canvas or Feide | `docs/EVALUATOR-GUIDE.md` §6, limitation 5; [live-contract-seam.md](../handoff/live-contract-seam.md) |
| Upstream reports | Drafted, none filed; two security reports are held outside the repository | [docs/upstream/README.md](../upstream/README.md); `PROGRESS.md`, S6 step 7 |

## 4. A prioritised plan for human reviewers

**Order:** security first (A), then privacy (B), then operations (C), then the manual accessibility test (D). Within
each, the areas are in order of risk. The paths are under `apps/server/src/` unless they start with `apps/`,
`packages/`, `tools/`, `deploy/`, `docs/` or `.github/`, and test paths under `apps/server/`.

**Time estimates are the AI author's estimates, not measurements.** They assume one experienced reviewer, about
200 lines of careful reading an hour, as much time again to run the tests and try attacks, and a 7.5-hour working
day, so about 100 lines per review hour, rounded to half days. The line counts are `wc -l` of each area's listed
source files at `92ca2c5`, without tests (counted again on 2026-11-05 by a second AI pass). Counted again at
`43c6673`: only A2's line count changed materially, by pull request #21's clamd settings probe in `security/malware/`
(2,275 lines, now 2,816); C1's files changed by about 15 lines (CI's lax clamd, CI's traceability step raised to S6
and two lines in the Dockerfile), which leaves its rounded count as it was; and C4 gained the build-secret scan
(`git diff --stat 92ca2c5 43c6673`).

**Before starting** (about half a day):

- Set up stage 0: a Codespace or your own machine ([.devcontainer/README.md](../../.devcontainer/README.md); «How to
  run» in [apps/server/README.md](../../apps/server/README.md)); `npm run mock:platform` starts the mock Canvas and
  Feide.
- Read [architecture.md](architecture.md) and [threat-model.md](threat-model.md); `grep -rn "SECURITY:" apps/` gives a
  tour of the security-relevant lines.
- `npx vitest run -t "LTI-004"` runs the tests of one requirement (most need the local services from
  `docker compose up -d`).
- Treat every test as a claim: read what it asserts, and change the code to see whether it fails.

### 4.1 A. Security review

#### A1. The LTI launch and the ltik (about 1,600 lines; estimate 2 days)

**Paths:** `lti/launch/`, `lti/ltikPrincipal.ts`, `lti/LtiRoleMapper.ts`, `lti/storage/PrismaLtiDatabaseManager.ts`,
`lti/platforms/`, `lti/LtiProviderFactory.ts`, `lti/http/`, `auth/requestPrincipal.ts`;
`apps/web/src/features/lti/ltikFromAddress.ts`.

**Why first:** a launch turns a signed message from Canvas into a user with roles. ltijs 7 checks neither the
deployment ID nor the platform's active flag, so our code does (D-050, D-051), and the ltik is a bearer token.

- [ ] A launch from a deployment without an `LtiDeployment` row is refused before an ltik is made, and an ltik is
      refused on every later use once its deployment or platform is removed or inactive (D-051).
- [ ] No combination of role claims gives `admin`; `Administrator` gives at most `author` and `TestUser` gives
      `learner` (`LTI-004`, D-059).
- [ ] A nonce works exactly once, also for two requests at the same moment (`LTI-002`).
- [ ] The ltik is taken from the query only on the paths in `LTIK_QUERY_PATHS` (`auth/requestPrincipal.ts:32-38`) and
      on `/app/play`; anywhere else a query ltik gets 401.
- [ ] The ltik never reaches a log line, a `Referer` header, the browser's history or its storage (`LTI-003`).
- [ ] `Provider.listen()` is never called and ltijs's own HTTP handler and CORS are not mounted (D-050).
- [ ] LTI pages may be framed only by the origins in `CANVAS_ORIGINS`, and the player and editor pages also by our
      own `/app/play` (`'self'`; `lti/http/ltiPageHeaders.ts`).
- [ ] Try it with the mock platform: a wrong `aud`, a foreign key, a replayed nonce, an unknown deployment,
      `Administrator` roles.

**Tests that claim it:** `test/lti/ltiLaunch.int.test.ts`, `test/lti/ltikPrincipal.int.test.ts`,
`test/lti/LtiRoleMapper.test.ts`, `test/lti/storage/LtiDeploymentGuard.int.test.ts`, `e2e/ltiIframe.e2e.test.ts`.

#### A2. Uploads and the files origin (about 2,800 lines; estimate 4 days)

**Paths:** `security/` (`SvgSanitizer.ts`, `svg/`, `FileTypeSniffer.ts`, `sniff/`, `zipEntryGuard.ts`,
`ContentFileHeaders.ts`, `malware/`), `http/multipartUpload.ts`, `http/filesOriginRouter.ts`,
`http/routes/signedFileRoutes.ts`, `http/routes/fileRoutes.ts`, `h5p/HvlUrlGenerator.ts`, `h5p/contentFileGrants.ts`,
`h5p/libraries/packageLibraryCheck.ts`, `config/filesOrigin.ts`.

**Why:** CVE-2025-7062 (stored XSS through uploads) is unpatched in Lumi 10.0.4, so this code is the defence (D-003).

- [ ] Both upload paths (editor uploads and `.h5p` imports) pass every file through `FileTypeSniffer`,
      `SvgSanitizer` (`h5p/createH5pRuntime.ts:118`) and the malware scanner; no other path stores a file.
- [ ] The SVG pipeline fails closed: anything it cannot parse or does not know is refused (`SEC-001`).
- [ ] A file whose bytes do not match its extension is refused (`SEC-002`).
- [ ] Zip-slip, absolute paths, links, duplicate names and size bombs are refused before extraction (`SEC-005`).
- [ ] An author's package cannot install or change library code (`SEC-003`).
- [ ] The files host serves only `GET` and `HEAD` of signed player grants (and the CORS preflight for them), reads
      no cookie, session, ltik or `Authorization` header, and answers 404 to everything else (`SEC-004`;
      `http/filesOriginRouter.ts`).
- [ ] Every user file has `nosniff` and the `sandbox` policy, and everything but raster images, audio, video and
      captions is an attachment (`security/ContentFileHeaders.ts`).
- [ ] A grant is an HMAC compared in constant time (`h5p/contentFileGrants.ts:112`), issued only after a View or Edit
      check, and opens no other activity's files.
- [ ] The scanner refuses the upload when clamd gives no verdict, fails or times out (`SEC-006`), and refuses every
      upload while its settings probe has not proven `AlertEncrypted` and `AlertExceedsMax`
      (`security/malware/ClamdSettingsProbe.ts`; `npm run clamd:check`; D-110's amendment of 2026-11-06).
- [ ] Judge the open items: the editor's files on the app origin (`SPEC-DEVIATION: D-110`) and the cookie-authenticated
      routes in `http/routes/fileRoutes.ts` (D-110; `PROGRESS.md`, S6 step 6, «Still open»).
- [ ] Try it: polyglots, SVGs with script in every encoding, HTML named as an image, paths with NUL bytes.

**Tests that claim it:** `test/security/` (among them `SvgSanitizer.bypass.test.ts` and
`FileTypeSniffer.bypass.test.ts`), `test/http/filesOrigin.int.test.ts`, `signedFiles.int.test.ts`,
`contentFiles.int.test.ts`, `editorUpload.int.test.ts`, `packageImport.int.test.ts`, `malwareScan.int.test.ts`,
`test/security/malware/` (among them `FailClosedMalwareScanner.settings.test.ts` and `realClamdSettings.test.ts`).

#### A3. The grade worker (about 2,500 lines; estimate 3.5 days)

**Paths:** `grades/` (`gradeJobClaims.ts`, `gradeSyncRun.ts`, `gradeJobSend.ts`, `lineItemUrlPolicy.ts`,
`agsClientAssertion.ts`, `AgsAccessTokens.ts`, `AgsScoreClient.ts`, `GradeSubjectCleanupJob.ts`),
`lti/placements/LtiPlacementRecorder.ts`, `lti/nrps/nrpsRosterRead.ts`.

**Why:** it runs without a user, holds the tool's signing key and learners' Canvas IDs, and decides what reaches the
gradebook. Its claim bug was found only by a full test run (`PROGRESS.md`, S6 step 3).

- [ ] A URL from a launch (line item, roster) can point only to an origin in `CANVAS_ORIGINS` or the platform's own,
      over https in production and without credentials; redirects are never followed (D-104).
- [ ] The access token and the signed client assertion never reach a log line.
- [ ] Two workers never send the same job, and a claim never takes more jobs than its limit.
- [ ] The encrypted Canvas `sub` is cleared 30 days after its job stops.
- [ ] A 429, a 5xx or no answer from Canvas is retried for at most 24 hours, then the job fails; a second 401 fails
      the job at once, and a 404 marks it orphaned only when the line item is gone too (`grades/AgsScoreClient.ts`,
      `grades/AgsAccessTokens.ts`; runbook §7).
- [ ] Try it: race two workers, replay statements, make the mock Canvas fail.

**Tests that claim it:** `test/grades/` (among them `gradeSyncFlood.int.test.ts`, `gradeSyncRefusals.int.test.ts`,
`lineItemUrlPolicy.test.ts`, `AgsScoreClient.test.ts`), `e2e/xapiToCanvas.e2e.test.ts`.

#### A4. The xAPI bridge and ingestion (about 1,600 lines; estimate 2 days)

**Paths:** `packages/hvl-h5p-theme/src/xapiBridge.js`, `xapiBatching.js`, `xapiStatements.js`; `xapi/`.

**Why:** learner data enters here from the browser, where a student can forge anything.

- [ ] The sender is checked before the body is read; the statement's `actor` is ignored, and the learner comes from the
      session or the launch (D-102).
- [ ] The limits hold: at most 64 KiB and 50 items a batch (`xapi/xapiRoutes.ts`), a schema, five verbs, bounded
      scores, also for deep JSON and prototype keys.
- [ ] A statement is stored only for content the person may view; in Canvas only for the launched activity.
- [ ] Only learners' statements are stored, with `DATA-012`'s fields and nothing more (`xapi/xapiStatementRow.ts`).
- [ ] The bridge runs only in the top player document, for learners (D-102).

**Tests that claim it:** `test/xapi/` (`xapiRouteAuth.int.test.ts`, `xapiIngest.int.test.ts`,
`xapiLaunchScope.int.test.ts`, `xapiLimits.int.test.ts`), `e2e/xapiPortal.e2e.test.ts`.

#### A5. Feide login, sessions and CSRF (about 2,150 lines; estimate 3 days)

**Paths:** `auth/feide/`, `auth/session/`, `auth/identity/`, `auth/returnTo.ts`.

- [ ] PKCE (`S256`), `state` and `nonce` are tied to the browser by a single-use login cookie, and the ID token's
      signature is checked against Feide's keys (`AUTH-001`, D-057).
- [ ] `admin` only for a Feide ID in `ADMIN_FEIDE_IDS` whose realm is in `ALLOWED_FEIDE_ORGS`
      (`auth/feide/FeideRoleMapper.ts:162-164`).
- [ ] The session cookie is `__Host-` with `Secure`, `HttpOnly` and `SameSite=Lax`; sessions end after 2 hours idle or
      12 hours in all (`AUTH-003`).
- [ ] A CSRF token is required on every unsafe method and on H5P's AJAX routes, compared in constant time
      (`auth/session/csrfToken.ts:109`).
- [ ] After login, the app redirects to local paths only (`auth/returnTo.ts`).
- [ ] Learners' names and e-mail addresses are dropped at login (`AUTH-004`).
- [ ] Decide whether login and launch need a rate limit at the proxy: the app has none (ROS-07).

**Tests that claim it:** `test/auth/feide/FeideClient.test.ts`, `feideLogin.int.test.ts`,
`loginTransactions.int.test.ts`, `test/auth/session/csrfToken.test.ts`, `SessionStore.int.test.ts`,
`test/auth/returnTo.test.ts`.

#### A6. The H5P permission system (about 590 lines; estimate 1 day)

**Paths:** `h5p/HvlPermissionSystem.ts`, `h5p/permissions/`, `h5p/permissionSystemGuard.ts`.

- [ ] Anything not listed is denied, and `GeneralPermission.*` (library install and update) is for `admin` only (D-004).
- [ ] The server refuses to start if a Lumi component gets another permission system, and ESLint bans
      `LaissezFairePermissionSystem` (`eslint.config.mjs`).
- [ ] No learner can read or change another learner's saved state.
- [ ] The matrix tests are large (`H5P-006` alone had 18,669 cases at the S2 gate): sample them, do not count them.

**Tests that claim it:** `test/h5p/permissions/` (`contentMatrix.test.ts`, `generalAndTemporary.test.ts`,
`userDataMatrix.test.ts`), `test/h5p/permissionSystemGuard.test.ts`.

#### A7. Page script policies and headers (about 600 lines; estimate 1 day)

**Paths:** `h5p/render/playerPage.ts`, `editorPage.ts`, `coreInlineScripts.ts`, `http/h5pPageCsp.ts`,
`web/webPageCsp.ts`, `http/securityHeaders.ts`, `lti/http/ltiPageHeaders.ts`.

- [ ] H5P pages allow `script-src 'self'` and one hash; never `'unsafe-inline'` or `'unsafe-eval'` for scripts (D-070).
- [ ] Panopto's script is allowed only when a Panopto site is configured (`EXTERNAL_MEDIA_ORIGINS`).
- [ ] Next.js pages use a nonce per request, and production refuses `WEB_APP=dev`.
- [ ] No page makes a third-party request (`DATA-011`).

**Tests that claim it:** `test/http/h5pPageCsp.test.ts`, `h5pPageCsp.browser.int.test.ts`,
`test/web/webPageCsp.test.ts`, `test/http/securityHeaders.test.ts`, `a11y/firstParty.a11y.test.ts`.

**Security in all:** about 11,800 lines in seven areas; **about 16.5 person-days** (estimate).

### 4.2 B. Privacy review

#### B1. *k*-suppression in insight and the mappe (about 1,100 lines; estimate 1.5 days, plus time with the DPO)

**Paths:** `insight/suppression/`, `insight/aggregate/gapMisconceptions.ts`, `insight/scope/insightPeriod.ts`,
`insight/http/insightAccess.ts`, `insight/http/insightRoutes.ts`, `learningDesign/mappe/storedActivityResults.ts`,
`learningDesign/mappe/activityResults.ts`.

**Why:** a teacher must never learn one student's answers, and the AI reviews found several ways to work out hidden
counts (D-106's amendments). A reviewer who knows statistical disclosure control helps here.

- [ ] No cell about fewer than *k* learners carries a value, and no hidden count can be worked out from shown cells,
      complements, parts, two periods, two versions, two courses, the CSV or the mappe (`INS-006`).
- [ ] Periods end at the latest midnight in Oslo and never cross 1 August; Canvas's test students are never counted.
- [ ] Only an activity's owner, its co-authors and the course's Canvas authors see insight; admins see none (`INS-007`).
- [ ] Every view and export is audited before the answer is sent (`DATA-007`).
- [ ] With the DPO, judge residuals R1–R4, R6–R14 and R36 (`docs/privacy/DPIA-INPUT.md` §12).
- [ ] Try your own differencing attacks ([hand-off](../handoff/README.md) §4 lists some).

**Tests that claim it:** `test/insight/insightSuppression.property.test.ts`,
`test/insight/http/insightSuppressionApi.property.test.ts`, `additiveGroupExhaustive.test.ts`,
`thirtyLearners.test.ts`, `insightPeriodEnd.int.test.ts`, `test/insight/http/insightPermissions.int.test.ts`.

#### B2. Pseudonyms, keys and log redaction (about 1,300 lines; estimate 2 days)

**Paths:** `privacy/deriveLearnerKey.ts`, `privacy/pseudonymSecrets.ts`, `security/keys/`, `logging/`,
`http/requestLog.ts`; `tools/privacy/`.

- [ ] Learners appear only as `learnerKey`, an HMAC with the academic year's secret, and no learner table holds a
      column that identifies a person (`DATA-001`, `DATA-002`).
- [ ] The raw Canvas `sub` is stored only encrypted, in `GradeSyncJob` (CLAUDE.md §1; D-104).
- [ ] Encryption is AES-256-GCM with a key per purpose, and each key ring can rotate without losing data (D-056).
- [ ] Redaction covers tokens, cookies, names, e-mail and IDs at any depth, and the request log holds route patterns
      only: no path, query, user or IP address (`DATA-009`, `NFR-006`).

**Tests that claim it:** `test/privacy/deriveLearnerKey.test.ts`, `test/security/keys/DataEncryption.test.ts`,
`test/logging/logger.test.ts`, `authRedaction.test.ts`, `test/http/requestLog.int.test.ts`,
`tools/privacy/test/checkInventory.test.mjs`.

#### B3. Retention, data-subject requests and database roles (about 2,800 lines; estimate 4 days)

**Paths:** `privacy/purge/`, `privacy/dsr/`, `apps/server/prisma/roles/`, `infra/databaseRolesCli.ts`; the runbooks
[yearly-purge.md](../ops/yearly-purge.md), [data-subject-requests.md](../ops/data-subject-requests.md) and
[database-roles.md](../ops/database-roles.md).

- [ ] The purge deletes by stored academic year, writes *k*-suppressed snapshots first and is audited (D-107).
- [ ] The data-subject CLI takes identifiers on standard input only; `erase` is a dry run without `--confirm`;
      `export` refuses to write to a terminal (D-108).
- [ ] `hvli_app` may change rows but only add and read audit rows; `hvli_analytics` reads only its view (D-109).
- [ ] Walk through each runbook as the operator would, and note every step that needs a named person.

**Tests that claim it:** `test/privacy/purge/retentionPurge.int.test.ts`, `test/privacy/dsr/dsrCli.int.test.ts`,
`test/db/databaseRoles.int.test.ts`, `test/db/auditAppendOnly.test.ts`, `e2e/learnerDataRights.e2e.test.ts`.

**Privacy in all:** about 5,200 lines; **about 7.5 person-days** (estimate), plus the DPO's own review of the DPIA
input (Q6), which is not code review.

### 4.3 C. Operations review

| Area | Paths | Checklist | Estimate |
|---|---|---|---|
| **C1. The image and the deployment files** (about 1,500 lines, plus the vendored seccomp profile, which is checked by its hash rather than read) | `deploy/Dockerfile`, `deploy/Dockerfile.dockerignore`, `deploy/compose.app.yml`, `deploy/seccomp/`, `deploy/smoke/`, `tools/deploy-check/`, `.github/workflows/`, `.github/dependabot.yml` | Base images by digest, and whether the unpinned parts (Ubuntu packages, Chromium's check) are acceptable; uid 10001, read-only root, every capability dropped but `SYS_CHROOT`, the vendored seccomp profile (its hash in `deploy/seccomp/README.md`); no secret in any layer; workflows with read-only permissions; whether your runtime allows the profile (Q5) | 2 days |
| **C2. Configuration and start-up checks** (about 1,600 lines) | `config/`, `server/main.ts`, `server/healthRoutes.ts`, `apps/server/.env.example` | Every production refusal in [runbook](../ops/runbook.md) §2–§3 is in the code and has a test; the EEA allow-list fits HVL's providers (Q5); every variable marked as a secret in `.env.example` goes to IT's secret store; the outbound hosts in [architecture.md](architecture.md) match what the code contacts | 2 days |
| **C3. The runbook, exercised** (in stage 1) | [docs/ops/](../ops/README.md), `tools/ops/` | First deployment (runbook §2) by someone other than the author; a backup and a restore drill (§6); one rotation of each key ring (§4); an incident drill (§7); the deployment checklist (§9) ticked or marked not applicable | 2–3 days |
| **C4. The supply chain** (plus about 450 lines of the build-secret scan) | [sbom.cdx.json](sbom.cdx.json), `package-lock.json`, `tools/dependency-check/`, `tools/h5p-core/`, `tools/h5p-libraries/`, `tools/h5p-bundle/`, `apps/server/src/h5p/libraries/{libraryBuildSecrets,packageSecretScan,installedLibraryScan,librarySecretFindings,libraryStorageCheckCli}.ts` | Run IT's own scanners over the SBOM and the image; accept or reject the audit exceptions that expire 2027-01-31 (D-030) and the Lumi path (D-112); check how H5P code is fetched and verified; check the build-secret scan on every way a library gets in, and run `npm run libraries:check` on the library volume (D-110's amendment of 2026-11-06; runbook §2); note what the SBOM does not cover | 1.5 days |

**Operations in all:** **about 7.5–8.5 person-days** (estimate).

### 4.4 D. The manual accessibility test

Run the [manual test protocol](../accessibility/manual-test-protocol.md) on the stage-1 server, launched from HVL's test
Canvas with Feide test users, never with real student data (protocol §2). The runs due are listed in
[results/README.md](../accessibility/results/README.md): the full run (J1.1–J1.9, J2 for the ten types, the §7
checks) with set-ups AT-1 (NVDA), AT-2 (JAWS), AT-3 (VoiceOver on iOS), KB (keyboard only) and Z400 (400 % zoom); the
studio (J1.10–J1.13, J4.1–J4.4); the portfolio PDF with PAC and NVDA (J4.5–J4.10); and J3, insight, which the
protocol adds from Session 6.

- [ ] Testers who use the assistive technology daily, or an external tester HVL engages (protocol §2).
- [ ] One dated result file per set-up and run, named as `results/README.md` says, with role and initials only.
- [ ] Verdicts entered in the [conformance report](../accessibility/WCAG-CONFORMANCE-REPORT.md) as protocol §9 says.
- [ ] Barriers reported with the barrier form «Barriere for universell utforming» (§5 below; protocol §9, step 1).

**Estimate:** about a day per set-up and half a day to a day for the PDF: **6–9 person-days**.

### 4.5 Totals and who

| Part | Estimate | Suggested reviewer *(IT to fill in)* |
|---|---|---|
| A. Security | about 16.5 person-days | Someone experienced in web application security and OpenID Connect or LTI: HVL IT security, or an external party |
| B. Privacy | about 7.5 person-days | A developer working with the DPO |
| C. Operations | about 7.5–8.5 person-days | HVL IT operations, ideally the future maintainer |
| D. Accessibility | 6–9 person-days | ALU or an external tester, as the protocol says |
| **All** | **about 37.5–41.5 person-days** | |

HVL's bachelor students in programming are asked to review this code in spring 2027 (D-101;
[hand-off](../handoff/README.md)). Their work is welcome evidence, especially with mutation testing and their own
tools, but it is a one-term student project and does not replace IT's security review or the DPO's review.

**Known open items** that reviewers should judge rather than report as new (each is recorded): CVE-2025-7062 in Lumi
10.0.4 (D-003); the editor's files on the app origin and the cookie routes (D-110); insight GETs served to browsers
that send no fetch metadata (`PROGRESS.md`, S6 step 10, «Still open»); scores computed in the browser (limitation 1 in
`docs/EVALUATOR-GUIDE.md` §6); tokens in some URLs, so the proxy must not log query strings (limitation 9); no rate
limit on login and launch in the app (ROS-07); the residuals R1–R40 in `docs/privacy/DPIA-INPUT.md` §12.

## 5. How to report findings

- **Security findings: privately**, as [SECURITY.md](../../SECURITY.md) says, never in a public issue, comment or pull
  request. **Neither of its routes works yet:** GitHub's private vulnerability reporting must be turned on by the
  owner, and HVL's e-mail address is a placeholder (`SECURITY.md`, lines 12–14 and 42–44). Until then, agree a
  private channel with the repository owner *(IT to fill in)*.
- **Faults:** a GitHub issue with the «Feil» form (`.github/ISSUE_TEMPLATE/feil.yml`). **Accessibility barriers:** the
  form «Barriere for universell utforming» (`uu-barriere.yml`; its issues are titled «UU-barriere: …»). Blank
  issues are off, and each form has a required check that it holds no personal data (`config.yml`). The forms are in
  Nynorsk and written for pilot testers; for a code finding, name the file, the line and the commit in the steps
  field. Guides:
  [rapportere-problem.md](../testing/rapportere-problem.md) (testers) and
  [labels-and-triage.md](../testing/labels-and-triage.md) (maintainers). The labels are defined in `.github/labels.yml`
  but not yet created on GitHub; the owner does that (labels-and-triage.md).
- **Fixes:** a pull request, as the repository's ground rules say ([hand-off](../handoff/README.md), «Ground rules»;
  `.github/pull_request_template.md`): a decision or an amendment in `docs/DECISIONS.md` first if behaviour changes, a
  test that fails before the fix and is titled with its requirement ID, the area's tests and the gate, then `Refs:` and
  `Fixes #n`. `main` accepts changes only through a pull request with a green «Session gate» check.
- **The review's own record** *(proposal)*: one file per area and reviewer,
  `docs/assurance/reviews/YYYY-MM-DD-<area>.md` (for example `2026-12-01-A1.md`), in the manner of
  `docs/accessibility/results/` and `docs/handoff/results/`. It holds the date, the commit, the area, the reviewer's
  role and initials (not a full name), the files read, each checklist line as *pass*, *finding* or *not checked*, each
  finding with its severity and issue link (for a security finding, only a reference to the private report), and the
  time spent. No personal data.

## 6. What counts as "reviewed"

**A human review** *(proposal)* is one where:

1. a person who did not write the code reads it; AI tools may help, but the person reads the code and owns the
   judgement;
2. they read the files listed for the area at a stated commit and work through its checklist;
3. the result is recorded (§5); and
4. each finding is closed: fixed with a test and re-checked by a person, or accepted in writing by the system owner.

**What does not count:** the AI review rounds in §2 (and this pack), test counts, the "tested" status in
`docs/TRACEABILITY.md`, a green CI run, using the app or looking at screenshots, and a review that left no record.

**Enough for stage 1** *(proposal; IT decides)*. Only made-up data and test accounts are at stake, and the server is
isolated, so a full code review is not required first:

- [ ] HVL IT has read [README.md](README.md), [architecture.md](architecture.md),
      [test-environment.md](test-environment.md) and the [ROS-analyse](ros-analyse.md).
- [ ] HVL IT has done C1 and C2: what it runs (the image, its run flags, the start-up checks, the secrets, the outbound
      hosts), and scanned the image with its own tools.
- [ ] The commit deployed has passed the S6 gate and GitHub CI, `docker.yml` included (ROS-04).
- [ ] The private security route works (ROS-09).
- [ ] Whoever owns the test install (named under Q31) has accepted the ROS-analyse's stage-1 risks of Medium or
      above in writing.

**Enough for stage 2** *(proposal)*:

- [ ] The security review A1–A7 is done and recorded; every critical or high finding is fixed with a test and
      re-checked by a person; medium findings are fixed or accepted in writing by the system owner.
- [ ] The privacy review B1–B3 is done, and the DPO has reviewed the DPIA input and decided its residuals (Q6).
- [ ] The operations review C1–C4 is done, the runbook has been exercised in stage 1 (C3) with a restore drill, and a
      maintainer is named (Q31).
- [ ] The manual accessibility run (D) is recorded and its verdicts entered.
- [ ] The ROS-analyse is in HVL's template and accepted by the system owner.
- [ ] Code changed after its area was reviewed has been reviewed again for the change.
- [ ] Optional, the owner's call: the light simplification check with an HVL developer reading a sample
      ([simplification-check.md](../handoff/simplification-check.md)), which `PROGRESS.md` carries to the pilot list.
