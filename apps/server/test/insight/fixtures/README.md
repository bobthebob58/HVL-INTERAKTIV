# The 30-learner insight fixture (INS-001 … INS-006)

INS-001's acceptance asks that the insight numbers "match a hand-calculated fixture of 30 synthetic learners". These
files hold that fixture, and this README holds the hand calculation. The tests (`../thirtyLearners.test.ts`,
`../videoLearners.test.ts`, `../insightService.int.test.ts`) compare the code's numbers with the values below, written
as literals, so a change in the code cannot change what is expected.

| File | What it holds |
|---|---|
| `insightActivities.ts` | The parameters of the three activities: a QuestionSet (MultiChoice `Q1`, Blanks `Q2` with 2 gaps, DragText `Q3` with 2 drop zones), an InteractiveVideo without a submit screen (`IV1` MultiChoice at 150 s, `IV2` TrueFalse at 300 s, `IV3` Blanks at 450 s, a Text at 60 s that sends nothing; stored out of time order on purpose), and an ImageHotspots. |
| `thirtyLearners.ts` | The stored `XapiStatement` rows of learners L01–L30, as D-115 stores them (root `attempted` per page load, a part's `answered`, the QuestionSet's root `completed`), and the rows a view must leave out. |

No personal data: learner keys are `fixture-learner-NN`, the texts are made up.

The view: the QuestionSet, version 2 (current), Canvas course A, period `7d` computed on Wednesday 4 November 2026 at
13:00 Oslo time, so from midnight Oslo time on 28 October (`2026-10-27T23:00:00Z`, CET). *k* = 5. The course's NRPS
count is 40.

## The QuestionSet: who did what

Each learner's first page load starts at `2026-11-02T08:00Z` + (n − 1) × 15 min. «Time» is the last stored statement
minus the first, per page load, summed (D-115).

| Group | Learners | Q1 (MultiChoice, option 0 right) | Q2 (Blanks: `uthenting` · `spreidd/spredt`, not case-sensitive) | Q3 (DragText: `samling` · `forarbeid`) | Root results | Time (min) |
|---|---|---|---|---|---|---|
| A | L01–L12 (12) | `0` ✓ | `uthenting` · `spreidd` (2/2) | `samling` · `forarbeid` (2/2) | 5/5 (1 attempt) | 6, 7, 8, 8, 9, 10, 10, 11, 12, 12, 13, 14 |
| B | L13–L20 (8) | first `1` ✗, then `0` ✓ | first `henting` · `spredt` (1/2), then 2/2 | first `forarbeid` · `samling` (0/2), then 2/2 | 1/5, then 5/5 (2 attempts) | 15, 16, 18, 20, 21, 22, and L19 10 + 12 = 22, L20 14 + 16 = 30 (two page loads) |
| C | L21–L23 (3) | `2` ✗ | `␣Henting␣` · empty (0/2) | — | none | 4, 5, 6 |
| D | L24–L26 (3) | `3` ✗ | `UTHENTING` · `spreidd` (2/2) | `samling` · `etterarbeid` (1/2) | 3/5 (1 attempt) | 9, 10, 11 |
| E | L27–L28 (2) | — | — | — | none | none (one statement each; L27's is at exactly the period's start) |
| F | L29–L30 (2) | played on 20 October only: outside the period | | | | |

Left out of the view as well (`questionSetNoise`): L01's page load 30 minutes before the period's start (a wrong Q1
answer that must not become L01's first), L02's play of version 1, L05's play in course B and L10's play in the portal.

## INS-001 participation

- Started: A 12 + B 8 + C 3 + D 3 + E 2 = **28** (F is outside the period).
- Completed (a stored root result): A 12 + B 8 + D 3 = **23**.
- Completion rate, base the course's NRPS count: 23 / 40 = **0.575**. In the portal (no NRPS): 23 / 28 = **0.8214**.
- Median attempts over the 23 completers: fifteen 1s (A, D) and eight 2s (B); the 12th value is **1**.
- Median time over the 26 learners with a measured time (E has none): sorted 4, 5, 6, 6, 7, 8, 8, 9, 9, 10, 10, 10,
  11, 11, 12, 12, 13, 14, 15, 16, 18, 20, 21, 22, 22, 30; the 13th and 14th are 11 and 11, so **11.0** minutes.

## INS-002 item difficulty (first answer · latest answer)

| Item | Learners | First correct | Latest correct |
|---|---|---|---|
| Q1 | 26 (A, B, C, D) | A 12 → 12 / 26 = **0.4615** | A 12 + B 8 → 20 / 26 = **0.7692** |
| Q2 | 26 (A, B, C, D) | full marks: A 12 + D 3 → 15 / 26 = **0.5769** | A 12 + B 8 + D 3 → 23 / 26 = **0.8846** |
| Q3 | 23 (A, B, D) | A 12 → 12 / 23 = **0.5217** | A 12 + B 8 → 20 / 23 = **0.8696** |

Hardest first: **Q1, Q3, Q2**.

## INS-003 misconceptions (first answers, *k* = 5)

- Q1, 26 learners: option 0 **12**, option 1 **8**, option 2 (C, 3) **«< 5»**, option 3 (D, 3) **«< 5»**, no
  answer **0**. Every first answer names one option, so INS-002's share (12 / 26) gives away the right option's 12,
  and the wrong options with «no answer» form a group of their own with total 14. In it two cells are hidden and they
  are not both 1 or both 4, so no complementary suppression is needed (C + D = 6 cannot be split).
- Q2 gap 1, 26 learners: right A 12 + D 3 = **15**, `henting` (B 8 + C 3) **11**, other wrong **0**, empty **0**.
- Q2 gap 2, 26 learners: right A 12 + B 8 + D 3 = **23**, empty (C) 3 → **«< 5»**; it is the only hidden cell, so the
  next-smallest, every shown 0 (here only other wrong), is hidden too: **«< 5»**. (Q2 has two gaps, so INS-002's
  whole-task share does not give away this gap's right answers, and the gap is one group.)
- Q3 gap 1, 23 learners: right A 12 + D 3 = **15**, `forarbeid` (B) **8**, other wrong **0**, empty **0**.
- Q3 gap 2, 23 learners: right A **12**, `samling` (B) **8**; `etterarbeid` (D) was given by 3 < 5 learners, so its
  text is not shown and it counts in other wrong (3) → **«< 5»**; the next-smallest, every shown 0 (here only empty)
  → **«< 5»**.
- With *k* = 3 instead: option 2 and option 3 show **3** each, Q2 gap 2's empty shows **3** and other wrong **0**,
  and Q3 gap 2 lists `samling` **8** and `etterarbeid` **3**, with other wrong **0** and empty **0**.

## The InteractiveVideo (L01–L20, same course, version 1)

| Group | Learners | IV1 (option 0 right) | IV2 (TrueFalse) | IV3 (Blanks) | Time (min) |
|---|---|---|---|---|---|
| G1 | L01–L03 (3) | `0` ✓ | ✓ | answered | 8 |
| G2 | L04–L09 (6) | `0` ✓ | L04 ✓, L05–L09 ✗ | — | 6 |
| G3 | L10–L18 (9) | L10–L12 `0` ✓, L13–L17 `1` ✗, L18 `2` ✗ | — | — | 3 |
| G4 | L19–L20 (2) | — | — | — | none |

- INS-001: started **20**; completed, the rate and attempts **not available** (null: no submit screen, D-115); median
  time over 18 learners (nine 3s, six 6s, three 8s): the 9th and 10th are 3 and 6, so **4.5** minutes.
- INS-005, in playing order: IV1 answered **18**, share 18 / 20 = **0.9**; IV2 **9**, 9 / 20 = **0.45**; IV3 3 →
  **«< 5»** and its share **«< 5»**. The Text at 60 s and the empty summary task are not listed.
- INS-002: IV2 4 / 9 = **0.4444** (first and latest), IV1 12 / 18 = **0.6667**, IV3 (3 learners) hidden and last:
  order **IV2, IV1, IV3**.
- INS-003, IV1, 18 learners: option 0 **12** (INS-002 gives it away), and the wrong options with «no answer» as a
  group of 6: option 1 **5**, option 2 (1) **«< 5»**, and the next-smallest, every shown 0 (no answer), **«< 5»**.

## A hidden group, and an older version

- L21–L23 alone (group C): started 3 → **«< 5»**, and so is every item's learner count, Q3's **0** included: "nobody
  answered Q3" would describe each of the three (`thirtyLearners.test.ts`).
- The same rows reported as version 1 of an activity now at version 2: participation and items as above, and **no**
  misconceptions, since the old version's options and gaps are no longer stored (D-093).

## The ImageHotspots

No statements: started **0**, completed **not available**, no questions, and the report says it sends no learning
data (D-115).
