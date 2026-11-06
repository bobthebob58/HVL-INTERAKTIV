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
| S5 | Læringsdesign studio, patterns, planner, pedagogisk mappe export | 04; 00 S5 rows | ✅ Gate passed (2026-10-30); the ALU and pilot review (Q17), the bank consent text and the manual PDF check open; the Canvas side in S6 |
| S6 | xAPI → AGS grade bridge, insight, privacy jobs, Docker, conformance report | 02 §4–§8; 05; 00 §3 (journeys J1–J5), §6; 01 `H5P-009`, `H5P-010`, `SEC-004`, `SEC-006`; 03 `UD-003`, §6 (`UD-040`); 04 `MAPPE-003`, `MAPPE-004` (D-101) | ✅ Done (gate passed 2026-11-06; started 2026-10-30; D-101…D-116) |

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

## S5 — Læringsdesign studio ✅ (gate passed 2026-10-30; Q17 and the open items below)

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
- [x] 6. Review with skeptics, two verification passes
      — seven reviewers (security, privacy, accessibility, pedagogy and content, correctness, tests, documentation)
        reported 49 findings, each checked by its own skeptic: 13 rejected (recorded or intended), one overturned
        against the player's code (the fa-video timing; now an ALU review point), two duplicates; 33 fixed in five
        groups (mappe and PDF, server, web, content and docs, workstream labels), each fix with a test that fails
        without it, then two independent verification passes and a last round for cross-group items. Notable fixes:
        the PDF time limit now covers a stalled browser; staff e-mail is no longer stored; a hidden bank listing can
        no longer be copied; a per-person copy limit; numeric blanks never accept typos; focus after every studio
        action; the D-083/D-084 deviations marked in code. Decisions D-083…D-096 amended (2026-10-29, S5 review)
- [ ] Pilot evaluators from ALU and Pedagogisk akademi review the studio content (Q17; may stay open, record the outcome here)
      — outcome at the end of S5 (2026-10-30): requested, not yet done; the packet is `docs/reference/alu-review-s5.md`
- [x] Gate: as in the Evaluator Guide §5, S5 (D-100) (2026-10-30, commit `b8ab740`; output in the session log)
      — the first gate runs under full CPU load found three faults, each reproduced and fixed before the passing run:
        on the **Deling** tab a focus request could be used up by an earlier commit's late effect, so focus fell to
        the page after «Fjern meg» (`useFocusAfterChange`; the bank section's re-reads also no longer overtake a
        change, 72fbcb2); React's late metadata `<title>` put the server's title back over a pattern's or an
        activity's loaded name on a slow device (`useLoadedPageTitle`); and the title test and the accessibility
        suites now wait until a view has loaded before they check it (b8ab740)

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
   refusal; the first save after HVL installs a newer minor version of a content type counts as structural; two
   changes to the co-authors or the bank that overlap (a second press before the first answer) show their answers
   in the order they arrive.
8. **Notes from the gate:** `check:licences` passed while a stray `node_modules/node_modules` link hid the
   workspaces from npm and it counted 1 production package instead of 482 (the link was removed before the gate;
   a guard that fails when a workspace or a declared runtime dependency is missing from the production set was
   added at the start of S6). The per-ID runs for `NFR-003` and
   `UD-031` select no tests in the root Vitest project: their tests are in the accessibility suite, which the gate
   runs as `npm run test:a11y`.
   **Licence half closed in S6 (2026-10-30, D-113):** before it checks licences, `check:licences` now fails when the
   production set it checked lacks a workspace that the root `workspaces` names or a runtime dependency that the
   root or a workspace manifest declares, naming each one and the likely cause; the manifests are the expectation,
   not a minimum count (`tools/dependency-check/productionSetGuard.mjs`). The per-ID half: from S6
   the gate runs such IDs as `npm run test:a11y -- -t "\[<ID>\]"` (D-113).

## S6 — Grade bridge, insight, privacy, deployment ✅ (gate passed 2026-11-06; started 2026-10-30; open items below)

S6 is the last planned session: the xAPI → Canvas grade bridge, teacher insight with *k*-suppression, the privacy
jobs, deployment and operations, and the carry-overs from S4 and S5. It is too large for the days before 1 November,
when the project proposal for HVL's bachelor students in programming (spring 2027) goes to HVL; their project is to
review this AI-written code with their own tools and to finish the Canvas integration against ALU's test instance.
Plan approved 2026-10-30; decisions D-101…D-114.

**Decided while planning S6 (owner, 2026-10-30; recorded as D-101, D-106 and D-113):**
1. **Learning data first:** the grade bridge, then insight, then the privacy operations; then operations and
   security, then the carry-overs. Before 1 November the realistic target is steps 0–4 with parts of step 5 (D-101).
2. **Insight in tabs only:** an **Innsikt** tab on the activity page `/aktivitet/[id]` and in the Canvas view
   `/app/play`, one context at a time; no `/innsikt` page. CLAUDE.md §2, spec 05's code location and the Evaluator
   Guide §4.1 are amended (D-101, D-106).
3. **Running the session:** the hourly restart task is on until S6's gate passes (D-101).
4. **The gate keeps its full form** (every S1–S6 per-ID run), run in parts of under 2 hours as tracked background
   tasks (D-113).
5. **What passes to the students:** what needs HVL's real Canvas, Feide or servers, and whatever S6 does not reach,
   as designs, seams and checklists, indexed in `docs/handoff/README.md` (D-101).

**Found while mapping S6 (six agents, 2026-10-30):** `main` was red after PR #8's merge (CI run 41075981429:
`appPlayEditor.e2e`'s click on «Lagre» landed in H5P's editor iframe while H5P was still growing it, so no save was
sent; reproducing it also found a real fault: «Lagre» was enabled before H5P's editor could save); the xAPI
bridge does not exist yet, while `XapiStatement`, `GradeSyncJob` and `LtiPlacement.lineItemUrl`/`attemptPolicy` do;
ltijs's `context.grading.submitScore` needs a live ltik, so it cannot run in a background worker (D-104); Lumi's
`alterLibraryLanguageFile` drops the editor libraries' `libraryStrings` (D-111); a files origin would trip the
`DATA-011` third-party tests unless they know it (D-110); the Docker images have no source for the real content
types (Q10, D-110); and the S6 spec-load row was narrower than this checklist (D-101).

Steps (one conventional commit per step, `Refs:` with requirement IDs, pushed as we go; each earlier S6 item is kept
under the step that does it):
- [x] 0. Start (housekeeping)
  - [x] Decisions D-101…D-114 recorded in `docs/DECISIONS.md`
  - [x] PROGRESS: S6 🟨, the spec-load row widened (D-101), these steps, the owner decisions above, Q16 closed and S5
        open item 8's licence half closed
  - [x] CLAUDE.md §2 (the xAPI bridge in the top player document, D-102; no `/innsikt`, D-101, D-106) and §5 (the
        grade worker's own AGS client, D-104; the Deep Linking call corrected to D-061's); spec amendments: 01 `H5P-008`, `H5P-009`, `H5P-010` (D-102, D-111);
        02 §1, `LTI-008`, `LTI-009`, `LTI-010`, `LTI-011`, `LTI-012`, `LTI-013`, §7 (D-101…D-105); 03 `UD-003`
        (D-102); 05 code location, §1, `INS-006`, `INS-007`, `DATA-002`, `DATA-003`, `DATA-012`, §4 (D-101…D-104,
        D-106, D-107); the S6 load rows of specs 01–04 (D-101); the Evaluator Guide §4.1 and §5 (D-101, D-113)
  - [x] CI `--done-through=S5`, with `ciWorkflow.test.mjs` (D-113)
  - [x] Licence guard: `check:licences` fails when a workspace or a declared runtime dependency is missing from the
        production set (`productionSetGuard.mjs`; D-113, S5 open item 8)
  - [x] The hourly restart task is on until S6's gate passes (D-101)
  - [x] The red `main` fixed: «Lagre» stays disabled until H5P's editor can save (`editorStart.js`), and the e2e
        tests wait for it and repeat a click that sent nothing, since H5P can still grow its iframe under the button
        after that (CI run 41075981429, D-113)
- [x] 1. Probes, kept as tests: P1 xAPI on the ten real types (verbs, root vs sub-content, scores, response format,
      size, iframe duplicates, attempt boundaries; D-102); P2 the mock AGS token round trip (D-104); P3 Docker
      (dockerd, image pull, Chromium in an image; D-110)
  - [x] P1: `xapiQuestionTypes.browser.int.test.ts` and `xapiContainerTypes.browser.int.test.ts` play the ten real
        types as a learner in full Chromium and pin P1's findings per type; ten curated statement fixtures in
        `apps/server/test/fixtures/xapi/` for step 3 (`readXapiFixture`)
  - [x] P2: `agsClientCredentialsProbe.int.test.ts`: D-104's client credentials, signed with the stored tool key,
        get a token from the mock Canvas, post a score it records and confirm a deleted line item; no ltik
  - [x] P3: recorded in D-110's amendment (and D-114's, k6); the Docker build and compose smoke test are step 6's
  - Probe findings (2026-10-30; kept by the tests above). **P1** played the ten real types
    (332 statements), and a second run replayed seven of them and the `uv-module` pattern (188): every statement
    arrives once, in the player document, with no ID, no timestamp and an anonymous actor; `interacted` and
    `progressed` are 38–76 % of them and serve no `INS` requirement; H5P marks no attempts and re-sends some results
    on resume; no single root test works; InteractiveBook, InteractiveVideo and ImageHotspots send no root score as
    configured today, `uv-case` gives 10 of 10 on every path, and `uv-module`'s chapter «Prøv igjen» fails upstream.
    Step 3's rules, with defaults for Q18–Q20, are [D-115](docs/DECISIONS.md#d-115--xapi-capture-statement-identity-attempts-and-gradable-results-probe-p1).
    **P3**: Docker, compose and Chromium's sandbox work here, behind a registry mirror and a `dockerd` started by
    hand: an Ubuntu 24.04 image with Node 24 copied in, full Chromium as a non-root user under Playwright's seccomp
    profile, a separate compose file for the smoke, no GitHub content fetched in a build (Q21), and k6 for the load
    test, in
    [D-110's amendment](docs/DECISIONS.md#d-110--deployment-and-operations-design-runtime-image-compose-content-types-files-origin-clamav)
    (and D-114's).
- [x] 2. Shared infrastructure: migration `s6_grade_bridge_insight` (`orphaned`, `nextAttemptAt`, `attemptId`,
      `terminalAt`, `academicYear`); api-contract schemas (xAPI batch, grade sync, insight); mock Canvas token, AGS
      and NRPS endpoints with fault injection; an injectable clock and `runOnce` seams. The 30-learner insight
      fixture with hand-calculated values moved to step 4, with the aggregators it checks
  - [x] Migration `s6_grade_bridge_insight`: also `resultAt` (D-115), `InsightSnapshot.contentVersion` (D-107) and
        the platform-scoped context checks (D-103), proved by `s6Schema.int.test.ts`; DATA-INVENTORY rows
  - [x] api-contract schemas: the xAPI batch with D-115's response caps, grade sync, insight cells, and the grade
        bridge's routes (described now; they join `API_ROUTES` when step 3 mounts them)
  - [x] Mock Canvas: token endpoint, AGS line items and scores, NRPS memberships, fault injection, ltijs interop
  - [x] Injectable clock (`jobClock.ts`) and `runOnce(now)` in `LeasedIntervalJob`
- [ ] 3. A — Grade bridge (`LTI-010`, `LTI-011`, `DATA-012`, `LTI-012`, `LTI-013`, `LTI-008`, `H5P-009`): the
      `DATA-012` mapper → `POST /api/h5p/xapi` (auth, View and launch checks, zod, rate limit, 202) → `xapiBridge.js`
      and its wiring → attempt policy → enqueuer → AGS client → worker → status and retry API and UI (portal tab and
      `/app/play`) → label mode → NRPS counter → the `ltiSub` 30-day cleanup
  - **Paused 2026-10-30, work in progress (owner's decision, near the weekly usage limit); resumed 2026-11-04** with a
    verify-and-finish run of six workstreams (ingest, bridge, grades, status UI, Canvas extras, and the integration),
    each built part reviewed by a skeptic who mutated its code to prove the tests catch it. Fixed in review: a racing
    request could make a real result a "replay" (stored IDs are now read before the replay history); a Canvas launch
    without a course made every batch fail with 500 (now 202, nothing stored, D-103 amendment); the bridge's
    same-origin check let `'/\t/host'` through (now path segments only); and the gaps the mutations showed.
  - **Integration (2026-11-04):** the ingestion hands stored rows to the grade enqueuer and the NRPS counter runs
    after each launch (main.ts; `createApp`'s `onXapiStored` and `nrps`; test beds as main.ts, the NRPS counter on
    request); `AGS_LABEL_MODE` reaches the Deep Linking routes; the grade worker and the `sub` cleanup run with the
    cleanup jobs; the three grade-bridge routes joined `API_ROUTES`; an LTI principal carries the year of its key
    (D-107 amendment); ESLint's `LTI-003` storage ban covers the bridge's scripts; the privacy notice says the Canvas
    ID goes 30 days after the sending stops, as the inventory says (D-104); the S5 pattern tests and `PED-H07` treat
    a QuestionSet whose questions keep their own «Prøv igjen» as retry on (D-115 amendment; the book's own retry in
    `uv-module` stays the owner's call, Q20). New end-to-end test `e2e/xapiToCanvas.e2e.test.ts`: a Canvas student's
    right answer in `/app/play` → bridge (Bearer ltik) → stored under the learnerKey → one job → the worker's
    `runOnce(now)` → 100 of 100 for the student's `sub` in the mock Canvas → the teacher's «Poeng til Canvas» shows
    1 sent; a portal author's preview loads no bridge and stores nothing. READMEs (server, web, theme) and the data
    inventory's Redis keys updated.
  - **Security and privacy review (2026-11-04):** no leak of personal data or tokens and no way to read or change
    another person's data was found (forged and replayed batches, prototype keys, size and depth limits, the rate
    limit, grade tampering, the formative labels, the AGS client, the status API's scope, NRPS, logs, the player
    page). Fixed: `AgsAccessTokens` now cancels the unread body of a refused token answer, as `AgsScoreClient` does
    (`[LTI-012]` regression test). Four findings need a decision before any code changes (listed below).
  - **Finish (2026-11-04):** a new advisory, GHSA-mrwp-f3q8-3g9p (`follow-redirects` ≤ 1.16.1, via `axios` in
    h5p-server; published after the S5 gate), failed `check:audit`; the lock file now takes the patch release 1.16.2
    (no override, no exception). Every check then passed (session log, «2026-11-04 · S6 step 3»).
  - **Found in step 4's checks (2026-11-04):** the worker's claim (`gradeJobClaims.ts`) could take every due job
    whatever its limit. As `WHERE "id" IN (… LIMIT n FOR UPDATE SKIP LOCKED)`, PostgreSQL may rescan the subquery
    once per row of a nested-loop semi join (its plan while the table looks empty), and each rescan skips the rows
    the statement has just updated. `gradeSyncFlood.int.test.ts` caught it in the full server run (3 claimed with a
    limit of 1; a prepared generic plan on a copy of the table updated 3 rows for `LIMIT 1`). The claim is now a
    materialized CTE that runs once: with the old query the test failed again in one of two runs after `ANALYZE` of
    the empty table, and with the new one it passed all five. No decision changes (D-104's "claims due jobs
    (`FOR UPDATE SKIP LOCKED`)" still holds).
  - Still open for step 3, so the step stays unticked: the owner's Q20 call (D-115). The step's commit is done
    (abb60a5; the review's hardening came with step 4's commit, 9fb0c02). Not step 3's: `H5PUserData.academicYear` for portal sessions that cross 1 August
    is done in step 5 (D-107's amendment, `learnerStateYear.ts`); CLAUDE.md §2 names `xapiBridge.js` alone (the
    bridge is three scripts, D-102 amendment; the owner's file).
  - [x] xAPI bridge, ingestion, minimal storage (`LTI-010`, `LTI-011`, `DATA-012`): plain JavaScript in the top player
        document, learners only (D-102); contexts as `<platformId>:<contextId>` (D-103)
  - [x] AGS queue and worker, sync status, honest labelling (`LTI-012`, `LTI-013`); NRPS counts (`LTI-008`): our own
        AGS client in a durable worker (D-104), `AGS_LABEL_MODE` `suffix` or `preserve` with Q8 open (D-105)
  - [x] Status and retry API and the «Poeng til Canvas» panel in the portal tab and `/app/play`, always with the
        formative notice (D-106); the `ltiSub` 30-day cleanup runs with the cleanup jobs (D-104)
  - [x] Wiring in `main.ts` and `createApp`, and the end-to-end tests `e2e/xapiToCanvas.e2e.test.ts` and
        `e2e/xapiPortal.e2e.test.ts` in full Chromium (D-065)
  - [x] The grade-sync panel in the accessibility suite (axe, light and forced colours); screenshots in `nn` at 1280
        and 390 px
  - [x] Review: a skeptic with mutation checks per workstream, then the security and privacy review above
  - [x] `uv-module`: the regression test that pins the book's failing «Prøv igjen»
        (`uvModuleBookRetry.browser.int.test.ts`, an upstream pin; D-115's 2026-11-04 amendments); the owner's Q20 call
        on turning the book's retry off (a `PROD-009` `SPEC-DEVIATION` or not) stays open
  - [x] Decisions on the review's findings (each changes D-104, D-106 or D-115 first, CLAUDE.md §1), taken
        2026-11-04: findings 1 and 4 by D-104's queue amendment (one job per placement and learner, the score from the
        stored results at send time, fair claims, a reconcile pass), finding 2 by D-104's line-item URL amendment
        (wired in `main.ts` and `ltiRoutes.ts` with `CANVAS_ORIGINS` and https in production), finding 3 recorded for
        the DPO (`docs/privacy/DPIA-INPUT.md` R1, Q22); D-115's two amendments of the same day. The findings were: **(1, medium)**
        one learner can delay everyone's grades: 120 made-up scored results a minute per activity (`LTI-011`'s
        limit) each become a new job, while the worker sends about 200 a minute; remedies to weigh: cap new jobs per
        placement and learner, settle a group's pending jobs after a send, or claim fairly per group. **(2, low)** the
        worker never checks the launch's line-item URL (https, an origin in `CANVAS_ORIGINS`). **(3, low)** a portal
        owner or co-author sees exact grade-sync counts for a colleague's course (D-106 residual for the DPO).
        **(4, info)** a grade job is lost when its write fails after the statements are stored (already answered
        202); an outbox, or jobs re-derived from stored root results, if passback must be exact
  - [x] The step's commit, with `Refs:` `LTI-010`, `LTI-011`, `DATA-012`, `LTI-012`, `LTI-013`, `LTI-008`,
        `H5P-009` (abb60a5)
- [x] 4. B — Insight (`INS-001`…`INS-010`, `PROD-010`, the `LTI-006` **Innsikt** tab, `PROD-013` by version,
      `MAPPE-003` real source): the suppression core with property tests → a 30-learner insight fixture with
      hand-calculated values (moved from step 2) → aggregators `INS-001`, `INS-002`,
      `INS-003` (`INS-004`, `INS-005` if time) → access and audit → insight API → the web **Innsikt** tabs (charts,
      suppressed cells, shortlist, CSV, findings) → the mappe's real results source; `PROD-014` (COULD) if time
  - **Built 2026-11-04** by four workstreams, each reviewed by a skeptic with mutation checks (insight core, insight
    API, the web **Innsikt** tabs, the mappe's results), then integrated: `createApp` passes the insight services
    (content store, NRPS counts, `MIN_GROUP_SIZE`) to `/api`, and the test beds do the same; `fast-check` 4.10.2 is
    pinned as D-114 says. The core's review found that "the next-smallest cell" let hidden counts be worked out, and
    that `INS-002`'s share gave away `INS-003` cells; the stronger rule is D-106's amendment of 2026-11-04 (a 0 shown,
    `SPEC-DEVIATION`; complements; parts; `INS-003` for the current version only, `SPEC-DEVIATION`), with residuals
    R6–R9 in the DPIA input. The mappe counts only groups of at least *k* per course, version and semester (D-095's
    amendment). New end-to-end test `e2e/insightInCanvas.e2e.test.ts`: six learners of one course (two through the
    real bridge, four through the ingestion route) on the teacher's **Innsikt** tab in `/app/play`, two of another
    course as «< 5», a learner refused, another course's teacher kept to their own course. Not built: `INS-004`
    (deferred by D-115) and `PROD-014` (COULD).
  - [x] Insight views with *k*-suppression (`INS-001`…`INS-003`, `INS-005`…`INS-010`, `PROD-010`): as tabs, per
        context, fixed periods, `INS-006` as D-106 and its amendment of 2026-11-04 apply it; the spaced-retrieval
        suggestion (`PROD-014`, COULD) is not built
  - [x] Results in the portfolio: the real `ActivityResultsSource` with *k*-suppression (D-095 and its amendment)
  - [x] Integration: the insight services in `createApp` and the test beds; `e2e/insightInCanvas.e2e.test.ts` in full
        Chromium (D-065); the **Innsikt** tab in the accessibility suite (`axeInsight.a11y.test.ts`, on routed data so
        every kind of section shows; the real API path is the e2e test's); the Canvas tab lists in
        `appPlayEditor.e2e`, `webPages` and `webChrome` include **Innsikt**; screenshots in `nn` at 1280 and 390 px
        sent to the owner
  - [x] Review: a skeptic with mutation checks per workstream, then a privacy and security review of step 4 and step
        3's hardening (2026-11-04). Fixed: a listed wrong gap answer, which `INS-003`'s public rule says has at least
        *k* learners, could be hidden as a complement and then pin the other hidden counts (*k* = 5, 17 learners:
        right = 1, other = 1). Listed answers are now always shown; per gap, right, «other wrong» and «empty» form one
        additive group (`gapMisconceptions.ts`; a new `[INS-006]` exhaustive test that fails on the old code). Found
        sound: access (404 before 403), audit before the answer, the rate limit, CSV formula guards, sort order, no
        differencing path across versions, contexts, the CSV or the mappe, and the grade hardening
  - [x] Checks, with `docs/TRACEABILITY.md` and the spec site regenerated (session log, «2026-11-04 · S6 step 4»)
  - [x] Decisions on the privacy review's findings (each changes a decision first, CLAUDE.md §1): **(high)** every
        period ends at the request (`insightPeriod.ts`, `end: now`), so two views minutes apart show the cells one
        known learner moved; remedy: end periods at the last Oslo midnight, or publish a new snapshot only after *k*
        new learners (D-106; DPIA R3 and R8 understate it). **(medium)** Canvas Student View makes fake learners (the
        test user maps to learner, and each «Reset Student» is a new `learnerKey`), so *k* − 1 of them expose a real
        learner's answers; remedy: a test-user flag in the launch facts, left out of storage or of insight, the mappe
        and the counts (D-102). **(low–medium)** 7-, 14- and 30-day views opened from 1 to 30 August span the yearly
        key change, so one learner can count twice; remedy: no period before 1 August, or a DPIA residual (D-106,
        D-107). Lower residuals for the DPIA input: unsuppressed differences in `INS-001` and `INS-005`, the minimum
        a multi-gap or multi-answer share sets, chart summaries that say "most common" among shown cells only, and
        the NRPS URL's origin, which is not checked. **Decided and built 2026-11-04/05** (D-106's and D-102's
        amendments, before the code): every period ends at the latest Oslo midnight (a view holds the data up to and
        including yesterday; freshness is Q24) and never crosses 1 August, and the query reads only the view's
        `academicYear`; Canvas's test student is stored flagged (`XapiStatement.testUser`) and left out of insight, the
        mappe and every *k*, while its score still reaches Canvas; the chart summaries say «av dei som kan visast»; the
        roster URL passes D-104's origin rule, and main.ts passes `CANVAS_ORIGINS` to it; the mappe's semester groups
        read each semester's own academic year. Residuals R3, R6, R8 corrected and R10–R14 added in the DPIA input
  - [x] Docs for the review's gap fix: D-106's amendment of 2026-11-04 still puts a gap's listed wrong answers in its
        additive group (spec 05's `INS-006` note may name the gap rule too); `additiveGroupExhaustive.test.ts`'s new
        test joins D-106's *Verified by*. Done in D-106's amendment (the gap rule as built; spec 05's `INS-006` note)
  - [x] The commit (with step 3's), `Refs:` `INS-001`…`INS-003`, `INS-005`…`INS-010`, `PROD-010`, `PROD-013`,
        `LTI-006`, `MAPPE-003` (9fb0c02); the review's decisions and their code come with step 5's commit
- [x] 5. C — Privacy operations (`DATA-003`, `DATA-004`, `DATA-005`, `DATA-007`, `DATA-008`, `DATA-010`, `NFR-006`):
      purge with a dry run → the data-subject CLI → the database roles script → production checks → the request log
      → DPIA input → DATA-INVENTORY rows (with the Redis keys) → the research export, design only (Q6)
  - **Built 2026-11-04/05** by four workstreams (the purge, the data-subject CLI, the roles with the production
    checks and the request log, the privacy documents), each reviewed by one or two skeptics with mutation checks,
    then integrated (2026-11-05). Each decision's amendment came before its code: D-107 (the purge, and the login
    that races it), D-108 (the CLI, signals held until the audit, export only to a file or pipe), D-109 (the roles,
    the views-down step, the TLS and EEA checks, the AWS SDK's own endpoints, the request log). Runbooks in
    `docs/ops/`: [yearly-purge.md](docs/ops/yearly-purge.md), [data-subject-requests.md](docs/ops/data-subject-requests.md)
    and [database-roles.md](docs/ops/database-roles.md).
  - [x] Purge, audit, data-subject requests, DPIA input (`DATA-003`…`DATA-008`, `DATA-010`); log redaction review
        (`NFR-006`). The data-subject tool must delete learner state through the storage directly: Lumi 10.0.4's
        `deleteAllContentUserDataByUser` checks permission for one user and deletes the acting user's data
        (`ContentUserDataManager.js:39-43`). Designs: D-107 (purge on 31 August by a stored academic year), D-108
        (a server CLI for HVL operations), D-109 (database roles, production TLS checks, the request log). Built:
        `src/privacy/purge/` (leased job and `npm run privacy:purge`), `src/privacy/dsr/` (`npm run privacy:dsr`,
        learner state through our storage), `prisma/roles/` with `npm run db:roles`, `src/config/connectionEncryption.ts`
        and `storageResidency.ts`, `src/http/requestLog.ts`; DPIA input complete with residuals R1–R37
        (`docs/privacy/DPIA-INPUT.md`, checked against the developer key by `npm run privacy:dpia-check`); the
        inventory's Redis keys, audit details and analytics view
  - [x] Research export (owner's idea, 2026-10-26; to consider when insight is built): analysis and research scripts
        run beside the system, in Python or R (pandas, Jupyter notebooks), which ALU and Pedagogisk akademi
        researchers use, while everything inside the product stays TypeScript. They never touch the live database:
        the system produces an anonymised export (pseudonyms only, groups under *k* = 5 suppressed, only the fields a
        question needs), built and tested in TypeScript under the privacy rules, with a documented format and an
        example notebook. Research use of student data needs its own legal basis and the DPO's approval (Q6) and
        belongs in the DPIA input (`DATA-005`). In S6: the design only (plan step 5). Done as a design:
        `docs/privacy/research-export.md` (tiers A–C); nothing is built until the DPO and the owner decide (Q25)
  - [x] Integration (2026-11-05): main.ts passes `CANVAS_ORIGINS` to the NRPS roster check (and the test beds do)
        and logs `deployment locations` at start; `PURGE_RUN_DATE` in `env.ts` and `.env.example`; the S3 client
        ignores the AWS SDK's own endpoint settings (D-109's amendment); `AccountResolver` closes the purge race
        (D-107's amendment); `privacy:purge` and `db:roles` scripts; the CSV's period end «Til (ikkje med)»;
        `privacy:dpia-check` (`DATA-005`'s document check, D-113). Proven together: the insight e2e with a play of
        today left out and Canvas's test student not counted; the test student's score sent to the mock Canvas by
        the worker; the operations CLIs through their npm scripts on a database they deploy
        (`operationsClis.int.test.ts`: roles, migrate step, export, the purge's dry and real run as `hvli_app`,
        erasure, the audit); production refusing a clear-text database, Redis or S3 URL at start-up. The **Innsikt**
        tab passes `axeInsight.a11y.test.ts`; screenshots in `nn` at 1280 and 390 px retaken and sent to the owner
  - [x] Privacy and security review of step 5 (2026-11-05, after the integration). Two fixes, each decision's
        amendment first, each with regression tests that fail without it: **(medium)** the mappe read every row up to
        the export, so the mappe less insight's semester view, or two exports on one day, gave today's learners; it now
        reads only rows stored before the latest Oslo midnight, as insight does (D-106's amendment,
        `storedActivityResults.ts`, `storedResultsBeforeToday.int.test.ts`). **(medium–low)** a bucket variable
        holding an access point or Outposts ARN sent files to the ARN's own region, past the EEA check; production
        now takes plain bucket names only and names the variable, never the value (D-109's amendment,
        `bucketNameProblems` in `storageResidency.ts`, nine `[DATA-004]` tests). Found holding: the period rule, the
        test student left out of every count of learners, the purge's year boundaries and re-runs, the data-subject
        CLI's keys, deletes and output, the database roles' grants, the TLS and EEA checks, and the request log
        (route patterns only, also for 404s and bad JSON)
  - [x] `docs/TRACEABILITY.md` and the spec site regenerated; every check, test set, the e2e set and the insight and
        grade-sync accessibility files pass (session log, «2026-11-05 · S6 step 5»)
  - [x] The step-5 review's follow-ups, done in step 6 (the follow-ups workstream, 2026-11-05, each with a test):
        the LTI error handler logs a route label, never `req.path` or serve-static's `err.path` (`ltiErrorLog.ts`);
        `db:roles` refuses a migration URL to another host without an encrypting `sslmode`; `purgeCli.ts` prints
        `purgeFailureLine`, not a raw error message; the documents for the review's two fixes (DPIA R3, R8 and R24,
        the `DATA-004` items of the deployment checklist in `docs/ops/runbook.md` §9, the server README's mappe row,
        the Evaluator Guide's `DATA-004` row, and D-106's *Verified by* naming `storedResultsBeforeToday.int.test.ts`).
        Verified again in the step-6 finish run (session log, «2026-11-05 · S6 step 6»)
  - [x] The commit, `Refs:` `DATA-003`, `DATA-004`, `DATA-005`, `DATA-007`, `DATA-008`, `DATA-010`, `NFR-006`,
        `INS-006`, `INS-008`, `LTI-008`, `DATA-012`, `MAPPE-003` (5064a49)
  - Still open, not blocking the step: the mappe does not read the purge snapshots (a D-095/D-107 amendment for the
    mappe's owner); no job deletes audit rows after 2 years (Q26); the dormant admin branch of
    `UserDataAccessAuditor` that would audit a learner key (the H5P permissions owner); the web privacy notice's
    texts after the DPO's review (DPIA R32). A residual for the DPO: the grade-sync counts are live (no midnight cut),
    not *k*-suppressed and include the test student (DPIA R1, R13; Q22). The step-5 review's three low findings and
    its document gaps were closed in step 6 (the follow-ups workstream: `ltiErrorLog.ts`, the `db:roles` TLS rule,
    `purgeFailureLine`, DPIA R3, R8 and R24, the `DATA-004` checklist, the README and Evaluator Guide rows, D-106's
    file name), and the deployment checklist is section 9 of `docs/ops/runbook.md`
- [ ] 6. D — Operations and security (`NFR-007`, `SEC-004`, `SEC-006`, `NFR-002`, `NFR-001`, `UD-040`, the
      `MAPPE-004` image), designed in D-110: the Dockerfile and compose profile with a smoke test (or written only if
      dockerd will not run here; then CI runs it) → the files origin → ClamAV → runbook, backup and restore scripts
      with a round-trip test → the load harness with a reduced-scale smoke (tool chosen by amendment to D-114) →
      `npm run a11y:report` for the conformance report → the PDF availability probe
  - **Built 2026-11-05** by six workstreams (the image and app stack, the files origin, ClamAV, backups with the
    runbook and the load harness, the conformance report, and the step-5 follow-ups with the library-build fix),
    each verified by a skeptic with mutation checks, then integrated (2026-11-05). Each decision's amendment came
    before its code: D-110 (the files origin; the image, the app stack and its smoke; ClamAV; backups and the runbook;
    the integration), D-114 (the load harness), D-079 (the conformance report and its review), D-045 (pointer),
    D-056 (the old data key stays 31 days). Runbooks: [docker.md](docs/ops/docker.md), [clamav.md](docs/ops/clamav.md),
    [runbook.md](docs/ops/runbook.md) with the deployment checklist (§9)
  - [x] Separate files origin for user files with signed URLs (`SEC-004`, D-045; URLs from S3's `HvlUrlGenerator`):
        the player's files on `files.<host>` (or `FILES_BASE_URL`), served only there by `filesOriginRouter.ts` with
        the sandbox policy and CORS for the app; the editor's files stay on the app origin under grants of their own
        (`SPEC-DEVIATION: D-110`). The `DATA-011` tests count the files origin as first-party
  - [x] ClamAV scanning (`SEC-006`): Lumi's scanner 10.0.4 wrapped to fail closed on both upload paths, its client
        built from our checked settings only; required in production unless explicitly turned off; real-clamd tests in
        CI against a clamav service (D-110)
  - [x] Docker images, load test, runbook (`NFR-001`, `NFR-002`, `NFR-007`); conformance report (`UD-040`):
        `deploy/` (Ubuntu 24.04 and Node 24 by digest, uid 10001, the app stack with its own clamd, the smoke test
        here and in `.github/workflows/docker.yml`); `tools/ops` (backup and restore with a round-trip test);
        `tools/load` (k6 2.3.0, `npm run load:smoke`; the 200-learner run is HVL's); `npm run a11y:report` writes
        `docs/accessibility/WCAG-CONFORMANCE-REPORT.md` (56 criteria, every verdict *Not yet determined* until HVL
        tests); `tsx` is a runtime dependency of `apps/server`
  - [x] Chromium and fonts with æ, ø and å in the production image for the PDF (D-096): full Chromium 141 with
        Playwright's seccomp profile and `CAP_SYS_CHROOT`, the sandbox seen in `/proc`; the server logs at start
        whether the export works (`pdfAvailability.ts`)
  - [x] SECURITY (found while building the bundle): `H5P.AudioRecorder` 1.0's build baked the build machine's whole
        environment, tokens included, into JavaScript served to learners. `tools/h5p-libraries` now builds every
        library with a minimal environment (`buildEnv` 3), the bundle refuses secret-named variables, and the leaky
        builds were rebuilt, re-seeded and removed from this machine (DPIA R39). Tokens that were in the old builds
        should be rotated (owner)
  - [x] Integration (2026-11-05): `main.ts` runs the PDF probe after listening and waits for it on stop; `tsx` moved
        to `apps/server`'s dependencies; scripts `deploy:check`, `docker:smoke`, `pdf:check`; the app stack has its
        own clamd, and the smoke proves an upload scanned (EICAR refused) and served from the files origin; CI runs
        the real-clamd tests and `a11y:report -- --check`; `.env.example`'s production rules and key rotation; the
        documents (session log, «2026-11-05 · S6 step 6 (integration)»)
  - [x] Security review of step 6 (2026-11-05, after the integration): files origin, grants, SVG and other uploads
        (CVE-2025-7062), the scanner, the image, the app stack, backups and the load harness attacked or read against
        their decisions; no high or medium defect in the code. One low fix with a regression test that fails without
        it: a NUL byte in a granted file path reached PostgreSQL and gave 500 with an error-level log line on demand;
        `signedFileRoutes.ts` now answers 404 before storage for any name `assertSafeObjectName` refuses
        (`[SEC-004]` in `filesOrigin.int.test.ts`). Its other findings: fixed in step 7 (the next item), or under
        «Still open» below
  - [x] The review's other findings, fixed in step 7 (the hardening workstream, D-110's amendment of 2026-11-05, each
        with its test or document; verified again in the step-7 finish run, session log «2026-11-05 · S6 step 7»):
        clamd's `AlertExceedsMax` and `AlertEncrypted` are required in [clamav.md](docs/ops/clamav.md) and runbook §9
        and set in `deploy/compose.app.yml`'s and `ci.yml`'s clamd; the root `docker-compose.yml` publishes on
        127.0.0.1 only, with runbook §8's warning; a name the storage refuses (a NUL byte) is 404 on the cookie route,
        not 500 (`storableFileName.ts`, `[SEC-004]` in `contentFiles.int.test.ts`); `frame-ancestors 'none'` in the
        user-file policy (`ContentFileHeaders.test.ts`, `signedFiles.int.test.ts`); `persist-credentials: false` in
        `ci.yml` and `docker.yml`; runbook §6's encrypted backup volume; the clamscan SNI note in `clamav.md`.
        `upload.file.scanUnavailable` stays 400 by that amendment (a 503 would change the shared error mapping). The
        upstream reports for Lumi's scanner, clamscan and AudioRecorder are drafted (step 7, D-112; the two security
        reports are held outside the repository)
  - [x] `docs/TRACEABILITY.md` and the spec site regenerated; every check, every test set, the e2e set, the
        accessibility files for the player, editor, insight and grade sync, and the Docker smoke on the final working
        tree pass (session log, «2026-11-05 · S6 step 6»)
  - [x] The commit, `Refs:` `NFR-001`, `NFR-002`, `NFR-007`, `SEC-004`, `SEC-006`, `UD-040`, `MAPPE-004`, `NFR-006`,
        `DATA-004`, `DATA-003`, `H5P-003` (f361f16)
  - [x] The conformance report's run summary regenerated from the gate's full accessibility run (step 11, part B;
        7189e97)
  - Still open: `docker.yml`'s first run on GitHub (Chromium from Playwright's CDN and its SHA-256, AppArmor, the
    `/proc` check on the runner); HVL's runtime, DNS and clamd (Q5); the 200-learner load test and the restore drill
    on HVL's hardware; the manual accessibility run and the 56 verdicts (`UD-031`); the SHA-256 list of the content
    types kept in the repository (D-110, waits for reproducible builds); narrowing or retiring the
    cookie-authenticated `/h5p/content/…` fallback route on the app origin (a D-110 amendment; passed to the students
    through the [hand-off index](docs/handoff/README.md)); optional: refuse a request whose `Host` and
    `X-Forwarded-Host` disagree about the files host; the further files clamd passes without unpacking them in full
    even with both alerts on, which went to the owner outside the repository with a proposed check of our own in the
    upload path (D-110's hardening amendment, D-112's rule for security reports; the owner confirms it arrived, since
    no written copy was kept with the private drafts)
- [x] 7. E — Carry-overs: the language overlay and `H5P-010`'s texts (drafts for ALU) → problem reporting (the
      Nynorsk tester guide, GitHub issue forms) → upstream drafts → the **students' hand-off index**
      (`docs/handoff/README.md`: what is done, what needs HVL, the live-contract seam `apps/server/live/` and the
      Canvas acceptance checklist)
  - **Built 2026-11-05** by five workstreams (the language overlay, problem reporting, the upstream drafts, the
    hand-off index with the live-contract seam, and the hardening after step 6's security review), each reviewed by
    a skeptic with mutation checks, then integrated (2026-11-05). Each decision's amendment came before its work:
    D-111 (the overlay as built; its review), D-101 (problem reporting and its review; the hand-off index, the seam
    and the checklist, and their review; the integration), D-112 (the drafts as written), D-110 (hardening after
    step 6's review). The students' index: [docs/handoff/README.md](docs/handoff/README.md)
  - [x] Library texts that are English in `nn` and `nb` (S5 probe P1: MultiChoice, QuestionSet, InteractiveBook and
        BranchingScenario buttons and messages; patterns set their own texts, D-084): an HVL language overlay, so
        activities made in the editor are Norwegian too. Decided in D-111: not through Lumi's
        `alterLibraryLanguageFile` hook, which in 10.0.4 drops the editor libraries' `libraryStrings`, but through a
        library-storage wrapper after D-046's, with the texts in `content/` for ALU. **Built:**
        `LanguageOverlayLibraryStorage` over D-046's wrapper in the editor and the player; 91 texts in `nn` and 93 in
        `nb` in [content/h5p-tekstar/](content/h5p-tekstar/README.md) (drafts, `status: draft`), with labels and
        H5P.DragNBar's editor strings («Lim inn»); `content:check` checks them against the installed libraries (a
        changed English text is reported, an unknown field or string refused, no `<`, `>` or straight `"`); the
        start-up hands its texts to the engine (`main.ts`). Tests `[H5P-008]`: unit, integration, every real entry on
        the pinned libraries (`overlayKeepsShippedTexts.test.ts`), a real `nn` player (QuestionSet's «Neste»,
        «Resultat», «Poeng»; MultiChoice's Nynorsk button names) and `nb` editor, English unchanged; probe P1's
        `ENGLISH_IN_NYNORSK` keeps only «Pause»
  - [x] Panopto guidance (`H5P-010`), through the same overlay for `nn` and `nb` (D-111). **Built:** English through
        `alterLibrarySemantics` after D-006's DragQuestion filter (`semantics/videoGuidance.ts`), `nn` and `nb`
        through the overlay (`video-guidance.yaml`, a draft); `content:check` refuses guidance on a field that is not
        a video field (`[H5P-010]` tests)
  - [x] The Canvas side of the studio (D-098): the content bank and "new from a pattern" in the Deep Linking picker,
        and the `LTI-007` duplicate in `/app/play`; passes to the students when S6 does not reach it (D-101).
        **Not reached; passed on** with a design note, [docs/handoff/canvas-studio.md](docs/handoff/canvas-studio.md)
  - [x] LTI Dynamic Registration (`LTI-009`, COULD): the design only; the build passes to the students (D-101).
        **Design note:** [docs/handoff/dynamic-registration.md](docs/handoff/dynamic-registration.md)
  - [x] Lumi's server half (D-081): ask Lumi's maintainers for a release with their unreleased file-security work, or
        review and pin a Lumi commit built from source as D-022 pins the editor (its own decision: CLAUDE.md names
        10.0.4; the full gate), then remove the adapters it makes unnecessary; report our fixes and the D-080 barriers
        upstream to Lumi and H5P. Decided in D-112: Lumi stays at 10.0.4 in S6; the release request, the Lumi issues
        and the H5P barrier reports are drafted in `docs/upstream/` for the owner to file; before 2027-01-31 HVL or
        the students choose how the `image-size` exceptions end. **Drafted:** [docs/upstream/](docs/upstream/README.md)
        holds the Lumi release request, two Lumi bugs (`deleteAllContentUserDataByUser`, `alterLibraryLanguageFile`),
        a conditional Core 1.28 and new-Hub backport, eight small Lumi gaps, 15 H5P reports (14 accessibility
        reports, one per library, including InteractiveVideo's untranslatable end-screen summary added at the
        integration, and QuestionSet's retry, Q20), and drafts for clamscan and ltijs; the two security reports
        (H5P.AudioRecorder's build environment; three Lumi findings) are held outside the public repository for the
        owner to send privately (D-112's amendment). Nothing is filed; [lumi-path.md](docs/handoff/lumi-path.md) has
        the three choices before 2027-01-31
  - [x] Problem reporting for the pilot (owner decision 2026-10-24): a short tester guide in Nynorsk in `docs/` and
        GitHub issue templates in `.github/ISSUE_TEMPLATE/` (a fault; an accessibility barrier) asking for the steps,
        what was expected and what happened, device, browser, assistive technology and zoom, the activity type or
        page, a screenshot, and the severity (cannot use, or privacy or security; accessibility barrier; cosmetic),
        with matching labels. Rule: no personal data in an issue (no student names, e-mails or Feide IDs; log lines
        are safe by design, `DATA-009`). The guide describes how a problem is fixed: reproduced in the test set-up, a
        test that fails first, the cause fixed, the area's tests and the gate, a branch and pull request that HVL
        reviews and merges. A problem seen only in HVL's Canvas or Feide needs the error and the server's log lines;
        one seen only on a device or with a screen reader needs a precise description and an HVL re-test; H5P's own
        barriers are repaired at run time or registered and reported (D-080). Manual results stay dated in
        `docs/accessibility/results/`. **Built:** [docs/testing/rapportere-problem.md](docs/testing/rapportere-problem.md)
        (Nynorsk, for testers), `.github/ISSUE_TEMPLATE/feil.yml` and `uu-barriere.yml` with `config.yml` (blank
        issues off), `.github/labels.yml`, [docs/testing/labels-and-triage.md](docs/testing/labels-and-triage.md)
        (maintainers), [SECURITY.md](SECURITY.md); a required no-personal-data confirmation in each form, and the
        reason for using assistive technology never asked for (health data); checks in `tools/issue-forms` (13 tests)
  - [x] The students' hand-off index `docs/handoff/README.md` (D-101). **Built:** the index with a Nynorsk summary,
        eight design notes, the Canvas acceptance checklist and the live-contract seam `apps/server/live/`
        (`npm run test:live`; skipped unless asked, 36 passing against the mocks, and run so in CI)
  - [x] Integration (2026-11-05): `main.ts` hands the start-up's H5P texts to the engine
        (`startupLanguageOverlay.test.ts`); `test:live` and the seam's type check; CI runs the seam against the
        mocks; InteractiveVideo's scored end-screen summary in the English-text register, its upstream draft and the
        conformance report; the hand-off index, root README, Evaluator Guide (commands, limitations 2, 5, 20, 22),
        GLOSSARY, spec 01 (module map, `H5P-008` and `H5P-010` built), the server README and the ALU review packet
        (§9a) updated (session log, «2026-11-05 · S6 step 7 (integration)»)
  - [x] `docs/TRACEABILITY.md` and the spec site regenerated (new `[H5P-008]`, `[H5P-010]` and `tools/issue-forms`
        tests, new source files, the DECISIONS amendments); every check, every test set (the server's in full, the
        overlay's real `nn` player and `nb` editor tests included), the e2e set, the seam (skipped, and against the
        mocks), the accessibility files for the player, editor, insight, grade sync and the register, the real-clamd
        tests against a clamd with both alerts on, and the Docker smoke on the final working tree pass (session log,
        «2026-11-05 · S6 step 7»)
  - [x] The commit, `Refs:` `H5P-008`, `H5P-010`, `SEC-004`, `SEC-006`, `NFR-004`, `NFR-003`, `DATA-010`,
        `DATA-009`, `UD-031`, `UD-040`, `PROD-002`, `LTI-012`, `LTI-008` (5b438a8)
  - Passes to the students through the [hand-off index](docs/handoff/README.md) §3, each item with its design note:
    the seam's first run against ALU's test Canvas and real Feide with the Canvas acceptance checklist
    ([canvas-acceptance.md](docs/handoff/canvas-acceptance.md)); the Canvas side of the studio; `LTI-009`;
    `INS-004`; insight's freshness (Q24); the research export (Q25, after the DPO); the simplification check if S6
    does not reach it; the Lumi path before 2027-01-31; triage and fixes of the pilot's issues; the overlay's
    remaining English in `nn` and `nb` (editor labels, `H5PEditor.*` strings, less common sub-content) and keeping
    its entries current; the upstream links once the owner has filed the drafts; and, among the smaller items,
    narrowing or retiring the cookie-authenticated `/h5p/content/…` route (D-110)
  - Still open, not blocking the step: the owner's tasks before the pilot (create the labels with the `gh` loop in
    `labels-and-triage.md`; HVL's security contact in `SECURITY.md`; private vulnerability reporting; the pilot's
    contact person for testers; the two GitHub claims marked *(verify)* in `labels-and-triage.md`; filing the
    drafts in `docs/upstream/` and sending the two security reports privately); the language advisers' and ALU's
    review of `content/h5p-tekstar/` (Q2, Q17; ALU review packet §9a); the CI step that runs the seam against the
    mocks has not yet run on GitHub; a library with neither `nn.json` nor `nb.json` gets no `nn` in the editor's
    language list even with overlay entries (none today); H5P.Question shows «Send inn» only when the content's data
    sets `isScoringEnabled` or `isReportingEnabled`, which Core 1.28 never sets from `reportingIsEnabled`, so learners
    see «Sjekk» (for D-115's owner, information only)
- [x] 8. Integration: the accessibility suite for every new view; e2e journeys (J1 split if the Canvas studio is not
      reached, xAPI → AGS, insight, purge and data-subject requests); screenshots in `nn` at 1280 and 390 px sent to
      the owner as the views appear (CLAUDE.md §4)
  - [x] **The accessibility suite covers every S6 view** (`UD-030`, `UD-031`, `UD-040`, `INS-008`). «Poeng til
        Canvas» and «Innsikt», on the portal and on `/app/play`, are catalogue views (`a11y/support/dataTabViews.ts`),
        so every suite that walks the views covers them: reflow at 320 × 640 and 640 × 320, reduced motion, the focus
        walk, target size, text spacing and 200 % zoom, page language and first-party requests. Innsikt's scans assert
        the «< 5» cells with their hidden reason and both period notes, and its printed shortlist is scanned. J3 runs
        by keyboard alone (`keyboardJourneys`). The Deep Linking picker's no-score note is scanned in both colour modes
        and tied to its input by `aria-describedby`. A MultiChoice and a QuestionSet made in Nynorsk with the language
        overlay are scanned in the player and the editor. One violation was found and fixed: with the 1.4.12
        text-spacing styles, the chart's row label «Ingen av alternativa» was cut off (`truncate` in `BarChart.tsx`,
        `UD-002`); labels now wrap. Full suite before: 18 files, 509 tests. After: 18 files, 558 tests, 0 failed,
        173 axe scans, and the only blocking findings are the 26 upstream ones recorded under D-080. That run is
        recorded in `docs/accessibility/automated-run.json` and the report regenerated from it (a run on 5b438a8 with
        uncommitted changes, as the report says; the gate's run replaces it in step 11). Screenshots of Innsikt in
        `nn` at 1280 and 390 px went to the owner; none are committed
  - [x] **The journeys of spec 00 §3, end to end** in full Chromium with third-party cookies blocked (D-065). Six new
        files: `journeyPlaceInCanvas` (J1's Canvas half: `assignment_selection` with `custom.feide_login`, a graded
        link labelled formative, a student's 100/100 in the gradebook, the teacher's four tabs), `journeyPhoneResume`
        (J2 on a 320 px phone: «Feil:» with the teacher's explanation, then resuming the next evening in a new
        browser), `journeySeminarInsight` (J3 in the portal: a class of 13, «< 5», the shortlist on the big screen),
        `journeyPortfolio` (J4: tagging, then the Markdown export with k-suppressed counts), `journeyGovernance` (J5
        step 1: ALU's content edit through `content:check`) and `learnerDataRights` (the data-subject export and
        erase, and the purge, through their CLIs on a fresh database). J1's «Create new» from a pattern in Canvas
        passes to the students (D-101's amendment of 2026-11-05, `SPEC-DEVIATION` in the test); J5 step 2 is covered
        by the HTTP tests and the runbook's new procedure «A new content-type version». `npm run test:e2e`: 22 files,
        33 tests, passed three times (before: 16 files, 27 tests)
  - Still open, not blocking the step: J1's Interactive Video skeleton in the editor, a pasted Panopto link and the
    V-VID-CAPTIONS error in Sjekk og publiser are in no e2e test (browser integration and unit tests only);
    `NFR-001`'s "under 3 s" is not timed in e2e and there is no Lighthouse CI (the load smoke only); J3's printout is
    covered by a component test only; QuestionSet's tab panels point `aria-labelledby` at progress dots it does not
    render (axe "needs review", upstream; for the manual protocol or the register, D-080, D-112); the web app has no
    favicon (a 404 in the browser console)
- [x] 9. Docs: READMEs, GLOSSARY, the Evaluator Guide (S6 row, limitations), PROGRESS
  - [x] The Evaluator Guide's S6 gate row, in S5's manner (D-113): every S1–S5 command and per-ID run; S6's filters
        and each S6 ID alone; `NFR-003` and `UD-031` in the accessibility suite; the live seam, real clamd and the load
        smoke; `--done-through=S6`; the Docker smoke and docker.yml; the recorded accessibility run and the DPIA check;
        the document checks as *verified by document review, not by HVL until HVL acts*; the running server. Its §3
        `test:e2e` and `test:a11y` rows name every e2e file and the S6 views. Limitations 7, 9 and 19 are corrected,
        and 23 (what cannot be verified here) and 24 (gaps in insight and grade passback) are new. Also updated: the
        root README's status; the server, web and api-contract READMEs' module maps (every S6 source file named);
        12 GLOSSARY rows for S6 UI terms; and, in the finish run, the web README's stale «the Canvas side of the
        studio is S6» line, its S6 status, the e2e config's header and the conformance report's view descriptions
        (the two S6 tabs, J3 by keyboard)
  - Still open: the server README's purpose and status sections stop at S4 (its module map is current); D-113 names
    Q2–Q8, Q13, Q15, Q17 and Q18–Q21 while the S6 row also lists Q22–Q30 and per-ID runs for `SEC-004` and
    `H5P-008` (an amendment if the owner wants D-113 to match exactly)
- [x] 10. Review and verification: an independent review with a skeptic per finding, two verification passes
  - [x] Five independent reviewers, one lens each (correctness, security, privacy, accessibility and UI, docs
        against code), read `git diff 47e235e`; a skeptic tried to refute each finding; one fixer per lens wrote a
        regression test that fails without its fix; then an adversarial re-check per lens re-ran each test with the
        fix reverted, restored the file byte for byte, and fixed what was still wrong; this finish run's checks are
        the last pass. **20 findings: 18 confirmed, 2 refuted, 18 fixed.** Per lens (found / confirmed / refuted /
        fixed): correctness 1/1/0/1, security 1/1/0/1, privacy 2/1/1/1, accessibility and UI 7/7/0/7, docs 9/8/1/8.
        - Correctness, `GRADES-RETRY-STALE-NOW`: a retry's delay and the 24-hour limit counted from the worker tick's
          start, not from Canvas's answer; now from the answer, as D-104 already says (`gradeSyncRun.ts`)
        - Security, `SEC-S6-01`: the insight GETs that write `insight.view` and `insight.export` to the audit could
          be forged by a cross-site navigation; the re-check found a second path (an author's absolute image URL to
          our own origin, fetched as a same-origin subresource) and the rule became a fetch-metadata allow-list
          (D-106's amendment, `insightRoutes.ts`)
        - Privacy, `PRIV-2`: DPIA O4 said staff are never captured, but an employee enrolled as a Canvas student is a
          learner; new residual R40 for the DPO, and the re-check corrected two wording errors in it. `PRIV-1`
          refuted (a FreeTextQuestion answer never reaches `response`)
        - Accessibility and UI, `A11Y-S6-1`…`7`: focus after «Opne Sjekk og publiser»; questions without top-level
          text named by their place, and SingleChoiceSet's and ImageHotspotQuestion's text read where the library
          keeps it; `lang` on the activity's own texts; a repeated refusal announced again; «portalen» in running
          text; the English singular of the shortlist count; each retry button named by its placement
        - Docs, `DOC-S6-01`…`06`, `08`, `09`: D-101's amendment for J1's split and J5's coverage; spec 02 §8 and the
          picker's `SPEC-DEVIATION`; R1–R40 everywhere, with a check in `privacy:dpia-check`; the Evaluator Guide's
          e2e and accessibility rows; the conformance report links e2e files under `npm run test:e2e`; J3's «62 %»
          claim; PROGRESS's commit ticks; limitation 19. `DOC-S6-07` refuted
  - Still open, not blocking the step: a browser that sends no fetch metadata (Safari before 16.4) is still served
    by the insight GETs (only a CSRF token on them would close it, which changes D-057); authors can put an absolute
    URL to our own origin in an H5P media path, so refusing such paths at save time deserves its own look (other
    GETs with side effects); R40's option «only ungraded activities in staff courses» is partial, and `/personvern`
    waits for the DPO (R32, R40); sentences the Innsikt tab builds around an authored text (chart summaries,
    captions, shortlist lines, announcements) carry no `lang` on the quoted part; `axeInsight.a11y` and
    `journeySeminarInsight.e2e` build their one-question texts from `insight.shortlist.added` and `count`, not the
    new `addedOne` and `countOne` (the same in `nn` today); H5P.SingleChoiceSet's `answered` statements carry no
    `subContentId`, so its items may get no data (for the insight owner); the grade regression test pins
    `nextAttemptAt`, not `terminalAt`; the runbook's «A new content-type version» has not run on a real staging host;
    J3 in spec 00 says «62 %» while the tab writes the count (a D-106 amendment if HVL wants the share)
  - [ ] Light simplification check before the pilot (owner decisions 2026-10-24 and 2026-10-25), as in S4+ (two
        independent skeptics per proposal, no behaviour change, every test kept, the full gate after), with one more
        lens: does the code read as if a careful human wrote it? Signs of machine-written code to look for: comments
        that restate the code, checks repeated where one layer already guarantees them, generic or overlong names,
        boilerplate copied across files, abstractions with one user, and idioms that differ from file to file because
        different agents wrote them. The reviewers must tell "unfamiliar but correct" from "needlessly odd": code that
        is unusual because it is right (a security check, an H5P workaround, a timing guard) stays, and gets a short
        WHY comment a human maintainer can follow, rather than being made ordinary and wrong. An HVL developer reads a
        sample afterwards and has the last word. If time allows; otherwise carried to the pilot list. **Not run in
        steps 8–10**, so carried to the pilot list: the hand-off index §3 already names it
- [x] 11. Gate (the full form, in parts of under 2 hours; D-113), its output in the session log, push, the restart
      task off. A pull request only when the owner asks
  - [x] Gate: as in the Evaluator Guide §5, S6, in ten parts (A–J), 144 steps; three failed on their first run and
        were fixed (f5fa12b, 92ca2c5, 5a5b8c3), then part A ran again in full on the final commit 5a5b8c3 (session
        log, «2026-11-06 · S6 gate»)
  - [x] The hourly restart task switched off (2026-11-06)
  - [x] GitHub CI on the S6 commits, `docker.yml` included: in pull request #18, on `8d4eaf0`, the Session gate passed
        (run 42170423046, 2026-11-06 06:45:23 UTC) and `docker.yml` passed (run 42170423045)
  - CI's traceability step raised to S6 (3eeea8d), and the CLI test helper fixed for CI's missing `apps/server/.env`
    (8d4eaf0, after CI run 42166052880 failed on it); session log «2026-11-06 · PR #18 and the assurance pack's method»

---

## Open questions and blockers

| # | Question | Owner | Blocks |
|---|---|---|---|
| Q1 | ~~Confirm the licence GPL-3.0-or-later (D-015)~~ Resolved 2026-10-16: `LICENSE` added | — | — |
| Q2 | Confirm or replace the derived reference inputs 1–6, and supply the originals (logo files, ALU model document, mappe guidance) (`docs/reference/README.md`). From S6 also HVL's language advisers' review of the Nynorsk and Bokmål texts for the H5P content types and the Panopto guidance in `content/h5p-tekstar/` (D-111; ALU review packet §9a) | HVL / ALU / TeCopp | S2–S5 as listed |
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
| Q16 | ~~The repository has no `main` branch, and CI (`.github/workflows/ci.yml`) runs only on pushes to `main` and on pull requests, so GitHub has never run the gate: every session's gate ran locally only. Create `main` from `ccr-07f63266-6cere5` or open a pull request, and decide what to do with the open Dependabot update branches (pins stay exact). **Required before the pilot (owner, 2026-10-24).**~~ Resolved 2026-10-30 (D-101): GitHub CI runs on `main` and on pull requests. `main` is protected by a ruleset that requires a pull request and CI's «Session gate» check; that check passed on pull request #8 (run 41066236672, on `72e5516`), which was then merged (`47e235e`); Dependabot opens one grouped monthly pull request per ecosystem (S5 start). The push run on the merge (run 41075981429) was red: its end-to-end step failed in `appPlayEditor.e2e`, which pressed «Lagre» before the editor could save, a real slow-device fault. It is fixed in S6 step 0; GitHub's confirmation comes with that step's push | — | — |
| Q5 | Hosting: HVL on-premises or Sikt, both in the EEA (`DATA-004`). The container runtime must allow Playwright's seccomp profile and `CAP_SYS_CHROOT` for the PDF export's sandbox (OpenShift's `restricted-v2` allows neither), a DNS name and certificate for the files host (`files.<host>`, or a separate registrable domain), and a clamd with daily signatures (D-110's step-6 amendments) | HVL IT | S6 |
| Q6 | Data protection officer confirms the legal basis and reviews DPIA input (`DATA-005`). **Input complete 2026-11-05:** `docs/privacy/DPIA-INPUT.md` (purposes, operations, data flows with a diagram, the Canvas key's `privacy_level` and custom fields, recipients, retention, rights, security measures, residuals R1–R40, and the DPO's questions in its §13) | HVL DPO | S6, pilot |
| Q17 | Review the studio's drafts: phase labels and texts, the guide and its references, the nine patterns, the mappe template, criteria and limits, and the content bank's consent text (with HVL's lawyers); pilot teachers try the patterns; from S6 also the H5P texts and the video guidance in `content/h5p-tekstar/` (§9a, D-111). Packet: `docs/reference/alu-review-s5.md` (D-100). **Required before the pilot.** | ALU, Pedagogisk akademi, HVL legal | The pilot |
| Q18 | Should InteractiveBook and InteractiveVideo send a score to Canvas? H5P sends none unless asked. Default until answered (D-115): InteractiveBook does, through H5P's own «Send inn rapport» on the summary page (`reportingIsEnabled`, set for learners only, so an author's preview never offers it; the library then says «Svara dine er sende inn til vurdering», which the language overlay can reword, D-111); an InteractiveVideo only when its author adds a submit screen, so the `fa-video` pattern sends none | ALU / owner | The pilot |
| Q19 | Every ending of the `uv-case` pattern scores 10 of 10, as the pattern intends, so Canvas gets 100 for any completed case. Keep that as a completion mark (the default, D-115), score the choices (a pattern change ALU reviews), or give `uv-case` no Canvas score? | ALU | The pilot |
| Q20 | In `uv-module`, a chapter check's «Prøv igjen» fails (QuestionSet 1.21, upstream, when a page holds several sets). Default (D-115): the pattern hides that button and keeps each question's own «Prøv igjen». Is retrying a whole chapter check needed? Then a run-time repair of QuestionSet needs its own decision. **Default applied (2026-10-30, S6 step 3):** the three chapter checks in `uv-module`'s skeleton store `endGame.showRetryButton: false`, and each question keeps its own «Prøv igjen» until its check is finished; pending ALU's review of the patterns (Q17). **Found 2026-11-04:** the book's own «Prøv igjen» fails the same way (its reset throws in the first chapter check), so a finished chapter check cannot be retried at all; D-115 then turns the book's retry off too, once the regression test pins it, which `PED-H07` and `PROD-009` must allow (D-115's 2026-11-04 amendment). **Pinned 2026-11-04:** `uvModuleBookRetry.browser.int.test.ts` (an upstream pin) finishes the first chapter check and presses the book's «Prøv igjen» on its summary page: one `TypeError` (reading `classList`, from QuestionSet's reset), the book stays on its summary page, and the check keeps its results (D-115's amendment of the same day). **Open for the owner:** turn the book's retry off in the pattern (`behaviour.enableRetry: false`, a `PROD-009` `SPEC-DEVIATION`), or keep it on with the fault for the pilot; until then it stays on | ALU, owner | The pilot |
| Q21 | Confirm that container builds here may use the bridge network's direct egress, outside the agent proxy, for apt, npm and Prisma's engines only, and never for GitHub repository content (D-110, probe P3); S6 proceeds on that rule | Repository owner | — |
| Q22 | For the DPIA (`DATA-005`, D-106 residual): the grade-sync status counts (sent, pending, failed, orphaned; since D-104's amendment of 2026-11-04 one per learner and placement) are not *k*-suppressed (spec 05 §3). In `/app/play` a Canvas author sees only the launch's course; on the activity page the activity's owner and co-authors see the counts of every course it is placed in, also a colleague's course that placed it from the bank or copied it, where they are not teachers and Canvas's gradebook would not show them anything. A count there can be about one learner. Keep (the counts carry no learner, score or name), suppress below *k* for courses the viewer does not teach, or show a portal owner only the courses they launched as a teacher (`docs/privacy/DPIA-INPUT.md`) | HVL DPO, owner | The pilot |
| Q23 | A statement names no Canvas link (`DATA-012`), so since D-104's amendment of 2026-11-04 a learner's score in a graded link counts their plays of the same activity in the same course through any other link too, an ungraded practice link included, whose newer results also reopen the graded job. Keep it, or store the resource link with each statement (a `DATA-012` change) so that each link counts its own plays? | Owner | The pilot |
| Q24 | Insight's freshness (D-106's amendment of 2026-11-04, the step-4 privacy review): every period now ends at the latest midnight in Oslo, so the **Innsikt** tab shows the data up to and including yesterday («Tal til og med i går») and two views on the same day are always the same; a teacher who wants to see what students did before a seminar the same morning sees it the next day. Views on two consecutive days still differ by one day's learners. Keep the daily view (the default), or show a new view only once *k* or more new learners have played since the last one, which closes the day-by-day difference too but can leave a small course without new numbers for days? | Owner, ALU | The pilot |
| Q25 | Research export (the owner's idea of 2026-10-26, S6 step 5): researchers at ALU and Pedagogisk akademi would get *k*-suppressed packages (tiers A and B), or re-keyed event rows for one approved question (tier C), built and tested in TypeScript and analysed in Python or R (`docs/privacy/research-export.md`, design only). Research is a purpose of its own: the DPO decides the legal basis and whether tiers A and B are anonymous, and each export order needs the DPO's approval. Until then nothing is built, and giving a researcher the `hvli_analytics` role counts as research use too. Then the owner decides whether to build it (a decision and a requirement first) | HVL DPO, owner, ALU / Pedagogisk akademi | Any research use of learning data |
| Q26 | Audit records are kept 2 years (`DATA-007`), but nothing deletes them yet, and the app's database role may not (D-109's amendment of 2026-11-04). Decide how: a deletion job with its own role and grant (an amendment to D-109), or an operations step in a runbook (DPIA input R27) | Owner, HVL IT | Two years after the pilot starts |
| Q27 | Staff who leave HVL keep their account, display name, activities and co-authorships; nothing deletes a staff account, and staff members' own data-subject requests are handled by hand (D-108). Decide a routine, for example from HVL's leaver list, and who handles the activities they own (DPIA input R22, R28) | HVL DPO, HVL IT | The pilot |
| Q28 | A learner may object to the processing (GDPR Art. 21, since the basis is Art. 6(1)(e)), but there is no way to stop capturing one person's statements while they use activities. Accept a manual routine (an erasure after the objection, repeated as needed), or ask for an opt-out feature (its own decision; it would store who objected) (DPIA input R34) | HVL DPO, owner | The pilot |
| Q29 | Who may log in to the portal? The recommended Feide registration leaves «Restrict login to selected organizations» off (`docs/reference/feide-values.md`), so anyone with Feide, also from schools (pupils, possibly children), can log in as a learner and play activities shared with «anyone with Feide» (spec 02's role table, D-059), and their play is stored and counted. Restrict Feide's «Restrict login to selected organizations» to HVL (and named partners), or keep it open with the DPO's basis for those users and a line in `/personvern` (DPIA input R37) | Owner, HVL IT, HVL DPO | The pilot |
| Q30 | Students as insight readers: insight and the grade-sync counts go to anyone with the author role in a context, so a Canvas TA, who at HVL can be a student assistant, sees a course's *k*-suppressed aggregates, and a student author (D-059) sees them for every course their activity is placed in. Accept with HVL's confidentiality terms for student assistants, or show insight only to staff by Feide affiliation and to Canvas instructors but not TAs (an `INS-007` change; DPIA input R36) | HVL DPO, owner | The pilot |
| Q31 | Name a system owner (*systemeigar*) and a maintainer (*forvaltar*) at HVL for HVL Interaktiv. Neither is named anywhere, and the IT assurance pack asks for them (D-116; `docs/assurance/README.md`, «Who is accountable»; ROS-19 in `docs/assurance/ros-analyse.md`): the system owner, and who owns the test install and its tester list, before stage 1; the maintainer, who rebuilds and redeploys the image with fixes and runs the key rotations, the yearly purge and the backups (`docs/ops/runbook.md` §2, §4–§7), before stage 2 at the latest. Until then the repository owner makes the product decisions; the bachelor students' project (D-101) does not replace either role | Owner, HVL IT / ALU | Stage 1 of the IT assurance pack (`docs/assurance/test-environment.md`) |

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
| R-09 | Lumi's npm releases lag its repository: none since 10.0.4 (2025-03-08), while `master` carries file-security work we would want (D-081) | High | Medium | Our own file security (D-003) and adapters in our code; S6 asks for a release or pins a reviewed commit (D-081); the revisit triggers in D-081. The release request is drafted for the owner to file (`docs/upstream/lumi-release-request.md`, D-112); the choice before 2027-01-31 is in `docs/handoff/lumi-path.md` |

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
- **2026-10-30 · S5 gate** — The review fixes (49219ce) went green on GitHub; the local gate under full load then
  found three faults, each reproduced deterministically and fixed with tests that fail without the fix: the
  **Deling** tab's focus after a change (72fbcb2, three verification rounds), the loaded page title on slow devices
  and the checks that ran before a view had loaded (b8ab740). GitHub CI green on both. Gate output (commit b8ab740,
  run in parts of under 2 hours; every step exit 0):

  ```
  $ npm run typecheck · lint · format:check · lint:css           exit 0
  $ npm run doc:lint · check:filesize                            ✓ 11 checks passed · ✓ file-size passed
  $ npm run check:pins · check:licences · check:audit            ✓ 6 manifests · ✓ 482 packages · ✓ 2 advisories, all reviewed
  $ npm run privacy:inventory-check                              ✓ 22 models, 173 fields
  $ npm run h5p:fetch-core · h5p:fetch-libraries                 ✓ hashes match · ✓ 120 libraries and 10 packages
  $ npm run build · tokens:check                                 exit 0 · ✓ 3 files up to date, feedback prefixes up to date
  $ npm run content:check                                        ✓ 3 phases (proposed), 16 references, guide in nn/nb/en (5 sections,
                                                                   25 citations), 9 patterns, mappe template and 1 criteria set
  $ npm run spec:trace -- --check --done-through=S4 · S5         ✓ 126 requirements, traceability up to date (both)
  $ npm run spec:site -- --check · docs:api · boot-check         ✓ up to date · html generated · exit 0
  $ npx vitest run                                               Test Files 504 passed (504) · Tests 26316 passed (26316)
  $ npm run test:e2e                                             Test Files 12 passed (12) · Tests 20 passed (20)
  $ npm run test:a11y                                            Test Files 16 passed (16) · Tests 497 passed (497)
  $ npx vitest run -t <filter>, files/tests passed               AUTH-00 58/429 · LTI-00 79/438 · H5P-002|PROD-002 18/43 ·
                                                                   SEC-003|H5P-011|H5P-006 31/18720 · SEC-001 8/111 ·
                                                                   PROD-004|PROD-005|PROD-006|H5P-007 36/122 · UD-0 134/1050 ·
                                                                   PED-020 16/129 · PROD-003|UD-022 29/159 ·
                                                                   PROD-011|DATA-006|DATA-011 32/144 · PED-0 86/601 ·
                                                                   PROD-001|PROD-009 24/103 · PROD-007|PROD-013 74/3904 · MAPPE- 30/262
  $ npx vitest run -t "\[<ID>\]", tests passed                  PROD-003 156 · PROD-011 27 · NFR-003 0* · H5P-009 6 · UD-001 126 ·
                                                                   UD-002 7 · UD-003 67 · UD-004 5 · UD-005 3 · UD-006 151 · UD-007 13 ·
                                                                   UD-008 14 · UD-009 8 · UD-010 31 · UD-011 62 · UD-012 7 · UD-013 131 ·
                                                                   UD-020 272 · UD-021 216 · UD-022 20 · UD-030 23 · UD-031 0* ·
                                                                   PED-020 118 · DATA-006 63 · DATA-011 58 · DOC-012 53 · PED-001 88 ·
                                                                   PED-002 132 · PED-003 34 · PED-010 72 · PED-011 12 · PED-030 105 ·
                                                                   PED-031 32 · PED-032 21 · PROD-001 86 · PROD-007 3706 · PROD-009 18 ·
                                                                   PROD-013 201 · MAPPE-001 68 · MAPPE-002 145 · MAPPE-003 18 · MAPPE-004 39
                                                                   (* tested in the accessibility suite above)
  $ npm run mock:platform & WEB_APP=dev npm start                /healthz, /lti/keys, /, /hjelp, /personvern, /api/docs: 200;
                                                                   /laeringsdesign signed out; Feide sign-in (mock); pattern ea-diagnose →
                                                                   a new activity's Rediger tab; /laeringsdesign/planlegg,
                                                                   /laeringsdesign/innhaldsbank, /mappe: 200; downloads
                                                                   pedagogisk-mappe-2026-10-30.md (44 021 bytes) and .pdf (491 186 bytes,
                                                                   %PDF-1.4); 0 page errors
  ```

  Open at the end of S5: the items listed in section S5 (Q17 first). The hourly restart task is switched off.
- **2026-10-30 · S6 start** — The owner approved the S6 plan with five decisions (section S6): learning data first,
  insight as tabs only (no `/innsikt` page), the hourly restart task on until S6's gate passes, the full gate run in
  parts of under 2 hours, and what S6 does not reach passing to HVL's bachelor students through a hand-off index. Mapping S6 (six agents) found `main` red after PR #8's merge (run 41075981429, the editor
  save race), no xAPI bridge yet, ltijs's `submitScore` tied to a live ltik, Lumi's `alterLibraryLanguageFile`
  dropping the editor's texts, and a spec-load row narrower than the checklist. Recorded D-101…D-114; fixed `main`
  («Lagre» waits until H5P's editor can save); raised CI to `--done-through=S5`; added the licence check's
  production-set guard (S5 open item 8); amended CLAUDE.md §2 and §5, specs 01 (`H5P-008`…`H5P-010`), 02 (§1, §5–§7),
  03 (`UD-003`) and 05 (code location, §1, `INS-006`, `INS-007`, `DATA-002`, `DATA-003`, `DATA-012`, §4), the S6
  load rows of specs 01–04 and the Evaluator Guide (§4.1, §5); closed Q16. The hourly restart task is on until S6's
  gate passes.
- **2026-11-04 · S6 step 3** — Resumed after the paused work in progress (4bf4634): six workstreams verified and
  finished the grade bridge (ingest, bridge, grades, status UI, Canvas extras, integration), each reviewed by a skeptic
  with mutation checks, then a security and privacy review (one fix; four findings for decisions, listed under step 3).
  `follow-redirects` 1.16.1 → 1.16.2 in the lock file for the new advisory GHSA-mrwp-f3q8-3g9p. Not yet committed;
  step 3 stays open for the `uv-module` book-retry test (Q20) and the review's decisions. Check output (every step
  exit 0; tests with `CI=true`, so nothing skips):

  ```
  $ npm run typecheck · lint · lint:css · format:check           exit 0
  $ npm run doc:lint · check:filesize                            ✓ 11 checks passed · ✓ file-size passed
  $ npm run check:pins · check:licences · check:audit            ✓ 6 manifests · ✓ 482 packages · ✓ 2 advisories, all reviewed
  $ npm run privacy:inventory-check                              ✓ 22 models, 181 fields
  $ npm run content:check                                        ✓ 3 phases (proposed), 16 references, guide in nn/nb/en (5 sections,
                                                                   25 citations), 9 patterns, mappe template and 1 criteria set
  $ npm run build · tokens:check · theme check · docs:api        exit 0 · ✓ 3 files · ✓ feedback prefixes · html generated
  $ node tools/spec-trace/specTrace.mjs · spec-site (+ --check)  ✓ 126 requirements, traceability up to date · ✓ up to date
  $ npm run spec:trace -- --check --done-through=S5              ✓ 126 requirements, traceability up to date.
  $ npx vitest run --project tools|api-contract|hvl-h5p-theme|design-tokens|web
                                                                 Test Files 151 passed (151) · Tests 1305 passed (1305)
  $ npx vitest run test/xapi test/grades test/lti test/h5p       Test Files 164 passed (164) · Tests 19727 passed (19727)
    (apps/server)
  $ npx vitest run <the other 15 server test folders>            Test Files 263 passed (263) · Tests 5911 passed (5911)
  $ npm run test:e2e                                             Test Files 14 passed (14) · Tests 23 passed (23)
  $ npx vitest run … a11y/axeGradeSync.a11y.test.ts              Test Files 1 passed (1) · Tests 5 passed (5)
  ```
- **2026-11-04 · S6 step 4** — Five workstreams (step 3's hardening, the insight core, the insight API, the web
  **Innsikt** tabs, the mappe's results), each verified by a skeptic with mutation checks, then integrated:
  `createApp` passes the insight services to `/api` (the test beds too); the grade worker and the placement recorder
  get D-104's line item rules (`CANVAS_ORIGINS`, https in production); the `GradeSyncJob` schema comments, the
  grade-sync contract header and spec 02 `LTI-012` follow D-104's amendments; `fast-check` 4.10.2 is pinned (D-114;
  two date generators now say `noInvalidDate`); D-095's and D-106's amendments and the `SPEC-DEVIATION` marks for a
  shown 0 and `INS-003` on older versions; DPIA input R6–R9; Q23; the web says when answer distributions are for the
  current version only. New end-to-end test `e2e/insightInCanvas.e2e.test.ts`; `appPlayEditor.e2e.test.ts` now
  expects **Innsikt** among an author's Canvas tabs. Screenshots in `nn` at 1280 and 390 px with nine real learners
  (portal, `/app/play`, and a course below *k*) sent to the owner. A privacy and security review of step 4 and step
  3's hardening then fixed one leak (a listed wrong gap answer, hidden as a complement, pinned the other hidden
  counts; listed answers are now always shown, with a new exhaustive `[INS-006]` test) and left three design
  findings for decisions (section S6, step 4). The finish run regenerated `docs/TRACEABILITY.md` and the spec site and
  fixed what the full server run found: the grade worker's claim took every due job under a nested-loop plan (now a
  materialized CTE; section S6, step 3), and `webPages` and `webChrome` still listed the Canvas tabs without
  **Innsikt**. Not committed. Check output (every step exit 0 after the fixes; tests with `CI=true`, so nothing
  skips):

  ```
  $ npm run typecheck · lint · lint:css · format:check           exit 0
  $ npm run doc:lint · check:filesize                            ✓ 11 checks passed · ✓ file-size passed
  $ npm run content:check                                        ✓ 3 phases (proposed), 16 references, guide in nn/nb/en (5 sections,
                                                                   25 citations), 9 patterns, mappe template and 1 criteria set
  $ npm run check:pins · check:licences · check:audit            ✓ 6 manifests · ✓ 482 packages · ✓ 2 advisories, all reviewed
  $ npm run privacy:inventory-check · tokens:check               ✓ 22 models, 181 fields · ✓ 3 files up to date
  $ npm run build                                                exit 0
  $ node tools/spec-trace/specTrace.mjs · spec-site (+ --check)  ✓ 126 requirements, traceability up to date · ✓ up to date
  $ npm run spec:trace -- --check --done-through=S5              ✓ 126 requirements, traceability up to date.
  $ npx vitest run --project tools|api-contract|hvl-h5p-theme|design-tokens|web
                                                                 Test Files 165 passed (165) · Tests 1380 passed (1380)
  $ npx vitest run test/xapi test/grades test/lti test/h5p       Test Files 168 passed, 1 failed (169) · Tests 19766 passed, 1 failed
    (apps/server)                                                  (gradeSyncFlood: 3 jobs claimed with a limit of 1; fixed)
  $ npx vitest run <the other 16 server test folders>            Test Files 285 passed, 2 failed (287) · Tests 6088 passed, 2 failed
                                                                   (webPages, webChrome: Canvas tabs without «Innsikt»; fixed)
  $ npx vitest run test/grades test/web (after the fixes)        Test Files 29 passed (29) · Tests 241 passed (241)
  $ npm run test:e2e                                             Test Files 15 passed (15) · Tests 24 passed (24)
  $ npx vitest run … a11y/axeInsight.a11y.test.ts axeGradeSync   Test Files 2 passed (2) · Tests 11 passed (11)
  ```
- **2026-11-05 · S6 step 5 (integration)** — Five workstreams (the step-4 privacy review's fixes, the yearly purge,
  the data-subject CLI, the roles with the production checks and the request log, the privacy documents), each
  verified by one or two skeptics with mutation checks, then integrated. Wiring: main.ts passes `CANVAS_ORIGINS` to
  the NRPS roster check (so does `gradeBridgeInputs`) and logs `deployment locations` (hosts and region only);
  `PURGE_RUN_DATE` in `env.ts` (a bad day stops the start, `purgeEnv.test.ts`) and `.env.example`, which also states
  the production TLS and EEA rules; the S3 client ignores the AWS SDK's own endpoint settings (D-109's amendment,
  `s3Client.test.ts`, which fails without it); `AccountResolver` makes an account staff only while its identity still
  exists, so a login that races the purge starts over (D-107's amendment, `accountPurgeRace.int.test.ts`); the
  `privacy:purge` and `db:roles` scripts, with the runbooks using them; the CSV's period end «Til (ikkje med)»; the
  contract's `periodEnd` TSDoc; D-108's citation of student authors (D-059, not D-089); `privacy:dpia-check`, the
  `[DATA-005]` document check of D-113. Proven together: the insight e2e with a seventh learner's play of today and
  Canvas's test student left out; the test student's score sent by the worker to the mock Canvas; the operations CLIs
  through their npm scripts on a database they deploy themselves (`operationsClis.int.test.ts`); production refusing a
  clear-text database, Redis or S3 URL and the SDK's endpoint variable at start-up, by name only. Docs: the server
  and web READMEs, `docs/ops/README.md`, the GLOSSARY, the Evaluator Guide (commands, §4.4, how each S6 privacy
  requirement is verified), DPIA R11, R19 and R23. Screenshots of the **Innsikt** tab in `nn` at 1280 and 390 px
  retaken and sent to the owner. Not regenerated, by the run's instruction: `docs/TRACEABILITY.md` and the spec site
  (so `spec:trace --check` and `specSite.test.mjs` report them out of date). Not committed. Check output:

  ```
  $ npm run typecheck · lint · lint:css · format:check           exit 0
  $ npm run doc:lint · check:filesize                            ✓ 11 checks passed · ✓ file-size passed
  $ npm run privacy:inventory-check · privacy:dpia-check         22 models, 182 fields · 13 sections, key and residuals agree
  $ CI=true npx vitest run test/config test/infra test/auth test/xapi test/privacy test/insight test/lti
      test/server test/db test/http test/grades test/learningDesign/mappe test/jobs (no browser files)
                                                                 Test Files 240 passed (240) · Tests 1994 passed (1994)
  $ CI=true npx vitest run tools packages/api-contract            Test Files 55 passed, 1 failed: specSite (site not regenerated)
  $ CI=true npx vitest run (apps/web)                             Test Files 94 passed (94) · Tests 592 passed (592)
  $ CI=true npm run test:e2e                                      Test Files 15 passed (15) · Tests 24 passed (24)
  $ npm run build (apps/web) · a11y/axeInsight.a11y.test.ts       built · Test Files 1 passed · Tests 6 passed (6)
  ```
- **2026-11-05 · S6 step 5** — A privacy and security review of the integrated step 5, then the finish run. The review
  fixed two leaks, each with its decision's amendment first and tests that fail without the fix: the mappe now ends
  at the latest Oslo midnight, as insight does, so it can no longer be differenced against insight's semester view or
  against itself on the same day (D-106, `storedResultsBeforeToday.int.test.ts`); production refuses a bucket
  variable that is not a plain bucket name, since the AWS SDK sends an access point or Outposts ARN to the ARN's own
  region, past the EEA check (D-109, nine `[DATA-004]` tests). It left three low findings and the documents for its
  two fixes to their owners (section S6, step 5). The finish run regenerated `docs/TRACEABILITY.md` and the spec site
  and ran every check; nothing needed fixing. PROGRESS: step 3's commit is abb60a5 (not 9fb0c02). No view changed
  since the integration's screenshots, so none were retaken. Not committed. Check output (every step exit 0; tests
  with `CI=true`, so nothing skips; the spec site was built again after this entry, and its `--check`,
  `specSite.test.mjs`, `doc:lint` and `format:check` passed again):

  ```
  $ node tools/spec-trace/specTrace.mjs · spec-site (+ --check)  ✓ 126 requirements · ✓ docs/site/index.html is up to date
  $ npm run spec:trace -- --check --done-through=S5              ✓ 126 requirements, traceability up to date.
  $ npm run typecheck · lint · lint:css · format:check           exit 0
  $ npm run doc:lint · check:filesize                            ✓ 11 checks passed · ✓ file-size passed
  $ npm run content:check                                        ✓ 3 phases (proposed), 16 references, guide in nn/nb/en (5 sections,
                                                                   25 citations), 9 patterns, mappe template and 1 criteria set
  $ npm run check:pins · check:licences · check:audit            ✓ 6 manifests · ✓ 482 packages · ✓ 2 advisories, all reviewed
  $ npm run privacy:inventory-check · privacy:dpia-check         ✓ 22 models, 182 fields · 13 sections, key and residuals agree
  $ npm run tokens:check · build                                 ✓ 3 files up to date · exit 0
  $ npx vitest run --project tools|api-contract|hvl-h5p-theme|design-tokens|web
                                                                 Test Files 167 passed (167) · Tests 1397 passed (1397)
  $ npx vitest run test/xapi test/grades test/lti test/h5p       Test Files 170 passed (170) · Tests 19783 passed (19783)
    (apps/server)
  $ npx vitest run <the other 17 server test folders>            Test Files 320 passed (320) · Tests 6360 passed (6360)
  $ npm run test:e2e                                             Test Files 15 passed (15) · Tests 24 passed (24)
  $ npx vitest run … a11y/axeInsight.a11y.test.ts axeGradeSync   Test Files 2 passed (2) · Tests 11 passed (11)
  ```
- **2026-11-05 · S6 step 6 (integration)** — Six workstreams (the image and app stack, the files origin, ClamAV,
  backups with the runbook and the load harness, the conformance report, the step-5 follow-ups with the library-build
  fix), each verified by a skeptic with mutation checks, then integrated. Decisions first: D-110's integration
  amendment and D-056's (the old data key stays at least 31 days, for the grade jobs' `sub`). Wiring: `main.ts` runs
  the PDF probe after listening and `stop` waits for it (`main.smoke.test.ts` checks the line); `tsx` moved from the
  root's development dependencies to `apps/server`'s (the image's copy is now a guard); scripts `deploy:check`,
  `docker:smoke`, `pdf:check`; the app stack has its own clamd (`clamav/clamav:1.4` by digest) and `CLAMAV_HOST` on
  every service from the image; the smoke test proves an upload in the image (`deploy/smoke/uploadProof.mjs`); CI
  runs the real-clamd tests against a clamav service and `a11y:report -- --check`; Dependabot proposes the image's
  digests; Lumi's own `upload-malware-found` gets the scanner's message (a safety net); `.env.example`'s production
  rules and key rotation; the unknown test ID in `reportGuards.test.mjs` built at run time so `spec:trace` does not
  read it. Leaked build environments (the old AudioRecorder builds, with this session's tokens) deleted from 20 test
  temp folders and the scratchpad; the 26 build-cache records (2.8 GB) a skeptic's test left on the default builder
  removed by ID. Docs: `docs/ops/README.md`, `docker.md`, `clamav.md`, the runbook's checklist, the server README (module map, diagram,
  trace rows), the Evaluator Guide (commands, the six S6 rows, limitations 10, 13 and 17), the GLOSSARY, DPIA F13,
  F14, §9 and R38–R39, the inventory's log rows, specs 01 (code map, `SEC-004` and `SEC-006` amendments) and 02 (§2),
  the protocol's §9 and the results README. No view changed, so no screenshots. Not regenerated, by the run's
  instruction: `docs/TRACEABILITY.md` and the spec site (so `spec:trace --check` and `specSite.test.mjs` report them
  out of date). Not committed. Check output:

  ```
  $ HVLI_DOCKER_SANDBOX=1 HVLI_APP_PORT=18093 bash deploy/smoke/dockerSmoke.sh   (the working tree, all six workstreams)
      ✓ deploy files · ✓ bundle (10 packages) · image 2777 MB · ✓ proxy CA in no file of the image
      ✓ /healthz {"status":"ok"} · ✓ 7 of 7 migrations · ✓ 77 libraries, 77 seed audit rows
      ✓ pages: /hjelp (nn), a script and /h5p/core/js/h5p.js from the image
      ✓ upload: the stack's clamd refused EICAR (Eicar-Test-Signature) and passed a clean PNG;
        files.localhost:18093 serves it (200, CSP sandbox, nosniff, no cookie); the app origin answers 404
      ✓ PDF with the sandbox: 25 179 bytes, æ ø å, LiberationSans-Bold and LiberationSerif embedded, Tagged, A4
      ✓ sandbox in /proc: 2 renderers, NSpid [3,3], filters [2,2] · ✓ start-up probe: pdfSandbox true, reason ok
      Chromium 141.0.7390.37 (dd794b4e…144a) · disk 17 GB → 9.3 GB → 17 GB · ✓ docker smoke passed in 155 s
  $ npm run test:e2e                                             Test Files 16 passed (16) · Tests 27 passed (27)
  $ vitest a11y: axeContentTypes, axeEditor, firstParty          Test Files 3 passed (3) · Tests 91 passed (91)
  $ CI=true npx vitest run tools/ops                             Test Files 4 passed (4) · Tests 34 passed (34)
  $ npm run load:smoke                                           exit 0 · player ready p95 1267 ms · API p95 26 ms ·
                                                                   0.00 % failed · 60 visits · 6180 requests
  $ CLAMAV_TEST_HOST=127.0.0.1 … realClamd.test.ts (clamd 1.4.6) Tests 2 passed (2)
  $ CI=true npx vitest run test/config test/security test/http test/server test/logging test/lti test/db
      test/privacy test/learningDesign/mappe test/infra (apps/server)
                                                                 Test Files 193 passed, 1 skipped (realClamd) · Tests 1494 passed
  $ CI=true npx vitest run --project tools                       Test Files 60 passed, 1 failed: specSite (site not regenerated)
  $ npm run typecheck · lint · lint:css · format:check           exit 0
  $ npm run doc:lint · check:filesize                            ✓ 11 checks passed · ✓ file-size passed
  $ npm run check:pins · check:licences · check:audit            ✓ 6 manifests · ✓ 488 packages · ✓ 2 advisories, all reviewed
  $ npm run privacy:inventory-check · privacy:dpia-check         ✓ 22 models, 182 fields · 13 sections, key and residuals agree
  $ npm run a11y:report -- --check · content:check               exit 0 · ✓
  $ node tools/spec-trace/specTrace.mjs --check --done-through=S6   only: TRACEABILITY.md is out of date
  ```
- **2026-11-05 · S6 step 6** — A security review of the integrated step 6, then the finish run. The review attacked
  the files origin (traversal, host variants, methods, cookies), the grants, the SVG and upload paths, the scanner,
  the image, the app stack, backups and the load harness, and found no high or medium defect in the code. One low fix,
  with a regression test that fails without it: a NUL byte in a granted file path reached PostgreSQL and answered 500
  with an error-level log line; `signedFileRoutes.ts` now answers 404 before storage for any name the storage refuses
  (`[SEC-004]` in `filesOrigin.int.test.ts`). Its other findings (clamd's `AlertExceedsMax` and `AlertEncrypted`,
  the root compose file's published ports, the cookie route's NUL 500 and smaller hardening) are under step 6's
  «Still open». The finish run regenerated `docs/TRACEABILITY.md` and the spec site, reworded the step-6 integration
  entry so it no longer names an unknown requirement ID (`spec:trace --check` refused it), and ran every check and
  test set, and the Docker smoke again, because the image copies the source tree and the review's fix came after the
  integration's smoke. Nothing else needed fixing. No view changed, so no screenshots. Not committed. Check output
  (every step exit 0; tests with `CI=true`; the spec site was built again after this entry and its `--check` passed):

  ```
  $ node tools/spec-trace/specTrace.mjs · spec-site (+ --check)  ✓ 126 requirements · ✓ docs/site/index.html is up to date
  $ npm run spec:trace -- --check --done-through=S5              ✓ 126 requirements, traceability up to date.
  $ npm run typecheck · lint · lint:css · format:check           exit 0
  $ npm run doc:lint · check:filesize                            ✓ 11 checks passed · ✓ file-size passed
  $ npm run content:check                                        ✓ 3 phases (proposed), 16 references, guide in nn/nb/en (5 sections,
                                                                   25 citations), 9 patterns, mappe template and 1 criteria set
  $ npm run check:pins · check:licences · check:audit            ✓ 6 manifests · ✓ 488 packages · ✓ 2 advisories, all reviewed
  $ npm run privacy:inventory-check · privacy:dpia-check         ✓ 22 models, 182 fields · 13 sections, key and residuals agree
  $ npm run tokens:check · deploy:check · a11y:report -- --check ✓ 3 files up to date · ✓ deploy files as D-110 sets them · exit 0
  $ npm run build                                                exit 0
  $ npx vitest run --project tools|api-contract|hvl-h5p-theme|design-tokens|web
                                                                 Test Files 186 passed (186) · Tests 1524 passed (1524)
  $ npx vitest run test/xapi test/grades test/lti test/h5p       Test Files 171 passed (171) · Tests 19789 passed (19789)
    (apps/server)
  $ npx vitest run <the other 18 server test folders>            Test Files 334 passed, 1 skipped (realClamd: no clamd host)
                                                                   · Tests 6449 passed, 2 skipped
  $ npm run test:e2e                                             Test Files 16 passed (16) · Tests 27 passed (27)
  $ npx vitest run … a11y/axeContentTypes axeEditor axeInsight axeGradeSync firstParty
                                                                 Test Files 5 passed (5) · Tests 102 passed (102)
                                                                   (one policy refusal: BranchingScenario's documentation frame)
  $ HVLI_DOCKER_SANDBOX=1 HVLI_APP_PORT=18094 bash deploy/smoke/dockerSmoke.sh   (the final working tree)
      ✓ deploy files · ✓ bundle (10 packages) · ✓ core and editor match their hash lists · image 2777 MB
      ✓ proxy CA in no file of the image · ✓ /healthz {"status":"ok"} · ✓ 7 of 7 migrations
      ✓ 77 libraries, 77 seed audit rows · ✓ pages: /hjelp (nn), a script and /h5p/core/js/h5p.js from the image
      ✓ upload: the stack's clamd refused EICAR (Eicar-Test-Signature) and passed a clean PNG;
        files.localhost:18094 serves it (200, CSP sandbox, nosniff, no cookie); the app origin answers 404
      ✓ PDF with the sandbox: 25 179 bytes, æ ø å, LiberationSans-Bold and LiberationSerif embedded, Tagged, A4
      ✓ sandbox in /proc: 2 renderers, NSpid [3,3], filters [2,2] · ✓ start-up probe: pdfSandbox true, reason ok
      Chromium 141.0.7390.37 · disk 17 GB → 10 GB → 17 GB · no image, container, volume, builder or cache left
      ✓ docker smoke passed in 154 s
  ```
- **2026-11-05 · S6 step 7 (integration)** — Five workstreams (the language overlay, problem reporting for the pilot,
  the upstream drafts, the students' hand-off index with the live-contract seam, and the hardening after step 6's
  security review), each verified by a skeptic with mutation checks, then integrated. A D-101 amendment («the
  integration») came first. The integration: `main.ts` hands the start-up's H5P texts to the engine, so
  `content/h5p-tekstar/` is read once and a test's content folder reaches it (`startupLanguageOverlay.test.ts`, which
  fails without the change); a root `test:live` script, the seam's type check in `npm run typecheck`, and a CI step
  that runs the seam against the mocks (`LIVE_TARGET=mock`); the theme's stale «Paste» comment and the upstream
  README's stale `UPSTREAM:` remark corrected; InteractiveVideo 1.28's scored end-screen summary, which no language
  file reaches (checked at the pinned commit and on the default branch, 114f513), added to the English-text register
  with an upstream draft, and the conformance report regenerated from its sources (only that entry changed); the
  manual protocol §9 now says what goes into the register and what into a D-080 amendment. Documents: the hand-off
  index (every workstream's hand-off item, every link checked), the root README (status, documentation map), the
  server README (module rows, the `H5P-008` and `H5P-010` trace rows, the mermaid storage chain), spec 01 (module
  map; `H5P-008` and `H5P-010` built), the Evaluator Guide (three commands; limitations 2, 5, 20 and the new 22), the
  GLOSSARY (language overlay, live-contract seam, hand-off index, upstream draft, *sak* and *etikett*), the ALU review
  packet (§9a, the H5P texts) and this checklist (step 6's «Still open» after the hardening; step 7 ticked). The
  step-7 screenshots (nn, 1280 and 390 px, eight files) are the overlay workstream's, sent to the owner; the
  integration changed no view. `docs/TRACEABILITY.md` and the spec site are not regenerated in this step, so their two
  checks report «out of date» and nothing else. Not committed. Check output (every step exit 0 unless noted; tests
  with `CI=true`):

  ```
  $ npm run build · typecheck (now with live/tsconfig.json) · lint · lint:css · format:check   exit 0
  $ npm run doc:lint · check:filesize                            ✓ 11 checks passed · ✓ file-size passed
  $ npm run content:check (and with CI=true)                     ✓ … H5P texts: 91 in nn, 93 in nb, video guidance on 2 fields (draft)
  $ npm run tokens:check · check --workspace packages/hvl-h5p-theme · a11y:report -- --check   ✓ · ✓ · exit 0
  $ node tools/spec-trace/specTrace.mjs --check --done-through=S6   only: TRACEABILITY.md is out of date
  $ node tools/spec-site/buildSpecSite.mjs --check               only: docs/site/index.html is out of date
  $ npm run test:live · LIVE_TARGET=mock npm run test:live       17 passed, 19 skipped · 36 passed (6 files)
  $ npx vitest run tools/a11y-report tools/issue-forms tools/doc-lint tools/spec-trace tools/spec-site
                                                                 143 passed, 1 failed: [DOC-004] the committed page is up to
                                                                   date (the spec site, not regenerated in this step)
  $ npx vitest run --project hvl-h5p-theme                       Test Files 13 passed · Tests 202 passed
  $ npx vitest run (apps/server) test/server test/h5p/languageOverlay test/h5p/semantics H5pFactories
      storableFileName contentStorage.int LanguageFallbackLibraryStorage test/learningDesign/content
      skeletonCreation.browser.int (probe P1) http/contentFiles.int http/signedFiles.int ContentFileHeaders
                                                                 Test Files 49 passed · Tests 440 passed (the overlay's real
                                                                   nn player and nb editor tests included)
  $ npm run test:e2e                                             Test Files 16 passed (16) · Tests 27 passed (27)
  $ npm run test:a11y -- a11y/axeContentTypes a11y/axeEditor a11y/upstreamRegister
                                                                 Test Files 3 passed · Tests 48 passed (the three English
                                                                   texts, InteractiveVideo's included, still written)
  ```
- **2026-11-05 · S6 step 7** — The finish run of step 7 on the integrated working tree. `docs/TRACEABILITY.md` and
  the spec site regenerated (the new `[H5P-008]`, `[H5P-010]` and `tools/issue-forms` tests, the new source files and
  the DECISIONS amendments), then every check and test set run once more with `CI=true`: the full server set (both
  halves), the e2e set, the seam (skipped, and against the mocks), the accessibility files for the player, editor,
  insight, grade sync and the English-text register; beyond the brief, the real-clamd tests against a local clamd
  1.4 with `AlertExceedsMax` and `AlertEncrypted` on (the one file the server set skips without a clamd host), and the
  Docker smoke, because the image copies `content/` and `src/` and step 7 changed `main.ts` and added
  `content/h5p-tekstar/`. Nothing needed fixing. This checklist: step 6's review findings that the hardening fixed are
  now a ticked item of their own (moved out of «Still open», which now names the cookie route as passed to the
  students), and step 7 has its verified item, a list of what passes to the students through the hand-off index §3,
  and the CI seam step's first GitHub run under «Still open». No view changed, so no screenshots (step 7's eight are
  the overlay workstream's). Not committed. Check output (every step exit 0; tests with `CI=true`; the spec site was
  built again after this entry and its `--check` passed):

  ```
  $ node tools/spec-trace/specTrace.mjs · spec-site (+ --check)  ✓ 126 requirements · ✓ docs/site/index.html is up to date
  $ npm run spec:trace -- --check --done-through=S5 (and S6)     ✓ 126 requirements, traceability up to date.
  $ npm run build · typecheck · lint · lint:css · format:check   exit 0 (typecheck includes live/tsconfig.json)
  $ npm run doc:lint · check:filesize                            ✓ 11 checks passed · ✓ file-size passed
  $ npm run content:check (and with CI=true)                     ✓ 3 phases (proposed), 16 references, guide in nn/nb/en (5 sections,
                                                                   25 citations), 9 patterns, mappe template and 1 criteria set,
                                                                   H5P texts: 91 in nn, 93 in nb, video guidance on 2 fields (draft)
  $ npm run check:pins · check:licences · check:audit            ✓ 6 manifests · ✓ 488 packages · ✓ 2 advisories, all reviewed
  $ npm run privacy:inventory-check · privacy:dpia-check         ✓ 22 models, 182 fields · 13 sections, key and residuals agree
  $ npm run tokens:check · deploy:check · a11y:report -- --check ✓ 3 files up to date · ✓ deploy files as D-110 sets them · exit 0
  $ npx vitest run --project tools|api-contract|hvl-h5p-theme|design-tokens|web
                                                                 Test Files 188 passed (188) · Tests 1537 passed (1537)
  $ npx vitest run test/xapi test/grades test/lti test/h5p       Test Files 179 passed (179) · Tests 19860 passed (19860)
    (apps/server)                                                  (the overlay's real nn player and nb editor tests included)
  $ npx vitest run <the other 20 server test folders>            Test Files 337 passed, 1 skipped (realClamd: no clamd host)
                                                                   · Tests 6473 passed, 2 skipped
  $ CLAMAV_TEST_HOST=127.0.0.1 … npx vitest run test/security/malware/realClamd.test.ts
      (clamav/clamav:1.4 by digest, AlertExceedsMax and AlertEncrypted yes)   Test Files 1 passed · Tests 2 passed
  $ npm run test:e2e                                             Test Files 16 passed (16) · Tests 27 passed (27)
  $ npm run test:live · LIVE_TARGET=mock npm run test:live       17 passed, 19 skipped · Test Files 6 passed · Tests 36 passed
  $ npx vitest run … a11y/axeContentTypes axeEditor axeInsight axeGradeSync firstParty upstreamRegister
                                                                 Test Files 6 passed (6) · Tests 107 passed (107)
                                                                   (one policy refusal: BranchingScenario's documentation frame)
  $ HVLI_DOCKER_SANDBOX=1 HVLI_APP_PORT=18094 bash deploy/smoke/dockerSmoke.sh   (the final working tree)
      ✓ deploy files · ✓ bundle (10 packages, SHA256SUMS match) · image 2777 MB · ✓ proxy CA in no file of the image
      ✓ /healthz {"status":"ok"} · ✓ 7 of 7 migrations · ✓ 77 libraries, 77 seed audit rows
      ✓ pages: /hjelp (nn), a script and /h5p/core/js/h5p.js from the image
      ✓ upload: the stack's clamd refused EICAR (Eicar-Test-Signature) and passed a clean PNG;
        files.localhost:18094 serves it (200, CSP sandbox, nosniff, no cookie); the app origin answers 404
      ✓ PDF with the sandbox: 25 179 bytes, æ ø å, LiberationSans-Bold and LiberationSerif embedded, Tagged, A4
      ✓ sandbox in /proc: 2 renderers, NSpid [3,3], filters [2,2] · ✓ start-up probe: pdfSandbox true, reason ok
      Chromium 141.0.7390.37 · disk 16 GB → 8 GB → 16 GB · no image, container, volume, builder or cache left
      ✓ docker smoke passed in 163 s
  ```
- **2026-11-05 · S6 steps 8–10** — Integration, docs, and an independent review with fixes, then this finish run
  (resumed after the usage limit). Step 8: the accessibility suite now covers every S6 view (18 files, 558 tests,
  one text-spacing fault in the Innsikt chart fixed, the run recorded in the conformance report), and six new e2e
  files cover the journeys of spec 00 §3 with J1's «new from a pattern» in Canvas passed to the students (22 files,
  33 tests, three passing runs). Step 9: the Evaluator Guide's S6 gate row and limitations, the READMEs and the
  GLOSSARY. Step 10: five lenses, a skeptic per finding, a fixer and an adversarial re-check per lens: 20 findings,
  18 confirmed, 2 refuted, 18 fixed (section S6, step 10). The finish run regenerated `docs/TRACEABILITY.md` and the
  spec site, corrected four stale texts (the web README's Canvas-studio line and S6 status, the e2e config's header,
  the conformance report's view descriptions) and wrote the S6 gate as ten runnable parts for step 11
  (`gate-s6.sh`, kept in the scratchpad, `PART=A…J`; each part under 2 hours, estimated from this session's runs:
  A 38 min checks, builds and the root run; B 50 min e2e, the recorded accessibility run, real clamd, load and
  Docker smokes, the running server; C 60 and D 82 min the filters; E 88 min S3's IDs; F 75 and G 69 min S4's;
  H 85 min S5's; I 89 and J 94 min PROD-013 and S6's; about 12 hours in all, 144 steps). The gate has not run. Not
  committed. Check output (every step exit 0):

  ```
  $ node tools/spec-trace/specTrace.mjs · spec-site (+ --check)  ✓ 126 requirements · ✓ docs/site/index.html is up to date
  $ npm run spec:trace -- --check --done-through=S6             ✓ 126 requirements, traceability up to date.
  $ npm run typecheck · lint · lint:css · format:check          exit 0 · All matched files use Prettier code style!
  $ npm run doc:lint · check:filesize                           ✓ 11 checks passed · ✓ file-size passed
  $ npm run content:check                                       ✓ 3 phases (proposed), 16 references, guide in nn/nb/en, 9 patterns,
                                                                  mappe template and 1 criteria set
  $ npm run check:pins · check:licences · check:audit           ✓ 6 manifests · ✓ 488 packages (all 37 workspaces) · ✓ 2 advisories,
                                                                  all reviewed
  $ npm run privacy:inventory-check · privacy:dpia-check        ✓ 22 models, 182 fields · 13 sections, key and residuals agree
  $ npm run tokens:check · deploy:check · a11y:report -- --check
                                                                ✓ 3 files up to date · ✓ deploy files as D-110 sets them · exit 0
  $ npm run build                                               exit 0 (no tracked file changed by the build)
  $ npx vitest run --project tools|api-contract|design-tokens|hvl-h5p-theme|web
                                                                Test Files 190 passed (190) · Tests 1565 passed (1565)
  $ npx vitest run --project server test/insight test/grades test/privacy test/lti/deepLinking test/xapi
                                                                Test Files 88 passed (88) · Tests 708 passed (708)
  $ npx vitest run tools/a11y-report                            Test Files 5 passed (5) · Tests 45 passed (45)
  $ npx vitest run -t "\[INS-009\]"   (timing a per-ID run)     Test Files 8 passed | 701 skipped (709) · Tests 23 passed |
                                                                  27888 skipped (27911) · 284 s
  $ gate6-start.sh (the gate's running-server step, tried once)
      /healthz, /lti/keys, /, /hjelp, /personvern, /api/docs: 200 · the S5 studio walk and both mappe downloads
      (Markdown 42 404 bytes, PDF 489 586 bytes) · an activity from ea-diagnose: «Innsikt» (h: Innsikt før samlinga)
      and «Poeng til Canvas» (h: Poeng til karakterboka i Canvas) on the activity page · mock Canvas: the picker as
      the teacher, then the resource link: /app/play tabs Spel, Rediger, Innsikt, Poeng til Canvas · 0 page errors
  ```
- **2026-11-05 · IT assurance pack** — At the owner's request, a pack for HVL IT (operations and security), who will
  want assurances from people before they host the service even for testing (D-116): `docs/assurance/` with a start
  page and a Nynorsk *samandrag* (`README.md`), the architecture with trust boundaries, network flows, data stores and
  secrets by name (`architecture.md`), a STRIDE threat model (`threat-model.md`), a draft ROS-analyse
  (`ros-analyse.md`), what has and has not been reviewed and where people should start (`human-review.md`), and the
  stage-1 request for an isolated test install with made-up data only (`test-environment.md`); and a CycloneDX SBOM,
  `docs/assurance/sbom.cdx.json`, written by the new `npm run sbom` (`tools/sbom/`, 22 tests titled `[SEC-007]`). The
  pack asks in three stages (0: own machines or Codespaces with the mocks; 1: an isolated test server; 2: a pilot
  after the DPO, a human security review, the ROS-analyse and an operations agreement) and adds Q31 (a named system
  owner and maintainer at HVL). Every document is a **draft for HVL IT to correct**, written by the AI that wrote the
  code and fact-checked by further AI passes; no person has reviewed it. No app code, spec or test outside
  `tools/sbom` changed, and the S6 checklist and gate are untouched (e87c1a9).
- **2026-11-06 · S6 gate** — The full S6 gate (D-113, Evaluator Guide §5) in ten parts, each a tracked background
  task of under 2 hours, 144 steps in about 11 hours of running time, on this container (not GitHub CI), from
  2026-11-05 16:28 to 2026-11-06 04:17 UTC. Three steps failed on their first run and each was fixed, pushed and run
  again: `docs:api` (10 TypeDoc warnings on S6 types; f5fa12b), the `AUTH-00` filter (a grade-sync test that read a
  placement made by the test before it; 92ca2c5) and the `DATA-007` run of one ID (two scenario files whose audit test
  read runs that the ID's run skipped; 5a5b8c3). Part B's accessibility run is recorded in the conformance report
  (7189e97). The IT assurance pack (e87c1a9) was committed between parts E and F; it changes no app code. The
  container restarted twice (before part E and during part I's second step); the services were started again and
  part I re-ran from that step. Part A then ran again in full on the final commit, so every check and the whole root
  run stand on 5a5b8c3 (working tree clean). Gate output (every step exit 0 in its latest run):

  ```
  $ npm run typecheck · lint · format:check · lint:css           exit 0                                   (A, 5a5b8c3)
  $ npm run doc:lint · check:filesize                            ✓ 11 checks passed · ✓ file-size passed
  $ npm run check:pins · check:licences · check:audit            ✓ 6 manifests · ✓ 488 packages (all 37 workspaces) ·
                                                                   ✓ 2 advisories, all reviewed
  $ npm run privacy:inventory-check · privacy:dpia-check         ✓ 22 models, 182 fields · exit 0
  $ npm run h5p:fetch-core · h5p:fetch-libraries                 ✓ hashes match · ✓ 120 libraries and 10 packages
  $ npm run build · tokens:check (+ theme check) · content:check exit 0 · ✓ 3 files up to date · ✓ 3 phases, 16 references,
                                                                   guide in nn/nb/en, 9 patterns, mappe template, 1 criteria set
  $ npm run spec:trace -- --check --done-through=S1 … S6         ✓ 126 requirements, traceability up to date (all six)
  $ npm run spec:site -- --check · docs:api · boot-check         ✓ up to date · html generated · exit 0
  $ npm run deploy:check                                         ✓ pins, user, ports, hardening and the seccomp profile
  $ npx vitest run                                               Test Files 711 passed | 1 skipped (712) ·
                                                                   Tests 27931 passed | 2 skipped (27933)
                                                                   (the skipped file is the real-clamd test, run below)
  $ npm run test:live · LIVE_TARGET=mock npm run test:live       17 passed, 19 skipped (no LIVE_*) · 36 passed (36)
  $ npm run test:e2e                                             Test Files 22 passed (22) · Tests 33 passed (33)  (B, f5fa12b)
  $ npm run test:a11y (recorded) · a11y:report --from-run, --check
                                                                 Test Files 18 passed (18) · Tests 558 passed (558) · exit 0
  $ npm run test:a11y -t "\[NFR-003\]" · "\[UD-031\]"           1 · 3 tests passed
  $ real clamd 1.4 (AlertExceedsMax, AlertEncrypted)             Test Files 6 passed (6) · Tests 30 passed (30)
  $ npm run load:smoke                                           thresholds passed: 0.00 % failed of 6180 requests (60 visits),
                                                                   player ready p95 1259 ms, API p95 30 ms
  $ npm run docker:smoke (HVLI_DOCKER_SANDBOX=1)                 image 2777 MB, no proxy CA in it; 7 of 7 migrations; 77 library
                                                                   folders seeded; /healthz ok; clamd refused EICAR; the PDF in
                                                                   the app container with Chromium's sandbox (seen in /proc)
  $ npm run mock:platform & WEB_APP=dev npm start                /healthz, /lti/keys, /, /hjelp, /personvern, /api/docs: 200;
                                                                   studio walk; mappe downloads .md (42 734 bytes) and .pdf
                                                                   (490 447 bytes); «Innsikt» and «Poeng til Canvas» on the
                                                                   activity page; mock Canvas picker (141 activities) and
                                                                   /app/play tabs Spel, Rediger, Innsikt, Poeng til Canvas;
                                                                   0 page errors
  $ npx vitest run -t <filter>, files/tests passed               AUTH-00 60/433 · LTI-00 111/547 · H5P-002|PROD-002 20/45 ·
                                                                   SEC-003|H5P-011|H5P-006 31/18721 · SEC-001 8/111 ·
                                                                   PROD-004|PROD-005|PROD-006|H5P-007 39/129 · UD-0 152/1125 ·
                                                                   PED-020 16/131 · PROD-003|UD-022 29/159 ·
                                                                   PROD-011|DATA-006|DATA-011 32/144 · PED-0 86/603 ·
                                                                   PROD-001|PROD-009 25/105 · PROD-007|PROD-013 83/3919 ·
                                                                   MAPPE- 37/296 · LTI-01 66/506 · INS-0 45/310 · DATA-0 125/625 ·
                                                                   NFR-00 29/136 · H5P-008|H5P-010 16/150            (C, D)
  $ npx vitest run -t "\[<ID>\]", tests passed                  S3: AUTH-001 77 · AUTH-002 81 · AUTH-003 229 · AUTH-004 17 ·
                                                                   AUTH-005 48 · LTI-001 101 · LTI-002 61 · LTI-003 117 ·
                                                                   LTI-004 47 · LTI-005 95 · LTI-006 90 · LTI-007 16 · PROD-004 18 ·
                                                                   PROD-005 8 · PROD-006 23 · H5P-007 80                (E)
                                                                 S4: PROD-003 156 · PROD-011 27 · NFR-003 1 · H5P-009 26 ·
                                                                   UD-001 126 · UD-002 7 · UD-003 72 · UD-004 5 · UD-005 3 ·
                                                                   UD-006 164 · UD-007 13 · UD-008 14 · UD-009 8 · UD-010 37 ·
                                                                   UD-011 62 · UD-012 7 · UD-013 134 · UD-020 274 · UD-021 218 ·
                                                                   UD-022 20 · UD-030 23 · UD-031 1 · PED-020 120 · DATA-006 63 ·
                                                                   DATA-011 58 · DOC-012 63                          (F, G)
                                                                 S5: PED-001 88 · PED-002 132 · PED-003 34 · PED-010 72 ·
                                                                   PED-011 12 · PED-030 105 · PED-031 32 · PED-032 21 ·
                                                                   PROD-001 86 · PROD-007 3706 · PROD-009 20 · MAPPE-001 68 ·
                                                                   MAPPE-002 145 · MAPPE-003 40 · MAPPE-004 51        (H)
                                                                 S6: PROD-013 216 · LTI-008 64 · LTI-010 127 · LTI-011 54 ·
                                                                   LTI-012 308 · LTI-013 19 · INS-001 34 · INS-002 24 ·
                                                                   INS-003 39 · INS-005 12 · INS-006 131 · INS-007 69 ·
                                                                   INS-008 21 · INS-009 23 · INS-010 10 · PROD-010 18 ·
                                                                   DATA-003 81 · DATA-004 85 · DATA-005 10 · DATA-007 27 ·
                                                                   DATA-008 67 · DATA-010 30 · DATA-012 89 · NFR-001 18 ·
                                                                   NFR-002 27 · NFR-006 30 · NFR-007 21 · H5P-010 10 ·
                                                                   SEC-006 39 · UD-040 45 · SEC-004 44 · H5P-008 145  (I, J)
                                                                 Not built, so no run: INS-004 (D-115), LTI-009 (a design
                                                                   note, D-101), PROD-014 (COULD)
  ```

  Open at the end of S6 (listed in section S6, the hand-off index and the IT assurance pack): the S6 commits have not
  run in GitHub CI, which runs only on `main` and on pull requests, and `docker.yml` has never run on GitHub (a pull
  request when the owner asks); the open questions above, Q31 new (a named system owner and maintainer at HVL); real
  Canvas and Feide (the live seam and `docs/handoff/canvas-acceptance.md`); the 200-learner load test and the restore
  drill on HVL's hardware; the manual assistive-technology run and the 56 verdicts (`UD-031`, `UD-040`); the DPO's
  review of the DPIA input; the light simplification check (carried to the pilot list); the upstream reports for the
  owner to file, the two security reports privately. The hourly restart task is switched off.
- **2026-11-06 · PR #18 and the assurance pack's method** — Pull request #18 (`ccr-07f63266-6cere5` → `main`) took
  the S6 commits to GitHub CI. Two faults showed; each was reproduced before its fix, and the same test then passed.
  (1) Before CI reached its tests, a local run of `tools/doc-lint/test/ciWorkflow.test.mjs` failed (`[5]` instead of
  `[6]`): after `cbfd859` marked S6 done, CI still checked traceability through S5. 3eeea8d raised the step to
  `--done-through=S6`, and its push cancelled CI run 75 (42165369085) and the first `docker.yml` run (42165369079).
  (2) CI run 76 (42166052880, job 127722909215, on `3eeea8d`) failed 1 of 27,933 tests in «Tests (unit and
  integration)»: GitHub's fresh runner has no `apps/server/.env`, so Node's `--env-file-if-exists` printed ".env not
  found. Continuing without it." twice before the purge CLI's one failure line
  (`apps/server/test/privacy/purge/purgeCliFailure.test.ts`, line 70). The local gate could not see it, because a
  developer `.env` exists here. Reproduced by moving `.env` aside (settings in the environment, no file), fixed in the
  test helper (`apps/server/test/support/serverCli.ts` drops that exact Node notice; the test's assertions unchanged),
  and passed with and without `.env` (8d4eaf0). On `8d4eaf0` the Session gate passed in CI run 77 (42170423046, job
  127736690226), 05:46:51–06:45:23 UTC, every step: 712 test files, 27,932 tests passed and 1 skipped of 27,933 (CI
  ran the 2 real-clamd tests and skipped the 1 test that runs only as root); e2e 22 files, 33 tests; the live seam
  against the mocks 36 tests; accessibility 18 files, 558 tests; `docs:api`, `spec:trace --done-through=S6` (126
  requirements), the spec site, the conformance report check and the boot check. `docker.yml` passed on GitHub for
  the first time in run 42166052745 (on `3eeea8d`) and again in run 42170423045 (on `8d4eaf0`, 05:46:51–05:51:07
  UTC). Pull request #18 has no review (GitHub's API, 2026-11-06) and is not merged. Then, at the owner's request of
  2026-11-06, the IT assurance pack gained `docs/assurance/how-it-was-built.md`: the plan, build, test, verify cycle;
  fixes as experiments (reproduce, fix, the same test passing; mutation and revert-run-restore checks); adversarial AI
  review with skeptics and fact-checkers; the session gates; and the local gate and GitHub CI compared, with their
  shared limit, that the same AI wrote the tests both run, and what people still need to review and test. The other
  documents of the pack were refreshed to `8d4eaf0` and this CI result (commit counts, the commits after `main`, the
  review state, the image size on GitHub's runner), and D-116's amendment of 2026-11-06 records the change. All of it
  was written and fact-checked by AI agents against the repository and GitHub's read-only API; no person has
  reviewed it. No app code, spec, test or CI file changed after `8d4eaf0`.
