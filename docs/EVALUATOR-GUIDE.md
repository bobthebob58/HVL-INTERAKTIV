# Evaluator Guide

This guide is for people who review HVL Interaktiv without having built it: ALU learning
designers, TeCopp administrators, security and privacy reviewers, examiners and external code
reviewers. It explains how to check, efficiently and independently, that the code does what the
specifications promise.

**Current state (2026-11-05):** Sessions 1–3 passed their gates on 2026-10-23, Session 4 (universal design) on
2026-10-24 and Session 5 (the læringsdesign studio) on 2026-10-30. Session 6 (the grade bridge, insight, the privacy
operations and deployment) started on 2026-10-30 (D-101) and is built, integrated and documented; its review and its
gate (§5) have not run yet. What it does not reach, and what only HVL can verify (limitation 23), passes to HVL's
bachelor students through the [hand-off index](handoff/README.md). Session 1 built the monorepo, `apps/server`
foundations and the tools `spec-trace`, `spec-site`, `doc-lint`, `dependency-check`, `privacy` and `h5p-core`.
Session 2 added the H5P engine with the ten types, the permission system, learner state, upload security, seeding
and our own H5P routes. Session 3 made the server a running service (`npm start`): Feide login for the portal,
Canvas LTI 1.3 launches through ltijs 7, Deep Linking, Canvas–Feide account linking and the sharing API behind one
`Principal`, tested against the mock Feide and mock Canvas in `tools/mock-platform` (limitation 5). Session 4
brought the ten real content types from GitHub at pinned commits (D-078, R-01 settled in D-047), strict script
policies on every page type (D-070), the web app `apps/web` (Next.js inside Express, D-067, D-068) with the activity
pages, the publish flow and the Canvas chrome page `/app/play`, the design tokens and the HVL H5P theme, the
pre-publish validator (22 rules), and the accessibility suite `npm run test:a11y` (D-079, D-080). Session 5 added
the læringsdesign studio of spec 04, in the portal only (its Canvas side passed to the students in S6, limitation
20): the public guide and pattern catalogue on `/laeringsdesign` with ALU's texts loaded from `content/` and checked
by `npm run content:check` (D-082, D-083); nine patterns that create a draft activity with marked guidance (`⟦…⟧`,
rule V-PLACEHOLDER; D-084–D-086); the **Læringsdesign** tab with outcomes, rationale, time and purpose, and the
alignment planner (D-087, D-088); co-authors, the content bank and copies on the **Deling** tab (D-090–D-092); a
save choice in the editor so that a structural change does not silently reset students' progress (D-093); and the
pedagogisk mappe export as Markdown and as a tagged PDF printed by Chromium on the server (D-094–D-096). Its texts
are drafts for ALU (Q17, limitation 16). Session 6 added the xAPI bridge in the learner's player page and the grade
passback to Canvas through our own AGS client in a durable worker (D-102–D-105, D-115), teacher insight as an
**Innsikt** tab with *k*-suppression and fixed periods (D-106), the yearly purge, data-subject requests, database
roles and the production checks (D-107–D-109), the Docker image with a separate files origin and ClamAV, backups and
the load harness (D-110, D-114), the conformance report (`UD-040`), HVL's Nynorsk and Bokmål texts for H5P's own
buttons (D-111), problem reporting for the pilot and the drafts owed upstream (D-112), and end-to-end tests of the
five user journeys. Build progress is tracked in [PROGRESS.md](../PROGRESS.md). Commands marked *(from S<n>)* below
arrive with that session.

---

## 1. Orientation in 20 minutes

Prefer a browser? `docs/site/index.html` holds the same documents as one searchable page, with a
requirement explorer. Regenerate it with `node tools/spec-site/buildSpecSite.mjs`.

| Minutes | Read | You will know |
|---|---|---|
| 3 | [README](../README.md) | What the service is and how the repository is organised |
| 6 | [Spec 00 §1–§4](specs/00-product-and-pedagogy.md) | Who it is for, the five user journeys, and the pedagogical principles |
| 2 | [GLOSSARY](GLOSSARY.md) | The Norwegian terms used in code and UI (*forarbeid*, *læringsutbytte*, …) |
| 4 | [DECISIONS](DECISIONS.md) | What was decided, including where the build deliberately departs from the original plan, and why |
| 3 | [apps/server README](../apps/server/README.md) | How to run the server against the mock platform, what each folder does, and the start-up, Feide login, LTI launch and Deep Linking flows |
| 2 | [content/README.md](../content/README.md) *(from S5)* | What ALU edits without code (phases, guide, patterns, mappe template and criteria) and how `npm run content:check` catches mistakes; the review packet for ALU is [reference/alu-review-s5.md](reference/alu-review-s5.md) |
| 2 | [TRACEABILITY](TRACEABILITY.md) | Which requirements are planned, in code or tested |

**To see it run** *(from S3; the web app and the real content types from S4)*: set up the services, the H5P files
and `apps/server/.env` as for `npm start` (§3; `.env.example` already holds the mock's values and `WEB_APP=dev`),
start `npm run mock:platform` in one terminal and run `npm start` in another. The mock Canvas home page
(`http://127.0.0.1:4100/`) offers demo launches into the tool, and the start page (`http://localhost:3000/`)
offers Feide login against the mock Feide. The Hub's seed packages are not in the repository (Q7, Q10), so install
the real content types first: `npm run h5p:fetch-libraries`, then `npm run seed:libraries -- var/h5p-real/packages`
(D-078). Then sign in (the mock Feide signs in its `author`), create an activity at `/aktivitet/ny`, save it and
publish it from **Sjekk og publiser**; the mock Canvas can then launch it by the ID in its address
(`/aktivitet/<id>`) or place it through Deep Linking. With `WEB_APP=prod`, run `npm run build` first. The e2e tests
(`npm run test:e2e`) create their own activities and show the whole flows in a browser. Details:
[tools/mock-platform/README.md](../tools/mock-platform/README.md).

**The studio** *(from S5)*: with the server running as above, `/laeringsdesign` shows the guide, the phase matrix and
the pattern catalogue to anyone, signed in or not, and each pattern has a page `/laeringsdesign/monster/<id>` (for
example `fa-video`). Signed in as the mock `author` (HVL staff), «Lag frå dette mønsteret» creates a draft and opens
its **Rediger** tab; the activity page also has the **Læringsdesign** and **Deling** tabs. Give a few activities a
course code, a phase and outcomes, then open `/laeringsdesign/planlegg` (the planner), list a published activity
shared with HVL in the bank from its **Deling** tab and open `/laeringsdesign/innhaldsbank`, and choose activities
on `/mappe` to download the portfolio as Markdown and as PDF. The PDF needs a Chromium the server can start:
`npx playwright-core install chromium` (or `PDF_BROWSER_EXECUTABLE`), and, in a container that runs as root, the
development-only `PDF_ALLOW_NO_SANDBOX=true` in `apps/server/.env` (D-096); without it the PDF button answers that the
PDF is unavailable and points to the Markdown file, which always works. A banner on the studio pages says their
texts are drafts until ALU confirms them (Q17).

---

## 2. Checking one requirement end-to-end

Every requirement has an ID such as `SEC-001`. The same ID appears in the spec heading, in the
code (`Spec:` header or `@spec` tag) and in test titles (`[SEC-001] …`). To verify one:

```bash
# 1. Read what is promised (statement, acceptance criteria, verification method)
grep -n "SEC-001" docs/specs/*.md

# 2. Find the implementation and read its module header: what, why, invariants, tests
grep -rln "SEC-001" apps packages tools --include=*.ts --include=*.tsx

# 3. Run exactly the tests that claim to prove it                         (from S1)
npx vitest run -t "SEC-001"

# 4. Confirm the matrix agrees and nothing references an unknown ID
node tools/spec-trace/specTrace.mjs --check
```

Things to judge as you go: Do the acceptance criteria in the spec match what the test actually
asserts? Does the module header's *Invariants* section match the code? Is every `SECURITY:`,
`PRIVACY:`, `A11Y:` and `PEDAGOGY:` comment justified?

**"Tested" is not "verified" for the two manual requirements.** [TRACEABILITY](TRACEABILITY.md) calls a requirement
*tested* as soon as one test title carries its ID. For `UD-031` and `NFR-003` that test is
`apps/server/a11y/accessibilityDocs.a11y.test.ts`, a check of documents. It proves that the manual protocol scripts
J1–J4 for the five set-ups `UD-031` names, that the `NFR-003` matrix names every browser and screen reader of the
requirement and only suites that exist, and that every file in `docs/accessibility/results/` has a dated name. It
does not prove that anyone has run the protocol, that a browser other than Chromium works, or that a screen reader
announces anything: it passes while the results folder holds no result. Both requirements are documented protocols
whose results HVL records (D-079); `UD-031`'s own check, a dated result file for the release, stays an open item in
[PROGRESS.md](../PROGRESS.md) until HVL's first run.

---

## 3. Commands *(available now unless a later session is noted)*

| Command | What it proves |
|---|---|
| `node tools/spec-trace/specTrace.mjs --check` | Specs are internally consistent; traceability is current |
| `node tools/spec-site/buildSpecSite.mjs --check` | The spec website matches the Markdown |
| `docker compose up -d` | PostgreSQL, Redis and an S3 emulator start locally (D-023). The mock Feide and mock Canvas (`tools/mock-platform`) are not compose services: tests start them in-process, and `npm run mock:platform` runs them for manual use (D-049) |
| `npm ci && npm run db:generate --workspace apps/server && npm run typecheck` | The monorepo installs and compiles from a clean checkout; the Prisma client is generated, not committed |
| `npm run build` *(from S4)* | Builds `apps/web` (Next.js) and regenerates the token and theme files; needed before `WEB_APP=prod`, the e2e flows that use the web app and `npm run test:a11y` |
| `npm run typecheck && npm run lint` | Types and lint |
| `npm run doc:lint` | The Documentation Standard, checked by machine (`DOC-001`–`003`, `005`–`010`, `013`, `014`; `DOC-004` is `spec:trace`, `DOC-011` the commit-msg hook) |
| `npm run privacy:inventory-check` | The data inventory matches the database schema (`DATA-001`) |
| `npm run h5p:fetch-core && npm run boot-check --workspace apps/server` | H5P client files are the verified 1.28 release; the engine would start (`H5P-001`); needs no services or `.env` |
| `npm test` | Unit and integration tests (Vitest). Generate the Prisma client first (row above). Integration tests also need `docker compose up -d`, `npm run db:migrate` and `apps/server/.env` copied from `.env.example` (D-023); they start the mock Feide and mock Canvas themselves. Browser tests need full Chromium (`npx playwright-core install chromium`, never `--only-shell`, D-065) |
| `npm run mock:platform` *(from S3)* | A mock Canvas on `http://127.0.0.1:4100` and a mock Feide on `http://localhost:4200` start for a tool on `http://localhost:3000`, and the six `.env` lines that point the server at them are printed (D-049); Ctrl+C stops both. `.env.example` already holds these values for the fixed ports; paste the printed lines into `apps/server/.env` only after changing ports or IDs (the mock Feide refuses another client ID with `unauthorized_client`; [tools/mock-platform/README.md](../tools/mock-platform/README.md)) |
| `npm start` *(from S3)* | The server starts: tsx runs `apps/server/src/server/main.ts` (no build step), which syncs `LTI_PLATFORMS`, re-encrypts platform keys, starts the cleanup jobs and listens on `PORT`. With `npm run mock:platform` running, `curl http://localhost:3000/healthz` answers `{"status":"ok"}` and `/lti/keys` the tool's public keys. Needs the setup of `npm test` plus `npm run h5p:fetch-core`; a bad configuration exits with code 1 and names the variables, never their values (`NFR-002`) |
| `npm run test:e2e` *(from S3)* | Chromium flows against the whole server and the mock platform (D-065), in CI too: from S3, launch → play → answer → reopen in the cross-site Canvas iframe with third-party cookies blocked (checked by a canary), once with stock Chrome's partitioned frame storage and once with frame storage blocked (LTI Platform Storage), plus our error page when neither is available (`ltiIframe.e2e.test.ts`); the Deep Linking round trip, whose signed answer the mock Canvas accepts with a line item (`deepLinking.e2e.test.ts`); portal Feide login, sharing with the CSRF token, and logout through Feide (`portalSharing.e2e.test.ts`). These play a synthetic content type (limitation 3). From S4: the owner edits and saves in the H5P editor inside the cookie-less Canvas iframe with the Bearer ltik (`ltiEditor.e2e.test.ts`); on the built web app with the real content types, a Feide author is refused without a reason and then publishes despite a validator error with one, which stores one ValidationAcknowledgement and leaves no reason in the audit or the log (`publishWithReason.e2e.test.ts`, PROD-003, UD-022); and the teacher's Canvas page `/app/play` with Spel and Rediger, where frame storage is blocked (LTI Platform Storage), saves from the editor inside its chrome with the teacher's ltik as Bearer, with no Set-Cookie from the tool and no ltik in any frame address (`appPlayEditor.e2e.test.ts`, LTI-006, LTI-003). A failed step names itself, what failed before it (ltik redacted) and whether another process removed its rows (`flowRecord.e2e.test.ts` tests this); a closed test bed removes what it created and keeps an account an earlier run left (`testbedCleanup.e2e.test.ts`). From S5, on the built web app: J1's portal part from the filtered catalogue through a pattern, a filled placeholder and the learning design to publishing with reasons (`patternToPublish.e2e.test.ts`); a colleague's copy from the content bank (`bankDuplicate.e2e.test.ts`); both mappe downloads with nothing stored (`mappeDownloads.e2e.test.ts`); and a confirmed reset of a Canvas student's saved progress (`safeEditReset.e2e.test.ts`). From S6: a Canvas student's right answer through the xAPI bridge, the grade queue and the worker to the mock Canvas's gradebook, and a portal preview that stores nothing (`xapiToCanvas.e2e.test.ts`, `xapiPortal.e2e.test.ts`); and the teacher's **Innsikt** tab in `/app/play` showing six learners of one course, two of another course as «< 5», a learner refused and another course's teacher kept to their own course (`insightInCanvas.e2e.test.ts`); the player's files from the files origin with no cookie, ltik or Referer, and a crafted SVG that never runs (`filesOrigin.e2e.test.ts`); a learner's export and erasure and the yearly purge through the operations CLIs, on what a real launch stored (`learnerDataRights.e2e.test.ts`); and the journeys of spec 00 §3, in part (D-101's amendment of 2026-11-05, S6 step 8): J1's Canvas half, a portal activity placed as an assignment and its score in the gradebook, without «new from a pattern», which passes to the students (limitation 20; the portal half is `patternToPublish` and `publishWithReason`) (`journeyPlaceInCanvas.e2e.test.ts`); J2's steps 1–3 on a phone 320 px wide, resumed the next evening (`journeyPhoneResume.e2e.test.ts`; step 4 is the manual protocol's); J3, where the tab writes an option's count, not step 2's share (`journeySeminarInsight.e2e.test.ts`); J4's Markdown export (`journeyPortfolio.e2e.test.ts`); and J5's step 1 only, ALU's edit of the content files (`journeyGovernance.e2e.test.ts`), its step 2 being HTTP tests (`packageImport.int.test.ts`, `ajax.int.test.ts`) and a runbook procedure ([ops/runbook.md](ops/runbook.md) §2). Needs the setup of `npm test`; the web app flows also need `npm run build` and `npm run h5p:fetch-libraries` (skipped without them locally, failing in CI). Run it without other test processes on the same database |
| `npm run test:a11y` *(from S4)* | axe-core (WCAG 2.2 AA tags) on every web route, the server pages and the player and editor of all ten real types, in the light theme and with forced colours, plus reflow at 320 px, reduced motion, text spacing and 200 % zoom, keyboard walks (focus visible and not covered), target size, `lang` and first-party requests (`UD-030`, D-079). H5P's own findings are repaired at run time or listed in `apps/server/a11y/support/upstreamRegister.ts` (D-080). From S5 every check also walks the studio's pages, signed in with seeded data (a pattern page, the planner with gaps, the bank, `/mappe` with a word count, the **Læringsdesign** and **Deling** tabs, a copy's page), plus keyboard scripts of the studio's journeys and the editor's save choice dialog with the page around it inert (`axeStudioViews`, `keyboardStudioJourneys`, `axeSaveChoice`). From S6 also the **Innsikt** tab (with «< 5» cells, the projection dialog and print) and the **Poeng til Canvas** tab (scores in every state, a keyboard retry), in the portal and in `/app/play` (`axeInsight`, `axeGradeSync`, and every view walk through `support/dataTabViews.ts`); the Deep Linking picker's no-score note on a graded placement (`axeServerPages`, `support/noScoreActivity.ts`); and a MultiChoice and a QuestionSet made in Nynorsk with HVL's language overlay, in the player and the editor (`support/nynorskActivities.ts`). Needs `npm run build`, the real packages and Chromium; about 15 minutes; run it on its own |
| `npm run h5p:fetch-libraries` *(from S4)* | Clones the ten content types and their dependencies at pinned commits, builds those without committed files and verifies every tree against `tools/h5p-libraries/libraries.manifest.json` (D-078); a cached checkout is reused only while its `HEAD` is still the pinned commit, which CI's cache of the checkouts relies on |
| `npm run tokens:check && npm run lint:css` *(from S4)* | The committed token CSS matches `tokens.json`; no colour literal, upper case or justified text in any stylesheet (`UD-001`, `UD-002`, D-072) |
| `npx vitest run -t "UD-0"` *(from S4)* | The tokens' contrast pairs, the theme inside H5P, the validator rules with their fixtures, the publish flow (`-t "PROD-003\|UD-022"`), the notices (`-t "PROD-011\|DATA-006\|DATA-011"`) and the pedagogical hints (`-t "PED-020"`) |
| `WEB_APP=dev npm start` *(from S4)* | With `npm run mock:platform`: `/`, `/hjelp`, `/personvern` and, outside production, `/api/docs` (the OpenAPI document, `DOC-012`). From S5 also the studio (§1, *The studio*): `/laeringsdesign` and a pattern page signed out, and signed in the planner `/laeringsdesign/planlegg`, the content bank `/laeringsdesign/innhaldsbank` and `/mappe`, whose Markdown and PDF downloads both arrive |
| `npm run content:check` *(from S5)* | ALU's files in `content/` load exactly as the server loads them at start-up: phases, references, the guide in nn, nb and en (closed Markdown, same headings, markers and citations), the patterns and the mappe template and criteria. Every mistake is printed with its file, line and key, and the command fails; the `✓` line summarises what loaded (`PED-001`, `PED-011`, `MAPPE-002`, D-082). With the pinned content types installed (`npm run h5p:fetch-libraries`; CI always has them) it also checks each skeleton's library versions, keys and field lengths. CI runs it, and so does the pre-commit hook when a file under `content/` is staged. Needs no services |
| `npx vitest run -t "PED-0"` *(from S5)* | The studio: phases and labels from content, the guide's node tree and its refusals, the catalogue filters in the address, the patterns on the real types, the **Læringsdesign** tab's routes and limits, the planner's gaps and the time and purpose learners see (`PED-001`…`PED-032`). Also `-t "PROD-001\|PROD-009"` (creating from a pattern; formative defaults), `-t "PROD-007\|PROD-013"` (co-authors, the bank and copies; the save choice and its reset) and `-t "MAPPE-"` (the portfolio; its PDF tests need Chromium). The integration tests among them need the services and the real packages |
| `npm run spec:trace -- --check --done-through=S<n>` | Every MUST requirement up to session *n* has a test |
| `npm run check:filesize` | No source file over 200 lines (`DOC-007`) |
| `npm run check:audit` | No unreviewed high or critical advisory in production dependencies (`SEC-007`, D-029) |
| `npm run check:pins && npm run check:licences` | Exact pins; GPL-3.0-compatible licences (`SEC-007`, `NFR-005`) |
| `npm run docs:api` *(from S2)* | Browsable API documentation builds with no warnings (TypeDoc; `DOC-002`) |
| `npx vitest run -t "H5P-002\|PROD-002"` *(from S2)* | Only the ten types are creatable; DragQuestion is never offered |
| `npx vitest run -t "SEC-003\|H5P-011\|H5P-006"` *(from S2)* | Non-admins cannot install libraries; every library change is audited; the permission matrix |
| `npx vitest run -t "SEC-001"` *(from S2)* | The SVG corpus is neutralised and benign drawings render identically (needs Chromium) |
| `npx vitest run -t "AUTH-00"` *(from S3)* | Feide login against the mock Feide: PKCE, state and nonce in a single-use login transaction, the ID-token checks, roles from the Groups API (failing closed), portal sessions and CSRF, data minimisation, and Canvas–Feide account linking (`AUTH-001`…`AUTH-005`). Needs the services |
| `npx vitest run -t "LTI-00"` *(from S3)* | LTI 1.3 against the mock Canvas: launches and their refusals (foreign signature, replay, unknown deployment), ltijs storage on PostgreSQL, the cookie-less ltik transport, role mapping that never grants `admin`, Deep Linking with a JWT the mock verifies, resource links and course copy (`LTI-001`…`LTI-007`). Needs the services |
| `npx vitest run -t "PROD-004\|PROD-005\|PROD-006\|H5P-007"` *(from S3)* | One 404 page for unknown, draft and invisible activities; placing activities in Canvas; sharing that applies at once, only for those who may edit; H5P AJAX and learner-state calls refused without an ltik or CSRF token, and signed content-file URLs. Needs the services |
| `npm run seed:libraries` *(from S2)* | Installs the content types offline from the verified seed packages (`H5P-003`); needs the packages (Q7). From S4, `npm run seed:libraries -- var/h5p-real/packages` installs the real types that `npm run h5p:fetch-libraries` built (D-078) |
| `npm run privacy:dpia-check` *(from S6)* | The DPIA input has its 13 sections, its §6 matches the Canvas developer key (privacy level, scopes, every placement's custom fields), and its residuals R1…Rn are whole and every one cited exists (`DATA-005`, the document check of D-113) |
| `npx vitest run -t "DATA-0"` *(from S6)* | The privacy operations: the yearly purge and its dry run (`DATA-003`), the production checks for TLS and the EEA (`DATA-004`), the DPIA check (`DATA-005`), the append-only audit (`DATA-007`), the data-subject CLI (`DATA-008`), the database roles on a throwaway database (`DATA-010`) and the xAPI fields (`DATA-012`); needs the services and a local PostgreSQL superuser for the role tests |
| `npm run --silent privacy:purge -- --dry-run` *(from S6, in `apps/server`)* | What the yearly purge would delete and write, as counts per table and year; nothing is deleted, and the run is audited (`DATA-003`, D-107, [ops/yearly-purge.md](ops/yearly-purge.md)) |
| `npx vitest run apps/server/test/privacy/operationsClis.int.test.ts` *(from S6)* | The operations CLIs together, each through its npm script, on a database only they set up: `db:roles` (roles and the migrate step), a data-subject export, the purge's dry run and real run as `hvli_app`, then an erasure; every run audited with counts only (`DATA-010`, `DATA-003`, `DATA-008`, `DATA-007`) |
| `npm run deploy:check && npm run docker:smoke` *(from S6)* | The deploy files keep D-110's rules (images by digest, uid 10001, no GitHub fetch, the CA only as a secret, Playwright's seccomp profile, only `SYS_CHROOT` added back); then the image builds and the app stack (`deploy/compose.app.yml`, with its own clamd) starts: `/healthz`, every migration, the seeded types, pages from the image, an upload scanned by clamd (EICAR refused) and served from the files origin with the sandbox policy, the mappe PDF tagged A4 with æ, ø and å embedded and Chromium's sandbox seen in `/proc`, and the server's own start-up probe line (`NFR-007`, `SEC-006`, `SEC-004`, `MAPPE-004`; [ops/docker.md](ops/docker.md)). Needs Docker, about 8 GB free and 2.5 minutes; GitHub runs it in `.github/workflows/docker.yml` |
| `npx vitest run tools/ops` *(from S6)* | The backup round trip on the local services: back up, wipe, restore and compare every table's count and an object's SHA-256; a tampered backup, a non-empty target and a backup that differs are refused or reported (`NFR-002`, [ops/runbook.md](ops/runbook.md) §6) |
| `npm run load:smoke` *(from S6)* | k6 2.3.0 (by digest, in Docker) against the whole app on one node with the mock Canvas and the ten real types: 20 learners for 30 s, each a real launch, the player page with its assets, xAPI batches and state saves; exit 0 only when every threshold holds (`NFR-001`, D-114; `npm run load:full` is HVL's 200-learner run, [ops/runbook.md](ops/runbook.md) §8) |
| `npm run a11y:report -- --check` *(from S6)* | The conformance report `docs/accessibility/WCAG-CONFORMANCE-REPORT.md` matches its sources (the 56 WCAG 2.2 A/AA criteria, axe-core's rules, the committed run summary, the protocol and the upstream register), with HVL's manual blocks kept byte for byte (`UD-040`, D-079's amendments) |
| `npx vitest run -t "H5P-008\|H5P-010"` *(from S6)* | HVL's language overlay (D-111): the path resolver and merge keep every key H5P ships, `libraryStrings` included, for every real entry on the pinned libraries; a stale `en` is skipped; `content:check` refuses markup, a straight `"`, an unknown field or string and a changed English text; the start-up hands its texts to the engine; a real `nn` player names QuestionSet's and MultiChoice's controls in Nynorsk and a real `nb` editor shows the overlay's labels, while English is unchanged; the Panopto guidance in nn, nb and en (`H5P-010`). The browser tests need Chromium and the real types |
| `npm run test:live` *(from S6)* | The live-contract seam (`apps/server/live/`, D-101): with nothing set, only its configuration and guard tests run (the checks are skipped); with `LIVE_TARGET=mock` (as in CI) every check passes against the mock Canvas and mock Feide; with the `LIVE_CANVAS_*` and `LIVE_FEIDE_ISSUER` variables it checks ALU's test Canvas and real Feide, which only HVL or the students can run ([handoff/canvas-acceptance.md](handoff/canvas-acceptance.md)) |
| `npx vitest run tools/issue-forms` *(from S6)* | The pilot's GitHub issue forms, chooser and label list are valid for GitHub and in step with each other and with the tester guide: the privacy confirmation required, blank issues off, the ten types by their Nynorsk names, the protocol's set-ups, one repository in every link (`NFR-004`, `DATA-010`, D-101's amendments) |
| `NODE_USE_ENV_PROXY=1 npm run hub:check` *(from S2)* | Spike step 3: Hub registration status, the 15-character `local_id`, versions of the ten types |

---

## 4. Evaluation rubric

For each area: what *good* looks like, where to look, and the red flags that should fail a review.

### 4.1 Pedagogical fitness: does it help teachers help students learn asynchronously?
- **Good:** Teachers start from patterns (`PED-010`), not a blank list. Defaults are formative:
  retries on, no timers (`PROD-009`). Hints nudge towards short segments and explanatory feedback
  (`PED-020`). Insight answers "what should I address in the next session?" (`INS-002`, `INS-003`).
- **Look at:** `content/laeringsdesign/` (the guide, the phases and the nine patterns with their skeletons),
  `apps/server/src/learningDesign/patterns/`, `apps/server/src/validation/rules/*Hint.ts` and
  `placeholderRule.ts`, and the **Innsikt** tab on the activity page and in `/app/play` *(from S6; one activity, one
  context and one fixed period at a time, no separate page, D-101, D-106; the code is in `apps/server/src/insight/`
  and `apps/web/src/features/insight/`)*. In the studio *(from S5)*: the guide on
  `/laeringsdesign`, whose research claims cite `references.yaml` (`PED-002`); each pattern's page, with when to
  use it, why it works and the times it asks of authors and students (`PED-010`); a new activity from a pattern,
  whose guidance «⟦…⟧» the check reports until the author replaces it (D-086); the **Læringsdesign** tab, which asks
  for outcomes and a rationale before publishing without blocking it (`PED-030`); the planner's gaps
  (`PED-031`); and the pedagogisk mappe, which turns that rationale into the author's own teaching portfolio
  (`MAPPE-002`). What ALU and the pilot teachers are asked to judge is listed in
  [reference/alu-review-s5.md](reference/alu-review-s5.md).
- **Red flags:** Thresholds without a `PEDAGOGY:` reference. Hints that *block* publishing. Insight
  that ranks individual students. Pattern text that is not editable without code (`PED-011`). A phase label
  written in code rather than read from `phases.yaml` (`PED-001`). A research claim in the guide or a pattern
  without a citation. A pattern whose skeleton turns retries or «Vis svar» off or sets a timer (`PROD-009`).
  Students' scores presented in the mappe as evidence of learning rather than as formative aggregates (`MAPPE-003`).
- **Best evidence:** Pilot results against the success measures in spec 00 §8, and ALU's review of the studio's
  drafts (Q17).

### 4.2 Accessibility (WCAG 2.2 AA and HVL house rules)
- **Good:** All colour comes from tokens, with a contrast test (`UD-001`). Feedback shows text and an
  icon (`UD-003`). Two-tone focus ring (`UD-004`). The validator blocks missing alt text and
  captions unless acknowledged (`UD-021`, `UD-022`). axe runs inside H5P iframes (`UD-030`). Manual
  screen-reader results are recorded (`UD-031`). The portfolio PDF is tagged, with an outline, a language and a
  title (`MAPPE-004`), and what Chromium cannot tag is checked by hand with PAC and NVDA (D-096, protocol J4).
- **Look at:** `packages/design-tokens/`, `packages/hvl-h5p-theme/`, `docs/accessibility/`.
- **Red flags:** Hex colours outside the tokens package. `outline: none` without a replacement.
  `!important` without a `WHY:` comment. `H5P.DragQuestion` creatable anywhere.

### 4.3 Security
- **Good:** Every SVG is sanitised on **both** upload paths (`SEC-001`). User files are served from a
  separate origin with `CSP: sandbox` (`SEC-004`). Non-admins can never install library code
  (`H5P-006`, `SEC-003`). An LTI launch never grants `admin` (`LTI-004`). The ltik is stripped from
  URLs and logs (`LTI-003`). Nonces are consumed atomically (`LTI-002`).
- **Look at:** `grep -rn "SECURITY:" apps packages`, `apps/server/src/security/`,
  `HvlPermissionSystem.ts`, `apps/server/src/lti/`.
- **Red flags:** `LaissezFairePermissionSystem` anywhere. `localStorage` holding an ltik. A
  `^`-ranged runtime dependency. An `npm audit` exception without an expiry date.

### 4.4 Privacy (GDPR)
- **Good:** Learners exist only as HMAC pseudonyms (`DATA-002`). No insight cell under *k* = 5 (`INS-006`,
  backed by a property test). Yearly purge with secret destruction (`DATA-003`). The data inventory
  matches the schema (`DATA-001`). Logs are redacted (`DATA-009`). No third-party requests (`DATA-011`). Staff names
  reach colleagues only through co-author search and the content bank, which `/personvern` says (D-090, D-091), and
  the portfolio export shows learners only as aggregates of at least *k* and stores nothing (`MAPPE-003`, D-095).
  *(From S6)* Insight views end at the latest Oslo midnight and never cross 1 August, and Canvas's test student
  never counts (D-106's and D-102's amendments). Data-subject requests are a CLI that HVL operations run, audited
  with counts only (`DATA-008`, D-108). The app's database role can only append to the audit tables, and the
  analytics role reads *k*-suppressed views only (`DATA-010`, D-109). Production refuses clear-text connections and
  storage outside the EEA list (`DATA-004`). The request log names route patterns and a request ID only (`NFR-006`).
- **Look at:** `docs/privacy/` (the inventory, the DPIA input with its residuals R1–R40, the research-export design),
  `docs/ops/` (the runbooks), `apps/server/src/privacy/` (with `purge/` and `dsr/`), `apps/server/prisma/roles/`,
  `apps/server/src/config/connectionEncryption.ts` and `storageResidency.ts`, `apps/server/src/http/requestLog.ts`,
  `apps/server/src/insight/`, `apps/server/prisma/schema/`.
- **Red flags:** Learner names or e-mails in any table. An endpoint returning per-learner rows to
  teachers. `actor.name` or `mbox` persisted from xAPI. A learner key, identity hash, Feide ID or `sub` in an audit
  event, a CLI's output or a log line. A purge that selects rows by timestamp instead of their stored year (D-107).

### 4.5 Interoperability (Canvas and Feide)
- **Good:** A Playwright test passes with third-party cookies blocked (`LTI-003`). Deep Linking returns
  a valid signed JWT (`LTI-005`). AGS sync is durable, idempotent and visible to teachers (`LTI-012`).
  Feide roles follow the table in `AUTH-002`.
- **Look at:** `apps/server/src/lti/`, `apps/server/src/grades/`, `apps/server/src/auth/`, the mock platform in `tools/mock-platform/`.
- **Red flags:** Values marked *(verify)* in spec 02 still unverified at Session 3's gate. Grade sync
  happening inside the request path.

### 4.6 Code quality and documentation
- **Good:** Every file has a module header that answers the five questions in the
  [Documentation Standard](DOCUMENTATION-STANDARD.md). Tests read as specifications. Files are under
  200 lines. Every decision is logged.
- **Red flags:** Files called `utils.ts` or `helpers.ts`. Comments that restate code. `TODO`
  without a session or requirement reference. Hard-coded UI strings.

---

## 5. Session gates

Each Claude Code build session ends with a deterministic gate. The gate must pass, and its output
must be pasted into `PROGRESS.md`, before the next session starts.

| Session | Gate |
|---|---|
| S1 | `npm run typecheck`, `npm run lint`, `npm run doc:lint`, `npx vitest run` (services up), `spec:trace --check --done-through=S1`, the inventory, pin, licence and audit checks pass; the boot check logs Core 1.28 and hub-api.h5p.org (or a recorded R-01 fallback decision) |
| S2 | Only the ten types are creatable; non-admins cannot install libraries; the SVG corpus is neutralised; `--done-through=S2` passes |
| S3 | Every S1 and S2 gate command stays green; the mock-OIDC and mock-LTI integration tests pass (`-t "AUTH-00"`, `-t "LTI-00"`, and each S3 requirement on its own with `-t "\[<ID>\]"`); `npm run test:e2e` passes its three Chromium flows (D-065): the cookie-less Canvas iframe launch → play → resume with third-party cookies blocked, the Deep Linking round trip whose signed JWT the mock Canvas accepts, and portal sharing with logout; `npm start` against `npm run mock:platform` answers `/healthz` and `/lti/keys`; `--done-through=S3` passes; the still open *(verify)* items (Q3, Q4) and owner questions (Q12–Q15) are listed with the gate output |
| S4 | Every S1–S3 gate command stays green; `npm run build`, `npm run tokens:check`, `npm run lint:css` and `npm run h5p:fetch-libraries` pass; `npm run test:a11y` passes: no serious or critical axe violation on our own pages (web routes and server pages), and inside the player and editor of all ten types none beyond the registered upstream entries (D-080); contrast and validator tests pass (`-t "UD-0"`, `-t "PED-020"`, `-t "PROD-003\|UD-022"`, `-t "PROD-011\|DATA-006\|DATA-011"`, and each S4 requirement with `-t "\[<ID>\]"`); `npm run test:e2e` passes with the S4 flows; `--done-through=S4` passes; `WEB_APP=dev npm start` shows `/`, `/hjelp`, `/personvern` and `/api/docs`; what stays manual (`UD-031`, `NFR-003`) and the open owner items (Q2 logo and token confirmation, Q6 privacy text) are listed with the gate output |
| S5 | Every S1–S4 gate command stays green: among them `npm run build`, `npm run tokens:check`, `npm run lint:css`, `npm run h5p:fetch-libraries`, `npm run test:a11y` (now with the studio's pages and the editor's save choice dialog), `npm run test:e2e` (now with the S5 flows: pattern → publish, bank copy, both mappe downloads, safe-edit reset) and the S2–S4 `-t` filters; `npm run content:check` passes on the real `content/`; `npx vitest run -t "PED-0"`, `-t "PROD-001\|PROD-009"`, `-t "PROD-007\|PROD-013"` and `-t "MAPPE-"` pass, and so does each S5 requirement on its own with `-t "\[<ID>\]"` (`PED-001`, `PED-002`, `PED-003`, `PED-010`, `PED-011`, `PED-030`, `PED-031`, `PED-032`, `PROD-001`, `PROD-007`, `PROD-009`, `PROD-013`, `MAPPE-001`, `MAPPE-002`, `MAPPE-003`, `MAPPE-004`); `npm run spec:trace -- --check --done-through=S5` passes; `WEB_APP=dev npm start` against `npm run mock:platform` shows `/laeringsdesign`, a pattern page, the planner, the content bank and `/mappe`, and both exports (Markdown and PDF) download; the ALU and pilot review is recorded as requested and open (Q17, D-100, packet [reference/alu-review-s5.md](reference/alu-review-s5.md)), and the other open items are listed with the gate output: the bank consent text (ALU and HVL legal), the manual PDF check with PAC and NVDA, the Canvas side of the studio (S6, D-098), results in the mappe (S6, D-095), and Chromium with æøå fonts in the S6 image (D-096) |
| S6 | The full form (D-113), **run in parts of under 2 hours**, each a tracked background task, with the output saying which part ran where (here, or GitHub CI's run on the gate commit, cited by its run ID). **Every S1–S5 gate command stays green:** `npm run typecheck`, `lint`, `format:check` and `lint:css`; `npm run doc:lint` and `check:filesize`; `npm run check:pins`, `check:licences` and `check:audit`; `npm run privacy:inventory-check`; `npm run h5p:fetch-core`, `h5p:fetch-libraries` and `boot-check --workspace apps/server` (Core 1.28 and hub-api.h5p.org); `npm run build` and `tokens:check`; `npm run content:check`; `npm run spec:site -- --check` and `docs:api`; `npx vitest run` with the services up (`npm test`); `npm run test:e2e`, now with the S6 flows and the five user journeys of spec 00 §3 (J1's Canvas half without «new from a pattern», which passes to the students, limitation 20); `npm run test:a11y`, now with the **Innsikt** and **Poeng til Canvas** tabs in the portal and in `/app/play`, the picker's no-score note and activities made in Nynorsk with HVL's language overlay; the S2–S5 filters (`-t "H5P-002\|PROD-002"`, `-t "SEC-003\|H5P-011\|H5P-006"`, `-t "SEC-001"`, `-t "AUTH-00"`, `-t "LTI-00"`, `-t "PROD-004\|PROD-005\|PROD-006\|H5P-007"`, `-t "UD-0"`, `-t "PED-020"`, `-t "PROD-003\|UD-022"`, `-t "PROD-011\|DATA-006\|DATA-011"`, `-t "PED-0"`, `-t "PROD-001\|PROD-009"`, `-t "PROD-007\|PROD-013"`, `-t "MAPPE-"`); and every S3–S5 per-ID run. **S6's filters:** `npx vitest run -t "LTI-01"`, `-t "INS-0"`, `-t "DATA-0"`, `-t "NFR-00"` and `-t "H5P-008\|H5P-010"`. **Each S6 requirement on its own**, `npx vitest run -t "\[<ID>\]"`, every run selecting at least one test: `LTI-008`, `LTI-010`, `LTI-011`, `LTI-012`, `LTI-013`, `INS-001`, `INS-002`, `INS-003`, `INS-005`, `INS-006`, `INS-007`, `INS-008`, `INS-009`, `INS-010`, `PROD-010`, `DATA-003`, `DATA-004`, `DATA-005`, `DATA-007`, `DATA-008`, `DATA-010`, `DATA-012`, `NFR-001`, `NFR-002`, `NFR-006`, `NFR-007`, `H5P-010`, `SEC-006` and `UD-040`, and the two S2 requirements S6 rebuilt, `SEC-004` (the files origin) and `H5P-008` (the language overlay); the S6 IDs not built have no run and are listed so: `INS-004` (deferred by D-115), `LTI-009` (a design note only, D-101, [handoff/dynamic-registration.md](handoff/dynamic-registration.md)) and `PROD-014` (a COULD, not built). **IDs tested only in the accessibility suite** run as `npm run test:a11y -- -t "\[<ID>\]"`: `NFR-003` and `UD-031`, whose document check is `accessibilityDocs.a11y.test.ts` (their root runs select only the issue forms' checks); no S6 ID is tested only there (2026-11-05), and the S6 IDs that also have accessibility tests (`INS-003`, `INS-008`, `LTI-012`, `PROD-010`) run in the full `npm run test:a11y`. The AGS tests against the mock Canvas pass within `-t "\[LTI-012\]"` (success, 5xx retry, 404 orphaned, idempotency, coalescing, the token round trip). The live-contract seam passes skipped (`npm run test:live`) and against the mocks (`LIVE_TARGET=mock npm run test:live`). The real-clamd tests pass against a clamd with `AlertExceedsMax` and `AlertEncrypted` on (`CLAMAV_TEST_HOST`, [ops/clamav.md](ops/clamav.md)), and `npm run load:smoke` passes every threshold (`NFR-001`). `npm run spec:trace -- --check --done-through=S6` passes. **Docker:** `npm run deploy:check` and the smoke `npm run docker:smoke` (`deploy/smoke/dockerSmoke.sh`: the image builds, the app stack with its own clamd starts, an upload is scanned and served from the files origin, the mappe PDF prints with æ, ø and å under Chromium's sandbox) pass here, and GitHub's `.github/workflows/docker.yml` passes on the gate commit, cited by its run ID. **The conformance report:** the gate's full accessibility run is recorded (`npm run a11y:report -- --run`, or `-- --from-run=<dir>` for a run made with `A11Y_REPORT_DIR`, as [tools/a11y-report/README.md](../tools/a11y-report/README.md) shows), which rewrites the committed run summary and the report's automated parts and keeps HVL's manual blocks byte for byte; `npm run a11y:report -- --check` then passes. **The DPIA input:** `npm run privacy:dpia-check` passes. **The document checks** for `DATA-004` (the deployment checklist, [ops/runbook.md](ops/runbook.md) §9), `DATA-005` (the DPIA input), `DATA-010` (the database roles), `NFR-002`'s restore drill (runbook §6) and `UD-040` (the 56 verdicts) are listed with the output as *verified by document review, not by HVL until HVL acts* (the table below). **The running server:** `WEB_APP=dev npm start` against `npm run mock:platform` answers `/healthz` and `/lti/keys`, shows the S4 and S5 pages and both mappe downloads, and after a launch from the mock Canvas the **Innsikt** tab and **Poeng til Canvas** in `/app/play` and on the activity page. **Listed as open with the output:** Q2–Q8, Q13, Q15, Q17 and Q18–Q21 (D-113 and its amendment), with the questions S6 raised since (Q22–Q30); the confirmation against HVL's real Canvas and Feide (`npm run test:live` with the `LIVE_*` variables and [handoff/canvas-acceptance.md](handoff/canvas-acceptance.md)); the 200-learner load test (`npm run load:full`); the restore drill on HVL's hardware; the manual assistive-technology run and the 56 verdicts (`UD-031`, `UD-040`); the DPO's review (Q6); and `docker.yml`'s first run on GitHub if the gate cites none (limitation 23). CI moves to `--done-through=S6` once the gate passes |

**How S6's privacy and operations requirements are verified.** Some can be checked here only as documents or as
start-up refusals (D-113): they are *verified by document review and by these tests, not by HVL until HVL acts*, and
the gate output lists them so (limitation 23).

| Requirement | Verified here by | Not verified until |
|---|---|---|
| `DATA-003` Yearly purge | `-t "\[DATA-003\]"`: the purge with time travel at 31 July, 1 August and 31 August in Oslo time, the dry run, idempotency, the current year untouched, a login that races it (`test/privacy/purge/`, `test/auth/identity/accountPurgeRace.int.test.ts`), and the CLI's real run on a fresh database (`operationsClis.int.test.ts`) | HVL operations destroy the ended year's pseudonym secret ([ops/yearly-purge.md](ops/yearly-purge.md), step 4) |
| `DATA-004` Data in Norway or the EEA | `-t "\[DATA-004\]"`: production refuses clear-text database, Redis and S3 connections, storage outside the EEA list, a bucket variable that is not a plain bucket name (an access point or Outposts ARN would route past the list; `bucketNameProblems` in `test/config/storageResidency.test.ts`) and the AWS SDK's own endpoint variables (`test/config/`, `test/infra/s3Client.test.ts`, `test/server/main.smoke.test.ts`); `npm run db:roles` refuses a clear-text URL to a database on another host before it connects (`test/db/databaseRolesTls.test.ts`); document review of [ops/database-roles.md](ops/database-roles.md) | HVL names its hosting (Q5) and the deployment checklist ([ops/runbook.md](ops/runbook.md) §9) is ticked against the start-up line `deployment locations` |
| `DATA-005` DPIA input | Document review of [privacy/DPIA-INPUT.md](privacy/DPIA-INPUT.md); `npm run privacy:dpia-check` and `-t "\[DATA-005\]"` compare it with the developer key and the inventory | HVL's data protection officer has reviewed it (Q6) |
| `DATA-007` Audit | `-t "\[DATA-007\]"`: `purge.run`, `dataSubject.export` and `dataSubject.erase` with counts, years and fixed words only; the app role cannot change or delete audit rows (`test/db/databaseRoles.int.test.ts`, `auditAppendOnly.test.ts`) | The 2-year deletion of audit rows is built (no job yet; Q26, DPIA R27) |
| `DATA-008` Data-subject requests | `-t "\[DATA-008\]"`: export and erasure in two years and under both pseudonym variants, the operator check, the dry run, a failed or interrupted run, and both through `npm run privacy:dsr` on a fresh database | HVL's DPO approves the routine; a Canvas admin confirms how to read a user's `lti_id` *(verify)* |
| `DATA-010` Database roles | `-t "\[DATA-010\]"`: each role logs in to a throwaway database and may run only its statements; the migrate step (`views-down`, migration, `grants`); `db:roles` on a new database | HVL's database administrator runs `01-roles.sql` on the real database |
| `NFR-006` Request log | `-t "\[NFR-006\]"`: one line per request with the route pattern, status and duration, an `X-Request-Id` that a client cannot fill with text of its choice, and no ltik, learner key or activity ID in any line through a whole launch, play and xAPI batch (`test/http/requestLog*.test.ts`); the LTI error pages log their route pattern and a fixed code, never the path or a client's text (`test/lti/http/ltiErrorLog.test.ts`) | The reverse proxy's access log leaves out the query string (deployment checklist) |
| `NFR-001` Performance | `npm run load:smoke` (20 learners for 30 s, here: page ready p95 1.1–1.5 s against 3 s, API p95 22–27 ms against 300 ms, no failed request) and `-t "\[NFR-001\]"` (the k6 profiles, batches and summary in `tools/load/test/`) | HVL runs `npm run load:full` (200 learners) on a node like production ([ops/runbook.md](ops/runbook.md) §8); Lighthouse on Fast 4G is not added (D-114) |
| `NFR-002` Availability, backups | `-t "\[NFR-002\]"`: the backup round trip and the restore's refusals (`tools/ops/test/`), the health check and clean start and stop (`test/server/`); document review of [ops/runbook.md](ops/runbook.md) §6 | HVL schedules the daily backup with its encrypted off-server copy and logs the restore drill each semester |
| `NFR-007` Docker | `npm run docker:smoke` here (2026-11-05, on the integrated tree: passed in 155 s) and in GitHub's `docker.yml`; `-t "\[NFR-007\]"` (`tools/deploy-check`, `tools/h5p-bundle`) | `docker.yml`'s first run on GitHub (Chromium from Playwright's CDN, its SHA-256, AppArmor); HVL's runtime allows the seccomp profile and `CAP_SYS_CHROOT` (Q5) |
| `SEC-004` Files origin | `-t "\[SEC-004\]"`: headers, files-origin-only serving, expiry, other activities refused, CORS, the editor's own grants (`test/http/filesOrigin.int.test.ts`, `editorFiles.int.test.ts`), the page policies, and `e2e/filesOrigin.e2e.test.ts` in full Chromium (images and captions from the files origin, no cookie or ltik sent, a scripted SVG never runs); the image's smoke serves an uploaded file from `files.localhost` | HVL's DNS name and certificate for the files host (Q5, deployment checklist) |
| `SEC-006` Malware scanning | `-t "\[SEC-006\]"`: fail-closed on both upload paths against a fake clamd, the start-up rules, the clamd settings probe (strict and lax fakes); the real-clamd tests with `CLAMAV_TEST_HOST`, and against a clamd without the alert settings with `CLAMAV_TEST_LAX_PORT` (CI's `clamav` and `clamav-lax` services); `npm run clamd:check`; the image's smoke against the stack's clamd | HVL runs clamd with daily signatures and TLS ([ops/clamav.md](ops/clamav.md)) |
| `UD-040` Conformance report | `npm run a11y:report -- --check` and `-t "\[UD-040\]"` (`tools/a11y-report/test/`): every criterion present, manual blocks kept, no verdict without a dated HVL evaluation, a failed or partial run never recorded as passed | HVL/ALU run the manual protocol, set the 56 verdicts (each with a dated `**Evaluated by HVL:**` line, or the generator stops) and write the uustatus.no notes (`UD-031`) |

---

## 6. Known limitations (stated honestly)

1. **Scores are computed in the browser.** H5P scoring cannot be made tamper-proof. HVL Interaktiv
   is for formative use only (`LTI-013`, `PROD-011`).
2. **Upstream accessibility.** Some barriers are inside H5P content types and can only be fixed
   upstream. The conformance report (`UD-040`) lists them with links to the upstream code. No issue is filed yet:
   the reports are drafted in [upstream/README.md](upstream/README.md) for the owner to file (D-112), and each
   link goes into the register once filed.
3. **The H5P Hub is still unreachable; real content types come from GitHub** (D-078, D-047). The ten content types
   and their dependencies are cloned at pinned commits and verified file by file; all ten install through the seed
   path, play, open in the editor and save under Core 1.28 and Lumi 10.0.4 (R-01 settled). Hub registration and
   the Hub's own packages stay untested while hub-api.h5p.org is unreachable from the build environment (Q7); the
   S3 end-to-end flows still use a synthetic content type, the S4 flows and the accessibility suite the real ones.
4. **Institutional reference material is not yet in the repository** (see
   [reference/README.md](reference/README.md)). Labels, brand colours and portfolio headings are
   therefore kept in configuration, so they can be corrected without code changes.
5. **Feide and Canvas are tested against mocks only; HVL's own values are open.** Feide login and the
   Canvas tool run end to end, but only against `tools/mock-platform` (D-049): HVL's Feide client and redirect
   URIs (Q3) and TeCopp's developer key, client ID and deployment ID (Q4) are not available yet, and
   `auth.dataporten.no` and `*.instructure.com` are unreachable from the build environment (Q7). The
   *(verify)* values in spec 02 therefore stay unverified at the S3 gate (§4.5), and so do whether Canvas sends
   `feide_login` under privacy level `anonymous` (Q4) and the `hvl_placement` field in the developer key
   (Q13). Canvas–Feide account linking stays off for a platform until `"feideLinking": true` is set in
   `LTI_PLATFORMS` after that test launch (D-063). Every HVL value is an environment variable, so the real services need configuration rather than
   code, unless they behave differently from the documented values the mocks follow. From S6 the facts the mocks
   assume are checks that can run against ALU's test Canvas and real Feide (`npm run test:live`), with a checklist
   for what a test cannot do; both pass to HVL's bachelor students
   ([handoff/live-contract-seam.md](handoff/live-contract-seam.md), [handoff/canvas-acceptance.md](handoff/canvas-acceptance.md)).
6. **Strict package versions.** An author's `.h5p` import is refused when any library differs from the
   installed one in its patch version (`SEC-003`, Q9), which will refuse many packages exported elsewhere.
7. **Some pages stay server-rendered** (D-067). The web app (`apps/web`) serves the start page, the activity pages,
   `/hjelp`, `/personvern` and the Canvas chrome `/app/play`; the Deep Linking picker (`/lti/deeplink`) and the
   friendly error pages stay server-rendered by Express (they need its 401/403/404/503 statuses) but use the token
   CSS, the formative notice and the **Hjelp** link. Sharing had only an API until S5; the activity page's **Deling**
   tab now sets the visibility through it (`PATCH /api/content/:contentId/sharing`). Since S6 the activity page and
   `/app/play` also have the **Innsikt** and **Poeng til Canvas** tabs, one context at a time (D-101, D-106).
8. **The H5P pages allow inline styles, and Panopto's script once a Panopto site is configured** (D-070). Since S4
   the player (`/h5p/play/:contentId`, `/lti/play`) and editor pages (`/h5p/edit/:id`, `/h5p/new`, `/lti/edit`)
   send `script-src 'self'` plus the hash of H5P Core's one constant inline script, so a script inside an activity
   cannot run and read the page's URL token (the ltik or the CSRF token). When `EXTERNAL_MEDIA_ORIGINS` lists a
   Panopto site, `script-src` also allows one third-party file,
   `https://developers.panopto.com/scripts/v1.2.0/embedapi.min.js`, which H5P.Video needs to play Panopto videos and
   loads without SRI, on pages that hold the ltik in memory (`SPEC-DEVIATION` from `H5P-009` and `DATA-011`); with
   no Panopto site configured, no outside script can run. Our own tags on these pages carry no SRI or nonce either:
   they are same-origin files allowed by `'self'` (D-070). `style-src` still allows `'unsafe-inline'`, because H5P
   sets style attributes throughout; injected CSS can change how an activity looks but not run code. The S2 upload
   checks (`SEC-001`, `SEC-002`) and admin-only library installation (`SEC-003`) limit what an activity can carry.
9. **Tokens travel in some URLs, so proxies must not log query strings** (D-057, D-058). A launch reaches
   `/app/play`, `/lti/play`, `/lti/edit` and `/lti/deeplink` with the ltik in the query (a first-party script then removes it from the
   address bar), and the H5P AJAX and learner-state URLs carry the ltik or the CSRF token as a query value,
   because H5P builds those URLs itself. Our logs redact these values (`DATA-009`), but a reverse proxy, load
   balancer or CDN in front of the server must not log query strings and must not cache responses that set
   cookies. The deployment checklist carries this rule ([ops/runbook.md](ops/runbook.md) §9); whether HVL's proxy
   keeps it is checked only when HVL deploys.
10. **Only the player's files are on the separate origin** (D-045, D-110's amendment of 2026-11-05). The player's
    content files load from `files.<host>` (or `FILES_BASE_URL`) through signed, expiring URLs (D-058), with
    `nosniff`, a sandbox CSP, no cookie and no ltik. The editor's saved files (`/h5p/editor-files/…`), fresh uploads
    and H5P's cookie fallback routes stay on the app origin, behind the same headers (`SPEC-DEVIATION: D-110`: H5P's
    image editor draws into a canvas without `crossorigin`). `files.<host>` is the same site as the app; a separate
    registrable domain is HVL's choice (Q5). A grant opens every file of one activity for 12–13 hours.
11. **No launch where frame storage is blocked and the platform offers no Platform Storage** (D-050). ltijs
    keeps a short-lived recovery token for its login state in the frame's `localStorage` or, where the browser
    blocks that, in LTI Platform Storage. With storage blocked and no `lti_storage_target` in the login
    request, ltijs cannot recover its state and the launch ends on our error page (pinned by
    `apps/server/e2e/ltiIframe.e2e.test.ts`). Canvas sends `lti_storage_target`, so this affects only other
    platforms. Where storage is blocked, the Canvas player gives H5P Core a page-memory stand-in for
    `localStorage` (`apps/server/src/lti/pages/client/h5pStorageGuard.js`), so what H5P keeps there (the
    xAPI actor ID, the copy-and-paste clipboard, the xAPI queue) lasts only as long as the page; learner
    state is saved on the server and is not affected.
12. **ltijs loads database drivers it never uses** (D-050). ltijs 7.0.7 imports mongoose (with mongodb) and
    ioredis when it loads. They are installed and loaded but never connected: our `PrismaLtiDatabaseManager`
    and node-redis `LtiCacheManager` replace them, and ESLint forbids importing ltijs's
    `MongoLegacyDatabaseManager` and `RedisCacheManager`. They still count in the audit and licence checks;
    an upstream issue asks ltijs to load them lazily.
13. **No build step for the server.** `npm run build` builds the web app, but the server runs its TypeScript
    sources through tsx, so every start compiles them in memory. Since S6, tsx is a runtime dependency of
    `apps/server` (D-110), so `npm ci --omit=dev` and the Docker image start it (`node --import tsx
    src/server/main.ts`); a compiled server would need its `import.meta.url` anchors reworked.
14. **Two interim rules wait for the owner** (Q12). Student authors (through `AUTHOR_COURSE_GROUPS`) may share
    an activity only as `private` until a course visibility exists (D-059), and from S5 they neither add co-authors
    nor see or list in the content bank, which shows colleagues' names (D-090, D-091); Feide users without a Feide
    ID, such as guests, cannot log in (D-054).
15. **Accessibility is verified automatically in Chromium only; H5P's own barriers are listed, not hidden** (D-079,
    D-080). Firefox, Safari, Edge, mobile browsers and the three screen readers are covered by the manual protocol
    in `docs/accessibility/`, which HVL runs and records (`UD-031`, `NFR-003`); no run is recorded yet, and the
    "tested" status of both in `docs/TRACEABILITY.md` comes from a check of the documents (§2). Barriers in H5P's own markup that
    a run-time repair cannot remove safely are listed in `apps/server/a11y/support/upstreamRegister.ts` with links
    to the upstream code; they are reported in every run but do not fail CI (`SPEC-DEVIATION` from `UD-030`).
16. **The studio's texts are drafts until ALU confirms them** (Q17, D-100). The phase labels and texts
    (`phases.yaml` says `status: proposed`, so the studio pages show a draft banner), the guide in three languages,
    the sixteen references (every one `verify: true`), the nine patterns, the mappe template, the criteria and their
    limits (7 500 words and 11 attachments, *(verify)*), the content bank's consent text (also for HVL's lawyers)
    and the privacy sentences about colleagues seeing staff names were written by the build from public sources
    and have not been reviewed by ALU or tried by pilot teachers. Some guide claims rest on search excerpts of
    Møgelvang & Isaksen (2025), and some criteria are translations or paraphrases. The review packet
    [reference/alu-review-s5.md](reference/alu-review-s5.md) lists each; the review is required before the pilot.
    The English guide keeps Norwegian terms such as *kontekst* and *samskaping* in running text, which its Markdown
    cannot mark with their own language (WCAG 3.1.2 allows such terms).
17. **The portfolio PDF needs Chromium on the server** (D-096). `playwright-core` 1.56.1 prints it with the server's
    own Chromium, in a fresh context per export with JavaScript off, offline and every request aborted; at most
    `PDF_MAX_CONCURRENCY` exports at once (2) and one per person, 30 seconds each. Where no browser starts, the PDF
    export answers 503 and the page points to the Markdown export, which always works. The S6 image carries
    Playwright's full Chromium 141 and fonts with æ, ø and å (the PDF uses Liberation Serif, because Georgia, the body
    font token, is not installed) and runs the server as uid 10001; Chromium keeps its sandbox only with Playwright's
    seccomp profile and `CAP_SYS_CHROOT`, which OpenShift's `restricted-v2` does not allow (Q5; the
    development-only `PDF_ALLOW_NO_SANDBOX=true` is refused in production). The server logs at start whether the
    export works (`PDF export availability`). HVL keeps Chromium patched by rebuilding the image.
18. **What the PDF does not tag yet is checked by hand** (D-096, `MAPPE-004`). The automated test reads the
    structure tree, the outline, `/Lang`, the title and the text with `pdfjs-dist`; a person checks the rest with PAC
    and NVDA (protocol J4 in `docs/accessibility/manual-test-protocol.md`). Known residuals to record there: list
    numbers are untagged, list items have no `Lbl` or `LBody`, and lists carry no numbering attribute; a table's
    caption and header row become `NonStruct`; there is no XMP metadata and so no PDF/UA identifier; links have no
    `/Contents`; the header says PDF 1.4; activity titles and references carry no language of their own (D-094
    amendment); and an activity's address is plain text, not a link. No manual check is recorded yet.
19. **Students' results in the mappe last until the yearly purge, not one academic year** (D-095 and its
    amendments, D-107). Since S6 the mappe reads the stored learning data on demand: groups of at least *k*
    (`MIN_GROUP_SIZE`, 5 by default, never below 3) per course, version and semester, with two-sided suppression,
    from rows stored before the latest midnight in Oslo, as insight reads them; Canvas's test student never counts.
    No period limits it: every stored row counts until the purge deletes it on `PURGE_RUN_DATE` (31 August by
    default, at the latest 31 December), so an export made after 1 August and before that day still holds the ended
    year's groups. It does not read the purge's *k*-suppressed snapshots yet, so after the purge an ended year's
    results leave the mappe (open in [PROGRESS.md](../PROGRESS.md), S6 step 5).
20. **The Canvas side of the studio passes to the students** (D-098, D-101). S6 did not reach the content bank and
    "new from a pattern" in the Deep Linking picker or the `LTI-007` duplicate in `/app/play`; they pass to HVL's
    bachelor students with a design note ([handoff/canvas-studio.md](handoff/canvas-studio.md)), and the
    [hand-off index](handoff/README.md) lists everything else that does. In Canvas the editor's save choice offers
    only resetting the students' progress or cancelling, with a pointer to the portal for saving a new version.
21. **Known limits of collaboration and copies, accepted for now** (D-091, D-092, D-093). The content bank shows
    the 200 newest listings without paging, and a listing only while its owner is findable HVL staff (an eligible
    Feide login in the last 13 months). People search allows 30 searches a minute per person, a fixed number. A copy
    whose source and source author are both deleted shows no «Kopi av …» sign and looks like an original. On the
    **Deling** tab a student-author owner still sees the people search, because the web app knows roles but not that
    fact, and gets the server's explanation (`hvl:sharing-not-allowed`) when searching (D-092). When HVL
    installs a newer minor version of a content type, the first save of each older activity counts as structural,
    because H5P's editor upgrades it, so authors whose students have saved progress are asked to reset or copy.
22. **Some of H5P's own texts are still English in Nynorsk and Bokmål** (D-111). HVL's language overlay translates
    the learner-facing buttons and messages of the ten types and their common sub-content, the editor labels of
    MultiChoice, QuestionSet, InteractiveBook and BranchingScenario, and DragNBar's toolbar; its texts are drafts
    until HVL's language advisers and ALU review them (Q2, Q17), and an activity keeps the texts it was saved with.
    Most other editor labels, the `H5PEditor.*` libraries' strings and less common sub-content stay English. Three
    texts no language file reaches are listed in the upstream register (`UPSTREAM_ENGLISH_TEXTS`): H5P.Video's
    "Video source is missing.", ImageHotspots' "Missing required background image" and InteractiveVideo's
    end-screen summary of a scored question, which screen readers read in English.
23. **What cannot be verified here waits for HVL** (D-101, D-113). The build environment has no access to HVL's
    Canvas, Feide, servers or people, so the items below stay *verified by document review or against the mocks,
    not by HVL* until HVL acts. Each is listed with S6's gate output and among the open questions in
    [PROGRESS.md](../PROGRESS.md), and the [hand-off index](handoff/README.md) says who takes it on.
    - **Real Canvas and real Feide** (limitation 5). Every LTI, AGS, NRPS and Feide test runs against the mocks in
      `tools/mock-platform`. The facts the mocks assume are checks that `npm run test:live` runs against ALU's test
      Canvas and real Feide, which only HVL or the students can do, and the Canvas acceptance checklist
      ([handoff/canvas-acceptance.md](handoff/canvas-acceptance.md)) covers what a test cannot see, such as how
      Canvas shows the formative label (Q3, Q4, Q7, Q8, Q13).
    - **The 200-learner load test** (`NFR-001`). Only `npm run load:smoke` runs here: 20 learners for 30 seconds on
      one node. `npm run load:full`, on a node like production, is HVL's ([ops/runbook.md](ops/runbook.md) §8).
    - **Backups and the restore drill on HVL's hardware** (`NFR-002`). The backup round trip runs here on the local
      services; the daily backup with its encrypted copy off the server, and the restore drill each semester with
      its log, are HVL's (runbook §6).
    - **Hosting** (`DATA-004`, `NFR-007`, `SEC-004`, `SEC-006`). Storage in the EEA, a container runtime that allows
      Playwright's seccomp profile and `CAP_SYS_CHROOT`, the files host's DNS name and certificate, and a clamd with
      daily signatures (Q5) are ticked on the deployment checklist (runbook §9) when HVL deploys. The image and its
      smoke test run here; `.github/workflows/docker.yml` has not yet run on GitHub (Chromium from Playwright's CDN
      and its SHA-256, AppArmor, the `/proc` check on the runner).
    - **The manual assistive-technology run** (`UD-031`, `NFR-003`; limitation 15), the manual PDF check
      (limitation 18) and the conformance report's 56 verdicts, each *Not yet determined* until HVL's dated
      evaluation (`UD-040`).
    - **The data protection officer's review** of the DPIA input and its residuals (`DATA-005`, Q6), and the DPO's
      questions Q15, Q22, Q25 and Q27–Q30. Running the database roles' script on the real database (`DATA-010`) and
      destroying an ended year's pseudonym secret (`DATA-003`) are steps for HVL operations.
    - **Reviews and choices for ALU, HVL or the owner:** the studio's and the H5P texts (Q2, Q17), which types send a
      score (Q18–Q20), the build rule for containers (Q21), how a graded link counts plays (Q23), insight's
      freshness (Q24), deleting audit rows after two years (Q26), and the earlier questions Q9, Q10, Q12 and Q14.
24. **Insight and grade passback have known gaps** (D-104, D-106, D-115). Every insight view ends at the latest
    midnight in Oslo, so what learners do today shows tomorrow, and no view crosses 1 August (Q24,
    [handoff/insight-freshness.md](handoff/insight-freshness.md)). Branching paths (`INS-004`) are not built,
    because BranchingScenario's choices are in no statement H5P sends
    ([handoff/branching-paths.md](handoff/branching-paths.md)); nor is the spaced-retrieval suggestion (`PROD-014`,
    a COULD), and LTI Dynamic Registration (`LTI-009`) is a design note only. Some activities send Canvas no score as
    they are set up today: ImageHotspots never, InteractiveVideo only with a submit screen, and BranchingScenario not
    when it is set to «No scoring»; the Deep Linking picker says so beside each of them (D-115, Q18), and every
    ending of the `uv-case` pattern scores 10 of 10 (Q19). The grade-sync counts on **Poeng til Canvas** are live,
    not *k*-suppressed, and include Canvas's test student, and an activity's owner and co-authors see them for every
    course it is placed in (Q22; DPIA input R1, R13). A learner's score in a graded link counts their plays of the
    same activity in the same course through any other link too (Q23).
