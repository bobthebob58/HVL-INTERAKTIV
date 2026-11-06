# How HVL Interaktiv was built and checked

| | |
|---|---|
| **For** | HVL IT (security and operations), the DPO, and anyone HVL asks to review the code, including HVL's bachelor students |
| **Status** | **Draft for HVL IT to correct.** It describes the method and where its evidence is; it is not itself evidence that the code is right |
| **Written** | 2026-11-06, at the repository owner's request, by the same AI assistant (Claude) that wrote the code, from the repository at commit `8d4eaf0` and GitHub's read-only API. Updated the same day at commit `43c6673`, after pull requests #18 and #21 were merged: the counts, pull request #21's review, the runs on `main` and line references (§2, §4.2, §4.4, §5, §6, §7) |
| **Reviewed by** | Nobody yet. Separate AI passes checked its facts against the repository and GitHub; that is not a human review |
| **Overview** | [README.md](README.md); what people should review first is in [human-review.md](human-review.md) |

## 1. In short

An AI assistant, Claude, wrote HVL Interaktiv's specifications, code, tests, reviews and documents in build sessions
S0–S6 and a simplification pass (S4+), from 2026-10-16 to 2026-11-06; the repository owner made the product decisions
and approved the plans of S2–S6 ([PROGRESS.md](../../PROGRESS.md)). Every session ran the same cycle: plan, record
decisions before code, build in small documented files, test with requirement IDs in the test titles, review, verify the
fixes, pass a scripted gate, and commit with requirement references (§2). The rule for a fault was an experiment:
reproduce it first, fix it, then show the same check passing; mainly in S6, the tests themselves were tested by breaking
the code on purpose and by putting old code back (§3). Reviews were adversarial: separate AI agents each read through
one lens, in most rounds a skeptic tried to refute each finding, and verification passes re-checked the fixes; where
counts were recorded, 209 findings were confirmed and fixed (§4). Two automated layers ran on top: the local S6 gate of
144 steps in about 11 hours, which passed on 2026-11-06 after three first-run failures were fixed, and GitHub CI on
fresh machines, whose first finished run on 2026-11-06 found one fault the local gate could not see; after its fix,
the next run passed, the owner merged the work into `main`, and CI passed there too (§5). The evidence can be checked:
116 decisions with 147 dated amendments, 126 requirements of which 123 have tests that name them, 27,933 tests in the
S6 gate's root run (28,007 after pull request #21), each gate's output in `PROGRESS.md` and each CI run under its ID on
GitHub (§6). The main limit is that one author wrote all of it, so a misunderstanding that reaches the
code, the tests and the mocks alike passes every check, and no person has reviewed the code yet. This document
prepares a human review and does not replace one; §7 and [human-review.md](human-review.md) say what people must do.

## 2. The cycle in every session

The protocol is [CLAUDE.md](../../CLAUDE.md) §4; each session's checklist and log are in `PROGRESS.md`. Line
numbers below are `PROGRESS.md` lines in the version committed with this document, unless a file is named.

| Step | What it means here | Rule | Evidence |
|---|---|---|---|
| **1. Plan** | Read `PROGRESS.md`, load only the specs it lists for the session, plan one milestone in Plan Mode, and get the owner's approval. From S2 on, risky assumptions about upstream code were tried first as probes, and the probes were kept as tests | CLAUDE.md §4, steps 1–2 (lines 64–65) | Approvals: S2 on 2026-10-22 (line 96), S3 on 2026-10-23 (117), S4 on 2026-10-23 (157), S5 on 2026-10-28 with seven owner decisions (302–312), S6 on 2026-10-30 with five (414–426). None is recorded for S1. Probes: S2's and S3's upstream behaviours pinned as tests (`fb1c482`, `b3009d7`; `apps/server/test/h5p/upstream/`, `test/lti/upstream/`; D-050), S4's real-library probe (158), S5 P1–P7 (316), S6 P1–P3 (455–476) |
| **2. Decide** | Design choices, and every deviation from a spec, are written in `docs/DECISIONS.md` before their code. The code carries `SPEC-DEVIATION: D-xxx`, and doc-lint fails a mark without a decision ID (`DOC-003`) or with one that `docs/DECISIONS.md` lacks (`DOC-010`) | CLAUDE.md §1, "Deviation"; `DOC-003`, `DOC-010` ([tools/doc-lint/README.md](../../tools/doc-lint/README.md), lines 13 and 19) | 116 decisions (D-001…D-116) and 147 dated amendments ([DECISIONS.md](../DECISIONS.md)). `PROGRESS.md` says it as it happens, for example "each changes D-104, D-106 or D-115 first" (543) and "Decided and built … before the code" (600–601) |
| **3. Build** | Small files (at most 200 lines) with one responsibility, a module header (What, Why, Spec, Invariants, Collaborators, Tests) and TSDoc on every export, written with the code, not afterwards | CLAUDE.md §1 and §4 step 3; `DOC-001`, `DOC-002`, `DOC-007` ([DOCUMENTATION-STANDARD.md](../DOCUMENTATION-STANDARD.md)) | Checked by machine at every gate: `npm run doc:lint` (11 checks), `check:filesize`, and `docs:api`, where a TypeDoc warning is an error. Husky runs Prettier and ESLint before each commit (47) |
| **4. Test** | Each test title starts with the requirement ID it checks. Only a running `it()` or `test()` title counts, not a comment or a skipped test | `DOC-004`, `DOC-006`; D-033 | `npm run spec:trace -- --check` fails when a finished session's MUST has no test. The S1 review found that it had counted IDs in comments and skipped tests, hence D-033. doc-lint checks Arrange/Act/Assert comments in long tests (session log, «2026-10-23 · S2», 1085–1086) |
| **5. Review** | Separate AI agents read the work through one lens each; a skeptic tries to refute each finding before anything is fixed | Method in human-review.md §2.2 | §4 below |
| **6. Verify** | The rule: each fix comes with a regression test that fails on the old code. Verification passes re-check the fixes; mutation checks and revert-run-restore checks test the tests. In S6 each step ended with a "finish run" of every check, with `CI=true` so that no integration test skips | human-review.md §2.2, points 3–5 | §3 below; for example the finish run of S6 step 3 (1336–1341) |
| **7. Gate** | A fixed list of commands per session, which grows as sessions add features; every command must pass, and the output is pasted into `PROGRESS.md` before the next session starts | CLAUDE.md §4 step 4; [Evaluator Guide](../EVALUATOR-GUIDE.md) §5; D-100, D-113 | Gate output for S0 in its section (lines 34–38) and for S1–S6 in the session log; S6's in «2026-11-06 · S6 gate» (1697–1772) |
| **8. Commit** | Regenerate `docs/TRACEABILITY.md`, then a conventional commit with a `Refs:` footer of requirement IDs | CLAUDE.md §4 step 5; `DOC-011` | The `commit-msg` hook runs `tools/doc-lint/checkCommitMessage.mjs`, which requires `Refs:` with known IDs on `feat` and `fix` commits. 175 of the 224 commits carry `Refs:`, every `feat` and `fix` commit among them; the other 49 are 23 `docs`, 9 `chore`, 9 `test`, 4 `refactor` and 1 `ci` commit and the merges of PRs #8, #18 and #21 (`git log`) |

**Where the record is thin.** No plan approval is recorded for S1 (human-review.md §2.1). CLAUDE.md's two-strike
debugging rule (lines 71–72) has no recorded use. Screenshots were sent to the owner from S4 on (lines 230–231) but,
as CLAUDE.md asks (lines 75–78), none is committed. All of this record was kept by the same AI that followed it.

## 3. Fixing by experiment

### 3.1 The rule

A fault is first made to happen on purpose, in the test set-up; then a test that fails is written; then the cause is
fixed; then the same test, the area's tests and the gate must pass. The D-101 amendment of 2026-11-05 writes this
down for HVL, «How a problem is fixed» (`docs/DECISIONS.md:2575–2577`), and the pull request route asks for the same
(human-review.md §5, «Fixes»). The point is that a test which has never failed has not shown that it can see the
fault; a test seen failing on the old code and passing on the new one has.

### 3.2 Examples

| What failed | How it was reproduced | The fix | The same check afterwards; evidence |
|---|---|---|---|
| **CI run 76 (2026-11-06):** `purgeCliFailure.test.ts:70` expected one line of standard error and got Node's ".env not found. Continuing without it." twice before it | Locally, by moving `apps/server/.env` aside (`8d4eaf0`'s message); the test hands the CLI its settings itself (`serverCli.ts:10–11`) | The test helper drops that exact Node notice (`apps/server/test/support/serverCli.ts:28–30, 76`); the test's assertions are unchanged | Passed with and without `.env` (commit `8d4eaf0`); on GitHub, see §5.2 |
| **`ciWorkflow.test.mjs` (2026-11-06):** after `cbfd859` marked S6 done, the test that pins CI's traceability step to the last finished session failed: `[5]` instead of `[6]` | The test itself, run locally (`tools/doc-lint/test/ciWorkflow.test.mjs:136–145`) | `--done-through=S6` in `.github/workflows/ci.yml:184` | The test passed (commit `3eeea8d`); found before GitHub CI reached its test step |
| **S6 gate, `AUTH-00` filter:** a grade-sync test read a placement that the test before it had made, and that test did not match the filter | The gate's filter run | The test launches as the teacher itself, so it records its own placement; no assertion changed | The filter run passed (commit `92ca2c5`) |
| **S6 gate, `[DATA-007]` alone:** two scenario files' audit tests read purge and data-subject runs that the ID's run skipped | The gate's per-ID run | Those runs carry `[DATA-007]` too, with a WHY comment; no assertion changed | The per-ID run passed (commit `5a5b8c3`) |
| **S6 gate, `docs:api`:** 10 TypeDoc warnings on S6 types | The gate step | Export seven types, document three call signatures; type-only changes | The step passed (commit `f5fa12b`) |
| **The grade worker claimed 3 jobs with a limit of 1** (S6 step 4's checks) | `gradeSyncFlood.int.test.ts` in the full server run; then a prepared generic plan on a copy of the table updated 3 rows for `LIMIT 1` | The claim became a materialised CTE that runs once | With the old query the test failed again in one of two runs after `ANALYZE`; with the new one it passed all five (`PROGRESS.md:517–524`) |
| **S5 gate:** after «Fjern meg», focus fell to `body`, once, under CPU load | A deterministic reproduction, 20 of 20: a late effect of an earlier React commit cleared the focus request; the new tests force that order | The focus request became state, run by the commit that renders it (`useFocusAfterChange.ts`) | Three verification rounds: revert-run-restore, mutations, CPU load (commit `72fbcb2`) |
| **S5 gate:** a late React commit overwrote the loaded page title | With Chromium's CPU slowed through CDP: 1 load in 3 at 4x, 3 in 3 at 20x | `useLoadedPageTitle` keeps the title; checks wait for loaded views | Commit `b8ab740`; `apps/web/src/i18n/useLoadedPageTitle.ts:7–8` |
| **The red `main` after PR #8** (CI run 41075981429): the click on «Lagre» landed while H5P was still growing its iframe | Reproducing the e2e failure, which also found a product fault: «Lagre» was enabled before H5P's editor could save | `editorStart.js` enables «Lagre» only on `editorloaded`; the e2e tests wait for the enabled button (`apps/server/e2e/support/editorSave.ts`) | Commit `d722964`; `PROGRESS.md:428–430, 452–454` |
| **A differencing leak in insight** (S6 step 4's privacy review): with *k* = 5 and 17 learners, a listed wrong gap answer could pin hidden counts | Found by the review's attack on the counts; an exhaustive test over that case shows it | Listed answers are always shown; per gap, right, «other wrong» and «empty» form one additive group (`gapMisconceptions.ts`) | A new `[INS-006]` exhaustive test that fails on the old code (`PROGRESS.md:582–586`) |
| **A build-machine value in an H5P library** (S6, 2026-11-05): AudioRecorder's webpack set-up passes all of `process.env` | Built at its pinned commit under `env -i` with one made-up variable: the value appeared twice in the built file; no real secret was used | A webpack setting suggested in an upstream report drafted for the owner to file; not applied here, and not played in a browser | With it, neither that value nor any other build-machine value was left (D-112 amendment, `docs/DECISIONS.md:4486–4490`) |

The first five rows are the faults found by the S6 gate and around PR #18, on 2026-11-05 and 2026-11-06. Two of them
(`92ca2c5`, `5a5b8c3`) are the same kind as the S3 gate's two (session log, lines 1141–1142): a test that relied on
the test before it, which only a run of a subset of tests shows.

### 3.3 Testing the tests: mutation checks

From S6 on, each workstream's skeptic changed the code on purpose to see whether a test failed. Where none did, the
skeptic added the missing test. In S6 steps 3–7 that was 25 workstreams (6, 4, 4, 6 and 5), each with one or two such
skeptics (`PROGRESS.md`, lines 492–493, 562, 615–616, 685–687, 760–762). The cases recorded in detail:

| Area | What was broken on purpose | What happened | What was added | Evidence |
|---|---|---|---|---|
| Backups and restore | The restore's table, object and content-file comparisons forced to 0; the empty-bucket check removed | Every test still passed | A restore of a copy whose manifest expects more, which must report each difference and exit 1; "Each of the four mutations now fails a test" | `docs/DECISIONS.md:4030–4035` (D-110 amendment); `tools/ops/test/backupRestoreChecks.test.mjs` |
| ClamAV | The filter on signature names dropped | Every test still passed | A fake clamd answers with a finding named like a person and a file; it must be refused and the name kept out of the log | `docs/DECISIONS.md:3959–3960` (D-110 amendment) |
| Docker smoke | A proxy CA planted in a test image, to try the new check | Found by reading, not by a run: the old check read `docker history`, which shows instructions, never file contents | The smoke searches every file of the image; it found the planted CA | `docs/DECISIONS.md:3883–3887` (D-110 amendment) |
| Load harness | The API threshold set to 5 ms | The run failed and exit code 99 reached `npm run`, so a threshold can fail; nothing was missing there | Not for the threshold. The same review added a test that cuts a line inside an `ltik=` token, which fails on the old per-chunk redaction | `docs/DECISIONS.md:4640–4644` (D-114 amendment) |

Three checks were found to pass without checking anything; the first two now fail in that case, and the third is
avoided by how the gate runs:

- `check:licences` passed while it saw 1 production package instead of 482; `productionSetGuard.mjs` now fails such a
  run (`PROGRESS.md:396–406`; D-113).
- `spec:trace` counted requirement IDs in comments and in skipped tests (D-033, found by the S1 review).
- The per-ID runs for `NFR-003` and `UD-031` selected no test in the root project; from S6 the gate also runs them
  inside the accessibility suite, "so no per-ID row selects zero tests" (D-113). That is a rule for how the gate
  is run, not a check that fails by itself.

**What this does not cover.** The mutations were chosen by each skeptic, not generated: no mutation-testing tool is
installed (none in any `package.json`). The table shows that weak tests stayed weak until someone tried; areas no
skeptic mutated may have tests that would pass a broken change.

### 3.4 Revert-run-restore

In S6 step 10, after the 18 fixes for the five lenses' findings, an adversarial re-check took each fix in turn, put
back the old code, re-ran the fix's regression test to see it fail, and then restored the file byte for byte
(`PROGRESS.md:899–903`).
The re-check also found a second path for one finding (`SEC-S6-01`, a same-origin image URL that could forge an
insight audit entry), so the rule became a fetch-metadata allow-list (D-106 amendment). S5's focus fix (`72fbcb2`) had
the same check as one of its three verification rounds.

## 4. Adversarial AI review

### 4.1 How a round works

Most defect-review rounds ran like this (human-review.md §2.2); §4.2 shows how each session's rounds were set up.

1. **Separate AI reviewers.** Each AI agent gets one lens (for example security, privacy, accessibility, correctness
   or documentation against code) and reads the code or diff for that lens only.
2. **A skeptic per finding** tries to refute it against the code, the specs and the decisions. Only confirmed findings
   are fixed; refuted ones are recorded.
3. **A fixer** writes a regression test that fails without the fix, then the fix.
4. **Verification passes** re-check the fixes and look for new problems; in S6 step 10, an adversarial re-check also
   reverted each fix (§3.4).
5. **Fact-checkers for documents.** The IT assurance pack was "fact-checked by further AI passes" (`PROGRESS.md:1694–
   1695`). The passes that prepared this document compared its brief with GitHub's API and corrected it: the first
   `docker.yml` pass was run 42166052745, not 42170423045, and PR #18's first CI run was run 75 on `cbfd859`, which a
   newer push cancelled (runs 42165369085 and 42165369079).

### 4.2 Per session

| Session | Lenses and rounds | Recorded outcome | Evidence (`PROGRESS.md`) |
|---|---|---|---|
| S0 | No code. Versions, APIs and CVEs checked against npm and advisories | — | Line 26 |
| S1 | Three reviewers (correctness and security, privacy and spec, documentation), a skeptic per finding, one verification pass that re-ran each finding | **16 confirmed and fixed**, plus the valid low-severity ones and the verification pass's new findings | Lines 59–64; «2026-10-22 · S1 review» |
| S2 | Three reviewers with skeptics, then three verification passes, each finding challenged by a skeptic; pass 3 audited h5p.js's HTML sinks and fuzzed Chromium with more than 60 variants | No total recorded. Pass 1 and 2 found more paths into H5P's «Rights of use» dialog and out of a package; pass 3 found no further script, but five inputs that ended a save with 500 | «2026-10-23 · S2», 1072–1086 |
| S3 | Two review rounds (Feide, LTI, privacy, app wiring, spec conformance) with skeptics, then three adversarial verification passes | No total recorded. Among the fixes: Canvas–Feide linking trusted any `feide_login`; a one-step key rotation would break LTI; pass 3 found a test that failed about 1 run in 128 | «2026-10-23 · S3», 1130–1142 |
| S4 | An early review of the server work, a theme round, a final review of all of S4 with five lenses, a verifier of the groups' requests, a second verification; a skeptic per dimension | 36 + 11 + 48 + 6 + 19 = **120 confirmed and fixed** | Lines 232–238; «2026-10-24 · S4», 1189–1193 |
| S4+ | Simplification only: 12 finders, two skeptics per proposal; a proposal was applied only if neither refuted it | 84 proposals, 62 survived both, merged into 60, 59 applied (one undone when a test failed). A count check caught a script error that had handed each area only its first batch | Lines 255–262 |
| S5 | Seven reviewers (security, privacy, accessibility, pedagogy and content, correctness, tests, documentation), a skeptic per finding, two verification passes and a cross-group round | 49 found: **33 fixed**, 13 rejected, 1 overturned against the player's code, 2 duplicates | Lines 352–362 |
| S6 steps 3–7 | A skeptic with mutation checks for each workstream of each step; then a security or privacy review of each integrated step (steps 3–6) | Steps 3–6 reviews: 5 code fixes, 7 findings that needed a decision (decided by amendments or recorded for the DPO); workstream skeptics recorded no totals | human-review.md §2.3; lines 510–513, 581–586; S6 step logs |
| S6 step 10 | Five lenses over `git diff 47e235e`, a skeptic per finding, a fixer per lens, an adversarial re-check with revert-run-restore | **20 found, 18 confirmed, 2 refuted, 18 fixed** | Lines 898–921 |
| Pull request #21 (2026-11-06) | Two workstreams, the build-secret scan and the clamd settings probe, each reviewed by two adversarial reviewers (bypass and correctness; the tests by mutation and revert-run-restore) and then fixed | **22 confirmed and fixed**: 13 on the scan, 9 on the probe | Session log «2026-11-06 · The build-secret scan on every way in, and a clamd settings probe»; the counts are in pull request #21's description on GitHub |

Where counts were recorded, **209 findings were confirmed and fixed** (S1 16, S4 120, S5 33, S6 step 10 18, pull
request #21 22). S2, S3 and the S6 workstream skeptics fixed findings but recorded no totals.

### 4.3 Why this is better than one pass

- **The skeptics cut wrong findings before they changed code.** In S5, 16 of 49 findings did not survive (13
  rejected, 1 overturned, 2 duplicates); in S6 step 10, 2 of 20.
- **Later passes found what earlier ones missed.** S1's verification pass found new problems in the fixes; S2's first
  two passes found more ways into H5P's «Rights of use» dialog and out of a package, and its third five inputs that
  gave 500; S3's passes found the key-rotation fault and a flaky test; S4's second verification found 19 more; S6's
  re-check found a second path for `SEC-S6-01`; pull request #21's reviewers found a regression against the old
  secret guard and the image build missing the scan's rules file.
- **One lens per agent keeps attention narrow.** The per-lens counts of S6 step 10 (correctness 1, security 1,
  privacy 2, accessibility and UI 7, docs 9; `PROGRESS.md:903–904`) show that every lens found something, and that
  16 of the 20 findings came from two lenses, accessibility and UI, and docs against code.

### 4.4 Why it is still one author

Every reviewer, skeptic, fixer and verifier was the same model, reading the same specs and decisions that the same model
wrote. Separate agents remove some blind spots (a fresh context, one lens) but not those that come from a shared reading
of a spec, of HVL's needs or of how Canvas and Feide behave. The record shows the gap: since S3, every session gate
found something the reviews had missed (human-review.md §2.3, «A pattern IT should know about»), and on 2026-11-06
GitHub CI's first finished run found one more (§5.2); the later full CI runs passed. In the repository's own words,
"independent review" means separate AI passes, not people (human-review.md §1).

## 5. Two kinds of automated check: the local gate and GitHub CI

### 5.1 How they differ

| | Local gate | GitHub CI |
|---|---|---|
| **Where** | The development container the AI works in, "on this container (not GitHub CI)"; a 4-vCPU machine (`ci.yml:26`). It restarted twice during the S6 gate, and the services were started again (`PROGRESS.md:1698–1705`) | A fresh GitHub-hosted `ubuntu-24.04` runner for each job, discarded afterwards: `ci.yml`'s job «Session gate» and `docker.yml`'s «Image build and app stack smoke test» (`ci.yml:23–25`; `docker.yml:22–24`) |
| **When** | At the end of each session (CLAUDE.md §4 step 4); S6's ran from 2026-11-05 16:28 to 2026-11-06 04:17 UTC | On every push to `main` and every pull request (`ci.yml:10–13`); a newer push cancels the run in progress (`ci.yml:18–20`). `main`'s ruleset requires a pull request and a green «Session gate» check (`PROGRESS.md`, Q16) |
| **User** | root, "as everything does in the development container"; the PDF export there needs the development-only `PDF_ALLOW_NO_SANDBOX=true` (`docs/DECISIONS.md:2392–2395`) | A non-root user; the job lifts Ubuntu's AppArmor limit on unprivileged user namespaces so that Chromium's sandbox can start (`ci.yml:130–134`) |
| **Services** | PostgreSQL 16, Redis 7 and moto from `docker compose`; a real clamd 1.4 in a step of its own; `dockerd` started by hand behind a registry mirror ([docs/ops/docker.md](../ops/docker.md), lines 132–136) | Service containers with health checks: `postgres:16-alpine`, `redis:7-alpine`, `motoserver/moto:5.1.16`, and `clamav/clamav:1.4` pinned by digest, twice: with the two alert settings and, since pull request #21, without them (`ci.yml:33–70`); migrations applied in the job (`ci.yml:124–125`) |
| **A missing service** | The integration test skips, unless the run sets `CI=true`, as S6's finish runs did (`PROGRESS.md:1341`) | `CI=true`: an error, never a skip (`ci.yml:72`; `apps/server/test/support/services.ts:27–31`) |
| **State on disk** | A long-lived working tree with a developer `apps/server/.env` and local caches | A clean checkout, so no `.env`, which git ignores (`.gitignore:20–23`), and no token left on disk (`persist-credentials: false`, `ci.yml:94–96`); `npm ci` from the exact lockfile (`ci.yml:101–102`); the build must leave committed files unchanged (`ci.yml:140–141`) |
| **What runs** | The full form (D-113; Evaluator Guide §5, S6 row), 144 steps in ten parts (A–J): every check and build, the root run, the live seam skipped and against the mocks, e2e, the recorded accessibility run, real clamd, the load smoke, the Docker smoke, the running server against the mocks, `--done-through=S1` to `S6`, 19 `-t` filter runs and 89 per-ID runs (`PROGRESS.md:1708–1770`) | One job of 29 `run` steps and 4 actions (checkout, setup-node, cache, upload-artifact; `ci.yml:94–190`): install, the H5P fetches, the content check, build, the static checks, `npm test`, e2e, the live seam against the mocks, accessibility, `docs:api`, `--done-through=S6`, the spec site, the conformance report check and the boot check; plus `docker.yml`'s image build and smoke. Each suite runs once, in its default order |
| **Only here** | The `-t` filters and per-ID runs; the load smoke with k6; the walk of the running server; the Docker build behind the agent proxy; `deploy:check` and `privacy:dpia-check` as steps of their own (in CI they run inside `dockerSmoke.sh:71` and `npm test`) | Real clamd inside `npm test`, a strict and a lax one (`ci.yml:87–89`); Chromium's sandbox as a non-root user; a machine with nothing left over from earlier work; the accessibility report kept as a run artifact (`ci.yml:174–180`) |
| **How long** | About 11 hours of running time, in parts of under 2 hours (`PROGRESS.md:1697–1699`) | Limits of 75 minutes for the gate job and 60 for Docker (`ci.yml:32`; `docker.yml:27`). Run 76's job (127722909215) ran 05:03:41–05:40:35 UTC before it stopped at its failing step; run 77's job (127736690226) passed in 58 min 32 s; the two Docker passes took 8 min 19 s with a cold library cache and 4 min 16 s with a warm one (jobs 127722905949, 127736690022) |
| **Who vouches** | The same AI agent ran it and pasted a summary of its output into `PROGRESS.md` (committed in `cbfd859`). No third party saw the runs, and the raw transcripts are not in the repository. The commands are written down (Evaluator Guide §5, S6 row), so a reviewer can run them again; nobody else has yet | GitHub runs the committed workflow and keeps each step's result, timing and log under a run ID that anyone with access can open; GitHub, not the AI, writes that record. It vouches that these commands passed on that commit, not that the tests are right |
| **What it caught that the other did not** | Faults that depend on test order or a subset of tests (the S3 gate's two; `92ca2c5` and `5a5b8c3`); faults under full CPU load (S5: `72fbcb2`, `b8ab740`), present while CI run 68 on `49219ce` was green (run 40968838631; `PROGRESS.md:1282–1285`). It also found the `[5]`/`[6]` mismatch before CI reached it (`3eeea8d`), which CI's `npm test` would have caught too | What the machine assumes: the developer `.env` (run 76, `8d4eaf0`). Timing on another machine: an e2e click race that left `main` red after PR #8's merge (push run 41075981429), on code whose pull request run had passed (run 41066236672; `PROGRESS.md:428–430`, Q16) |

The application code was the same in both places. Between `f5fa12b`, where part B (e2e, accessibility, Docker) ran,
and `8d4eaf0`, only four test files changed under `apps/`, `packages/`, `deploy/` and `content/`: one in `92ca2c5`,
two in `5a5b8c3` and `serverCli.ts` in `8d4eaf0` (`git diff --stat f5fa12b 8d4eaf0`).

### 5.2 Worked example: the missing `.env` (2026-11-06)

1. **04:55 UTC.** Pull request #18 was opened with head `cbfd859`, the commit that marked S6 done. CI run 75
   (42165369085) and Docker run 1 (42165369079) started.
2. **Before CI reached its tests**, a local run of `ciWorkflow.test.mjs` failed (`[5]` instead of `[6]`, §3.2).
   `3eeea8d` fixed it, and its push cancelled CI run 75 (job 127720475943) during its Chromium install, before its
   tests, and Docker run 1 (`ci.yml:18–20`, `docker.yml:17–19`).
3. **Run 76** (42166052880, job 127722909215, head `3eeea8d`) failed in «Tests (unit and integration)»: 1 test of
   27,933 (1 failed, 27,931 passed, 1 skipped). At `apps/server/test/privacy/purge/purgeCliFailure.test.ts:70` the
   purge CLI's standard error had to hold one line, and held Node's ".env not found. Continuing without it." twice
   before it. Docker run 2 (42166052745) passed on the same head: `docker.yml`'s first pass on GitHub.
4. **Why the local gate could not see it.** The server's npm scripts use `--env-file-if-exists=.env`
   (`apps/server/package.json:12–25`; `privacy:purge` on line 23). The development container has a developer
   `apps/server/.env`; GitHub's runner has none, and nor would a server (`serverCli.ts:13–14`). The fault was in the
   test's expectation, not in the CLI: the extra lines are Node's own notice (`serverCli.ts:28–29`).
5. **Reproduce, fix, show.** Moving `.env` aside gave the same failure locally; the test hands the CLI its settings
   itself (`serverCli.ts:10–11`). The fix is in the test helper only (`serverCli.ts:28–30, 76`); the test file is
   unchanged since `f361f16`, so its assertions are too. The test passed with and without `.env` (`8d4eaf0`'s
   message). This step is recorded by the AI alone.
6. **The check a third party keeps.** Session gate run 77 (42170423046, job 127736690226, head `8d4eaf0`)
   **passed**, every step, 05:46:51–06:45:23 UTC (58 min 32 s of its 75-minute limit): 712 test files, and 27,932
   tests passed and 1 skipped of 27,933 (CI ran the real-clamd file's 2 tests, which the local root run skips, and
   skipped the 1 test that runs only as root, `taggedPdf.browser.test.ts:155`); e2e 22 files, 33 tests; the live seam
   against the mocks 36 tests; accessibility 18 files, 558 tests; then `docs:api`, `spec:trace --done-through=S6`
   (126 requirements), the spec site, the conformance report check and the boot check. Docker run 3 (42170423045)
   passed on the same head, 05:46:51–05:51:07 UTC. GitHub's record of both is under their run IDs.
7. **The merge.** The pull request's last head, `eb79b30`, changed documents only; CI run 78 (42183630447) and Docker
   run 4 (42183630572) passed on it. The owner merged it as `38b1743` on 2026-11-06, and on `main` CI run 79
   (42205391766) and Docker run 5 (42205391749) passed. Pull request #21 then passed CI run 82 (42253214678) and Docker
   run 8 (42253214575) on `9bfa1b2` and was merged as `43c6673`; on `main`, Docker run 9 (42266303382) passed and CI run
   83 (42266303529) passed, every step (17:57–18:44 UTC).

**What the case shows.** The local gate is wider: it alone ran the per-ID runs that found two order faults the same
night. CI is cleaner and independently recorded: it alone could see that a test relied on a file that only the
developer's machine has. Each found a fault the other could not, so neither replaces the other.

### 5.3 The shared limit

Both layers run **the same tests, written by the same AI that wrote the code, against mocks the same AI wrote**
(`tools/mock-platform`, D-049). The AI also wrote `ci.yml` and the test that pins it (`ciWorkflow.test.mjs`). A green
run means the code does what those tests expect; it does not show that they expect the right thing. A test that
asserts the wrong behaviour passes in both. Neither reaches a real Canvas, real Feide, HVL's hosting, 200 learners,
assistive technology or the DPO (Evaluator Guide §6, limitation 23), and both run Chromium only. Neither counts as a
human review (human-review.md §6, «What does not count»).

## 6. By the numbers

| What | Number | How to check |
|---|---|---|
| Build sessions | S0–S6 and the simplification pass S4+, from 2026-10-16 to 2026-11-06 | `PROGRESS.md`, status table (lines 11–18) |
| Commits | 224: 221 by `Claude`, 3 merges of PRs #8, #18 and #21 by the owner's account; all on `main` | `git log --format='%an' \| sort \| uniq -c`; `git rev-list --count origin/main..HEAD` |
| Commits with `Refs:` | 175, among them every `feat` and `fix` commit | `git log --format=%B \| grep -c '^Refs:'` |
| Decisions | 116 (D-001…D-116), with 147 dated amendments (146 at `43c6673`; the 147th, of 2026-11-06, records this refresh in D-116) | `grep -c '^### D-[0-9]' docs/DECISIONS.md`; `grep -o '\*\*Amendment (20' docs/DECISIONS.md \| wc -l` |
| Requirements | 126: 123 with a test that names them (MUST 106, SHOULD 16, COULD 1), 3 planned (`INS-004`, `LTI-009`, `PROD-014`); no MUST without a test | [TRACEABILITY.md](../TRACEABILITY.md), lines 9–13; `npm run spec:trace -- --check --done-through=S6` |
| Root test run, S6 gate on `5a5b8c3` | 712 files (711 passed, 1 skipped); 27,933 tests (27,931 passed, 2 skipped) | `PROGRESS.md:1720–1722` |
| Root test run for pull request #21 (local, as recorded in commit `9bfa1b2`) | 725 files; 28,007 tests passed, with the services and a strict and a lax real clamd | Commit `9bfa1b2`'s message; pull request #21's description |
| Other suites, S6 gate | e2e 22 files, 33 tests; accessibility 18 files, 558 tests; live seam 36 tests against the mocks; real clamd 6 files, 30 tests | `PROGRESS.md:1723–1728` |
| The S6 gate | 144 steps in 10 parts, about 11 hours; 19 filter runs, 89 per-ID runs and 2 per-ID runs in the accessibility suite | `PROGRESS.md:1697–1770` |
| Growth of the root run | 147 (S1) → 203 (S1 review) → 19,290 (S2) → 20,126 (S3) → 21,423 (S4) → 26,316 (S5) → 27,933 (S6) → 28,007 (pull request #21) | `PROGRESS.md:1029, 1057, 1102, 1157, 1223, 1299, 1720–1722`; `9bfa1b2`'s message |
| What the count means | About two thirds come from one filter: `SEC-003\|H5P-011\|H5P-006` selects 18,721 tests, most of them the H5P permission matrix (`H5P-006` alone had 18,669 at the S2 gate); `PROD-007\|PROD-013` selects 3,919 more. So the total shows how many cases ran, not how carefully each area was tested | `PROGRESS.md:1107, 1741–1745`; human-review.md §4.1 A6 ("sample them, do not count them") |
| Review findings | 209 confirmed and fixed where counts were recorded; in S5 a further 13 rejected, 1 overturned and 2 duplicates; in S6 step 10, 2 refuted | §4.2 |
| Faults found by gates and full runs after the reviews | S3: 33 TypeDoc warnings, 2 order faults; S4: 2 undocumented API names; S5: 3 timing faults and a licence check that saw 1 package of 482; S6 step 4's checks: the grade claim and 2 web tests; S6 gate: 3; PR #18: 2 (one locally, one in CI) | human-review.md §2.3; §3.2 and §5.2 above |
| Runs on PR #18 | 8: CI 75 and Docker 1 cancelled by a newer push; CI 76 failed; Docker 2 and 3 passed; CI 77 passed on `8d4eaf0`, 27,932 tests passed and 1 skipped of 27,933 (§5.2); CI 78 and Docker 4 passed on `eb79b30` | GitHub Actions runs 42165369085, 42165369079, 42166052880, 42166052745, 42170423045, 42170423046, 42183630447, 42183630572 |
| Runs on PR #21 and on `main` | PR #21: CI 82 and Docker 8 passed on `9bfa1b2`. `main`: CI 79 and Docker 5 passed on `38b1743`; Docker 9 and CI 83 (every step, 17:57–18:44 UTC) passed on `43c6673` (§5.2, step 7) | GitHub Actions runs 42253214678, 42253214575, 42205391766, 42205391749, 42266303382, 42266303529 |
| Human code reviews | 0: none on PR #8, #18 or #21, and none recorded in the repository | GitHub's API (`get_reviews` on PRs #18 and #21 returns `[]`, 2026-11-06); human-review.md §2.1 |

## 7. What this method cannot do, and what people must do

**What it cannot do:**

- **See its own blind spots.** One model wrote the specs as amended, the code, the tests, the mocks, the reviews and
  this pack. A misreading that reaches the test passes every gate (human-review.md §1).
- **Show that a test checks what its ID claims.** "Tested" means a running test title carries the ID
  (`TRACEABILITY.md`, lines 6–7); whether that test covers the whole requirement is for a reader to judge, and for
  some requirements it is a check that documents agree (Evaluator Guide §5, «How S6's privacy and operations
  requirements are verified»).
- **Mutate systematically.** Mutation checks were chosen by hand, area by area (§3.3).
- **Meet the real systems.** Canvas and Feide only as mocks; Chromium only; no assistive-technology run, so all 56
  conformance verdicts are *Not yet determined*; a load smoke of 20 learners for 30 seconds, not 200; no restore drill
  on HVL's hardware (Evaluator Guide §6, limitations 5, 15 and 23).
- **Find every machine-dependent fault early.** Faults that appear only on another machine or under other load were
  found late: the S5 timing faults, the red `main`, the `.env` case. More may show on HVL's runtime (Q5).
- **Judge readability for a human maintainer.** The "does it read as if a careful human wrote it" check has not run
  (`PROGRESS.md`, S6 step 10, the unticked item at lines 933–942).
- **Audit itself.** The record of the method is kept by the same AI that followed it.

**What people must do** (the plan, checklists and estimates are in [human-review.md](human-review.md) §4–§6, about
37.5–41.5 person-days in all, as the AI's estimates):

- [ ] **A security review of the riskiest code first:** the LTI launch and the ltik, uploads and the files origin
      (CVE-2025-7062 is unpatched upstream, D-003), the grade worker, the xAPI bridge, and Feide sessions and CSRF
      (human-review.md §4.1 A1–A5); then, in the privacy review, *k*-suppression in insight (§4.2 B1).
- [ ] **An HVL developer reads the code**, treating each test as a claim: read what it asserts, then change the code
      to see whether it fails (human-review.md §4, «Before starting»).
- [ ] **A real Canvas and real Feide:** `npm run test:live` against HVL's test Canvas and the
      [Canvas acceptance checklist](../handoff/canvas-acceptance.md), on the isolated test server of
      [test-environment.md](test-environment.md).
- [ ] **A manual accessibility test with assistive technology**, by people who use it daily
      ([manual test protocol](../accessibility/manual-test-protocol.md); human-review.md §4.4).
- [ ] **The DPO's review** of the [DPIA input](../privacy/DPIA-INPUT.md) and its residuals (Q6).
- [ ] **The 200-learner load test and a restore drill** on HVL's hardware ([runbook](../ops/runbook.md) §8 and §6).
- [ ] **A named system owner and maintainer** at HVL (Q31), who own the findings and their closure (human-review.md
      §6).

Until then, read every count in this document as evidence of how much was checked, by the author, and not as
evidence that the checks were the right ones.
