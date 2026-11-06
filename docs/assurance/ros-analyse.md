# ROS-analyse (risk and vulnerability analysis): draft

| | |
|---|---|
| **For** | HVL IT (operations and security), the system owner once named, and HVL's data protection officer (DPO, *personvernombod*) |
| **Status** | **Draft for HVL IT to correct, re-score and take over.** It is input to HVL's own ROS-analyse, not a replacement for it. Lines marked *(IT to fill in)* are HVL facts the repository cannot know |
| **Written** | 2026-11-05, at the repository owner's request, by the same AI assistant (Claude) that wrote the code, from the repository at commit `92ca2c5`. Updated 2026-11-06 at commit `8d4eaf0`: the facts of ROS-02 and ROS-04 (test counts, pull request #18 and its GitHub CI runs) and pointers to [how-it-was-built.md](how-it-was-built.md). No score changed (ROS-04 says why) |
| **Reviewed by** | Nobody yet. The scores are the AI author's estimates, not measurements, and the author is the party being assessed. A second AI pass checked the facts and evidence against the repository on 2026-11-05; that is not a human review |
| **Overview** | [README.md](README.md) (the stages and the honest caveat); [architecture.md](architecture.md); [threat-model.md](threat-model.md); [human-review.md](human-review.md); [test-environment.md](test-environment.md) |

## 1. What this analysis covers

**The system:** HVL Interaktiv as built in Sessions S1–S6: one Node.js server (Express with the Next.js web app inside
it), PostgreSQL, Redis, S3-compatible storage, a clamd, Feide login and Canvas LTI 1.3, as described in
[architecture.md](architecture.md).

**Two stages**, as the pack's [README](README.md) defines them:

- **Stage 1:** an isolated test server with made-up data only, Feide test users, HVL's test Canvas, named testers and
  an end date ([test-environment.md](test-environment.md)).
- **Stage 2:** a pilot with real students in one or two courses. It starts only after the DPO's approval, a human
  security review, this ROS-analyse in HVL's form and an operations agreement. How long the pilot runs is not decided
  *(IT and the owner to fill in)*; the stage-2 scores assume about one semester.

Stage 0 (students on their own machines or in Codespaces, against the mocks in `tools/mock-platform`) needs nothing
from IT and is not scored here.

**Not covered:** the risks of HVL's own infrastructure (network, hosting platform, identity management, backups as a
service), of Feide and Canvas as services, and HVL's organisational risk appetite. They belong in HVL IT's existing
ROS work *(IT to fill in where)*.

**Related registers, kept separate:**

- `PROGRESS.md`, «Risk register» (`R-01`…`R-09`): build risks, for example the Lumi release lag (`R-09`).
- `docs/privacy/DPIA-INPUT.md` §12 (residuals `R1`…`R40`): privacy residuals for the DPO to decide.

This draft uses its own IDs, `ROS-01`…`ROS-26`, and cites those registers where they overlap.

## 2. Method and scale

> **Replace this section with HVL's own ROS method and template** *(IT to fill in which)*. The scale below is a common
> 5 × 5 matrix, chosen only so that the draft can be scored at all. Keep the `ROS-nn` IDs when moving the risks over,
> so that the repository's documents can still point to them.

**How a risk is scored.** For each stage, the risk is scored **with the measures in place today**, as found in the
repository. *Further measures* are what should lower it. IT re-scores after they are done.

**Likelihood (L), within the stage:**

| L | Meaning |
|---|---|
| 1 | Very unlikely: not expected during the stage; needs several independent failures |
| 2 | Unlikely: could happen, but the measures in place make it improbable |
| 3 | Possible: could well happen during the stage |
| 4 | Likely: expected at least once during the stage unless more is done |
| 5 | Almost certain: a known date or a known gap makes it happen |

**Consequence (C), the worst credible outcome:**

| C | Meaning |
|---|---|
| 1 | Insignificant: no real personal data involved; testers are briefly held up |
| 2 | Minor: made-up data or test accounts affected; a short outage of the test server; some rework |
| 3 | Moderate: a few learners' data seen by people inside HVL who should not see it; an outage of about a day in the pilot; wrong formative scores in one course; can be corrected |
| 4 | Serious: many learners' or staff members' data exposed, an account taken over, or authored content lost; a report to Datatilsynet likely; the pilot's trust damaged |
| 5 | Critical: a large breach, special-category data or children's data spread beyond HVL, lasting data loss, or an attack on HVL's other systems through this one |

**Risk score = L × C**, from 1 to 25, in four bands:

| Score | Band | Proposed response (for IT to replace) |
|---|---|---|
| 1–4 | **Low** | Accept and watch |
| 5–9 | **Medium** | Reduce where the cost is reasonable; the system owner accepts the rest in writing |
| 10–15 | **High** | Reduce before the stage starts, or the system owner accepts it in writing with a date for the measure |
| 16–25 | **Very high** | Not acceptable: the stage does not start until it is reduced |

**Reading the register.** In the L, C and Score columns the first value is **stage 1** and the second is
**stage 2**, for example `2 / 4`. A dash means the risk does not apply to that stage. Evidence is a file path (from the
repository root, or under `apps/server/src/` when it starts with a module folder such as `lti/` or `config/`), a
decision (`D-nnn`), a requirement ID, a test file or a numbered open question (`Q`, in `PROGRESS.md`). "Limitation n"
is item n of `docs/EVALUATOR-GUIDE.md` §6, and "R" followed by a number is a residual in `docs/privacy/DPIA-INPUT.md`
§12.

## 3. Risk register

### 3.1 AI-written code and how it was verified

| ID | Risk | Cause | Consequence, for whom | L | C | Score | Measures in place (evidence) | Further measures | Proposed owner |
|---|---|---|---|---|---|---|---|---|---|
| ROS-01 | A security or privacy defect nobody has found | All code, tests and reviews come from one AI author; no person has read the code ([human-review.md](human-review.md) §1). Full test runs have found faults the AI reviews missed, such as the grade worker claiming 3 jobs with a limit of 1 (`PROGRESS.md`, S6 step 3) | Learners and staff: data seen or changed by others, an account misused. HVL: breach handling, lost trust. Stage 1 holds made-up data only | 3 / 3 | 2 / 4 | 6 Medium / 12 High | 123 of 126 requirements have a test that names them (`docs/TRACEABILITY.md`); AI review rounds with a skeptic per finding and mutation checks ([human-review.md](human-review.md) §2); `SECURITY:` tags give a tour of the defences (`grep -rn "SECURITY:" apps/`); production start-up checks (`config/productionChecks.ts`) | Before stage 2: the human security review in [human-review.md](human-review.md) §4, areas A1–A7, with findings fixed. For stage 1: isolation and made-up data ([test-environment.md](test-environment.md) §4); IT's own scan or penetration test of the test install *(IT to decide)* | HVL IT (security), with the system owner |
| ROS-02 | Tests and reviews give more assurance than they should | "Tested" means only that a test title carries the ID (`docs/TRACEABILITY.md`, lines 6–7); `LTI-005` is partly built yet shows as tested ([hand-off](../handoff/README.md) §1); most of the 27,933 tests in the root test run (the S6 gate's run on `5a5b8c3`: 27,931 passed, 2 skipped; `PROGRESS.md`, session log «2026-11-06 · S6 gate») are generated matrix cases: the gate's filter `SEC-003\|H5P-011\|H5P-006` alone selects 18,721 of them (same entry); "independent review" in `PROGRESS.md` and `docs/privacy/DPIA-INPUT.md` §10 means separate AI passes; GitHub CI runs the same AI-written tests again on another machine, so a green CI run adds a witness, not a second judgement ([how-it-was-built.md](how-it-was-built.md) §5) | HVL IT, the DPO and the system owner: decisions taken on overstated evidence | 3 / 4 | 2 / 3 | 6 Medium / 12 High | Mutation checks by AI skeptics, and in S6 step 10 a re-check that put back the old code for each fix (`PROGRESS.md`, S6 step 10); known limitations stated (`docs/EVALUATOR-GUIDE.md` §6); this pack states the limits, and [how-it-was-built.md](how-it-was-built.md) sets out the method and what it cannot catch | Human reviewers treat each test as a claim and sample the tests of each area ([human-review.md](human-review.md) §4); repeat mutation testing with other tools ([hand-off](../handoff/README.md) §4) | System owner; HVL IT (security) |
| ROS-03 | The code is hard for HVL people to maintain | Written by many parallel AI workstreams; the planned check "does the code read as if a careful human wrote it?" was not run (`PROGRESS.md`, S6 step 10) | The maintainer: slow or wrong fixes. HVL: dependence on the original author or tool | 2 / 3 | 1 / 3 | 2 Low / 9 Medium | Module header, TSDoc and tagged reasons in every source file, at most 200 lines per file, checked by `npm run doc:lint` (`DOC-001`–`DOC-003`, `DOC-007`; `tools/doc-lint/README.md`); decisions and their reasons recorded in `docs/DECISIONS.md` (D-001…D-116) | The light simplification check with an HVL developer reading a sample ([simplification-check.md](../handoff/simplification-check.md)); the maintainer reads the package READMEs' module maps | Maintainer (to be named) |
| ROS-04 | A build is deployed that has not passed its checks | The S6 gate passed on the development machine on 2026-11-06, on `5a5b8c3` (`PROGRESS.md`, session log «2026-11-06 · S6 gate»). The 19 commits after `main` are in pull request #18, open and not merged (`git rev-list --count origin/main..HEAD` at `8d4eaf0`; GitHub's API, 2026-11-06), so `main` does not hold S6 yet. GitHub CI's first finished run on the pull request (run 42166052880, on `3eeea8d`) failed one test that the local gate could not see, because GitHub's runner has no developer `.env`; after the fix (`8d4eaf0`), the Session gate passed in run 42170423046 (finished 2026-11-06 06:45:23 UTC). `docker.yml` passed on GitHub for the first time (run 42166052745, on `3eeea8d`) and again on `8d4eaf0` (run 42170423045). The push run on the merge of pull request #8 was red (`PROGRESS.md`, Q16). How the two kinds of check differ: [how-it-was-built.md](how-it-was-built.md) §5 | Testers, later learners: broken features. IT: time lost on known faults | 3 / 2 | 2 / 3 | 6 Medium / 6 Medium | The gate run locally in parts (D-113); the Docker smoke test in the development sandbox ([docker.md](../ops/docker.md)) and on GitHub's runner; GitHub CI on pull request #18, with each run's log kept under its run ID ([human-review.md](human-review.md) §2.3); `main` requires a pull request and the «Session gate» check (`PROGRESS.md`, Q16). **Scores unchanged on 2026-11-06:** the likelihood rests on which commit is chosen and how its image is handed over ([test-environment.md](test-environment.md) §3), and neither has changed: no workflow publishes an image (`.github/workflows/docker.yml`), and the S6 work is not on `main`. IT re-scores (§6) | Deploy only a commit that passed the S6 gate and GitHub CI, `docker.yml` included, handed over by image digest ([test-environment.md](test-environment.md) §3) | Repository owner, until a maintainer is named |

### 3.2 Security

| ID | Risk | Cause | Consequence, for whom | L | C | Score | Measures in place (evidence) | Further measures | Proposed owner |
|---|---|---|---|---|---|---|---|---|---|
| ROS-05 | Script in an uploaded file runs in another user's browser (stored XSS) | CVE-2025-7062 is unpatched in Lumi 10.0.4 (D-003, `SECURITY.md`); the editor's files stay on the app origin (`SPEC-DEVIATION: D-110`, `http/createH5pRouter.ts:58`); the files host is the same site as the app (`docs/EVALUATOR-GUIDE.md` §6, limitation 10) | Authors and learners: a script acts in their session. HVL: a breach | 2 / 2 | 2 / 4 | 4 Low / 8 Medium | SVG sanitising on both upload paths (`SEC-001`; `security/SvgSanitizer.ts`, registered in `h5p/createH5pRuntime.ts:118`; `apps/server/test/security/SvgSanitizer.bypass.test.ts`); magic-byte sniffing (`SEC-002`); user files with `sandbox` CSP and `nosniff` (`security/ContentFileHeaders.ts:76`); the player's files on a separate files origin (`SEC-004`, `http/filesOriginRouter.ts`); `script-src 'self'` on H5P pages (D-070); ClamAV failing closed (`SEC-006`); only admins install libraries (`SEC-003`, D-004) | Human review A2 ([human-review.md](human-review.md)); a separate registrable domain for files (Q5); narrow or retire the cookie route `/h5p/content/…` (D-110; `PROGRESS.md`, S6 step 6, «Still open») | HVL IT (security); maintainer |
| ROS-06 | Someone forges or takes over a Canvas launch or a portal session | ltijs 7 checks neither the deployment ID nor the platform's active flag (D-050, D-051); the ltik is a bearer token and arrives in the query on a few routes (`auth/requestPrincipal.ts:32-38`; limitation 9); a proxy may log query strings (DPIA R26) | Learners: someone acts as them. Teachers: someone changes their activities or reads insight | 2 / 2 | 2 / 4 | 4 Low / 8 Medium | Deployment check at launch and on every ltik use (`lti/platforms/LtiDeploymentGuard.ts`, `lti/ltikPrincipal.ts`; `LTI-001`, `LTI-003`); a launch never grants `admin` (`lti/LtiRoleMapper.ts`, `LTI-004`); one-use nonces (`lti/storage/PrismaLtiDatabaseManager.ts:181-189`, `LTI-002`); the ltik kept out of the address bar and logs (`LTI-003`); Feide login with PKCE (`AUTH-001`); `__Host-` cookies, CSRF tokens compared in constant time (`auth/session/csrfToken.ts:109`, `AUTH-003`) | Proxy access log without query strings ([runbook](../ops/runbook.md) §9); human review A1 and A5; the Canvas acceptance checklist in stage 1 ([canvas-acceptance.md](../handoff/canvas-acceptance.md)) | HVL IT (proxy, security); TeCopp (the developer key) |
| ROS-07 | The service is overloaded, by accident or on purpose | The app has no rate limit on the login (`auth/`) and launch (`lti/`) routes: a search of `apps/server/src` on 2026-11-05 found limits only for xAPI, insight, grade-sync retries, people search and copies. Uploads of up to 50 MB per file and 200 MB per package (`SEC-005`); the PDF export runs Chromium; a hung clamd blocks uploads (D-110) | Teachers and learners: the service is slow or down, for example before a seminar | 2 / 3 | 1 / 3 | 2 Low / 9 Medium | Redis rate limits (`xapi/XapiRateLimit.ts`, `insight/http/InsightRateLimit.ts`, `grades/status/GradeSyncRetryRateLimit.ts`, `learningDesign/collaboration/PeopleSearchRateLimit.ts`, `CopyRateLimit.ts`); size limits enforced while streaming (`http/multipartUpload.ts`); `PDF_MAX_CONCURRENCY` and one export per person (limitation 17); at most 4 scans at once (`security/malware/FailClosedMalwareScanner.ts:32`); a 20-learner load smoke with 0 % failures ([runbook](../ops/runbook.md) §8) | Rate limits at the reverse proxy for `/auth/` and `/lti/` *(IT to decide)*; `npm run load:full` on a production-like node (runbook §8); alerts on 5xx and p95 (runbook §7) | HVL IT (operations) |
| ROS-08 | Keys or secrets leak or are handled wrongly | Several key rings with manual three-step rotations; replacing the LTI tool key pair is not automated ([runbook](../ops/runbook.md) §4); an old `H5P.AudioRecorder` build put the build environment into learner JavaScript, which was checked and closed on 2026-11-06 (`PROGRESS.md`, S6 step 6; DPIA R39) | HVL: stored tokens and the Canvas `sub` decryptable, file grants forged, the tool impersonated towards Canvas (it signs grade requests). Learners: their data exposed | 2 / 2 | 2 / 4 | 4 Low / 8 Medium | Production refuses keys that are text, low in variety or reused (`config/productionChecks.ts`); AES-256-GCM at rest with a key per purpose (D-056); no secret in the image (`docs/ops/docker.md`, line 27; `deploy/Dockerfile.dockerignore`); logs redact tokens (`DATA-009`) | A secret store *(IT to fill in)*; new keys for each stage, destroyed at the end ([test-environment.md](test-environment.md) §3–§4); a written procedure for replacing the tool key pair | HVL IT (operations) |
| ROS-09 | A vulnerability is reported in public, or not at all | The security e-mail in `SECURITY.md` is a placeholder (lines 14, 44); GitHub's private vulnerability reporting must first be turned on by the owner (line 12; [hand-off](../handoff/README.md) §2) | Finders, among them testers and the bachelor students, have no private route. HVL: a flaw is public before it is fixed | 3 / 3 | 2 / 3 | 6 Medium / 9 Medium | `SECURITY.md` tells finders not to use issues; the issue chooser sends security problems to the policy (`.github/ISSUE_TEMPLATE/config.yml`) | Before stage 1: the owner turns on private reporting, HVL fills in the address, IT names who receives reports | Repository owner; HVL IT (security) |

### 3.3 Privacy

| ID | Risk | Cause | Consequence, for whom | L | C | Score | Measures in place (evidence) | Further measures | Proposed owner |
|---|---|---|---|---|---|---|---|---|---|
| ROS-10 | A teacher or a student assistant singles out one learner in the insight aggregates | *k*-suppression is subtle: the AI reviews found several ways to work out hidden counts (D-106's amendments; `PROGRESS.md`, S6 step 4); the insight and grade-count residuals R1–R4 and R6–R14 wait for the DPO's decision; Canvas TAs, who can be student assistants, read insight (R36, Q30) | Learners: one student's answers become known. HVL: a breach of `INS-006` and of data minimisation | 1 / 3 | 1 / 3 | 1 Low / 9 Medium | *k* = 5 (never below 3), complementary suppression, periods that end at midnight in Oslo, one course and version at a time, no per-learner endpoint (`INS-006`, D-106); property tests and an exhaustive test (`apps/server/test/insight/insightSuppression.property.test.ts`, `additiveGroupExhaustive.test.ts`); views and exports audited (`DATA-007`) | Human privacy review B1 ([human-review.md](human-review.md)); the DPO decides R1–R4, R6–R14 and R36 (Q22, Q24, Q30) | DPO; system owner |
| ROS-11 | Real personal data enters the test server | A tester uses their own Feide account, a real student is enrolled in the test course, or a screenshot or issue shows a name | Staff and students: their data in a system not approved for it. HVL | 3 / – | 2 / – | 6 Medium / – | The rules in [test-environment.md](test-environment.md) §4; synthetic test data only (`DATA-010`); a required no-personal-data check in each issue form (`.github/ISSUE_TEMPLATE/feil.yml`); learners stored without name or e-mail (`AUTH-004`) | Feide login limited to the test users' organisation (Q29); the developer key only in a test course; a list of named testers; the teardown note ([test-environment.md](test-environment.md) §4) | HVL IT; system owner |
| ROS-12 | Personal data ends up where the design does not expect it | Learners may type names or health details into free text (DPIA R30); authored content can show people (R31); the reverse proxy's access log is outside the app (R26); clamd's own log (R38) | Learners and people named in content. HVL: data in logs and stores without a basis | 2 / 3 | 1 / 3 | 2 Low / 9 Medium | Log redaction by key name at any depth, and a request log of route patterns only (`DATA-009`, `NFR-006`; `logging/redactPersonalData.ts`, `http/requestLog.ts`); gap answers cut to 100 characters (`DATA-012`); the issue forms' required check | Proxy set up as runbook §9 says; logs kept 30 days (`DATA-009`); guidance for authors (ALU); the DPO decides R30, R31 and R38 | HVL IT (operations); DPO |
| ROS-13 | People from outside HVL, possibly school pupils, use the portal | The recommended Feide registration leaves «Restrict login to selected organizations» off (DPIA R37; Q29) | Pupils, possibly children: data stored without a basis checked for them. HVL | 2 / 3 | 2 / 3 | 4 Low / 9 Medium | Users of other organisations become learners only, never authors or admins (`auth/feide/FeideRoleMapper.ts`, D-059) | Decide Q29 at the Feide registration (Q3); in stage 1, allow only the test users' organisation ([test-environment.md](test-environment.md) §3) | HVL IT (Feide administrator); DPO |
| ROS-14 | Data is kept longer than stated | Destroying an ended year's pseudonym secret is a manual step (R15); deleting audit records after 2 years is not built (R27, Q26); no leaver routine for staff (R28, Q27); no named maintainer (ROS-19) | Learners and staff: data kept, or linkable, past its period. HVL: a breach of storage limitation | 1 / 4 | 1 / 3 | 1 Low / 12 High | Yearly purge job with a dry run, an audit event and a start-up warning while a purged year's secret is still set (`DATA-003`, D-107, `privacy/purge/`); the Canvas `sub` cleared 30 days after its job stops (D-104); [yearly-purge.md](../ops/yearly-purge.md) | Put 1 August and the purge date in the maintainer's calendar; decide Q26 and Q27; record each run | Maintainer (to be named); DPO |
| ROS-15 | Data is stored outside the EEA or unencrypted at rest | The app checks settings, not where servers stand (R24); the allowed domains `hvl.no` and `sikt.no` and the AWS region list are marked *(verify)* (`config/storageResidency.ts:31-41`); encryption at rest of the database, Redis and S3 is the provider's, to be confirmed from its facts (DPIA R24; [database-roles.md](../ops/database-roles.md), «These checks catch a wrong setting»); [runbook](../ops/runbook.md) §1 asks for encrypted backup storage, but the §9 checklist has no line of its own for encryption at rest | Learners and staff: data abroad or readable from a lost disk. HVL | 2 / 2 | 1 / 4 | 2 Low / 8 Medium | Production refuses storage outside the EEA allow-list and clear-text connections (`DATA-004`, D-109, `config/connectionEncryption.ts`); the first log line names the hosts and region (`server/main.ts:89-90`) | IT confirms hosting and providers (Q5), encryption at rest of the database, Redis, S3 and backups, and an off-server copy in the EEA (runbook §6); add an encryption-at-rest line to the runbook §9 checklist | HVL IT (operations) |

### 3.4 Legal and compliance

| ID | Risk | Cause | Consequence, for whom | L | C | Score | Measures in place (evidence) | Further measures | Proposed owner |
|---|---|---|---|---|---|---|---|---|---|
| ROS-16 | Real students' data is processed before the DPIA is approved | The DPIA input is complete but the DPO has not reviewed it (Q6; `docs/privacy/DPIA-INPUT.md`, status line); the DPO's questions are open (§13; Q15, Q22, Q25, Q27–Q30) | Learners and staff: processing without a confirmed legal basis. HVL: non-compliance with GDPR Art. 35, an order from Datatilsynet | – / 3 | – / 4 | – / 12 High | The DPIA input with data flows and residuals R1–R40 (`DATA-005`); every stored field in `docs/privacy/DATA-INVENTORY.md`; the privacy notice `/personvern` | The DPO's review and decision before stage 2; `/personvern` corrected where R32 says it differs from what was built | DPO; system owner |
| ROS-17 | Disabled students or teachers cannot use the service | Accessibility is tested automatically in Chromium only (limitation 15); no manual assistive-technology run is recorded (`docs/accessibility/results/README.md`); 26 findings in H5P's own markup are recorded as upstream barriers under D-080 (`PROGRESS.md`, S6 step 8); all 56 verdicts are *Not yet determined* ([conformance report](../accessibility/WCAG-CONFORMANCE-REPORT.md)) | Disabled learners and staff: excluded. HVL: a breach of *forskrift om universell utforming av IKT-løysingar*, which UUtilsynet supervises (`docs/specs/03-hvl-wcag-theme.md`, lines 14–15) | 3 / 4 | 1 / 3 | 3 Low / 12 High | 558 automated accessibility tests (`docs/accessibility/automated-run.json`); run-time repairs of H5P's markup (D-080, `packages/hvl-h5p-theme/src/a11yRepairs.js`); contrast-tested colour tokens (D-017) | The manual protocol (set-ups AT-1, AT-2, AT-3, KB, Z400 and PDF) before stage 2 (`UD-031`, [manual-test-protocol.md](../accessibility/manual-test-protocol.md)); file the upstream reports ([docs/upstream/](../upstream/README.md)) | ALU, with the system owner |
| ROS-18 | Agreements and texts the pilot relies on are missing or unreviewed | No operations agreement yet ([README](README.md)); the content bank's consent text is a draft for HVL's lawyers (Q17); `/personvern` says an admin support action is logged, which is not built (R32); whether HVL's hosting or storage provider needs a data processing agreement depends on Q5 *(IT to fill in)* | HVL: unclear responsibility, a consent that may not hold. Staff whose names the bank shows | 2 / 3 | 1 / 3 | 2 Low / 9 Medium | Drafts and the review packet `docs/reference/alu-review-s5.md`; recipients listed in `docs/privacy/DPIA-INPUT.md` §7 | An operations agreement; legal review of the consent text; processor agreements by HVL's routine | System owner; HVL's lawyers; HVL IT |

### 3.5 Availability and operations

| ID | Risk | Cause | Consequence, for whom | L | C | Score | Measures in place (evidence) | Further measures | Proposed owner |
|---|---|---|---|---|---|---|---|---|---|
| ROS-19 | Nobody at HVL owns or maintains the system | Neither a system owner (*systemeigar*) nor a maintainer (*forvaltar*) is named ([README](README.md), «Who is accountable»; Q31); the bachelor students' project lasts one term, and the hand-off says tasks that need HVL "are not student tasks" ([hand-off](../handoff/README.md) §2) | Everyone: security fixes, image rebuilds, key rotations, the yearly purge and incidents have nobody to handle them | 4 / 4 | 2 / 4 | 8 Medium / 16 Very high | A runbook with the steps for each task ([runbook](../ops/runbook.md) §2–§9); the hand-off index | Name a system owner and a contact for the test install before stage 1, and a maintainer before stage 2; an operations agreement; a patch and rebuild routine | HVL management *(IT to fill in who decides)* |
| ROS-20 | An outage or loss of data | Possibly a single application node *(IT to confirm; runbook §1 allows several)*; `/healthz` checks only the database and Redis (`server/healthRoutes.ts`); the backup tools are not in the image (`deploy/Dockerfile.dockerignore` excludes `tools`); no restore drill or `load:full` on HVL hardware (runbook §6, §8); losing Redis logs everyone out (runbook §1) | Teachers: activities or insight lost before a seminar. Learners: saved progress lost | 3 / 3 | 1 / 3 | 3 Low / 9 Medium | Backup and restore with hashes and a round-trip test (`NFR-002`, `tools/ops/test/backupRoundTrip.test.mjs`); a restore refuses a non-empty target; `/healthz` answers 503 when the database or Redis fails (runbook §7) | A daily encrypted backup with an off-server copy in the EEA and a restore drill each semester (runbook §6); separate checks of S3 and clamd; `load:full` for sizing | HVL IT (operations) |
| ROS-21 | The image is not patched, or is not the image that was built | Security fixes, Chromium's included, reach the install only by rebuilding the image (limitation 17 says so for Chromium; [test-environment.md](test-environment.md) §4); Ubuntu packages, fonts and tini are not version-pinned, and Chromium's hash is printed but not checked against a pinned value (`deploy/smoke/smokeChecks.sh`, `check_chromium`); no workflow publishes or signs an image (`.github/workflows/docker.yml`); GitHub Actions are pinned by tag, not commit (`.github/workflows/ci.yml:84-87`) | Learners and teachers: known flaws in Chromium or the OS left open. HVL: a tampered image | 3 / 3 | 2 / 3 | 6 Medium / 9 Medium | Base images by digest (`deploy/Dockerfile:20,22`); uid 10001, read-only root, every capability dropped but `SYS_CHROOT`, Playwright's seccomp profile ([docker.md](../ops/docker.md)); the PDF's Chromium offline, JavaScript off, every request aborted (`learningDesign/mappe/pdf/PdfRenderer.ts:106,119-120`); `tools/deploy-check`; Dependabot for `/deploy` (`.github/dependabot.yml`); the SBOM ([sbom.cdx.json](sbom.cdx.json)) | Build and sign images in HVL's pipeline or registry *(IT to fill in)*; scan the image with IT's tools; a rebuild routine, for example monthly and on Chromium security releases *(proposal)*; Actions pinned by commit | Maintainer; HVL IT (operations) |

### 3.6 Dependencies and upstream

| ID | Risk | Cause | Consequence, for whom | L | C | Score | Measures in place (evidence) | Further measures | Proposed owner |
|---|---|---|---|---|---|---|---|---|---|
| ROS-22 | Lumi's H5P server has stalled upstream, and CI fails from 2027-01-31 | Lumi's newest npm release is 10.0.4 (2025-03-08) ([lumi-path.md](../handoff/lumi-path.md)); CVE-2025-7062 is unpatched (D-003); two `image-size` advisories are accepted until 2027-01-31 (`tools/dependency-check/audit-exceptions.json`, D-030); Lumi bugs are worked around (D-108, D-110, D-111) | The maintainer: from that date no fix can merge until a choice is made. Learners and teachers: no upstream security fixes | 5 / 5 | 2 / 3 | 10 High / 15 High | Our own file security (D-003); `image-size` reached only through authenticated uploads, after sniffing has refused JXL, HEIF and ICNS (D-030); three choices set out (D-112, lumi-path.md); the release request drafted (`docs/upstream/lumi-release-request.md`) | The owner files the release request now; a D-112 choice before mid-January 2027 (lumi-path.md); stage 1 ends by 2027-01-31 or is extended only after that choice ([test-environment.md](test-environment.md) §4) | Repository owner, then the maintainer |
| ROS-23 | A flaw or leak in an H5P content type reaches every learner | The ten types and their 120 libraries are built from GitHub at pinned commits, three libraries at untagged commits (D-078; `tools/h5p-libraries/libraries.manifest.json`); the bundle's SHA-256 list is not committed (`tools/h5p-bundle/README.md`); an `H5P.AudioRecorder` build once put the build machine's environment into learner JavaScript (R39); upstream bugs such as QuestionSet's retry (Q20) | Learners: the flaw is in every player. Authors: activities break after an update | 3 / 3 | 2 / 3 | 6 Medium / 9 Medium | Core and editor fetched at proved commits and checked file by file against committed SHA-256 lists (`tools/h5p-core/fetchCoreClients.sh`); libraries built in a minimal environment, and the bundle, the seed step and an admin's package import refuse build secrets, as does the check of the installed library folder (D-110 and its amendments of 2026-11-06); only admins install libraries, and each change is audited (`SEC-003`, `H5P-011`); `apps/server/test/h5p/realTypes.browser.int.test.ts` | Build packages only in CI (R39); a human review of each library update; commit the bundle's hash list once builds are reproducible; file the upstream drafts | Maintainer |
| ROS-24 | A vulnerable or compromised npm package | 950 registry packages and our 5 workspaces in `package-lock.json`, 477 of them in a production install on linux-x64 ([sbom.cdx.json](sbom.cdx.json)); Dependabot proposes minor and patch updates only (`.github/dependabot.yml` ignores major versions); ltijs 7 is a recent rewrite (`PROGRESS.md`, R-02) and loads database drivers it never uses (limitation 12); `allowScripts` in the root `package.json` lists three install scripts, but `strict-allow-scripts` is `false` (`npm config ls -l`, npm 11.19.1) and there is no `.npmrc`, so the list may not be enforced *(IT to confirm with npm's documentation)* | Everyone: a flaw or malicious code in the server | 2 / 3 | 2 / 3 | 4 Low / 9 Medium | Every version pinned exactly (`npm run check:pins`); integrity hashes in the lockfile and `npm ci`; `npm run check:audit` fails on high or critical advisories (`SEC-007`); licence check; Dependabot monthly; the SBOM | Run IT's own dependency scanning on the SBOM; consider enforcing install scripts; pin Actions by commit | Maintainer |

### 3.7 Integration with Canvas and Feide

| ID | Risk | Cause | Consequence, for whom | L | C | Score | Measures in place (evidence) | Further measures | Proposed owner |
|---|---|---|---|---|---|---|---|---|---|
| ROS-25 | The real Canvas or Feide behaves differently from the mocks | Every LTI, grade, roster and Feide test runs against `tools/mock-platform` (limitation 5); the live-contract seam has run against the mocks only ([live-contract-seam.md](../handoff/live-contract-seam.md)); values marked *(verify)*, and whether Canvas sends `feide_login` under `privacy_level` `anonymous` is open (Q4) | Teachers and learners: launches fail, roles are wrong, grades are not sent | 4 / 3 | 1 / 3 | 4 Low / 9 Medium | Every HVL value is configuration, not code; `feideLinking` stays off until a test launch (D-063); the seam (`apps/server/live/`) and the acceptance checklist (steps A1–H3) are ready | In stage 1, run the checklist and `npm run test:live` against HVL's test Canvas and real Feide, and record the results in `docs/handoff/results/` ([canvas-acceptance.md](../handoff/canvas-acceptance.md)) | TeCopp; HVL IT (Feide); system owner |
| ROS-26 | Wrong or misleading scores reach the Canvas gradebook | Scores are computed in the browser and can be forged (limitation 1); the grade worker is complex and its claim bug was found late (`PROGRESS.md`, S6 step 3); open defaults for which types send a score (Q18–Q20) and how plays are counted (Q23) | Students: unfair formative scores. Teachers: misled. HVL: scores mistaken for exam evidence | 3 / 3 | 1 / 3 | 3 Low / 9 Medium | Scores labelled formative (`LTI-013`, D-105); the line-item URL limited to Canvas origins (`grades/lineItemUrlPolicy.ts`, D-104); 24 hours of retries and a status panel (runbook §7) | Canvas acceptance steps C2 and D5 (Q8); ALU's choices on Q18–Q20; human review A3 | System owner; ALU; TeCopp |

## 4. Risk matrix

The ID numbers without the `ROS-` prefix. Rows are likelihood, columns consequence.

**Stage 1** (test server, made-up data):

| L \ C | 1 Insignificant | 2 Minor | 3 Moderate | 4 Serious | 5 Critical |
|---|---|---|---|---|---|
| **5** | | 22 | | | |
| **4** | 25 | 19 | | | |
| **3** | 17, 20, 26 | 01, 02, 04, 09, 11, 21, 23 | | | |
| **2** | 03, 07, 12, 15, 18 | 05, 06, 08, 13, 24 | | | |
| **1** | 10, 14 | | | | |

**Stage 2** (pilot, real students):

| L \ C | 1 Insignificant | 2 Minor | 3 Moderate | 4 Serious | 5 Critical |
|---|---|---|---|---|---|
| **5** | | | 22 | | |
| **4** | | | 02, 14, 17 | 19 | |
| **3** | | | 03, 07, 09, 10, 12, 13, 18, 20, 21, 23, 24, 25, 26 | 01, 16 | |
| **2** | | | 04 | 05, 06, 08, 15 | |
| **1** | | | | | |

ROS-11 applies to stage 1 only, and ROS-16 to stage 2 only.

## 5. What this means for each stage

**Before stage 1** (one High, several Medium; proposals for IT to confirm):

- **ROS-22 (High):** set stage 1's end date no later than 2027-01-31, or make one of D-112's choices first.
- **ROS-19 (Q31):** name the system owner, and who owns the test install and rebuilds its image.
- **ROS-04:** deploy only a commit that passed the S6 gate and GitHub CI, `docker.yml` included.
- **ROS-09:** a working private route for security reports.
- **ROS-11:** the rules of [test-environment.md](test-environment.md) §4, with Feide limited to the test users.
- **ROS-01, ROS-21:** IT's review of what it runs (the stage-1 review in [human-review.md](human-review.md) §6) and a
  scan of the image with IT's own tools.

**Before stage 2** (one Very high, six High):

- **ROS-19 (Very high; Q31):** a named system owner and maintainer, and an operations agreement.
- **ROS-01, ROS-02 (High):** the human security review, with its high and medium findings fixed and re-reviewed
  ([human-review.md](human-review.md) §6).
- **ROS-16 (High):** the DPO's approval of the DPIA.
- **ROS-17 (High):** the manual accessibility run recorded in `docs/accessibility/results/`.
- **ROS-14 (High):** a routine for the yearly purge and the secret's destruction, and decisions on Q26 and Q27.
- **ROS-22 (High):** one of D-112's choices made and carried out.
- Every other Medium risk: reduced or accepted in writing by the system owner.

## 6. Taking this draft over

1. Move the risks into HVL's ROS template *(IT to fill in which)*, keeping the `ROS-nn` IDs.
2. Re-score them with HVL's scale and the facts this draft could not know: hosting, network, monitoring, backups,
   who the testers are, and how long the pilot runs.
3. Add the risks of HVL's own platform and services, which are out of scope here (§1).
4. Name an owner for each risk and a date for each further measure; record who accepted what.
5. Re-assess before stage 2, after the human review, and whenever the system changes in a way the README's stage
   table would notice.
6. Change this file's status line to point to HVL's record *(IT to fill in where)*, so that nobody mistakes this draft
   for the approved analysis.
