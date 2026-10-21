# Reference Material (institutional inputs)

These files are the inputs a build session reads instead of guessing. The originals come from HVL
(design manual, ALU documents, Feide and Canvas exports). On 2026-10-16 and 2026-10-21 the build
container could not reach hvl.no, feide.no, instructure.com or h5p.org (network policy). So each input
below was **assembled from public sources** with every value cited and graded by confidence, and an
independent agent then tried to refute it. **None of these files is an HVL original.** Each says
exactly what HVL still has to supply or confirm.

## Status

| # | Original we still need from HVL | What is here now | Status | Needed by |
|---|---|---|---|---|
| 1 | `hvl-designmanual-og-logo.zip`: design manual PDF and official logo files (HVL press room, profil@hvl.no) | [hvl-visual-identity.md](hvl-visual-identity.md): the manual's palette (PMS/CMYK/RGB/HEX), typefaces, logo variants and rules, contrast for every colour, and proposed tokens. [tools/contrast.py](tools/contrast.py) recomputes all ratios. **No logo artwork.** | Derived; HVL to confirm values and supply logo files | S4 |
| 2 | `hvl-modellen-for-laeringsdesign.pdf` (ALU, *Faggruppa for digital læringsdesign*) | [hvl-laeringsdesign-model.md](hvl-laeringsdesign-model.md): what HVL has published about «HVL læringsdesign» (annual report 2024 p. 23, read directly; Møgelvang & Isaksen 2025) and the phase vocabulary HVL uses. [proposals/phases.yaml](proposals/phases.yaml) is the proposed `content/laeringsdesign/phases.yaml` | Partly found; ALU to confirm labels | S5 |
| 3 | `hvl-pedagogisk-mappe-retningslinjer.pdf` (ALU) | [hvl-pedagogisk-mappe-criteria.md](hvl-pedagogisk-mappe-criteria.md): the 2025 merit criteria (1.1–1.4, 2.1–2.4, 3.1–3.3), the three-part portfolio, limits, and the national basis. [proposals/mappe-template.nn.md](proposals/mappe-template.nn.md) is the proposed export template. No public PDF of this name was found; HVL publishes the guidance as web pages | Derived; ALU to confirm | S5 |
| 4 | `feide-oidc-config.example.json` from the Feide Customer Portal | [feide-oidc-config.example.json](feide-oidc-config.example.json) with public endpoint values and placeholders for HVL's client, plus [feide-values.md](feide-values.md) (evidence table) | Public values high confidence; HVL client values pending | S3 |
| 5 | `canvas-lti13-developer-key.json` (TeCopp) | Pending: being assembled from Instructure's own documentation in the canvas-lms repository | In progress | S3 |
| 6 | `h5p-core-1.28-seed-packages/` (one verified `.h5p` per content type) | Pending: hub-api.h5p.org is blocked here; a status note and a fetch script will be added | Blocked by network policy | S2 |

## How to read the derived files

- **Confidence:** *high* means an official source seen directly, or two independent sources that
  agree. *medium* means one credible source, often an official page read through a search-engine
  extract. *low* means inferred. Values marked *(verify)* must not be built on until confirmed.
- **Proposals** in `proposals/` are drafts for files that belong in `content/` in Session 5. They are
  not approved by ALU.
- Third-party material without a licence (for example a public transcription of HVL's palette) is
  cited by repository and commit, never copied in.

## Rules for this folder

- **No secrets.** Client secrets and private keys go in the environment or secret store, never here.
- **No HVL logo files** without HVL's permission. The logo is a trademark and is not covered by the
  repository's GPL licence (D-015).
- `h5p-core-1.28-seed-packages/` must contain a `SHA256SUMS` file (`sha256sum *.h5p > SHA256SUMS`).
  The seed script refuses packages that do not match it.
- When an original arrives, put it here, record it in the provenance table, and re-run the check
  named in the derived file (for colours: `python3 -I docs/reference/tools/contrast.py`).

## Provenance

| File | Source | Retrieved | By |
|---|---|---|---|
| `hvl-visual-identity.md`, `tools/contrast.py`, `tools/contrast-output.md` | HVL design manual 2017 v2.0 (search extracts), public transcriptions and logo copies on GitHub (cited by commit), Brandfetch | 2026-10-16 | Claude research agent; independent verification in progress |
| `hvl-laeringsdesign-model.md`, `proposals/phases.yaml` | HVL Årsrapport 2024 (PDF via Sikt's Forvaltningsdatabasen mirror, SHA-256 recorded), Møgelvang & Isaksen 2025, hvl.no course pages (search extracts) | 2026-10-16 | Claude research agent; independent verification in progress |
| `hvl-pedagogisk-mappe-criteria.md`, `proposals/mappe-template.nn.md` | hvl.no merit pages and ALU pages (search extracts), published HVL portfolios, national regulations | 2026-10-16 | Claude research agent; independent verification in progress |
| `feide-oidc-config.example.json`, `feide-values.md` | docs.feide.no (search extracts), Feide's archived AuthEngine source, public integrations on GitHub and npm (cited by commit and version) | 2026-10-16 | Claude research agent; independent verification in progress |
