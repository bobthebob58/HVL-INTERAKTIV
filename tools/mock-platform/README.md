# tools/mock-platform

## Purpose

A mock **Feide** and a mock **Canvas** for testing HVL Interaktiv's Feide login (`AUTH-001`…`AUTH-005`) and its
LTI 1.3 tool (`LTI-001`…`LTI-007`) without HVL's Feide client or TeCopp's Canvas (D-049). Every HVL value stays an
environment variable; the mock gives the tool the variables that point at itself.

- **Mock Feide** (`mockFeide.mjs`, on `oauth2-mock-server` 9.2.0): discovery with Feide's paths
  (`/oauth/authorization`, `/oauth/token`, `/openid/userinfo`, `/openid/jwks`, `/openid/endsession`), code flow
  with PKCE, RS256 ID tokens with Feide's claims (`sub` as a UUID, `name`, `email`,
  `https://n.feide.no/claims/eduPersonPrincipalName`, `https://n.feide.no/claims/userid_sec` with `feide:<id>`),
  narrowed by the requested scopes as Feide does, and the Groups API (`GET <groupsApiUrl>/groups/me/groups`) with
  the `fc:org` group (`membership.affiliation`, `primaryAffiliation`) and FS course groups. Shapes come from
  [`docs/reference/feide-values.md`](../../docs/reference/feide-values.md).
- **Mock Canvas** (`mockCanvas.mjs`, `node:http` + `jose`): an RS256 platform key with its JWKS at
  `/api/lti/security/jwks`, the OIDC authentication endpoint `/api/lti/authorize_redirect` (GET and POST) that
  checks requests like Canvas and answers with a `form_post` page, launch claims as Canvas sends them (including
  `https://www.instructure.com/placement` and `$Canvas.user.loginId` substitution), a course page that frames the
  tool cross-site with an LTI Platform Storage frame, and `POST /deep_linking_response`, which verifies the tool's
  Deep Linking JWT against `<toolUrl>/lti/keys` and records it. Values come from
  [`docs/reference/canvas-platform-values.md`](../../docs/reference/canvas-platform-values.md).

The mock Canvas listens on `127.0.0.1` and its origin and issuer are `http://127.0.0.1:<port>`. The mock Feide's
issuer is `http://localhost:<port>`. A tool on `http://localhost:<port>` is therefore on the same site as Feide
and on **another site** than Canvas, so in a browser its Canvas frame is third-party, as in production.

## How to run

```bash
# By hand: start both mocks, print the tool's env lines, Ctrl+C to stop
node tools/mock-platform/cli.mjs --tool-url http://localhost:3000 --canvas-port 4100 --feide-port 4200

# The tests (Vitest project "tools")
npx vitest run tools/mock-platform
```

Paste the printed lines into `apps/server/.env`, start the server, then open the printed Canvas home page
(`http://127.0.0.1:4100/`) and pick a demo launch. Choose the next Feide user with
`http://localhost:4200/__mock/next-login?user=<key>` (GET or POST).

## Using it from tests

```ts
import { CANVAS_USERS, MESSAGE_TYPE, startMockPlatform } from '../../../tools/mock-platform/mockPlatform.mjs';

const platform = await startMockPlatform({ toolUrl: 'http://localhost:3999' });
// platform.env: FEIDE_ISSUER, FEIDE_GROUPS_API_URL, FEIDE_CLIENT_ID, FEIDE_CLIENT_SECRET, CANVAS_ORIGINS, LTI_PLATFORMS

// Node-driven LTI launch (e.g. with supertest):
const login = platform.canvas.loginInitiation({ user: CANVAS_USERS.student, custom: { contentId } });
// 1. POST login to /lti/login; read ltijs's targetUrl from the page it returns.
const auth = await platform.canvas.authorize(targetUrl); // { action, idToken, state } or { error, error_description }
// 2. POST { id_token: auth.idToken, state: auth.state } to auth.action, then ltijs's recovered-state form.

// Negative launches: correct claims for the request's nonce, then change or re-sign them.
const claims = platform.canvas.idTokenClaims(spec, nonce);
const forged = await platform.canvas.signIdToken(claims, { key: 'foreign' }); // only the signature is wrong

// Deep Linking: the tool posts to <canvas>/deep_linking_response, or a test verifies the JWT directly.
const record = await platform.canvas.verifyDeepLinkResponse(jwt); // { ok, problems, items, lifetime, request, … }

// Browser flow (Playwright): open the course page; every load starts a fresh launch.
await page.goto(platform.canvas.coursePageUrl({ user: CANVAS_USERS.teacher, platformStorage: true }));

// Feide: choose the user of the next /authorize, test failure paths.
platform.feide.nextLogin('ppu-student');
platform.feide.setGroupsFailure(true); // Groups API answers 503
platform.feide.tamperNextIdToken((payload) => (payload.aud = 'other')); // or forgeNextIdTokenSignature()
await platform.close();
```

Feide demo users (`FEIDE_DEMO_USERS`): `author` (`author@hvl.no`, employee and faculty; logs in when nobody was
chosen), `student`, `ppu-student` (member of `fc:fs:fs:emne:hvl.no:PPU101:1`), `uib-employee` (realm `uib.no`) and
`no-feide-id` (no Feide ID claims). Canvas demo users (`CANVAS_USERS`): `teacher` (login ID `author@hvl.no`) and
`student`, with the institution and system roles Canvas adds. Types for TypeScript callers are in
`mockPlatform.d.mts`, `feideTypes.d.mts` and `canvasTypes.d.mts`.

## Files

| File | Responsibility |
|---|---|
| `mockPlatform.mjs` | Entry point: starts both mocks, builds `env`, re-exports the constants |
| `mockFeide.mjs`, `feideDiscovery.mjs`, `feideUsers.mjs` | Feide server and test controls; discovery document; users, claims and groups |
| `mockCanvas.mjs`, `canvasAuthorize.mjs`, `canvasIdTokens.mjs`, `ltiVocabulary.mjs` | Canvas server; authentication-request checks and pending logins; launch claims; claim, role and user constants |
| `canvasPages.mjs`, `platformStorageFrame.mjs` | Home page, course page, login-initiation frame; Platform Storage frame |
| `deepLinkReturn.mjs` | Deep Linking response verification and result page |
| `httpRouter.mjs` | `node:http` router, HTML and JSON helpers, start and stop |
| `cli.mjs` | The command line |
| `mockPlatform.d.mts`, `feideTypes.d.mts`, `canvasTypes.d.mts` | Types for TypeScript callers |
| `test/` | Self-tests, including ltijs 7.0.7 and openid-client 6.8.8 against the mocks |

## What the mocks check, and what they do not

| Check | Mock |
|---|---|
| Authentication request: `client_id`, `redirect_uri` = `<toolUrl>/lti/launch`, `response_type=id_token`, `response_mode=form_post`, `scope=openid`, `prompt=none`, `nonce`, `state`, `login_hint` and `lti_message_hint` of a pending login, optional `lti_deployment_id`, `id_token_signed_response_alg=RS256` | Canvas |
| A login (`lti_message_hint`) is single-use and expires after 5 minutes | Canvas |
| Deep Linking response: RS256, `kid` in the tool JWKS, signature, `iss` = client ID, `aud` = issuer, deployment, nonce once, message type, version `1.3.0`, `data`, `iat`/`exp`, item count against `accept_multiple`, item types, resource links on the tool's origin. Only a response whose signature verified uses up its nonce | Canvas |
| Platform Storage: replies only to the tool's origin, values kept per origin and key | Canvas |
| Client ID at `/authorize`; PKCE `S256` only (`plain` or no method: `invalid_request`); each code redeemed once; a code issued for a PKCE challenge only with its verifier | Feide |
| userinfo and the Groups API: only unexpired access tokens the mock issued (401 otherwise) | Feide |
| End session: needs an http(s) `post_logout_redirect_uri` and an `id_token_hint` the mock issued | Feide |

**Not checked:** the Feide **client secret** (any secret is accepted), registered Feide redirect and logout URIs, and
Canvas client authentication. The Canvas token endpoint is listed in `LTI_PLATFORMS` but not served (AGS is S6).
A replayed code with a PKCE verifier is refused by `oauth2-mock-server` with a `400` `application/problem+json`
body rather than Feide's `invalid_grant` JSON. Launches carry a subset of Canvas's claims (no `lis`, no LTI 1.1
legacy IDs); `name` and `email` appear only when the launch spec's user has them. `oauth2-mock-server`'s other
grants (`password`, `client_credentials`, `refresh_token`, JWT bearer) and its `/introspect` and `/revoke` routes are
still served; their tokens are unknown to userinfo and the Groups API, and the tool must not use them.
