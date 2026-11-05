# apps/server/live — the live-contract seam

## Purpose

Every Canvas and Feide test in this repository runs against the mocks in `tools/mock-platform` (D-049), because the
build environment could not reach HVL's Canvas or Feide. The mocks were written from Instructure's and Feide's
public documentation and source code, and they assume facts nobody has confirmed against the real services. This
folder states those facts as checks and runs them against **ALU's test Canvas** and **real Feide** when you ask for
it, or against the mocks to show that the checks themselves work. It is the seam D-101 hands to HVL's bachelor
students (D-101's amendment of 2026-11-05): when a check fails against Canvas, the mock is wrong, and so may be the
code that trusted it.

The checks call the server's own code wherever it exists (`signClientAssertion`, `AgsAccessTokens`,
`AgsScoreClient`, `outcomeOfStatus`, `LEARNER_ROLE_URI`, `activeLearnerCount`, `buildDeepLinkItems`), so a
difference shows in the code that runs in production. Each failure message names the mock module that assumed
otherwise.

## What it checks

| File | Facts the mocks assume | Requirement | Mock module |
|---|---|---|---|
| `canvasToken.live.test.ts` | A client assertion whose `aud` is the token endpoint gets a bearer token with `expires_in` 3600 and the scopes asked for; the grade worker's `AgsAccessTokens` gets one from the stored tool key; another audience is refused with 400 `invalid_request` (the worker fails, not retries); a scope the developer key lacks is refused with 400 `invalid_scope`, not narrowed; the NRPS scope is granted | `LTI-012`, `LTI-008` | `canvasTokenEndpoint.mjs`, `canvasClientAssertion.mjs` |
| `canvasAgs.live.test.ts` | The line item a Deep Linking return from `assignment_selection` created has `scoreMaximum` 100, our `resourceId` and the tag `hvl-interaktiv`; its label ends with «(formativ)» in `suffix` mode; a line item reads at its own URL with the line-item media type; a missing line item is 404 to a read and to a score (so our client says `orphaned`); a score is 401 without the `score` scope and with a bad token; a score for a user outside the course is 422 (failed, not retried); the test student's score is accepted (200 with a `resultUrl`) and our client says `sent` | `LTI-005`, `LTI-013`, `LTI-012` | `canvasLineItems.mjs`, `canvasScores.mjs` |
| `canvasNrps.live.test.ts` | The full Learner role URI lists learners only, with no name, e-mail or picture (`privacy_level` `anonymous`); the short name `Learner` lists nobody; a page of one has a next link with `per_page=1` and without `limit`, and the next page holds another member; our count rule finds at least two active learners, the test student among them; a token without the NRPS scope gets 401 | `LTI-008` | `canvasMemberships.mjs`, `canvasServiceHttp.mjs` |
| `feideDiscovery.live.test.ts` | Feide's discovery document names Feide's five endpoint paths, `client_secret_post`, RS256, the `code` response type and (if it lists any) PKCE `S256`; its key set holds RSA keys with key IDs | `AUTH-001` | `feideDiscovery.mjs` |
| `liveConfig.test.ts` | When the checks run, and that a half-set target fails loudly without printing a value | `LTI-012`, `LTI-008`, `AUTH-001` | — |
| `canvasRequests.test.ts` | That a token goes only to `LIVE_CANVAS_API_ORIGIN`, and how a next link is read | `LTI-012`, `LTI-008` | — |

What a test cannot automate (the Deep Linking round trip in a teacher's browser, the assignment name Canvas shows, a
course copy, Student View, `feide_login`, a real Feide login and the Groups API) is in the acceptance checklist,
[docs/handoff/canvas-acceptance.md](../../../docs/handoff/canvas-acceptance.md), whose step H runs this suite.

## How to run

From the repository root, `npm run test:live` runs Vitest with this folder's config
(`vitest run --root apps/server --config live/vitest.live.config.ts`):

```bash
# Nothing set: every check is skipped and only the configuration and guard tests run (17 passed, 19 skipped)
npm run test:live

# Against the mocks on the local services (docker compose up -d and apps/server/.env, as for the integration tests);
# CI runs this after the end-to-end step (D-101's integration amendment)
LIVE_TARGET=mock npm run test:live

# Against ALU's test Canvas and real Feide: fill in apps/server/live/.env from .env.example first
npm run test:live
```

Behind an HTTP proxy, add `NODE_USE_ENV_PROXY=1` so Node's `fetch` uses it. Run one file with its path after `--`
(`npm run test:live -- live/canvasNrps.live.test.ts`) and one requirement with `npm run test:live -- -t "LTI-008"`.

### Pointing it at ALU's Canvas test instance

1. **A test server registered in the test Canvas.** The server must run on an https address that Canvas can reach,
   with `LTI_PLATFORMS` naming the test Canvas, and the developer key from
   `docs/reference/canvas-lti13-developer-key.json` pasted into the test Canvas with that address instead of
   `https://interaktiv.hvl.no` (canvas-platform-values.md §1.1). Its `public_jwk_url` must be the test server's
   `/lti/keys`: Canvas checks every token request against it.
2. **A test course with test accounts only:** one test teacher and at least two test students, never a real course
   (the checks post a score and list the roster). Install the tool in the course.
3. **A graded placement:** as the test teacher, add an assignment through the tool's `assignment_selection`
   placement and pick a published activity (checklist step C2). This creates the line item the AGS checks read.
4. **`apps/server/live/.env`**, copied from `.env.example`, with the issuer, client ID, the institution domain where
   AGS and NRPS answer, the course ID, and the test server's `DATABASE_URL` and `DATA_ENCRYPTION_KEYS` (as
   `LIVE_DATABASE_URL` and `LIVE_DATA_ENCRYPTION_KEYS`). Run the suite where that database can be reached, ideally with
   a read-only database role; only the `LtiPlatform` row is read.
5. **Optionally `LIVE_CANVAS_STUDENT_SUB`**, a test student's LTI `sub`, for the one check that posts a score (50,
   twice). The NRPS check then also confirms that the roster lists that `sub`. A Canvas administrator can find a
   user's LTI ID *(verify where)*; never use a real student's.
6. Run the suite and record the output, dated, with the checklist's results (step H).

## When a check fails

1. Read the message: it names the fact, the mock module that assumed it and, where one exists, the server module that
   relies on it.
2. Confirm with a second run, and with Canvas's documentation or source, that this is how Canvas behaves.
3. Record the difference as a decision or an amendment in `docs/DECISIONS.md` first (CLAUDE.md §1).
4. Change the mock and its own tests (`tools/mock-platform/test/`) to behave as Canvas does, then the check here,
   then the server code and its tests if they relied on the old behaviour. `LIVE_TARGET=mock` must pass again.

## Folder structure

| File | What it is |
|---|---|
| `liveConfig.ts` | Reads the `LIVE_*` variables into a plan: none, the mock, or the real services named |
| `canvasTarget.ts` | The Canvas under test: the platform and its tool key from the test server's database, the course's service URLs |
| `mockCanvasTarget.ts` | The same target on the mock Canvas, with a course set up as step 2–3 above |
| `canvasRequests.ts` | Raw token, AGS and NRPS requests that keep the status, media type and next link |
| `*.live.test.ts` | The checks; each `describe.runIf` skips them unless a target is set |
| `liveConfig.test.ts`, `canvasRequests.test.ts` | Tests of the plan and of the request guards |
| `vitest.live.config.ts`, `tsconfig.json` | The run and the type check (part of `npm run typecheck`) |
| `.env.example` | Every variable, with whether it is secret |

## Safety rules

- Test accounts in a test course only. The checks list the course's learners and post a score.
- The test server has its own database and its own `DATA_ENCRYPTION_KEYS`, never production's: the keys decrypt
  everything the server encrypts, so they stay in `live/.env` on the machine that runs the suite and nowhere else.
- The tool key and every token stay in memory; nothing here prints a token, an assertion, a key or a member's ID,
  and an error names variables, never their values (`DATA-009`). The NRPS checks compare counts and booleans only,
  because a failing assertion prints what it was given. A token goes only to `LIVE_CANVAS_API_ORIGIN`: a line item
  or next link that Canvas names on another host is refused before anything is sent.
- `LIVE_TARGET=mock` refuses to start when a real target is also set, because a mock run writes test rows into the
  local database.
- The checks never run in the root test run or in the gate's per-ID runs; they are evidence about Canvas only through
  a dated run recorded with the acceptance checklist.

## Implements

Spec 02 `LTI-005`, `LTI-008`, `LTI-012`, `LTI-013` and `AUTH-001`, as contract checks only; D-101 and its amendment
of 2026-11-05; D-104 and D-105 for what the grade worker and the label rely on.
