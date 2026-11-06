# Canvas acceptance checklist (ALU's test instance)

| | |
|---|---|
| **For** | HVL's bachelor students and TeCopp, against ALU's Canvas test instance; never a course with real students |
| **Decisions** | D-101 and its amendment of 2026-11-05; the facts it confirms come from D-049 (the mocks), D-050, D-051, D-061, D-063, D-102, D-104, D-105 |
| **Reference** | [docs/reference/canvas-platform-values.md](../reference/canvas-platform-values.md) (the values and their sources; §10 lists what only TeCopp can tell) |
| **Automated half** | [apps/server/live/](../../apps/server/live/README.md), run in step H |
| **Questions it answers** | Q3, Q4, Q8, Q13; the *(verify)* marks of spec 02 and of `tools/mock-platform` |

Every Canvas test in the repository runs against the mock Canvas. This checklist is the part of the confirmation a test
cannot do: a teacher's and a student's browser in the real Canvas. Each step names what the mock assumes, so a
difference points at the file to change.

**When Canvas differs from the mock:** record it, then a decision or an amendment in `docs/DECISIONS.md` first, then
the mock and its tests (`tools/mock-platform/test/`), then the server code and its tests, then run the step again.
Never change only the code.

## Recording a run

Copy the results table at the end into `docs/handoff/results/<YYYY-MM-DD>-canvas.md` (create the folder with the
first run). Write the date, the Canvas instance (test or beta), the server's commit and, per step, *pass*, *differs*
(with what Canvas did) or *not tried* (with why). **No personal data:** no names, e-mail addresses, Canvas or Feide user
IDs, LTI `sub` values or tokens; crop or cover screenshots, since Canvas shows the user's name and picture
(D-101's amendment on problem reporting).

## A. Set-up

| Step | Do | Expect | The mock assumes (where) | Answers |
|---|---|---|---|---|
| A1 | Run a test server on an https address Canvas can reach (`deploy/`, [docker.md](../ops/docker.md)); `PUBLIC_BASE_URL` is that address | `/healthz` answers `{"status":"ok"}`; `/lti/keys` lists one key per platform | — | — |
| A2 | Paste `docs/reference/canvas-lti13-developer-key.json` into *Developer Keys → + LTI Key → Paste JSON*, with the test server's address in place of `https://interaktiv.hvl.no` (also `extensions[].domain`), and the redirect URI `<address>/lti/launch`; turn the key on and deploy it to the test course or its account | Canvas accepts the JSON; the key shows the three scopes, `privacy_level` Private (anonymous) and three placements | `canvasIdTokens.mjs` (claims), `canvasServices.mjs` (`MOCK_CANVAS_SCOPES`) | Q4 |
| A3 | Write down the client ID and the deployment ID; put them in the test server's `LTI_PLATFORMS` (the test column of canvas-platform-values.md §1) and the institution domain in `CANVAS_ORIGINS`; restart | The start-up log reports the platform registered; no secret in the log | `mockPlatform.mjs` (`LTI_PLATFORMS`) | Q4 |
| A4 | Make a test course with one test teacher and at least two test students; install the tool | — | `canvasMemberships.mjs` (demo roster) | — |
| A5 | Check the scopes are not restricted for the account (canvas-platform-values.md §10 item 5) | — | — | Q4 |

## B. Launches

| Step | Do | Expect | The mock assumes (where) | Answers |
|---|---|---|---|---|
| B1 | As the teacher who owns the activity (or a co-author), open a module item that places it, published | `/app/play` in the Canvas frame with **Spel**, **Rediger**, **Innsikt** and **Poeng til Canvas**; a teacher who may not edit sees **Spel** only (the launch tells the page only `mayEdit`, D-106's amendment) | `canvasIdTokens.mjs` (roles, context, custom `contentId`) | `LTI-006` |
| B2 | As a student, open the same item | The player only; no **Rediger** or **Innsikt** | `ltiVocabulary.mjs` (`CANVAS_USERS`) | `LTI-004` |
| B3 | Repeat B2 in Safari, and in Chrome with third-party cookies blocked | The launch works through LTI Platform Storage; the answer is kept after a reload | `platformStorageFrame.mjs`, `canvasAuthorize.mjs` (`lti_storage_target`) | `LTI-003`, D-050 |
| B4 | After a launch, look at the address bar and the browser's history | No `ltik` in either | — | `LTI-003` |
| B5 | Open a link to an unpublished or deleted activity | A friendly page in the launch's language, no stack trace, no redirect loop | — | `LTI-006` |

## C. Deep Linking

| Step | Do | Expect | The mock assumes (where) | Answers |
|---|---|---|---|---|
| C1 | In a module, *Add item → External tool → HVL Interaktiv* (`link_selection`); pick one activity | A module item that launches it; no gradebook column | `deepLinkReturn.mjs`, `canvasIdTokens.mjs` (`accept_multiple`) | `LTI-005` |
| C2 | Make an assignment with *External tool* (`assignment_selection`); pick a published activity that sends a score | A gradebook column with 100 points, named «Tittel (formativ)» in `suffix` mode; in `preserve` mode the teacher's own name is kept and the description says the points are formative | `canvasLineItems.mjs`, `deepLinkReturn.mjs`; `formativeLabel.ts` *(verify)* | `LTI-005`, `LTI-013`, Q8 |
| C3 | In C2's picker, look at an activity that never sends a score (an ImageHotspots, say) | The picker's no-score notice shows; that proves the server saw the graded placement | `canvasIdTokens.mjs` (`https://www.instructure.com/placement`, else `hvl_placement`) | Q13 |
| C4 | In `link_selection`, try to pick two activities | Canvas's claim decides: several items only when `accept_multiple` is `true` (the code says true, the documentation says one, canvas-platform-values.md §11) | `ltiVocabulary.mjs`, `canvasIdTokens.mjs` | `LTI-005` |
| C5 | As an admin, the rich content editor's button (`editor_button`, visible to admins only) | The picker opens; the inserted link launches | `ltiVocabulary.mjs` (`acceptedItemTypes`) | `LTI-005` |

## D. Grades

| Step | Do | Expect | The mock assumes (where) | Answers |
|---|---|---|---|---|
| D1 | As a student, answer C2's activity | Within about a minute (the worker runs every 15 seconds) the gradebook shows the score (100 when every answer is right); the teacher's «Poeng til Canvas» panel counts one sent | `canvasScores.mjs`, `canvasTokenEndpoint.mjs` | `LTI-012`, D-104 |
| D2 | Answer again with a different result, under the placement's attempt policy (`best` by default) | The gradebook follows the policy | `canvasScores.mjs` (timestamps) | `LTI-012` |
| D3 | As the teacher, preview the activity in `/app/play` | No score reaches the gradebook, and nothing is stored | — | D-102 |
| D4 | Delete C2's assignment in Canvas, then let a student answer again | The panel counts the job as orphaned, not failed; no retries | `canvasLineItems.mjs` (404 after deletion) | `LTI-012` |
| D5 | Look at how the score shows in the gradebook and in the student's grades | Both say, or the description says, that the points are formative (D-105) | — | `LTI-013`, Q8 |

## E. Names and Roles, insight

| Step | Do | Expect | The mock assumes (where) | Answers |
|---|---|---|---|---|
| E1 | After a launch, open **Innsikt** as the owning teacher or a co-author | The number of learners in the course equals the active test students; who played shows from the next day (D-106's period rule) | `canvasMemberships.mjs` (full role URI, paging) | `LTI-008`, `INS-001` |
| E2 | Inactivate one test student's enrolment, launch again after an hour (the count is cached for an hour) | The count drops by one | `canvasMemberships.mjs` (`status`) | `LTI-008` |

## F. Course copy and Student View

| Step | Do | Expect | The mock assumes (where) | Answers |
|---|---|---|---|---|
| F1 | Copy the test course in Canvas (as TeCopp does each term); launch the copied items as a teacher of the new course who is not a co-author | The activity plays, with **Spel** only: no **Rediger**, and no **Innsikt** tab yet, although the insight API admits this teacher for the new course (D-106's amendment; `LTI-007`'s insight in Canvas is part of [canvas-studio.md](canvas-studio.md), Part 3); a graded item gets its own column | `canvasIdTokens.mjs` (`custom` kept on copy) *(verify)* | `LTI-007`, D-060 |
| F2 | Use Canvas's Student View in the test course and answer | The score reaches the test student's row; insight does not count the test student | `src/lti/LtiRoleMapper.ts` (`LTI_TEST_USER_ROLE`, the role URI Canvas is assumed to send; the mock launches it as a custom role in `e2e/insightInCanvas.e2e.test.ts`) | D-102's amendment |

## G. Accounts and Feide

| Step | Do | Expect | The mock assumes (where) | Answers |
|---|---|---|---|---|
| G1 | With `"feideLinking": true` on the **test** platform only: log in to the portal with the test teacher's Feide account first, then open C1's picker in Canvas | The picker lists the portal account's activities; the audit holds a `link.feide-lti` event. If not, `feide_login` is not the Feide ID at HVL: set `feideLinking` back to false and report it | `canvasIdTokens.mjs` (`$Canvas.user.loginId` substituted under anonymous) | Q4, `AUTH-005`, D-063 |
| G2 | With HVL's Feide registration (Q3): log in to the portal as a test employee and as a test student, then log out | Employee: author; student: learner; logout ends at Feide and back on `/auth/logged-out` | `mockFeide.mjs`, `feideUsers.mjs` (claims, Groups API) | Q3, `AUTH-001`, `AUTH-002` |
| G3 | As the database owner, read the newest `LtiIdToken` row's claims after a student's launch | `sub`, roles, context and custom fields; no name, e-mail or `feide_login` | `ltiIdTokenClaims.ts` (D-052) | `DATA-002`, `AUTH-004` |
| G4 | Search the server's log for the test run's period | No ltik, token, `sub`, name or e-mail | — | `DATA-009` |

## H. The automated contract checks

| Step | Do | Expect | Answers |
|---|---|---|---|
| H1 | `LIVE_TARGET=mock npm run test:live` on your machine | 36 passed: the checks work | — |
| H2 | Fill in `apps/server/live/.env` (the seam's README), then run the same command without `LIVE_TARGET` | Every check passes; each failure is a fact the mock got wrong | `LTI-005`, `LTI-008`, `LTI-012`, `LTI-013`, `AUTH-001` |
| H3 | Paste the summary lines (not the whole output) into the results file | — | — |

## I. Dynamic Registration (only once built)

The steps are in [dynamic-registration.md](dynamic-registration.md), "Tests it needs"; a Canvas administrator does them.

## Results table

| Step | Result | What Canvas did, if it differs | Follow-up (decision, issue) |
|---|---|---|---|
| A1 | | | |
| A2 | | | |
| A3 | | | |
| A4 | | | |
| A5 | | | |
| B1 | | | |
| B2 | | | |
| B3 | | | |
| B4 | | | |
| B5 | | | |
| C1 | | | |
| C2 | | | |
| C3 | | | |
| C4 | | | |
| C5 | | | |
| D1 | | | |
| D2 | | | |
| D3 | | | |
| D4 | | | |
| D5 | | | |
| E1 | | | |
| E2 | | | |
| F1 | | | |
| F2 | | | |
| G1 | | | |
| G2 | | | |
| G3 | | | |
| G4 | | | |
| H1 | | | |
| H2 | | | |
