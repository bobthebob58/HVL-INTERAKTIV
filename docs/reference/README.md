# Reference Material (institutional inputs)

These files are authoritative inputs from HVL. When they are in the repository, a build session can
read real values from them instead of guessing. **None has been provided yet (2026-10-16).** Until
they arrive, the affected values are kept in configuration and marked *(verify)* in the specs.

| # | File to place here | Where HVL staff can get it | What it unblocks | Needed by |
|---|---|---|---|---|
| 1 | `hvl-designmanual-og-logo.zip` | HVL press room (*design og logo*) or the Vestibylen templates | Exact SVG logos and brand colour and font values for `packages/design-tokens` (spec 03 §2) | S4 |
| 2 | `hvl-modellen-for-laeringsdesign.pdf` | ALU / *Faggruppa digital læringsdesign* (Emnedesign module) | Exact phase names and wording for `content/laeringsdesign/phases.yaml` (spec 04 §1) | S5 |
| 3 | `hvl-pedagogisk-mappe-retningslinjer.pdf` | ALU, *Utdanningsfagleg kompetanse og pedagogisk mappe* | Portfolio headings and criteria for `content/mappe/template.*.md` (`MAPPE-002`) | S5 |
| 4 | `feide-oidc-config.example.json` | Feide Customer Portal (HVL organisation) | Issuer, redirect URIs, client ID, granted scopes (`AUTH-001`). **Never commit the client secret.** | S3 |
| 5 | `canvas-lti13-developer-key.json` | TeCopp (HVL's Canvas test instance) | Canvas issuer, endpoints, placements, client and deployment IDs (`LTI-001`) | S3 |
| 6 | `h5p-core-1.28-seed-packages/` | One verified `.h5p` per content type, from hub-api.h5p.org or an H5P-hosted source | Offline, deterministic seeding (`H5P-003`) | S2 |

## Rules for this folder

- **No secrets.** Client secrets and private keys go in the environment or secret store, never here.
- `h5p-core-1.28-seed-packages/` must contain a `SHA256SUMS` file
  (`sha256sum *.h5p > SHA256SUMS`). The seed script refuses packages that do not match it.
- Record where each file came from, and when, in the table below, so its provenance can be audited.

| File | Source URL or contact | Retrieved | By |
|---|---|---|---|
| — | — | — | — |
