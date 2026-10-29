# Reference Material (institutional inputs)

These files are the inputs a build session reads instead of guessing. The originals come from HVL
(design manual, ALU documents, Feide and Canvas exports). On 2026-10-16 and 2026-10-21 the build
container could not reach hvl.no, feide.no, instructure.com or h5p.org (network policy). So each input
below was **assembled from public sources**, with every value cited and graded by confidence. Each was then
checked again from different sources (see *Verification* in the provenance table). **None of these files is an HVL original.** Each says
exactly what HVL still has to supply or confirm.

The studio's texts, patterns, mappe template and criteria built from these inputs go to ALU and the pilot teachers
with the review packet [alu-review-s5.md](alu-review-s5.md) (open question Q17, D-100).

## Status

| # | Original we still need from HVL | What is here now | Status | Needed by |
|---|---|---|---|---|
| 1 | `hvl-designmanual-og-logo.zip`: design manual PDF and official logo files (HVL press room, profil@hvl.no) | [hvl-visual-identity.md](hvl-visual-identity.md): the manual's palette (PMS/CMYK/RGB/HEX), typefaces, logo variants and rules, contrast for every colour, and proposed tokens. [tools/contrast.py](tools/contrast.py) recomputes all ratios. **No logo artwork.** | Derived; HVL to confirm values and supply logo files | S4 |
| 2 | `hvl-modellen-for-laeringsdesign.pdf` (ALU, *Faggruppa for digital læringsdesign*) | [hvl-laeringsdesign-model.md](hvl-laeringsdesign-model.md): what HVL has published about «HVL læringsdesign» (annual report 2024 p. 23, read directly; Møgelvang & Isaksen 2025) and the phase vocabulary HVL uses. [proposals/phases.yaml](proposals/phases.yaml) is the proposed `content/laeringsdesign/phases.yaml` | Partly found; ALU to confirm labels | S5 |
| 3 | `hvl-pedagogisk-mappe-retningslinjer.pdf` (ALU) | [hvl-pedagogisk-mappe-criteria.md](hvl-pedagogisk-mappe-criteria.md): the 2025 merit criteria (1.1–1.4, 2.1–2.4, 3.1–3.3), the three-part portfolio, limits, and the national basis. [proposals/mappe-template.nn.md](proposals/mappe-template.nn.md) is the proposed export template. No public PDF of this name was found; HVL publishes the guidance as web pages | Derived; ALU to confirm | S5 |
| 4 | `feide-oidc-config.example.json` from the Feide Customer Portal | [feide-oidc-config.example.json](feide-oidc-config.example.json) with public endpoint values and placeholders for HVL's client, plus [feide-values.md](feide-values.md) (evidence table, and what HVL IT registers for the S3 server) | Public values high confidence; HVL client values pending (Q3) | S3 |
| 5 | `canvas-lti13-developer-key.json` exported by TeCopp, plus HVL's client and deployment IDs | [canvas-lti13-developer-key.json](canvas-lti13-developer-key.json), paste-ready (`privacy_level` `anonymous`; scopes AGS score, line-item read, NRPS read; Deep Linking placements with the custom fields `feide_login` and `hvl_placement`), and [canvas-platform-values.md](canvas-platform-values.md) with every platform value cited to Instructure's docs and source at a fixed commit, and what TeCopp registers (§1.1, §1.2) | Public values high confidence; HVL instance values pending (Q4, Q13) | S3 |
| 6 | `h5p-core-1.28-seed-packages/` (one verified `.h5p` per content type) | [h5p-core-1.28-seed-packages/README.md](h5p-core-1.28-seed-packages/README.md): latest versions, the exact Hub request, three known h5p-server 10.0.4 incompatibilities, per-file hashes of core `1.28.0`. **No `.h5p` files yet**: hub-api.h5p.org is blocked here. Run `tools/seed/fetch-seed-packages.sh` where it is reachable | Blocked by network policy; script ready | S2 |

## What HVL IT and TeCopp register (Session 3)

The S3 server runs and is tested against a mock Feide and a mock Canvas (D-049). These registrations connect it
to HVL's real services. `<PUBLIC_BASE_URL>` is the server's public origin, `https://interaktiv.hvl.no` in
production; register the same paths for any test server.

- **Feide Customer Portal (HVL IT, Q3).** Redirect URI after login `<PUBLIC_BASE_URL>/auth/feide/callback`;
  redirect URI for logout `<PUBLIC_BASE_URL>/auth/logged-out`; a confidential client; the attribute groups
  `userinfo-name`, `email`, `userid-feide`, `groups-org` and `groups-edu` (never `userinfo-photo` or
  `userid-nin`). Send back the client ID and secret (`FEIDE_CLIENT_ID`, `FEIDE_CLIENT_SECRET`). Details:
  [feide-values.md](feide-values.md), section *What HVL IT registers in the Customer Portal*.
- **Canvas developer key (TeCopp, Q4, Q13).** Paste [canvas-lti13-developer-key.json](canvas-lti13-developer-key.json):
  OIDC login `<PUBLIC_BASE_URL>/lti/login`, launch `<PUBLIC_BASE_URL>/lti/launch`, keyset
  `<PUBLIC_BASE_URL>/lti/keys`, and on each of the three Deep Linking placements the custom fields
  `feide_login` = `$Canvas.user.loginId` and `hvl_placement` = the placement's name. Enter
  `<PUBLIC_BASE_URL>/lti/launch` in the key's Redirect URIs field, deploy the key, and send back the client ID,
  each deployment ID (for `LTI_PLATFORMS`) and the Canvas origins that frame the tool (for `CANVAS_ORIGINS`).
  Account linking (`"feideLinking": true` in `LTI_PLATFORMS`) is switched on only after a test launch shows
  that `feide_login` is the Feide ID (D-063). Details: [canvas-platform-values.md](canvas-platform-values.md) §1.1 and §1.2.

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

| File | Source | Retrieved | Verification |
|---|---|---|---|
| `hvl-visual-identity.md`, `tools/contrast.py`, `tools/contrast-output.md` | HVL design manual 2017 v2.0 (search extracts), public transcriptions and logo copies on GitHub (cited by commit), Brandfetch | 2026-10-16 | Independent agent, 2026-10-21: 18 of 19 facts confirmed from new sources, all contrast ratios recomputed; its corrections applied |
| `hvl-laeringsdesign-model.md`, `proposals/phases.yaml` | HVL Årsrapport 2024 (PDF via Sikt's Forvaltningsdatabasen mirror, SHA-256 recorded), Møgelvang & Isaksen 2025, hvl.no course pages (search extracts) | 2026-10-16 | Key facts re-checked 2026-10-21 with new searches (paper title, authors, venue, three parts, keywords confirmed via Cristin, NTNU and the MNT 2025 programme); full independent review pending |
| `hvl-pedagogisk-mappe-criteria.md`, `proposals/mappe-template.nn.md` | hvl.no merit pages and ALU pages (search extracts), published HVL portfolios, national regulations | 2026-10-16 | Key facts re-checked 2026-10-21 with new searches (three parts, criteria 1.1–1.4 and 3.1–3.3, 11 attachments, about 7 500 words, reader's-guide tables in published 2025 portfolios); full independent review pending |
| `feide-oidc-config.example.json`, `feide-values.md` | docs.feide.no (search extracts), Feide's archived AuthEngine source, public integrations on GitHub and npm (cited by commit and version) | 2026-10-16 | Each high-confidence value already rests on two or more independent sources; separate independent review pending |
| `canvas-lti13-developer-key.json`, `canvas-platform-values.md` | Instructure's canvas-lms repository at commit `1c9f0bb` (docs and source), ltijs 7.0.7, vendor guides | 2026-10-21 | Key claims (privacy levels, token `aud` rule, endpoints) re-checked against the Canvas docs; separate independent review pending |
| `h5p-core-1.28-seed-packages/README.md`, `h5p-php-library-1.28.0.files.sha256`, `tools/seed/fetch-seed-packages.sh` | H5P's git repositories (tags and commits), Lumi h5p-server 10.0.4 and `master`, the H5P WordPress plugin, h5p.org and Moodle forum posts | 2026-10-21 | Script checked with `bash -n` and `--dry-run`; not run against the Hub |
