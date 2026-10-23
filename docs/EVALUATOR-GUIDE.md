# Evaluator Guide

This guide is for people who review HVL Interaktiv without having built it: ALU learning
designers, TeCopp administrators, security and privacy reviewers, examiners and external code
reviewers. It explains how to check, efficiently and independently, that the code does what the
specifications promise.

**Current state (2026-10-22):** Session 1 is done. The monorepo, `apps/server` (configuration, log
redaction, learner pseudonyms, the database schema, the H5P configuration and boot check, the storage
adapters and the archive guard) and the tools `spec-trace`, `spec-site`, `doc-lint`, `dependency-check`,
`privacy` and `h5p-core` exist. There is no web app or HTTP server yet (Sessions 2–4). Build progress is
tracked in [PROGRESS.md](../PROGRESS.md). Commands marked *(from S<n>)* below arrive with that session.

---

## 1. Orientation in 20 minutes

Prefer a browser? `docs/site/index.html` holds the same documents as one searchable page, with a
requirement explorer. Regenerate it with `node tools/spec-site/buildSpecSite.mjs`.

| Minutes | Read | You will know |
|---|---|---|
| 3 | [README](../README.md) | What the service is and how the repository is organised |
| 7 | [Spec 00 §1–§4](specs/00-product-and-pedagogy.md) | Who it is for, the five user journeys, and the pedagogical principles |
| 3 | [GLOSSARY](GLOSSARY.md) | The Norwegian terms used in code and UI (*forarbeid*, *læringsutbytte*, …) |
| 4 | [DECISIONS](DECISIONS.md) | What was decided, including where the build deliberately departs from the original plan, and why |
| 3 | [TRACEABILITY](TRACEABILITY.md) | Which requirements are planned, in code or tested |

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

---

## 3. Commands *(available now unless a later session is noted)*

| Command | What it proves |
|---|---|
| `node tools/spec-trace/specTrace.mjs --check` | Specs are internally consistent; traceability is current |
| `node tools/spec-site/buildSpecSite.mjs --check` | The spec website matches the Markdown |
| `docker compose up -d` | PostgreSQL, Redis and an S3 emulator start locally (D-023); the mock OIDC/LTI platform joins in S3 |
| `npm ci && npm run db:generate --workspace apps/server && npm run typecheck` | The monorepo installs and compiles from a clean checkout; the Prisma client is generated, not committed (`npm run build` arrives with `apps/web` in S4) |
| `npm run typecheck && npm run lint` | Types and lint |
| `npm run doc:lint` | The Documentation Standard, checked by machine (`DOC-001`–`003`, `005`–`010`, `013`, `014`; `DOC-004` is `spec:trace`, `DOC-011` the commit-msg hook) |
| `npm run privacy:inventory-check` | The data inventory matches the database schema (`DATA-001`) |
| `npm run h5p:fetch-core && npm run boot-check --workspace apps/server` | H5P client files are the verified 1.28 release; the engine would start (`H5P-001`); needs no services or `.env` |
| `npm test` | Unit and integration tests (Vitest). Generate the Prisma client first (row above). Integration tests also need `docker compose up -d`, `npm run db:migrate` and `apps/server/.env` copied from `.env.example` (D-023) |
| `npm run test:e2e` *(from S3)* | Playwright journeys J1–J5 against the mock Canvas platform |
| `npm run test:a11y` *(from S4)* | axe-core on every route and inside each content type's iframe (`UD-030`) |
| `npm run spec:trace -- --check --done-through=S<n>` | Every MUST requirement up to session *n* has a test |
| `npm run check:filesize` | No source file over 200 lines (`DOC-007`) |
| `npm run check:audit` | No unreviewed high or critical advisory in production dependencies (`SEC-007`, D-029) |
| `npm run check:pins && npm run check:licences` | Exact pins; GPL-3.0-compatible licences (`SEC-007`, `NFR-005`) |
| `npm run docs:api` *(from S2)* | Browsable API documentation builds with no warnings (TypeDoc; `DOC-002`) |
| `npx vitest run -t "H5P-002\|PROD-002"` *(from S2)* | Only the ten types are creatable; DragQuestion is never offered |
| `npx vitest run -t "SEC-003\|H5P-011\|H5P-006"` *(from S2)* | Non-admins cannot install libraries; every library change is audited; the permission matrix |
| `npx vitest run -t "SEC-001"` *(from S2)* | The SVG corpus is neutralised and benign drawings render identically (needs Chromium) |
| `npm run seed:libraries` *(from S2)* | Installs the content types offline from the verified seed packages (`H5P-003`); needs the packages (Q7) |
| `NODE_USE_ENV_PROXY=1 npm run hub:check` *(from S2)* | Spike step 3: Hub registration status, the 15-character `local_id`, versions of the ten types |

---

## 4. Evaluation rubric

For each area: what *good* looks like, where to look, and the red flags that should fail a review.

### 4.1 Pedagogical fitness: does it help teachers help students learn asynchronously?
- **Good:** Teachers start from patterns (`PED-010`), not a blank list. Defaults are formative:
  retries on, no timers (`PROD-009`). Hints nudge towards short segments and explanatory feedback
  (`PED-020`). Insight answers "what should I address in the next session?" (`INS-002`, `INS-003`).
- **Look at:** `content/laeringsdesign/`, `apps/server/src/patterns/`,
  `apps/server/src/validation/rules/pedagogy/`, the `/laeringsdesign` and `/innsikt` pages.
- **Red flags:** Thresholds without a `PEDAGOGY:` reference. Hints that *block* publishing. Insight
  that ranks individual students. Pattern text that is not editable without code (`PED-011`).
- **Best evidence:** Pilot results against the success measures in spec 00 §8.

### 4.2 Accessibility (WCAG 2.2 AA and HVL house rules)
- **Good:** All colour comes from tokens, with a contrast test (`UD-001`). Feedback shows text and an
  icon (`UD-003`). Two-tone focus ring (`UD-004`). The validator blocks missing alt text and
  captions unless acknowledged (`UD-021`, `UD-022`). axe runs inside H5P iframes (`UD-030`). Manual
  screen-reader results are recorded (`UD-031`).
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
  matches the schema (`DATA-001`). Logs are redacted (`DATA-009`). No third-party requests (`DATA-011`).
- **Look at:** `docs/privacy/`, `apps/server/src/privacy/`, `apps/server/src/insight/`, `schema.prisma`.
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
| S3 | Mock-OIDC and mock-LTI integration tests pass, including the cookie-less iframe e2e; Deep Linking JWT is valid |
| S4 | axe shows zero serious/critical violations on routes and all ten iframes; contrast and validator tests pass |
| S5 | Pattern, planner and mappe tests pass; locale key parity holds for `nn`/`nb`/`en`; ALU content review recorded |
| S6 | Full `npm test`, `npm run lint`, `docker compose build`; AGS mock tests pass; conformance report and DPIA input exist |

---

## 6. Known limitations (stated honestly)

1. **Scores are computed in the browser.** H5P scoring cannot be made tamper-proof. HVL Interaktiv
   is for formative use only (`LTI-013`, `PROD-011`).
2. **Upstream accessibility.** Some barriers are inside H5P content types and can only be fixed
   upstream. The conformance report (`UD-040`) lists them with issue links.
3. **H5P Core 1.28 with Lumi 10.0.4 is only partly verified** (risk R-01). The S1 spike passed steps 1–2
   (Node 24 with core API 1.28; core and editor files verified file by file). In S2, Core 1.28 runs on our
   player page in Chromium with the F3 styles, the Daylight tokens are active and overridable, and state
   resumes after a reload, but only with a synthetic content type: hub-api.h5p.org is still unreachable
   from the build environment (Q7), so Hub registration, the real seed packages and rendering the real
   content types remain open, and so does the 1.28-or-1.27 decision (D-047).
4. **Institutional reference material is not yet in the repository** (see
   [reference/README.md](reference/README.md)). Labels, brand colours and portfolio headings are
   therefore kept in configuration, so they can be corrected without code changes.
5. **No listening server yet.** Session 2 builds the H5P routes (`createH5pRouter`) and tests them through
   Express with a test-only authenticator. The HTTP entry point, Feide and LTI authentication arrive in S3;
   the separate origin for user files, with signed URLs, in S3/S6 (D-045).
6. **Strict package versions.** An author's `.h5p` import is refused when any library differs from the
   installed one in its patch version (`SEC-003`, Q9), which will refuse many packages exported elsewhere.
