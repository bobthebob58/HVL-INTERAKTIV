# ALU and pilot review of the læringsdesign studio (Session 5)

| | |
|---|---|
| **For** | ALU (*Faggruppa for digital læringsdesign*) and *Pedagogisk akademi*; HVL's lawyers for the content bank's consent text (§8); the data protection officer for the privacy sentences (§9); pilot teachers for the patterns (§6.3) |
| **Open question** | Q17 in [PROGRESS.md](../../PROGRESS.md); decision D-100 in [DECISIONS.md](../DECISIONS.md) |
| **Status** | Requested on 2026-10-29, **open**. Session 5 closes with it open (owner's decision, 2026-10-28); it must be answered before the pilot |
| **Prepared** | 2026-10-29, by the S5 build, from the workstream reports and the files they wrote |
| **Record the outcome** | In §10 of this file, then in Q17 and the S5 checklist of PROGRESS.md |

## 1. What we ask, and why

The læringsdesign studio of spec 04 is built: the guide and the pattern catalogue on `/laeringsdesign`, the nine
patterns, the **Læringsdesign** tab and the planner, the content bank, and the *pedagogisk mappe* export. Every text
in it was drafted by the build from public sources (the files in `docs/reference/`, compiled through web search),
not from ALU's own documents, which have not arrived yet (Q2). Nobody at ALU has reviewed the texts, and no teacher
has tried the patterns. Until then the studio pages show a banner saying that the texts are proposals ALU has not
approved.

We ask ALU to **confirm, correct or reject** each item in §3–§9, and pilot teachers to **try the patterns** (§6.3).
Every item says where the text lives and how to change it. Most of it is in `content/`, which ALU edits without
code (D-082); a few texts are in the web app's language files and need a developer (§8, §9).

To see the texts in place, open the test server's `/laeringsdesign` (public, no sign-in), a pattern page
(`/laeringsdesign/monster/<id>`), and, signed in as a teacher, the planner (`/laeringsdesign/planlegg`), the content
bank (`/laeringsdesign/innhaldsbank`) and `/mappe`, whose Markdown and PDF downloads show the template and criteria
filled in. Words used below are explained in [GLOSSARY.md](../GLOSSARY.md), section *The læringsdesign studio and
the pedagogisk mappe*.

## 2. How to change something

1. Find the file named in the item below, on GitHub or in a copy of the repository.
2. Read the guide for that folder before editing: [content/README.md](../../content/README.md) (how to edit and
   check), [content/laeringsdesign/README.md](../../content/laeringsdesign/README.md) (phases, references, the guide
   and the patterns) and [content/mappe/README.md](../../content/mappe/README.md) (template and criteria). Each has
   numbered steps for the common changes.
3. Change the text in all three languages: Nynorsk (`nn`), Bokmål (`nb`) and English (`en`). The three must keep the
   same structure (the same headings, markers, citations, criteria and limits); the wording may differ.
4. Run `npm run content:check` from the repository's top folder. It prints `✓` and a summary, or each mistake with
   its file, line and key.
5. Propose the change as a pull request. The same check and the tests run on it. The tests never compare ALU's
   wording, only the structure the specification requires, so a reworded text passes unless it breaks a rule that
   the folder's guide names (each guide has a section «What catches mistakes»).
6. Note the decision and the pull request in §10.

## 3. The phases: `content/laeringsdesign/phases.yaml`

**What:** the names, descriptions, pedagogical purposes and Canvas placements of the three phases, *Forarbeid*,
*Mellomarbeid* (code key `underveis`) and *Etterarbeid* (en: Pre-work, Intermediate work, Post-work), and of the
*samling* they sit around. They appear in the phase matrix, the catalogue's filters, the planner, the
**Læringsdesign** tab and the portfolio (`PED-001`).

**Source:** `docs/reference/proposals/phases.yaml`, derived from the words HVL uses on its public pages, *not* from
ALU's model document (each label carries its confidence as a comment). The purposes and placements come from the
phase matrix in spec 04 §3.

**Please decide:**
- Are these the words HVL uses for the three phases and the *samling*, in all three languages? (Møgelvang &
  Isaksen 2025 describe levels and the parts *kontekst*, *kunnskap* and *samskaping*, not phases; the phases sit at
  the model's *mikronivå* around one *samling*.)
- The Canvas placements describe things that arrive only in Session 6: the insight «Før samlinga» (Forarbeid), and
  scores sent to Canvas as formative assessment with suggested repetition dates (Etterarbeid). Keep them as the
  intended practice, or soften them until S6?
- When everything in this packet is approved, change `status: proposed` to `status: confirmed-by-alu`. That removes
  the draft banner from every studio page (one switch for all studio texts).

**How:** the steps «Change a phase's name or text» in `content/laeringsdesign/README.md`. Never change a `key`.

## 4. The guide: `content/laeringsdesign/guide.nn.md`, `guide.nb.md`, `guide.en.md`

**What:** the text of `/laeringsdesign`, in the order `PED-002` sets: why asynchronous work often fails (three
sentences); «HVL læringsdesign» in brief; three mechanisms, each with a box «Kva dette betyr for aktiviteten din»;
where an activity belongs, with the phase matrix and the catalogue; and where to get help, with links to the ALU
page and the Emnedesign module (UPED854). Every research claim cites a reference from §5 (25 citations).

**Please check:**
- **Claims from search excerpts only** (medium confidence; the full paper was not read). All are in section 2 and
  cite `[@mogelvang2025]`: that the model has three interdependent parts; that it is used at the levels of
  *studieprogram*, *emne* and *læringsøkt*; that it builds on *baklengs planlegging*; and that *mikronivå* is the
  single *læringsøkt*.
- **UPED854:** the sentence saying that participants discuss their own course design in the light of «HVL
  læringsdesign» rests on a search excerpt of the course page and has no entry in `references.yaml`; the English
  UPED854 address also comes from a search excerpt.
- **ALU in English:** no English ALU page or official English name for ALU was found. The English guide links to
  the Norwegian page, marked «(in Norwegian)», and describes ALU instead of naming it.
- **English glosses** made by the build, not taken from the paper: *context*, *knowledge* and *co-creation* for
  *kontekst*, *kunnskap* and *samskaping*, and *micro level* for *mikronivå*. The English guide also keeps the
  Norwegian terms in running text, which the page cannot mark as Norwegian for screen readers (WCAG 3.1.2 allows such
  terms).
- **Paraphrases of the literature** to check against the sources: Schön (1983) on situations where no rule gives
  the answer, and *refleksjon i handling* as worded; van Manen (1991) on pedagogical tact; Mayer (2009), that high
  cognitive load means students learn less; Guo et al. (2014), that engagement drops after about six minutes (the
  paper's median-engagement finding); Hattie & Timperley (2007), that feedback helps most when it is about the task
  and the work, not the person, and says where the student stands and what comes next; Roediger & Karpicke (2006),
  that retrieval strengthens long-term memory more than rereading; Shute (2008) for "feedback on each choice lets
  students learn from the path, not only the outcome", a loose fit, as Shute writes about formative feedback in
  general, not about branching cases.
- **Statements without a citation**, judged not to be research claims: that a fictional case harms no one; where
  HVL Interaktiv's activities sit in the model; and that learning an answer is wrong says little about what to do
  differently (close to a definition; the next sentence cites Shute).
- **Style:** the first sentence of section 1 is about 40 words long, because the specification asks for exactly
  three sentences. Shorten if ALU prefers *klarspråk* over the rule.
- **The page's name:** the heading «Studentaktiv læring med «HVL læringsdesign»» is a working title in the web
  app's language files (`studio.heading`), not in these files. ALU names the page; a developer changes it (§8 says
  how such texts change).

**How:** the steps «Edit the guide» in `content/laeringsdesign/README.md`. Rewording is free. The structure above
(five `##` sections, three `###` mechanisms each followed by a box, the two markers) is checked by a test: changing
it needs a change to `PED-002` in spec 04 first.

## 5. The references: `content/laeringsdesign/references.yaml`

**What:** the 16 full references that the guide and the patterns cite: `mayer2009`, `guo2014`, `szpunar2013`,
`roediger2006`, `brame2016`, `shute2008`, `hattie2007`, `nicol2006`, `cepeda2006`, `dunlosky2013`, `schon1983`,
`vanmanen1991`, `biggs1996`, `wiggins2005`, `mogelvang2025` and `novak1999`.

**Source:** written out from the research table in spec 04 §3. Titles, publishers and editions have not been checked;
no DOI or page number was added that the project's own sources did not give. Every reference says `verify: true`,
and the page adds «(ikkje kontrollert mot kjelda enno)» after each one.

**Please check** each reference against the source, correct its `text`, and set `verify: false`. A reference that is
not in English states its language (`language: nb` for `mogelvang2025`), so screen readers read it with the right
voice.

## 6. The nine patterns: `content/laeringsdesign/patterns/<id>/`

**What:** each folder holds `pattern.yaml` (the name, purpose, when to use it, an example, why it works with its
citations, build and student minutes, and every text the new activity gets, in three languages) and the skeleton
the activity is created from. The texts include the guidance `⟦…⟧` that the author replaces; the check before
publishing reports any guidance left (V-PLACEHOLDER, D-086). Most `pattern.yaml` files start with a comment on what
their skeleton holds (`ea-diagnose`, a single question, has none).

### 6.1 The patterns and what to look at in each

| ID | Draft name (nn) | Content type | Phase | Build / student minutes | Look especially at |
|---|---|---|---|---|---|
| `fa-video` | Kort video med kontrollspørsmål | InteractiveVideo | Forarbeid | 30 / 15 | Three questions at 2:30, 5:00 and 7:30 (MultiChoice, Blanks, MultiChoice) and a summary at the end; the author adds the video and its captions |
| `fa-slides` | Omgrepspresentasjon | CoursePresentation | Forarbeid | 30 / 15 | Six slides: a title, four slides with one concept and one check each (MultiChoice and Blanks in turn), a summary |
| `fa-hotspots` | Visuell gjennomgang | ImageHotspots | Forarbeid | 20 / 10 | Five numbered hotspots in reading order; the author adds the image and its alternative text |
| `ea-diagnose` | Misoppfatningssjekk | MultiChoice | Forarbeid or Etterarbeid | 10 / 3 | One question with four options; each wrong option names the misconception it stands for, and its feedback explains it |
| `uv-case` | Profesjonelt dilemma | BranchingScenario | Mellomarbeid | 60 / 20 | Three decisions, «Prøv avgjerda på nytt» after a choice that leads astray, two endings. Spec 04 says "endings scored for reflection, not judgement": the draft gives every ending the same score, so the score shows that the case was worked through, not which way the student chose. Is that ALU's intent? |
| `uv-module` | Studiemodul | InteractiveBook | Mellomarbeid | 90 / 45 | Three chapters of at most 1 000 words, each ending with a check of three questions (a QuestionSet of three MultiChoice), and the book's summary page; chapter titles are guidance too, since students see them as headings |
| `uv-column` | Fokusert arbeidsøkt | Column | Mellomarbeid | 20 / 10 | An introduction and two tasks (Blanks, MultiChoice); the guidance reminds the author to keep to three tasks |
| `ea-retrieval` | Repetisjonssett | QuestionSet | Etterarbeid | 45 / 15 | Ten MultiChoice questions on one concept, from definition to transfer, each option with its own feedback. The pass mark is 80 %: it chooses the overall feedback and the xAPI "success", while retry and «Vis svar» stay on. Is 80 % right, and is the feedback text for each score range? |
| `ea-terms` | Fagomgrep i kontekst | DragText or Blanks | Etterarbeid | 15 / 5 | One paragraph with six term slots (spec 04 says 6–8; the guidance tells the author they may add up to eight); the author chooses dragging or typing the words |

### 6.2 Questions for every pattern

- Are the name, purpose, when to use it, example and why it works right, and is each cited reference the right
  support for what `whyItWorks` says?
- Are the build and student minutes realistic? The student minutes become the activity's suggested time, which
  students see before they start.
- Is the guidance in each `⟦…⟧` clear enough for a teacher who has not read the guide?
- The formative settings are fixed in every skeleton (`PROD-009`): retry and «Vis svar» on, no time limits, a pass
  mark that is information only. Every Blanks task is not case-sensitive and accepts small typos. A pattern that
  should be strict needs that decided here.
- Several content types have English buttons and messages even in Nynorsk and Bokmål (MultiChoice, QuestionSet,
  InteractiveBook, BranchingScenario). The patterns set those texts themselves in all three languages; please check
  that every word a student sees in an activity made from a pattern is in the activity's language. (Interactive
  Video's «Pause» is the library's own word, kept because it is also Norwegian.)
- `uv-case` asks the author for the start picture's alternative text as guidance. While that guidance is there,
  BranchingScenario reads it out as the picture's name, and the check reports it as an error that the author can
  publish past only with a reason (D-086), like every other guidance left in place.

### 6.3 For pilot teachers: try the patterns

For each pattern a teacher would use: open `/laeringsdesign`, filter the catalogue by phase, open the pattern and
use «Lag frå dette mønsteret»; replace the guidance with real content; fill in the **Læringsdesign** tab; check and
publish from «Sjekk og publiser»; and, where possible, let students use it. Note how long building took against the
pattern's build minutes, where the guidance was unclear, what the check reported, and what students said. Record it
in §10 with the pattern's ID.

**How to change a pattern:** the steps «Edit a pattern» and «Add a pattern» in `content/laeringsdesign/README.md`
(including how to make a skeleton from an exported `.h5p` file). `npm run content:check`, with the content types
installed, checks every text against the length of its field.

## 7. The pedagogisk mappe: `content/mappe/`

**What:** the export's template in three languages (`template.{nn,nb,en}.md`: headings, writing prompts, and places
for the teacher's activities, the reader's guide and the references) and the criteria (`criteria.{nn,nb,en}.yaml`:
the set `hvl-merittering-2025` with HVL's 2025 criteria 1.1–3.3, the chapter that answers each, attachment hints, and
the limits). The table «Status» in `content/mappe/README.md` lists what ALU decides per file.

**Sources:** [hvl-pedagogisk-mappe-criteria.md](hvl-pedagogisk-mappe-criteria.md) (search excerpts of HVL's 2025
merit call, not ALU's guidance) and the proposal [proposals/mappe-template.nn.md](proposals/mappe-template.nn.md).

**How each criterion was sourced** (a comment at each criterion in `criteria.nn.yaml` says the same):
- 1.1 and 2.4 are quoted in Nynorsk. 3.3 is quoted in Bokmål, and the Nynorsk version is known to say «grunngitt
  plan». The other Nynorsk texts are translations of Bokmål quotes, and the Bokmål 1.1 is translated from Nynorsk.
- 1.4 is a **paraphrase only** (low confidence): no wording was found. ALU must give HVL's wording.
- 2.1 is quoted without its number.
- 2.2 keeps the quoted part; its tail (theory on teaching and learning in higher education and/or the subject) was
  only a search summary and is left out.
- 3.2 is quoted without its first words; «har» was added so it reads as a sentence.
- Every English text is a translation; the sources hold the criteria in Norwegian only.
- The 2025 headings of main criteria 1 and 2 (the template's chapters 2 and 3) were not found.

**Please decide:**
- The limits: 7 500 words in Del 1 and 11 attachments, both `verify: true` (the page says «grensene er ikkje
  stadfesta enno» until they are set to `verify: false`).
- The attachment hints: only 1.3 (a summary of feedback), 2.3 (learning resources) and 3.2 (a report on course or
  programme development) have one; the other eight criteria show «[fyll inn vedlegg]» in the reader's guide.
- Whether the reader's guide stands before Del 1 (as now, so its words are not counted) and whether HVL counts it.
- The Del 2 headings, once HVL's «Pedagogisk CV» template is known, and whether the template name «Lederuttalelse»
  is right (medium confidence).
- The set's titles («HVL merittering, utlysinga 2025» and its nb and en forms) and the English names «Teaching
  portfolio» and «Part 1 – Continuous text».
- The italic writing prompts as a whole, and the wording «når du laga han» and «saman med medforfattarar», since a
  co-authored activity may have been made by a colleague.
- Changes from the proposal: Del 3 has a fourth suggestion, «Rapport om utvikling av emne eller studieprogram»,
  from HVL's 2025 examples; three headings were shortened; the activity's status stands next to its content type
  instead of a «publisert» line.
- The *opprykk* (promotion) mode is not in the template; D-094 leaves it to ALU.

**Behaviour to know about** (code, not content; tell us if it matters):
- The Del 1 word count includes the draft's own writing prompts; the template asks the teacher to count again after
  writing.
- An activity's address is plain text in both files, not a link, because the template may not place a value inside
  a link (a safety rule of D-094).
- The template's own links are not limited to `https:` and `mailto:` addresses as the guide's are; the PDF never
  follows them, so this is a question of what the portfolio should point to: check any link the template adds.
- In the downloaded Markdown file, a date such as «29. oktober 2026» shows as «29\. oktober 2026» in a plain-text
  editor (it renders correctly); the escaping keeps teachers' titles from becoming Markdown structure.
- Students' results appear only from Session 6; until then each activity says that there are none yet (D-095).
- A set for a later call (2027) is a content change, but the set used when the teacher chooses none stays
  `hvl-merittering-2025` until a developer changes it.

**How:** the steps «Edit the template» and «Edit the criteria» in `content/mappe/README.md`.

## 8. The content bank's consent text (ALU and HVL's lawyers)

**What:** the text an owner must accept before listing an activity in the content bank (D-091). It says that HVL
colleagues see the activity, the owner's name and its learning design (phase, outcomes, time and purpose); that
they can make and change their own copies; that they do not see the rationale or the course code; and that copies
already made stay when the listing is withdrawn. A note under it says the text is a draft for ALU and HVL's
lawyers.

**Where:** the web app's language files `apps/web/src/i18n/locales/{nn,nb,en}.json`, keys `sharing.bankConsent`,
`sharing.bankConsentHeading`, `sharing.bankConsentCheckbox` and the draft note `sharing.bankConsentDraft`. The
version accepted is stored with each listing in the audit log (`BANK_CONSENT_VERSION`, now 1).

**Please consider:**
- The legal basis for showing a staff member's name to colleagues through the bank, co-author search and a copy's
  attribution «Kopi av … av namn» (D-090–D-092).
- The text does not say that a listing stops showing when its owner is no longer findable HVL staff (no staff
  login with Feide for 13 months, D-091), nor that a copy keeps naming its source's author to the copy's editors.
- Whether withdrawing should do more than stop new copies.

**How:** a developer changes the keys in all three files together, removes `sharing.bankConsentDraft` once the text
is approved, and raises `BANK_CONSENT_VERSION` in `packages/api-contract/src/collaboration.ts` and
`SHOWN_CONSENT_VERSION` in `apps/web/src/features/sharing/BankListingSection.tsx` together (a test checks that they
are equal), so that later listings record the new version.

## 9. The privacy sentences about colleagues (`/personvern`)

**What:** the section «For deg som lagar aktivitetar» on the privacy page says that HVL stores a teacher's name and
e-mail address so that co-authors can find them, and that colleagues who make activities can see the name in
co-author search, on activities in the content bank and on copies, and can find the teacher in the search for 13
months after the last Feide login as staff; students cannot search for staff. (`privacy.staff2`, between them, is
about the login records.)

**Where:** `apps/web/src/i18n/locales/{nn,nb,en}.json`, keys `privacy.staffHeading` and `privacy.staff1`–`staff3`,
pinned to the data inventory `docs/privacy/DATA-INVENTORY.md` by a test. The data protection officer's review of the
whole page is open question Q6.

**How:** as in §8, a developer changes the three files together; a row of the data inventory changes with it when
the facts change.

## 10. Checklist and outcome

Fill in one row per item as the review goes. Outcome: *Approved*, *Approved with changes*, *Not approved* (say what
is needed) or *Not reviewed*.

| # | Item | Reviewer (role, initials) | Outcome | Date | Change (pull request) | Notes |
|---|---|---|---|---|---|---|
| 1 | Phase labels and texts (§3) | | | | | |
| 2 | Guide, nn (§4) | | | | | |
| 3 | Guide, nb and en (§4) | | | | | |
| 4 | References, each `verify` set (§5) | | | | | |
| 5 | Patterns: `fa-video`, `fa-slides`, `fa-hotspots` (§6) | | | | | |
| 6 | Patterns: `uv-case`, `uv-module`, `uv-column` (§6) | | | | | |
| 7 | Patterns: `ea-retrieval`, `ea-terms`, `ea-diagnose` (§6) | | | | | |
| 8 | Pilot teachers' tryout of the patterns (§6.3) | | | | | |
| 9 | Mappe template, nn, nb and en (§7) | | | | | |
| 10 | Criteria texts and attachment hints (§7) | | | | | |
| 11 | Limits: 7 500 words, 11 attachments (§7) | | | | | |
| 12 | Content bank consent text, ALU (§8) | | | | | |
| 13 | Content bank consent text, HVL's lawyers (§8) | | | | | |
| 14 | Privacy sentences about colleagues (§9) | | | | | |

When the review is complete:
1. Merge the pull requests listed above.
2. Set `status: confirmed-by-alu` in `content/laeringsdesign/phases.yaml`, and `verify: false` on each checked
   reference and limit.
3. Write the outcome, with the date and a link to this file, in PROGRESS.md: in the row of Q17 under *Open questions*
   and at «Pilot evaluators from ALU and Pedagogisk akademi review the studio content» in the S5 checklist.
