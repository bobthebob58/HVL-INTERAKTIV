# Evaluator Guide

This guide is for people who review HVL Interaktiv without having built it: ALU learning
designers, TeCopp administrators, security and privacy reviewers, examiners and external code
reviewers. It explains how to check, efficiently and independently, that the code does what the
specifications promise.

**Current state (2026-10-29):** Sessions 1–3 passed their gates on 2026-10-23 and Session 4 (universal design) on
2026-10-24; Session 5 (the læringsdesign studio) is built and in integration and review, and its gate (§5) has not
run yet. Session 1 built the monorepo, `apps/server` foundations and the tools `spec-trace`, `spec-site`,
`doc-lint`, `dependency-check`, `privacy` and `h5p-core`. Session 2 added the H5P engine with the ten types, the
permission system, learner state, upload security, seeding and our own H5P routes. Session 3 made the server a
running service (`npm start`): Feide login for the portal, Canvas LTI 1.3 launches through ltijs 7, Deep Linking,
Canvas–Feide account linking and the sharing API behind one `Principal`, tested against the mock Feide and mock
Canvas in `tools/mock-platform` (limitation 5). Session 4 brought the ten real content types from GitHub at pinned
commits (D-078, R-01 settled in D-047), strict script policies on every page type (D-070), the web app `apps/web`
(Next.js inside Express, D-067, D-068) with the activity pages, the publish flow and the Canvas chrome page
`/app/play`, the design tokens and the HVL H5P theme, the pre-publish validator (22 rules), and the accessibility
suite `npm run test:a11y` (D-079, D-080). Session 5 added the læringsdesign studio of spec 04, in the portal only
(the Canvas side waits for S6, D-098): the public guide and pattern catalogue on `/laeringsdesign` with ALU's texts
loaded from `content/` and checked by `npm run content:check` (D-082, D-083); nine patterns that create a draft
activity with marked guidance (`⟦…⟧`, rule V-PLACEHOLDER; D-084–D-086); the **Læringsdesign** tab with outcomes,
rationale, time and purpose, and the alignment planner (D-087, D-088); co-authors, the content bank and copies on the
**Deling** tab (D-090–D-092); a save choice in the editor so that a structural change does not silently reset
students' progress (D-093); and the pedagogisk mappe export as Markdown and as a tagged PDF printed by Chromium on the
server (D-094–D-096). Its texts are drafts for ALU (Q17, limitation 16). Build progress is tracked in
[PROGRESS.md](../PROGRESS.md). Commands marked *(from S<n>)* below arrive with that session.

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
| `npm run test:e2e` *(from S3)* | Chromium flows against the whole server and the mock platform (D-065), in CI too: from S3, launch → play → answer → reopen in the cross-site Canvas iframe with third-party cookies blocked (checked by a canary), once with stock Chrome's partitioned frame storage and once with frame storage blocked (LTI Platform Storage), plus our error page when neither is available; the Deep Linking round trip, whose signed answer the mock Canvas accepts with a line item; portal Feide login, sharing with the CSRF token, and logout through Feide. These play a synthetic content type (limitation 3). From S4: the owner edits and saves in the H5P editor inside the cookie-less Canvas iframe with the Bearer ltik (`ltiEditor.e2e.test.ts`); on the built web app with the real content types, a Feide author is refused without a reason and then publishes despite a validator error with one, which stores one ValidationAcknowledgement and leaves no reason in the audit or the log (`publishWithReason.e2e.test.ts`, PROD-003, UD-022); and the teacher's Canvas page `/app/play` with Spel and Rediger, where frame storage is blocked (LTI Platform Storage), saves from the editor inside its chrome with the teacher's ltik as Bearer, with no Set-Cookie from the tool and no ltik in any frame address (`appPlayEditor.e2e.test.ts`, LTI-006, LTI-003). A failed step names itself, what failed before it (ltik redacted) and whether another process removed its rows (`flowRecord.e2e.test.ts` tests this); a closed test bed removes what it created and keeps an account an earlier run left (`testbedCleanup.e2e.test.ts`). From S5, on the built web app: J1's portal part from the filtered catalogue through a pattern, a filled placeholder and the learning design to publishing with reasons (`patternToPublish.e2e.test.ts`); a colleague's copy from the content bank (`bankDuplicate.e2e.test.ts`); both mappe downloads with nothing stored (`mappeDownloads.e2e.test.ts`); and a confirmed reset of a Canvas student's saved progress (`safeEditReset.e2e.test.ts`). Needs the setup of `npm test`; the web app flows also need `npm run build` and `npm run h5p:fetch-libraries` (skipped without them locally, failing in CI). Run it without other test processes on the same database. The full journeys J1–J5, Canvas side included, join in S6 |
| `npm run test:a11y` *(from S4)* | axe-core (WCAG 2.2 AA tags) on every web route, the server pages and the player and editor of all ten real types, in the light theme and with forced colours, plus reflow at 320 px, reduced motion, text spacing and 200 % zoom, keyboard walks (focus visible and not covered), target size, `lang` and first-party requests (`UD-030`, D-079). H5P's own findings are repaired at run time or listed in `apps/server/a11y/support/upstreamRegister.ts` (D-080). From S5 every check also walks the studio's pages, signed in with seeded data (a pattern page, the planner with gaps, the bank, `/mappe` with a word count, the **Læringsdesign** and **Deling** tabs, a copy's page), plus keyboard scripts of the studio's journeys and the editor's save choice dialog with the page around it inert (`axeStudioViews`, `keyboardStudioJourneys`, `axeSaveChoice`). Needs `npm run build`, the real packages and Chromium; about 15 minutes; run it on its own |
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
  `placeholderRule.ts`, and the `/innsikt` page *(from S6)*. In the studio *(from S5)*: the guide on
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
- **Look at:** `docs/privacy/`, `apps/server/src/privacy/`, `apps/server/src/insight/`, `apps/server/prisma/schema/`.
- **Red flags:** Learner names or e-mails in any table. An endpoint returning per-learner rows to
  teachers. `actor.name` or `mbox` persisted from xAPI.

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
| S6 | Full `npm test`, `npm run lint`, `docker compose build`; AGS mock tests pass; conformance report and DPIA input exist |

---

## 6. Known limitations (stated honestly)

1. **Scores are computed in the browser.** H5P scoring cannot be made tamper-proof. HVL Interaktiv
   is for formative use only (`LTI-013`, `PROD-011`).
2. **Upstream accessibility.** Some barriers are inside H5P content types and can only be fixed
   upstream. The conformance report (`UD-040`) lists them with issue links.
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
   code, unless they behave differently from the documented values the mocks follow.
6. **Strict package versions.** An author's `.h5p` import is refused when any library differs from the
   installed one in its patch version (`SEC-003`, Q9), which will refuse many packages exported elsewhere.
7. **Some pages stay server-rendered** (D-067). The web app (`apps/web`) serves the start page, the activity pages,
   `/hjelp`, `/personvern` and the Canvas chrome `/app/play`; the Deep Linking picker (`/lti/deeplink`) and the
   friendly error pages stay server-rendered by Express (they need its 401/403/404/503 statuses) but use the token
   CSS, the formative notice and the **Hjelp** link. The **Innsikt** tab comes with insight (S6). Sharing had only an
   API until S5; the activity page's **Deling** tab now sets the visibility through it (`PATCH
   /api/content/:contentId/sharing`).
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
   cookies. The S6 runbook has to carry this rule.
10. **User files are not yet on a separate origin** (D-045). Content files load through signed, expiring
    URLs on the tool's own origin (`/h5p/files/…`, D-058), with `nosniff` and a sandbox CSP; the separate
    files origin that `SEC-004` asks for in production is S6 work.
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
13. **No build step for the server.** `npm run build` builds the web app, but `npm start` still runs the server's
    TypeScript sources through tsx, a development dependency of the repository root, so the server cannot start from
    an install without development dependencies (`npm ci --omit=dev`), and every start compiles the sources in
    memory. How production builds and starts the server is decided with S6's Docker images.
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
    export answers 503 and the page points to the Markdown export, which always works. S6's production image must
    install Chromium and fonts with æ, ø and å (here the PDF uses Liberation Serif, because Georgia, the body font
    token, is not installed), run the server as a non-root user whose runtime allows unprivileged user namespaces
    (Chromium refuses its sandbox as root; the development-only `PDF_ALLOW_NO_SANDBOX=true` is refused in
    production), and keep Chromium patched.
18. **What the PDF does not tag yet is checked by hand** (D-096, `MAPPE-004`). The automated test reads the
    structure tree, the outline, `/Lang`, the title and the text with `pdfjs-dist`; a person checks the rest with PAC
    and NVDA (protocol J4 in `docs/accessibility/manual-test-protocol.md`). Known residuals to record there: list
    numbers are untagged, list items have no `Lbl` or `LBody`, and lists carry no numbering attribute; a table's
    caption and header row become `NonStruct`; there is no XMP metadata and so no PDF/UA identifier; links have no
    `/Contents`; the header says PDF 1.4; activity titles carry no language of their own; and an activity's address
    is plain text, not a link. No manual check is recorded yet.
19. **No students' results in the mappe before S6** (D-095). No results are stored before S6's xAPI and grade work,
    so `ActivityResultsSource` answers "no results yet" and the portfolio says so in one sentence per activity. The
    minimum group size (`MIN_GROUP_SIZE`, *k* = 5 by default, never below 3) and its two-sided suppression are built
    and tested against a fixture source; S6 adds the real source.
20. **The Canvas side of the studio waits for S6** (D-098). The content bank and "new from a pattern" in the Deep
    Linking picker and the `LTI-007` duplicate in `/app/play` are S6 items. In Canvas the editor's save choice offers
    only resetting the students' progress or cancelling, with a pointer to the portal for saving a new version.
21. **Known limits of collaboration and copies, accepted for now** (D-091, D-092, D-093). The content bank shows
    the 200 newest listings without paging, and a listing only while its owner is findable HVL staff (an eligible
    Feide login in the last 13 months). People search allows 30 searches a minute per person, a fixed number. A copy
    whose source and source author are both deleted shows no «Kopi av …» sign and looks like an original. On the
    **Deling** tab a student-author owner still sees the people search, because the web app knows roles but not that
    fact, and gets the server's explanation (`hvl:sharing-not-allowed`) when searching (D-092). When HVL
    installs a newer minor version of a content type, the first save of each older activity counts as structural,
    because H5P's editor upgrades it, so authors whose students have saved progress are asked to reset or copy.
