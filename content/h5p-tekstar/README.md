# content/h5p-tekstar — HVL's Norwegian texts for the H5P content types

The H5P content types come with their own texts: the buttons and messages a student sees («Sjekk», «Prøv igjen»),
the labels an author sees in the editor, and the editor's own words. Many of their Nynorsk and Bokmål texts are still
English («Submit», «Next», «Retry the task …»). The texts in this folder replace those, so that an activity made in
HVL Interaktiv speaks Nynorsk or Bokmål from the start (`H5P-008`, D-111). There is no code here.

| File | What it holds |
|---|---|
| `library-texts.nn.yaml` | HVL's Nynorsk texts, per content type and version |
| `library-texts.nb.yaml` | HVL's Bokmål texts, per content type and version |
| `video-guidance.yaml` | The guidance under the video field when an author adds a video (Panopto first, captions, at most 50 MB; `H5P-010`), in Nynorsk, Bokmål and English |

English needs no file of its own: the content types' own texts are English. The three files come together: while none
of them exists, the content types keep their own texts; if only some exist, the server does not start and names each
missing file.

## Status

All three files were written on 2026-11-05 (S6) and are **drafts** (`status: draft`) until HVL's language advisers
and ALU have read them (open questions Q2 and Q17). When a file has been reviewed, change its first line to
`status: reviewed`.

| File | What the drafts cover | What HVL and ALU decide |
|---|---|---|
| `library-texts.nn.yaml`, `library-texts.nb.yaml` | The student's buttons and messages of MultiChoice, QuestionSet, InteractiveBook and BranchingScenario first, then InteractiveVideo, ImageHotspots, CoursePresentation, TrueFalse, MarkTheWords, SingleChoiceSet, Summary (Bokmål) and Essay; the editor's labels of those fields for the first four; the editor's toolbar words in CoursePresentation and InteractiveVideo (H5P.DragNBar: «Lim inn», «Rediger» …) | The wording. The content types' other English labels in the editor are not translated yet |
| `video-guidance.yaml` | One text in three languages, under the video field of InteractiveVideo and of H5P.Video (which CoursePresentation, Column, InteractiveBook and BranchingScenario use) | The wording, and whether to name HVL's Panopto address |

## What changes, and what does not

- **New activities.** When an author creates an activity in the editor, or from a pattern in the studio, its texts
  are taken from these files. A pattern's own texts still win (D-084).
- **Activities already saved keep their texts.** H5P stores every text with the activity. To get the new texts, the
  author changes the field (or deletes it, and the editor fills it in again).
- **The editor.** An author whose language is Nynorsk or Bokmål sees these texts in the editor's fields, the labels
  they give, and the video guidance.
- **English is untouched**, except for the English video guidance.

A few English texts are written by the content types' program code and cannot be changed here, for example H5P.Video's
«Video source is missing.»; they are listed in the accessibility conformance report.

## How the files are built

Each file lists content types by name and version, as the editor offers them (`H5P.MultiChoice 1.16`). Under each,
up to three groups:

```yaml
libraries:
  H5P.MultiChoice 1.16:
    defaults:              # the text a new activity starts with
      UI.submitAnswerButton:
        en: 'Submit'       # the content type's own English text, exactly
        nn: 'Send inn'     # HVL's text (nb in library-texts.nb.yaml)
    labels:                # the field's name in the editor
      UI.submitAnswerButton:
        en: 'Submit answer button label'
        nn: 'Namn på «Send inn»-knappen'
  H5P.DragNBar 1.5:
    libraryStrings:        # the editor's own words, by name
      paste:
        en: 'Paste'
        nn: 'Lim inn'
```

- **The field's name** (`UI.submitAnswerButton`) is the path to the field in the content type: the names of the
  groups and the field, joined by full stops. A list's item is written with `[]` after the list's name, for example
  `branchingScenario.content[].proceedButtonText`. These are the names probe P1 reports, and the names in a pattern's
  `skeleton.json`.
- **`en` is a check, not a translation.** It must be the content type's own English text, letter for letter. If H5P
  changes that text in a new version, `npm run content:check` names the entry and the new English text; until the
  entry is updated, the server leaves that field as H5P ships it, so a student never sees a translation of a text
  that has changed.
- **Texts are plain text**, on one line, at most 600 characters. The characters `<` and `>` are refused: the editor
  shows these texts as HTML. A straight double quote (`"`) is refused in your `nn` and `nb` texts and in the video
  guidance, because the content types put some texts inside HTML attributes; write «» for quotation marks, as the
  files already do (`en` may hold `"`, since it is the content type's own text). Placeholders such as `@finals`,
  `:num` or `@chars` must stay as they are: the content type puts the numbers there.
- Write each text in single quotes (`'Send inn'`), as the files' formatter writes them; a text with an apostrophe
  in it goes in double quotes instead. A long text can be written after `>-` on the next lines, as
  `video-guidance.yaml` does; the lines are joined with spaces.

## Change a text, step by step

1. Open `library-texts.nn.yaml` (Nynorsk) or `library-texts.nb.yaml` (Bokmål) and find the content type and the
   field. The English text under `en` helps you find the right one.
2. Change only the `nn` or `nb` text. Leave `en` as it is.
3. Run `npm run content:check` (see below), then propose the change as a pull request.

## Add a text, step by step

1. Find the field's name and its English text. In the editor, most of them are under «Innstillinger og tekstar» (in
   Bokmål «Innstillinger og tekster»); a developer can look the name up in the content type's `semantics.json`.
2. Add it under the right content type and group (`defaults` for a student's text, `labels` for the field's name in
   the editor), with `en` and your text. A content type that is not in the file yet gets its own entry with its name
   and version.
3. Run `npm run content:check`. It refuses a field the content type does not have, an `en` that is not the content
   type's own English text, and a content type version that is not installed, each with the file and the line.

## Change the video guidance

`video-guidance.yaml` holds one text in three languages under `description`, and under `fields` the video fields it
is shown under. Keep the three texts saying the same thing. A field must be a video field; a new version of
InteractiveVideo or H5P.Video needs its own line under `fields`.

## Check your change before you propose it

Run this from the repository's top folder:

```bash
npm run content:check
```

It checks these files with the rest of `content/` (see [../README.md](../README.md)) and, where the content types are
installed (`npm run h5p:fetch-libraries`), checks every field, library string and English text against them. A mistake
is printed with the file, the line and the key, for example:

```text
✗ content/h5p-tekstar/library-texts.nn.yaml:14: libraries.H5P.MultiChoice 1.16.defaults.UI.submitAnswerButton.en: is not the library's English text any more, which is now "Submit answer"; update en and check the translation
```
