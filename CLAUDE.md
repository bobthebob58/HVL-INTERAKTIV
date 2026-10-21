# HVL Interaktiv — Project Memory and Engineering Harness

## 1. CRITICAL INVARIANTS (NEVER VIOLATE)

- **Runtime:** Node.js 24 LTS (ltijs 7 needs ≥ 24). TypeScript strict. Pin runtime dependencies exactly (no `^`).
- **H5P engine:** `@lumieducation/h5p-server@10.0.4` and `@lumieducation/h5p-express@10.0.5`. Set
  `coreApiVersion` to `{ major: 1, minor: 28 }`, Hub endpoints to `https://hub-api.h5p.org/v1/content-types/`
  and `https://hub-api.h5p.org/v1/sites`. Core from tag `1.28.0`; editor from the pinned commit in D-022.
  NEVER use `api.h5p.org` or track a moving H5P git branch.
- **Exactly ten authorable types:** CoursePresentation, InteractiveVideo, QuestionSet, InteractiveBook,
  Column, DragText, MultiChoice, Blanks, ImageHotspots, BranchingScenario. NEVER offer `H5P.DragQuestion`,
  not even as sub-content. Dependencies stay installable.
- **Security:** CVE-2025-7062 is UNPATCHED in h5p-server 10.0.4. Sanitise every SVG on BOTH upload paths, sniff
  magic bytes, serve user files from a separate origin with `CSP: sandbox` + `nosniff`. Only `admin` holds
  `GeneralPermission.*` (library install/update). NEVER use `LaissezFairePermissionSystem`.
- **LTI:** ltijs 7 `Provider` with our `PrismaLtiDatabaseManager`. The ltik travels as `Authorization: Bearer`,
  is kept in memory only, and is stripped from the URL and logs. An LTI launch NEVER grants `admin`.
- **Privacy:** learners are HMAC pseudonyms (`learnerKey`). NEVER store learner names, e-mails, Feide IDs, NIN
  or raw LTI `sub` (except encrypted in `GradeSyncJob`). Teachers see aggregates only; suppress groups < k (5).
  Logs contain no personal data or tokens.
- **WCAG 2.2 AA + HVL rules:** colours only from `packages/design-tokens` (HVL palette, contrast-tested; D-017). Feedback NEVER by
  colour alone: icon + text prefix (✓ Riktig: / ✗ Feil:). Two-tone focus ring (#004357 + white), never orange
  alone. Body text line-height ≥ 1.5, left-aligned, never justified, no ALL CAPS, underline only for links.
- **Formative only:** H5P scores are client-side. Label AGS scores formative. Never present them as exam evidence.
- **Language:** UI strings only via i18n in `nn` (default), `nb`, `en`. Code and comments in English;
  Norwegian domain terms keep their Norwegian form (see `docs/GLOSSARY.md`).
- **Documentation (docs/DOCUMENTATION-STANDARD.md):** every source file starts with a module header
  (What/Why/Spec/Invariants/Collaborators/Tests); every export has TSDoc; tag rationale with
  `WHY:` `SECURITY:` `PRIVACY:` `A11Y:` `PEDAGOGY:` `UPSTREAM:` `SPEC-DEVIATION:`; test titles start with `[REQ-ID]`.
- **File size:** ≤ 200 lines per source file, one responsibility, explicit names (no `utils.ts`).
- **Deviation:** if you must deviate from a spec, add a `docs/DECISIONS.md` entry first, then mark the code.

## 2. TECH STACK AND MONOREPO MAP

- `apps/server`: Express 5 + TypeScript, `@lumieducation/h5p-server`/`h5p-express`, `ltijs` 7,
  `openid-client` 6 (Feide), Prisma (PostgreSQL 16), Redis 7, S3-compatible storage (MinIO locally), pino.
- `apps/web`: Next.js (App Router) + React + TypeScript + Tailwind (token preset), `/laeringsdesign`,
  `/innsikt`, `/mappe`, `/app/*` (LTI views).
- `packages/design-tokens`: `tokens.json` → CSS variables + Tailwind preset, with a contrast test.
- `packages/hvl-h5p-theme`: `hvl-h5p-theme.css` + `xapiBridge.ts`, injected into H5P player and editor iframes.
- `content/`: ALU-editable YAML/MDX (phases, patterns, guide text, portfolio templates). No code.
- `tools/`: `spec-trace`, `doc-lint`, `seed`, `mock-platform` (mock OIDC + LTI platform for tests).
- `docs/specs/`: 00 product/pedagogy · 01 H5P/security · 02 auth/LTI/AGS · 03 WCAG/validator ·
  04 læringsdesign/mappe · 05 insight/privacy. **Load ONLY the specs named for the active session in PROGRESS.md.**

## 3. COMMANDS

- Build: `npm run build` · Typecheck: `npm run typecheck` · Lint and format: `npm run lint && npm run format:check`
- Test one file: `npx vitest run <path>` · Tests for one requirement: `npx vitest run -t "SEC-001"`
- Accessibility: `npm run test:a11y` · E2E: `npm run test:e2e`
- Traceability: `node tools/spec-trace/specTrace.mjs --check` (`npm run spec:trace` after S1)
- Spec website: `node tools/spec-site/buildSpecSite.mjs` (regenerate after any doc change; `--check` in CI)
- Local services: `docker compose up -d`

## 4. SESSION PROTOCOL

1. Read `PROGRESS.md`. Find the first session that is not done. Read ONLY the specs it lists.
2. Plan in Plan Mode. Keep to ONE milestone. Do not scaffold future sessions' features.
3. Implement in small files with headers and TSDoc as you go (not afterwards).
4. Run the session gate from `docs/EVALUATOR-GUIDE.md` §5 and paste its output into `PROGRESS.md`.
5. Regenerate `docs/TRACEABILITY.md`, update the `PROGRESS.md` checklist and log, then make a conventional commit with a `Refs:` footer.

Operational rules:
- **Two-strike debugging:** after two failed fixes for the same error, stop. Record the exact error
  in `PROGRESS.md`, and continue in a fresh context from a different angle.
- Compact the context at about 50 % use. Clear it when switching to an unrelated task.
- Let hooks or Husky run Prettier and ESLint. Do not spend output on manual formatting.
- Values marked *(verify)* in specs must be confirmed from `docs/reference/` or by the owner before you depend on them.

## 5. KNOWN TRAPS (verified 2026-10-16; details in docs/DECISIONS.md)

- Lumi h5p-server's DEFAULTS are Core 1.27 and `api.h5p.org`. Always build the config via `H5pConfigFactory`.
- There is no h5p-server 10.1.0. Do not "upgrade" to it. Fixing CVE-2025-7062 is our job (D-003).
- 10.0.4 vs the new Hub: `local_id` must be ≤ 15 chars (`getLocalIdOverride`), `/v1/sites` returns a non-200 2xx
  (pre-set `uuid`), and Core 1.28 theme CSS is missing from the asset lists (inject it). See spec 01 §1.
- Library installation is `GeneralPermission.*`, not `ContentPermission.*` (D-004).
- Most ltijs examples online are v5 (`lti.setup`, `ltiaas`, `lti.redirect`). Use the v7 API:
  `new Provider(...)`, `onResourceLink`, `onDeepLinking`, `context.redirect`,
  `context.deepLinking.createDeepLinkingForm`, `context.grading.submitScore` (D-005).
- `openid-client` 6 is ESM-only and functional (`discovery`, `authorizationCodeGrant`); v5 `Issuer`/`Client` examples do not apply.
- H5P sub-content is nested in `params` as `{ library: "H5P.Name 1.2", params, subContentId }`. Validator rules must walk it recursively.
- `#FF9E1B` (orange) is 2.07 : 1 on white. Never use it alone as a focus or state indicator (D-007).

## 6. WHERE THINGS ARE DOCUMENTED

- Why something was decided: `docs/DECISIONS.md` · Norwegian terms: `docs/GLOSSARY.md`
- How to document code: `docs/DOCUMENTATION-STANDARD.md` · How reviewers check it: `docs/EVALUATOR-GUIDE.md`
- Requirement → code → test: `docs/TRACEABILITY.md` (generated; never edit by hand)
- HVL inputs (brand, læringsdesign model, mappe criteria, Feide, Canvas, seed packages): `docs/reference/`
