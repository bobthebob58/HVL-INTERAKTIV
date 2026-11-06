# Design note: the live-contract seam

| | |
|---|---|
| **Status** | Built in S6 (2026-11-05) and run against the mocks; never run against a real Canvas or Feide |
| **Decisions** | D-101 and its amendment of 2026-11-05; D-049 (the mocks); D-104, D-105 |
| **Code** | [apps/server/live/](../../apps/server/live/README.md) |
| **Requirements** | `LTI-005`, `LTI-008`, `LTI-012`, `LTI-013`, `AUTH-001` (contract checks only) |

## The problem

All Canvas and Feide behaviour in the tests comes from `tools/mock-platform`, written from Instructure's and Feide's
public documentation and source code. The build environment could never reach HVL's Canvas or Feide (Q7). Where the
mock is wrong, the tests pass and production fails. The mocks' module headers cite the Canvas source line behind each
behaviour; a few are still marked *(verify)*, such as whether Canvas caps an AGS `limit` and how it refuses
progress values outside AGS 2.0's lists.

## What exists

`apps/server/live/` states the facts the mocks assume as checks that run against either platform:

- **Token endpoint:** the assertion's audience, the token answer, a refused audience, a scope the key lacks.
- **AGS:** the line item a Deep Linking return created (maximum, resource ID, tag), its label, reads, 404 for a
  missing line item, 401 without the score scope, 422 for a user outside the course, a real score from our client.
- **NRPS:** the media type, the full role URI against the short name, no personal fields under `anonymous`, paging
  links, the count by our own rule, 401 without the scope.
- **Feide:** the discovery document's endpoints and methods, and its key set.

It runs only when asked (`npm run test:live`): with `LIVE_TARGET=mock` against the mocks (all 36 tests pass there,
and CI runs it so), or with the `LIVE_CANVAS_*` and
`LIVE_FEIDE_ISSUER` variables against the real services. With nothing set, every check is skipped. The README in that
folder has the steps for ALU's test instance and the safety rules.

## What is left for you

1. **Run it against ALU's test Canvas** (step H of [canvas-acceptance.md](canvas-acceptance.md)) and record the result.
   Each failure is a finding: follow «When a check fails» in the seam's README (a decision first, then the mock and its
   tests, then the code).
2. **Add the checks the seam does not have yet.** Candidates, each a fact the code relies on:
   - the `context_memberships_url` and `lineitem` URLs that launches actually carry (today the seam builds the course's
     URLs itself, in the form Canvas documents); this needs a launch, so it may fit better as a checklist step that
     records the two URLs' form;
   - `Retry-After` on a 429 from Canvas (the worker honours it; Canvas's throttling is per developer key);
   - a stale timestamp: a score older than the stored one (the mock answers 400);
   - the token endpoint's answer to an expired assertion and to a reused `jti` (the mock is stricter than Canvas on the
     `jti`, on purpose).
3. **Keep it alive.** CI runs `npm run test:live` with `LIVE_TARGET=mock` after the end-to-end step (D-101's
   integration amendment of 2026-11-05), so a change to the mock or to the server's clients that breaks a check is
   seen at once. Keep that step green when you change either, and add each new check so that it runs there too.

## Rules that must hold

- Test accounts in a test course only; never a course with real students (`DATA-010`).
- The tool key is read from the test server's database, read-only; tokens and keys never leave memory (`DATA-009`).
- The seam does not replace the mock-platform tests: those test our code against every fault; the seam tests the mock
  against the real thing.
