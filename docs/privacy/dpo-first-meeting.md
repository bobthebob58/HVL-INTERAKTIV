# Brief for the data protection officer's first meeting

| | |
|---|---|
| **For** | HVL's data protection officer (DPO, *personvernombod*), before a first meeting with the repository owner |
| **Written** | 2026-11-28, at the repository owner's request, by the same AI assistant (Claude) that wrote the code. Reviewed by nobody yet |
| **What it is** | A short way into [DPIA-INPUT.md](DPIA-INPUT.md). It adds nothing: every statement comes from that document, and where the two differ, that document is right. It is engineering input, not a legal conclusion |
| **Keep it true** | `npm run privacy:dpia-check` fails when the table in §3 does not name every residual of DPIA-INPUT.md §12 exactly once, or when a count in it is wrong. A step that adds a residual adds it here too |

## Samandrag på nynorsk

> Dette samandraget er ikkje gjennomgått av språkrådgjevarane ved HVL.

HVL Interaktiv er eit verktøy der tilsette ved HVL lagar interaktive H5P-aktivitetar, og der studentar speler dei i
ein portal med Feide-innlogging og i Canvas. Studentane er lagra under pseudonym, aldri med namn, e-postadresse eller
Feide-ID. Lærarane ser berre samla tal, og grupper under fem er skjulte. Læringsdata blir sletta kvart år. Ingenting
er køyrt mot HVL sitt ekte Canvas, Feide eller tenarar enno, og berre oppdikta data er brukte. Dette notatet er til
personvernombodet før eit første møte. Det seier kva tenesta gjer med personopplysningar (del 1), kva vi ber
personvernombodet om (del 2), dei opne punkta sorterte etter tema (del 3), kva for nokre vi rår til å sjå på først
(del 4) og kva møtet bør avgjere (del 5). Grunnlaget er DPIA-INPUT.md. Der dei to dokumenta ikkje seier det
same, er det DPIA-INPUT.md som gjeld. Resten av notatet er på engelsk, som utviklardokumentasjonen elles.

## 1. What the service does with personal data

The longer account is in [DPIA-INPUT.md](DPIA-INPUT.md) §1–§10; every stored field is in
[DATA-INVENTORY.md](DATA-INVENTORY.md).

- **Who.** Learners (HVL students and anyone a Canvas course enrols), staff who author activities, a few named
  administrators, and HVL operations. HVL is the controller.
- **Why.** So a student can resume an activity, so a teacher can see in aggregate what a group finds hard before
  the next seminar, and so a graded Canvas assignment gets a formative score. Not for surveillance, ranking,
  research or exam evidence (§2).
- **Learners are pseudonyms.** A learner is stored under a keyed hash made with that academic year's secret. A
  learner row never holds a name, e-mail address, Feide ID, national identity number or raw Canvas user ID. Raw
  identifiers exist only in memory, in the launch record for 24 hours, in the portal session for at most 12 hours
  (encrypted), and encrypted in the grade job until 30 days after it stops (§3).
- **What is stored under the pseudonym.** Saved progress; learning events cut down to a fixed list of fields
  (which activity, question or decision, score, chosen options or short gap text, time); one grade job per graded
  Canvas placement (§3).
- **Pseudonymous is not anonymous.** While HVL holds a year's secret, it can link that year's rows to a person.
  The tool for access and erasure requests does exactly that (§3, §9).
- **What a teacher sees.** Aggregates only, for one activity, version, course (or the portal) and fixed period at
  a time. Groups under five are hidden. Admins see no insight (§1, §4).
- **How long.** Learning data is deleted by the yearly purge after 1 August (by default on 31 August), and that
  year's secret is destroyed afterwards, by hand (R15). Audit records are to be kept for 2 years; their deletion
  is not built yet (R27; §8).
- **Staff.** Display name from Feide, a keyed hash of the Feide ID, what they authored and co-authored, and audit
  events about what they did. Staff e-mail is not stored (§3).
- **Where it stands.** Nothing has run against HVL's real Canvas, Feide or servers. Only made-up data and test
  users have been used. A pilot with real students needs the DPO's approval of the impact assessment and a human
  security review first ([docs/assurance/README.md](../assurance/README.md)).

## 2. What the DPO is asked for

DPIA-INPUT.md §13 has the nine questions in full. In short:

1. Is GDPR Art. 6(1)(e) the right basis for learners' data, and which Norwegian provision supplements it? And for
   staff data?
2. May the service's cookies be set without consent, as strictly necessary?
3. For each residual in §3 below: accept it, or choose one of the options the DPIA input gives.
4. How audit rows, staff accounts and staff members' own requests are handled at erasure (R16, R22).
5. The routine for an objection (R34) and for a staff member who leaves HVL (R28).
6. Whether the privacy notice needs the changes listed in R32.
7. What an anonymised research export would need. Nothing is built until then.
8. Whether people from other Feide organisations may use the portal as learners (R37), and who the read-only
   analytics role is for.
9. Whether the basis is enough for a Branching Scenario's choices, which can show an attitude (R43), and whether
   one decision's figures may bound another's hidden number in a small group (R42).

## 3. The residuals by theme

A residual is a risk that a decision accepted, narrowed or left open. Each has a row in DPIA-INPUT.md §12 with the
mitigation in place, who decides and the options. The themes below are this brief's own sorting, for reading; §12
sorts them by risk.

| Theme | How many | Residuals | What they are about |
|---|---|---|---|
| Working out one learner from group figures | 12 | R1–R4, R6–R8, R10, R14, R36, R41, R42 | Figures that are not hidden, or that can be combined: counts in a colleague's course, 0 % and 100 %, differences between two figures or two periods, students who read insight, learners who cooperate with the reader, a scenario's decisions |
| Kept longer than needed | 7 | R5, R15–R18, R27, R28 | The ended year until the purge and until its secret is destroyed (a manual step); the encrypted Canvas user ID; audit records that nothing deletes after 2 years yet; staff accounts that are never deleted automatically; aggregate snapshots that outlive the year; small leftovers |
| Around the application: hosting, logs and other systems | 7 | R23–R26, R35, R38, R39 | Where the data actually lives; the reverse proxy's own log; the analytics role; Panopto in the learner's browser; the virus scanner's log; build-machine details in H5P code |
| Personal data where the design does not expect it | 6 | R29, R30, R31, R37, R40, R43 | Free text from learners; people named or shown in authored content; learners from outside HVL; employees as learners; Feide's unused e-mail scope; what a scenario's choices say about a learner |
| Rights and the erasure tool | 5 | R19–R22, R34 | Objection without a per-person opt-out; staff requests outside the tool; the operator's terminal; an erasure interrupted before its audit event; a rare race at login |
| Figures that could mislead a teacher | 4 | R9, R11, R12, R13 | What "first answer" means; the completion rate's base; the hours around 1 August; how Canvas's test student is recognised |
| What people are told | 2 | R32, R33 | The privacy notice against what was built; the audit log used for pilot measures |
| **All** | **43** | R1–R43 | |

Who decides is named per row in DPIA-INPUT.md §12. The DPO decides most of them, alone or with the owner. HVL IT
or HVL operations have a part in R15, R21, R23–R28, R35, R37 and R38, TeCopp (Canvas at HVL) in R11 and R13, and
ALU in R3, R9, R30, R31 and R43.

## 4. Suggested to look at first

The order is the author's suggestion for a first meeting. It is not a ranking by seriousness: the DPIA input does
not rank its residuals.

| Residuals | Why first |
|---|---|
| R15 | Until operations destroy an ended year's secret, that year's database and backups stay linkable to people. The step is manual: it needs a place in HVL's yearly operations calendar |
| R37 | Anyone with a Feide login can play activities shared with «anyone with Feide», and Feide also serves schools, so that can include pupils. No learning event of theirs is stored, but an account, the login log and their saved progress are. Restricting the Feide registration to HVL is a setting |
| R36, R41 | Who reads insight, and who is counted in it. A teaching assistant in Canvas, who can be a student, sees the aggregates. A reader who has four cooperating learners in a group of five can work out the fifth's answers |
| R43, R30 | A Branching Scenario's choices are stored per pseudonym (added 2026-11-28) and can show an attitude, not only knowledge; typed answers can hold anything a learner writes. Both point to guidance for authors |
| R32 | The privacy notice says some things that are not built as written, for example a logged support action for administrators and automatic deletion of the login log. The text is ours to correct once the DPO has read it |
| R24, R26 | Facts only HVL IT has: where the database, the storage and the backups stand, and that the reverse proxy does not log query strings |

## 5. What the first meeting should decide

1. Who completes the formal impact assessment (GDPR Art. 35) from the DPIA input, and when.
2. Which residuals must be settled before a pilot with real students, and which can wait.
3. Which decisions need the owner in the room (§13 names R1, R2, R3 and R36; §12 also names the owner for R41,
   R42 and R43, among others), and which need HVL IT (most of §3's third row).
4. Who answers the facts marked *(verify)* in the DPIA input, for example the size of the pilot.
5. Whether the privacy notice (`/personvern`) is corrected before or after the DPO's review of R32.

## 6. What this brief is not

Not a legal conclusion and not the impact assessment. It has not been reviewed by a person. The residuals are the
ones the builder found and wrote down; nobody outside the project has looked for others
([docs/assurance/human-review.md](../assurance/human-review.md)).
