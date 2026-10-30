# tools/mock-platform

## Purpose

A mock **Feide** and a mock **Canvas** for testing HVL Interaktiv's Feide login (`AUTH-001`…`AUTH-005`), its
LTI 1.3 tool (`LTI-001`…`LTI-007`) and its use of Canvas's grade and roster services (`LTI-008`, `LTI-012`, D-104)
without HVL's Feide client or TeCopp's Canvas (D-049). Every HVL value stays an environment variable; the mock gives
the tool the variables that point at itself.

- **Mock Feide** (`mockFeide.mjs`, on `oauth2-mock-server` 9.2.0): discovery with Feide's paths
  (`/oauth/authorization`, `/oauth/token`, `/openid/userinfo`, `/openid/jwks`, `/openid/endsession`), code flow
  with PKCE, RS256 ID tokens with Feide's claims (`sub` as a UUID, `name`, `email`,
  `https://n.feide.no/claims/eduPersonPrincipalName`, `https://n.feide.no/claims/userid_sec` with `feide:<id>`),
  narrowed by the requested scopes as Feide does, the Groups API (`GET <groupsApiUrl>/groups/me/groups`) with
  the `fc:org` group (`membership.affiliation`, `primaryAffiliation`) and FS course groups, and a checked end
  session. Shapes come from [`docs/reference/feide-values.md`](../../docs/reference/feide-values.md).
- **Mock Canvas** (`mockCanvas.mjs`, `node:http` + `jose`): an RS256 platform key with its JWKS at
  `/api/lti/security/jwks`, the OIDC authentication endpoint `/api/lti/authorize_redirect` (GET and POST) that
  checks requests like Canvas and answers with a `form_post` page, launch claims as Canvas sends them (including
  `https://www.instructure.com/placement` and `$Canvas.user.loginId` substitution), a home page with demo
  launches, a course page that frames the tool cross-site (with an LTI Platform Storage frame beside it when the
  launch asks for one), and `POST /deep_linking_response`, which verifies the tool's Deep Linking JWT against
  `<toolUrl>/lti/keys`, records it and shows the items or the problems. Values come from
  [`docs/reference/canvas-platform-values.md`](../../docs/reference/canvas-platform-values.md).
- **Mock Canvas services** (`canvasServices.mjs` and the modules it wires): the client-credentials token endpoint
  `POST /login/oauth2/token` (a JWT client assertion verified against `<toolUrl>/lti/keys`), AGS line items
  (`GET`/`POST /api/lti/courses/:course/line_items`, `GET …/line_items/:id`) and scores (`POST …/:id/scores`), and
  NRPS (`GET /api/lti/courses/:course/names_and_roles`), all in memory, with fault injection (the next N requests
  answer an error, a 429 with `Retry-After`, or arrive late) and a record of every token request, score post and
  accepted score. A launch that names a line item by ID creates it; every launched user joins the course roster.

The mock Canvas listens on `127.0.0.1` and its origin and issuer are `http://127.0.0.1:<port>`. The mock Feide
also listens on `127.0.0.1`, but its issuer is `http://localhost:<port>`, the name oauth2-mock-server gives a
loopback issuer. A tool on `http://localhost:<port>` is therefore on the same site as Feide and on **another
site** than Canvas, so in a browser its Canvas frame is third-party, as in production.

## How to run

```bash
# By hand: both mocks for a tool on http://localhost:3000, mock Canvas on 4100, mock Feide on 4200 (Ctrl+C stops)
npm run mock:platform

# The same with your own values; a port left out is 0, which picks a free port
node tools/mock-platform/cli.mjs --tool-url http://localhost:3000 --canvas-port 4100 --feide-port 4200

# The self-tests (Vitest project "tools")
npx vitest run tools/mock-platform
```

The CLI prints the six tool variables as `NAME=value` lines (`LTI_PLATFORMS` as single-quoted JSON, with
`"feideLinking": true`, because the mock sends the demo user's Feide ID as `feide_login`), then the
Canvas home page, the Canvas service controls, the Feide user keys and how to choose the next one, and
`# Press Ctrl+C to stop.` The service controls are plain HTTP on the mock Canvas (query or form fields):
`POST /__mock/faults?target=scores&status=503&count=2` (targets `token`, `scores`, `lineItems`, `memberships`; also
`retryAfter`, `delayMs` and an OAuth `error`), `POST /__mock/line-items/delete?url=<line item URL>`,
`POST /__mock/tokens/revoke`, and `GET /__mock/services`, which shows line items, accepted scores, every score post
and every token request. SIGINT and
SIGTERM close both servers (exit code 0); bad arguments print the usage (exit code 2); a mock that cannot start,
for example on a port in use, exits with code 1.

**Running the server against it.** `.env.example` already has the mock URLs for ports 4100 and 4200, the mock
Feide's client ID (`hvl-interaktiv-mock`) and the mock Canvas's client and deployment IDs, so a copied `.env`
works as it is. Paste the printed lines into `apps/server/.env` only after changing ports or IDs: the mock Feide
refuses another client ID at `/authorize` (`unauthorized_client`). `PUBLIC_BASE_URL` must be the `--tool-url`: the mock Canvas accepts only
`<toolUrl>/lti/launch` as redirect URI, posts logins to `<toolUrl>/lti/login`, reads the tool's keys from
`<toolUrl>/lti/keys`, and its Platform Storage frame answers only the tool's origin. Start the server
(`npm start`; it registers the mock Canvas from `LTI_PLATFORMS` at start-up), then open:

- `http://127.0.0.1:4100/`, the mock Canvas home page. Choose a resource-link launch (give a `contentId`) or one
  of the Deep Linking placements `link_selection`, `assignment_selection` and `editor_button`, as `teacher` or
  `student`, and optionally send `lti_storage_target`. It opens a course page that frames the tool. The Deep
  Linking demos send the custom fields `feide_login=$Canvas.user.loginId` (the teacher's login ID is
  `author@hvl.no`) and `hvl_placement`.
- `http://localhost:3000/`, the tool's start page with Feide login. The mock logs in `author` unless you choose
  another user first with `http://localhost:4200/__mock/next-login?user=<key>` (GET or POST; an unknown key
  answers 404 with the list of keys).

The mocks keep everything in memory. A restarted mock Canvas signs with a new key, which ltijs fetches from
`jwksUrl` when it meets the unknown `kid`; with the fixed ports of `npm run mock:platform` the printed lines stay
the same.

## Using it from tests

```ts
// From apps/server/e2e/; from apps/server/test/<folder>/ the path starts with ../../../../
import { CANVAS_USERS, LTI_ROLE, MESSAGE_TYPE, startMockPlatform } from '../../../tools/mock-platform/mockPlatform.mjs';

const platform = await startMockPlatform({ toolUrl: 'http://localhost:3999' });
// platform.env: FEIDE_ISSUER, FEIDE_GROUPS_API_URL, FEIDE_CLIENT_ID, FEIDE_CLIENT_SECRET, CANVAS_ORIGINS, LTI_PLATFORMS

// Node-driven LTI launch (apps/server/test/support/ltiLaunchDriver.ts does all of this with supertest):
const login = platform.canvas.loginInitiation({ user: CANVAS_USERS.student, custom: { contentId } });
// 1. POST login to /lti/login; read ltijs's targetUrl from the page's `ltijs-login-data` JSON.
const auth = await platform.canvas.authorize(targetUrl); // { action, idToken, state } or { error, error_description }
// 2. POST { id_token: auth.idToken, state: auth.state } to auth.action, then the same fields again with
//    `ltijs_recovered_state` (the login data's recovery token), as ltijs's own page does.

// Negative launches: correct claims for the request's nonce, then change or re-sign them.
const claims = platform.canvas.idTokenClaims(spec, nonce);
const forged = await platform.canvas.signIdToken(claims, { key: 'foreign' }); // only the signature is wrong

// Deep Linking: the tool's picker posts the JWT to <canvas>/deep_linking_response, or a test verifies it directly.
const record = await platform.canvas.verifyDeepLinkResponse(jwt); // { ok, problems, items, lifetime, request, … }
platform.canvas.deepLinkResponses; // every record so far, including those posted by a browser

// Browser flow (Playwright): open the course page; every load starts a fresh launch.
await page.goto(platform.canvas.coursePageUrl({ user: CANVAS_USERS.teacher, platformStorage: true }));
// The tool runs in the frame named `tool_content`.

// Feide: choose the user of the next /authorize, add users, test failure paths.
platform.feide.nextLogin('ppu-student');
platform.feide.addUser({ key: 'guest', realm: 'uib.no', affiliations: ['affiliate'] });
platform.feide.setGroupsFailure(true); // Groups API answers 503
platform.feide.tamperNextIdToken((payload) => (payload.aud = 'other')); // or forgeNextIdTokenSignature()
platform.feide.logouts; // every end-session request the mock accepted

// AGS and NRPS (LTI-008, LTI-012, D-104). The token endpoint is platform.canvas.tokenEndpoint; the developer key
// grants MOCK_CANVAS_SCOPES (score, lineitem.readonly, contextmembership.readonly) unless startMockCanvas gets `scopes`.
const lineItem = platform.canvas.ags.addLineItem({ courseId: 'mock-course-1', label: 'Quiz (formativ)', scoreMaximum: 100 });
// …or launch with `lineItem: '7'`, which creates line item 7 of the launch's course.
platform.canvas.ags.scores; // every accepted score: { lineItemUrl, courseId, score, receivedAt }
platform.canvas.ags.scorePosts; // every score post with { ok, status, problems, fault }
platform.canvas.ags.failNextScores({ count: 2, status: 503 }); // also 404, { status: 429, retryAfter: 5 }, { delayMs: 3000 }
platform.canvas.ags.failNextLineItemReads({ status: 500 });
platform.canvas.ags.deleteLineItem(lineItem.id); // reads and score posts now answer 404
platform.canvas.tokens.failNext({ status: 400, error: 'invalid_grant' }); // or { status: 503 }
platform.canvas.tokens.requests; // every token request with its problem codes (never the token)
platform.canvas.tokens.revokeAll(); // the next service call answers 401
platform.canvas.nrps.setMembers('mock-course-1', [{ user_id: 'learner-1', roles: [LTI_ROLE.learner] }]);
platform.canvas.nrps.failNext({ status: 503 });
platform.canvas.clearFaults();
await platform.close();
```

Feide demo users (`FEIDE_DEMO_USERS`): `author` (`author@hvl.no`, employee and faculty; logs in when nobody was
chosen), `student`, `ppu-student` (member of `fc:fs:fs:emne:hvl.no:PPU101:1`), `uib-employee` (realm `uib.no`) and
`no-feide-id` (no Feide ID claims). Canvas demo users (`CANVAS_USERS`): `teacher` (login ID `author@hvl.no`) and
`student`, with the institution and system roles Canvas adds. A launch spec (`LaunchSpec`) defaults to the student,
course `mock-course-1` and locale `nn`. Types for TypeScript callers are in `mockPlatform.d.mts`,
`feideTypes.d.mts` and `canvasTypes.d.mts`.

## Used by

| Where | How |
|---|---|
| `apps/server/test/support/appTestbed.ts` (`openAppTestbed`) | Starts the whole app (`createApp`) on a free port on `http://localhost`, then `startMockPlatform({ toolUrl })`, builds the configuration from `mock.env`, and registers only this mock Canvas (the platform sync sees only its issuer, so parallel testbeds never deactivate each other's platforms). `close()` stops the mocks and removes the platform and the users, content and audit rows the testbed created. Used by the LTI, Deep Linking, account-linking, H5P authentication and app integration tests, and by all three e2e tests |
| `apps/server/test/support/ltiLaunchDriver.ts` (`launchFromCanvas`) | A launch without a browser: `canvas.loginInitiation(spec)` → `POST /lti/login` → `canvas.authorize(targetUrl)` → the `form_post` to `/lti/launch` → ltijs's second POST with the recovered state. Returns the final response, the ltik, the redirect path and `replay()`; an optional `tamper` replaces the ID token (for example with `canvas.signIdToken(claims, { key: 'foreign' })`) |
| `apps/server/test/support/feideTestbed.ts` | Only the Feide login routes, against `startMockFeide()` alone; its driver follows the redirects with supertest and `fetch` |
| `apps/server/test/server/main.smoke.test.ts` | Starts `src/server/main.ts` as its own process with `mock.env` and checks `/healthz` and `/lti/keys` |
| `apps/server/test/grades/agsClientCredentialsProbe.int.test.ts` (S6 probe P2) | Reads the tool key as D-104 says (ltijs's `getPlatformById` and `getPrivateKey` over our encrypted storage), signs a client assertion with `node:crypto`, gets a token from `canvas.tokenEndpoint`, posts a score and finds it in `canvas.ags.scores`; then confirms a deleted line item with a read |
| `apps/server/e2e/*.e2e.test.ts` (`npm run test:e2e`, D-065) | The two Canvas flows open `canvas.coursePageUrl(spec)` in full Chromium with third-party cookies blocked; the Deep Linking flow waits for `canvas.deepLinkResponses`; the portal flow logs in through the mock Feide and checks `feide.logouts` |
| `.github/workflows/ci.yml` | No extra service: `npm test` and `npm run test:e2e` start the mocks in-process |

## Files

| File | Responsibility |
|---|---|
| `mockPlatform.mjs` | Entry point: starts both mocks, builds `env`, re-exports the constants |
| `mockFeide.mjs`, `feideDiscovery.mjs`, `feideUsers.mjs` | Feide server and test controls; discovery document; users, claims and groups |
| `mockCanvas.mjs`, `canvasAuthorize.mjs`, `canvasIdTokens.mjs`, `ltiVocabulary.mjs` | Canvas server; authentication-request checks and pending logins; launch claims; claim, role and user constants |
| `canvasPages.mjs`, `platformStorageFrame.mjs` | Home page with demo launches, course page, login-initiation frame; Platform Storage frame |
| `deepLinkReturn.mjs`, `toolSignature.mjs` | Deep Linking response verification and result page; the RS256 check against the tool's `/lti/keys` it shares with the token endpoint |
| `canvasServices.mjs` | Wires the services onto the Canvas router and builds `canvas.tokens`, `canvas.ags`, `canvas.nrps` |
| `canvasTokenEndpoint.mjs`, `canvasClientAssertion.mjs` | Token endpoint and bearer-token check; client-assertion verification |
| `canvasLineItems.mjs`, `canvasScores.mjs` | AGS line-item store and service; score checks and record |
| `canvasMemberships.mjs` | Course rosters and NRPS |
| `canvasFaults.mjs`, `canvasServiceControls.mjs`, `canvasServiceHttp.mjs` | Fault queues; the `/__mock/` HTTP controls; JSON, media-type, bearer and paging helpers |
| `httpRouter.mjs` | `node:http` router, HTML and JSON helpers, start and stop |
| `cli.mjs` | The command line (`npm run mock:platform`) |
| `mockPlatform.d.mts`, `feideTypes.d.mts`, `canvasTypes.d.mts`, `canvasServiceTypes.d.mts` | Types for TypeScript callers |
| `test/` | Self-tests, including ltijs 7.0.7 (`ltijsInterop.test.mjs`, `ltijsServicesInterop.test.mjs` on the shared `ltijsTool.mjs`) and openid-client 6.8.8 (`feideLoginSteps.mjs`) against the mocks; `serviceBench.mjs` is the tool side of the service tests |

## What the mocks check, and what they do not

| Check | Mock |
|---|---|
| Authentication request: `client_id`, `redirect_uri` = `<toolUrl>/lti/launch`, `response_type=id_token`, `response_mode=form_post`, `scope=openid`, `prompt=none`, `nonce`, `state`, `login_hint` and `lti_message_hint` of a pending login, optional `lti_deployment_id`, `id_token_signed_response_alg=RS256` | Canvas |
| A login (`lti_message_hint`) is single-use and expires after 5 minutes | Canvas |
| Deep Linking response: RS256, `kid` in the tool JWKS, signature, `iss` = client ID, `aud` = issuer, deployment, nonce once, message type, version `1.3.0`, `data`, `iat`/`exp`, item count against `accept_multiple`, item types, resource links on the tool's origin. Only a response whose signature verified uses up its nonce | Canvas |
| Platform Storage: serves only messages from the tool's origin (others get an error reply and nothing is stored); replies go to the sender's origin, never `*`; values are kept per origin and key in the frame's memory | Canvas |
| Client ID at `/authorize`; PKCE `S256` only (`plain` or no method: `invalid_request`); each code redeemed once; a code issued for a PKCE challenge only with its verifier | Feide |
| userinfo and the Groups API: only unexpired access tokens the mock issued (401 otherwise) | Feide |
| End session: needs an http(s) `post_logout_redirect_uri` and an `id_token_hint` the mock issued | Feide |
| Token endpoint, as Canvas's source at the commit of canvas-platform-values.md §0 checks it: `grant_type=client_credentials`, `client_assertion_type` jwt-bearer, assertion RS256 with a `kid` in `<toolUrl>/lti/keys` and a valid signature, `sub` = client ID, `aud` (string or array) containing the token URL or the mock's host (canvas-platform-values.md §2), `exp` not past, `iat` at most 30 s ahead and 5 minutes old, a `jti`; scopes a non-empty subset of the developer key's (else `invalid_scope`, not narrowed). Assertion problems answer 400 `invalid_request`, as Canvas does. Stricter than Canvas: `iss` = client ID, each `jti` once (only a verified assertion uses it up), and a `client_id`, when sent, the key's (401 `invalid_client`). Tokens are opaque and live 3600 s | Canvas |
| Services: a valid unexpired bearer token with the needed scope, else 401 as Canvas answers both: `lineitem` or `lineitem.readonly` to read line items, `lineitem` to create one, `score` to post scores, `contextmembership.readonly` for NRPS. Errors in Canvas's two shapes: `{"errors": {"type", "message"}}` from its LTI services, `{"errors": [{"message"}]}` for a missing record (404) or parameter | Canvas |
| Scores, in Canvas's check order: a live line item (404), the user an active learner of the course (422, Canvas's text), `activityProgress`, `gradingProgress` and `timestamp` present (400), an ISO 8601 `timestamp` not older than the stored result (400; equal is accepted), and with a `scoreGiven` that is `FullyGraded` or `PendingManual`, `scoreMaximum` > 0 and `scoreGiven` ≥ 0 (422); progress values from AGS 2.0's lists (400 *(verify)*). The mock's own last rule: media type `application/vnd.ims.lis.v1.score+json` (415; Canvas also takes `application/json`) | Canvas |
| NRPS: members carry only `status`, `user_id` and membership `roles` (`privacy_level` `anonymous`); `role` must be a full role URI, anything else (a short name such as `Learner`) matches nobody, as in Canvas; pages of 50 by default and at most 50; `Deleted` members never listed. Lists page as Canvas's `Api` does: a `Link` header on every page with `current`, `first` and `last`, plus `next` and `prev` where they exist, links ending in `page=<n>&per_page=<size>` (line items: 10 by default, at most 100) | Canvas |

**Not checked:** the Feide **client secret** (any secret is accepted) and registered Feide redirect and logout URIs.
The Canvas services do not check that the developer key is installed in the course, serve no `rlid` (resource-link)
memberships, NRPS differences, results (`result.readonly`), line-item updates or deletions over HTTP, nor line items
created by a Deep Linking response's `lineItem`, nor a concluded course (Canvas's 422). The mock follows Canvas's
open-source code; what HVL's hosted Canvas answers (the assertion `aud` on HVL's instance, a deleted assignment, a
learner who left, paging and the role filter) is on the students' Canvas acceptance checklist (D-101, D-104). A
replayed code with a PKCE verifier is refused by `oauth2-mock-server` with a `400` `application/problem+json` body
rather than Feide's `invalid_grant` JSON. Launches carry a subset of Canvas's claims (no `lis`, no LTI 1.1 legacy
IDs); `name` and `email` appear only when the launch spec's user has them. `oauth2-mock-server`'s other grants
(`password`, `client_credentials`, `refresh_token`, JWT bearer) and its `/introspect` and `/revoke` routes are still
served; their tokens are unknown to userinfo and the Groups API, and the tool must not use them.
