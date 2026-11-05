# Threat model (STRIDE): draft for HVL IT

| | |
|---|---|
| **Status** | **Draft for HVL IT to correct.** Not approved by anyone. The risk levels are the author's estimates, not HVL's. |
| **Written by** | An AI agent (Claude), 2026-11-05, by reading the repository at commit `92ca2c5` and running read-only commands. The same AI wrote the code, the tests and every earlier review of them. |
| **Reviewed by** | Nobody. No person has reviewed this threat model, the code or the tests ([human-review.md](human-review.md)). A second AI pass (the same model) checked its claims against the repository on 2026-11-05 and corrected them; that is not a human review. |
| **For** | HVL IT operations and security staff, and whoever does the human security review before a pilot. |
| **Part of** | The IT assurance pack: start at [README.md](README.md). Components, boundaries and flows: [architecture.md](architecture.md). Likelihood and consequence scores: [ros-analyse.md](ros-analyse.md). What we ask for now: [test-environment.md](test-environment.md). Components list: [sbom.cdx.json](sbom.cdx.json). |

> **Read this first.** A "mitigation in place" below means that the repository holds code and a test that *claim*
> the control. It does not mean that a person has checked the code, or that the test proves what its title says.
> All of it was written and reviewed by the same AI, so it can share the same blind spots. Treat every row as a
> claim for a human to verify, and correct this document where the code says otherwise.

## In short

- The biggest risk is not one bug: **no person has reviewed the code**. The git history has 214 commits; 213 are by
  `Claude`, and the other is the owner's merge of pull request #8 (`git log --format='%an'`, 2026-11-05).
- **CVE-2025-7062 (stored XSS through uploads) is unpatched upstream** in `@lumieducation/h5p-server` 10.0.4 (D-003,
  D-112). The app has its own layered defence (section 6.4), but the editor's files are still served from the app
  origin (`SPEC-DEVIATION: D-110`).
- **Third-party H5P code runs for every learner on the app origin.** It is pinned and hash-checked, but not reviewed
  line by line (section 6.9).
- **Teacher insight hides groups under *k* = 5**, but differencing between views is subtle; the AI reviews found and
  fixed several leaks, and residuals R3, R4 and R6–R14 remain in the DPIA input (section 6.11).
- **Scores sent to Canvas can be forged by a determined learner.** This is accepted by design: they are formative
  only (D-008, `LTI-013`).
- For **stage 1** (made-up data only) most privacy threats have little real impact. What matters most then is that
  the server cannot reach anything else in HVL's network, and that its secrets are test-only (section 2.4).

## 1. How to read this document

**STRIDE** sorts threats into six kinds:

| Letter | Threat kind | The property it breaks |
|---|---|---|
| **S** | Spoofing: acting as someone or something else | Authentication |
| **T** | Tampering: changing data or code without the right to | Integrity |
| **R** | Repudiation: doing something and being able to deny it | Non-repudiation (audit) |
| **I** | Information disclosure: reading what one may not | Confidentiality |
| **D** | Denial of service: making the service unusable | Availability |
| **E** | Elevation of privilege: gaining rights one should not have | Authorisation |

**Evidence.** Paths that start with `src/` are under `apps/server/src/`; `test/`, `e2e/` and `a11y/` are under
`apps/server/`. `D-nnn` is a decision in [docs/DECISIONS.md](../DECISIONS.md). `R1`–`R40` are the residual risks in
[docs/privacy/DPIA-INPUT.md](../privacy/DPIA-INPUT.md) §12. `Q1`–`Q31` are the questions in
[PROGRESS.md](../../PROGRESS.md) (there is no Q11). A bracketed ID such as `[SEC-001]` is the requirement a test's title
names.

**Residual risk** is the author's estimate of what is left after the mitigation, for stage 2 (real students) unless
the row says otherwise: **Low**, **Medium** or **High**. It is not scored against HVL's ROS matrix; the ROS-analyse
does that ([ros-analyse.md](ros-analyse.md)).

**Suggested further measures** are proposals for IT and the owner. They are not decided. A change to the code needs a
decision in `docs/DECISIONS.md` first (CLAUDE.md §1, "Deviation").

## 2. Scope and assumptions

### 2.1 In scope

- The server process: Express 5, the Next.js web app inside it, the H5P player and editor (Lumi `h5p-server` 10.0.4
  behind our own routes), the LTI 1.3 tool (ltijs 7), the Feide login, the JSON API and the background jobs
  ([architecture.md](architecture.md) §1).
- The two host names it answers: the app origin (`PUBLIC_BASE_URL`) and the files origin (`FILES_BASE_URL`).
- The PDF export of the pedagogisk mappe (Chromium inside the container).
- The container image and compose file in `deploy/`, the CI workflows in `.github/workflows/`, and the build tools
  that fetch H5P code (`tools/h5p-core`, `tools/h5p-libraries`, `tools/h5p-bundle`).
- The operations commands HVL would run: backup and restore (`tools/ops`), the yearly purge and data-subject requests
  (`src/privacy/purge/`, `src/privacy/dsr/`), and the database roles script (`docs/ops/database-roles.md`).

### 2.2 Out of scope

- Canvas, Feide and the Feide Groups API themselves. They are trusted identity and platform providers; what happens
  if they fail or are misused is noted where it touches this app (T-16, T-24, T-63).
- HVL's network, reverse proxy, hosts, secret store, log store and backup storage. These are **(IT to fill in)**; this
  document states what the app assumes of them (section 2.3).
- Stage 0 (students on their own machines or in Codespaces with the mocks). It uses fixed test keys and made-up
  users and touches no HVL system (`.devcontainer/README.md`).
- Accessibility, pedagogy and the legal basis for processing. See `docs/accessibility/` and the DPIA input.
- The internals of Lumi, ltijs and H5P Core. They are used as they are; known defects are listed in D-112.

### 2.3 Assumptions (each one is something IT should confirm or correct)

| # | Assumption | Evidence |
|---|---|---|
| A1 | A reverse proxy terminates TLS for both host names, sets `X-Forwarded-Host` itself, passes `Host` on, and leaves the query string out of its access log. `TRUST_PROXY` matches the number of proxies | `docs/ops/runbook.md` §9 (lines 268-277); R26 |
| A2 | The server runs the image with `NODE_ENV=production` (the image's default), so every production start-up check applies | `docs/ops/docker.md:26`; `src/config/env.ts:161` |
| A3 | PostgreSQL, Redis, S3 and clamd are reachable only from the app (and from operators), never from the internet | **(IT to fill in)** |
| A4 | Secrets are random, held in a secret store, and readable only by the service and named operators | `docs/ops/runbook.md` §4; **(IT to fill in)** |
| A5 | The deployment checklist in runbook §9 is followed, including the container hardening in `deploy/compose.app.yml` | `docs/ops/runbook.md:252-289`; `docs/ops/docker.md` |
| A6 | One institution (HVL) uses the install. There is no separation between tenants | `CANVAS_ORIGINS`, `ALLOWED_FEIDE_ORGS` in `apps/server/.env.example` |
| A7 | In stage 1 only made-up data is entered, and only Feide test users and HVL's test Canvas are connected | [test-environment.md](test-environment.md) |

### 2.4 Stage 1 compared with stage 2

In **stage 1** the threats that need real people's data (insight re-identification, grade tampering, learner data
disclosure) have little impact, because the data is made up. The threats that still matter are those against **the
host and HVL's network** (a compromised server used as a foothold), against **the credentials HVL issues for the
test** (the Feide test client secret, the test Canvas developer key), and **malicious code** (H5P libraries, npm
packages, uploaded files) running in testers' browsers. In **stage 2** every threat in this document applies in full.

## 3. Assets

| ID | Asset | Where it lives | Why it matters | Evidence |
|---|---|---|---|---|
| AS1 | **Learner learning data**: xAPI statements under a pseudonym (`learnerKey`), scores, chosen options, gap answers (at most 100 characters each), saved progress that may hold typed free text | PostgreSQL `XapiStatement`, `H5PUserData` | Personal data about students' learning; free text can hold anything (R30) | `docs/privacy/DATA-INVENTORY.md`; DPIA §3; `DATA-012` |
| AS2 | **Learner identity links**: `Identity.subjectHash` (keyed HMAC), the raw LTI `sub` for 24 hours in launch records, and the encrypted Canvas `sub` in `GradeSyncJob` | PostgreSQL | Turn pseudonyms back into people | `src/privacy/deriveLearnerKey.ts`; `src/grades/GradeSubjectCleanupJob.ts:25`; D-052; R5 |
| AS3 | **Staff accounts and sessions**, including the `admin` role | Redis (sessions), PostgreSQL (`User`, display name) | Acting as a teacher or an admin | `src/auth/session/SessionStore.ts`; `src/auth/feide/FeideRoleMapper.ts` |
| AS4 | **Authored content and uploaded files**, including the content bank shared with HVL staff | PostgreSQL, S3 | Integrity of teaching material; uploads may hold personal data (R31, R38) | D-012; D-110 |
| AS5 | **Keys and secrets**: `PSEUDONYM_SECRETS`, `IDENTITY_HASH_KEYS`, `DATA_ENCRYPTION_KEYS`, `URL_SIGNING_KEYS`, `FEIDE_CLIENT_SECRET`, database, Redis and S3 credentials, and the LTI tool's private key | Secret store (environment variables); the tool key encrypted in PostgreSQL | Each one unlocks other assets | `apps/server/.env.example`; `docs/ops/runbook.md` §4 |
| AS6 | **Canvas grades** and the tool's access to Canvas's AGS and NRPS services | Canvas; the tool key | Wrong grades in Canvas; roster reads | D-104; `src/grades/AgsAccessTokens.ts` |
| AS7 | **Insight aggregates and the pedagogisk mappe** (*k*-suppressed) | Computed from AS1; snapshots in `InsightSnapshot` | Must not single out a learner | `INS-006`; D-106; `MAPPE-003` |
| AS8 | **Audit records**: `AuditEvent`, `AuthAuditEvent` (keyed IP hash), `LibraryAuditEvent` | PostgreSQL | Evidence of who did what | `apps/server/prisma/roles/02-grants.sql:36-38`; `DATA-007` |
| AS9 | **Installed H5P libraries**: JavaScript sent to every learner | The library volume, seeded from the bundle | Code that runs in every player page | D-041; D-078; `tools/h5p-bundle/README.md` |
| AS10 | **The host and its network position** | HVL's infrastructure **(IT to fill in)** | A compromised server can reach whatever its network allows | — |

## 4. Actors

| Actor | Legitimate access | What we fear | Evidence for the access |
|---|---|---|---|
| **Learner** (Feide or a Canvas launch) | Plays activities; sends xAPI statements about them; keeps saved progress | Forging scores, flooding, reading others' data, attacking other learners through shared content | `src/lti/LtiRoleMapper.ts`; `src/xapi/xapiRoutes.ts` |
| **Teacher or author** | Builds and uploads content; places it in Canvas; sees insight for their activities and courses. Authors are HVL staff (`employee`, `faculty`, `staff`), students in allow-listed course groups, and Canvas launches with an Instructor, TA, ContentDeveloper or institution Administrator role | Going beyond their own activities; re-identifying learners from insight | `src/auth/feide/FeideRoleMapper.ts:29,150-161`; `src/lti/LtiRoleMapper.ts:9-12`; D-059 |
| **Malicious content author** | Any author, as above, which includes every HVL employee who logs in with Feide | Stored XSS, phishing inside an activity, malicious files, exhausting storage | As above |
| **Admin** | Installs and updates H5P libraries. Only a Feide ID in `ADMIN_FEIDE_IDS` whose realm is in `ALLOWED_FEIDE_ORGS`; never through LTI. An admin sees no insight through the role | A compromised admin account installs code that runs for every learner | `src/auth/feide/FeideRoleMapper.ts:146-164`; `src/h5p/permissions/contentRules.ts:24-27,48-51`; `src/insight/http/insightAccess.ts:61` |
| **HVL operations** | Database, logs, secrets, the purge and data-subject CLIs | Insider misuse; mistakes that delete or leak data | `docs/privacy/DATA-INVENTORY.md`; `docs/ops/` |
| **Outside attacker** | None, or a Feide account from another organisation (logs in as `learner` when login is not restricted to HVL, R37) | Forged launches, session theft, exploiting upload handling, denial of service | `src/auth/feide/FeideRoleMapper.ts:146-148`; `docs/reference/feide-values.md:164` |
| **Compromised dependency** | Runs as part of the app or in learners' browsers: npm packages, the 120 H5P libraries from GitHub, Docker base images, GitHub Actions | Code execution on the server or in every player page; leaked build secrets | `package-lock.json`; `tools/h5p-libraries/libraries.manifest.json`; `deploy/Dockerfile:20-22` |
| **Canvas or Feide outage** (or misuse of either) | Upstream services the app depends on | Nobody can log in or launch; grades are delayed; a compromised platform forges identities | `src/auth/feide/feideGroups.ts:5-9`; `src/grades/gradeRetrySchedule.ts:6` |

## 5. Trust boundaries

TB1–TB9 are defined in [architecture.md](architecture.md) §4 and keep their numbers here. TB10 is added by this
document, and section 6.11 covers authorised users inside the app.

| # | Boundary | Section |
|---|---|---|
| TB1 | Browser to app origin | 6.1 |
| TB2 | Canvas frame (cross-site LTI launch) | 6.2 |
| TB3 | Feide login | 6.3 |
| TB4 | App host and files host; uploads into the H5P engine | 6.4 |
| TB5 | Reverse proxy to app | 6.5 |
| TB6 | App to internal services (PostgreSQL, Redis, S3, clamd) | 6.6 |
| TB7 | App to Canvas services (outbound AGS and NRPS) | 6.7 |
| TB8 | App to Chromium (PDF export) | 6.8 |
| TB9 | Third-party H5P code to learners' browsers | 6.9 |
| TB10 | Build and supply chain: npm, GitHub, Docker images, CI (added here) | 6.10 |
| — | Inside the app: authorised users who go too far (insight, grades, operators) | 6.11 |

## 6. Threats by trust boundary

### 6.1 TB1: browser to app origin

| ID | STRIDE | Threat | Mitigation in place (evidence) | Residual risk | Suggested further measure |
|---|---|---|---|---|---|
| T-01 | S, I | **Session theft**: someone gets a portal session cookie and acts as that person | Cookie `__Host-hvli_sid` with `Path=/; Secure; HttpOnly; SameSite=Lax` (`src/auth/session/sessionCookies.ts:25,33`); kept in Redis; ends after 2 hours idle or 12 hours in all (`src/auth/session/SessionStore.ts:36-38`); HSTS over https (`src/http/securityHeaders.ts:31`). Tests: `test/auth/session/SessionStore.int.test.ts`, `sessionCookies.test.ts` `[AUTH-003]` | **Low–Medium.** A stolen cookie works from any device until it ends. Script in the page cannot read it, but can act within the page (see T-03, T-30, T-80). Admin sessions live as long as others | A shorter absolute lifetime for `admin` sessions. IT: is multi-factor login required for staff in Feide? (section 9) |
| T-02 | T | **Cross-site request forgery** against the portal | A synchronizer CSRF token on every unsafe method, and on `/h5p/ajax` and `/h5p/contentUserData` for every method, compared in constant time (`src/auth/session/csrfToken.ts:32-34,109`); `SameSite=Lax`. Test: `test/auth/session/csrfToken.test.ts` `[AUTH-003]` | **Low.** Open: the insight GET routes refuse cross-site fetch metadata but serve a browser that sends none (Safari before 16.4), and such a request is audited and counted (`src/insight/http/insightRoutes.ts:29-31`; PROGRESS.md, S6 step 10, "Still open") | Put a token on insight GETs (changes D-057), or refuse requests without fetch metadata |
| T-03 | T, E, I | **Stored XSS in content parameters**: an author puts markup or script into a text field, which then runs for every learner of that activity | Lumi sanitises text fields by their semantics on save (the CVE-2025-47828 fix, covered by the 10.0.4 pin, spec 01 §1). We apply the same rules to list items and strip every tag from metadata (`src/h5p/semantics/lumiTextSanitizer.ts`; D-039). Player and editor pages: `script-src 'self'` plus hashes of Core's inline scripts, never `unsafe-inline` or `unsafe-eval`; `connect-src 'self'`, `form-action 'self'`, `object-src 'none'` (`src/http/h5pPageCsp.ts:80-96`; D-070). Tests: `test/h5p/semantics/SubContentPolicy.test.ts`, `test/http/contentSave.int.test.ts` `[SEC-008]`; `test/h5p/realTypes.browser.int.test.ts:95` (an injected inline script never runs) | **Medium.** H5P renders author parameters with jQuery (`src/http/h5pPageCsp.ts:5-6`), so markup that escaping misses lands in the page. The policy stops inline script, but not injected HTML or CSS (`style-src 'unsafe-inline'`), for example a misleading link. Any JavaScript served from the app origin runs (`'self'`), which is why T-30 and T-80 matter. Open: an author can put an absolute URL to our own origin in a media path (PROGRESS.md, S6 step 10, "Still open") | Human review of `src/h5p/semantics/` and `src/http/h5pPageCsp.ts`; refuse absolute media URLs at save time |
| T-04 | S | **Open redirect after login**, used for phishing | `returnTo` accepts only a path on this origin and refuses schemes, `//host`, backslashes and encoded tricks (`src/auth/returnTo.ts:1-15`). Test: `test/auth/returnTo.test.ts` `[AUTH-003]` | **Low** | — |
| T-05 | I | **Leaks through Referer headers or caches** | `Referrer-Policy: no-referrer` and `nosniff` on every response (`src/http/securityHeaders.ts:27,29`); LTI pages are `no-store` (`src/lti/http/ltiPageHeaders.ts:13`); API answers are `no-store` (`src/http/api/apiRouter.ts:73`) | **Low** | — |
| T-06 | I | **Debug surfaces in production**: API documentation, the Next.js development server with stack traces | `/api/docs` is mounted only when `NODE_ENV` is not `production` (`src/server/createApp.ts:20`); production refuses `WEB_APP=dev` (`src/config/productionChecks.ts`, header). Test: `test/config/productionChecks.test.ts` | **Low**, if A2 holds | IT: run stage 1 with `NODE_ENV=production` too, so the stage-1 install is tested as it will run |

### 6.2 TB2: Canvas frame (LTI 1.3 launch)

| ID | STRIDE | Threat | Mitigation in place (evidence) | Residual risk | Suggested further measure |
|---|---|---|---|---|---|
| T-10 | S | **Forged launch**: someone posts a made-up ID token to `/lti/launch` | ltijs 7.0.7 finds the platform by the token's issuer and audience, checks its RS256 signature against that platform's key set, refuses a token older than `LTI_TOKEN_MAX_AGE_SECONDS` and uses up its nonce (`node_modules/ltijs/services/launch/launch.service.js:185`, `services/oidc/oidc.service.js:38-44,189-219`, read 2026-11-05; `src/lti/LtiProviderFactory.ts`; D-050). We check the deployment ID, which ltijs does not, before an ltik is minted and on every ltik use (`src/lti/platforms/LtiDeploymentGuard.ts`; D-051), and refuse an ltik of a deactivated platform (`src/lti/ltikPrincipal.ts:92-96`). Tests: `test/lti/storage/LtiDeploymentGuard.int.test.ts` `[LTI-001]`, `test/lti/ltikPrincipal.int.test.ts` `[LTI-003]` | **Low** (code); the ltijs signature check itself has not been reviewed by a person | Human review of `src/lti/` (area A1 in [human-review.md](human-review.md) §4.1) |
| T-11 | S, R | **Replayed launch** | A nonce lives 10 minutes and is used up by one conditional `DELETE`, so it works once even under concurrency (`src/lti/storage/PrismaLtiDatabaseManager.ts:181-189`; D-052). Tests: `test/lti/ltiLaunch.int.test.ts:74` ("a replayed launch is refused") `[LTI-001]`, `test/lti/storage/PrismaLtiDatabaseManager.int.test.ts` | **Low** | — |
| T-12 | E | **A launch claims admin** | The role mapper is an allow-list that yields only `learner` or `author`; institution `Administrator` maps to `author` at most; `TestUser` (Canvas's Student View) is always `learner` (`src/lti/LtiRoleMapper.ts:8-16`; D-059). Test: `test/lti/LtiRoleMapper.test.ts` `[LTI-004]` | **Low** for admin. TAs, who may be student assistants, become authors and see insight (R36) | HVL decides whether TAs should author and read insight (R36, Q30) |
| T-13 | I, S | **ltik leakage**: the ltik is a bearer token, valid for 24 hours (GLOSSARY.md, «ltik») | Sent as `Authorization: Bearer`; accepted in the query only on five paths (`src/auth/requestPrincipal.ts:31-38`) plus `/app/play` (GLOSSARY.md); kept in page memory and removed from the address bar; logs redact it; responses are `no-store` and `no-referrer` (D-058, D-069). The deployment and platform checks run on every use (T-10). Tests: `test/auth/requestPrincipal.test.ts`, `test/logging/authRedaction.test.ts`, `e2e/ltiIframe.e2e.test.ts` `[LTI-003]` | **Medium.** Anyone holding a leaked ltik acts as that learner or author in that course for up to 24 hours. The reverse proxy's own access log would record query ltiks unless configured not to (R26, A1) | IT: confirm the proxy drops query strings (A1) before stage 1. Consider a shorter ltik lifetime (needs a decision; ltijs sets it) |
| T-14 | T | **Clickjacking** of LTI or portal pages | LTI pages: `frame-ancestors` lists only `CANVAS_ORIGINS`, plus `'self'` for `/lti/play` and `/lti/edit`, which our own `/app/play` frames (`src/lti/http/ltiPageHeaders.ts:10-12`). Portal pages: `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN` (`src/http/securityHeaders.ts:41-42`; D-070). Test: `test/lti/http/ltiPageHeaders.test.ts` | **Low** | — |
| T-15 | I | **ltijs's own defaults**: permissive CORS and a `process.exit` handler | ltijs runs on our router; `Provider.listen()` is never called; ESLint bans its Redis cache, HTTP handler and Mongo manager (`src/lti/http/ExpressRouterHttpHandler.ts`; `eslint.config.mjs:29`; D-050). Test: `test/lti/http/ExpressRouterHttpHandler.test.ts` | **Low.** `mongoose`, `mongodb` and `ioredis` are installed and loaded with ltijs but never connected (D-050) | Track ltijs advisories (section 9) |
| T-16 | S, E | **A compromised Canvas, or a Canvas administrator, forges launches** for any user and role | Out of the app's control: the platform is trusted by design. An LTI launch can never give `admin` (T-12); every launch must come from a configured deployment (T-10) | **Medium** (accepted by design): Canvas can act as any learner or author in its courses | TeCopp: limit who can create developer keys and change roles in Canvas (Q4) |

### 6.3 TB3: Feide login

| ID | STRIDE | Threat | Mitigation in place (evidence) | Residual risk | Suggested further measure |
|---|---|---|---|---|---|
| T-20 | S | **Login CSRF or a swapped authorisation code** | Authorization Code with PKCE `S256`, `state` and `nonce`; a single-use `__Host-hvli_login` cookie of 10 minutes ties them to the browser (`src/auth/feide/FeideClient.ts:102-106`; `src/auth/session/sessionCookies.ts:27,63`; D-057). The ID token's issuer, audience, nonce, expiry and signature are checked. Tests: `test/auth/feide/loginTransactions.int.test.ts`, `test/auth/feide/feideLogin.int.test.ts` `[AUTH-001]` | **Low.** Tested against a mock Feide only, never the real one (PROGRESS.md, S3) | Run a real Feide test login in stage 1 (Q3) |
| T-21 | E | **Escalation to admin** through Feide | `admin` only for a Feide ID listed in `ADMIN_FEIDE_IDS` whose realm is allowed and whose organisation group Feide confirms; if the Groups API fails, the login fails (`src/auth/feide/FeideRoleMapper.ts:146-164`; `src/auth/feide/feideGroups.ts:5-9`; D-054, D-059). Test: `test/auth/feide/FeideRoleMapper.test.ts` `[AUTH-002]` | **Medium** in impact, because an admin can install library code that runs for every learner (D-041). Whether admin accounts need a second factor is HVL's Feide setting **(IT to fill in)** | Keep `ADMIN_FEIDE_IDS` to one or two named people; require a second factor for them |
| T-22 | I | **Collecting more personal data than needed** | `userid-nin` is never requested; learner names and e-mails are dropped; a database `CHECK` keeps learner `User` rows without them (`src/auth/feide/feideClaims.ts`; D-054, D-090). Tests: `test/auth/feide/feideLogin.int.test.ts` `[AUTH-004]` | **Low.** The `email` scope is still requested and sits encrypted in the session for up to 12 hours (R29) | Drop the `email` scope (R29) |
| T-23 | S | **People from other organisations log in** | They get `learner` only (`src/auth/feide/FeideRoleMapper.ts:146-148`). Whether Feide restricts login to HVL is set at registration (`docs/reference/feide-values.md:164`) | **Medium** for stage 2 (R37: possibly school pupils); none for stage 1 if login is restricted | Restrict login to HVL in stage 1; decide for stage 2 (Q29) |
| T-24 | D | **Feide or the Groups API is down** | Login fails closed with a 503 page rather than guessing roles (`src/auth/feide/feideGroups.ts:5-9`) | **Low–Medium**: new logins wait for Feide. Existing sessions are in Redis and are read without calling Feide (D-057; author's reading of the session design) | — |

### 6.4 TB4: uploads, the files host and the H5P engine (CVE-2025-7062)

| ID | STRIDE | Threat | Mitigation in place (evidence) | Residual risk | Suggested further measure |
|---|---|---|---|---|---|
| T-30 | T, E, I | **Malicious upload: SVG or HTML with script** (CVE-2025-7062, unpatched in Lumi 10.0.4), aimed at other users' sessions or ltiks | Layered (D-003, D-044, D-045, D-110): (1) **magic-byte sniffing** refuses a file whose content does not match its extension, with polyglot checks for raster images (`src/security/FileTypeSniffer.ts`); (2) a **narrowed allow-list** with no HTML or JavaScript for content (`src/h5p/H5pConfigFactory.ts:36-37`); (3) **SVG sanitising on both upload paths**: our pre-check, Lumi's sanitiser, a stricter DOMPurify pass and a final check that fails closed (`src/security/SvgSanitizer.ts:1-21`); (4) **ClamAV that fails closed** (T-33); (5) every user file is served with `nosniff` and `Content-Security-Policy: sandbox; default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'`, and everything but raster images, audio, video and captions as an attachment (`src/security/ContentFileHeaders.ts:53-76,116-117`); (6) the player's files come from a **separate files host** whose router reads no cookie, session, ltik or `Authorization` header (`src/http/filesOriginRouter.ts:1-25`). Tests: `test/security/SvgSanitizer.test.ts`, `SvgSanitizer.bypass.test.ts`, `test/http/editorUpload.int.test.ts`, `test/http/packageImport.int.test.ts` `[SEC-001]`; `test/security/FileTypeSniffer.bypass.test.ts` `[SEC-002]`; `test/http/filesOrigin.int.test.ts`, `e2e/filesOrigin.e2e.test.ts` `[SEC-004]` | **Medium–High**, because the upstream bug is open and one missed path would give stored XSS: (a) the **editor's** files are still served from the app origin (`SPEC-DEVIATION: D-110`; `src/http/createH5pRouter.ts:58`); (b) the cookie-authenticated routes `/h5p/content/:id/*file` and `/h5p/temp-files/*file` remain on the app origin (`src/http/routes/fileRoutes.ts:1-12`; D-110, "Narrowing or retiring the cookie route itself stays open"); (c) `files.<host>` is the same *site* as the app (D-110, residual); (d) no person has reviewed `src/security/` | A **separate registrable domain** for files (HVL's choice, Q5); retire or narrow the cookie file routes; a human review of `src/security/` and `src/http/` (area A2 in [human-review.md](human-review.md) §4.1); follow the upstream fix (D-112) |
| T-31 | T, E | **An author's package carries modified library code** under an installed library's name | A non-admin's package may carry only libraries installed in exactly the same major, minor and patch version (`src/h5p/libraries/packageLibraryCheck.ts:1-12`); Hub installs are refused for everyone and the Hub is never called while serving (`src/h5p/offlineContentTypeCache.ts`; D-041); library changes are `GeneralPermission`, admin only (`src/h5p/permissions/contentRules.ts:48-51`; D-004); start-up fails if any Lumi component uses another permission system (`src/h5p/permissionSystemGuard.ts`). Tests: `test/http/packageImport.int.test.ts`, `test/h5p/HvlH5PEditor.upload.test.ts` `[SEC-003]`, `test/h5p/permissionSystemGuard.test.ts`, `test/h5p/permissions/generalAndTemporary.test.ts` `[H5P-006]` | **Low** for authors; see T-21 for admins | — |
| T-32 | I | **Reading another activity's files** | A file URL carries an HMAC-SHA256 grant for one activity, with a purpose key per kind (player, editor, upload) from `URL_SIGNING_KEYS`, issued only after a View or Edit check and checked in constant time (`src/h5p/contentFileGrants.ts:1-28`; D-058). Tests: `test/h5p/contentFileGrants.test.ts` `[H5P-007]`, `test/http/signedFiles.int.test.ts` `[SEC-004]` | **Low.** One grant opens every file of one activity for 12–13 hours (the issue time rounded up to the hour, plus 12 hours: `src/h5p/contentFileGrants.ts:20`) | — |
| T-33 | D, T | **Malware, zip bombs and oversized uploads** | 50 MB per file and 200 MB per package, enforced while streaming (`src/h5p/H5pConfigFactory.ts:31-34`; D-043); zip-slip, absolute paths, symbolic links, duplicate names and entry or size bombs refused before extraction (`src/security/zipEntryGuard.ts`); ClamAV: only a "clean" verdict stores a file; no verdict, an error or a time-out refuses it; at most 4 scans at once per server process (`src/security/malware/FailClosedMalwareScanner.ts:1-20,32`). Tests: `test/security/zipEntryGuard.test.ts`, `test/http/multipartUpload.test.ts` `[SEC-005]`; `test/security/malware/FailClosedMalwareScanner.test.ts`, `test/http/malwareScan.int.test.ts` `[SEC-006]` | **Medium.** Some files are answered "OK" by clamd without being fully unpacked, even with the required settings; reported to the owner outside the repository and **not closed** (D-110, `docs/DECISIONS.md:4106-4108`). A hung clamd blocks uploads (fails closed) | IT: clamd with daily signatures and `AlertExceedsMax yes`, `AlertEncrypted yes` (`docs/ops/clamav.md`); the owner shares the unclosed finding with IT privately |
| T-34 | D | **Parser loops in `image-size`** (GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr), pulled in by Lumi 10.0.4 | Sniffing refuses JXL, HEIF and ICNS before `image-size` runs; the audit exceptions **expire on 2027-01-31**, after which CI fails by design (`tools/dependency-check/audit-exceptions.json`; D-030) | **Low** until the expiry; then a choice is needed (D-112) | Treat 2027-01-31 as the end of stage 1 unless renewed by a reviewed decision |

### 6.5 TB5: reverse proxy to app

| ID | STRIDE | Threat | Mitigation in place (evidence) | Residual risk | Suggested further measure |
|---|---|---|---|---|---|
| T-40 | S | **A spoofed `Host` or `X-Forwarded-Host`** sends a request to the wrong router, or makes the app build URLs for another host | The app trusts forwarded headers only from `TRUST_PROXY` proxies (`src/server/createApp.ts:160-161`); production requires the files host to differ from the app host and to use https (`src/config/filesOrigin.ts`). The runbook asks the proxy to set `X-Forwarded-Host` itself (`docs/ops/runbook.md:274-277`) | **Medium** until the proxy is configured; depends on A1 | IT: confirm the proxy setup for both names before stage 1 |
| T-41 | I | **ltiks in the proxy's access log** | Outside the app (R26). The app's own request log records route patterns only, never the path or query (`src/http/requestLog.ts:1-15`). Test: `test/http/requestLog.int.test.ts` `[NFR-006]` | **Medium** until confirmed (A1) | IT: drop query strings from the proxy log |
| T-42 | I, T | **TLS downgrade or interception** | HSTS for one year when the public URL is https (`src/http/securityHeaders.ts:31`); production requires https for the public URL, Feide, Canvas and platform URLs (`src/config/productionChecks.ts`) | **Low**, given TLS 1.2 or later at the proxy **(IT to fill in)** | — |

### 6.6 TB6: app to internal services

| ID | STRIDE | Threat | Mitigation in place (evidence) | Residual risk | Suggested further measure |
|---|---|---|---|---|---|
| T-50 | I, T | **Clear-text connections** to PostgreSQL, Redis or S3 | Production refuses to start unless PostgreSQL uses `sslmode` `require`, `verify-ca` or `verify-full`, Redis uses `rediss://`, and S3 uses https (`src/config/connectionEncryption.ts`; D-109). Test: `test/config/connectionEncryption.test.ts` `[DATA-004]` | **Low** with `verify-full`; `require` does not check the server's certificate | Use `verify-full` (`docs/ops/runbook.md:259`) |
| T-51 | T, R | **A flaw in the app rewrites the schema or the audit trail** | Three database roles: the migrator owns the schema; the app role changes rows only and may only add and read audit rows (`apps/server/prisma/roles/02-grants.sql:36-38`; D-109). The only `$executeRawUnsafe` outside Prisma's generated client is the operators' roles command, which runs the repository's own SQL files from `prisma/roles/`, never input (`src/infra/databaseRolesCli.ts:75-92`); no `$queryRawUnsafe` is used (grep of `apps/server/src`, 2026-11-05). Tests: `test/db/databaseRoles.int.test.ts` `[DATA-010]`, `test/db/auditAppendOnly.test.ts` `[DATA-007]` | **Low**, if HVL's database administrator creates the roles as described (`docs/ops/database-roles.md`) | — |
| T-52 | I | **Data stored outside the EEA** | Production accepts AWS S3 only in listed EEA regions, or a custom endpoint under `hvl.no` or `sikt.no` (both lists marked *verify*); bucket ARNs and the AWS SDK's endpoint variables are refused (`src/config/storageResidency.ts:31-41`; D-109). Test: `test/config/storageResidency.test.ts` | **Medium**: the code checks a setting, not where a server stands (R24) | IT: confirm the locations of every store and backup |
| T-53 | I | **A database dump reveals keys, tokens or raw IDs** | AES-256-GCM with a per-purpose key from `DATA_ENCRYPTION_KEYS` for the LTI tool private keys, LTI access tokens, the session's Feide ID token and the grade jobs' Canvas `sub` (`src/security/keys/DataEncryption.ts`; D-056); pseudonyms are keyed HMACs (`src/privacy/deriveLearnerKey.ts`). Tests: `test/lti/storage/ltiSecretsAtRest.int.test.ts` `[LTI-002]`, `test/security/keys/DataEncryption.test.ts` | **Low** for a dump alone. **High** if the process or host is compromised: the keys are environment variables of the same process (`apps/server/.env.example`), so whoever controls the process can decrypt everything (author's assessment) | Limit who can read the process environment and the secret store (A4); see T-98 |
| T-54 | D | **Redis lost or unreachable** | Every portal user is logged out (`docs/ops/runbook.md:23`); the xAPI rate limit fails the request rather than skipping the limit (`src/xapi/XapiRateLimit.ts:17`); `/healthz` reports Redis and the database (`src/server/healthRoutes.ts:50-52`) | **Low** (availability only). `/healthz` does not check S3 or clamd | IT: monitor S3 and clamd separately |

### 6.7 TB7: app to Canvas services (grades and rosters)

| ID | STRIDE | Threat | Mitigation in place (evidence) | Residual risk | Suggested further measure |
|---|---|---|---|---|---|
| T-60 | I, T | **SSRF or exfiltration through `lineItemUrl`**: a launch names another host, and the grade worker sends its bearer token and the learner's `sub` there | The URL must parse, carry no user name or password, use https in production, and have an origin in `CANVAS_ORIGINS` or the platform's own; checked when the launch records it and again before each send; redirects are never followed; the roster (NRPS) URL follows the same rule (`src/grades/lineItemUrlPolicy.ts:1-18`; `src/grades/AgsAccessTokens.ts:14`; `src/lti/nrps/nrpsServiceUrl.ts:12-13`; D-104 amendment of 2026-11-04). Tests: `test/grades/lineItemUrlPolicy.test.ts`, `test/grades/gradeSyncRefusals.int.test.ts` `[LTI-012]` | **Low** | — |
| T-61 | T | **A learner forges a score** that is then sent to Canvas | Accepted by design: H5P scores in the browser (D-008, `LTI-013`). The server checks the sender before reading the body, accepts five verbs, keeps `0 ≤ raw ≤ max` and `scaled = raw/max`, takes the learner from the session or launch and never from the statement, and in Canvas accepts statements only about the launched activity (`src/xapi/xapiRoutes.ts:1-20`; `src/xapi/XapiIngest.ts:17`; `packages/api-contract/src/xapi.ts:16,36`). Scores are labelled formative (D-105). Tests: `test/xapi/xapiRouteAuth.int.test.ts`, `test/xapi/xapiLaunchScope.int.test.ts` `[LTI-011]` | **High likelihood, limited impact** as long as the scores are only formative. "Server checks in `LTI-011` reduce accidental and casual manipulation. They are not claimed to prevent deliberate manipulation" (`LTI-013`, `docs/specs/02-auth-feide-lti13.md:405-407`) | HVL and teachers must not use these scores as assessment evidence (exams stay in Wiseflow, D-008) |
| T-62 | S | **The tool's private key is stolen** and used to request Canvas tokens: writing scores and reading rosters within the developer key's scopes | The key is made by the server and kept encrypted in PostgreSQL (D-056); client assertions live 60 seconds; tokens and assertions are never logged (`src/grades/agsClientAssertion.ts`; D-104) | **Medium**: **replacing the key pair is not automated**; a suspected leak is an incident (`docs/ops/runbook.md:107-108`) | Write and test a key-replacement procedure with TeCopp before stage 2; give the developer key only the scopes it needs (Q4) |
| T-63 | D | **Canvas is down or slow** | Launches fail while Canvas cannot be reached. The grade worker retries up to 8 times within 24 hours, then marks the job failed; a new scored result reopens it (`src/grades/gradeRetrySchedule.ts:6`; `src/grades/gradeJobUpsert.ts:93`; D-104) | **Low** (grades are late, not lost, unless the learner never plays again) | — |

### 6.8 TB8: app to Chromium (PDF export of the pedagogisk mappe)

| ID | STRIDE | Threat | Mitigation in place (evidence) | Residual risk | Suggested further measure |
|---|---|---|---|---|---|
| T-70 | E, I | **Injected HTML in a mappe export** makes Chromium fetch internal URLs (SSRF) or exploit a browser bug | Each export runs in a fresh context with JavaScript off, `offline: true`, and every request aborted (`src/learningDesign/mappe/pdf/PdfRenderer.ts:106,119-120`; D-096). Chromium keeps its sandbox: Playwright's seccomp profile and `CAP_SYS_CHROOT` only; production refuses `PDF_ALLOW_NO_SANDBOX=true` (`docs/ops/docker.md:29-46`) | **Low–Medium.** Chromium's version is fixed by Playwright 1.56.1 but its hash is printed, not checked (`deploy/smoke/smokeChecks.sh`; D-110 P3 amendment); a Chromium vulnerability runs inside the app's container | If HVL's runtime refuses the profile or `SYS_CHROOT`, run the renderer in a container of its own rather than weakening the sandbox (`docs/ops/docker.md:44-46`) |
| T-71 | D | **Many exports exhaust memory** | At most `PDF_MAX_CONCURRENCY` (1–8, default 2) renders at once, each with a time limit (`src/config/env.ts:109`; `src/learningDesign/mappe/pdf/PdfRenderer.ts:104-106`) | **Low** | — |

### 6.9 TB9: third-party H5P code in learners' browsers

| ID | STRIDE | Threat | Mitigation in place (evidence) | Residual risk | Suggested further measure |
|---|---|---|---|---|---|
| T-80 | T, E, I | **Malicious or compromised H5P library code**: a changed upstream repository, or a library build that pulls a bad npm package, runs in every player page on the app origin, where it could act with the learner's ltik or session | 120 libraries are pinned to commits from the `h5p`, `otacke` and `falcon-git` organisations, and each fetch proves the commit (`tools/h5p-libraries/libraries.manifest.json`; D-078). H5P Core and editor client files are pinned to a tag or commit and compared with committed SHA-256 lists, again inside the image build (`tools/h5p-core/fetchCoreClients.sh`; D-022). The 23 libraries that need a build use `npm ci --ignore-scripts` with their own lockfiles in a minimal environment (`tools/h5p-libraries/README.md`). Only the seed and an admin's audited import change libraries; the Hub is never used (D-041) | **Medium–High** in impact. The libraries were pinned, not read line by line; their 23 build trees are outside our lockfile and the npm SBOM; three are untagged commits; the bundle's `SHA256SUMS` is not committed, so the packages are not reproducible across machines (`tools/h5p-bundle/README.md:21`) | Build the bundle only in HVL's or the project's CI; commit or sign its hash list; review the diff of every library update like code (D-041, "Consequences") |
| T-81 | I | **Build secrets baked into learner JavaScript**: `H5P.AudioRecorder` 1.0's build wrote the build machine's whole environment, tokens included, into JavaScript sent to learners | Libraries are now built with a minimal environment (`buildEnv` 3); the bundle refuses a text file holding a secret-named variable (`tools/h5p-bundle/README.md:17`; test `tools/h5p-bundle/test/bundleSecretGuard.test.mjs` `[NFR-007]`); the leaky builds were rebuilt and removed from the build machine (PROGRESS.md, S6 step 6; D-110; R39) | **Medium** until done: every package, library folder or library storage built **before** the fix, on any machine or CI cache, still carries that environment, and **the tokens that were in the old builds still need rotating** (owner, PROGRESS.md S6 step 6; D-110) | The owner confirms the rotation; HVL installs only bundles built after the fix, in CI |
| T-82 | I | **Panopto's embed script**, a third-party script without an integrity check | Allowed only when a Panopto site is configured in `EXTERNAL_MEDIA_ORIGINS`; YouTube is never allowed (`src/http/h5pPageCsp.ts:12-15`; D-070; R35). Tests: `test/http/h5pPageCsp.browser.int.test.ts`, `a11y/firstParty.a11y.test.ts` `[DATA-011]` | **Low–Medium**, only if configured | Leave Panopto off in stage 1 |

### 6.10 TB10: build and supply chain

| ID | STRIDE | Threat | Mitigation in place (evidence) | Residual risk | Suggested further measure |
|---|---|---|---|---|---|
| T-90 | T, E | **A compromised npm package** runs on the server or in the browser | Every manifest pins exact versions (`npm run check:pins`); `package-lock.json` has an `integrity` hash for each of its 950 registry packages, all from `registry.npmjs.org` (the only entries without one are our five workspaces and the five links to them; node one-liner, 2026-11-05); CI and the image use `npm ci`; CI fails on a high or critical advisory in the production dependencies (`npm audit --omit=dev`) without an unexpired exception (`tools/dependency-check/checkAudit.mjs:2,88`; D-030); Dependabot runs monthly, minor and patch only (`.github/dependabot.yml`). Tests: `tools/dependency-check/test/checkAudit.test.mjs`, `checkPins.test.mjs` `[SEC-007]` | **Medium.** Four lockfile packages have install scripts (`@prisma/engines`, `esbuild`, `prisma`, and the macOS-only `fsevents`); `allowScripts` lists the first three, but without `strict-allow-scripts` (npm's default is `false`; there is no `.npmrc`) an unlisted script runs with a notice instead of failing (`package.json:93-97`; the config definitions of npm 11.19.1, the npm on the build machine here). The image's `npm ci` runs install scripts (`deploy/Dockerfile:32`). Updates are monthly, not weekly as `SEC-007` says (the owner's choice) | Set `strict-allow-scripts=true` in a committed `.npmrc` (needs a decision and a test of `npm ci`); HVL decides who watches advisories between Dependabot runs |
| T-91 | T | **A changed base image or system package** in the container | Base images are pinned by digest (`deploy/Dockerfile:20,22`); H5P code enters the build as hash-checked build contexts, never fetched from GitHub during the build (D-110 P3 amendment) | **Medium.** Ubuntu packages (Chromium's libraries, fonts, `tini`) come from the archive without version pins, so the image is not byte-reproducible; Chromium's hash is not checked against a pinned value (D-110 P3 amendment) | Rebuild regularly from a reviewed commit and scan the image (HVL's scanner, **IT to fill in**) |
| T-92 | T, R | **No proof of where an image came from**: an image built from unreviewed or changed sources | CI runs with `permissions: contents: read` and `persist-credentials: false` (`.github/workflows/ci.yml`) | **Medium.** No workflow publishes or signs an image (grep of `.github/workflows/`, 2026-11-05); GitHub Actions are pinned by major tag, not commit SHA (`ci.yml:84-166`); CI service images other than ClamAV are tag-only (`ci.yml:34-53`); `docker.yml` is not on `origin/main` and has never run on GitHub (`git cat-file`, 2026-11-05; PROGRESS.md:743); the 14 commits after `origin/main` are pushed to the branch `ccr-07f63266-6cere5`, and CI runs only on pushes to `main` and on pull requests (`git rev-list origin/main..HEAD`; `ci.yml:9-12`), and no pull request is open for that branch, so none of them has run in GitHub CI: the branch's last CI run is pull request #8's, on `72e5516` (run 41066236672; GitHub's REST API, 2026-11-05; PROGRESS.md:843 says the live-seam CI step has not yet run there) | HVL builds the stage-1 image in its own pipeline from a named commit, records its digest and SBOM, and pins Actions by SHA |

### 6.11 Inside the app: authorised users who go too far

| ID | STRIDE | Threat | Mitigation in place (evidence) | Residual risk | Suggested further measure |
|---|---|---|---|---|---|
| T-100 | I | **Re-identifying a learner from insight**: small groups, differencing between views, periods or versions, complements, the CSV against the tab, the mappe against insight | Cells about fewer than *k* learners (default 5, never below 3) carry no value, with complementary suppression and additive groups; fixed periods that end at the last Oslo midnight; one course and one version per view; no per-learner endpoint; Canvas test students left out; views and downloads audited and rate-limited (60 a minute) (`src/insight/suppression/insightCells.ts`; `src/privacy/minimumGroupSize.ts:11,23`; `src/config/env.ts:106`; D-106 and its amendments). Tests: `test/insight/insightSuppression.property.test.ts`, `test/insight/http/insightSuppressionApi.property.test.ts` (fast-check), `test/insight/additiveGroupExhaustive.test.ts` `[INS-006]`; `test/insight/http/insightRateLimit.int.test.ts` `[INS-007]` | **Medium.** The AI reviews found and fixed several differencing leaks (PROGRESS.md, S6 step 4); what remains is documented as R3, R4, R6–R14 (for example R14: 7 started and 6 completed tells that one learner did not finish). Correctness rests on subtle reasoning no person has checked | A person tries their own differencing attacks before stage 2 ([docs/handoff/README.md](../handoff/README.md) §4); the DPO reviews R1–R40 (Q6) |
| T-101 | I | **Insight in courses one does not teach**: an owner or co-author sees aggregates for every course their activity is placed in; TAs (possibly students) see insight | Only the activity's owner and co-authors, and an LTI author of that course, see insight; admins see none (`src/insight/http/insightAccess.ts:61`; D-106). Test: `test/insight/http/insightPermissions.int.test.ts` `[INS-007]` | **Medium** (R2, R36). Grade-sync counts per course are not *k*-suppressed (R1) | HVL and the DPO decide (Q22, Q30) |
| T-102 | E | **An author edits or reads another author's activities or learners' saved state** | Anything not granted is denied; the permission matrix is tested by generated cases (`src/h5p/HvlPermissionSystem.ts`; `src/h5p/permissions/`; D-036, D-060). Tests: `test/h5p/permissions/contentMatrix.test.ts`, `userDataMatrix.test.ts` `[H5P-006]` | **Low** (code); the matrix and the code were written by the same AI | Human review of `src/h5p/permissions/` (area A6 in [human-review.md](human-review.md) §4.1) |
| T-103 | I, T | **Operator misuse or mistakes**: reading all learner rows, an erasure or purge run by mistake, identifiers left in a terminal | Operators see pseudonymous rows only (DATA-INVENTORY). The purge has a dry run and audits each run; `erase` is a dry run unless given `--confirm`; identifiers come on standard input; `export` refuses a terminal (`docs/ops/yearly-purge.md:38-46`; `docs/ops/data-subject-requests.md`; D-107, D-108). Tests: `test/privacy/purge/retentionPurge.int.test.ts` `[DATA-003]`, `test/privacy/dsr/dsrCli.int.test.ts` `[DATA-008]` | **Medium**: R21 (the operator's scrollback and files), R20 (an erasure killed with `SIGKILL` writes no audit event), R15 (the ended year stays linkable until its secret is destroyed). `MIN_GROUP_SIZE` can be set as low as 3 | Name the operators; log their database access **(IT to fill in)**; keep `MIN_GROUP_SIZE` at 5 |

## 7. Cross-cutting views

### 7.1 Denial of service

| ID | Threat | Mitigation in place (evidence) | Residual risk | Suggested further measure |
|---|---|---|---|---|
| T-110 | **xAPI flooding** by a learner or a script | The sender is checked before the body is read; a batch is at most 64 KiB and 50 items; 120 statements a minute per learner and activity, counted in Redis on every node; Redis down fails the request (`src/xapi/xapiRoutes.ts:7-15`; `src/xapi/XapiRateLimit.ts:1-17`; D-115). The grade queue is bounded per placement and learner (D-104 amendment). Tests: `test/xapi/xapiLimits.int.test.ts` `[LTI-011]`, `test/grades/gradeSyncFlood.int.test.ts` `[LTI-012]` | **Low** | — |
| T-111 | **Request floods on routes without a limit**: Feide login, LTI login and launch, editor uploads and saves | Rate limits exist for xAPI, insight, grade-sync retries, co-author search and copies (`src/xapi/XapiRateLimit.ts`, `src/insight/http/InsightRateLimit.ts`, `src/grades/status/GradeSyncRetryRateLimit.ts`, `src/learningDesign/collaboration/PeopleSearchRateLimit.ts`, `CopyRateLimit.ts`). **None was found under `src/auth/` or `src/lti/`, or on uploads and saves** (grep, 2026-11-05); no decision records this | **Medium** | A rate limit at the reverse proxy for `/auth/feide/*`, `/lti/*` and `/h5p/ajax` uploads **(IT to fill in)** |
| T-112 | **Expensive work**: scans, PDF renders, package imports | At most 4 clamd scans at once (T-33); at most `PDF_MAX_CONCURRENCY` renders (T-71); size limits while streaming (T-33) | **Low–Medium.** A hung clamd blocks all uploads (fails closed) | Monitor clamd (T-54) |
| T-113 | **Capacity**: the system has not been tested at its target load | A 20-learner smoke on one 4-CPU machine passed; the 200-learner test (`npm run load:full`) has not run and is left to HVL (`docs/ops/runbook.md:215-250`; `docs/handoff/README.md:77`) | **Unknown** | HVL runs `load:full` on a production-like node before stage 2 |

### 7.2 Data loss

| ID | Threat | Mitigation in place (evidence) | Residual risk | Suggested further measure |
|---|---|---|---|---|
| T-120 | **Loss of the database or the content bucket** (failure, ransomware, a mistaken command) | `npm run ops:backup` writes a `pg_dump`, every content object under its SHA-256, `MANIFEST.json` and `SHA256SUMS`, and keeps 30 days; the restore refuses a non-empty database or bucket and compares every count and hash (`docs/ops/runbook.md` §6; `tools/ops/`). Tests: `tools/ops/test/backupRoundTrip.test.mjs`, `backupRestoreChecks.test.mjs` `[NFR-002]` | **Medium** until HVL has an off-server encrypted copy in the EEA and has done a restore drill on its own hardware (runbook §6). The backup tools are not in the image (`deploy/Dockerfile.dockerignore:32-36`); they run from a repository checkout | IT: the backup target and the first restore drill **(IT to fill in)** |
| T-121 | **What the backup does not hold** | Not backed up by design: Redis (losing it logs everyone out), the temporary bucket, the H5P library volume (re-seeded from the bundle) (`docs/ops/runbook.md:23` and §6) | **Low** | Keep the bundle that was installed, so the libraries can be re-seeded exactly |
| T-122 | **Irreversible deletion** by the yearly purge or an erasure | Dry runs first; each run audited; `--confirm` for erasures (T-103) | **Low–Medium**: by design a purge cannot be undone except from backup within 30 days | — |
| T-123 | **Unreadable data after a key change**: removing a ring key too early | Three-step rotations with minimum waiting times (13 months, 31 days, 13 h 5 min); a job whose key is gone fails as `subject-unreadable` (`docs/ops/runbook.md:96-100`; D-055, D-056, D-058) | **Medium**: manual steps | Put each rotation in HVL's change process with the waiting time |

### 7.3 Secrets leakage

| ID | Threat | Mitigation in place (evidence) | Residual risk | Suggested further measure |
|---|---|---|---|---|
| T-130 | **Secrets or personal data in logs** | Redaction by key name at any depth (`authorization`, `cookie`, `ltik`, `id_token`, e-mail, name, `sub`, `feide*` and more); the request log has route patterns only; an inbound `X-Request-Id` is kept only if it is a UUID or 32 hex digits (`src/logging/redactPersonalData.ts:1-30`; `src/http/requestLog.ts:1-15`; D-109). Tests: `test/logging/logger.test.ts`, `test/logging/authRedaction.test.ts` `[DATA-009]` | **Low–Medium**: free-text names cannot be detected (`src/logging/logger.ts`); the proxy's log is outside the app (T-41) | Keep `DEBUG` without `h5p:*` (`docs/ops/clamav.md`) |
| T-131 | **Secrets in the image or the repository** | The image holds no secret; `.env*` files and `.git` are excluded from the build context (`docs/ops/docker.md:27`; `deploy/Dockerfile.dockerignore`). The development proxy CA is a BuildKit secret that never enters a layer (`deploy/Dockerfile:13-14,42-44`) | **Low.** Fixed test keys appear in `ci.yml` by design (`ci.yml:69-76`), and the root `docker-compose.yml` has a fixed development database password (`docker-compose.yml:2,17`); they must never be used outside tests (`docs/ops/runbook.md` §9) | Production refuses keys that decode to text or have too few distinct bytes (`src/config/productionChecks.ts:14-17`), which catches copied test keys |
| T-132 | **Secrets in learner JavaScript** | See T-81 (`H5P.AudioRecorder`) | See T-81 | See T-81 |
| T-133 | **A key reused across purposes**, so one leak exposes another | Production refuses a key used in two rings, or in a ring and the pseudonym secrets (`src/config/productionChecks.ts:18-19`) | **Low** | — |

## 8. Top 10 residual risks

Ranked by the author for stage 2. The "Stage 1" column says how much each matters for an isolated test with made-up
data. HVL's ROS-analyse should re-score them ([ros-analyse.md](ros-analyse.md)).

| # | Residual risk | Threats | Stage 1 | What would reduce it | Who |
|---|---|---|---|---|---|
| 1 | **No human has reviewed the code, the tests or this model.** One AI wrote and reviewed everything, so its blind spots are shared. Full test runs have found faults after the AI reviews had passed, for example the grade worker's claim bug (PROGRESS.md:517-521) and three faults under load at the S5 gate (PROGRESS.md:1273-1276) | All | Medium | A human security review of the priority list in [human-review.md](human-review.md), before stage 2 | HVL (reviewers), the owner |
| 2 | **CVE-2025-7062 is unpatched upstream**, and the editor's files and two cookie file routes are still on the app origin; the files host is the same site | T-30 | Medium (testers' sessions) | A separate registrable domain for files; retire the cookie routes; the upstream fix | IT (Q5), the owner (D-110, D-112) |
| 3 | **Third-party H5P code** (120 libraries, 23 built with npm) runs on the app origin in every player page; pinned and hashed, not reviewed; bundle hashes not committed; old builds leaked build secrets | T-80, T-81 | Medium | Build the bundle in CI only; commit or sign its hash list; review library diffs; confirm the token rotation | The owner, HVL |
| 4 | **Whole-process compromise exposes every key** (the keys are environment variables of the app); the LTI tool key cannot be replaced by a tested procedure | T-53, T-62 | **High** for HVL's network if the host is not isolated | Isolate the host (section 9, question 1); limit access to the environment; write the key-replacement procedure | IT, TeCopp |
| 5 | **Insight re-identification by differencing**: rests on subtle reasoning; residuals R3, R4, R6–R14 | T-100, T-101 | None (made-up data) | A person's own differencing attacks; the DPO's review (Q6) | Reviewers, the DPO |
| 6 | **Learners can forge formative scores** sent to Canvas | T-61 | None | Use only as formative; never as assessment evidence | HVL, teachers |
| 7 | **Build provenance**: no signed or published image; Actions pinned by tag; apt packages and Chromium not pinned; no GitHub CI run of the S6 work yet | T-90, T-91, T-92 | Medium | HVL builds the image itself from a named commit and records its digest and SBOM | IT, the owner |
| 8 | **The ltik is a 24-hour bearer token**, accepted in the query on a few paths, and the proxy may log it | T-13, T-41 | Low | Proxy without query logging; consider a shorter lifetime | IT |
| 9 | **Availability**: no rate limit on login, launch, uploads or saves; a hung clamd blocks uploads; `/healthz` misses S3 and clamd; the 200-learner test has not run | T-111, T-112, T-113, T-54 | Low | Proxy rate limits; monitoring of S3 and clamd; `load:full` | IT |
| 10 | **Controls that depend on manual operations**: three-step key rotations, destroying each year's pseudonym secret (R15), backups and the restore drill, deleting audit rows after 2 years (not built, R27), staff accounts never deleted (R28) | T-120, T-123, T-103 | Low | Put each step in HVL's routines with an owner and a date | IT, HVL operations |

## 9. Questions for IT

Each question names the threats it affects. Where PROGRESS.md already has a question, its number is given.

1. **Isolation (T-53, T-62, AS10; Q5).** Where would the stage-1 server run, and can it be kept from reaching the rest
   of HVL's network? Its outbound needs are listed in [architecture.md](architecture.md) §5.
2. **Container runtime (T-70; Q5).** Does HVL's runtime allow Playwright's seccomp profile and `CAP_SYS_CHROOT`? If
   not, the PDF export answers 503 or needs a renderer container of its own.
3. **Files host (T-30; Q5).** `files.<host>` under `hvl.no`, or a separate registrable domain?
4. **Reverse proxy (T-13, T-40, T-41, T-111).** Which proxy? Can it drop query strings from its access log, set
   `X-Forwarded-Host` itself, and rate-limit the login, launch and upload routes?
5. **Feide (T-21, T-23; Q3, Q29).** Is a second factor required for staff, and for the people in `ADMIN_FEIDE_IDS`?
   Will login be restricted to HVL?
6. **Canvas (T-16, T-62; Q4).** Which scopes will the test developer key have, and who can change it? Is there
   a routine for replacing the tool's key pair together with TeCopp?
7. **Secrets (T-53, T-123; A4).** Which secret store, who can read it, and how are the three-step rotations scheduled?
8. **clamd (T-33).** Who runs it, how are signatures updated, and are `AlertExceedsMax yes` and `AlertEncrypted yes`
   set? Do you want the owner's unclosed clamd finding (D-110) shared privately?
9. **Logging and monitoring (T-41, T-54, T-130).** Which log store and retention (`DATA-009` says 30 days), and who
   is alerted on `error` lines and failed purges (`docs/ops/runbook.md` §7)?
10. **Backups (T-120).** Which target, encryption and EEA location, and when is the first restore drill?
11. **Operators (T-103).** Who in HVL operations would have database access to this service, and is that access
    logged?
12. **Image (T-91, T-92).** Will HVL build the image in its own pipeline, and which image scanner does HVL use?
13. **Vulnerability handling (T-30, T-34, T-90).** Who is the security contact for `SECURITY.md` (a placeholder now,
    `SECURITY.md:43-44`), and who watches advisories for Lumi, ltijs and H5P? Is 2027-01-31 (the `image-size`
    exception) an acceptable end date for stage 1?
14. **Review (risk 1).** Who can do the human security review before stage 2? Do you want a penetration test of the
    stage-1 install?
15. **Method.** Should this model use HVL's own risk scale and template instead of Low, Medium and High?
16. **Accountability (risks 1, 7 and 10; Q31).** Who will be the system owner, who owns the stage-1 install and its
    list of testers, and who will be the maintainer that rebuilds the image and runs the manual steps?

## 10. Limits of this draft

- It was written in one session by reading the repository. **No test suite was run for it**, no penetration test was
  done, and no running install was attacked. The commands used were reads, greps, `git log`, `git rev-list` and
  `git cat-file`, and node one-liners over `package-lock.json` and the library manifest. The fact-check pass also read
  the installed ltijs source and ran `npm run sbom` and the SBOM tool's own tests (`tools/sbom/test/`).
- It covers what the repository shows. HVL's infrastructure is unknown, and its parts are marked **(IT to fill in)**.
- The internals of Lumi `h5p-server`, ltijs, H5P Core and the 120 libraries were not reviewed for this document.
- The ratings are one author's judgement and have not been calibrated against HVL's ROS method.
- The same AI wrote the code it describes here. Where this document and the code disagree, the code is right and this
  document needs fixing; please record corrections in the ROS-analyse or as an issue.
