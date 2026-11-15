# Norsk ordbank – nynorsk (full-form list)

**What this is.** A lexical database that reflects the official Nynorsk spelling: the permitted inflected forms
of each headword, one form per line. It is here so that the project's Nynorsk texts (`nn` is the default
language, `PROD-012`, `H5P-008`) can later be checked against the current spelling by a tool, and not only by eye.

**Status: reference data only.** Nothing in the code reads this file yet. An automatic Nynorsk check is a
later, separately planned task. A human proofreader is still needed (see *Limits* below).

## Source and licence

| | |
|---|---|
| Resource | *Norsk ordbank – nynorsk 2012* |
| Version | last updated 2026-09-15 (original file name `20260915_norsk_ordbank_nno.tsv`) |
| Distributed by | Språkbanken (Nasjonalbiblioteket) |
| Content | reflects the spelling reform of 1 August 2012 and Språkrådet's later adjustments; the continuously updated online version is at Språksamlingane, University of Bergen: <https://clarino.uib.no/lex-no/ordbank/lemma#> |
| Licence | Creative Commons Attribution 4.0 International (CC BY 4.0): <https://creativecommons.org/licenses/by/4.0/> |
| Supplied by | the project owner on 2026-11-15, as downloaded from Språkbanken |

This is third-party data under CC BY 4.0. It is **not** covered by the repository's GPL-3.0 licence (D-015).
Anyone who passes the file on must keep this attribution and say what was changed.

**Changes made here:** none to the content. The file is stored compressed (`gzip -n -9`), which takes it from
37.7 MB to 3.7 MB. The uncompressed bytes are identical to the distributed file.

## Files

| File | Content |
|---|---|
| `20260915_norsk_ordbank_nno.tsv.gz` | the full-form list, gzip-compressed |
| `SHA256SUMS` | checksum of the compressed file (`sha256sum -c SHA256SUMS`) |

SHA-256 of the uncompressed `20260915_norsk_ordbank_nno.tsv`:
`f7193c7d659a9bf788862cbeb28795f0228cccf066efb6d1efcdc322a8889f1d`

## Format

A tab-separated text file in UTF-8 with one header line (it starts with `#`) and seven columns. Checked here on
2026-11-15: 627 666 data lines, every line with seven columns, 122 941 different lemma IDs. These are the
figures the distributor's documentation gives.

| Column | Content |
|---|---|
| `lemma-id` | identifier of the headword; the same on all its inflected forms (homographs have different IDs) |
| `lemma` | the headword |
| `segmentation` | parts of a compound, separated by `+` (for example `administrasjon+s+styre`); empty otherwise |
| `wordform` | the inflected form |
| `POS` | word class, as Universal Dependencies tags; this version holds `NOUN`, `VERB`, `ADJ`, `DET`, `PRON`, `ADV` |
| `features` | grammatical features separated by spaces (for example `Neuter Sing Def`) |
| `sources` | where the headword comes from: `NOB` (Nynorskordboka, 583 807 lines), `NO` (Norsk Ordbok, 26 500), `NOBFORSLAG`, `TILLEGG`, `ÅRSMELDING`, combinations of these, or empty (10 969) |

To look at it: `gzip -dc 20260915_norsk_ordbank_nno.tsv.gz | head`. In Node it can be read line by line with
`zlib.createGunzip()` and `readline`; no extra package is needed.

## Limits when it is used for checking

- **Mostly inflected words.** The list holds nouns, verbs and adjectives, and a few determiners, pronouns and
  adverbs. Words that are never inflected (prepositions, conjunctions, most adverbs, interjections) are largely
  missing, so a check needs its own short list of those.
- **No names, no HVL terms, no new words.** A check needs the project's own word list beside it
  (`docs/GLOSSARY.md` is the starting point).
- **Possible is not the same as usual.** The list includes forms that are conceivable but rarely or never used
  (the documentation's example is the plural `snøar`).
- **Allowed is not the same as consistent.** Nynorsk has many optional forms and the list accepts all of them.
  Which ones HVL prefers is a style choice for HVL or the proofreader.
- **It cannot judge a sentence.** A correctly spelled wrong word, grammar and tone need a person.

## Updating

Download the new version of *Norsk ordbank – nynorsk* from Språkbanken's resource catalogue, compress it the same
way, replace the file, and update `SHA256SUMS`, the version, the figures and the checksum above, and the
provenance table in [`../README.md`](../README.md).
