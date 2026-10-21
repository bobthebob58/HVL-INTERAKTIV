# PROGRESS — cross-session state

This file is the single source of truth for build progress. **Every session starts by reading it
and ends by updating it** (see the session protocol in `CLAUDE.md`). It also lets evaluators see
what is done, what is verified, and what is blocked.

## Status overview

| Session | Milestone | Specs to load | Status |
|---|---|---|---|
| S0 | Specification, documentation standard, traceability tool | — | ✅ Done (2026-10-16) |
| S1 | Monorepo scaffold, DB schema, H5P Core 1.28 spike and setup | 00 §6; 01 §1–2, §4–7; 05 §2, §4–5; DOCUMENTATION-STANDARD | ⬜ Not started |
| S2 | Ten-type whitelist, seeding, SVG sanitiser, permission system, resume | 01 (all) | ⬜ Not started |
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

## S1 — Scaffold, schema, H5P core ⬜

Effort: start in Plan Mode. After planning, clear the context before executing.
- [ ] Spike (90 min time-box): spec 01 §7. Record the result for risk R-01 below and add a decision if needed
- [ ] npm workspaces: `apps/server`, `apps/web`, `packages/design-tokens`, `packages/hvl-h5p-theme`, `tools/*`
- [ ] Node 24 (`.nvmrc`, `engines`), TypeScript strict, ESLint + `eslint-plugin-jsdoc` + `eslint-plugin-i18next`, Prettier, Stylelint
- [ ] Husky or Claude Code hooks run lint and format on commit (no tokens spent on formatting)
- [ ] `npm run spec:trace`, `check:filesize`, `tools/doc-lint` (`DOC-001`, `DOC-004`, `DOC-007`, `NFR-004`)
- [ ] Prisma schema from spec 05 §4; `docs/privacy/DATA-INVENTORY.md` with its check (`DATA-001`)
- [ ] `deriveLearnerKey` (`DATA-002`); pino logger with redaction (`DATA-009`)
- [ ] `H5pConfigFactory` (`H5P-001`), storage adapters and cleanup job (`H5P-004`), size limits (`SEC-005`)
- [ ] i18n skeleton `nn`/`nb`/`en` with a key-parity test (`PROD-012`)
- [ ] `docker-compose.yml`: PostgreSQL 16, Redis 7, MinIO
- [ ] CI: typecheck, lint, test, audit (`SEC-007`), licence check (`NFR-005`)
- [ ] Gate: `npm run typecheck && npx vitest run && npm run spec:trace -- --check --done-through=S1`

## S2 — Content types and security ⬜

- [ ] `HvlTop10ContentTypeFilter` and the DragQuestion semantics filter (`H5P-002`, `PROD-002`)
- [ ] Seed script with SHA-256 verification (`H5P-003`). **Needs the `.h5p` files**: run `tools/seed/fetch-seed-packages.sh` where hub-api.h5p.org is reachable
- [ ] `PrismaContentUserDataStorage` (`H5P-005`, `PROD-008`); `HvlPermissionSystem` with a table test (`H5P-006`)
- [ ] `HvlTranslationCallback` (`H5P-008`); library update audit (`H5P-011`)
- [ ] `SvgSanitizer`, `FileTypeSniffer`, `ContentFileHeaders`, package import rules (`SEC-001`…`SEC-004`, `SEC-008`)
- [ ] Gate: as in the Evaluator Guide §5, S2

## S3 — Dual authentication ⬜

Effort: high, because this is security-critical. Public Feide and Canvas values are in `docs/reference/`; **HVL's own client IDs, realm, redirect URIs and TeCopp instance** are still needed (Q3, Q4).
- [ ] Mock OIDC provider and mock LTI platform in `tools/mock-platform/` for tests
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
- [ ] Purge, audit, data-subject requests, DPIA input (`DATA-003`…`DATA-008`, `DATA-010`); log redaction review (`NFR-006`)
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
| Q3 | Feide Customer Portal registration and redirect URIs | HVL IT | S3 |
| Q4 | Paste `docs/reference/canvas-lti13-developer-key.json` into HVL's test Canvas; report client ID, deployment ID, which instance TeCopp uses (test/beta/production), and whether `feide_login` arrives under `privacy_level` anonymous | TeCopp | S3 |
| Q5 | Hosting: HVL on-premises or Sikt, both in the EEA (`DATA-004`) | HVL IT | S6 |
| Q6 | Data protection officer confirms the legal basis and reviews DPIA input (`DATA-005`) | HVL DPO | S6, pilot |

## Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Lumi h5p-server 10.0.4 does not work with Core 1.28 libraries. Three issues are known (spec 01 §1, F1–F3), with workarounds; Lumi's fixes are unreleased | High | High | S1 spike with the workarounds; fall back to 1.27 without Daylight; `patch-package` only with a decision |
| R-07 | No H5P editor 1.28 release tag exists | Certain | Medium | Pinned, reviewed commit (D-022); revisit when a tag appears |
| R-02 | ltijs 7 is a recent rewrite with possible early bugs | Medium | Medium | Keep it behind `LtiProviderFactory`; contract tests; pin the exact version |
| R-03 | Canvas or Feide endpoint values differ from the spec | Medium | Medium | *(verify)* markers; reference items 4 and 5; integration tests against mocks first |
| R-04 | Hub registration at `hub-api.h5p.org/v1/sites` fails (HTTP 405 reports in 2026) | Medium | Low | Runtime does not depend on the Hub; offline seeding (`H5P-003`) |
| R-05 | A session runs out of usage quota mid-milestone | Medium | Low | One milestone per session; commit early; update this file before stopping |
| R-06 | Upstream H5P accessibility barriers | High | Medium | Theme fixes where possible; report upstream; document in `UD-040` |

## Session log

Append one entry per session: date, session, what was done, gate output, and any decisions added.

- **2026-10-16 · S0** — Specification written. Plan corrections recorded as D-001…D-007. Gate output above.
- **2026-10-21 · S0** — Licence confirmed (D-015). Reference inputs 1–6 assembled from public sources with citations and checked again (`docs/reference/`). Specs aligned: HVL brand palette and fonts (D-017, D-018), phase labels and model (D-019), merit portfolio (D-020), Feide logout (D-021), H5P editor pin (D-022), Canvas platform values. Spec website generator added (`tools/spec-site/`).
