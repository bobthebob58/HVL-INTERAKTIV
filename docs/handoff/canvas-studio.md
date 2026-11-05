# Design note: the Canvas side of the studio

| | |
|---|---|
| **Status** | Not built. S5 built the studio in the portal; D-098 moved its Canvas side to S6, and D-101 passes it to you |
| **Requirements** | `LTI-005` (MUST: the bank and "new from a pattern" in the picker; its "E2e in J1"), `LTI-007` (SHOULD: duplicate in Canvas), `PROD-001`, `PROD-007` |
| **Decisions to read first** | D-061, D-062, D-063 (account linking), D-085 (creating from a pattern), D-089 (studio access), D-090 and D-091 (staff names and the bank), D-092 (duplicating), D-093 (safe editing), D-098, D-101 |
| **Code to read first** | `apps/server/src/lti/deepLinking/` (the picker), `src/lti/play/` (`/app/play`, `/lti/edit`), `src/learningDesign/http/studioPrincipal.ts`, `src/learningDesign/patterns/PatternCreator.ts`, `src/learningDesign/collaboration/` (bank, duplicate, staff eligibility), `apps/web/src/features/lti/LtiPlayView.tsx` |

## What exists

- **The Deep Linking picker** (`/lti/deeplink`, server-rendered, D-048 and D-067) lists the author's own and
  co-authored activities, refuses drafts with 409 and returns `ltiResourceLink` items, with a `lineItem` for
  `assignment_selection` only (D-061, D-105).
- **`/app/play`** shows **Spel** to everyone, and **Rediger**, **Innsikt** and **Poeng til Canvas** to a launch that may
  edit (the owner and co-authors), because the launch tells the page only `mayEdit` (D-106's amendment). A teacher of
  a copied course may play but not edit (D-060); the insight API admits them for their own course, but the page shows
  them no **Innsikt** tab yet.
- **The studio's routes are portal-only.** `requirePortalAuthor` answers 401 to an ltik (patterns, learning design,
  collaboration, mappe), so nothing in Canvas can reach the bank, the patterns or duplicating today. The publish route
  (`POST /api/content/:contentId/publish`) is `auth: 'either'`, so an LTI author can already publish through the API.
- **Who an LTI author is:** a Canvas-side account, unless the platform has `"feideLinking": true` and the teacher's
  `feide_login` matched an HVL Feide account (D-063, Q4). An LTI principal is never an HVL member (`hvlMember` is
  false): Canvas does not say whether a teaching assistant is staff or a student (Q30).

## Part 1: the content bank in the picker

**The constraint.** The bank shows colleagues' names and is for HVL staff only (D-090, D-091): staff eligibility is a
Feide login with a staff affiliation in the last 13 months (`staffEligibility.ts`). A Canvas launch cannot prove that.

| Option | For | Against |
|---|---|---|
| **A. Only for a linked account** (recommended): the picker shows a «Frå innhaldsbanken» list when the launch's account is a linked Feide account that is staff-eligible now; otherwise a short notice and a link that opens the portal's bank in a new tab | Reuses D-091's rule unchanged; no staff names reach an unlinked Canvas user | Needs `feideLinking` on (Q4) to be useful in Canvas |
| B. Any Canvas author in HVL's Canvas | Works at once | Student TAs would see staff names (Q30); a privacy change for the DPO |
| C. The bank without names in Canvas | No names leak | A second bank view to maintain; the attribution rules of D-092 still name the source author |

Choosing an activity from the bank in the picker means copying it first (D-091: the bank lists, a copy is placed),
then returning the copy's link. The copy goes through `ContentDuplicator` with the picker's account as owner.

## Part 2: "new from a pattern" in the picker (J1)

J1 in spec 00 §3 is the whole story: picker → pattern → editor → **Sjekk og publiser** → returned as a graded link.
The pieces exist except the Canvas-side check-and-publish view and an ltik route to `PatternCreator`.

Recommended flow, all inside Canvas's modal frame with the Deep Linking launch's ltik:

1. The picker offers «Lag ny frå mønster» next to the list; it opens a pattern list (the same `content/` patterns).
2. Creating calls `PatternCreator` through a new route that accepts the ltik of a Deep Linking launch (an author role
   in that launch), with the LTI account as owner. One request, as D-085 says.
3. The editor opens in `/lti/edit` (exists; the Canvas save choice of D-093 applies).
4. A Canvas view of **Sjekk og publiser** (reuse `CheckPanel` and `PublishDialog` from `apps/web`) publishes through the
   existing route.
5. Back in the picker, the new activity is selected and returned. Canvas closes the modal.

Open points to decide first: whether a Canvas-only author (no linked Feide account) may create from patterns at all
(the draft then lives only on the Canvas side, D-063); how long the Deep Linking launch may stay open while the teacher
writes (the ltik lives 24 hours with its stored launch, `ID_TOKEN_LIFETIME_MS` in
`src/lti/storage/ltiRecordLifetimes.ts`, D-052; Canvas's modal has no documented limit *(verify)*);
and whether the picker's `data` claim must be echoed after so long.

## Part 3: duplicate in `/app/play` (`LTI-007`)

A teacher in a copied course may play the original but not edit it. `LTI-007` lets them **duplicate** it into their
own library, and also says they "view insight for their own context": the API allows that today, but `/app/play`
shows the **Innsikt** tab only to a launch that may edit, so the page needs to learn more than `mayEdit` (a launch
fact such as "author role in this course") before such a teacher sees the tab. The hard part is what happens to the Canvas link afterwards: it still names the original's
`custom.contentId`, and LTI gives the tool no way to change a placed link.

| Option | For | Against |
|---|---|---|
| **1. Duplicate, then place the copy again** (recommended first): the copy is made (D-092's rules), and `/app/play` tells the teacher to replace the module item through Deep Linking | No new server concept; grades, insight and learner state stay attached to what was played | The teacher does two steps; a graded copy gets a new gradebook column |
| 2. Re-point the placement: a stored override per `LtiPlacement` so the existing link plays the copy | One step; the gradebook column stays | A new indirection in every launch (`LTI-006`); students' saved progress, insight and the grade bridge's history are keyed by `contentId` and split mid-term; who may set it, and should the original's owner know? Needs its own decision and a privacy review |

Whatever is chosen: the copy belongs to the launch's account; source attribution must not show a staff member's name
to an unlinked Canvas account (D-090); the copy is rate-limited as in the portal (D-092's per-person limit).

## Tests it needs

- Integration tests through the mock Canvas: a Deep Linking launch that creates from a pattern, publishes and returns
  a signed JWT with a `lineItem` (`LTI-005`); the bank shown only to a linked, eligible account and refused otherwise;
  a duplicate in a copied course (`LTI-007`).
- The J1 end-to-end test's Canvas half in full Chromium (`apps/server/e2e/`, D-065). D-101 lets S6 split J1 while this
  is missing, with a `SPEC-DEVIATION` for `LTI-005`'s "E2e in J1"; this test ends that deviation (check PROGRESS for
  whether S6's integration step split it).
- The accessibility suite for every new view (`apps/server/a11y/`), in `nn`, `nb` and `en`.
- The acceptance checklist's step C against ALU's test Canvas.
