# PROGRESS — cross-session state

This file is the single source of truth for build progress. **Every session starts by reading it
and ends by updating it** (see the session protocol in `CLAUDE.md`). It also lets evaluators see
what is done, what is verified, and what is blocked.

## Status overview

| Session | Milestone | Specs to load | Status |
|---|---|---|---|
| S0 | Specification, documentation standard, traceability tool | — | ✅ Done (2026-10-16) |
| S1 | Monorepo scaffold, DB schema, H5P Core 1.28 spike and setup | 00 §6; 01 §1–2, §4–7; 05 §2, §4–5; DOCUMENTATION-STANDARD | ✅ Done (2026-10-21) |
| S2 | Ten-type whitelist, seeding, SVG sanitiser, permission system, resume | 01 (all); 00 `PROD-002`, `PROD-008` | ✅ Gate passed (2026-10-23); spike step 3 open (Q7), steps 4–5 done in S4 (D-047) |
| S3 | Feide OIDC + LTI 1.3 (ltijs 7) dual authentication, Deep Linking | 02 §1–4, §7 | ✅ Gate passed (2026-10-23); HVL's Feide and Canvas values open (Q3, Q4) |
| S4 | Design tokens, HVL H5P theme, WCAG 2.2 verification, pre-publish validator | 03; 04 §5; 05 `DATA-006`, `DATA-011` | ✅ Gate passed (2026-10-24); HVL's token and logo confirmation (Q2), the DPO's review of the privacy text (Q6) and the first manual AT run open |
| S4+ | Whole-code-base simplification pass (owner decision, 2026-10-24) | — | ✅ Done (2026-10-25): 59 changes, 569 lines shorter, every test kept, S4 gate green again; a second round is the owner's call |
| S5 | Læringsdesign studio, patterns, planner, pedagogisk mappe export | 04; 00 S5 rows | 🟨 In progress (started 2026-10-28; plan approved, D-082…D-100) |
| S6 | xAPI → AGS grade bridge, insight, privacy jobs, Docker, conformance report | 02 §5–7; 05; 00 §6 | ⬜ Not started |

Legend: ⬜ not started · 🟨 in progress · ✅ done (gate passed, output pasted below) · ⛔ blocked

---

## S0 — Specification ✅

- [x] Read the development plan; verified versions, APIs and CVEs against npm and advisories (2026-10-16)
- [x] `docs/specs/00`–`05`, 126 requirements with IDs, priorities, sessions and acceptance criteria
- [x] `docs/DOCUMENTATION-STANDARD.md`, `docs/EVALUATOR-GUIDE.md`, `docs/GLOSSARY.md`, `docs/DECISIONS.md` (D-001…D-016)
- [x] `tools/spec-trace/specTrace.mjs` and the generated `docs/TRACEABILITY.md`
- [x] `CLAUDE.md` (thin root, < 120 lines) and this file
- [x] Licence confirmed: GPL-3.0-or-later, `LICENSE` added (D-015)
- [x] Spec website: `tools/spec-site/` generates `docs/site/index.html`

Gate output:
```
$ node tools/spec-trace/specTrace.mjs --check
✓ 126 requirements, traceability up to date.
```

## S1 — Scaffold, schema, H5P core ✅

- [x] Spike (spec 01 §7): steps 1–2 done, 3–5 blocked by the network; results below. R-01 stays open
- [x] npm workspaces (`apps/*`, `packages/*`) with `apps/server`. `apps/web` and `packages/*` are created
      with their first features (S3/S4), not as empty scaffolds; the tools live in `tools/*` without a package
- [x] Node 24 (`.nvmrc`, `engines`), TypeScript strict (6.0.3, D-024), ESLint 10 + `eslint-plugin-jsdoc` +
      `eslint-plugin-i18next`, Prettier. Stylelint moves to S4 with the first theme CSS
- [x] Husky: `pre-commit` runs lint-staged (Prettier, ESLint); `commit-msg` runs the DOC-011 checker
- [x] `npm run spec:trace` (root override, tests), `check:filesize`, `tools/doc-lint` with 11 checks and tests
      (`DOC-001`–`003`, `005`–`010`, `013`, `014`, see `tools/doc-lint/README.md`; `NFR-004`)
- [x] Prisma schema, split by domain (20 models: spec 05 §4 plus `AuthAuditEvent` from spec 02 §7), first migration with a CHECK constraint that
      keeps names and e-mail off learner rows; `docs/privacy/DATA-INVENTORY.md` and its check (`DATA-001`, `DATA-002`)
- [x] `deriveLearnerKey` with per-academic-year secrets (`DATA-002`); pino logger with deep redaction (`DATA-009`)
- [x] `H5pConfigFactory` (`H5P-001`), boot check, storage adapters and cleanup job (`H5P-004`, user data in S2
      per D-028), size limits and the zip guard (`SEC-005`)
- [x] i18n `nn`/`nb`/`en` with typed keys and a key-parity test (`PROD-012`)
- [x] `docker-compose.yml`: PostgreSQL 16, Redis 7, S3 emulator (moto instead of MinIO, D-023)
- [x] CI: typecheck, lint, format, doc-lint, file size, pins, licences, audit with reviewed exceptions,
      inventory, tests with service containers, traceability, spec site, H5P boot check (`SEC-007`, `NFR-005`)
- [x] Decisions D-023…D-034 recorded
- [x] Independent review (2026-10-22): three reviewers (correctness and security, privacy and spec
      compliance, documentation) with a skeptic per finding; 16 confirmed findings and the valid
      low-severity ones fixed with regression tests (see the session log)
- [x] Verification of those fixes (2026-10-22): an independent pass re-ran each finding and probed the fixes;
      every residual and new problem it found is fixed, with regression tests (see the session log)
- [x] Gate (output in the session log, 2026-10-22 · S1 review)

Spike results (spec 01 §7, Risk R-01):

| Step | Result |
|---|---|
| 1. h5p-server 10.0.4 and h5p-express 10.0.5 on Node 24, `coreApiVersion` 1.28 | ✅ Both install on Node 24.x (h5p-express with its Express 4 overridden to 4.22.3 for advisories, D-032). `H5pConfigFactory` sets 1.28 and re-applies it after loading stored settings |
| 2. Core tag `1.28.0` and editor commit `ab2daa18` | ✅ `npm run h5p:fetch-core`: core commit `2aeb0b83` matches, all 67 files match the committed SHA-256 list; editor commit verified by git, its 214 file hashes recorded (`h5p-editor-php-library-ab2daa18.files.sha256`) |
| 3. Seed packages and site registration | ⛔ Blocked: this environment cannot reach `hub-api.h5p.org` (Q7; re-checked 2026-10-23, proxy 403). F2 (pre-set `H5P_SITE_UUID`) is applied by `H5pConfigFactory`; F1 is wired in `H5pEditorFactory` (S2). `npm run hub:check` runs the step where the Hub is reachable |
| 4. Render `H5P.MultiChoice` in the player | ✅ with the ten real types (D-078, S4), built from GitHub at pinned commits instead of the Hub. S2: a synthetic content type runs on our player page in Chromium with Core 1.28, no console errors, and resumes after a reload (`player.browser.int.test.ts`) |
| 5. Daylight theme with the F3 CSS | ✅ with the synthetic type (S2): the F3 styles load, `--h5p-theme-*` tokens are active, and a later stylesheet overrides them. Repeated with the real content types in S4 (`hvlTheme.browser.int.test.ts`, D-078) |
| 6. Decide 1.28 or the 1.27 fallback | Stay on 1.28 for now: nothing found so far contradicts it. Decide after steps 3–5 in S2 (decided 2026-10-23: Core 1.28, D-047) |

Gate output: see the session log entry for 2026-10-22 · S1 review (the 2026-10-21 entry is the first run).

## S2 — Content types and security ✅ (gate passed 2026-10-23; spike step 3 open, Q7)

- [ ] Finish the spike (spec 01 §7 steps 3–5) where hub-api.h5p.org is reachable, and decide R-01 (to be recorded as D-047).
      **2026-10-23 (S4):** steps 4–5 and R-01 are done with real content types built from GitHub at pinned commits
      (D-078): Core 1.28 stays (D-047). Only step 3, the Hub registration, still waits for Q7.
      **Still blocked (Q7):** on 2026-10-23 (last checked 07:32 UTC) the egress proxy refused hub-api.h5p.org
      (`CONNECT tunnel failed, response 403`; `npm run hub:check` reports `fetch failed: Request was cancelled.`).
      S2 closed on the plan's fallback: the gate passes on synthetic packages; this item carries forward.
      When the packages arrive, also review each type's `getCopyrights` for values it writes into HTML (D-039).
      Done without the Hub: F3 injected and tested; a Chromium test runs Core 1.28 on our player page with no console errors,
      the Daylight tokens active and overridable, and state resumed after a reload (synthetic content type)
- [x] F1 wired: `getLocalIdOverride: () => localIdFor(config.uuid)` in `H5pEditorFactory`; the Hub
      registration payload is tested to carry 15 characters (D-031)
- [x] Package import over `ajax?action=library-upload`: `inspectZip` before Lumi, the upload in a fresh
      `mkdtemp` folder that is always removed (`SEC-005`, D-031, D-043). Own Express 5 routes replace
      h5p-express (D-035)
- [x] Decisions D-035…D-046 recorded (plan approved 2026-10-22); D-047 (R-01) will be written after the spike
- [x] TypeDoc API pages (`npm run docs:api`, warnings as errors) in CI (`DOC-002`, D-031)
- [x] `HvlTop10ContentTypeFilter` and the DragQuestion semantics filter (`H5P-002`, `PROD-002`)
- [x] Seed command with SHA-256 verification and audit (`npm run seed:libraries`, `H5P-003`, `H5P-011`),
      tested on synthetic packages. **Open:** the real `.h5p` files (run `tools/seed/fetch-seed-packages.sh`
      where the Hub is reachable), the CI seed step and the "< 2 min in CI" measurement (Q7, Q10)
- [x] `PrismaContentUserDataStorage` (`H5P-005`, `PROD-008`); `HvlPermissionSystem` with a test of every
      matrix cell (`H5P-006`); permission guard at start-up
- [x] Own Express 5 routes, player page and sub-content policy (D-035, D-039, D-040; `SEC-008`)
- [x] `HvlTranslationCallback` and the nn → nb → en library fallback (`H5P-008`); library audit (`H5P-011`)
- [x] `SvgSanitizer`, `FileTypeSniffer`, `ContentFileHeaders`, package import rules (`SEC-001`…`SEC-004`, `SEC-008`)
- [x] `npm run hub:check` for spike step 3 (registration status, F1, versions of the ten types)
- [x] Independent review and its fixes: three reviewers (correctness and security, privacy and spec,
      documentation), each finding checked by a skeptic, then three verification passes over the fixes;
      every fix has a test that fails on the old code
- [x] Gate: as in the Evaluator Guide §5, S2, plus each S2 requirement's tests run on their own (`-t`);
      output in the session log (2026-10-23)

## S3 — Dual authentication ✅ (gate passed 2026-10-23; HVL's own Feide and Canvas values open, Q3 and Q4)

Effort: high, because this is security-critical. Public Feide and Canvas values are in `docs/reference/`; **HVL's own client IDs, realm, redirect URIs and TeCopp instance** are still needed (Q3, Q4).
- [x] Decisions D-048…D-066 recorded (plan approved 2026-10-23): server-rendered LTI views until S4 (D-048),
      mock platform (D-049), ltijs on our router with our deployment and ltik checks (D-050, D-051)
- [x] Mock OIDC provider and mock LTI platform in `tools/mock-platform/` for tests (mock Feide on oauth2-mock-server
      with a Groups API; mock Canvas with `form_post`, JWKS, a cross-site course page, LTI Platform Storage and Deep
      Linking verification; `npm run mock:platform`, D-049)
- [x] Feide RP, role mapping, sessions, data minimisation, author linking (`AUTH-001`…`AUTH-005`): PKCE + state +
      nonce bound to a single-use login transaction, signature checks on, Groups API fail-closed, Redis sessions
      (`__Host-hvli_sid`, idle 2 h, absolute 12 h) with a synchronizer CSRF token, logout via Feide end-session;
      AUTH-005 linking at Deep Linking launches (D-063), content never changes owner
- [x] `LtiProviderFactory`, `PrismaLtiDatabaseManager`, ltik transport, role mapping (`LTI-001`…`LTI-004`): ltijs on
      our router, claim allowlist, deployment and active-platform checks on every ltik, ltik in the query only on
      four paths, LTI never grants admin; platform keys re-encrypted at start-up after a key rotation (D-056)
- [x] Deep Linking picker, resource-link launch, course copy (`LTI-005`…`LTI-007`, `PROD-005`); `HvlUrlGenerator` and
      signed content-file grants (`H5P-007`, D-058)
- [x] Draft/published visibility, Feide sharing (`PROD-004`, `PROD-006`): one 404 page for unknown, draft and
      invisible activities; `PATCH /api/content/:id/sharing` changes visibility only (D-066)
- [x] Entry point: `createApp` + `main.ts` (`npm start`), `/healthz` (`NFR-002`), graceful shutdown, cleanup jobs
- [x] `npm run test:e2e`: cookie-less iframe launch → play → resume (stock Chrome and blocked frame storage with LTI
      Platform Storage), Deep Linking round trip, portal sharing with logout (D-065); in CI. Found and fixed: H5P
      Core reads `localStorage` without a `try`, so the LTI player loads a storage guard first (D-050)
- [x] Independent review (Feide, LTI, privacy, app wiring, spec conformance; a skeptic per finding) in two rounds,
      then three adversarial verification passes over the fixes; every fix has a test that fails on the old code
- [x] Gate: as in the Evaluator Guide §5, S3, plus the S1/S2 commands and each S3 requirement's tests on their own
      (`-t`); `npm start` against `npm run mock:platform` answers `/healthz` and `/lti/keys`; output in the session
      log (2026-10-23)

Not done in S3 (recorded 2026-10-23):
- `DOC-012` (SHOULD): the OpenAPI document generated from the zod schemas at `/api/docs` was not built; it moves to
  S4, where the web app becomes the first API client. (Route headers already state their authentication mode.)
- `AUTH-005`'s "Link with Feide" fallback that proves both identities is not built (D-063); a teacher whose Canvas
  account owns content before the first link keeps two libraries (`link.conflict`).
- Known limitation: if a teacher's very first resource-link launch commits while their first Deep Linking launch
  is linking, that Deep Linking launch opens on the new, empty Canvas account; the next one moves the identity
  (`src/auth/identity/accountLinking.ts`).
- Everything HVL must supply: Feide registration and redirect URIs (Q3), the TeCopp test launch and `feideLinking`
  (Q4), owner answers Q12–Q15. GitHub has never run CI on this work (Q16).

## S4 — Universal design ✅ (gate passed 2026-10-24; Q2, Q6 and the first manual AT run open)

Brand tokens follow HVL's manual (D-017); HVL (profil@hvl.no) must still confirm the values and supply logo files.
Plan approved 2026-10-23 (owner: automatic restart, no YouTube, all of S4 in one go); decisions D-067…D-079.
- [x] Decisions D-067…D-080 recorded; D-047 (R-01) follows the real-library probe
- [x] Real H5P content types from GitHub at pinned commits (`npm run h5p:fetch-libraries`, D-078): 120 libraries,
      ten Nynorsk example activities; all ten install through the seed path, import, save and play in Chromium;
      R-01 settled (D-047). Found and fixed: library folders refused icon fonts (SEC-002 list applied to them)
- [x] H5P player pages under a strict script policy (D-070): JSON data block, `script-src 'self'` plus the hash of
      Core's one iframe script; all ten real types play under it, and an injected inline script never runs
      (tested on the CoursePresentation page and its frames)
- [x] Next.js inside Express (D-067, D-068): built and dev modes, nonce on every script, credentials and the ltik
      removed before Next.js, locale header, no server endpoints in `apps/web`. Found and fixed: `next` ≤ 16.4.0 has
      critical advisories (pinned 16.4.2), telemetry is now off, and the S1 licence check skipped every production
      package a dev tool also uses (now 470 packages checked instead of 240; D-071)
- [x] The editor page and the LTI editor in a cookie-less iframe (D-069): `/h5p/edit/:id`, `/h5p/new`, `/lti/edit`;
      all ten real types open and save under the strict policy; in Canvas with frame storage partitioned or blocked.
      Found and fixed: no Edit check in Lumi's editor render, H5P editor scripts failing under a cross-origin
      parent, Content Hub metadata refused with 403 (page errors), and `base-uri 'none'` refusing jQuery's parser
- [x] `packages/design-tokens` with the contrast test and lint rules (`UD-001`): `tokens.json` → `tokens.css`,
      the Tailwind `@theme` file and the Daylight mapping, checked with `npm run tokens:check`; Stylelint and ESLint
      refuse colour literals, upper case and justified text (D-072)
- [x] Carried in by earlier decisions: launches land on the web app's Canvas chrome `/app/play` (D-048 as amended
      by D-067: the Deep Linking picker and the friendly pages stay server-rendered, token-styled, with the formative
      notice and **Hjelp**); the H5P editor page with the player's script-safe JSON (D-040) and the LTI-006
      **Rediger** tab on `/app/play` (D-062); editor file and upload grants after an Edit check (D-058, D-069);
      `DOC-012` (`/api/docs` from the zod schemas in `packages/api-contract`, D-077). H5P pages opened on their own
      go to their chrome page (D-067)
- [x] Web shell components and `hvl-h5p-theme.css` (`UD-002`…`UD-013`, `H5P-009`): layout with skip link,
      **Hjelp** and **Personvern**, tabs, dialog, error summary, findings with **Gå til feltet**, publish dialog,
      notice, `ExternalLink`/`FileLink`; pages `/`, `/aktivitet/[id]`, `/aktivitet/ny`, `/app/play`, `/hjelp`,
      `/personvern`, 404; the H5P theme with feedback prefixes, two-tone focus, 24 px targets, reduced motion and
      forced colours. Found and fixed: logout refused by `form-action` (D-070 amendment), the editor's go-to-field
      giving up while H5P still loads, a second **Publiser** on published activities
- [x] Validator engine, UD rules and pedagogical hint rules (`UD-020`…`UD-022`, `PED-020`): pure
      `validateContent` with 11 `V-*` and 11 `PED-H*` rules, fixtures per rule, messages in three languages,
      thresholds from `content/laeringsdesign/hint-thresholds.yaml` (D-073). Found and fixed: imported activities
      state `language`, the editor saves `defaultLanguage`; V-LANG and the player's `lang` read both (UD-010)
- [x] Publish flow with acknowledgements (`PROD-003`), which also ends S3's visibility-only sharing (D-066, Q14);
      formative notice (`PROD-011`); privacy notice (`DATA-006`): server re-validation, reasons valid 14 days, a
      Redis write lock so a publish cannot slip between the save gate and the write (D-074 amendment), unpublish,
      notice dismissal per user with bounded versions (D-075), `/personvern` in nn/nb/en (DPO review open, Q6)
- [x] CSP that blocks third-party requests; self-hosted fonts (`DATA-011`); browser and assistive-technology matrix (`NFR-003`).
      The player page's `script-src` must not allow `'unsafe-inline'`: it is the structural defence against
      markup H5P Core writes without escaping (D-039). Done: first-party policies on every page type (portal pages
      too), system font stacks (D-018), a request recorder over every view and type; the one outside script is
      Panopto's embed API file, only when a Panopto site is configured (D-070 amendment). NFR-003 is a documented
      matrix whose results HVL records (D-079); the first manual run is the open item below
- [x] axe suite (`UD-030`); manual protocol document (`UD-031`): `npm run test:a11y` (13 files; the test count is in
      the gate output) on every route and in the player and editor of all ten types, light and forced colours, plus
      reflow, motion, text spacing, zoom, keyboard, target size, `lang` and first-party checks; H5P's own findings are
      repaired at run time or registered (D-080). `docs/accessibility/` holds the protocol and the matrix; results
      are HVL's (the first manual run is the open item below). Found and fixed: the H5P editor scrolled sideways at
      320 px, CoursePresentation's focus ring was cut off, the new-activity editor frame had no title
- [x] H5P's own markup barriers (D-080): two scripts repair nine at run time, `a11yRepairs.js` in the content
      types (CoursePresentation's progress bar, DragText's drop zones, H5P.Question's explanation title) and
      `a11yEditorRepairs.js` in the editor (score ranges, vertical tabs, mode switch, hotspot picker, paste button,
      the content-type list), which also makes the parts BranchingScenario's tour fades inert; 13 of the register's
      15 entries are gone, 2 remain (the hub's nested buttons, BranchingScenario's disabled «Paste»). The answer
      prefixes now cover the question types the containers offer (TrueFalse, MarkTheWords, SingleChoiceSet, Summary,
      MultiMediaChoice, ImageHotspotQuestion), drawn colour pairs are tested, jQuery motion stops with reduced motion.
      Found and fixed: CoursePresentation's 24 px progress-bar parts covered the footer's buttons at 320 and 640 px
      wide, and its 7 % footer cut them off; bar and footer now have room of their own outside full screen, the
      slide buttons' column fits them, and in full screen the footer lies above H5P's smaller bar
      (`hvl-h5p-targets.css`; D-080 amendments NEW-4 and V2T-1, checked pixel by pixel at 320, 390 and 640 px)
- [x] New end-to-end flows: publishing despite an error with a reason (`PROD-003`, `UD-022`) and the teacher's
      **Rediger** inside `/app/play` with frame storage blocked (`LTI-006`); `npm run test:e2e` runs 8 files.
      Found and fixed: a closing test bed deleted every user created since it opened, also other processes' users;
      it now removes only its own (`test/support/appTestbed.ts`), which `e2e/testbedCleanup.e2e.test.ts` checks
- [x] CI (`.github/workflows/ci.yml`) runs the S4 steps (GitHub has not run it yet, Q16): the web app build,
      `h5p:fetch-libraries`, the browser tests, `test:e2e`, `test:a11y` and `--done-through=S4`. Found and fixed:
      the job's 30-minute timeout was shorter than these steps. It is now 75 minutes, sized from the steps' measured
      durations (about 35 minutes in all, so a 2x margin). The H5P library checkouts and builds are cached
      (`actions/cache`, keyed on the manifest and the tool's scripts), and a reused checkout must still have its
      pinned commit as `HEAD` with no tracked file edited (`verifiedHead` in `tools/h5p-libraries/gitSource.mjs`),
      or the fetch fails; its untracked build output is reused without a rebuild and relies on the cache's scope
- [x] Progress screenshots (desktop and mobile, `nn`) sent to the owner as each view is built (CLAUDE.md §4):
      eleven views at 1280 and 390 px on 2026-10-24
- [x] Early independent review of the server work (security, publishing, validator, accessibility, privacy and
      documentation; a skeptic per dimension): 36 confirmed findings, fixed in three groups and verified again
- [x] Final independent review of all of S4 (web security and privacy, web accessibility and language, the author's
      publish flow, test validity, documentation; a skeptic per dimension): 48 confirmed findings, fixed in four
      groups; the groups' 28 requests to each other applied, then checked by a verifier (6 more, fixed). A second
      independent verification (four group verifiers and one security and privacy verifier, a skeptic each) found
      19 more, all confirmed and fixed; the code fixes have tests that fail on the code before them
- [x] Owner decisions recorded (2026-10-24): one Node.js system with Lumi's server half, a PHP server half considered
      and not chosen (D-081); a whole-code-base simplification pass before S5 (section S4+ below); problem reporting
      for the pilot and Q16 required before it (S6 below)
- [ ] First manual run of the protocol and the matrix (`UD-031`, `NFR-003`; D-079), by HVL/ALU before the first
      pilot release: the set-ups AT-1, AT-2, AT-3, KB and Z400 of `docs/accessibility/manual-test-protocol.md`, each
      saved as a dated file in `docs/accessibility/results/`, which holds none yet. `docs/TRACEABILITY.md` lists both
      requirements as "tested" only because `apps/server/a11y/accessibilityDocs.a11y.test.ts`, a check that the
      documents agree, carries their IDs; it passes without any result (Evaluator Guide §2)
- [x] Gate: as in the Evaluator Guide §5, S4 (2026-10-24; output in the session log)

## S4+ — Whole-code-base simplification ✅ (2026-10-25; owner decision 2026-10-24)

Before S5 builds on the code, the owner asked for one pass over the whole code base (server, web app, packages,
tools, tests) that makes it shorter where meaning and behaviour stay the same. The pass changes no behaviour, page,
text or API, removes or weakens no test (the test count does not drop) and keeps every CLAUDE.md rule.
- [x] Measure duplication with a duplicate-code detector run outside the repository (no new dependency; `jscpd`
      4.0.5 through `npx`): 43 exact clones of 6+ lines (406 lines, 0.53 % of 76 838) and 228 of 4+ lines (1 571
      lines, 2.04 %), most of them in test setup
- [x] Finders per area propose changes; two independent skeptics per proposal, and a proposal is applied only when
      neither refutes it: 12 areas, 84 proposals, 62 survived both skeptics (one judged equivalence, the other worth
      and the CLAUDE.md rules); the planner merged them into 60 and dropped 2 that clashed
- [x] Apply area by area with that area's tests; one commit per area: 59 of 60 applied (one undone because a test
      failed), in 23 commits after `03ba0de`. A script error first handed each area only its first batch (20 of 60);
      a follow-up checked the count and applied the other 39
- [x] The full S4 gate again (commit `0cda63a`), every step green with the same test counts as the S4 gate; report:

      | | Before (`03ba0de`) | After (`0cda63a`) |
      |---|---|---|
      | Lines changed (outside `docs/`) | — | 114 files: 732 added, 1 301 removed, **−569 net** |
      | of which server code / server tests / web / packages / tools / config | — | −44 / −389 / −21 / −21 / −90 / −4 |
      | Lines the detector scans | 76 838 in 858 files | 76 258 in 863 files |
      | Exact clones of 6+ lines | 43 (406 lines, 0.53 %) | 31 (286 lines, 0.38 %) |
      | Clones of 4+ lines | 228 (1 571 lines, 2.04 %) | 202 (1 370 lines, 1.80 %) |
      | Test definitions (`vitest list`): default / a11y / e2e | 1 676 / 48 / 15 | 1 676 / 48 / 15, every name kept |
      | Tests run: `npx vitest run` / `test:a11y` / `test:e2e` | 21 423 / 332 / 16 | 21 423 / 332 / 16 |

      What changed: shared test helpers instead of repeated set-up (`requestAs`, `listenOnLoopback`,
      `capturedLogger`, `playerIntegration`, `appWith`, matrix dimensions, the colour modes of the axe suites), one
      UUID check and one first-script check where the code had two, dead exports and duplicated types removed, one
      `ExternalLink` for **Hjelp** and **Personvern**, the colour-literal rule written once. Nothing a user, Canvas,
      Feide or H5P sees changed. The finder proposals, verdicts and plan were kept in
      `docs/simplification/round-1-findings.json` while the pass ran (removed with this report; in the history at
      `acd24b4`). The round-1 commits carry no `Refs:` line; this report's commit names the requirements they touched
- [ ] Second round with smaller slices (about 2 000–3 000 lines per finder), the same two skeptics, until a round
      finds nothing new: the owner decides from these numbers

## S5 — Læringsdesign studio 🟨 (started 2026-10-28)

Start from `docs/reference/proposals/phases.yaml` and `proposals/mappe-template.nn.md`; ALU must confirm labels, criteria and limits.

**Asked at the start of S5 (owner's answers, 2026-10-28):**
1. Per-session explainer and quiz: not wanted; sessions keep their summaries in chat and here.
2. A second simplification round (S4+): skipped, as recommended; the light check before the pilot stays in S6.
3. GitHub CI (Q16): `main` exists, protected by a ruleset; pull request #8 ran the whole gate green on GitHub
   (2026-10-26, about 25 minutes). The owner merges it. The actions moved to versions on Node 24 (checkout v7,
   setup-node v7, cache v6, upload-artifact v7). Dependabot's 14 pull requests are closed; it now opens one grouped
   monthly pull request per ecosystem for minor and patch updates and never a major version (`.github/dependabot.yml`).
4. The pre-commit hook checks the spec site whenever `PROGRESS.md`, `README.md` or a Markdown file under `docs/` is
   staged (lint-staged in `package.json`).

ALU has not yet confirmed the drafts in `docs/reference/proposals/`; S5 builds on them marked as drafts, and their
texts stay editable without code (`PED-011`).

**Decided while planning S5 (owner, 2026-10-28; recorded as D-082…D-100):**
1. **Running the session:** work restarts by itself after a usage limit (an hourly scheduled task, switched off when
   S5 is done), and all of S5 is done in this session.
2. **Copies:** «Lagre som ny versjon» saves a copy linked to the original (D-093).
3. **The PDF:** the portfolio PDF is rendered by Chromium on the server (D-096).
4. **Placeholders:** guidance placeholders are an error that can be acknowledged with a reason; D-074 is unchanged
   (D-086).
5. **The guide:** the guide and the pattern catalogue are public, with no sign-in (D-089).
6. **The Canvas side moves to S6:** the bank in the Deep Linking picker, "new from a pattern" in Canvas and the
   `LTI-007` duplicate in `/app/play` (D-098).
7. **The review:** S5 may close with the ALU and pilot review requested and open (Q17, D-100).

Steps (plan: probes first, then shared contracts, then parallel workstreams):
- [x] 0. Start: restart task, decisions D-082…D-100, spec 02 and 04 amendments, CLAUDE.md §2–§3, Q17
- [x] 1. Probes P1–P7, kept as tests (amendments to D-080, D-083…D-086, D-092…D-094, D-096): skeleton creation on the server, duplicate by paste-source, learner state
      after edits, tagged PDF, Markdown tree and Mustache, the `⟦…⟧` marker, the editor's `<dialog>`
- [x] 2. Contracts: migration `s5_learning_design`, API contract split and schemas, server wiring and env, content
      loader and `content:check`, `ContentDuplicator`, web scaffolding (tab registry, pages, navigation) (309fc19;
      amendments to D-087, D-090…D-092, D-096, D-099); the probes hardened for slow CI runners (e4621d5)
- [x] 3. Guide, phase matrix and catalogue (`PED-001`…`PED-003`); patterns and V-PLACEHOLDER (`PED-010`, `PED-011`,
      `PROD-001`, `PROD-009`)
      — stage 1 done: pattern format, loader and checks, creation API, V-PLACEHOLDER incl. missing media, the
        BranchingScenario picture repair (W2a); stage 2 done: the nine patterns in nn, nb and en, created on the
        real types in every type and phase (W2b; drafts for ALU, Q17); stage 3 done: the guide loader and its
        closed node tree, the public studio routes, the guide page with the phase matrix and the catalogue with
        filters in the address, the pattern page with «Lag frå dette mønsteret» (W1a); stage 5 done: the guide text in
        nn, nb and en, in PED-002's order with every research claim cited (W1b; draft for ALU, Q17)
- [x] 3. Metadata, planner, learner time and purpose (`PED-030`…`PED-032`)
      — stage 3 done: the Læringsdesign tab and its routes, the publish prompt, course codes from Canvas labels
        (privacy filter), the planner with gaps, time and purpose before the activity in the portal and Canvas (W3);
        screenshots in `nn` sent to the owner (2026-10-29)
- [x] 3. Co-authors, content bank and duplicate (`PROD-007`); safe editing (`PROD-013`)
      — stage 1 done: structure signature, the 409 save gate, stale state writes dropped, the copy route (W5a);
        stage 2 done: the save choice dialog in the editor, portal and Canvas, inert page while open (W5b);
        stage 4 done: staff eligibility written at Feide login, people search (rate-limited, never logged),
        co-authors, the content bank for HVL staff authors (listing cleared on unpublish or private), duplicate with
        attribution for editors, the copy's library version, the Deling tab, the bank page, /personvern (W4)
- [x] 3. Mappe export in Markdown and tagged PDF (`MAPPE-001`…`MAPPE-004`)
      — stage 4 done: template and criteria loader (optional until written), Mustache rendering with the Markdown
        escaper and refused value places, the reader's guide from the criteria, the Del 1 word count, minimum group
        size, the PDF from Chromium with bounded slots and time limits, the routes and the /mappe page (W6a);
        stage 5 done: the template and the 2025 criteria set in nn, nb and en (W6b; drafts for ALU, Q17), and the
        PDF outline keeps spaces where a heading wraps (D-096)
- [x] 4. Integration: axe suite for the new pages and the dialog, e2e flows, screenshots in `nn` to the owner
      — every studio page and view in the a11y suite (axe signed out and in, forced colours, keyboard journeys,
        reflow, spacing, language; the dialog leaves the page inert); four new e2e flows (pattern → publish, bank
        copy, mappe downloads, safe-edit reset) and every pattern played once; fixes found on the way (planner and
        /mappe reflow, one bank live region, the dialog's tab stops, references with `lang`, busy texts);
        screenshots of every new view sent to the owner (2026-10-29)
- [x] 5. Docs: `content/` READMEs for ALU, GLOSSARY, Evaluator Guide, `/personvern`, ALU review packet
      — numbered how-tos for ALU, glossary terms, the S5 gate row and limitations, the PDF check in the manual
        protocol, `docs/reference/alu-review-s5.md` (Q17)
- [ ] 6. Review with skeptics, two verification passes
- [ ] Pilot evaluators from ALU and Pedagogisk akademi review the studio content (Q17; may stay open, record the outcome here)
- [ ] Gate: as in the Evaluator Guide §5, S5 (D-100)

**Open items at the end of S5** (listed with the gate output, D-100; limitations 16–21 in the Evaluator Guide §6):
1. **The ALU and pilot review (Q17):** the phase labels and texts, the guide in three languages and its sixteen
   references (all `verify: true`), the nine patterns with their skeletons' guidance, the mappe template, criteria and
   limits (7 500 words, 11 attachments, *(verify)*); pilot teachers try the patterns. Packet with a checklist for the
   outcome: `docs/reference/alu-review-s5.md`. Required before the pilot.
2. **The content bank's consent text** (`sharing.bankConsent`, version 1): ALU and HVL's lawyers (D-091); a new text
   raises `BANK_CONSENT_VERSION` and `SHOWN_CONSENT_VERSION` together. The privacy page's sentences about colleagues
   seeing staff names (`privacy.staff1`–`staff3`) go to the DPO with the rest of the page (Q6).
3. **The manual checks:** the portfolio PDF with PAC and NVDA, recording the D-096 residuals (`MAPPE-004`; protocol
   J4.5–J4.10), and the studio's steps J1.10–J1.13 and J4.1–J4.4 with the screen readers; both are listed as to do
   under «Runs due» in `docs/accessibility/results/README.md`.
4. **The Canvas side of the studio (S6, D-098):** the content bank and "new from a pattern" in the Deep Linking
   picker, and the `LTI-007` duplicate in `/app/play`.
5. **Results in the mappe (S6, D-095):** the real `ActivityResultsSource`; S5's export says there are no results yet.
6. **Chromium in the S6 image (D-096):** Chromium and fonts with æ, ø and å, a non-root user with unprivileged user
   namespaces for the sandbox, and Chromium kept patched.
7. **Known limits, accepted for now (D-091, D-092, D-093):** the bank shows the 200 newest listings without paging,
   and a listing only while its owner is findable staff; people search allows a fixed 30 searches a minute per
   person; a copy whose source and source author are both deleted shows
   no «Kopi av …» sign; on the **Deling** tab a student-author owner still sees people search and gets the server's
   refusal; the first save after HVL installs a newer minor version of a content type counts as structural.

## S6 — Grade bridge, insight, privacy, deployment ⬜

- [ ] xAPI bridge, ingestion, minimal storage (`LTI-010`, `LTI-011`, `DATA-012`)
- [ ] AGS queue and worker, sync status, honest labelling (`LTI-012`, `LTI-013`); NRPS counts (`LTI-008`)
- [ ] Insight views with *k*-suppression (`INS-001`…`INS-010`, `PROD-010`); spaced-retrieval suggestion (`PROD-014`, COULD)
- [ ] Purge, audit, data-subject requests, DPIA input (`DATA-003`…`DATA-008`, `DATA-010`); log redaction review (`NFR-006`).
      The data-subject tool must delete learner state through the storage directly: Lumi 10.0.4's
      `deleteAllContentUserDataByUser` checks permission for one user and deletes the acting user's data
      (`ContentUserDataManager.js:39-43`)
- [ ] Separate files origin for user files with signed URLs (`SEC-004`, D-045; URLs from S3's `HvlUrlGenerator`)
- [ ] Panopto guidance (`H5P-010`); ClamAV scanning (`SEC-006`); LTI Dynamic Registration (`LTI-009`, COULD)
- [ ] Docker images, load test, runbook (`NFR-001`, `NFR-002`, `NFR-007`); conformance report (`UD-040`)
- [ ] Library texts that are English in `nn` and `nb` (S5 probe P1: MultiChoice, QuestionSet, InteractiveBook and
      BranchingScenario buttons and messages; patterns set their own texts, D-084): consider an HVL language overlay
      through Lumi's `alterLibraryLanguageFile` hook, so activities made in the editor are Norwegian too (its own
      decision)
- [ ] The Canvas side of the studio (D-098): the content bank and "new from a pattern" in the Deep Linking picker,
      and the `LTI-007` duplicate in `/app/play`
- [ ] Results in the portfolio: the real `ActivityResultsSource` with *k*-suppression (D-095); Chromium and fonts
      with æ, ø and å in the production image for the PDF (D-096)
- [ ] Lumi's server half (D-081): ask Lumi's maintainers for a release with their unreleased file-security work, or
      review and pin a Lumi commit built from source as D-022 pins the editor (its own decision: CLAUDE.md names
      10.0.4; the full gate), then remove the adapters it makes unnecessary; report our fixes and the D-080 barriers
      upstream to Lumi and H5P
- [ ] Problem reporting for the pilot (owner decision 2026-10-24): a short tester guide in Nynorsk in `docs/` and
      GitHub issue templates in `.github/ISSUE_TEMPLATE/` (a fault; an accessibility barrier) asking for the steps,
      what was expected and what happened, device, browser, assistive technology and zoom, the activity type or
      page, a screenshot, and the severity (cannot use, or privacy or security; accessibility barrier; cosmetic),
      with matching labels. Rule: no personal data in an issue (no student names, e-mails or Feide IDs; log lines are
      safe by design, `DATA-009`). The guide describes how a problem is fixed: reproduced in the test set-up, a test
      that fails first, the cause fixed, the area's tests and the gate, a branch and pull request that HVL reviews
      and merges. A problem seen only in HVL's Canvas or Feide needs the error and the server's log lines; one seen
      only on a device or with a screen reader needs a precise description and an HVL re-test; H5P's own barriers
      are repaired at run time or registered and reported (D-080). Manual results stay dated in
      `docs/accessibility/results/`
- [ ] Research export (owner's idea, 2026-10-26; to consider when insight is built): analysis and research scripts
      run beside the system, in Python or R (pandas, Jupyter notebooks), which ALU and Pedagogisk akademi researchers
      use, while everything inside the product stays TypeScript. They never touch the live database: the system
      produces an anonymised export (pseudonyms only, groups under *k* = 5 suppressed, only the fields a question
      needs), built and tested in TypeScript under the privacy rules, with a documented format and an example
      notebook. Research use of student data needs its own legal basis and the DPO's approval (Q6) and belongs in
      the DPIA input (`DATA-005`)
- [ ] Light simplification check before the pilot (owner decisions 2026-10-24 and 2026-10-25), as in S4+ (two
      independent skeptics per proposal, no behaviour change, every test kept, the full gate after), with one more
      lens: does the code read as if a careful human wrote it? Signs of machine-written code to look for: comments
      that restate the code, checks repeated where one layer already guarantees them, generic or overlong names,
      boilerplate copied across files, abstractions with one user, and idioms that differ from file to file because
      different agents wrote them. The reviewers must tell "unfamiliar but correct" from "needlessly odd": code that
      is unusual because it is right (a security check, an H5P workaround, a timing guard) stays, and gets a short
      WHY comment a human maintainer can follow, rather than being made ordinary and wrong. An HVL developer reads a
      sample afterwards and has the last word
- [ ] Gate: as in the Evaluator Guide §5, S6

---

## Open questions and blockers

| # | Question | Owner | Blocks |
|---|---|---|---|
| Q1 | ~~Confirm the licence GPL-3.0-or-later (D-015)~~ Resolved 2026-10-16: `LICENSE` added | — | — |
| Q2 | Confirm or replace the derived reference inputs 1–6, and supply the originals (logo files, ALU model document, mappe guidance) (`docs/reference/README.md`) | HVL / ALU / TeCopp | S2–S5 as listed |
| Q7 | Allow `hub-api.h5p.org` (and ideally `www.hvl.no`, `auth.dataporten.no`, `docs.feide.no`, `*.instructure.com`) in the environment's network settings, or run `tools/seed/fetch-seed-packages.sh` elsewhere | Repository owner | S2 |
| Q8 | Decide whether "(formativ)" may appear in Canvas assignment names (`LTI-013`) | HVL / ALU | S6 |
| Q9 | `SEC-003` refuses a package whose library has a different patch version. Most `.h5p` files exported elsewhere differ in patch version. May an *older* patch be accepted for a content-only import? S2 follows the spec strictly | HVL / ALU | Pilot |
| Q10 | Confirm that the ten seed packages may be committed to the repository (D-042 size rule; H5P libraries are mostly MIT) | Repository owner | S2 |
| Q12 | Student authors (`AUTHOR_COURSE_GROUPS`) may share only `private` until a course visibility exists, and Feide users without a Feide ID cannot log in (D-059, D-054) | HVL / ALU | Pilot |
| Q13 | Confirm `"hvl_placement": "<placement>"` in each placement's `custom_fields` (now in `docs/reference/canvas-lti13-developer-key.json`), so the graded placement is recognised (D-061) | TeCopp | S3 pilot |
| Q14 | Confirm S4's publish flow (D-074), which replaced "no publishing before S4": an author publishes from **Sjekk og publiser**, an error needs a reason, which is asked for again after 14 days; the status changes only through publish and unpublish, and the sharing API changes only who can find an activity (D-066) | HVL / ALU | Pilot |
| Q15 | Learner LTI launches are not written to the authentication audit (D-064) | HVL DPO | S6 |
| Q3 | Feide Customer Portal registration and redirect URIs | HVL IT | S3 |
| Q4 | Paste `docs/reference/canvas-lti13-developer-key.json` into HVL's test Canvas; report client ID, deployment ID, which instance TeCopp uses (test/beta/production), and whether `feide_login` arrives under `privacy_level` anonymous and equals the Feide ID; only then set `"feideLinking": true` for that platform in `LTI_PLATFORMS` (AUTH-005, D-063) | TeCopp | S3 |
| Q16 | The repository has no `main` branch, and CI (`.github/workflows/ci.yml`) runs only on pushes to `main` and on pull requests, so GitHub has never run the gate: every session's gate ran locally only. Create `main` from `ccr-07f63266-6cere5` or open a pull request, and decide what to do with the open Dependabot update branches (pins stay exact). **Required before the pilot (owner, 2026-10-24).** | Repository owner | Confidence in every gate; the pilot |
| Q5 | Hosting: HVL on-premises or Sikt, both in the EEA (`DATA-004`) | HVL IT | S6 |
| Q6 | Data protection officer confirms the legal basis and reviews DPIA input (`DATA-005`) | HVL DPO | S6, pilot |
| Q17 | Review the studio's drafts: phase labels and texts, the guide and its references, the nine patterns, the mappe template, criteria and limits, and the content bank's consent text (with HVL's lawyers); pilot teachers try the patterns. Packet: `docs/reference/alu-review-s5.md` (D-100). **Required before the pilot.** | ALU, Pedagogisk akademi, HVL legal | The pilot |

## Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Lumi h5p-server 10.0.4 does not work with Core 1.28 libraries. **Settled 2026-10-23 (D-047):** with the F1–F3 workarounds (spec 01 §1) the ten real content types install, save and play under Core 1.28; only spike step 3, the Hub registration, waits for Q7 (see R-04) | Low | Medium | No fallback to 1.27; `realTypes.browser.int.test.ts` runs the ten types again after every library update (D-078); `npm run hub:check` once the Hub is reachable; `patch-package` only with a decision |
| R-07 | No H5P editor 1.28 release tag exists | Certain | Medium | Pinned, reviewed commit (D-022); revisit when a tag appears |
| R-02 | ltijs 7 is a recent rewrite with possible early bugs | Medium | Medium | Keep it behind `LtiProviderFactory`; contract tests; pin the exact version |
| R-03 | Canvas or Feide endpoint values differ from the spec | Medium | Medium | *(verify)* markers; reference items 4 and 5; integration tests against mocks first |
| R-04 | Hub registration at `hub-api.h5p.org/v1/sites` fails (HTTP 405 reports in 2026) | Medium | Low | Runtime does not depend on the Hub; offline seeding (`H5P-003`) |
| R-05 | A session runs out of usage quota mid-milestone | Medium | Low | One milestone per session; commit early; update this file before stopping |
| R-06 | Upstream H5P accessibility barriers | High | Medium | Theme fixes where possible; report upstream; document in `UD-040` |
| R-08 | `image-size` (via h5p-server) has two unfixed DoS advisories; accepted until 2027-01-31 (D-030) | Low | Medium | Only reachable through authenticated uploads; `SEC-002` sniffing in S2; `check:audit` fails at expiry |
| R-09 | Lumi's npm releases lag its repository: none since 10.0.4 (2025-03-08), while `master` carries file-security work we would want (D-081) | High | Medium | Our own file security (D-003) and adapters in our code; S6 asks for a release or pins a reviewed commit (D-081); the revisit triggers in D-081 |

## Session log

Append one entry per session: date, session, what was done, gate output, and any decisions added.

- **2026-10-16 · S0** — Specification written. Plan corrections recorded as D-001…D-007. Gate output above.
- **2026-10-21 · S0** — Licence confirmed (D-015). Reference inputs 1–6 assembled from public sources with citations and checked again (`docs/reference/`). Specs aligned: HVL brand palette and fonts (D-017, D-018), phase labels and model (D-019), merit portfolio (D-020), Feide logout (D-021), H5P editor pin (D-022), Canvas platform values. Spec website generator added (`tools/spec-site/`).
- **2026-10-21 · S1** — Monorepo scaffold (npm workspaces, Node 24, TypeScript 6.0.3, ESLint, Prettier,
  Husky, Vitest projects), documentation linter with 11 checks, traceability tests, dependency checks
  (pins, licences, audit with reviewed exceptions), CI and docker compose. Server foundations: config schema,
  log redaction, learner pseudonyms, `nn`/`nb`/`en` messages, the 20-model Prisma schema with its migration
  and data inventory. H5P: verified core 1.28.0 and editor files, config factory, boot check, storage
  adapters, cleanup job, zip guard. Spike steps 1–2 passed; 3–5 blocked by the network (R-01 open).
  Decisions D-023…D-030. Gate output:

  ```
  $ npm run typecheck                                  exit 0
  $ npm run lint                                       exit 0
  $ npm run format:check                               exit 0
  $ npm run doc:lint                                   ✓ doc-lint: 11 checks passed.
  $ npm run check:filesize                             ✓ doc-lint: file-size passed.
  $ npm run check:pins                                 ✓ check:pins: 2 manifests, every version is pinned exactly.
  $ npm run check:licences                             ✓ check:licences: 157 production packages, all GPL-3.0-compatible.
  $ npm run check:audit                                ✓ check:audit: 2 high/critical advisories, all covered by reviewed exceptions.
  $ npm run privacy:inventory-check                    ✓ privacy:inventory-check: 20 models, 154 fields, all in docs/privacy/DATA-INVENTORY.md.
  $ npx vitest run                                     Test Files 22 passed (22) · Tests 147 passed (147)
  $ npm run spec:trace -- --check --done-through=S1    ✓ 126 requirements, traceability up to date.
  $ npm run spec:site -- --check                       ✓ docs/site/index.html is up to date.
  $ npm run h5p:fetch-core                             ✓ core and editor files match their committed hash lists
  $ npm run boot-check --workspace apps/server
  {"level":"info","service":"hvl-interaktiv-server","h5pCoreApi":"1.28","hubHost":"hub-api.h5p.org","siteRegistered":false,"msg":"H5P engine configured"}
  ```
- **2026-10-22 · S1 review** — Independent review of Session 1 (three reviewers, a skeptic per finding),
  then a verification pass that re-ran every finding against the fixes. Fixed: log redaction (message
  strings, printf arguments, Prisma and driver-adapter errors by code only, sensitive key endings and Feide
  attributes, credentials and e-mails in free text in linear time, valid JSON lines); production secret
  checks (text with newlines, too few distinct bytes, secrets that give the same HMAC key); H5P settings
  from storage (only an allowlist survives, so no stored URL or script setting); S3 uploads report the S3
  error; temporary-file listing skips foreign keys; doc-lint follows every `Tests:` path form; spec-trace
  and doc-lint share one rule for test titles (D-033); `nin` matched as a word in the learner-table guard;
  SPDX `WITH` validation; data inventory and `DATA-003` purge of learner `User` rows (D-034); h5p-express
  Express override (D-032) and S1 items finished in S2 (D-031). Decisions D-031…D-034. Gate output:

  ```
  $ npm run typecheck                                  exit 0
  $ npm run lint                                       exit 0
  $ npm run format:check                               All matched files use Prettier code style!
  $ npm run doc:lint                                   ✓ doc-lint: 11 checks passed.
  $ npm run check:filesize                             ✓ doc-lint: file-size passed.
  $ npm run check:pins                                 ✓ check:pins: 2 manifests, every version is pinned exactly.
  $ npm run check:licences                             ✓ check:licences: 214 production packages, all GPL-3.0-compatible.
  $ npm run check:audit                                ✓ check:audit: 2 high/critical advisories, all covered by reviewed exceptions.
  $ npm run privacy:inventory-check                    ✓ privacy:inventory-check: 20 models, 154 fields, all in docs/privacy/DATA-INVENTORY.md.
  $ npx vitest run                                     Test Files 31 passed (31) · Tests 203 passed (203)
  $ npm run spec:trace -- --check --done-through=S1    ✓ 126 requirements, traceability up to date.
  $ npm run spec:site -- --check                       ✓ docs/site/index.html is up to date.
  $ npm run h5p:fetch-core                             ✓ H5P core 1.28.0 and editor ab2daa18 are in apps/server/h5p
  $ npm run boot-check --workspace apps/server         (no .env, no DATABASE_URL/REDIS_URL/S3_*/PSEUDONYM_SECRETS)
  {"level":"info","service":"hvl-interaktiv-server","h5pCoreApi":"1.28","hubHost":"hub-api.h5p.org","siteRegistered":false,"msg":"H5P engine configured"}
  ```

- **2026-10-23 · S2** — Session 2 delivered on our own Express 5 routes over Lumi's `H5PAjaxEndpoint`
  (D-035): the actor's account and state views (D-036), `HvlPermissionSystem` with a test per matrix cell and
  a start-up guard (`H5P-006`), learner state under the pseudonym (`H5P-005`, `PROD-008`), the ten-type
  filter, DragQuestion removal and the sub-content policy (`H5P-002`, `PROD-002`, `SEC-008`, D-039), our own
  player page with script-safe JSON (D-040), Nynorsk-first translation (`H5P-008`, D-046), upload security
  (`SEC-001`…`SEC-005`, D-043…D-045), offline audited seeding and package import rules (`H5P-003`,
  `H5P-011`, `SEC-003`, D-041, D-042), `hub:check`, TypeDoc and a Chromium test of Core 1.28 on our player
  page. Independent review, then fixes, each with a test that fails on the old code: author metadata ran as
  script in H5P's "Rights of use" dialog; a truncated multipart upload could end the process; `.h5p`
  downloads were cut short; content.json paths could leave the package; the editor still called the Hub;
  a library hidden under an unknown key was loaded; audit rows are written before an install; client errors
  keep their 4xx and request bodies are never logged; documentation (removal conditions on `UPSTREAM`,
  `DATA-*` IDs on `PRIVACY`, upstream pins no longer count as proof, the D-045 deviation tagged).
  Three verification passes followed, each finding challenged by a skeptic before it was fixed. The first
  found a content.json path that `HTTPS://` (upper case) let out of the package, a `content/./content.json`
  entry that replaced the checked one on extraction, and metadata, copyright, image paths and alt texts that
  H5P Core's "Rights of use" dialog renders from anywhere in the parameters (fixed in
  `semantics/rightsOfUse.ts`, metadata as true plain text). The second found a quote in a source link's host,
  values inside metadata objects and arrays joined into the dialog's HTML. The third (an h5p.js sink audit and
  Chromium fuzzing with more than 60 variants) found no further script, but five inputs that ended a save with
  500; they are now 4xx. Each fix has a test that fails on the code before it. Arrange/Act/Assert comments were
  added to 113 long tests of S1 and S2 and doc-lint now checks them (`DOC-006`). Follow-ups: the real types'
  `getCopyrights` when the Hub packages arrive, and a player-page script CSP without `'unsafe-inline'` in S4
  (D-039). hub-api.h5p.org is still refused by the egress proxy (403 at 07:32 UTC, Q7), so spike steps 3–5,
  the real seed packages, the CI seed step and R-01 (D-047) stay open. Decisions D-035…D-046. Gate output
  (after the last fix, commit b06511e):

  ```
  $ npm run typecheck                                  exit 0
  $ npm run lint                                       exit 0
  $ npm run format:check                               All matched files use Prettier code style!
  $ npm run doc:lint                                   ✓ doc-lint: 11 checks passed.
  $ npm run check:filesize                             ✓ doc-lint: file-size passed.
  $ npm run check:pins                                 ✓ check:pins: 2 manifests, every version is pinned exactly.
  $ npm run check:licences                             ✓ check:licences: 182 production packages, all GPL-3.0-compatible.
  $ npm run check:audit                                ✓ check:audit: 2 high/critical advisories, all covered by reviewed exceptions.
  $ npm run privacy:inventory-check                    ✓ privacy:inventory-check: 20 models, 155 fields, all in docs/privacy/DATA-INVENTORY.md.
  $ npx vitest run                                     Test Files 82 passed (82) · Tests 19290 passed (19290) · no Errors or Unhandled
  $ npx vitest run -t "H5P-002|PROD-002"               Test Files 11 passed | 71 skipped · Tests 24 passed      (ten types only)
  $ npx vitest run -t "SEC-003|H5P-011|H5P-006"        Test Files 24 passed | 58 skipped · Tests 18702 passed   (no installs by non-admins)
  $ npx vitest run -t "SEC-001"                        Test Files 8 passed | 74 skipped · Tests 111 passed      (SVG corpus)
  $ npx vitest run -t "\[<ID>\]", one run per ID       all 17 pass on their own:
      H5P-001 26 · H5P-002 24 · H5P-003 8 · H5P-004 32 · H5P-005 27 · H5P-006 18669 · H5P-008 58 · H5P-011 17
      SEC-001 111 · SEC-002 70 · SEC-003 19 · SEC-004 10 · SEC-005 31 · SEC-008 37
      PROD-002 3 · PROD-008 4 · PROD-012 24
  $ npm run spec:trace -- --check --done-through=S2    ✓ 126 requirements, traceability up to date.
  $ npm run spec:site -- --check                       ✓ docs/site/index.html is up to date.
  $ npm run h5p:fetch-core                             ✓ H5P core 1.28.0 and editor ab2daa18 are in apps/server/h5p
  $ npm run docs:api                                   html generated at docs/api (warnings as errors; none)
  $ npm run boot-check --workspace apps/server
  {"level":"info","service":"hvl-interaktiv-server","h5pCoreApi":"1.28","hubHost":"hub-api.h5p.org","siteRegistered":false,"msg":"H5P engine configured"}
  $ NODE_USE_ENV_PROXY=1 npm run hub:check             "ok": false, "error": "fetch failed: Request was cancelled." (proxy 403, Q7)
  ```

- **2026-10-23 · S3** — Session 3 delivered dual authentication on our own Express router (D-048…D-066). Feide
  login (openid-client 6) with PKCE, state and nonce in a single-use login transaction, ID-token signature checks,
  roles from the Groups API failing closed, Redis portal sessions (`__Host-hvli_sid`, idle 2 h, absolute 12 h), a
  synchronizer CSRF token and logout through Feide (`AUTH-001`…`AUTH-004`). ltijs 7 on our router with PostgreSQL
  storage, a claim allowlist, our deployment and active-platform checks, the ltik as a Bearer header or on four
  paths only, and no admin from LTI (`LTI-001`…`LTI-004`). The Deep Linking picker with a JWT the mock Canvas
  verifies, resource-link launches and course copy (`LTI-005`…`LTI-007`, `PROD-005`); H5P URLs with the request's
  token and signed content-file grants (`H5P-007`, D-058); one 404 page and visibility-only sharing (`PROD-004`,
  `PROD-006`); Canvas–Feide linking for platforms with `feideLinking` (`AUTH-005`, D-063); `npm start` with
  `/healthz`, start-up re-encryption of platform keys and graceful shutdown; a mock Feide and a mock Canvas
  (D-049); three Chromium e2e flows, among them the Canvas iframe with third-party cookies blocked (D-065).
  An independent review in two rounds (Feide, LTI, privacy, app wiring, spec conformance; a skeptic per finding)
  and three adversarial verification passes followed; each fix has a test that fails on the code before it. The
  review found that AUTH-005 trusted any `feide_login` from any platform (now only platforms with `feideLinking`,
  Feide IDs of `ALLOWED_FEIDE_ORGS` and existing non-learner Feide accounts, so nobody can pre-claim a Feide ID),
  course-group authorship that ignored membership dates, a failed listen that still logged "listening", portal
  4xx pages that became 500, and a sharing race. Pass 1 found that a one-step `DATA_ENCRYPTION_KEYS` rotation
  would break LTI on servers not yet restarted (now three steps, D-056) and that login and linking could choose
  different identity rows while key rings are mixed. Pass 2 found a double-clicked first Deep Linking launch
  refused as its own rival, the same rotation problem for `IDENTITY_HASH_KEYS` and `URL_SIGNING_KEYS` (D-055,
  D-058), and launch refusals shown in Nynorsk to an English launch. Pass 3 found a test that failed about 1 run
  in 128 and an understated leaked-key risk (D-055: it lasts while rows hashed with the key exist). The gate then
  found 33 TypeDoc warnings in S3 code (`docs:api` failed) and two tests that relied on the test before them under
  `-t`; both fixed. Open: HVL's Feide registration and redirect URIs (Q3) and the TeCopp test launch that confirms
  client and deployment IDs and `feide_login` before `feideLinking` is set (Q4); owner questions Q12–Q15; the
  LTI pages stay unstyled until S4 (D-048). Decisions D-048…D-066, with D-050, D-055, D-056, D-058 and D-063
  amended. Gate output (after the last fix, commit e31237e):

  ```
  $ npm run typecheck                                  exit 0
  $ npm run lint                                       exit 0
  $ npm run format:check                               All matched files use Prettier code style!
  $ npm run doc:lint                                   ✓ doc-lint: 11 checks passed.
  $ npm run check:filesize                             ✓ doc-lint: file-size passed.
  $ npm run check:pins                                 ✓ check:pins: 2 manifests, every version is pinned exactly.
  $ npm run check:licences                             ✓ check:licences: 229 production packages, all GPL-3.0-compatible.
  $ npm run check:audit                                ✓ check:audit: 2 high/critical advisories, all covered by reviewed exceptions.
  $ npm run privacy:inventory-check                    ✓ privacy:inventory-check: 21 models, 162 fields, all in docs/privacy/DATA-INVENTORY.md.
  $ npx vitest run                                     Test Files 174 passed (174) · Tests 20126 passed (20126) · no Errors or Unhandled
  $ npm run test:e2e                                   Test Files 3 passed (3) · Tests 6 passed (6)   (iframe, Deep Linking, portal)
  $ npx vitest run -t "AUTH-00"                        Test Files 38 passed | 136 skipped · Tests 351 passed
  $ npx vitest run -t "LTI-00"                         Test Files 58 passed | 116 skipped · Tests 348 passed
  $ npx vitest run -t "LTI-005"                        Test Files 10 passed | 164 skipped · Tests 85 passed
  $ npx vitest run -t "H5P-002|PROD-002"               Test Files 11 passed | 163 skipped · Tests 24 passed      (S2)
  $ npx vitest run -t "SEC-003|H5P-011|H5P-006"        Test Files 25 passed | 149 skipped · Tests 18707 passed   (S2)
  $ npx vitest run -t "SEC-001"                        Test Files 8 passed | 166 skipped · Tests 111 passed      (S2)
  $ npx vitest run -t "\[<ID>\]", one run per ID       all 16 S3 IDs pass on their own:
      AUTH-001 63 · AUTH-002 81 · AUTH-003 152 · AUTH-004 21 · AUTH-005 48
      LTI-001 96 · LTI-002 61 · LTI-003 64 · LTI-004 40 · LTI-005 85 · LTI-006 13 · LTI-007 6
      PROD-004 13 · PROD-005 8 · PROD-006 19 · H5P-007 57
  $ npm run spec:trace -- --check --done-through=S3    ✓ 126 requirements, traceability up to date.
  $ npm run spec:site -- --check                       ✓ docs/site/index.html is up to date.
  $ npm run h5p:fetch-core                             ✓ H5P core 1.28.0 and editor ab2daa18 are in apps/server/h5p
  $ npm run docs:api                                   html generated at docs/api (warnings as errors; none)
  $ npm run boot-check --workspace apps/server
  {"level":"info","service":"hvl-interaktiv-server","h5pCoreApi":"1.28","hubHost":"hub-api.h5p.org","siteRegistered":false,"msg":"H5P engine configured"}
  $ npm run mock:platform & npm start                  "LTI platforms synchronised" → "LTI platform keys on the current encryption key" → "HVL Interaktiv server listening"
  $ curl http://localhost:3000/healthz                 {"status":"ok"} (200)
  $ curl http://localhost:3000/lti/keys                {"keys":[{"kty":"RSA",…}]} (200)
  $ kill -TERM <server>                                "HVL Interaktiv server stopped"
  ```

- **2026-10-24 · S4** — Session 4 delivered universal design over 47 commits (D-047, D-067…D-081). Real H5P content
  types built from GitHub at pinned commits: 120 libraries, the ten types, ten Nynorsk examples (D-078), which settled
  R-01 (D-047). A strict script policy on every page type: H5P pages read their data from a JSON block and allow only
  `'self'` and Core's one hashed script; Next.js pages use a nonce; no third-party request (D-070, `DATA-011`). The web
  app (`apps/web`, Next.js inside Express, D-067, D-068) with the portal, the activity page (Spel, Rediger, Sjekk og
  publiser), `/app/play` for Canvas, `/hjelp`, `/personvern` in three languages, the formative notice and the publish
  flow with reasons that hold 14 days (`PROD-003`, `PROD-011`, `UD-020`…`UD-022`, D-073…D-075). Design tokens with
  contrast tests and lint rules, the HVL theme inside every H5P document, answer prefixes, run-time repairs of H5P's
  own markup (`UD-001`…`UD-013`, D-072, D-080). An accessibility suite of 13 files and 332 tests over every route and
  the player and editor of all ten types (`UD-030`); the manual protocol and the browser matrix for HVL (`UD-031`,
  `NFR-003`, D-079). Reviews: an early review of the server work (36 findings), a theme round (11), the final review
  of all of S4 (48), a verifier of the groups' requests (6) and a second independent verification (19), each finding
  checked by a skeptic and fixed. The gate then found two undocumented names in the API documentation (`docs:api`
  failed); fixed in 510cef7. Owner decisions: D-081 (one system; PHP server half not chosen; Lumi checked); a
  simplification pass before S5 (S4+); problem reporting for the pilot and Q16 before it (S6). Open: HVL's token
  confirmation and logo files (Q2), the DPO's review of `/personvern` (Q6), the first manual run of the protocol and
  matrix (`UD-031`, `NFR-003`), Hub registration (Q7), CI on GitHub (Q16). Residuals: «Gå til feltet» waits at most 20 s for
  BranchingScenario's tour request (D-069); CoursePresentation's footer column is sized for slide counts up to about
  «10 / 12» at 320 px, and at phone width the bottom 2–3 px of a footer button's focus ring are clipped by the
  player while the ring stays visible (D-080, gate amendment). Gate output (commit ed21808; `docs:api` after
  510cef7):

  ```
  $ npm run typecheck                                  exit 0
  $ npm run lint                                       exit 0
  $ npm run format:check                               exit 0 (All matched files use Prettier code style!)
  $ npm run doc:lint                                   ✓ doc-lint: 11 checks passed.
  $ npm run check:filesize                             ✓ doc-lint: file-size passed.
  $ npm run check:pins                                 ✓ check:pins: 6 manifests, every version is pinned exactly.
  $ npm run check:licences                             ✓ check:licences: 473 production packages, all GPL-3.0-compatible.
  $ npm run check:audit                                ✓ check:audit: 2 high/critical advisories, all covered by reviewed exceptions.
  $ npm run privacy:inventory-check                    ✓ privacy:inventory-check: 22 models, 167 fields, all in docs/privacy/DATA-INVENTORY.md.
  $ npm run h5p:fetch-core                             ✓ core and editor: every file matches the committed SHA-256 lists
  $ npm run h5p:fetch-libraries                        ✓ 120 libraries and 10 packages in apps/server/var/h5p-real
  $ npm run build                                      exit 0: 7 web routes; design tokens and feedback prefixes rewritten, no file changed
  $ npm run tokens:check                               ✓ design tokens: 3 files up to date. ✓ feedback prefixes: up to date.
  $ npm run lint:css                                   exit 0
  $ npm run spec:trace -- --check --done-through=S4    ✓ 126 requirements, traceability up to date.
  $ npm run spec:site -- --check                       ✓ docs/site/index.html is up to date.
  $ npm run docs:api                                   exit 4 on ed21808 (2 warnings); after 510cef7: html generated at docs/api (none)
  $ npm run boot-check --workspace apps/server
  {"level":"info","service":"hvl-interaktiv-server","h5pCoreApi":"1.28","hubHost":"hub-api.h5p.org","siteRegistered":false,"msg":"H5P engine configured"}
  $ npx vitest run                                     Test Files 315 passed (315) · Tests 21423 passed (21423) · 633 s
  $ npm run test:e2e                                   Test Files 8 passed (8) · Tests 16 passed (16)
  $ npm run test:a11y                                  Test Files 13 passed (13) · Tests 332 passed (332) · 950 s
  $ npx vitest run -t "AUTH-00"                        Test Files 44 passed | 271 skipped · Tests 378 passed           (S3)
  $ npx vitest run -t "LTI-00"                         Test Files 75 passed | 240 skipped · Tests 416 passed           (S3)
  $ npx vitest run -t "H5P-002|PROD-002"               Test Files 17 passed | 298 skipped · Tests 42 passed            (S2)
  $ npx vitest run -t "SEC-003|H5P-011|H5P-006"        Test Files 30 passed | 285 skipped · Tests 18717 passed         (S2)
  $ npx vitest run -t "SEC-001"                        Test Files 8 passed | 307 skipped · Tests 111 passed            (S2)
  $ npx vitest run -t "PROD-004|PROD-005|PROD-006|H5P-007"  Test Files 33 passed | 282 skipped · Tests 117 passed     (S3)
  $ npx vitest run -t "UD-0"                           Test Files 96 passed | 219 skipped · Tests 900 passed
  $ npx vitest run -t "PED-020"                        Test Files 16 passed | 299 skipped · Tests 129 passed
  $ npx vitest run -t "PROD-003|UD-022"                Test Files 26 passed | 289 skipped · Tests 141 passed
  $ npx vitest run -t "PROD-011|DATA-006|DATA-011"     Test Files 31 passed | 284 skipped · Tests 134 passed
  $ npx vitest run -t "\[<ID>\]", one run per ID       every S4 ID (and DOC-012) passes on its own; tests per ID:
      PROD-003 138 · PROD-011 27 · H5P-009 6 · UD-001 126 · UD-002 6 · UD-003 65 · UD-004 5 · UD-005 3
      UD-006 73 · UD-007 13 · UD-008 9 · UD-009 8 · UD-010 25 · UD-011 62 · UD-012 7 · UD-013 83 · UD-020 261
      UD-021 211 · UD-022 20 · UD-030 19 · PED-020 118 · DATA-006 60 · DATA-011 51 · DOC-012 14
      NFR-003 and UD-031 have no test in the default projects; in the accessibility suite
      (npx vitest run --root apps/server --config vitest.a11y.config.ts -t "\[<ID>\]"): NFR-003 1 · UD-031 3, both
      the document-consistency check, which passes without a manual result (see the open item above)
  $ npm run mock:platform & WEB_APP=dev npm start      "H5P engine configured" → "LTI platforms synchronised" → "LTI platform keys on the current encryption key" → "HVL Interaktiv server listening"
  $ curl http://localhost:3000/healthz                 {"status":"ok"} (200)
  $ curl http://localhost:3000/lti/keys                {"keys":[{"kty":"RSA",…}]} (200)
  $ curl http://localhost:3000/                        200 · <title>HVL Interaktiv</title>
  $ curl http://localhost:3000/hjelp                   200 · <title>Hjelp – HVL Interaktiv</title>
  $ curl http://localhost:3000/personvern              200 · <title>Personvern – HVL Interaktiv</title>
  $ curl http://localhost:3000/api/docs                200 · {"openapi":"3.1.0",…}
  $ kill -TERM <server>                                "HVL Interaktiv server stopped"
  ```

- **2026-10-25 · S4+** — Whole-code-base simplification (owner decision 2026-10-24): duplication measured, 12 finders,
  two independent skeptics per proposal (equivalence; worth and rules), a planner, appliers one area at a time with
  that area's tests, and a final skeptic over the whole diff. 59 of 60 approved changes applied; 114 files, 569 lines
  shorter outside `docs/`; exact clones of 6+ lines from 43 to 31; every test name and count kept. The final checks
  found only header lines to correct (551f958, 0cda63a). Report in section S4+. Gate output (commit 0cda63a), each
  step as in the S4 entry and with the same test counts:

  ```
  $ npm run typecheck · lint · format:check · lint:css           exit 0
  $ npm run doc:lint · check:filesize                            ✓ 11 checks passed · ✓ file-size passed
  $ npm run check:pins · check:licences · check:audit            ✓ 6 manifests · ✓ 473 packages · ✓ 2 advisories, all reviewed
  $ npm run privacy:inventory-check                              ✓ 22 models, 167 fields
  $ npm run h5p:fetch-core · h5p:fetch-libraries                 ✓ hashes match · ✓ 120 libraries and 10 packages
  $ npm run build · tokens:check                                 exit 0 · ✓ 3 files up to date, feedback prefixes up to date
  $ npm run spec:trace -- --check --done-through=S4              ✓ 126 requirements, traceability up to date.
  $ npm run spec:site -- --check · docs:api · boot-check         ✓ up to date · html generated (no warnings) · Core 1.28, hub-api.h5p.org
  $ npx vitest run                                               Test Files 315 passed (315) · Tests 21423 passed (21423)
  $ npm run test:e2e                                             Test Files 8 passed (8) · Tests 16 passed (16)
  $ npm run test:a11y                                            Test Files 13 passed (13) · Tests 332 passed (332)
  $ npx vitest run -t <the S2, S3 and S4 filters of the S4 entry> every run passes with the same test counts
  $ npx vitest run -t "\[<ID>\]", one run per S4 ID and DOC-012  every run passes with the same test counts
  $ npm run mock:platform & WEB_APP=dev npm start                /healthz, /lti/keys, /, /hjelp, /personvern, /api/docs: 200
  ```

- **2026-10-28 · S5 start** — The owner answered the start questions (no per-session explainer, no second
  simplification round, Dependabot tamed, a pre-commit spec-site check) and approved the S5 plan with seven decisions
  (section S5). Recorded D-082…D-100; amended spec 04 (code locations, Markdown instead of MDX, skeletons in
  `content/`, public guide), spec 02 (`LTI-005`, `LTI-007`: the Canvas side in S6) and CLAUDE.md §2–§3; added Q17.
  The hourly restart task is on until S5 is done.
