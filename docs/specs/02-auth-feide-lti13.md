# Spec 02 — Identity: Feide OIDC Portal, Canvas LTI 1.3 Advantage and the Grade Bridge

| | |
|---|---|
| **Status** | Approved for build (v1.0, 2026-10-16) |
| **Load in sessions** | S3: §1–§4, §7 · S6: §5–§7 (NRPS, grade bridge, data) |
| **Owns requirement IDs** | `AUTH-*`, `LTI-*` |
| **Code location** | `apps/server/src/auth/`, `apps/server/src/lti/`, `apps/server/src/grades/`, `apps/web/src/lib/session/` |

---

## 1. Verified facts this spec relies on (checked 2026-10-16)

| Fact | Value | Consequence |
|---|---|---|
| Latest `ltijs` | **7.0.7**, Apache-2.0. A full TypeScript rewrite with a `Provider` class (`onResourceLink`, `onDeepLinking`, `LaunchContext`). | The v5 API in the plan (`lti.setup(…, { ltiaas: true })`, `lti.redirect`, `lti.DeepLinking…`) is obsolete. Use v7. (D-005) |
| ltijs 7 engine requirement | `node >= 24` | The runtime is **Node.js 24 LTS**, not 22. (D-001) |
| ltijs 7 storage | Pluggable `DatabaseManager` interface with 14 methods. Ships only MongoDB implementations. Redis cache via `RedisCacheManager`. | We write `PrismaLtiDatabaseManager` for PostgreSQL rather than add MongoDB. `ltijs-postgresql` and `ltijs-sequelize` target v5 and have not been updated since 2022. (D-005) |
| ltijs 7 launch tokens | Each launch yields a signed **ltik** (24 h lifetime). `LaunchContext.redirect()` appends it to the URL. `Provider.getLaunchContext(ltik)` resumes the launch. No session cookie is needed. | This solves the third-party-cookie problem in Canvas iframes by design. |
| ltijs 7 services on `LaunchContext` | `deepLinking.createDeepLinkingForm(items, options)`, `grading.submitScore(lineItemId, score)`, Names & Roles, Dynamic Registration | These are the APIs used below. |
| `openid-client` | **6.x** (ESM-only, functional API: `discovery()`, `buildAuthorizationUrl()`, `authorizationCodeGrant()`) | Older `Issuer`/`Client` class examples do not apply. |
| Canvas platform values (checked 2026-10-21) | `iss` `https://canvas.instructure.com`; OIDC auth `https://sso.canvaslms.com/api/lti/authorize_redirect`; JWKS `https://sso.canvaslms.com/api/lti/security/jwks`; token `https://sso.canvaslms.com/login/oauth2/token` (or `https://<institution-domain>/login/oauth2/token`); `privacy_level` values `anonymous`, `name_only`, `email_only`, `public` | Recorded with Canvas doc and source citations in [`docs/reference/canvas-platform-values.md`](../reference/canvas-platform-values.md); paste-ready key in [`canvas-lti13-developer-key.json`](../reference/canvas-lti13-developer-key.json). |
| Feide OIDC provider (checked 2026-10-16) | Issuer `https://auth.dataporten.no`; endpoints `/oauth/authorization`, `/oauth/token`, `/openid/userinfo`, `/openid/jwks`, `/openid/endsession`; PKCE `S256`; ID tokens `RS256`; Groups API `https://groups-api.dataporten.no/groups` | Recorded with evidence in [`docs/reference/feide-oidc-config.example.json`](../reference/feide-oidc-config.example.json) and [`feide-values.md`](../reference/feide-values.md). Assembled from Feide's documentation and public code; HVL's own client values still come from the Customer Portal. |

Values still marked *(verify)* below must be confirmed from HVL's own exports (Feide Customer Portal,
Canvas Developer Key) or with TeCopp before Session 3 writes code that depends on them. Public values are
recorded with evidence in `docs/reference/` ([reference README](../reference/README.md)).

---

## 2. Two ways in, one identity model

```
                    ┌────────────────────── interaktiv.hvl.no (one public origin) ──────────────────────┐
 Browser (top-level)│  /            → apps/web  (Next.js App Router)                                    │
  Feide portal      │  /api, /h5p   → apps/server (Express)          principal = Feide session (cookie)  │
                    │  /auth/feide/* → OIDC RP (openid-client)                                           │
                    │                                                                                    │
 Canvas iframe      │  /lti/login, /lti/launch, /lti/keys → ltijs Provider                               │
  (3rd-party ctx)   │  → redirect to /app/…?ltik=…  → web stores ltik in memory → Authorization: Bearer   │
                    └────────────────────────────────────────────────────────────────────────────────────┘
 files.interaktiv.hvl.no  → user-uploaded H5P content files only (SEC-004), no cookies, no ltik
```

Both entry points resolve to a single server-side **`Principal`**:

```ts
/** What every API handler receives after authentication. Defined in apps/server/src/auth/Principal.ts */
interface Principal {
  userId: string;              // internal UUID; learners have pseudonymous User rows too (D-034, D-053)
  learnerKey: string;          // HMAC pseudonym (DATA-002), always present
  roles: Array<'learner' | 'author' | 'admin'>;   // the H5P role is the highest of them
  mode: 'portal' | 'lti';
  locale: 'nn' | 'nb' | 'en';
  hvlMember: boolean;          // portal: Feide organisation in ALLOWED_FEIDE_ORGS; LTI: false
  feideAuthenticated: boolean; // portal only
  studentAuthor: boolean;      // a student allowed to author through AUTHOR_COURSE_GROUPS (D-059)
  lti?: { platformId: string; deploymentId: string; contextId: string; resourceLinkId?: string;
          contentId?: string; lineItemUrl?: string; messageType: string };
}
```

*Amended in S3 (D-053):* `userId` is always set, and the principal carries the facts the permission system
reads (D-036). `auth/principalToH5pActor.ts` maps it to the H5P actor.

Putting web and API on one origin behind a reverse proxy avoids CORS and keeps the portal session
cookie first-party.

---

## 3. Requirements — Feide portal (standalone access)

#### AUTH-001 · MUST · S3 · Feide OpenID Connect login (Authorization Code + PKCE)
The server is a confidential OIDC relying party, registered in the Feide Customer Portal
(kunde.feide.no) under HVL (realm `hvl.no` *(verify realm)*). It uses `openid-client` 6 with discovery
from issuer `https://auth.dataporten.no` (document `/.well-known/openid-configuration`), plus PKCE
(`S256`), `state` and `nonce`. ID tokens are `RS256`-signed. Scopes:
`openid profile email userid-feide groups-org groups-edu`. All six are valid Feide scope (attribute-group)
names. **Always send the scope list explicitly**: a request with `openid` alone releases every attribute
group configured for the client. In the Customer Portal, authorise only the attribute groups
`userinfo-name`, `email`, `userid-feide`, `groups-org` and `groups-edu`; never `userinfo-photo` or `userid-nin`.
- **Acceptance:** The full flow works against a mock OIDC provider in tests. ID tokens with a wrong
  `iss`, `aud`, `nonce` or an expired `exp` are rejected. The client secret is read from an
  environment variable or secret store and is never logged.
- **Verify:** Integration tests with `oauth2-mock-server` (or equivalent); test names `[AUTH-001] …`.

#### AUTH-002 · MUST · S3 · Map Feide affiliation to roles
After login, call `GET https://groups-api.dataporten.no/groups/me/groups` with the user's Feide access
token (`Authorization: Bearer`). Find the organisation group (`type: "fc:org"`, `id: "fc:org:<realm>"`,
for HVL `fc:org:hvl.no` *(verify realm)*) and read its `membership.affiliation` array. Feide's values are
`faculty`, `student`, `staff`, `alum`, `member`, `affiliate`, `employee` and `library-walk-in`. Course groups
for `AUTHOR_COURSE_GROUPS` come from `groups-edu` as FS groups, e.g. `fc:fs:fs:emne:<realm>:<course-code>:<version>`;
they require HVL's FS integration in Feide *(verify)*.

| Feide affiliation (any of) | Role in HVL Interaktiv |
|---|---|
| `employee`, `faculty`, `staff` | `author` |
| `student` **and** member of an allow-listed course group (config `AUTHOR_COURSE_GROUPS`, e.g. PPU, *Brettspel som didaktisk ressurs*) | `author` (scoped: may author; content visibility limited to the course) |
| `student`, `member`, `affiliate`, `alum`, `library-walk-in` | `learner` |
| Feide ID (claim `https://n.feide.no/claims/eduPersonPrincipalName`, e.g. `name@hvl.no`; needs `userid-feide`) in config `ADMIN_FEIDE_IDS` | adds `admin` |
| Organisation not in `ALLOWED_FEIDE_ORGS` (default `hvl.no`) | `learner` on content shared with "anyone with Feide"; otherwise denied |

- **Acceptance:** A table-driven test covers every row, including users with both `student` and `employee` (→ `author`).
- **Verify:** Unit tests of `FeideRoleMapper`.

#### AUTH-003 · MUST · S3 · Portal session
The server keeps the session in Redis and gives the browser an opaque ID in a cookie
(`__Host-hvli_sid`; `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`). The session expires after
2 h idle or 12 h absolute. State-changing requests require a CSRF token (synchronizer pattern).
Logout clears the session and redirects the browser to Feide's `end_session_endpoint`
(`https://auth.dataporten.no/openid/endsession`) with `post_logout_redirect_uri` (registered in the
Customer Portal) and `id_token_hint`. Feide requires both, so the raw ID token is kept in the
server-side session only, encrypted at rest and deleted at logout or expiry (D-021).
- **Verify:** Integration tests (expiry, CSRF rejection, logout).

#### AUTH-004 · MUST · S3 · Data minimisation at login
Request only the scopes listed in `AUTH-001`. **Never** request `userid-nin` or read the claim
`https://n.feide.no/claims/nin` (national identity number), or other extended attributes. Feide releases
`name` and `email` for **every** user once those attribute groups are authorised, so the claims mapper
drops them for learners before anything is stored. Store a display name and e-mail **only for authors
and admins**, who need them for co-author search and attribution. Feide never verifies e-mail
addresses (`email_verified` is always `false`), so e-mail is never used as an identifier; use `sub` or
the Feide ID.
- **Verify:** Unit test asserts the scope string. Integration test asserts that no learner row has a name or e-mail.

#### AUTH-005 · SHOULD · S3 · Link an author's Canvas identity to their Feide identity
The aim is one personal library whether a teacher arrives through Canvas or the portal. To link
them, read the custom claim `feide_login = $Canvas.user.loginId`, configured **only on the Deep Linking
placements** (never tool-wide), so learners' resource-link launches never carry it. The server reads it
only when `LTI-004` yields `author`, ignores unresolved values that start with `$`, and never stores it
for learners. In LTI 1.3 Canvas releases custom-field substitutions whatever the `privacy_level`, so a
test launch must confirm the value and that it equals the Feide ID *(verify with TeCopp)*. If it does not,
use a one-time "Link with Feide" pop-up instead. Learner identities are **never** linked across modes.
- **Verify:** Integration test of the linking flow.

---

## 4. Requirements — Canvas LTI 1.3 core and Deep Linking

#### LTI-001 · MUST · S3 · LTI 1.3 tool with ltijs 7
`apps/server/src/lti/LtiProviderFactory.ts` builds the ltijs `Provider` with the routes
`/lti/login`, `/lti/launch`, `/lti/keys`, our `PrismaLtiDatabaseManager` and `RedisCacheManager`.
The Canvas platform registration values for Instructure-hosted Canvas are: issuer
`https://canvas.instructure.com`, auth `https://sso.canvaslms.com/api/lti/authorize_redirect`, token
`https://sso.canvaslms.com/login/oauth2/token`, keyset `https://sso.canvaslms.com/api/lti/security/jwks`
(Instructure's documentation and source; the documented token fallback is
`https://<institution-domain>/login/oauth2/token`). Leave ltijs's `authorizationServer` unset, so the
client-assertion `aud` equals the token URL. Beta and test instances use `canvas.{beta,test}.instructure.com`
and `sso.{beta,test}.canvaslms.com`; which one TeCopp's test Canvas is *(verify with TeCopp)*. The
`clientId` and deployment ID come from the Developer Key after the JSON in
`docs/reference/canvas-lti13-developer-key.json` is pasted. The Developer Key's **Redirect URIs** field
(set in the Canvas UI, not in the JSON) must contain exactly `https://interaktiv.hvl.no/lti/launch`.
- **Acceptance:** A full launch against a mock platform (signed with a test key) succeeds. The
  launch is rejected if the signature, `aud`, nonce or deployment ID is wrong, or if the nonce is
  replayed.
- **Verify:** Integration tests `[LTI-001] …`.

#### LTI-002 · MUST · S3 · PostgreSQL storage for ltijs
`PrismaLtiDatabaseManager` implements all 14 methods of ltijs's `DatabaseManager`.
`consumeNonce` is atomic: a single `DELETE … RETURNING`, so a nonce can be used once even under
concurrency. ID-token records expire after 24 h and nonces after 10 min, enforced by a cleanup job.
Platform private keys are encrypted at rest with a key from the secret store.
- **Verify:** Run ltijs's contract behaviour (save/get/consume) as a shared test suite. Concurrency test for `consumeNonce`.

#### LTI-003 · MUST · S3 · Cookie-less ltik transport
1. `onResourceLink` and `onDeepLinking` call `context.redirect(res, '/app/…')`, which appends `?ltik=…`.
2. The Next.js page reads `ltik` once and keeps it **only in memory** (React context, never
   `localStorage` or `sessionStorage`). It removes it from the address bar with `history.replaceState`.
3. All API calls send `Authorization: Bearer <ltik>`. H5P iframe URLs carry it through `HvlUrlGenerator` (`H5P-007`).
4. Server middleware resolves `provider.getLaunchContext(ltik)` into a `Principal`. Invalid or expired → 401 with a "please reopen from Canvas" page.
5. Pages that receive an ltik send `Referrer-Policy: no-referrer`. The logger redacts `ltik` in query strings and headers.
6. `Content-Security-Policy: frame-ancestors` lists only the configured Canvas origins (config
   `CANVAS_ORIGINS`, e.g. `https://hvl.instructure.com`, plus TeCopp's test instance and any vanity domain). `sso.canvaslms.com` is
   not an ancestor and is not listed. `X-Frame-Options` is not sent.
- **Acceptance:** A Playwright test with third-party cookies blocked completes launch → play → resume inside a cross-origin iframe.
- **Verify:** Integration and e2e tests; header assertions.

#### LTI-004 · MUST · S3 · Map LTI roles safely
| LTI role claim contains | Role |
|---|---|
| `membership#Instructor`, `membership/Instructor#TeachingAssistant`, `membership#ContentDeveloper` | `author` (in this context) |
| `membership#Learner` (only) | `learner` |
| `institution/person#Administrator` or any other role | `author` at most |

**An LTI launch never grants `admin`.** H5P library administration requires a Feide login and the admin allow-list (`AUTH-002`).
- **Verify:** Table-driven unit test, including a forged `Administrator` claim.

#### LTI-005 · MUST · S3 · Deep Linking 2.0 picker
`onDeepLinking` redirects to `/app/deeplink`. There the author can (a) choose existing activities
(own, co-authored or from the content bank), or (b) create a new one from a pattern (`PROD-001`) and
return when it is published. The server builds content items of type `ltiResourceLink` with
`custom: { contentId }`, `title`, an `iframe` size hint, and, for the graded placement
`assignment_selection` only, a `lineItem` with `{ scoreMaximum: 100, label, resourceId: contentId,
tag: 'hvl-interaktiv' }`. Canvas ignores `lineItem` from `link_selection` and `editor_button`, so those
links never sync grades. It returns the items with `context.deepLinking.createDeepLinkingForm(items)`.
Multiple selection is offered only when the platform sends `accept_multiple: true` (Canvas sends `false`
for `assignment_selection`). Returned resource links always point to `https://interaktiv.hvl.no`.
- **Acceptance:** The auto-submitted form posts a signed JWT to `deep_link_return_url`. Draft activities cannot be returned.
- **Verify:** Integration test decodes and validates the returned JWT. E2e in J1.

#### LTI-006 · MUST · S3 · Resource-link launch
`onResourceLink` reads `contentId` from the custom claim. It records or updates an `LtiPlacement`
`(platformId, contextId, resourceLinkId, contentId, lineItemUrl)`. Learners get the player. Authors
get the player plus **Rediger** (edit, if owner or co-author) and **Innsikt** (insight) tabs.
- **Acceptance:** An unknown or draft `contentId` gives a friendly error page, not a stack trace or a redirect loop.
- **Verify:** Integration tests.

#### LTI-007 · SHOULD · S3 · Works after Canvas course copy
When a Canvas course is copied, its resource links keep `custom.contentId`. Instructors of the new
course can launch, play and view insight for their own context. They can **duplicate** the activity
into their own library, but cannot edit the original unless they are co-authors.
- **Verify:** Integration test with two contexts and a shared `contentId`.

---

## 5. Requirements — Names and Roles, Dynamic Registration

#### LTI-008 · SHOULD · S6 · Participation denominators via NRPS
If the launch includes the Names and Roles claim, fetch the number of active learners in the
context. Cache it for 1 hour, and use it as the denominator in insight (`INS-001`). **Only counts are
stored**, never member names or e-mail addresses. This needs the developer-key scope
`https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly`; with `privacy_level`
`anonymous`, NRPS members carry no name, e-mail or picture in any case.
- **Verify:** Integration test with a mock NRPS endpoint.

#### LTI-009 · COULD · S6 · LTI Dynamic Registration
Support Canvas's LTI Dynamic Registration through ltijs 7, so TeCopp can install the tool from one
URL. The JSON developer key in `docs/reference/canvas-lti13-developer-key.json` remains the fallback.

---

## 6. Requirements — xAPI-to-AGS grade bridge

#### LTI-010 · MUST · S6 · Capture xAPI in the player
The injected client script (`packages/hvl-h5p-theme/src/xapiBridge.ts`, `H5P-009`) subscribes with
`H5P.externalDispatcher.on('xAPI', …)`. It POSTs each statement to `/api/h5p/xapi`, batched every
2 s and flushed on `pagehide`, with the ltik or CSRF token. Failed posts are retried from an
in-memory queue. They never block or slow down the activity.
- **Verify:** Unit test of the batching queue; Playwright test that statements arrive.

#### LTI-011 · MUST · S6 · Validate and store statements
`/api/h5p/xapi` validates statements with a zod schema. It accepts only verbs it uses
(`answered`, `completed`, `attempted`, `interacted`, `progressed`). It checks that the object belongs
to content the principal may view, and that `0 ≤ score.raw ≤ score.max` and `0 ≤ scaled ≤ 1`. It
rate-limits each learner and activity to 120 statements per minute. Then it stores the minimal
fields defined in `DATA-012` and drops the rest of the statement (including `actor.name` and `actor.mbox`).
- **Verify:** Unit tests for the schema; integration test for rate limiting.

#### LTI-012 · MUST · S6 · Publish scores to the Canvas gradebook (AGS)
When a statement concerns the **root** content (no `subContentId`), has the verb `completed` or
`answered`, and carries `result.score`, the server applies the activity's attempt policy:

| Policy (author setting) | Score sent to Canvas |
|---|---|
| `best` (default) | highest scaled score so far, ×100 |
| `latest` | latest scaled score, ×100 |
| `mastery` | 100 once the scaled score ≥ threshold (default 0.8), otherwise latest ×100 |

The result goes to a durable `GradeSyncJob` queue. A worker calls
`context.grading.submitScore(lineItemUrl, { userId: sub, scoreGiven, scoreMaximum: 100,
activityProgress: 'Completed', gradingProgress: 'FullyGraded', timestamp })` with exponential
backoff (up to 8 attempts in 24 h). Jobs are idempotent per `(placement, learnerKey, attemptId)`. If
the line item no longer exists, the job is marked `orphaned` and is not retried.
The developer key needs the scopes `…/lti-ags/scope/score` and `…/lti-ags/scope/lineitem.readonly`
(the latter detects orphaned line items). ltijs's grading service works from a `LaunchContext`, which
lives as long as the ltik (24 h); a job still failing after that window stores what it needs to request
a new client-credentials token itself, or is marked failed for the author to retry from a fresh launch.
- **Acceptance:** Learning never waits for grade sync. Authors see a per-activity sync status
  (counts of sent / pending / failed) and can retry failed jobs.
- **Verify:** Integration tests with a mock AGS endpoint (success, 5xx retry, 404 orphaned, idempotency).

#### LTI-013 · MUST · S6 · Score integrity is honest
H5P computes scores in the browser, so a determined student can forge them. The system therefore
(a) labels AGS scores as formative in the line-item `label` suffix "(formativ)", (b) shows the
formative notice (`PROD-011`), and (c) never presents these scores as exam evidence. Server checks in
`LTI-011` reduce accidental and casual manipulation. They are not claimed to prevent deliberate
manipulation. On `assignment_selection`, Canvas uses the line-item `label` as the assignment name and
overwrites the teacher's own name. Whether "(formativ)" belongs in the assignment name, or in the
content item's description instead (with Canvas's `preserveExistingAssignmentName` extension), is a
decision for HVL and ALU *(verify)*.
- **Verify:** Review item in the evaluator guide; unit test for the label suffix.

---

## 7. Logical data owned by this module

| Entity | Key fields | Personal data? |
|---|---|---|
| `User` | `id`, `kind (staff/learner)`, `displayName?`, `email?` (staff only), `createdAt` | Staff only |
| `Identity` | `userId`, `provider (feide/lti)`, `subjectHash` (HMAC of Feide ID or `iss|sub`), `platformId?` | Pseudonymous |
| `LtiPlatform`, `LtiIdToken`, `LtiNonce`, `LtiAccessToken` | as required by ltijs `DatabaseManager` | ID tokens contain LTI claims. Kept for 24 h only. |
| `LtiPlacement` | `platformId`, `contextId`, `resourceLinkId`, `contentId`, `lineItemUrl?`, `attemptPolicy`, `masteryThreshold?` | No |
| `GradeSyncJob` | `placementId`, `learnerKey`, `ltiSub (encrypted)`, `scoreGiven`, `status`, `attempts`, `lastError`, `idempotencyKey` | `ltiSub` is needed for AGS; encrypted, deleted 30 days after success |
| `AuthAuditEvent` | `at`, `actorUserId?`, `event`, `ipHash` | Minimal |
