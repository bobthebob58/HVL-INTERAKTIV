# content — texts and settings that ALU edits without code

This folder holds what learning designers at ALU (*Avdeling for utvikling av læring og undervisning*) change by hand:
settings, and later the phases, patterns, guide texts and portfolio templates of the læringsdesign studio
(spec 04, Session 5). There is no code here. Every subfolder has its own guide.

| Folder | What it holds | Guide |
|---|---|---|
| `laeringsdesign/` | The limits of the pedagogical hints the validator gives authors before publishing (`hint-thresholds.yaml`) | [laeringsdesign/README.md](laeringsdesign/README.md) |

## How to edit

1. Open the file on GitHub (or in an editor) and change the value.
2. Keep the structure: names on the left of `:` are read by the server and must stay as they are.
3. Propose the change as a pull request. The checks listed in each folder's guide run automatically and tell you,
   in plain words, which line is wrong.

The server reads these files when it starts. If a file is wrong, the server does not start, and its log names the
file and the key, so a mistake never reaches students.
