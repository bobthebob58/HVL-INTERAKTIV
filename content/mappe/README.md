# content/mappe — the template and criteria of the pedagogisk mappe

A teacher at HVL can download a draft *pedagogisk mappe* (teaching portfolio) built from their own activities in
HVL Interaktiv, as Markdown (to edit) or as an accessible PDF (spec 04 §7, `MAPPE-001` to `MAPPE-004`). This folder
holds the two things ALU decides in that document, so they can be changed without code (D-094):

| File | What it holds |
|---|---|
| `template.nn.md`, `template.nb.md`, `template.en.md` | The portfolio's headings and fixed guidance text, with places where the teacher's activities and figures are filled in |
| `criteria.nn.yaml`, `criteria.nb.yaml`, `criteria.en.yaml` | The criteria for merittering, grouped by criteria set (one set per HVL call, e.g. 2025), with each set's limits |

The six files come together: while none of them exists, the page `/mappe` says the portfolio is not ready yet. If only
some exist, the server does not start and names each missing file. Until ALU confirms them, the files are drafts
(open question Q17).

## Status

All six files were written on 2026-10-29 (S5). Every one of them is a **draft** until ALU confirms it (open question
Q17; the review packet is `docs/reference/alu-review-s5.md`, D-100). The sources are
[`docs/reference/hvl-pedagogisk-mappe-criteria.md`](../../docs/reference/hvl-pedagogisk-mappe-criteria.md), which was
put together from public HVL pages through web search and is not ALU's own document, and the proposal
[`docs/reference/proposals/mappe-template.nn.md`](../../docs/reference/proposals/mappe-template.nn.md).

| File | Status | What ALU decides |
|---|---|---|
| `template.nn.md` | Draft: the proposal, adapted to the values, lists and markers below. The notes in it name the HVL source of every rule it states | The headings and writing prompts, among them chapters 2 and 3, whose 2025 wording of main criteria 1 and 2 was not found; whether the reader's guide stands before Del 1 (as now) or inside it; the Del 2 headings, once HVL's CV template is known; the *opprykk* mode |
| `template.nb.md`, `template.en.md` | Drafts translated from the Nynorsk one, with the same structure | The wording |
| `criteria.nn.yaml` | Draft of the set `hvl-merittering-2025`: HVL's 2025 criteria 1.1–1.4, 2.1–2.4 and 3.1–3.3, each with its chapter, three of them with an attachment hint. A note at each criterion says whether its text is quoted, translated from Bokmål or paraphrased | HVL's exact wording of 1.4 (only a paraphrase was found), the rest of 2.2 and the first word of 3.2; the attachment hints; the limits, 7 500 words and 11 attachments, both `verify: true` |
| `criteria.nb.yaml`, `criteria.en.yaml` | Drafts with the same set, criteria, limits and hints | The wording; the sources hold the criteria in Norwegian only, so the English texts are translations |

## The template

The template is ordinary Markdown: `#` headings, paragraphs, lists, `*italics*` for writing prompts, `**bold**`,
tables and links written as `[text](https://…)`. Three things are special:

- **Values** are names in double braces, such as `{{dato}}`. The server fills them in. Only the names listed below are
  allowed, so a misspelt name stops the check instead of silently leaving something out.
- **Lists** repeat a part once per item: everything between `{{#aktivitetar}}` and `{{/aktivitetar}}` is written once
  for each activity the teacher chose. Inside a list you may use its own values and the values of the levels around it.
- **Markers** are names alone on their own line, such as `{{del1_start}}`. They place what the server builds itself
  and mark the parts it counts. Each marker stands exactly once, never inside a list.

Keep each heading short enough to fit on one line in the PDF (about 40 characters for `#` and 50 for `##`). Where a
heading wraps onto a second line, the PDF's bookmark for it loses the space at the line break, so a screen reader
reads two words as one (a limit of the Chromium version the server uses, recorded for the manual PDF check).

Notes for the people who edit the file go between `<!--` and `-->`; they never reach the portfolio, and names written
in them are not checked. A block between two `---` lines at the very top (front matter) is ignored too: the limits
live in the criteria files.

Every value a teacher wrote (an activity's title, a learning outcome, a rationale) is shown as plain text, so a title
such as `# Quiz` stays a title and never becomes a heading or a link. A value that is not known is never empty: it
gets a short placeholder in square brackets or words, such as `[namnet ditt]` or `ingen fase vald`.

### The values

Outside every list:

| Name | What the server writes |
|---|---|
| `forfattar` | The teacher's name, or `[namnet ditt]` |
| `dato` | The day the portfolio was made, e.g. `29. oktober 2026` |
| `k` | The minimum group size for figures about students (5 unless the server is set otherwise) |
| `ordtal_del1` | The number of words in Del 1 (between the Del 1 markers, without the reader's guide and the references) |
| `ordgrense` | The criteria set's word limit for Del 1 |
| `maks_vedlegg` | The criteria set's attachment limit |
| `kriteriesett` | The criteria set's title |
| `aktivitetar_tal` | How many activities the teacher chose |
| `samarbeid_tal` | How many of them have co-authors |
| `resultat_merknad` | One sentence about students' results: that they come in a later version (now), or that the figures are formative, anonymised summaries |

Inside `{{#aktivitetar}}` … `{{/aktivitetar}}`, once per chosen activity:

| Name | What the server writes |
|---|---|
| `tittel` | The activity's title |
| `innhaldstype` | The content type, e.g. `Fleirval` |
| `status` | `utkast` or `publisert` |
| `fase` | The phase's label from `laeringsdesign/phases.yaml` |
| `emne` | The course code |
| `laeringsutbytte` | The learning outcomes with their category, separated by `;` |
| `grunngjeving` | The didactic rationale from the **Læringsdesign** tab |
| `uu_status` | One sentence with the universal design check's errors, how many of them were explained, and warnings |
| `lenke` | The activity's address in HVL Interaktiv |
| `resultat` | One sentence with the anonymised results, or why there are none |
| `deltakarar`, `fullforing`, `median_forsok`, `endring` | The same figures one by one: participants, completion rate, median attempts, change from the first to the last attempt |
| `oppretta`, `endra`, `publisert` | When the activity was made, last changed and published |

Inside `{{#uu_merknader}}` … `{{/uu_merknader}}`, which stands inside `{{#aktivitetar}}`, once per finding of the
universal design check: `alvor` (Feil, Åtvaring or Tips), `melding` (what the check says) and `uu_grunngjeving` (the
reason the authors gave for publishing despite an error, with its date).

Inside `{{#emneoversikt}}` … `{{/emneoversikt}}`, once per course: `emnekode`, `tal` (activities) and `fasar` (how many
in each phase).

`{{^aktivitetar}}` … `{{/aktivitetar}}` is written only when there is nothing in the list.

### The markers

| Marker | What it does |
|---|---|
| `{{lesarrettleiing}}` | Places the reader's guide: a table of every criterion of the chosen set, where in the portfolio it is answered and which attachment documents it. It is built from the criteria file, never written in the template |
| `{{del1_start}}`, `{{del1_slutt}}` | Mark the start and the end of Del 1. The word count covers only what stands between them, without the reader's guide and the references |
| `{{referansar}}` | Places the references: the research the patterns of the chosen activities build on |
| `{{vedlegg_start}}`, `{{vedlegg_slutt}}` | Mark the list of suggested attachments; the page counts its items against the attachment limit |

### What the check refuses

`{{{…}}}` and `{{&…}}` (they would show a teacher's text as Markdown), partials `{{> …}}`, changed delimiters
`{{=… =}}`, HTML such as `<b>` (write `&lt;` for a literal `<`), images, and a value in a place where plain text is
not safe: inside backticks or a code block, in a link address (`[text](https://…/{{x}})`), straight after `\`, `<`
or `]` (so `<{{lenke}}>` and `[Opne]{{lenke}}` are refused: write `{{lenke}}` as plain text), or at the start of a
line right after a table line. A list opened where it does not belong and a value outside its list are refused too.

### A short example

```markdown
# Pedagogisk mappe

{{forfattar}} · {{dato}}

## Lesarrettleiing

{{lesarrettleiing}}

{{del1_start}}

# Del 1 – Samanhengande framstilling

*Ordtal: {{ordtal_del1}} av {{ordgrense}}. Referansane tel ikkje med.*

{{#aktivitetar}}
### {{tittel}}

- **Fase:** {{fase}}
- **Universell utforming:** {{uu_status}}
{{/aktivitetar}}

## Referansar

{{referansar}}

{{del1_slutt}}

# Del 3 – Forslag til vedlegg

{{vedlegg_start}}

1. **Anbefalingsbrev frå leiar** (HVL Interaktiv lagar ikkje dette.)
2. **Dokumentasjon av læringsressursar:** {{#aktivitetar}}{{tittel}}; {{/aktivitetar}}

{{vedlegg_slutt}}
```

## The criteria

Each criteria file lists the sets in the same order, with the same criteria in the same order; only the texts are in
the file's language. A set's limits are the same in every language.

```yaml
version: 1
sets:
  - id: hvl-merittering-2025
    title: HVL merittering 2025
    limits:
      del1Words:
        value: 7500
        verify: true
      attachments:
        value: 11
        verify: true
    criteria:
      - id: "1.1"
        text: har brei erfaring med undervisning og rettleiing og reflekterer over …
        chapter: Del 1, kap. 1 og 2.1
        attachment: Dokumentasjon av læringsressursar
```

- `id` of a set: lower-case letters, digits and hyphens. The set `hvl-merittering-2025` must exist; it is used when the
  teacher chooses none.
- `id` of a criterion: write it in quotes, like `"1.1"`; YAML would otherwise read `1.10` as the number 1.1.
- `chapter`: where in the portfolio the criterion is answered. `attachment` is optional: without it the reader's guide
  says `[fyll inn vedlegg]`, which the teacher fills in.
- `limits`: the most words in Del 1 and the most attachments. Leave a limit out and it is 7 500 words or 11
  attachments, marked to verify. `verify: true` means ALU has not confirmed the value for the call; the page says so.

Choosing another set changes every criterion text, the reader's guide and the limits, with no code change.

## The three languages

The three templates must match: the same markers in the same order, the same lists, the same values in each list and
the same headings by level. The three criteria files must have the same sets, criteria, limits and attachment hints.
Nynorsk is the reference; a difference is reported in the Bokmål or English file, at its line.

## Privacy

The portfolio never names a student, never shows a student's answer and never shows a single student's score. Figures
about students are totals for groups of at least `k` students; a smaller group shows one sentence and no figure
(`MAPPE-003`). The server makes the portfolio when the teacher downloads it and keeps no copy.

## What catches mistakes

`npm run content:check` (see [../README.md](../README.md)) checks these files the same way the server does when it
starts: a missing file, an unknown or repeated key, a name the server does not know, a value in an unsafe place, a
missing or repeated marker, or a difference between the languages. Each message names the file, the line and, in the
criteria, the key. The server's tests check the rules with a fixture of their own
(`apps/server/test/fixtures/studio-content/mappe-fixture/`), never these files' texts. Three more tests render these
files as they are, in all three languages, and check only their structure, so changing a text breaks them only when
it breaks a rule above:
`apps/server/test/learningDesign/mappe/mappeRealContent.test.ts` (the reader's guide has one row per criterion of the
set; the word count of Del 1 leaves out the reader's guide and the references; the languages have the same headings
and suggested attachments, no more than the limit; no tag is left), `mappeRealContent.int.test.ts` (the same through
the export route) and `mappeRealContentPdf.browser.int.test.ts` (the PDF is tagged, its bookmarks are the headings,
and it has the language and the title). The PDF test runs only where Chromium is installed (always in CI), and it is
the one that fails when a heading is too long for one line, since the bookmark then differs from the heading.
