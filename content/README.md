# content — texts and settings that ALU edits without code

This folder holds what learning designers at ALU (*Avdeling for utvikling av læring og undervisning*) change by hand:
settings, and the phases, references, patterns, guide texts and portfolio templates of the læringsdesign studio
(spec 04). There is no code here. Every subfolder has its own guide.

| Folder | What it holds | Guide |
|---|---|---|
| `laeringsdesign/` | The limits of the pedagogical hints the validator gives authors before publishing (`hint-thresholds.yaml`); the names and texts of the three phases (`phases.yaml`); the references the guide and the patterns cite (`references.yaml`); the patterns, one folder each (`patterns/<id>/`); the guide in three languages (`guide.{nn,nb,en}.md`) | [laeringsdesign/README.md](laeringsdesign/README.md) |
| `mappe/` | The template and the criteria of the *pedagogisk mappe* export (`template.{nn,nb,en}.md`, `criteria.{nn,nb,en}.yaml`; all six are there, and the loader refuses a set with some of them missing) | [mappe/README.md](mappe/README.md) |

Everything the studio shows from here is a draft written from public sources until ALU confirms it (open question
Q17). The review packet [`docs/reference/alu-review-s5.md`](../docs/reference/alu-review-s5.md) lists what to review,
the open questions, and where to record the outcome.

## Common changes, step by step

| To … | Follow |
|---|---|
| change a phase's name or text | [laeringsdesign/README.md](laeringsdesign/README.md), «Change a phase's name or text, step by step» |
| add or correct a reference | [laeringsdesign/README.md](laeringsdesign/README.md), section `references.yaml` |
| edit the guide | [laeringsdesign/README.md](laeringsdesign/README.md), «Edit the guide, step by step» |
| add a pattern, or edit one | [laeringsdesign/README.md](laeringsdesign/README.md), «Add a pattern, step by step», «Edit a pattern, step by step» and «Making a skeleton from an exported .h5p file» |
| edit the mappe template | [mappe/README.md](mappe/README.md), «Edit the template, step by step» |
| edit the criteria, or add a criteria set for a new call | [mappe/README.md](mappe/README.md), «Edit the criteria, step by step» |
| change a hint's limit | [laeringsdesign/README.md](laeringsdesign/README.md), section `hint-thresholds.yaml` |

Texts that belong to the pages themselves (buttons, headings, the content bank's consent text, the privacy page) are
not here: they are in the web app's language files, which a developer changes.

## How to edit

1. Open the file on GitHub (or in an editor) and change the value.
2. Keep the structure: names on the left of `:` are read by the server and must stay as they are.
3. Propose the change as a pull request. The checks listed in each folder's guide run automatically and tell you,
   in plain words, which line is wrong.

The server reads these files when it starts. If a file is wrong, the server does not start, and its log names the
file, the line and the key, so a mistake never reaches students.

## Check your change before you propose it

Run this from the repository's top folder:

```bash
npm run content:check
```

It reads every file the studio uses, exactly as the server does at start-up, and prints either one line starting with
`✓` or every mistake, one per line, for example:

```text
✗ content/laeringsdesign/phases.yaml:38: phases[underveis].label.nb: the nb text is missing (every text needs nn, nb and en)
```

That reads: in `phases.yaml`, line 38, in the phase whose key is `underveis`, under `label`, the Bokmål (`nb`) text
is missing. The same check runs automatically when you commit a file in this folder and on every pull request.
`laeringsdesign/hint-thresholds.yaml` belongs to the validator, not the studio: the server's start and its own test
check it (see [laeringsdesign/README.md](laeringsdesign/README.md)).
