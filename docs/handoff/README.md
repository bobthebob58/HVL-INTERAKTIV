# Hand-off to HVL's bachelor students (spring 2027)

| | |
|---|---|
| **For** | HVL's bachelor students in programming, spring 2027, and whoever at HVL supervises them |
| **Written** | 2026-11-05, in Session 6, step 7 of the build (D-101 and its amendment of 2026-11-05) |
| **Your project** | Review this AI-written code with your own tools (explainer documents, quizzes, micro-worlds), and finish the Canvas integration against ALU's Canvas test instance |
| **Keep up to date** | [PROGRESS.md](../../PROGRESS.md) is the build's single source of truth; this index points into it and is not updated with every change |

## Samandrag på nynorsk

HVL Interaktiv er eit verktøy for interaktive H5P-aktivitetar til asynkron læring ved HVL. Det er skrive av ein
KI-assistent (Claude) i seks økter hausten 2026, etter spesifikasjonane i `docs/specs/`, og kvar avgjerd står i
`docs/DECISIONS.md`. Dette dokumentet er inngangen for bachelorgruppa i programmering våren 2027. Det seier kva som
er ferdig og kvar de les om det (del 1), kva som ventar på HVL og ikkje på dykk (del 2), kva som går over til dykk,
kvar del med eit designnotat i denne mappa (del 3), kva modular som er mest risikable og difor dei beste måla for
kodegjennomgangen dykkar (del 4), og korleis de set opp prosjektet (del 5). Canvas-integrasjonen er testa berre mot
ein etterlikna Canvas (mock); `apps/server/live/` og sjekklista [canvas-acceptance.md](canvas-acceptance.md) er
verktøya for å stadfeste han mot testinstansen til ALU. Resten av dokumentet er på engelsk, som utviklardokumentasjonen
elles.

## How to read this repository

Start with the [root README](../../README.md), then [CLAUDE.md](../../CLAUDE.md) (the rules every change follows,
written for the AI assistant but binding for anyone), then the part of the code you are reviewing. Five kinds of
document answer "why is it like this?":

| Question | Where |
|---|---|
| What must the system do? | `docs/specs/00`–`05`, each requirement with an ID such as `LTI-012`, a priority and the session that builds it |
| Why was it built this way? | [docs/DECISIONS.md](../DECISIONS.md), D-001…D-115, each with context, decision, alternatives, consequences and dated amendments |
| Which code and which tests belong to a requirement? | [docs/TRACEABILITY.md](../TRACEABILITY.md) (generated), and the spec site `docs/site/index.html` (open it in a browser) |
| How is a package laid out? | The module map in each README: [apps/server](../../apps/server/README.md), [apps/web](../../apps/web/README.md), `packages/*/README.md`, `tools/*/README.md`, [content/README.md](../../content/README.md) |
| What is the state, and what did each gate prove? | [PROGRESS.md](../../PROGRESS.md): the checklist, the open questions Q1–Q30, the risk register and every gate's output |

Every source file starts with a module header (What, Why, Spec, Invariants, Collaborators, Tests), every export has
TSDoc, and non-obvious lines carry a tag: `SECURITY:`, `PRIVACY:`, `A11Y:`, `PEDAGOGY:`, `UPSTREAM:`, `WHY:` or
`SPEC-DEVIATION:` ([DOCUMENTATION-STANDARD.md](../DOCUMENTATION-STANDARD.md)). `grep -rn "SECURITY:" apps/` is a
tour of the security-relevant lines. Test titles start with the requirement they prove, so
`npx vitest run -t "INS-006"` runs one requirement. The [Evaluator Guide](../EVALUATOR-GUIDE.md) §2 shows how to
check one requirement end to end, and §6 lists the known limitations honestly.

## 1. What is done

Each session ended with a gate (the Evaluator Guide §5) whose output is pasted in PROGRESS.md. Requirement IDs link
to the specs through TRACEABILITY.md.

| Session | Built | Requirements | Read first |
|---|---|---|---|
| S0 (2026-10-16) | The six specifications, the documentation standard, the Evaluator Guide, the traceability tool and the spec site | `DOC-*` | `docs/specs/`, `tools/spec-trace/`, `tools/spec-site/` |
| S1 (2026-10-21) | The monorepo (Node 24, TypeScript, npm workspaces), the database schema, H5P Core 1.28 behind Lumi's server half, configuration, log redaction, learner pseudonyms, three languages, doc-lint and the dependency checks, CI | `PROD-012`, `NFR-004`, `NFR-005`, `H5P-001`, `H5P-004`, `SEC-005`, `SEC-007`, `DATA-001`, `DATA-002`, `DATA-009`, `DOC-*` | D-023…D-034; `apps/server/src/config`, `src/privacy`, `src/logging` |
| S2 (2026-10-23) | Exactly ten content types, offline seeding, the SVG sanitiser and magic-byte checks (CVE-2025-7062 is unpatched in Lumi 10.0.4), our permission system, learner state | `PROD-002`, `PROD-008`, `H5P-002`, `H5P-003`, `H5P-005`, `H5P-006`, `H5P-008`, `H5P-011`, `SEC-001`…`SEC-004`, `SEC-008` | D-035…D-046; `src/security`, `src/h5p` |
| S3 (2026-10-23) | Feide login (OpenID Connect with PKCE), LTI 1.3 with ltijs 7 on our own router and storage, Deep Linking, sessions, linking a teacher's Canvas and Feide accounts, end-to-end tests in Chromium with third-party cookies blocked | `PROD-004`…`PROD-006`, `H5P-007`, `AUTH-001`…`AUTH-005`, `LTI-001`…`LTI-007`, `DOC-012`; of `LTI-005` and `LTI-007` the portal-side parts only: the bank and "new from a pattern" in the picker, the duplicate in `/app/play` and its insight tab pass to you (section 3) | D-048…D-066; `src/auth`, `src/lti`, `tools/mock-platform` |
| S4 (2026-10-24) | Design tokens, the HVL H5P theme, the WCAG 2.2 AA suite, the pre-publish validator, the Next.js web app inside the Express server, «Sjekk og publiser» | `PROD-003`, `PROD-011`, `NFR-003`, `H5P-009` (theme part), `UD-*` (S4), `PED-020`, `DATA-006`, `DATA-011` | D-047, D-067…D-081; `packages/design-tokens`, `packages/hvl-h5p-theme`, `apps/web`, `src/validation`, `apps/server/a11y` |
| S4+ (2026-10-25) | A whole-code-base simplification pass: 59 changes, every test kept | — | PROGRESS, «S4+» |
| S5 (2026-10-30) | The læringsdesign studio: guide, nine patterns, planner, co-authors, the content bank, duplicating, safe editing, the pedagogisk mappe (Markdown and PDF) | `PROD-001`, `PROD-007`, `PROD-009`, `PROD-013`, `PED-*` (but `PED-020`), `MAPPE-001`…`MAPPE-004` | D-082…D-100; `src/learningDesign`, `content/` |
| S6 (in progress) | The xAPI → Canvas grade bridge, teacher insight with *k*-suppression, the privacy operations (yearly purge, data-subject requests, database roles, production checks, request log, DPIA input), operations (Docker image, compose smoke test, a separate files origin, ClamAV, backups, a load harness, the conformance report), the HVL language overlay, problem reporting for the pilot, upstream drafts, this index | `LTI-008`, `LTI-010`…`LTI-013`, `DATA-012`, `INS-001`…`INS-003`, `INS-005`…`INS-010`, `PROD-010`, `DATA-003`…`DATA-005`, `DATA-007`, `DATA-008`, `DATA-010`, `NFR-001`, `NFR-002`, `NFR-006`, `NFR-007`, `SEC-006`, `UD-040`, `H5P-010` | D-101…D-115; `src/xapi`, `src/grades`, `src/insight`, `src/privacy`, `src/h5p/languageOverlay` with `content/h5p-tekstar/`, `deploy/`, `docs/ops/`, `docs/privacy/`, `docs/testing/`, `docs/upstream/` |

S6's gate had not run when this index was written; PROGRESS.md says whether it has passed. Not built at all:
`PROD-014` (COULD, a spaced-retrieval suggestion), `LTI-009` and `INS-004` (section 3). TRACEABILITY.md marks a
requirement *tested* once one test names it, so it does not show what is only partly built, such as `LTI-005`'s
picker parts above.

## 2. What needs HVL, not you

These need a person or a system at HVL. They are not student tasks, but several block parts of the pilot, and your
review should not report them as defects. The full text of each question is in PROGRESS.md, «Open questions and
blockers».

| Who | What | Questions and requirements |
|---|---|---|
| **HVL IT and TeCopp (Canvas)** | Feide registration and redirect URIs; the developer key in the test and production Canvas, its client and deployment IDs, which instance TeCopp uses, whether `feide_login` arrives under `privacy_level` `anonymous`; the `hvl_placement` custom field | Q3, Q4, Q13 |
| **HVL IT (hosting)** | On-premises or Sikt, in the EEA; a container runtime that allows Playwright's seccomp profile and `CAP_SYS_CHROOT` for the PDF export; a DNS name and certificate for `files.<host>`; a clamd with daily signatures and `AlertExceedsMax` and `AlertEncrypted` turned on (without them clamd calls files it could not scan in full clean, D-110); a leaver routine for staff accounts; deleting audit records after two years; who may log in with Feide | Q5, Q26, Q27, Q29; [docs/ops/runbook.md](../ops/runbook.md) §9 (the deployment checklist) |
| **HVL's data protection officer** | The legal basis and the DPIA ([docs/privacy/DPIA-INPUT.md](../privacy/DPIA-INPUT.md), residuals R1–R40); learner launches missing from the authentication audit; grade-sync counts that are not *k*-suppressed; research use; objections; students as insight readers | Q6, Q15, Q22, Q25, Q28, Q30 |
| **ALU and Pedagogisk akademi** (with HVL and TeCopp for Q2) | The derived reference inputs and their originals (logo files, the ALU model document, the mappe guidance); the studio's drafts (phase texts, guide, patterns, mappe template and criteria, the bank's consent text); "(formativ)" in Canvas assignment names; content-type scores; `uv-case` and `uv-module`'s retry; package patch versions; student authors; the publish flow; insight's freshness; the language overlay's Nynorsk and Bokmål texts and the Panopto guidance, with HVL's language advisers (then `status: reviewed`; whether the guidance names HVL's Panopto address; whether the remaining English editor labels are worth translating) | Q2, Q8, Q9, Q12, Q14, Q17–Q20, Q24; [docs/reference/alu-review-s5.md](../reference/alu-review-s5.md), [content/h5p-tekstar/README.md](../../content/h5p-tekstar/README.md) |
| **The repository owner** | Network access for the build (Q7), committing seed packages (Q10), container builds outside the proxy (Q21), one link's plays or all (Q23); before the pilot: the GitHub labels, HVL's security contact in [SECURITY.md](../../SECURITY.md), private vulnerability reporting, the pilot's contact person for testers, and the two GitHub claims marked *(verify)* in [labels-and-triage.md](../testing/labels-and-triage.md); filing the drafts in [docs/upstream/](../upstream/README.md) and sending the security reports held outside the repository privately; rotating tokens that an old AudioRecorder build exposed; watching GitHub's first run of `docker.yml` after a push | Q7, Q10, Q21, Q23; D-101's and D-112's amendments of 2026-11-05 |
| **HVL, by hand** | The manual accessibility run with screen readers and browsers, and the 56 verdicts of the conformance report; the 200-learner load test on HVL's hardware; the restore drill; during the pilot, the server's log lines for problems seen only in HVL's Canvas or Feide (HVL IT), a re-test of each issue labelled `treng HVL-test` before it closes, and the review and merge of every fix's pull request | `UD-031`, `NFR-003`, `UD-040`, `NFR-001`, `NFR-002`; [docs/accessibility/manual-test-protocol.md](../accessibility/manual-test-protocol.md), `npm run load:full`, [docs/ops/runbook.md](../ops/runbook.md) |

One date matters to everyone: the `image-size` audit exceptions (D-030, R-08) expire on **2027-01-31**, early in your
term. After that `npm run check:audit`, and so CI, fails until one of D-112's three choices is made
([lumi-path.md](lumi-path.md)).

## 3. What passes to you

Each item has a design note beside this index. A note states what is known, the options with a recommended default,
the tests it would need and what must be decided first. It decides nothing: by CLAUDE.md §1, a choice gets its
decision (or an amendment) in `docs/DECISIONS.md` before code, and the owner or HVL approves decisions that change
what the product does.

| Item | Note | Priority and why it is yours |
|---|---|---|
| **The live-contract seam and the Canvas acceptance checklist**: confirm what the mocks assume against ALU's test Canvas and real Feide | [live-contract-seam.md](live-contract-seam.md), [canvas-acceptance.md](canvas-acceptance.md), [apps/server/live/README.md](../../apps/server/live/README.md) | First. Every Canvas test so far ran against the mock; this is "finish the Canvas integration" |
| **The Canvas side of the studio** (D-098): the content bank and "new from a pattern" in the Deep Linking picker, and the `LTI-007` duplicate in `/app/play` | [canvas-studio.md](canvas-studio.md) | `LTI-005` (MUST) names both picker parts; J1's Canvas half waits for them |
| **LTI Dynamic Registration** (`LTI-009`, COULD) | [dynamic-registration.md](dynamic-registration.md) | Needs a Canvas administrator to try; a security-sensitive endpoint |
| **Branching paths** (`INS-004`, SHOULD), deferred by D-115 | [branching-paths.md](branching-paths.md) | Needs a probe of BranchingScenario first |
| **Insight's freshness** (Q24) | [insight-freshness.md](insight-freshness.md) | Only if the owner and ALU choose the alternative |
| **The research export** (Q25), designed in [docs/privacy/research-export.md](../privacy/research-export.md) | [research-export.md](research-export.md) | Only after the DPO's approval |
| **The simplification check** (S6 plan step 10, if S6 does not reach it) | [simplification-check.md](simplification-check.md) | Fits your review project directly |
| **The Lumi path** before 2027-01-31 (D-112) | [lumi-path.md](lumi-path.md) | CI turns red on that date unless a choice is made |
| **The pilot's issues**: triage and fixes of what testers report | [docs/testing/labels-and-triage.md](../testing/labels-and-triage.md), [docs/testing/rapportere-problem.md](../testing/rapportere-problem.md) | Privacy first (health text, image attachments), then the severity label, a reproduction with test data, a failing test, the gate, a pull request with `Refs:` and `Fixes #n`; H5P's own barriers through D-080 (a repair in `a11yRepairs.js` or `a11yEditorRepairs.js`, a register entry for what axe reports, a D-080 amendment and an `upstream pin:` test for what it cannot see). `tools/issue-forms` keeps the forms, labels and guides in step |
| **HVL's language overlay** (D-111): the remaining English in `nn` and `nb` | [content/h5p-tekstar/README.md](../../content/h5p-tekstar/README.md) | The editor labels outside MultiChoice, QuestionSet, InteractiveBook and BranchingScenario, the `H5PEditor.*` libraries' strings and the less common sub-content types; keep the entries current when a pinned library changes (`content:check` names each changed English text); once HVL has reviewed them, offer the texts to H5P's own language files (D-112) and remove the entries H5P then ships |
| **Upstream links after filing** (D-112) | [docs/upstream/README.md](../upstream/README.md) | Once the owner has filed a draft, its link goes where that README says (the register, the repairs' and workarounds' `UPSTREAM:` tags); InteractiveVideo's untranslatable end-screen summary is one of them. When Lumi fixes `alterLibraryLanguageFile`, consider replacing the overlay's storage wrapper with Lumi's hook (its `UPSTREAM:` tag) |

Also open, and smaller: the items under «Still open» in PROGRESS.md's S6 steps 5, 6 and 7 (for example the mappe not
yet reading the purge's snapshots, or narrowing or retiring the cookie-authenticated `/h5p/content/…` route on the app
origin, D-110). Each names its owner.

## 4. Suggested review targets

Your project is to review this code with your own tools. These modules carry the most risk, because a defect there
leaks personal data, lets one user act as another, or sends wrong grades, and because each rests on reasoning that is
easy to get subtly wrong. For each: why it is risky, what to try, and which tests claim to prove it. Treat every test
as a claim to be checked, not as proof: mutation testing (change a line, see whether a test fails) was used on every
S6 workstream, and repeating it with your own tools is a good first exercise.

| Module | Why it is risky | What to try | Tests that claim it |
|---|---|---|---|
| ***k*-suppression of insight** (`apps/server/src/insight/suppression/`, `aggregate/gapMisconceptions.ts`, `scope/insightPeriod.ts`; the mappe's `learningDesign/mappe/storedActivityResults.ts` and `activityResults.ts`) | A teacher must never learn one student's answers. Hiding cells below *k* = 5 is not enough: complements, sums across sections, two periods or two versions can give a hidden count back (differencing). Reviews found and fixed several such paths: the next-smallest-cell rule, `INS-002`'s share, periods that ended at the request, and the mappe beside insight (D-106's amendments of 2026-11-04 and 2026-11-05) | Write your own differencing attacks: two views a day apart, a course of exactly *k* + 1, a gap answer that only one learner gave, the CSV against the tab, the mappe against insight | `test/insight/insightSuppression.property.test.ts` (fast-check), `additiveGroupExhaustive.test.ts`, `thirtyLearners.test.ts` (hand-calculated), `insightPeriodEnd.int.test.ts`; DPIA residuals R3, R6–R14 |
| **The grade worker** (`apps/server/src/grades/`: claims, the send, retries, the reconcile pass, the line-item URL rule) | It runs without a user, holds the tool's signing key and a learner's Canvas ID, and decides what lands in the gradebook. Its claim query (`FOR UPDATE SKIP LOCKED`, one leased node at a time) already hid one bug that only the full server run found: PostgreSQL could claim more jobs than the limit (PROGRESS, S6 step 3) | Race two workers; replay statements; make Canvas answer 401, 404, 429 and 5xx; check that `sub` is deleted 30 days after a job stops; check that no URL from a launch can send the token elsewhere | `test/grades/` (worker, faults, flood, refusals, reconcile, subject cleanup), `e2e/xapiToCanvas.e2e.test.ts`; the live seam against the real Canvas |
| **The files origin** (`src/http/filesOriginRouter.ts`, `routes/signedFileRoutes.ts`, `h5p/HvlUrlGenerator.ts`, `h5p/contentFileGrants.ts`, `src/security/`) | Authors upload files; CVE-2025-7062 (stored XSS through uploads) is unpatched in Lumi 10.0.4, so our SVG sanitiser, magic-byte checks and a separate sandboxed origin are the defence. The editor's files stay on the app origin (`SPEC-DEVIATION: D-110`) | Upload polyglots, SVGs with scripts in every form, HTML disguised as images; request files without a grant, with a grant for another activity, with odd paths (NUL bytes were one finding); check every header | `test/security/`, `test/http/filesOrigin.int.test.ts`, the SVG fixtures and their README |
| **The xAPI bridge** (`packages/hvl-h5p-theme/src/xapiBridge.js`, `xapiBatching.js`, `xapiStatements.js`; server `src/xapi/`) | Learner data enters here, from the browser, where a student can forge anything. The server must store only what D-115 allows, never a preview's statements, and must keep a forged batch from becoming another learner's result | Send batches by hand (forged actors, replays, huge or deep JSON, prototype keys, another course's IDs); play every content type and compare what is stored with D-115's table | `test/xapi/`, the probes `test/h5p/xapiQuestionTypes.browser.int.test.ts` and `xapiContainerTypes.browser.int.test.ts`, `e2e/xapiPortal.e2e.test.ts`; D-102, D-115 |
| **The LTI launch** (`src/lti/launch/`, `ltikPrincipal.ts`, `LtiRoleMapper.ts`, `storage/PrismaLtiDatabaseManager.ts`, `platforms/LtiDeploymentGuard.ts`, `src/auth/requestPrincipal.ts`) | A launch turns a signed message from Canvas into a user with roles. ltijs 7 does not check the deployment ID or the platform's active flag (D-050, D-051); we do. A launch must never grant `admin`, and the ltik (a bearer token) must never reach a URL or a log after landing | Forge launches with the mock (wrong `aud`, foreign key, replayed nonce, unknown deployment, `Administrator` roles); look for the ltik in logs, Referer and history | `test/lti/ltiLaunch.int.test.ts`, `test/lti/ltikPrincipal.int.test.ts`, `test/lti/LtiRoleMapper.test.ts`, `e2e/ltiIframe.e2e.test.ts` |

Good second targets: the H5P permission system (`src/h5p/HvlPermissionSystem.ts`, `h5p/permissions/`), the
pseudonyms and key rings (`src/privacy/deriveLearnerKey.ts`, `src/security/keys/`), log redaction
(`src/logging/redact*.ts`), and the run-time accessibility repairs of H5P's markup (`packages/hvl-h5p-theme/src/a11yRepairs.js`,
D-080).

## 5. How to set up

| Where | How | Notes |
|---|---|---|
| **GitHub Codespaces** (easiest) | [.devcontainer/README.md](../../.devcontainer/README.md): create a codespace with 4 cores, wait 20–30 minutes for `setup.sh`, then `bash .devcontainer/start.sh` | Open it in VS Code on your own computer, not the browser editor: the mock Feide and mock Canvas need `localhost` ports |
| **Your own machine** | Node.js 24, Docker; then the commands under «How to run» in [apps/server/README.md](../../apps/server/README.md) (services, H5P core, Prisma, Chromium, content types) | The ten real content types come from GitHub at pinned commits (`npm run h5p:fetch-libraries`, about 2 GB) |
| **CI** | `.github/workflows/ci.yml` (the session gate on every pull request and on `main`, including the live-contract seam against the mocks, `LIVE_TARGET=mock npm run test:live`) and `docker.yml` (the image and the app stack's smoke test) | `main` is protected: a pull request and a green «Session gate» are required |
| **A test server for ALU's Canvas** | The image in `deploy/` ([docs/ops/docker.md](../ops/docker.md)) or `npm start` on an https host; `LTI_PLATFORMS`, `CANVAS_ORIGINS` and the developer key as in [docs/reference/canvas-platform-values.md](../reference/canvas-platform-values.md) §1 | Never with real student data: test accounts in a test course only (`DATA-010`) |

The commands you will use most are in [CLAUDE.md](../../CLAUDE.md) §3. Problems found during the pilot come in through
GitHub's issue forms ([docs/testing/rapportere-problem.md](../testing/rapportere-problem.md),
[docs/testing/labels-and-triage.md](../testing/labels-and-triage.md)); a fix starts with a test that fails.

## Ground rules for changing the code

- The invariants in CLAUDE.md §1 are not suggestions: exactly ten content types, no `api.h5p.org`, SVGs sanitised on
  both upload paths, learners as pseudonyms only, groups under *k* suppressed, colours only from the design tokens,
  feedback never by colour alone, every UI string in `nn`, `nb` and `en`.
- A decision or an amendment first, then code marked with `SPEC-DEVIATION:` where it differs from a spec.
- A test that fails before the fix, titled with its requirement ID; the area's tests and the gate after.
- No personal data anywhere outside the product's own storage: not in issues, fixtures, logs, screenshots or this
  folder's results.
