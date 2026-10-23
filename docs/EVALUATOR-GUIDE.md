# Evaluator Guide

This guide is for people who review HVL Interaktiv without having built it: ALU learning
designers, TeCopp administrators, security and privacy reviewers, examiners and external code
reviewers. It explains how to check, efficiently and independently, that the code does what the
specifications promise.

**Current state (2026-10-23):** Session 1 is done; Session 2 (the H5P engine with the ten types, the
permission system, learner state, upload security, seeding and our own routes) passed its gate on
2026-10-23, with spike steps 3–5 still open because the Hub is unreachable (limitation 3). Session 3 (dual
authentication) passed its gate on 2026-10-23 after an independent review and three verification passes; HVL's own
Feide and Canvas values are still open (Q3, Q4), so it runs against the mock platform. Session 1 built the monorepo,
`apps/server` (configuration, log redaction, learner pseudonyms, the database schema, the H5P configuration
and boot check, the storage adapters and the archive guard) and the tools `spec-trace`, `spec-site`,
`doc-lint`, `dependency-check`, `privacy` and `h5p-core`. Session 2 added the H5P routes. Session 3 made the
server a running service (`npm start`): Feide login for the portal, Canvas LTI 1.3 launches into the player
through ltijs 7, the Deep Linking picker, Canvas–Feide account linking, the sharing API, and the H5P routes
behind one `Principal`, all tested against the mock Feide and mock Canvas in `tools/mock-platform`
(limitation 5). There is no web app yet (Session 4): the LTI pages and the portal start page are plain
server-rendered pages (limitation 7). Build progress is tracked in [PROGRESS.md](../PROGRESS.md). Commands
marked *(from S<n>)* below arrive with that session.

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
| 2 | [TRACEABILITY](TRACEABILITY.md) | Which requirements are planned, in code or tested |

**To see it run** *(from S3)*: set up the services, the H5P files and `apps/server/.env` as for `npm start`
(§3; `.env.example` already holds the mock's values), start `npm run mock:platform` in one terminal and run
`npm start` in another. The mock Canvas home page (`http://127.0.0.1:4100/`) offers demo launches into
the tool, and the start page (`http://localhost:3000/`) offers Feide login against the mock Feide. There is no
editor before S4 and the seed packages are not in the repository yet (Q7, Q10), so a launch can only open an
activity that already exists in the database; the e2e tests (`npm run test:e2e`) create their own and show
the whole flows in a browser. Details: [tools/mock-platform/README.md](../tools/mock-platform/README.md).

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
| `docker compose up -d` | PostgreSQL, Redis and an S3 emulator start locally (D-023). The mock Feide and mock Canvas (`tools/mock-platform`) are not compose services: tests start them in-process, and `npm run mock:platform` runs them for manual use (D-049) |
| `npm ci && npm run db:generate --workspace apps/server && npm run typecheck` | The monorepo installs and compiles from a clean checkout; the Prisma client is generated, not committed (`npm run build` arrives with `apps/web` in S4) |
| `npm run typecheck && npm run lint` | Types and lint |
| `npm run doc:lint` | The Documentation Standard, checked by machine (`DOC-001`–`003`, `005`–`010`, `013`, `014`; `DOC-004` is `spec:trace`, `DOC-011` the commit-msg hook) |
| `npm run privacy:inventory-check` | The data inventory matches the database schema (`DATA-001`) |
| `npm run h5p:fetch-core && npm run boot-check --workspace apps/server` | H5P client files are the verified 1.28 release; the engine would start (`H5P-001`); needs no services or `.env` |
| `npm test` | Unit and integration tests (Vitest). Generate the Prisma client first (row above). Integration tests also need `docker compose up -d`, `npm run db:migrate` and `apps/server/.env` copied from `.env.example` (D-023); they start the mock Feide and mock Canvas themselves. Browser tests need full Chromium (`npx playwright-core install chromium`, never `--only-shell`, D-065) |
| `npm run mock:platform` *(from S3)* | A mock Canvas on `http://127.0.0.1:4100` and a mock Feide on `http://localhost:4200` start for a tool on `http://localhost:3000`, and the six `.env` lines that point the server at them are printed (D-049); Ctrl+C stops both. `.env.example` already holds these values for the fixed ports; paste the printed lines into `apps/server/.env` only after changing ports or IDs (the mock Feide refuses another client ID with `unauthorized_client`; [tools/mock-platform/README.md](../tools/mock-platform/README.md)) |
| `npm start` *(from S3)* | The server starts: tsx runs `apps/server/src/server/main.ts` (no build step), which syncs `LTI_PLATFORMS`, re-encrypts platform keys, starts the cleanup jobs and listens on `PORT`. With `npm run mock:platform` running, `curl http://localhost:3000/healthz` answers `{"status":"ok"}` and `/lti/keys` the tool's public keys. Needs the setup of `npm test` plus `npm run h5p:fetch-core`; a bad configuration exits with code 1 and names the variables, never their values (`NFR-002`) |
| `npm run test:e2e` *(from S3)* | Three Chromium flows against the whole server and the mock platform (D-065), in CI too: launch → play → answer → reopen in the cross-site Canvas iframe with third-party cookies blocked (checked by a canary), once with stock Chrome's partitioned frame storage and once with frame storage blocked (LTI Platform Storage), plus our error page when neither is available; the Deep Linking round trip, whose signed answer the mock Canvas accepts with a line item; portal Feide login, sharing with the CSRF token, and logout through Feide. The player plays a synthetic content type (limitation 3). Needs the setup of `npm test`. Journeys J1–J5 join in S6 |
| `npm run test:a11y` *(from S4)* | axe-core on every route and inside each content type's iframe (`UD-030`) |
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
   content types remain open, and so does the 1.28-or-1.27 decision (R-01, to be recorded as D-047). The S3
   end-to-end flows play a synthetic content type as well.
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
7. **Plain server-rendered pages until S4** (D-048). The Canvas player (`/lti/play`), the Deep Linking
   picker (`/lti/deeplink`), the friendly error pages and the portal start page (`/`) are unstyled pages
   rendered by the server; `apps/web` replaces them in S4. There is no editor page yet, the **Rediger** and
   **Innsikt** tabs come with the editor (S4) and insight (S6) (D-062), and no page offers sharing: it is an
   API call.
8. **The player pages have no script policy yet** (D-058 residual risk). H5P Core renders with inline
   scripts, so the CSP of the Canvas player (`/lti/play`) restricts only framing, `<base>`, plugins and form
   targets, and the portal player (`/h5p/play/:contentId`) restricts only framing; the script policy is S4's
   CSP work. Until then a script inside an activity could read the page's URL token (the ltik or the CSRF
   token in the H5P URLs) and send requests as that user. The S2 upload checks (`SEC-001`, `SEC-002`) and
   admin-only library installation (`SEC-003`) limit what an activity can carry.
9. **Tokens travel in some URLs, so proxies must not log query strings** (D-057, D-058). A launch reaches
   `/lti/play` and `/lti/deeplink` with the ltik in the query (a first-party script then removes it from the
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
13. **No build step.** `npm start` runs the TypeScript sources through tsx, a development dependency of the
    repository root, so the server cannot start from an install without development dependencies
    (`npm ci --omit=dev`), and every start compiles the sources in memory. How production builds and starts
    the server is decided with S6's Docker images.
14. **Two interim rules wait for the owner** (Q12). Student authors (through `AUTHOR_COURSE_GROUPS`) may share
    an activity only as `private` until a course visibility exists (D-059), and Feide users without a Feide
    ID, such as guests, cannot log in (D-054).
15. **Sharing changes visibility only; nothing can be published yet** (D-066, Q14).
    `PATCH /api/content/:contentId/sharing` changes who may see an activity, never its draft or published
    status. Publishing arrives with S4's publish flow and validator (`PROD-003`); since learners see only
    published activities (`PROD-004`), no new activity reaches learners before then.
