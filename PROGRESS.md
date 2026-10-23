# PROGRESS — cross-session state

This file is the single source of truth for build progress. **Every session starts by reading it
and ends by updating it** (see the session protocol in `CLAUDE.md`). It also lets evaluators see
what is done, what is verified, and what is blocked.

## Status overview

| Session | Milestone | Specs to load | Status |
|---|---|---|---|
| S0 | Specification, documentation standard, traceability tool | — | ✅ Done (2026-10-16) |
| S1 | Monorepo scaffold, DB schema, H5P Core 1.28 spike and setup | 00 §6; 01 §1–2, §4–7; 05 §2, §4–5; DOCUMENTATION-STANDARD | ✅ Done (2026-10-21) |
| S2 | Ten-type whitelist, seeding, SVG sanitiser, permission system, resume | 01 (all); 00 `PROD-002`, `PROD-008` | 🟨 In progress (2026-10-22) |
| S3 | Feide OIDC + LTI 1.3 (ltijs 7) dual authentication, Deep Linking | 02 §1–4, §7 | ⬜ Not started |
| S4 | Design tokens, HVL H5P theme, WCAG 2.2 verification, pre-publish validator | 03; 04 §5; 05 `DATA-006`, `DATA-011` | ⬜ Not started |
| S5 | Læringsdesign studio, patterns, planner, pedagogisk mappe export | 04 | ⬜ Not started |
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
| 4. Render `H5P.MultiChoice` in the player | ⛔ Real package blocked by step 3. S2: a synthetic content type runs on our player page in Chromium with Core 1.28, no console errors, and resumes after a reload (`player.browser.int.test.ts`) |
| 5. Daylight theme with the F3 CSS | ✅ with the synthetic type (S2): the F3 styles load, `--h5p-theme-*` tokens are active, and a later stylesheet overrides them. To repeat with real content types |
| 6. Decide 1.28 or the 1.27 fallback | Stay on 1.28 for now: nothing found so far contradicts it. Decide after steps 3–5 in S2 |

Gate output: see the session log entry for 2026-10-22 · S1 review (the 2026-10-21 entry is the first run).

## S2 — Content types and security 🟨

- [ ] Finish the spike (spec 01 §7 steps 3–5) where hub-api.h5p.org is reachable, and decide R-01 (D-047).
      **Still blocked (Q7):** on 2026-10-23 the egress proxy refused hub-api.h5p.org (`CONNECT tunnel failed,
      response 403`; `npm run hub:check` reports `fetch failed: Request was cancelled.`). Done without the
      Hub: F3 injected and tested; a Chromium test runs Core 1.28 on our player page with no console errors,
      the Daylight tokens active and overridable, and state resumed after a reload (synthetic content type)
- [x] F1 wired: `getLocalIdOverride: () => localIdFor(config.uuid)` in `H5pEditorFactory`; the Hub
      registration payload is tested to carry 15 characters (D-031)
- [x] Package import over `ajax?action=library-upload`: `inspectZip` before Lumi, the upload in a fresh
      `mkdtemp` folder that is always removed (`SEC-005`, D-031, D-043). Own Express 5 routes replace
      h5p-express (D-035)
- [x] Decisions D-035…D-046 recorded (plan approved 2026-10-22); D-047 waits for the spike
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
- [ ] Independent review and its fixes
- [ ] Gate: as in the Evaluator Guide §5, S2

## S3 — Dual authentication ⬜

Effort: high, because this is security-critical. Public Feide and Canvas values are in `docs/reference/`; **HVL's own client IDs, realm, redirect URIs and TeCopp instance** are still needed (Q3, Q4).
- [ ] Mock OIDC provider and mock LTI platform in `tools/mock-platform/` for tests
- [ ] Define the stable HMAC key for `Identity.subjectHash` and `AuthAuditEvent.ipHash` (env.ts,
      `.env.example`, DATA-INVENTORY "Pseudonymous (stable key)"), including its rotation
- [ ] Feide RP, role mapping, sessions, data minimisation, author linking (`AUTH-001`…`AUTH-005`)
- [ ] `LtiProviderFactory`, `PrismaLtiDatabaseManager`, ltik transport, role mapping (`LTI-001`…`LTI-004`)
- [ ] Deep Linking picker, resource-link launch, course copy (`LTI-005`…`LTI-007`, `PROD-005`); `HvlUrlGenerator` (`H5P-007`)
- [ ] Draft/published visibility, Feide sharing (`PROD-004`, `PROD-006`)
- [ ] Gate: as in the Evaluator Guide §5, S3

## S4 — Universal design ⬜

Brand tokens follow HVL's manual (D-017); HVL (profil@hvl.no) must still confirm the values and supply logo files.
- [ ] `packages/design-tokens` with the contrast test and lint rules (`UD-001`)
- [ ] Web shell components and `hvl-h5p-theme.css` (`UD-002`…`UD-013`, `H5P-009`)
- [ ] Validator engine, UD rules and pedagogical hint rules (`UD-020`…`UD-022`, `PED-020`)
- [ ] Publish flow with acknowledgements (`PROD-003`); formative notice (`PROD-011`); privacy notice (`DATA-006`)
- [ ] CSP that blocks third-party requests; self-hosted fonts (`DATA-011`); browser and assistive-technology matrix (`NFR-003`)
- [ ] axe suite (`UD-030`); manual protocol document (`UD-031`)
- [ ] Gate: as in the Evaluator Guide §5, S4

## S5 — Læringsdesign studio ⬜

Start from `docs/reference/proposals/phases.yaml` and `proposals/mappe-template.nn.md`; ALU must confirm labels, criteria and limits.
- [ ] Studio routes and guide content (`PED-001`…`PED-003`); patterns and skeletons (`PED-010`, `PED-011`, `PROD-001`, `PROD-009`)
- [ ] Metadata, planner, learner time estimate (`PED-030`…`PED-032`); co-authoring and content bank (`PROD-007`); versioning (`PROD-013`)
- [ ] Mappe export in Markdown and tagged PDF (`MAPPE-001`…`MAPPE-004`)
- [ ] Pilot evaluators from ALU and Pedagogisk akademi review the studio content (record the outcome here)
- [ ] Gate: as in the Evaluator Guide §5, S5

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
| Q3 | Feide Customer Portal registration and redirect URIs | HVL IT | S3 |
| Q4 | Paste `docs/reference/canvas-lti13-developer-key.json` into HVL's test Canvas; report client ID, deployment ID, which instance TeCopp uses (test/beta/production), and whether `feide_login` arrives under `privacy_level` anonymous | TeCopp | S3 |
| Q5 | Hosting: HVL on-premises or Sikt, both in the EEA (`DATA-004`) | HVL IT | S6 |
| Q6 | Data protection officer confirms the legal basis and reviews DPIA input (`DATA-005`) | HVL DPO | S6, pilot |

## Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Lumi h5p-server 10.0.4 does not work with Core 1.28 libraries. Three issues are known (spec 01 §1, F1–F3), with workarounds; Lumi's fixes are unreleased. S1 spike steps 1–2 passed; 3–5 are blocked by the network | High | High | Finish the spike in S2 where the Hub is reachable; fall back to 1.27 without Daylight; `patch-package` only with a decision |
| R-07 | No H5P editor 1.28 release tag exists | Certain | Medium | Pinned, reviewed commit (D-022); revisit when a tag appears |
| R-02 | ltijs 7 is a recent rewrite with possible early bugs | Medium | Medium | Keep it behind `LtiProviderFactory`; contract tests; pin the exact version |
| R-03 | Canvas or Feide endpoint values differ from the spec | Medium | Medium | *(verify)* markers; reference items 4 and 5; integration tests against mocks first |
| R-04 | Hub registration at `hub-api.h5p.org/v1/sites` fails (HTTP 405 reports in 2026) | Medium | Low | Runtime does not depend on the Hub; offline seeding (`H5P-003`) |
| R-05 | A session runs out of usage quota mid-milestone | Medium | Low | One milestone per session; commit early; update this file before stopping |
| R-06 | Upstream H5P accessibility barriers | High | Medium | Theme fixes where possible; report upstream; document in `UD-040` |
| R-08 | `image-size` (via h5p-server) has two unfixed DoS advisories; accepted until 2027-01-31 (D-030) | Low | Medium | Only reachable through authenticated uploads; `SEC-002` sniffing in S2; `check:audit` fails at expiry |

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

