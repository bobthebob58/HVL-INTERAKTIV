# content — texts and settings that ALU edits without code

This folder holds what learning designers at ALU (*Avdeling for utvikling av læring og undervisning*) change by hand:
settings, and the phases, references, patterns, guide texts and portfolio templates of the læringsdesign studio
(spec 04). There is no code here. Every subfolder has its own guide.

| Folder | What it holds | Guide |
|---|---|---|
| `laeringsdesign/` | The limits of the pedagogical hints the validator gives authors before publishing (`hint-thresholds.yaml`); the names and texts of the three phases (`phases.yaml`); the references the guide and the patterns cite (`references.yaml`); the patterns, one folder each (`patterns/<id>/`); the guide in three languages (`guide.{nn,nb,en}.md`) | [laeringsdesign/README.md](laeringsdesign/README.md) |
| `mappe/` | The template and the criteria of the *pedagogisk mappe* export (`template.{nn,nb,en}.md`, `criteria.{nn,nb,en}.yaml`; the loader accepts all six or none, never some) | [mappe/README.md](mappe/README.md) |

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
