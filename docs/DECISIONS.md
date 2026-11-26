# Decision Log

Lightweight architecture decision records. Add an entry for each real choice between alternatives,
each deviation from a spec, each accepted vulnerability, and each change to the content-type set
(`DOC-010`). Code affected by a deviation carries `SPEC-DEVIATION: D-xxx`.

Entries D-001 to D-007 **correct the original development plan**
(`HVL_Interaktiv_Development_Plan.pdf`). The facts behind them were checked on 2026-10-16 against
the npm registry, the published package source and public CVE records. Evaluators can re-check them
with the commands given.

| ID | Title | Status |
|---|---|---|
| D-001 | Node.js 24 LTS instead of 22 | Accepted |
| D-002 | Pin h5p-server 10.0.4 / h5p-express 10.0.5 | Accepted |
| D-003 | Own SVG sanitising and defensive file serving (CVE-2025-7062) | Accepted |
| D-004 | Library installation is a `GeneralPermission` | Accepted |
| D-005 | ltijs 7 with a PostgreSQL `DatabaseManager` | Accepted |
| D-006 | Branching Scenario replaces Drag and Drop in the ten types | Accepted (from plan) |
| D-007 | Two-tone focus ring instead of an orange outline | Accepted |
| D-008 | Formative use only | Accepted (from plan) |
| D-009 | Nynorsk first, with Bokmål and English fallback | Accepted (from plan) |
| D-010 | Teachers see aggregates only, with *k* = 5 | Accepted |
| D-011 | Learners are HMAC pseudonyms with yearly key rotation | Accepted |
| D-012 | One public origin, plus a separate origin for uploaded files | Accepted |
| D-013 | Validator errors can be acknowledged rather than hard-blocking | Accepted |
| D-014 | English in code, Norwegian domain terms preserved | Accepted |
| D-015 | Licence GPL-3.0-or-later | Accepted (2026-10-16) |
| D-016 | Specs beyond the plan's four, plus requirement IDs and traceability | Accepted |
| D-017 | Brand tokens follow HVL's design manual (Mørk blå 2, Sjøgrønn …) | Accepted (2026-10-21), HVL to confirm values |
| D-018 | Typefaces: Arial and Georgia, as the manual's office fonts | Accepted (2026-10-21), ALU/HVL to confirm |
| D-019 | Phases are course-organisation vocabulary at the model's *mikronivå*; `underveis` is labelled *Mellomarbeid* | Accepted (2026-10-21), ALU to confirm |
| D-020 | Portfolio export follows HVL's three-part merit portfolio and the 2025 criteria, as content | Accepted (2026-10-21), ALU to confirm |
| D-021 | The Feide ID token is kept in the server-side session for logout only | Accepted (2026-10-21) |
| D-022 | H5P editor 1.28 client files come from a pinned, reviewed commit | Accepted (2026-10-21) |
| D-023 | Integration tests use docker compose or CI service containers, not Testcontainers | Accepted (2026-10-21) |
| D-024 | TypeScript pinned to 6.0.3 | Accepted (2026-10-21) |
| D-025 | Own S3 adapters on AWS SDK v3 instead of `h5p-mongos3` | Accepted (2026-10-21) |
| D-026 | Library storage on a shared volume until deployment needs S3 | Accepted (2026-10-21) |
| D-027 | H5P core and editor files are fetched and verified, not committed | Accepted (2026-10-21) |
| D-028 | The H5P user-data adapter moves to S2 with `H5P-005` | Accepted (2026-10-21) |
| D-029 | Own licence and audit checks instead of `license-checker` and plain `npm audit` | Accepted (2026-10-21) |
| D-030 | Accepted advisory: `image-size` parser loops (until 2027-01-31) | Accepted (2026-10-21), expires 2027-01-31 |
| D-031 | Session 1 items that finish in Session 2 (spike steps 3–6, F1/F3 wiring, import directory, TypeDoc) | Accepted (2026-10-22) |
| D-032 | `h5p-express` installed in S1; its Express 4 is overridden to 4.22.3 | Superseded by D-035 (2026-10-22) |
| D-033 | Only running it()/test() titles prove a requirement | Accepted (2026-10-22) |
| D-034 | The yearly purge also deletes learner `User` rows | Accepted (2026-10-22) |
| D-035 | Own Express 5 routes over `H5PAjaxEndpoint`; `h5p-express` removed | Accepted (2026-10-22) |
| D-036 | The H5P actor has an account view and a state view | Accepted (2026-10-22) |
| D-037 | H5P "finished" data is off; the state save interval is fixed at 5 s | Accepted (2026-10-22) |
| D-038 | How learner state is stored, deleted and invalidated | Accepted (2026-10-22) |
| D-039 | Our own sub-content policy on save (list items, DragQuestion, titles) | Accepted (2026-10-22) |
| D-040 | Our own player and editor page templates with script-safe JSON | Accepted (2026-10-22) |
| D-041 | Library change control: one audited install path, no Hub installs | Accepted (2026-10-22) |
| D-042 | The seeder lives in `apps/server`; where the seed packages are kept | Accepted (2026-10-22) |
| D-043 | Multipart uploads keep their extension and are limited while streaming | Accepted (2026-10-22) |
| D-044 | SVG sanitising rules and order | Accepted (2026-10-22) |
| D-045 | Headers for user files; the separate files origin moves to S3/S6 | Accepted (2026-10-22) |
| D-046 | Library language files fall back nn → nb → en | Accepted (2026-10-22) |
| D-048 | The Session 3 LTI views are server-rendered pages until `apps/web` (S4) | Accepted (2026-10-23) |
| D-049 | A mock Feide and a mock Canvas in `tools/mock-platform`; HVL values from env | Accepted (2026-10-23) |
| D-050 | How we use ltijs 7: our router, our cache, our pages, our ltik checks | Accepted (2026-10-23) |
| D-051 | LTI platforms and deployments from `LTI_PLATFORMS`; deployment IDs checked by us | Accepted (2026-10-23) |
| D-052 | ltijs records: 10-minute nonces, 24-hour ID tokens with a claim allowlist | Accepted (2026-10-23) |
| D-053 | The `Principal`: always a user ID, roles as a list, one mapping to the H5P actor | Accepted (2026-10-23) |
| D-054 | The Feide subject is the Feide ID; Groups API failures fail closed | Accepted (2026-10-23) |
| D-055 | A stable identity key ring with HKDF purposes and a rotation rule | Accepted (2026-10-23) |
| D-056 | Secrets at rest are encrypted with AES-256-GCM from a key ring | Accepted (2026-10-23) |
| D-057 | Own Redis portal sessions, login transactions and a synchronizer CSRF token | Accepted (2026-10-23) |
| D-058 | H5P URL tokens and signed content-file URLs | Accepted (2026-10-23) |
| D-059 | How the Feide and LTI role tables are read | Accepted (2026-10-23), owner to confirm (Q12) |
| D-060 | Authors may view a published activity they launched from Canvas (course copy) | Accepted (2026-10-23) |
| D-061 | Deep Linking in Session 3 | Accepted (2026-10-23), TeCopp to confirm (Q13) |
| D-062 | The LTI-006 tabs and the LTI-007 duplicate come with their pages | Accepted (2026-10-23) |
| D-063 | Linking an author's Canvas and Feide identities | Accepted (2026-10-23) |
| D-064 | What the authentication audit records | Accepted (2026-10-23), owner to confirm (Q15) |
| D-065 | End-to-end tests in Session 3 | Accepted (2026-10-23) |
| D-066 | Friendly "not available" pages and visibility-only sharing until S4 | Accepted (2026-10-23), owner to confirm (Q14) |
| D-047 | R-01 settled: Core 1.28 and Lumi 10.0.4 run the ten real content types | Accepted (2026-10-23) |
| D-067 | H5P runtime pages stay in Express; the Next.js app frames them | Accepted (2026-10-23) |
| D-068 | Express is the front door and runs Next.js in the same process | Accepted (2026-10-23) |
| D-069 | Query-ltik paths and file grants for the S4 views and the editor | Accepted (2026-10-23) |
| D-070 | Content Security Policy for H5P pages and Next.js pages; no YouTube | Accepted (2026-10-23) |
| D-071 | CC-BY-4.0 is an allowed licence (caniuse-lite) | Accepted (2026-10-23) |
| D-072 | Design tokens: generated CSS, a Tailwind v4 theme file and colour lint | Accepted (2026-10-23) |
| D-073 | The validator is pure: shape-based walk, configuration passed in | Accepted (2026-10-23) |
| D-074 | Publishing: server re-validation, acknowledgements and concurrency | Accepted (2026-10-23) |
| D-075 | Notice dismissals are stored per user | Accepted (2026-10-23) |
| D-076 | The web app's own typed translations | Accepted (2026-10-23) |
| D-077 | API schemas in `packages/api-contract` and an OpenAPI document | Accepted (2026-10-23) |
| D-078 | Real H5P libraries from GitHub at pinned commits | Accepted (2026-10-23) |
| D-079 | What S4 verifies automatically and what HVL records by hand | Accepted (2026-10-23) |
| D-080 | H5P markup barriers: repaired in the page where we can, registered where we cannot | Accepted (2026-10-24) |
| D-081 | One Node.js system with Lumi's H5P server half; a PHP server half considered and not chosen | Accepted (2026-10-24) |
| D-082 | The studio's content pipeline: files in `content/`, loaded and checked at start-up | Accepted (2026-10-28), ALU to confirm the texts (Q17) |
| D-083 | `SPEC-DEVIATION` PED-002: the guide is CommonMark Markdown, not MDX | Accepted (2026-10-28) |
| D-084 | `SPEC-DEVIATION` spec 04 §4: pattern skeletons live in `content/`, with text tokens and pinned versions | Accepted (2026-10-28) |
| D-085 | Creating an activity from a pattern is one server request | Accepted (2026-10-28) |
| D-086 | Guidance placeholders are marked `⟦…⟧`, and V-PLACEHOLDER is an error that can be acknowledged | Accepted (2026-10-28) |
| D-087 | Learning-design metadata: learner purpose, pattern, course code and access | Accepted (2026-10-28) |
| D-088 | The alignment planner: one course, outcomes × phases, two gap rules | Accepted (2026-10-28) |
| D-089 | Studio access, routes and tabs | Accepted (2026-10-28) |
| D-090 | Finding co-authors: HVL staff only, rate-limited, audited | Accepted (2026-10-28) |
| D-091 | The content bank: opt-in, published, shared with HVL, for HVL authors | Accepted (2026-10-28), consent text to ALU and HVL legal (Q17) |
| D-092 | Duplicating an activity | Accepted (2026-10-28) |
| D-093 | Safe editing: a structure signature, a confirmation, and saving as a copy | Accepted (2026-10-28) |
| D-094 | Rendering the pedagogisk mappe | Accepted (2026-10-28), ALU to confirm limits and criteria (Q17) |
| D-095 | Minimum group size in exports | Accepted (2026-10-28) |
| D-096 | The portfolio PDF is rendered by Chromium on the server | Accepted (2026-10-28) |
| D-097 | New dependencies in S5 | Accepted (2026-10-28) |
| D-098 | The Canvas side of the studio moves to S6 | Accepted (2026-10-28) |
| D-099 | The API contract gets binary responses and `DELETE` | Accepted (2026-10-28) |
| D-100 | The S5 gate, and the ALU and pilot review left open (Q17) | Accepted (2026-10-28) |
| D-101 | Session 6: order, specs to load, insight in tabs, and what passes to the bachelor students | Accepted (2026-10-30) |
| D-102 | `SPEC-DEVIATION` LTI-010: the xAPI bridge is plain JavaScript in the player document, for learners only | Accepted (2026-10-30) |
| D-103 | Course contexts are stored with their platform: `<platformId>:<contextId>` | Accepted (2026-10-30) |
| D-104 | `SPEC-DEVIATION` LTI-012: our own minimal AGS client in a durable worker, not ltijs's `submitScore` | Accepted (2026-10-30) |
| D-105 | The formative line-item label is configurable, and scores are labelled formative wherever shown | Accepted (2026-10-30), HVL and ALU to answer Q8 |
| D-106 | `SPEC-DEVIATION` spec 05 §1: insight per context, fixed periods, suppression as `INS-006` writes it | Accepted (2026-10-30), residuals to the DPO (Q6) |
| D-107 | `SPEC-DEVIATION` DATA-003: the yearly purge runs on 31 August and deletes by a stored academic year | Accepted (2026-10-30) |
| D-108 | Data-subject requests: a server CLI that HVL operations run | Accepted (2026-10-30) |
| D-109 | Database roles, encrypted-connection checks in production, and a request log without personal data | Accepted (2026-10-30) |
| D-110 | Deployment and operations design: runtime, image, compose, content types, files origin, ClamAV | Accepted (2026-10-30), built in S6 step 6 (amendments of 2026-11-05 and 2026-11-06), HVL's runtime and DNS open (Q5), build egress to the owner (Q21) |
| D-111 | An HVL language overlay in a library-storage wrapper; `H5P-010`'s guidance through it | Accepted (2026-10-30), texts to HVL's language advisers and ALU (Q2, Q17) |
| D-112 | Upstream reports drafted for the owner to file; Lumi stays at 10.0.4 | Accepted (2026-10-30) |
| D-113 | The S6 gate in full, run in parts; CI raised to S5; per-ID runs that select tests; a licence guard | Accepted (2026-10-30) |
| D-114 | New development dependencies in S6 | Accepted (2026-10-30) |
| D-115 | xAPI capture, statement identity, attempts and gradable results (probe P1) | Accepted (2026-10-30), ALU and the owner to answer Q18–Q20 |
| D-116 | An IT assurance pack for HVL IT and an SBOM generator, outside the specs; a request in three stages | Accepted (2026-11-05), drafts for HVL IT to correct, a system owner and maintainer to name (Q31) |

---

### D-001 · Node.js 24 LTS instead of 22
- **Context:** The plan specifies Node 22 LTS. `ltijs@7.0.7`, the current maintained release,
  declares `"engines": { "node": ">=24" }`. Node 24 is an LTS line supported until April 2028.
- **Decision:** Target Node.js 24 LTS (`.nvmrc`, Docker `node:24-*` images, `engines` field).
- **Consequences:** Development containers that ship Node 22 must install Node 24. Revisit once
  Node 26 becomes LTS.
- **Re-check:** `npm view ltijs@7 engines`.

### D-002 · Pin `@lumieducation/h5p-server@10.0.4` and `h5p-express@10.0.5`
- **Context:** The plan says "lock to version 10.1.0 or newer". No such version exists. The latest
  `h5p-server` is 10.0.4 (2025-03-08) and the latest `h5p-express` is 10.0.5.
- **Decision:** Pin the exact versions (`SEC-007`). Watch the upstream repository for a release that
  fixes CVE-2025-7062 (see D-003).
- **Re-check:** `npm view @lumieducation/h5p-server versions`.

### D-003 · Own SVG sanitising and defensive file serving
- **Context:** CVE-2025-7062 (stored XSS through uploaded files) affects h5p-server versions up to and
  including 10.0.4. 10.0.4 removed `svg` from the default allowlist, but it still identifies files
  by extension only. No fixed version is published. (CVE-2025-47828, which the plan also cites, is a
  different bug, fixed in 9.3.3.)
- **Decision:** Defence in depth: `@lumieducation/h5p-svg-sanitizer` plus our own extra rules
  (`SEC-001`), magic-byte sniffing (`SEC-002`), a separate file origin with `CSP: sandbox` (`SEC-004`),
  and a narrowed allowlist.
- **Consequences:** Slightly slower uploads. SVG stays usable for diagrams.
- **Re-check:** OSV and NVD entries for CVE-2025-7062; the h5p-server CHANGELOG.

### D-004 · Library installation is a `GeneralPermission`
- **Context:** The plan restricts `ContentPermission.InstallRecommended`. In h5p-server 10.0.4 the
  enum is `GeneralPermission` (`CreateRestricted`, `InstallRecommended`, `UpdateAndInstallLibraries`).
- **Decision:** Use `GeneralPermission.*`, admin-only (`H5P-006`).
- **Re-check:** `build/src/types.d.ts` in the installed package.

### D-005 · ltijs 7 with a PostgreSQL `DatabaseManager`
- **Context:** The plan describes the ltijs 5 API (`lti.setup(…, { ltiaas: true })`) with
  `ltijs-postgresql`. ltijs 7 is a TypeScript rewrite: `Provider`, `LaunchContext`, a cookie-less ltik
  (24 h), and a pluggable 14-method `DatabaseManager` that ships with MongoDB only.
  `ltijs-postgresql` and `ltijs-sequelize` were last published in 2022 and target v5.
- **Alternatives:** (a) ltijs 5 with sequelize: legacy and unmaintained. (b) Add MongoDB just for
  LTI: a second database to run and back up. (c) Implement `DatabaseManager` on Prisma/PostgreSQL:
  about 14 small methods.
- **Decision:** (c), as `PrismaLtiDatabaseManager` (`LTI-002`). Keep ltijs behind our own
  `LtiProviderFactory` so a future library change stays local.
- **Re-check:** `npm view ltijs@7 dependencies`; `services/database-manager/database-manager.types.d.ts`.

### D-006 · Branching Scenario replaces Drag and Drop in the ten types
- **Context:** `H5P.DragQuestion` is popular, but free 2-D dragging is a well-known barrier for
  keyboard, switch and screen-reader users (WCAG 2.1.1, 2.5.7). Case-based judgement is central to
  HVL's professional programmes.
- **Decision:** Exclude DragQuestion from authoring, including as sub-content; include
  `H5P.BranchingScenario` (`H5P-002`).

### D-007 · Two-tone focus ring instead of an orange outline
- **Context:** The plan pairs coastal teal with a `#FF9E1B` focus outline. Measured contrast against
  white is 2.07 : 1, which fails WCAG 1.4.11 (needs 3 : 1). The plan also overstated two feedback
  contrast ratios (7.21 : 1 and 7.08 : 1 measured; both still pass).
- **Decision:** `outline: 3px solid` HVL Mørk blå 2 (`#004357`, 10.82 : 1 on white; originally `#003D4C`,
  changed by D-017) with a 2 px white inner ring, which works on light and dark surfaces (`UD-004`).
  Contrast is tested in CI from the tokens (`UD-001`). `#FF9E1B` is not an HVL colour; HVL's orange is
  Oransje `#EB6851`. It clears 3 : 1 on white only narrowly (3.17 : 1), so it stays decorative.

### D-008 · Formative use only
H5P scores in the browser, so scores can be forged. AGS scores are labelled formative and the UI
says so (`LTI-013`, `PROD-011`). Exams stay in Wiseflow.

### D-009 · Nynorsk first, with Bokmål and English fallback
HVL's main administrative language is Nynorsk. i18next uses `nn → nb → en` for both UI and H5P
strings (`H5P-008`, `PROD-012`).

### D-010 · Teachers see aggregates only, with *k* = 5
- **Context:** Insight helps teaching decisions. Individual grades already exist in Canvas through AGS.
- **Decision:** No per-learner insight endpoint. Suppress groups smaller than *k* = 5, with
  complementary suppression (`INS-006`).
- **Consequences:** Very small classes see little insight. This is an accepted privacy trade-off,
  and *k* can be lowered to 3 by configuration.

### D-011 · Learners are HMAC pseudonyms with yearly key rotation
`learnerKey = HMAC(secret[academicYear], source)`. Destroying the secret at the yearly purge makes
the remaining aggregates unlinkable (`DATA-002`, `DATA-003`). Resume state does not carry across the
1 August boundary. This is acceptable because the summer break falls there.

### D-012 · One public origin, plus a separate origin for uploaded files
A reverse proxy serves Next.js and Express on one origin, which removes CORS and keeps the portal
cookie first-party. User-uploaded files come from a cookie-less second origin, which limits the
damage any file-borne script can do (`SEC-004`).

### D-013 · Validator errors can be acknowledged rather than hard-blocking
Teachers sometimes publish while captions are still being produced (for example in Panopto). A
hard block would push them to tools with no checks at all. An acknowledgement with a reason is
stored, re-raised after 14 days, and visible in insight and the portfolio export (`PROD-003`, `UD-022`).

### D-014 · English in code, Norwegian domain terms preserved
English makes the code reviewable by international evaluators and the open-source community.
Domain terms such as `forarbeid` or `laeringsutbytte` keep their Norwegian form so teachers and ALU
recognise them. They are explained in [GLOSSARY.md](GLOSSARY.md) (`DOC-009`).

### D-015 · Licence GPL-3.0-or-later
- **Context:** `@lumieducation/h5p-server` is GPL-3.0-or-later, so a server that combines with it must be
  GPL-compatible. The other main dependencies are compatible: ltijs (Apache-2.0), marked (MIT), H5P
  content types (MIT).
- **Decision:** The whole repository is licensed **GPL-3.0-or-later**. The repository owner asked
  Claude to confirm the choice on 2026-10-16. `LICENSE` holds the unmodified GPL v3 text. Its SHA-256,
  `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`, is the hash of the FSF's
  `gpl-3.0.txt`, and it was cross-checked against the copy shipped in `@lumieducation/h5p-server`.
- **Consequences:** Anyone who distributes a modified version must release its source under the same
  licence. Network use alone does not trigger that. The HVL name and logo are trademarks of Høgskulen på
  Vestlandet and are **not** licensed by the GPL. Logo files must not be committed without HVL's permission.
  Third-party files keep their own licences, for example `tools/spec-site/vendor/marked.LICENSE.md`.
- **Re-check:** `sha256sum LICENSE`.

### D-016 · Specs beyond the plan's four, plus requirement IDs and traceability
The plan defines four module specs. This repository adds spec 00 (product, users, pedagogy), spec 05
(insight and privacy), the [Documentation Standard](DOCUMENTATION-STANDARD.md) and
[Evaluator Guide](EVALUATOR-GUIDE.md). Requirement IDs connect spec, code and tests, and
`tools/spec-trace/specTrace.mjs` enforces them. The plan's session structure and its progressive
loading of one spec per session are kept.

### D-017 · Brand tokens follow HVL's design manual
- **Context:** The plan's colours (`#003D4C`, `#005F6B`, `#007681`, `#FF9E1B`, "deep fjord teal", "coastal
  teal") appear in no HVL source. HVL's *Visuell identitet / Profilmanual* (v2.0, February 2017, p. 16)
  defines the logo colours Mørk blå 2 `#004357` (PMS 3035 U) and Sjøgrønn `#00AFBA` (PMS 7710 U), plus
  signal, support and additional colours. The values were read through search extracts of the manual and
  agree with independent transcriptions and with two public copies of the logo
  ([docs/reference/hvl-visual-identity.md](reference/hvl-visual-identity.md)).
- **Decision:** Spec 03 §2 uses Mørk blå 2 for headings, links, primary buttons and the focus ring
  (10.82 : 1 on white), Mørk blå 1 `#008AAF` for non-text UI only (4.00 : 1), Sjøgrønn and Oransje for
  decoration only, Blågrå lys `#C9D5DA` for bands, Mørk rød `#6D2439` for incorrect-answer text.
  Body text stays a neutral near-black `#111111`, because the HVL palette has no text black and its
  greys fail 4.5 : 1. Neutral tokens are labelled as such.
- **Consequences:** CLAUDE.md, `UD-004` and D-007 now name `#004357`. HVL (profil@hvl.no) must confirm the
  values, the four hex/RGB mismatches noted in the reference file, and whether derived shades are allowed.
- **Re-check:** `python3 -I docs/reference/tools/contrast.py`.

### D-018 · Typefaces: Arial and Georgia
- **Context:** The plan specified Inter, Arial and Calibri. HVL's manual names NB Akademie Std (titles,
  captions) and Lyon Text (body) as profile fonts, with **Arial** and **Georgia** as the office
  substitutes. Both profile fonts are commercial; no source shows that HVL holds web-font licences.
- **Decision:** Headings, UI controls and captions use Arial; long-form body text uses Georgia (`UD-002`).
  The licensed profile fonts may be self-hosted in front of these stacks once HVL confirms web licences.
  Inter and Calibri are dropped.
- **Consequences:** No third-party font requests are needed (`DATA-011`).

### D-019 · Phases are course-organisation vocabulary at the model's *mikronivå*
- **Context:** Spec 04 assumed that *Modellen for læringsdesign ved HVL* defines phases. HVL's annual
  report 2024 (p. 23) confirms the model exists. Its only public description (Møgelvang & Isaksen 2025,
  MNT-konferansen) presents an alignment model built on *kontekst*, *kunnskap* and *samskaping*, applied
  across levels from the *læringsøkt* (mikronivå) to the institution, using *baklengs planlegging*. HVL's
  course pages use *forarbeid*, *mellomarbeid* and *etterarbeid* (and *før- og etterarbeid*) for work
  around a *samling*. No HVL page uses *underveis* as a phase name, and it is easily confused with
  *undervegsvurdering* (formative assessment).
  ([docs/reference/hvl-laeringsdesign-model.md](reference/hvl-laeringsdesign-model.md))
- **Decision:** Keep the stable keys `forarbeid`, `underveis`, `etterarbeid`. Label them *Forarbeid*,
  *Mellomarbeid* and *Etterarbeid* (en: *Pre-work*, *Intermediate work*, *Post-work*). Present them as the
  structure of a *læringsøkt* around a *samling*, not as the phases of HVL's model. The studio introduces
  the model itself (kontekst, kunnskap, samskaping; backward planning) and links to its public description.
- **Consequences:** Spec 04 §1, the glossary and the proposed `phases.yaml` change. ALU must confirm the
  labels against the model document.

### D-020 · Portfolio export follows HVL's merit portfolio, as content
- **Context:** The plan cited criteria "1.1–3.2". HVL's 2025 merit call has three main criteria and eleven
  sub-criteria (1.1–1.4, 2.1–2.4, 3.1–3.3), revised for each call. The merit portfolio has three parts:
  Del 1 *samanhengande framstilling* (up to 7 500 words, references excluded), Del 2 *pedagogisk CV*, and
  Del 3 up to 11 attachments including the manager's letter.
  ([docs/reference/hvl-pedagogisk-mappe-criteria.md](reference/hvl-pedagogisk-mappe-criteria.md))
- **Decision:** `MAPPE-002` follows the three-part structure with a criterion table as a reader's guide.
  Criteria texts, the word limit and the attachment limit live in content files keyed by criteria set
  (`hvl-merittering-2025`), so the 2027 call needs only a content change. A promotion (*opprykk*) mode
  waits for ALU to confirm its headings.

### D-021 · The Feide ID token is kept in the server-side session for logout only
- **Context:** Feide's RP-initiated logout requires both `post_logout_redirect_uri` and `id_token_hint`.
  The ID token contains the user's name and e-mail when those attribute groups are released.
- **Decision:** Keep the raw ID token only in the Redis session (encrypted at rest, deleted at logout or
  expiry). Never write it to PostgreSQL or logs. Learner name and e-mail are dropped before anything is
  persisted (`AUTH-003`, `AUTH-004`).

### D-022 · H5P editor 1.28 client files come from a pinned, reviewed commit
- **Context:** `H5P-001` asked for core and editor files from a released, versioned 1.28 package. Core has
  the release tag `1.28.0`. The editor (`h5p-editor-php-library`) has **no** 1.28 release tag: its newest
  semver tag is `1.25`, and 1.28-era code exists only on platform branches and untagged commits. Lumi's own
  `master` pins editor commit `ab2daa18bd61b19e7f8729e22eec88f3b637a868`
  ([seed-package status](reference/h5p-core-1.28-seed-packages/README.md) §5).
- **Decision:** Pin core to tag `1.28.0`. Pin the editor to one reviewed commit (start from Lumi's pin),
  record its per-file SHA-256 in `docs/reference/`, and review the diff before any change. Never track a
  moving branch.
- **Consequences:** `H5P-001` and the CLAUDE.md invariant ("never unreleased H5P git branches") now mean
  "never a moving branch; a pinned commit only where no release exists, with this entry". Revisit when
  H5P tags an editor 1.28 release.

### D-023 · Integration tests use docker compose or CI service containers, not Testcontainers
- **Context:** `H5P-004` names Testcontainers for its integration tests. Testcontainers starts containers
  from inside the test process and needs a Docker socket there. CI runners and many development containers
  (including the one Session 1 was built in, where Docker Hub also rate-limited pulls) do not offer that
  reliably, while GitHub Actions service containers and `docker compose` do.
- **Decision:** Integration tests read `DATABASE_URL`, `REDIS_URL` and `S3_*` from the environment. Locally,
  `docker compose up -d` provides PostgreSQL 16, Redis 7 and an S3-compatible store; CI uses service
  containers with the same images. Tests that need a service are named `*.int.test.ts` and skip with a
  clear message when the service is not configured, so `npm test` still runs the unit tests anywhere.
- **S3 emulator:** the moto server (`motoserver/moto`, pinned tag) emulates the S3 API in one container
  that needs no start command. GitHub Actions service containers cannot pass a command, which MinIO needs
  (`server /data`), so moto is used both locally and in CI. Production uses any S3-compatible store in the EEA.
- **Consequences:** `H5P-004` and the evaluator guide say "integration tests against PostgreSQL, Redis and
  S3" instead of naming Testcontainers; CLAUDE.md names the emulator instead of MinIO. CI must never skip
  them: `test/support/services.ts` throws when `CI=true` and a service variable is missing.

### D-024 · TypeScript pinned to 6.0.3
- **Context:** TypeScript 7.0 (the native compiler) is the newest release, but `typescript-eslint` 8.72,
  the newest release of the linter we need for typed rules, supports TypeScript `<6.1` only.
- **Decision:** Pin `typescript` 6.0.3. Revisit when `typescript-eslint` supports 7.x.
- **Re-check:** `npm view typescript-eslint@latest peerDependencies`.

### D-025 · Own S3 adapters on AWS SDK v3 instead of `h5p-mongos3`
- **Context:** Lumi's `@lumieducation/h5p-mongos3` stores content metadata in MongoDB and uses AWS SDK v2,
  which reached end of support in September 2025. Our metadata lives in PostgreSQL (`H5P-004`).
- **Decision:** `PrismaContentStorage` keeps metadata and parameters in PostgreSQL and delegates file I/O
  to `S3ContentFileStore`; `S3TemporaryFileStorage` handles temporary files. Both use
  `@aws-sdk/client-s3` v3 and work with any S3-compatible store (MinIO, Ceph, Sikt's object storage).
- **Consequences:** We own these adapters and their tests. Lumi's `h5p-mongos3` source is a reference for
  edge cases (key sanitising, range reads), not a dependency.

### D-026 · Library storage on a shared volume until deployment needs S3
- **Context:** `H5P-004` allows S3- or file-system-backed library storage. Libraries change only when an
  admin installs or updates a content type and are read on every page view. Lumi's `CachedLibraryStorage`
  caches their metadata in each node's memory; its own default lifetime is 24 hours.
- **Decision:** S1 uses Lumi's `FileLibraryStorage` on a volume shared by all server instances, wrapped
  in `CachedLibraryStorage` with a per-node in-memory cache of 300 s (`LIBRARY_CACHE_TTL_SECONDS`). An S3
  `ILibraryStorage` is added in S6 only if the target platform has no shared volume.
- **Consequences:** Deployment (S6, `NFR-007`) must mount one volume for `H5P_LIBRARY_DIR` on every node.
  After a library install or update (including a security update, `H5P-011`), other nodes can serve the
  old library metadata for up to 5 minutes. If S6 needs instant propagation, use a Redis-backed cache store
  or a cross-node invalidation message.

### D-027 · H5P core and editor files are fetched and verified, not committed
- **Context:** The server needs H5P's client files (core tag `1.28.0`, editor commit per D-022). Committing
  these 281 third-party files (67 core, 214 editor) would bury our own code in reviews and diffs.
- **Decision:** `tools/h5p-core/fetchCoreClients.sh` fetches them into `apps/server/h5p/` (git-ignored).
  The script checks that each tag or commit resolves to the expected commit hash, then checks every file
  against a committed per-file SHA-256 list (`h5p-php-library-1.28.0.files.sha256`,
  `h5p-editor-php-library-ab2daa18.files.sha256`); a changed, missing or extra file stops it. CI runs the
  script before the tests. The server refuses to start when the core API
  version in the fetched files is not 1.28 (`H5P-001`).
- **Consequences:** A fresh clone needs one `npm run h5p:fetch-core`. doc-lint and spec-trace skip
  `apps/server/h5p/`.

### D-028 · The H5P user-data adapter moves to S2 with `H5P-005`
- **Context:** `H5P-004` (S1) lists `IContentUserDataStorage`, but the adapter's key and behaviour are
  defined by `H5P-005` (S2), which needs the LTI context and the learner pseudonym in a request.
- **Decision:** Build and test `PrismaContentUserDataStorage` in S2 together with `H5P-005`. S1 creates its
  database table, so the schema is complete.
- **Consequences:** The S1 integration test of `H5P-004` covers the other five adapters.

### D-029 · Own licence and audit checks instead of `license-checker` and plain `npm audit`
- **Context:** `NFR-005` suggests `license-checker`; it is unmaintained and pulls in its own dependency
  tree. `SEC-007` allows reviewed, expiring exceptions to `npm audit`, which plain `npm audit` cannot express.
- **Decision:** `tools/dependency-check/checkLicences.mjs` reads production packages with
  `npm query ':not(.dev)'` (since S4 `npm query '*'` filtered on the `dev` flag, D-071) and checks their SPDX expressions against a GPL-3.0-compatible allow-list.
  `checkAudit.mjs` runs `npm audit --omit=dev --json` and fails on any high or critical advisory that has
  no unexpired entry in `audit-exceptions.json` pointing to a decision here.
- **Consequences:** No extra dependencies. Packages with legacy licence metadata are listed by name and
  version after a person has read their licence file.

- **Amendment (2026-11-26, D-145):** two more checks stand beside these: `checkLockfile.mjs` (where each package
  of the lock file comes from, its checksum, and the install scripts against the reviewed list) and
  `checkWorkflows.mjs` (the workflows' actions, images and token). The audit check also runs once a day on the
  default branch, and it reads an exception's date as a date.

### D-030 · Accepted advisory: `image-size` parser loops (until 2027-01-31)
- **Context:** `@lumieducation/h5p-server` 10.0.4 depends on `image-size@^1.0.2`. Advisories
  GHSA-5p2g-fcmc-qvqq (JXL and HEIF) and GHSA-w3rx-r6r6-pgpr (ICNS) affect every version up to 2.0.2; no
  1.x release is fixed. Version 2 changes the API that `H5PEditor.saveContentFile` calls (it passes a file
  path), so an override would break image uploads. A third advisory (`underscore` ≤ 1.13.7, via `jsonpath`)
  is fixed by an npm `overrides` entry pinning `underscore` 1.13.8, a patch release.
- **Decision:** Accept both `image-size` advisories until **2027-01-31**. The loop is reachable only through
  an authenticated author's file upload. In S2, `SEC-002` content sniffing rejects any file whose magic
  bytes are not on the allowlist (JXL, HEIF and ICNS are not) before H5P calls `image-size`.
- **Consequences:** `audit-exceptions.json` lists both advisories with this decision and the expiry date.
  Review again at expiry, or earlier if h5p-server releases a version with `image-size` ≥ 2.0.3.

- **Amendment (2026-11-26, D-145):** an exception needs every field, a real calendar date at most 120 days ahead,
  and covers its advisory only for the package it names. The two entries here pass as they are; a renewal on
  2027-01-31 can run to 2027-05-31 at most.

### D-031 · Session 1 items that finish in Session 2
- **Context:** Some Session 1 work depends on things that only exist in Session 2, or on a network this
  build environment does not have. The Session 1 review (2026-10-22) found these were not recorded as a decision.
- **Decision:** These move to S2 and are listed in its `PROGRESS.md` checklist:
  1. Spike steps 3–6 (spec 01 §7): site registration and seeding against hub-api.h5p.org, rendering
     `H5P.MultiChoice`, the Daylight theme with the F3 CSS, and the R-01 choice between 1.28 and the 1.27
     fallback. This environment's proxy blocks hub-api.h5p.org (Q7).
  2. Wiring workaround F1: `getLocalIdOverride: () => localIdFor(<site UUID>)` is an `H5PEditor` option, so
     it is set in `H5pEditorFactory`. S1 provides and tests `localIdFor`.
  3. Injecting the F3 theme CSS through the player and editor customisation hooks (needs the S2 routes).
  4. `SEC-005`'s "temporary directory with a quota": the S2 package import route runs `inspectZip` before
     Lumi's `PackageImporter`. The quota is `maxTotalSize`, checked from the central directory; yauzl checks
     the real sizes while extracting into a fresh `os.tmpdir()` folder that is removed afterwards. S1 provides
     the guard, the limits and the size-limited S3 uploads.
  5. TypeDoc API pages for `DOC-002`, added with the HTTP API.
- **Consequences:** `SEC-005` and `H5P-001` have tests in S1 for what exists; their S2 parts get their own
  `[ID]` tests in S2.

### D-032 · `h5p-express` installed in S1; its Express 4 is overridden to 4.22.3
- **Context:** Spike step 1 installs `@lumieducation/h5p-express@10.0.5`. It depends on `express` 4.21.2
  exactly, whose dependencies have advisories: `path-to-regexp` < 0.1.13 (GHSA-37ch-88jc-xwx2, high), plus
  moderate ones in `qs` and `body-parser`. Express 4.22.3 (2026-09-14) uses the fixed versions.
- **Decision:** A scoped npm override (`"@lumieducation/h5p-express": { "express": "4.22.3" }` in the root
  `package.json`) replaces Express only inside h5p-express. Our own server (S2) uses Express 5 as its own
  dependency, which the override does not touch. `check:pins` checks nested override values too.
- **Consequences:** S2 must test the h5p-express routers on Express 4.22.3. Remove the override when Lumi
  releases an h5p-express with a fixed Express.
- **Superseded by D-035 (2026-10-22):** S2 does not use h5p-express, so the override and Express 4 are removed.

### D-033 · Only running it()/test() titles prove a requirement
- **Context:** `DOC-004` said "the `describe` or `it` title starts with the ID". The Session 1 review found
  that spec-trace counted an `[ID]` anywhere in a test file, including comments, strings, `describe` titles
  of groups whose tests name other IDs, and skipped tests. Such a mention proves nothing.
- **Decision:** A requirement counts as tested only when its ID opens the title of an `it()` or `test()`
  call that runs. Calls in comments, strings and regex literals are ignored; `skip`, `todo`, `skipIf`,
  `fails` and the `x` prefix, on the test or on an enclosing `describe`, mean it does not run.
  `describe` titles may still carry IDs for readers. `tools/spec-trace/testTitles.mjs` holds the rule;
  spec-trace and doc-lint's `DOC-006` check both use it. `DOC-004` in the Documentation Standard says so.
- **Consequences:** Conditional groups such as `describeWithServices` count, because CI always runs them
  (it fails when services are missing). A title built at run time (not a string literal) is not counted.

### D-034 · The yearly purge also deletes learner `User` rows
- **Context:** `DATA-003` lists `XapiStatement`, `H5PUserData`, `GradeSyncJob` and learner `Identity`
  rows. In the schema the cascade runs from `User` to `Identity`, not back, so a purge that follows the
  list leaves each learner's `User` row (`id`, `kind`, `createdAt`) behind. The data inventory already
  gave those rows the yearly purge as retention.
- **Decision:** `DATA-003` also deletes learner `User` rows that have no `Identity` left after the purge.
  The inventory labels a learner's `userId` references (`Identity.userId`, `AuthAuditEvent.actorUserId`)
  "Pseudonymous (stable key)", because `Identity.subjectHash` links that ID to the person until the purge.
- **Consequences:** The S6 purge test checks that no learner `User` row without an `Identity` survives.
  Staff `User` rows are unaffected.

### D-035 · Own Express 5 routes over `H5PAjaxEndpoint`; `h5p-express` removed
- **Context:** S2 needs the H5P HTTP endpoints. `@lumieducation/h5p-express` 10.0.5 builds Express 4 routers.
  Mounted in our Express 5 app they route correctly, but: the Express 4 layer ignores returned promises, so an
  error after a stream has started is an unhandled rejection that ends a Node 24 process; its error handler
  returns internal error messages; 206 responses get the file name as `Content-Type`; content files get no
  `nosniff`, CSP or `Content-Disposition`; the library-administration and content-type-cache routers have no
  authorisation; `?asUserId=` and `contextId` come straight from the query string; and the download route
  never reaches our permission system (Lumi builds its `PackageExporter` without one).
- **Decision:** `apps/server/src/http/` implements the routes in Express 5 on top of h5p-server's exported
  `H5PAjaxEndpoint` and `H5PEditor`/`H5PPlayer`. `@lumieducation/h5p-express` and the root override for its
  Express 4 are removed (D-032 superseded). ESLint forbids importing it. D-002's pin of h5p-express no longer
  applies; the h5p-server pin stays.
- **Consequences:** We own about ten small route handlers and their tests. The `D-032` checklist item "test
  the h5p-express routers on Express 4.22.3" is closed by removal. CLAUDE.md §1/§2 say so.

### D-036 · The H5P actor has an account view and a state view
- **Context:** Lumi passes one `IUser` everywhere and uses `user.id` both as the content owner and as the key
  of learner state. `DATA-002` requires learner state to be keyed by the pseudonym (`learnerKey`), never by an
  internal or raw ID, while ownership needs the account ID.
- **Decision:** `HvlH5pActor` (`src/h5p/HvlH5pUser.ts`) carries the account ID, role, learnerKey, context and
  visibility facts. Two `IUser` views wrap it: the **account** view (`id` = `User.id`) for content and
  temporary files, and the **state** view (`id` = learnerKey) for user data and the player. The permission
  system reads the actor's explicit fields, never `user.id`, so the wrong view fails closed. `contextId` comes
  from the authenticated request; `?asUserId` is refused with 400. An undefined or unknown user is always
  denied; files an author removes are deleted by our code as that author. The H5P-006 boot check:
  `createH5pRuntime` runs `assertPermissionSystem` on the editor and player the factories build (every Lumi
  component must hold `HvlPermissionSystem`), plus an ESLint ban on `LaissezFairePermissionSystem`.
- **Consequences:** S3 maps its `Principal` to `HvlH5pActor`. Own state also requires View on the content.

### D-037 · H5P "finished" data is off; the state save interval is fixed at 5 s
- **Context:** Lumi stores a separate "finished" record (score, times) per learner. Spec 05 has no such entity;
  scores reach the LMS through xAPI → AGS in S6. `H5P-005` asks for the default 5 s save interval, and S1
  allowed both settings to be loaded from storage.
- **Decision:** `setFinishedEnabled` is `false` and `contentUserStateSaveInterval` is `5000`, set in code after
  loading. There is no `/finishedData` route; the storage's finished-data methods store nothing.
- **Consequences:** Less learner data (data minimisation). S6 reads scores from xAPI statements.

### D-038 · How learner state is stored, deleted and invalidated
- **Context:** H5P sends state as a JSON string and deletes it by posting `data=0`. Lumi deletes invalidated
  state *before* checking the Edit permission on save (`H5PEditor.js:527-528`), so any signed-in user could
  wipe learners' state, and Lumi sorts state by `Number(subContentId)`, which is `NaN` for UUIDs.
- **Decision:** The state string is stored as a JSON string value in `H5PUserData.data` (no migration);
  `data=0` deletes the row; invalidated rows are deleted only after a save that passed the permission check;
  the storage returns the main state (`subContentId` `'0'`) first.
- **Consequences:** `PROD-013` (S5) adds the author's confirmation before invalidating.

### D-039 · Our own sub-content policy on save (list items, DragQuestion, titles)
- **Context:** Lumi's sanitising on save does not reach every part of an activity's parameters, a library the field
  does not offer can pass in some positions, and H5P core's own dialogs show some stored values without escaping. The
  exact places are in the private record and in the report to the maintainers (D-112's amendment of 2026-11-13); they
  return to this entry once the maintainers have published a fix or agreed.
- **Decision:** On save, our `SubContentPolicy` walks the params with the (altered) semantics, refuses with 403 any
  sub-library that the field does not offer and `H5P.DragQuestion` anywhere, sanitises text wherever the walk finds it
  with Lumi's own text rules, and sanitises the titles in main and sub-content metadata. Tests pin the upstream
  behaviour so we notice when it changes. The S2 review and three verification passes after it (the last with a sink
  audit of h5p.js and Chromium fuzzing with more than 60 variants) widened this: the policy refuses any library
  reference the semantics walk did not reach (`semantics/libraryReferences.ts`); `semantics/rightsOfUse.ts` reduces
  metadata and copyright objects anywhere in the parameters to plain text (sanitize-html with no tags, pinned as a
  direct dependency at the version Lumi uses), keeps `source` only as a plain http(s) URL, drops a field that becomes
  empty, and refuses or cleans media paths and alternative texts that are not plain values (400). Inputs that Lumi or
  PostgreSQL turned into a 500 are refused as the request's fault (400): text with U+0000 or a lone surrogate
  (`storage/storableText.ts`, also for learner state), nesting deeper than 256 levels before Lumi's recursive walks
  see it (`semantics/nestingDepth.ts`, also for an imported content.json), and values whose JSON type the field does
  not allow (`paramsWalker.ts`: text, list, group, library, file, image, video and audio fields); a sub-content
  `library` object without a usable `toString` is refused with 403 like any other.
- **Consequences:** The walker (`semantics/paramsWalker.ts`) is reused by the S4 validator. Cleaning data for a
  renderer that does not escape is a list of known sinks, not a guarantee: the real ten types render their own
  copyright data (`getCopyrights`), so their sinks must be reviewed when the Hub packages arrive (Q7), and the
  player page gets a script CSP without `'unsafe-inline'` in S4 (`DATA-011`), which stops injected handlers
  whatever their source.

### D-040 · Our own page templates with script-safe JSON
- **Context:** Lumi's default page templates are not safe for every stored value (the detail is in the private record,
  D-112's amendment of 2026-11-13), and `H5PIntegration.user` in them carries the user's ID.
- **Decision:** We render the player page ourselves and escape `<`, `>`, `&`, U+2028 and U+2029 in the embedded
  JSON. `H5PIntegration.user` is blank (no pseudonym or account ID in the page). The editor returns only its
  model until S4 adds its page with the same escaping; Lumi's templates are never used.
- **Consequences:** S4 adds the editor page and extends both with the theme; S6 adds the xAPI bridge.

### D-041 · Library change control: one audited install path, no Hub installs
- **Context:** `H5P-011` requires an audit event for every library change and no Hub installs on demand in
  production. Lumi has no install hook, and an empty content-type cache makes it call the Hub on every request.
- **Decision:** Libraries change only through (a) the seed command and (b) an admin's package import; both
  write a `LibraryAuditEvent` per new or patched library. Installing from the Hub is refused for everyone, in
  every environment. `LibraryAuditEvent.actorUserId` becomes nullable (the seed command has no user) and gains
  `source` (`seed` or `upload`). An empty content-type cache is stored as `[]`, so the server never calls the
  Hub while serving requests; `npm run hub:check` contacts it explicitly (spike step 3). The audit rows are
  written before Lumi installs anything (`libraries/auditBeforeInstall.ts`, which predicts Lumi's `new`/`patch`
  decision from the package), so a failed audit write installs nothing; changes beyond the prediction are
  recorded right after. The editor's Hub download and Content Hub calls are replaced at construction
  (`disconnectFromHub`).
- **Consequences:** New content types arrive through new seed packages, reviewed like code.

### D-042 · The seeder lives in `apps/server`; where the seed packages are kept
- **Context:** Spec 01 §2 places `seedLibraries.ts` in `tools/seed/`, but seeding needs the server's H5P
  configuration, library storage and Prisma (for the audit).
- **Decision:** The seeder is in `apps/server/src/h5p/libraries/` (`npm run seed:libraries`), and
  `tools/seed/` keeps the fetch script. Spec 01 §2 was amended to match, so no code carries a deviation tag. The ten packages are committed under
  `docs/reference/h5p-core-1.28-seed-packages/` when every file is under 50 MB and all together under 150 MB;
  otherwise they are published as a GitHub Release asset and only `SHA256SUMS` is committed (as D-027).
- **Consequences:** CI will seed from the committed (or release) packages and never fetches from the Hub. Until
  the packages can be fetched (Q7), CI has no seed step; the integration tests seed synthetic packages.

### D-043 · Multipart uploads keep their extension and are limited while streaming
- **Context:** Lumi requires a temporary file path when file sanitisers are registered, and its SVG sanitiser
  ignores any path that does not end in `.svg`; common upload middlewares write temporary files without an
  extension. Lumi also has no size limit on direct editor uploads, and it trusts the client's MIME type.
- **Decision:** `@fastify/busboy` parses uploads into a fresh `mkdtemp` folder; each file keeps its lower-cased
  extension, its MIME type comes from the extension, and the 50 MB limit is enforced while streaming (413).
- **Consequences:** The folder is removed after every request, successful or not.

- **Amendment (2026-11-25, D-143):** the text fields of an upload request are few and small: at most 4 fields of at
  most 64 KB each, a field name of at most 100 characters, at most 8 parts in all. A request past one of these is
  400 after its body was read, and no value is cut short and passed on (`http/multipartUpload.ts`).

### D-044 · SVG sanitising rules and order
- **Context:** `SEC-001` asks to reject or strip DOCTYPE/ENTITY, scripts, event handlers, `foreignObject`,
  `javascript:`/`data:text/html` URLs and external references. Inkscape and Illustrator exports carry a public
  DOCTYPE, which is harmless without an internal subset.
- **Decision:** An internal DTD subset or any `<!ENTITY` is rejected. A plain DOCTYPE and `xml-stylesheet`
  instructions are stripped. `href`/`xlink:href` may only point to a `#fragment` or a raster
  `data:image/(png|jpeg|gif|webp)`. `script`, `foreignObject`, `use`, `set`, `on*` attributes and animations of
  `href` are removed (`<use>` can load an external document); `@import` and external `url()` are removed from styles. Order: our pre-check, Lumi's sanitiser,
  our stricter DOMPurify pass, and a final check that nothing forbidden is left. Benign SVGs must render
  identically in Chromium before and after (screenshot comparison).
- **Consequences:** SVG files larger than 5 MB are refused. DOMPurify parses with the HTML parser (its XML mode
  returns nothing for a file with an `<?xml?>` prolog); that parser keeps `xmlns` but its SVG profile removes
  `<use>`, so a drawing that relies on `<use>` loses those parts (pinned in `SvgSanitizer.test.ts`).
  Lumi's profile is SVG only (no filter elements), so filter primitives such as `feGaussianBlur` are lost too,
  and DOMPurify removes ids that name document properties (`title`, `blur`, …), which breaks `url(#…)`
  references to them; a test pins all three losses. Our pass writes its result with XMLSerializer, and the final
  check parses it again as XML, as a browser does, and fails closed. Lumi's sanitiser alone does not stop every
  payload in our bypass test set; the layers together stop all of them.
- **Amendment (2026-11-20, D-119):** the four steps are unchanged, but they now run in a worker thread with a time,
  a memory and a waiting limit, never on the server's main thread.

### D-045 · Headers for user files; the separate files origin moves to S3/S6
- **Context:** `SEC-004` asks for `nosniff`, a sandbox CSP for SVG and documents, and `attachment` for
  non-media types, and for a separate files origin in production. Files on another origin need their own
  authorisation (signed URLs, part of S3's `HvlUrlGenerator`) and deployment (S6).
- **Decision:** Every content and temporary file is served with `X-Content-Type-Options: nosniff` and
  `Content-Security-Policy: sandbox; default-src 'none'; style-src 'unsafe-inline'`; everything except raster
  images, audio, video and VTT captions is served as `attachment`. The separate origin is an S6 checklist item.
- **Consequences:** A stricter superset of `SEC-004` in S2; the origin isolation follows in S3/S6. Text types,
  SVG included, carry `charset=utf-8`. An SVG is an `attachment` too: a browser still draws it in `<img>`, but
  opening it directly downloads it instead of showing it as a page.
- **Amendment (2026-11-05):** the separate origin is built in S6 as D-110's amendment of the same day describes: the
  player's files come from `FILES_BASE_URL` (by default `files.<host>`), every answer there carries these headers, and
  the editor's files stay on the app origin for now (`SPEC-DEVIATION: D-110`).

### D-046 · Library language files fall back nn → nb → en
- **Context:** `H5P-008` asks that a content type without `language/nn.json` uses its `nb` strings, then `en`.
  Lumi falls back from `nn` straight to `en` (`LibraryManager.js:109-168`), and its `alterLibraryLanguageFile`
  hook cannot supply a missing file.
- **Decision:** A library-storage wrapper serves `language/nb.json` when `language/nn.json` is missing. The
  translation callback for Lumi's own strings uses i18next (`lng: 'nn'`, `fallbackLng: ['nb', 'en']`); our own
  server messages stay in `src/i18n/translate.ts`.
- **Consequences:** Lumi's own `nn` client strings are partly Bokmål; HVL's language advisers review them (Q2).

### D-048 · The Session 3 LTI views are server-rendered pages until `apps/web` (S4)
- **Context:** `LTI-003` and `LTI-005` describe the Canvas views as Next.js pages, but `apps/web` and its design
  tokens arrive in S4. Building the views in Next.js now would add React and Next.js to S3 and style the pages
  twice. The owner chose server-rendered pages for S3 (2026-10-23).
- **Decision:** `SPEC-DEVIATION`: in S3 the server renders `/lti/play` (the player Canvas embeds), `/lti/deeplink`
  (the picker) and the friendly error pages. `LTI-003` still holds in full: the ltik lives only in page memory (a
  script closure or the `H5PIntegration` URLs), never in localStorage, sessionStorage or cookies; a first-party
  script removes it from the address bar with `history.replaceState`; our APIs take `Authorization: Bearer`; every
  page that receives an ltik sends `Referrer-Policy: no-referrer`, `Cache-Control: no-store` and CSP
  `frame-ancestors` from `CANVAS_ORIGINS`, and never `X-Frame-Options`. Page scripts are static files
  (`script-src 'self'`). The pages are unstyled until S4.
- **Consequences:** S4 moves the views to `apps/web` `/app/*` and keeps the same server APIs.

### D-049 · A mock Feide and a mock Canvas in `tools/mock-platform`; HVL values from env
- **Context:** HVL's Feide client values and the TeCopp Canvas instance are not available yet (Q3, Q4), and
  `auth.dataporten.no` and `*.instructure.com` are not reachable from the build environment (Q7).
- **Decision:** `tools/mock-platform` holds a mock Feide (`oauth2-mock-server` plus a Groups API route) and a mock
  Canvas (our own `node:http` + `jose` server: an OIDC auth endpoint with `form_post`, JWKS, the LTI Platform
  Storage frame, a course page that embeds the tool cross-site, and deep-link return verification). Tests start it
  in-process; `npm run mock:platform` runs it by hand. It is not a docker compose service: the server on the host
  and the browser must reach the mock Feide at the same URL. Every HVL value is an environment variable.
- **Consequences:** The *(verify)* items in spec 02 stay open until HVL IT and TeCopp deliver (Q3, Q4).

### D-050 · How we use ltijs 7: our router, our cache, our pages, our ltik checks
- **Context:** ltijs 7.0.7 registers its routes through a pluggable `HttpHandler`; its own `ExpressHttpHandler`
  creates an Express app with `cors({ origin: true, credentials: true })` and helmet, and `Provider.listen()`
  installs a `SIGINT` handler that calls `process.exit()`. Its `RedisCacheManager` uses ioredis. mongoose and
  ioredis load at import. `getLaunchContext(ltik)` does not check whether the platform is still active.
- **Decision:** ltijs runs on our `ExpressRouterHttpHandler` (an Express `Router`); we never call
  `Provider.listen()`. `SPEC-DEVIATION`: our node-redis `LtiCacheManager` replaces ltijs's `RedisCacheManager`
  (`LTI-001` wording); it caches only public JWKS and keysets. ltijs's own HTML gets a CSP with hashes of its
  inline scripts. Its default handlers are replaced by friendly pages. Our ltik resolver also checks
  `platform.active`. ltijs's OIDC *recovery token* (at most 10 minutes, grants nothing on its own) may sit in the
  frame's partitioned localStorage (stock Chrome) or, where storage is blocked and `localStorage` throws, in LTI
  Platform Storage; the ltik never does.
- **Consequences:** mongoose, mongodb and ioredis are installed and loaded but never connected; an upstream issue
  asks ltijs to load them lazily. ESLint forbids importing `RedisCacheManager`, `ExpressHttpHandler` and
  `MongoLegacyDatabaseManager`. The S3 probes (`test/lti/upstream/ltijsProvider.test.ts`) also showed: ltijs
  copies the claims for the handler only after `saveIdToken` returns, so our storage filters a copy, never its
  argument; a resumed context (`getLaunchContext`) has only the stored claims, so the claim allowlist (D-052)
  must keep everything a later request reads (e.g. Deep Linking settings); and our handler must pass Express's
  lower-case `req.headers` through, or ltijs skips its `Sec-Fetch-Site` check without an error. ltijs 7.0.7's
  launch page calls `localStorage.removeItem` outside its `try`, so where frame storage is blocked (the getter
  throws) the launch form is never submitted. A static guard script (`src/lti/pages/client/ltijsStorageGuard.js`)
  runs before ltijs's scripts and, only when the getter throws, puts a stand-in in its place that stores nothing
  and whose `setItem` still fails, so ltijs falls back to Platform Storage as designed. The cookie-less e2e launch
  (`apps/server/e2e/ltiIframe.e2e.test.ts`) found the same problem in H5P Core 1.28: it reads `localStorage` without
  a `try` (xAPI actor UUID, clipboard, xAPI queue), so `H5P.init` stopped and learner state was never saved. The LTI
  player therefore loads `src/lti/pages/client/h5pStorageGuard.js` before H5P Core: only when the getter throws, it
  puts a page-memory stand-in in its place (nothing reaches disk; the ltik is never written to it). With storage
  blocked *and* no `lti_storage_target`, ltijs cannot recover its state and the launch ends on our "launch failed"
  page; Canvas sends `lti_storage_target`, so this affects only other platforms.
- **Amendment (2026-11-25, D-141):** ltijs's `Sec-Fetch-Site` check on its second launch POST is no longer the
  only one: our handler also requires our own `Origin` from a browser that sends no fetch metadata, and ltijs's
  launch page is sent with `Referrer-Policy: same-origin`. ltijs's request handler is replaced by ours
  (`lti/http/LtiOutboundRequests.ts`).

### D-051 · LTI platforms and deployments from `LTI_PLATFORMS`; deployment IDs checked by us
- **Context:** `LTI-001` requires rejecting a launch with a wrong deployment ID. ltijs 7 checks only that the claim
  is a string, and its platform model has no deployment field.
- **Decision:** A new table `LtiDeployment(platformId, deploymentId)`. `LTI_PLATFORMS` (JSON in env) is synced at
  start-up: new platforms are registered (ltijs generates the tool key pair), endpoints updated, removed platforms
  deactivated, and each platform's deployments replaced. The deployment ID is checked in `saveIdToken`, so no ltik
  is ever minted for a foreign deployment, and again on every use of an ltik.
- **Consequences:** Adding a Canvas deployment is a configuration change and a restart. Dynamic Registration
  (`LTI-009`) stays in S6.

### D-052 · ltijs records: 10-minute nonces, 24-hour ID tokens with a claim allowlist
- **Context:** `LTI-002` says nonces expire after 10 minutes; the data inventory said 1 hour. ltijs stores the whole
  ID token, which can carry names, e-mail, `lis` identifiers and custom fields.
- **Decision:** Nonces live 10 minutes (the inventory is corrected), matching ltijs's 600-second state.
  `consumeNonce` is one conditional `DELETE`, which is atomic. ID tokens live 24 hours and expired rows are never
  returned. The stored claims are an allowlist of what the launch needs; names, e-mail, `lis`, `feide_login` and
  unknown custom fields are dropped before storage. A cleanup job runs every 10 minutes under a Redis lease.
- **Consequences:** The launch handler still sees the full claims in memory; only storage is minimised.

### D-053 · The `Principal`: always a user ID, roles as a list, one mapping to the H5P actor
- **Context:** Spec 02 §2 types `Principal.userId` as a string but comments "null for learners", while D-034 gives
  learners pseudonymous `User` rows and `HvlH5pActor.accountId` is required (D-036).
- **Decision:** `userId` is always set. `roles` is a list; the H5P role is the highest of them. LTI principals have
  `hvlMember = false` and `feideAuthenticated = false`, so in Canvas they see the launched activity and their own
  content. `auth/principalToH5pActor.ts` is the one mapping to `HvlH5pActor` (D-036). Spec 02 §2 is amended.
- **Consequences:** No code path has to handle a missing user ID.

### D-054 · The Feide subject is the Feide ID; Groups API failures fail closed
- **Context:** `DATA-002` derives the learnerKey from `feide|<feide-id>`, `AUTH-005` compares Canvas's login ID with
  the Feide ID, and `ADMIN_FEIDE_IDS` lists Feide IDs. `AUTH-004` allows `sub` or the Feide ID.
- **Decision:** The Feide subject is the Feide ID (`eduPersonPrincipalName`, trimmed and lower-cased). It feeds
  `Identity.subjectHash`, the learnerKey, `ADMIN_FEIDE_IDS` and account linking; `sub` is never stored. A login
  without a Feide ID is refused with a friendly page. The organisation comes from the Groups API (`fc:org:<realm>`);
  if that call fails, the login fails closed (503 page). `enableNonRepudiationChecks` adds an ID-token signature
  check against Feide's JWKS on top of openid-client's claim checks.
- **Consequences:** Feide users without a Feide ID (guests, eduGAIN) cannot log in (owner to confirm, Q12).

- **Amendment (2026-11-25, D-142):** «trimmed and lower-cased» is done in ASCII only: SP and HTAB are trimmed and
  `A`–`Z` lower-cased, every other character stays as written, and then the pattern is checked
  (`auth/identity/feideId.ts`). Every reader of a Feide ID uses that one rule, so an ID written with a look-alike
  character (U+212A for `k`, a no-break space at an end) is another ID, never the plain one.

### D-055 · A stable identity key ring with HKDF purposes and a rotation rule
- **Context:** `Identity.subjectHash` and `AuthAuditEvent.ipHash` need a keyed hash whose key does not rotate every
  year (the learnerKey's key does, D-011), and the rotation must be defined (PROGRESS S3).
- **Decision:** `IDENTITY_HASH_KEYS` is a key ring `id=base64,…` whose first entry is current; HKDF derives the
  purpose keys `identity-subject` and `auth-audit-ip`. New columns `Identity.subjectKeyId` and
  `AuthAuditEvent.ipKeyId` record which key made a hash. Rotation: put the new key first; lookups try every key and
  re-hash a match in place at that login. Remove an old key after at least 13 months (learner rows are purged by
  then; a dormant staff member gets a new account). On compromise, rotate the same way at once.
- **Consequences:** Rotation needs no downtime and no bulk re-hash.
- **Amendment (2026-10-23, S3 verification):** rotation has three steps, as in D-056: (1) add the new key second and
  restart every server, so every server finds rows under either key; (2) when every server runs that ring, move it
  first and restart every server (logins re-hash to it, new audit rows use it); (3) remove the old key at least 13
  months after the last step-2 restart. Putting the new key first in one step lets a server still on the old ring
  miss a row hashed with the new key and give that person a second account, and the lookup cannot repair that later
  (`src/auth/identity/identityLookup.ts` prefers the current-key row, else the oldest). A leaked key is rotated with
  the same steps, started at once, and stays in the ring while rows re-hash. Residual risk, accepted: whoever
  holds the leaked key and a copy of the database can test guessed Feide IDs and IP addresses against every hash
  made with that key for as long as such rows exist: `AuthAuditEvent.ipHash` rows with that `ipKeyId` (up to 2
  years) and `Identity` rows of people who never log in or launch again (retention: account). Removing the key
  from the ring does not end this; without a guess the hashes reveal nothing.

### D-056 · Secrets at rest are encrypted with AES-256-GCM from a key ring
- **Context:** `LTI-002` requires platform private keys encrypted at rest; D-021 requires the Feide ID token in the
  session encrypted; S6 stores `GradeSyncJob.ltiSubEncrypted`.
- **Decision:** `DATA_ENCRYPTION_KEYS` key ring; AES-256-GCM with a per-purpose HKDF key and the purpose as AAD.
  Format `0x01 | keyIdLength | keyId | iv(12) | tag(16) | ciphertext`. Used for `LtiPlatform.privateKeyEncrypted`,
  `LtiAccessToken.tokenEncrypted`, the session's Feide ID token, and in S6 for `ltiSubEncrypted`. Values are
  re-encrypted with the current key when they are next written.
- **Consequences:** A database dump alone reveals no private key or token. A platform's key pair is written only
  at registration, so the server re-encrypts stale platform private keys at every start-up
  (`src/lti/platforms/reencryptPlatformKeys.ts`); access tokens and session ID tokens expire within 12 hours.
  Because the first restarted server rewrites the platform keys for everyone, a rotation has three steps (S3
  verification): (1) add the new key second and restart every server, so every server can read both; (2) move it
  first and restart every server; (3) remove the old key 12 hours after the last step-2 restart. Putting the new key
  first in one step would break LTI on servers not yet restarted, and a key that has been first must stay in every
  ring until nothing uses it.
- **Amendment (2026-11-05, S6 step 6 integration):** step (3) waits at least **31 days** after the last step-2
  restart, not 12 hours. Since S6, `GradeSyncJob.ltiSubEncrypted` stays under the key of the job's last write until
  the job's subject is cleared, 30 days after the job stopped (D-104, `DATA-002`,
  `apps/server/src/grades/GradeSubjectCleanupJob.ts`), and a job whose key is gone fails as `subject-unreadable`
  (`apps/server/src/grades/gradeJobSend.ts`). Found by the skeptic review of the backup and runbook work (D-110's
  backup amendment); `apps/server/.env.example` and `docs/ops/runbook.md` §4 say the same.

### D-057 · Own Redis portal sessions, login transactions and a synchronizer CSRF token
- **Context:** `AUTH-003` asks for a Redis session behind an opaque `__Host-hvli_sid` cookie (idle 2 h, absolute
  12 h) and CSRF protection; `H5P-007` requires 401 for an H5P request without a valid token. Generic middleware
  (express-session, csurf) does not give these exact semantics, and csurf is deprecated.
- **Decision:** Small own modules. Sessions in Redis under a hash of the session ID; the cookie is `HttpOnly`,
  `Secure`, `SameSite=Lax`, `Path=/`. A single-use login-transaction cookie (10 minutes) binds state, nonce and
  PKCE verifier to the browser, which prevents login CSRF. One synchronizer token per session, read from the
  `X-CSRF-Token` header, a `csrf` query value (H5P URLs) or a `csrf` form field; it is required on every unsafe
  method and on `/h5p/ajax` and `/h5p/contentUserData` for any method. A missing or wrong token is 401
  `hvl:csrf-invalid`. Roles are computed at login only.
- **Consequences:** A role change in Feide takes effect at the next login. Details settled in the implementation:
  the session cookie has no `Max-Age` (a browser-session cookie; the server enforces both limits); a cookie name
  sent twice is ignored entirely (defence against cookie tossing); logout is a POST, so the CSRF token protects it;
  the session's ID-token blob is sealed once at login, so a retired `DATA_ENCRYPTION_KEYS` key is kept at least
  12 hours. Reverse proxies must not cache responses that carry `Set-Cookie` and must not log query strings
  (`csrf`, `ltik`).

- **Amendment (2026-11-25, D-142):** a logout clears the session cookie only for the session it ended; a request
  without a live session changes no cookie. The order to delete a dead session cookie is added when an answer's
  headers are written, and only to an answer marked `no-store` or `private` (`auth/session/staleCookieClearing.ts`).

### D-058 · H5P URL tokens and signed content-file URLs
- **Context:** `H5P-007` asks that H5P's AJAX and user-data URLs carry the ltik (Canvas) or a CSRF token (portal).
  Lumi's `UrlGenerator` puts the token unencoded, and `contentFilesUrl` receives no user, while H5P builds file
  URLs as `contentUrl + "/" + path`, so a query token cannot work there. D-045 puts signed file URLs in S3.
- **Decision:** `HvlUrlGenerator` appends `ltik` or `csrf`, URL-encoded, from a new actor field `urlToken`.
  Content files are served from a public route `/h5p/files/:grant/:contentId/*file`, where the grant is an HMAC over
  `contentId|expiry` with `URL_SIGNING_KEYS`, valid for 12 hours and issued only by a render that passed the View
  check. An ltik in a query string is accepted only on `/h5p/ajax`, `/h5p/contentUserData/*`, `/lti/play` and
  `/lti/deeplink`; everywhere else it must be a Bearer header.
- **Consequences:** Script inside content could read the token from its page; the S2 sanitising and the S4 CSP
  limit that. The separate files origin stays in S6 (D-045). Details settled in the implementation: Lumi's
  `csrfProtection.queryParamGenerator` is not used, because it does not encode the token the same way on the three
  URLs (SPEC-DEVIATION from `H5P-007`'s wording); a grant's expiry is rounded up to the hour, so it lives 12 to 13
  hours and a file URL stays the same (cacheable) for an hour, verification allows 5 minutes of clock skew, and an
  old `URL_SIGNING_KEYS` key is removed at least 13 h 5 min after rotation; responses are `Cache-Control: private,
  max-age=<seconds left>`; the signed route reads only an activity's registered files (no temporary-file
  fallback); the player factory refuses Lumi's render options that skip the View check (`ignoreUserPermissions`,
  parameter overrides), so no grant is ever signed without it. The authenticated `/h5p/content/:id/*file` route
  stays for the H5P editor, whose integration has no `contentUrl`; an editor in a cookie-less Canvas iframe (S4)
  needs grant-bearing URLs issued after an Edit check.
- **Amendment (2026-10-23, S3 verification):** `URL_SIGNING_KEYS` rotates in the three steps of D-056: (1) add the
  new key second and restart every server; (2) move it first and restart every server; (3) remove the old key at
  least 13 h 5 min after the last step-2 restart. Putting it first in one step would make servers not yet
  restarted refuse the file URLs that restarted servers sign.

### D-059 · How the Feide and LTI role tables are read
- **Context:** `AUTH-002` and `LTI-004` leave some cases open: unknown LTI roles, how a course group matches, and
  what "visibility limited to the course" means for student authors when no course visibility exists yet.
- **Decision:** LTI `institution/person#Administrator` gives `author`, never `admin`; unknown roles and `TestUser`
  give `learner`. An `AUTHOR_COURSE_GROUPS` entry matches a group ID exactly or as a prefix followed by `:`. Student
  authors may share only `private` until a course visibility exists. Users from other organisations are `learner`
  and see only `feide`-visible activities. `ADMIN_FEIDE_IDS` grants `admin` only to an HVL member (a realm in
  `ALLOWED_FEIDE_ORGS`); a listed Feide ID from another organisation gets no admin role.
- **Consequences:** The owner confirms the student-author rule (Q12).

### D-060 · Authors may view a published activity they launched from Canvas (course copy)
- **Context:** `LTI-007` lets instructors of a copied course launch and play an activity they do not own. The S2
  rules granted launched activities to learners only.
- **Decision:** Amendment to `H5P-006`: an author may View a **published** activity opened by their own LTI launch.
  Edit stays with the owner and co-authors. The spec 01 matrix and its test are updated.
- **Consequences:** Copying a course never gives edit rights.

### D-061 · Deep Linking in Session 3
- **Context:** `LTI-005` names a picker with the author's activities, the content bank and "new from a pattern";
  the last two arrive in S5. Canvas sends `lineItem` only for `assignment_selection`.
- **Decision:** The picker lists the author's own and co-authored activities; drafts are shown but cannot be
  selected. The graded placement is recognised from Canvas's placement claim or, failing that, from our custom
  field `hvl_placement` set per placement in the developer key. A `lineItem` is sent only for
  `assignment_selection`. We use `createDeepLinkingMessage` with our own form (no inline script); the return URL
  must be http(s); several items only when `accept_multiple` is `true`.
- **Consequences:** TeCopp adds `hvl_placement` to the developer key (Q13).

### D-062 · The LTI-006 tabs and the LTI-007 duplicate come with their pages
- **Context:** `LTI-006` gives authors **Rediger** and **Innsikt** tabs; the editor page is S4 (D-040) and insight
  is S6. `LTI-007`'s "duplicate" belongs to the content bank (`PROD-007`, S5).
- **Decision:** `SPEC-DEVIATION`: in S3 both roles get the player; the tabs arrive with the editor page (S4) and
  insight (S6), and duplicating with `PROD-007` (S5).
- **Consequences:** `LTI-006` and `LTI-007` are tested for what S3 delivers.

### D-063 · Linking an author's Canvas and Feide identities
- **Context:** `AUTH-005` links an author's Canvas identity to their Feide identity through the custom claim
  `feide_login`.
- **Decision:** `feide_login` is read only when `LTI-004` gives `author`; values starting with `$` are ignored; it is
  never stored. If only the Feide account exists, the LTI identity joins it; if both exist and differ, the LTI
  identity moves only when its account owns no content and no co-authorship, otherwise `link.conflict` is audited
  and nothing changes. Learner identities are never linked.
- **Amendment (2026-10-23, S3 review):** the value is whatever the platform says, and AUTH-005 itself asks for it
  to be confirmed first *(verify with TeCopp)*. So linking runs only for a platform with `"feideLinking": true` in
  `LTI_PLATFORMS` (default false; set after the Q4 test launch), only for a Feide ID whose realm is in
  `ALLOWED_FEIDE_ORGS`, and only onto a Feide account that a Feide login created and that is not a learner's. A
  Feide identity is never created or attached from the Canvas side: the earlier cases "neither exists → one account
  gets both" and "only the LTI account exists → the Feide identity joins it" are dropped, because they let a
  Canvas user pre-claim someone else's Feide ID and linked student TAs whose Feide role was unknown. A Feide account
  that already holds another identity from the same platform is refused (`link.conflict`,
  `platform-identity-exists`); that check and the write run in one transaction with the Feide account's row
  locked; the same person's launch arriving twice at once (a double click) is no rival and no conflict. A refusal
  is audited on the claimant's own account (the one the launch uses), never on the Feide account it named; a link
  is audited on the account the launch then uses, which is the Feide account. If the launch fails after linking,
  the outcome (link or refusal) is audited without an actor.
- **Consequences:** No content ever changes owner through linking. A teacher who starts in Canvas is linked at the
  first Deep Linking launch after their first Feide login; if their Canvas account owns content by then, the two
  libraries stay apart (`link.conflict`) until a "Link with Feide" step that proves both identities exists (the
  AUTH-005 fallback, not built in S3). A Canvas administrator who can set login IDs on a linked platform can still
  join a Canvas account to an existing HVL staff account; that trust in the platform is why the flag exists.

### D-064 · What the authentication audit records
- **Context:** spec 02 §7 defines `AuthAuditEvent(at, actorUserId?, event, ipHash)`.
- **Decision:** Recorded events: `login.feide`, `login.feide.failed`, `logout`, `launch.lti.author`,
  `launch.lti.failed`, `link.feide-lti`, `link.conflict`; `ipHash` uses the D-055 key. Learner LTI launches are not
  recorded (volume and data minimisation). `ipHash` is recorded for logins, failed logins, logouts and failed
  launches; author launches and link outcomes carry the actor instead (a link outcome has none when its launch
  then fails, D-063).
- **Consequences:** The owner confirms the learner rule (Q15).
- **Amendment (2026-11-25, D-141):** failed logins and failed launches are recorded up to 10 rows a minute per
  network address and 300 in all; what is past that is counted in the log.

### D-065 · End-to-end tests in Session 3
- **Context:** The EVALUATOR-GUIDE says `npm run test:e2e` runs journeys J1–J5 from S3, but spec 00 places J1–J5 in
  S6 (they need S4–S6 features). The S3 gate needs the cookie-less iframe e2e (`LTI-003`).
- **Decision:** In S3 `npm run test:e2e` runs three Chromium flows: launch → play → resume in a cross-site iframe
  with third-party cookies blocked, the Deep Linking round trip, and portal sharing with logout. J1–J5 stay in S6;
  the EVALUATOR-GUIDE is corrected.
- **Consequences:** The e2e tests use the mock platform and run in CI. The S3 probe
  (`test/browser/thirdPartyCookies.browser.test.ts`) fixed the mechanism: full Chromium (`channel: 'chromium'`,
  not the headless shell, which ignores it) with `--test-third-party-cookie-phaseout`, checked by a canary. CDP
  `Network.setCookieControls` is not used: in full Chromium it misses a site-isolated frame after its first load.
  With Playwright's defaults the blocked frame's `localStorage` throws, which exercises ltijs's Platform Storage
  fallback; `partitionedStorage: true` restores stock Chrome's partitioned storage. CI must keep installing full
  Chromium (never `--only-shell`).

### D-066 · Friendly "not available" pages and visibility-only sharing until S4
- **Context:** `PROD-004` asks for a friendly page with 404 for drafts; `PROD-006` asks that visibility changes take
  effect immediately. Publishing (`PROD-003`) belongs to S4's validator flow.
- **Decision:** An unknown, draft or invisible activity always gets the same "not available" page with 404, so its
  existence is not revealed. A portal page without a session sends the browser to Feide login with a checked
  `returnTo`. The S3 sharing API changes **visibility only**; every change writes an audit event.
- **Consequences:** Activities are published through S4's flow (owner to confirm, Q14).

### D-047 · R-01 settled: Core 1.28 and Lumi 10.0.4 run the ten real content types
- **Context:** R-01 asked whether Lumi h5p-server 10.0.4 works with Core 1.28 libraries (spike steps 3–5, S2); the
  fallback was Core 1.27 without the Daylight theme. The Hub stayed unreachable (Q7), so the spike was carried into S4.
- **Decision:** Keep Core 1.28 with Lumi 10.0.4 and the F1–F3 workarounds. Evidence (2026-10-23): the ten types at
  their newest Core-1.28-era releases (MultiChoice 1.16.14, Blanks 1.14.13, DragText 1.10.52, QuestionSet 1.21.13,
  Column 1.18.8, CoursePresentation 1.28.25, InteractiveVideo 1.28.37, InteractiveBook 1.15.1 with Column 1.22.0,
  ImageHotspots 1.11.6, BranchingScenario 1.10.1; 120 libraries in all, built from GitHub, D-078) install through
  the seed path with the S2 package checks, import with their files, save through the editor with the sub-content
  policy, and play on our player page in Chromium without console errors, page errors or failed requests
  (`apps/server/test/h5p/realTypes.browser.int.test.ts`). Spike step 3 (Hub registration) still waits for Q7.
- **Consequences:** No downgrade to 1.27. Findings for later work: QuestionSet 1.21 announces its end feedback to
  screen readers but no longer shows it (relevant to `PED-H11` and `UD-030`); several libraries' Nynorsk files leave
  UI strings in English or are out of step with their semantics (BranchingScenario `l10n`), so authors may need to
  correct labels; InteractiveBook 1.15 offers only Column 1.22, which has no release tag (pinned commit, D-022 rule).

### D-067 · H5P runtime pages stay in Express; the Next.js app frames them
- **Context:** S4 brings `apps/web` (Next.js), the H5P editor page (D-040) and the move of the S3 LTI views (D-048).
  H5P needs its own global jQuery, CSS and iframes, and `UD-011`/`DATA-011` need a strict script policy. Next.js App
  Router pages always contain inline scripts, and H5P Core writes `<script src>` tags into its iframes, which a
  nonce policy with `'strict-dynamic'` would block.
- **Decision:** The H5P player (`/h5p/play/:id`, `/lti/play`) and editor (`/h5p/edit/:id`, `/h5p/new`, `/lti/edit`)
  stay server-rendered by Express with a hash-based policy (D-070). Next.js pages are the application chrome and
  frame them on the same origin: `/`, `/aktivitet/[id]`, `/aktivitet/ny`, `/app/play`, `/app/deeplink`,
  `/personvern`, `/hjelp`. Amends D-048: the picker and the LTI chrome move to `/app/*`; the friendly error pages stay
  server-rendered (they need Express's 401/403/404/503 statuses) but use the token CSS. Amends D-062: the
  **Rediger** tab arrives on `/app/play` for authors. H5P pages refuse a top-level navigation and send the browser
  to their chrome page, so the privacy link (`DATA-006`) is always on screen.
- **Consequences:** The S2/S3 player tests keep their page; e2e tests reach H5P one frame deeper. Same-origin
  framing does not isolate the ltik from H5P content; the script policy is the defence (D-058).
- **Amendment (2026-10-23, workstream planning):** the Deep Linking picker stays the server-rendered page at
  `/lti/deeplink` from S3, restyled with the token CSS and given the formative notice (`PROD-011`); there is no
  `/app/deeplink`. Its form post to Canvas works today, and a Next.js picker would need a new API for the signed
  Deep Linking answer without adding anything for the teacher. ltijs sends resource-link launches to `/app/play`
  only when the web app runs (`WEB_APP` is not `off`); otherwise to `/lti/play` as in S3, so the integration tests
  without the web app keep their flow.
- **Amendment (2026-10-23, integration):** the refusal of top-level navigations is `src/web/chromeRedirect.ts`,
  mounted only when the web app runs. A browser's own navigation (`Sec-Fetch-Dest: document`, `Sec-Fetch-Mode:
  navigate`) to `/h5p/play/:id` or `/h5p/edit/:id` gets 303 to `/aktivitet/:id`, `/h5p/new` to `/aktivitet/ny`, and
  `/lti/play` or `/lti/edit` to `/app/play` with only the ltik carried over (`no-store`, `no-referrer`). Frames,
  fetches and clients without fetch metadata get the page as before, so the integration tests and older browsers
  are unaffected.
- **Amendment (2026-10-24, review):** the pages Express still renders (the friendly error pages and the Deep Linking
  picker) show the web app's header themselves when the web app runs and they are opened on their own, in the
  browser or as the page of Canvas's iframe (`UD-013`): a skip link, the site name and **Hjelp** to `/hjelp`, which
  opens a new tab inside Canvas (`UD-007`). Inside our own chrome (the error pages of `/lti/play` and `/lti/edit` in
  `/app/play`, the not-available pages of `/h5p/play` and `/h5p/edit` in `/aktivitet`) the chrome's header already
  shows Hjelp, so a frame our own origin asked for (`Sec-Fetch-Dest: iframe` with `Sec-Fetch-Site: same-origin`)
  gets no second header; Canvas's iframe is cross-site, also after the launch's redirects. A browser without fetch
  metadata shows both headers, which repeats Hjelp but hides nothing. With `WEB_APP=off` there is no `/hjelp`, so
  there is no header. The picker lists its problems in an error summary below the heading that takes focus and
  links to the choices (`UD-013`). The editor's outer page uses the server pages' stylesheet for its save button and
  status (`UD-002`).

### D-068 · Express is the front door and runs Next.js in the same process
- **Context:** D-012 puts a reverse proxy in front of Express and Next.js in production. Development and tests need
  one origin too, and the session cookie (`__Host-`, D-057), ltijs's same-origin checks and `PUBLIC_BASE_URL` must not
  change.
- **Decision:** Express mounts Next.js's request handler (`next({ dev, dir })`) after all its own routes, for GET and
  HEAD only. Before handing over, Express removes `cookie`, `authorization` and the `ltik` query from the request,
  overwrites any client-sent `content-security-policy` and `x-hvli-*` request headers, and sets the per-request nonce
  policy and `x-hvli-locale`. `apps/web` has no route handlers, server actions or middleware (a test enforces it):
  every data request goes from the browser to the Express API. `WEB_APP=off|dev|prod` selects the mode; integration
  tests run with `off`. If the in-process mount fails, the fallback is `next start` behind a small Express proxy with
  the same header code.
- **Consequences:** Amends D-012 for development and tests; production may still put a proxy in front (S6).
  `npm run build` builds `apps/web` before `npm start` in production mode and before the e2e and a11y suites.
- **Probe result (2026-10-23):** the in-process mount works in both modes (Turbopack for `dev` and `build`); Next.js
  reads the nonce from the request's `content-security-policy` header and puts it on every script and the
  stylesheet preload; pages are dynamic because the layout reads `x-hvli-locale`. Findings: `next` 16.0.0–16.4.0
  carry GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r and GHSA-673q-mjm6-r5xr, so the pin is 16.4.2 (with React 19.3.1,
  one copy shared by server and app), and the image optimiser stays off (`images.unoptimized`); Next.js reports
  telemetry unless `NEXT_TELEMETRY_DISABLED` is set, which the build script and the server set; the server imports
  Next.js through a computed specifier with its own type for the factory, because Next.js's global types make
  `process.env.NODE_ENV` read-only and would break the server's compilation; `next-env.d.ts` differs between
  `dev` and `build` in Next.js 16, so it is generated (`next typegen` in `typecheck`) and ignored, not committed.
- **Amendment (2026-10-24, review):** the development server's WebSocket upgrades (`/_next/`, hot reload) get the same
  removal of `cookie`, `authorization`, `x-hvli-*` and the `ltik` query before Next.js sees them; any other upgrade
  is closed. Production refuses `WEB_APP=dev`, so the development server and its relaxed policy (D-070) never run
  there.
- **Amendment (2026-11-22, D-135):** the pin is 16.4.6; the rest of the probe result stands.

### D-069 · Query-ltik paths and file grants for the S4 views and the editor
- **Context:** D-058 accepts an ltik in a query string on four paths. S4 adds the LTI chrome pages and the editor in
  a cookie-less Canvas iframe, whose file URLs cannot carry a cookie.
- **Decision:** The query ltik is accepted on `/app/play`, `/app/deeplink`, `/lti/play`, `/lti/edit`,
  `/h5p/ajax` and `/h5p/contentUserData/*`; `/lti/deeplink` goes away with the server-rendered picker. Express
  resolves the ltik on `/app/*` before Next.js runs and passes only the page; the page script keeps the ltik in
  memory and removes it from the address bar. The editor's content files get signed grants issued after an Edit
  check (D-058's grant, bound to the content), and uploaded temporary files get a grant over
  `temp|userId|expiry` from the same key ring.
- **Consequences:** Amends D-058. The redaction and query-ltik tests cover the new paths.
- **Amendment (2026-10-23):** Express resolves the ltik of `/app/play` inside the LTI router (an invalid one gets the
  friendly 401 page there), checks View, and hands the web app the request header `x-hvli-launch` =
  `encodeURIComponent(JSON.stringify({ contentId, title, mayEdit, locale }))` (header values must be Latin-1; titles
  are not). The header is removed from client requests like every `x-hvli-*` header, and carries no token or user
  ID. `/app/deeplink` is not built (D-067 amendment).
- **Probe result (2026-10-23):** the editor page (`/h5p/edit/:id`, `/h5p/new`, `/lti/edit`) opens all ten real types
  and saves through the content API, also in the cookie-less Canvas iframe with frame storage partitioned or
  blocked. Upload grants use their own HKDF purpose (`temporary-file-url`) over the uploading account, served at
  `/h5p/uploads/<grant>/<account>/<file>`; content grants go into `H5PIntegration.contents`, which H5P's editor
  reads for saved files. Findings fixed on the way: Lumi's editor render checks no permission, so the route checks
  Edit before rendering or issuing a grant; Lumi lists every editor script for the outer page too, where H5P's
  `h5peditor.js` reads `window.parent` and fails when Canvas is that parent, so the outer page loads only H5P Core,
  the iframe creator and its language file, as H5P's own integrations do; H5P's `getAjaxUrl` lives in
  `h5peditor-init.js`, which Lumi does not load, so our boot script defines it; the editor iframe needs the page's
  storage stand-in where frame storage is blocked (`hvliGuardFrameStorage`); the editor keeps its UI state as user
  data of activity `0`, which is now answered empty and never stored; and H5P's hub client always asks for Content
  Hub metadata, which D-041 refused with 403 and now answers with empty lists (still without a network request).
- **Amendment (2026-10-24, final review DOC-4):** two parts of the Decision above did not happen as written.
  `/lti/deeplink` did not go away: the picker stayed server-rendered there (D-067 amendment), so its first page load
  still takes the query ltik as in S3, and `/app/deeplink` does not exist. The query ltik is therefore accepted on
  the pages `/app/play`, `/lti/play`, `/lti/edit` and `/lti/deeplink`, whose routes in the LTI router resolve it
  themselves, and on `/h5p/ajax` and `/h5p/contentUserData/*` (`LTIK_QUERY_PATHS` in
  `apps/server/src/auth/requestPrincipal.ts`, which also lists the three `/lti` pages). Upload grants are
  `HMAC-SHA256` with the HKDF purpose key `temporary-file-url` over `<accountId>|<expiry>`, as the probe result
  above says, not over `temp|userId|expiry` (`apps/server/src/h5p/contentFileGrants.ts`).
- **Amendment (2026-10-24, final review WEBA11Y-5):** activity `0` (the editor's own UI state) is still never
  written, but its GET answer now depends on the flag. H5P's editors read such a flag from the browser's
  localStorage and then let the server's answer override it (`ns.storage` in `h5peditor.js`; BranchingScenario's
  `UserStorage`). `{ success: true, data: false }` arrives as "not set". That is right for an "important
  description" (Blanks, DragText), which stays open until the author closes it. It is wrong for BranchingScenario's
  three guided tours (`h5p-editor-branching-scenario-*tour-v1-seen`), which then started on every open and faded the
  editor (inert, D-080 amendment of review THEME-V3). Those three flags are now answered
  `{ success: false, message: 'hvl:editor-ui-state-not-kept' }`, and H5P then keeps the browser's own flag. Every
  other flag keeps the empty answer, because an error answer for all of them would hide the important descriptions
  on a first open (`apps/server/src/http/routes/userDataRoutes.ts`). No table holds author UI preferences.
  Residual: in a browser that never closed the tour, or whose storage is cleared or blocked, the tour shows again.
  After its "I got it", focus falls to the frame's body because the tour removes its button (upstream), and the
  tour's repair in `packages/hvl-h5p-theme/src/a11yEditorRepairs.js` stays attribute-only. «Gå til feltet» presses
  the tour's "I got it" itself when a tour shows in the BranchingScenario editor
  (`apps/server/src/h5p/render/client/editorFields.js`). Tests: `apps/server/test/http/userData.int.test.ts`,
  `apps/server/test/h5p/branchingTour.browser.int.test.ts` (which reopens the editor after "I got it").
- **Amendment (2026-10-24, final review WEBA11Y-4, WEBSEC-3):** `x-hvli-launch` may also carry `language`, the
  activity's own language tag (`activityLanguage`, `UD-010`), read after the View check
  (`apps/server/src/lti/play/appLaunchRoutes.ts`), so the Canvas page marks the title with `lang` when it differs
  from the page (WCAG 3.1.2, `apps/web/src/i18n/partLanguage.ts`); present but malformed means no launch
  (`apps/web/src/lti/launchHeader.ts`). The portal's content summaries and details carry the same optional
  `language` (`packages/api-contract/src/content.ts`), for the activity page's `h1` and the links of the activity
  list; of the stored metadata only this tag leaves the server (`apps/server/src/content/contentSummaries.ts`). An
  activity saved without `defaultLanguage` reads as `en`, the `language` Lumi writes as a default on every editor
  save, as on the player's content container; activities from our editor and the real packages state
  `defaultLanguage`. Next.js 16 reads `location` into its router's `canonicalUrl` before the page script removes
  the ltik, and writes it back on every router update (refresh, hot reload); after removing the ltik the page calls
  `replaceState` once more, after Next.js's history hooks are installed, with Next.js's `__NA` marker left out of
  the state, so the router adopts the clean address (`UPSTREAM`, `apps/web/src/features/lti/ltikFromAddress.ts`). A
  browser test refreshes the router and checks the address (`apps/server/test/web/webChrome.browser.int.test.ts`).
- **Amendment (2026-10-24, second verification V2-ED-1, V2-ED-2, V2-ED-3: «Gå til feltet»):** three corrections.
  (1) The WEBA11Y-5 amendment's sentence that «Gå til feltet» presses the tour's "I got it" did not hold when the
  web app posts the path on the editor frame's load event (the first opening of Rediger,
  `apps/web/src/features/activity/ActivityView.tsx`) in a browser that never closed the tour: BranchingScenario asks
  for its tour flag with `H5P.getUserData` (a jQuery request) and shows the tour only once answered, which was often
  after the field had been opened, so the tour made it inert and focus fell to the frame's body. The path is now
  followed only once no request of BranchingScenario's editor is open (`H5P.jQuery.active`, within the same 20 s),
  and a tour that still shows after the field was opened is pressed and the path followed again
  (`apps/server/src/h5p/render/client/editorFields.js`). (2) A path that ends at a list (QuestionSet's `questions`,
  ImageHotspots' `hotspots`, Column's `content`) has no `field-name-` wrapper; the whole form stood in for it, focus
  went to the form's first control and nothing was said. The list's own wrapper is now found by the ID of its list
  element (H5P's ListEditor and VerticalTabs give it `getId()`), and the whole form is never counted as a field's
  own, so a path that ends there is announced as not reached. The code that opens what hides a field moved to its own
  file, `apps/server/src/h5p/render/client/editorFieldReveal.js`, served as a boot script before `editorFields.js`
  (`apps/server/src/http/routes/staticRoutes.ts`, `apps/server/src/h5p/render/editorPage.ts`). (3) A "not reached"
  status stayed on screen after a later «Gå til feltet» that reached its field (WCAG 4.1.3); each attempt now empties
  that text first, so a new one is announced again, while a refused save's reason stays
  (`apps/server/src/h5p/render/client/editorPage.js`). Tests: `apps/server/test/h5p/editorGoToFieldEarly.browser.int.test.ts`
  (posted on the load event in a fresh browser, four runs; the three list paths; not reached, then reached),
  `apps/server/test/h5p/render/editorFieldChain.test.ts`.

### D-070 · Content Security Policy for H5P pages and Next.js pages; no YouTube
- **Context:** D-039 and `DATA-011` require a script policy without `'unsafe-inline'` on the player page and no
  third-party requests. H5P Core writes one constant inline script into its iframes (`h5p.js` `getHeadTags`) and sets
  inline styles. The owner decided on 2026-10-23 that YouTube is not offered (it loads scripts and tracks viewers).
- **Decision:** H5P pages move `H5PIntegration` from an inline script into a `<script type="application/json">` block
  read by a static boot file, and send `default-src 'none'; script-src 'self' 'sha256-<getHeadTags>'; style-src
  'self' 'unsafe-inline'; img-src 'self' data: blob: <EXTERNAL_MEDIA_ORIGINS>; media-src 'self' blob:
  <EXTERNAL_MEDIA_ORIGINS>; connect-src 'self'; frame-src 'self' <EXTERNAL_MEDIA_ORIGINS>; font-src 'self';
  base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'self' <CANVAS_ORIGINS>`. A test computes
  the hash from the installed `h5p.js`, so a core update cannot drift silently. Next.js pages get a per-request
  nonce policy with the same first-party sources. `EXTERNAL_MEDIA_ORIGINS` (for example HVL's Panopto) is the only
  way to allow outside media; YouTube is never listed. `SPEC-DEVIATION`: `H5P-009` asks for nonces or SRI on every
  script; tags that H5P writes into its iframes cannot carry either, so they are covered by `'self'` instead.
- **Consequences:** A content type that needs inline handlers or `eval` gets a scoped, recorded exception, never
  `'unsafe-inline'` for scripts. Inline styles stay allowed on H5P pages only.
- **Probe result (2026-10-23):** all ten real types play and open in the editor under this policy with no script
  exception. Two changes: `base-uri` is `'self'` instead of `'none'` on H5P pages, because jQuery's HTML parser
  gives its scratch document a `<base>` with the page's own URL on every editor field (another origin stays
  refused); and BranchingScenario's editor embeds H5P's online tutorial (`documentation.h5p.com`), which the policy
  keeps out as intended (`DATA-011`); the editor works without it, and the browser test lists it so a new outside
  frame is noticed.
- **Amendment (2026-10-23, integration of the web shell):** the web pages' `form-action` is `'self'` plus the origin
  of `FEIDE_ISSUER`. The start page's logout form posts to `/auth/logout`, which answers 303 to Feide's end-session
  endpoint, and Chromium applies `form-action` to that redirect as well (the web workstream's probe); with `'self'`
  alone, logout from the web app was refused. No other directive names an outside origin.
- **Amendment (2026-10-24, Panopto):** the owner decided on 2026-10-23 that videos come from sources HVL allows in
  configuration, for example Panopto, and never YouTube. H5P.Video 1.6 plays a Panopto viewer link only through
  Panopto's embed API, which `scripts/panopto.js` inserts as a script tag for
  `https://developers.panopto.com/scripts/v1.2.0/embedapi.min.js`; under `script-src 'self'` such a video stayed on
  "loading". `script-src` on H5P pages therefore also lists that file as a path source (the file, not the whole
  `developers.panopto.com` origin), but only when an `EXTERNAL_MEDIA_ORIGINS` entry is a Panopto site (a subdomain
  of `panopto.com` or `panopto.eu`); a configured media origin itself never gets script rights. `SECURITY`: this is
  a third-party script on pages that hold the ltik in memory (D-058), so it is opt-in by configuration and limited
  to that one file; the player's iframe comes from the configured site, which `frame-src` already lists. Whether
  `embedapi.min.js` loads further scripts could not be checked (the file was not reachable from the build
  machine); if it does, Chromium reports the refusal and the video stays on "loading", and the source is widened to
  exactly the further file after checking it on HVL's network. `SPEC-DEVIATION`: `H5P-009` asks for SRI on every
  script and `DATA-011` for no third-party scripts beyond the media the author added; H5P.Video writes the tag
  without `integrity`, so SRI is impossible. A Chromium test plays a Panopto-shaped source with the request
  intercepted: the script loads when a Panopto site is configured and is refused when none is, and another script
  on `developers.panopto.com` stays refused.
- **Amendment (2026-10-24, review):** `font-src` on H5P pages is `'self' data:`: H5P.DragNBar 1.3 and 1.5
  (CoursePresentation, InteractiveVideo) inline their icon font as a data: WOFF in `styles/context-menu.css`; a data:
  font reaches no other origin. The friendly portal pages (not available, error, 404, logged out) send `default-src
  'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none';
  object-src 'none'; form-action 'self'; frame-ancestors 'self'` instead of `frame-ancestors 'self'` alone, so
  `DATA-011` is enforced on them too; `connect-src 'self'` keeps a page script's request to `/auth/session` working
  (the `PROD-006` e2e flow). The `WEB_APP=off` start page sends the same without `form-action`, because its logout
  redirect goes on to Feide (see above). The error pages of `/lti/play` and `/lti/edit` (matched as Express routes
  them: with a trailing slash and in any case) may be framed by `'self'` and `CANVAS_ORIGINS` like those pages,
  because `/app/play` frames them on our origin; launch, login and Deep Linking pages stay framed by Canvas only
  (`LTI-003`).
- **Amendment (2026-10-24, final review DOC-1):** the `SPEC-DEVIATION` from `H5P-009` also covers our own tags on the
  H5P pages. The player and editor pages (`apps/server/src/h5p/render/playerPage.ts`, `editorPage.ts`) write plain
  `<script src>` and `<link rel="stylesheet">` tags, with neither `integrity` nor a nonce, for the first scripts
  (`/static/lti/…`), the boot scripts (`/h5p/boot/…`), the server pages' stylesheet and Lumi's core and library lists,
  which on the player page include HVL's theme files (`/h5p/theme/…`). Like the tags H5P writes, they are allowed by
  `'self'` (in `script-src`, next to Core's hash, and in `style-src`). Spec 01's note of 2026-10-23 that our own page
  tags keep integrity hashes was wrong: no code wrote one. SRI was not added, for three reasons. Every one of these
  files is same-origin, served by the server that sends the page and its policy, so whoever can change a file can
  change the hash in the page as well; SRI guards against content changing on another origin, and the only other
  origin is Panopto's file (amendment above). The same theme files reach the iframes H5P Core writes (for content
  types it embeds in an iframe, and the editor's) only through `H5PIntegration.core` and `editor.assets`, as tags
  without `integrity`, so SRI on our tags would cover some documents with H5P content and not others. A nonce would
  add nothing while `'self'` must stay for H5P's own tags, because a script runs when any source of `script-src`
  allows it. The Next.js pages are not affected: Next.js puts the nonce on each of its scripts (D-068).
- **Amendment (2026-10-24, final review DOC-15):** with `WEB_APP=dev` only, the Next.js pages' policy adds
  `'unsafe-eval'` to `script-src`, which React's development tools need, and allows inline styles (`style-src 'self'
  'unsafe-inline'` instead of the nonce), because the development server injects style elements without one
  (`apps/server/src/web/webPageCsp.ts`). This is the "relaxed policy" of D-068's 2026-10-24 amendment. Production
  refuses `WEB_APP=dev` (`apps/server/src/config/productionChecks.ts`), `WEB_APP=prod` sends the nonce policy above
  unchanged, and the H5P pages' policy has no development variant.
- **Amendment (2026-11-23, D-140):** the H5P pages' `script-src` no longer holds the hash of Core's inline script.
  No page of ours lets Core build its own iframe, so nothing ran by it; the policy is `'self'`, plus Panopto's
  file when a Panopto site is configured.

### D-071 · CC-BY-4.0 is an allowed licence (caniuse-lite)
- **Context:** `next` depends on `caniuse-lite`, a browser-support data set under CC-BY-4.0, which the licence check
  (`tools/dependency-check/checkLicences.mjs`) does not list. Adding it showed that the check never saw it: D-029's
  `npm query ':not(.dev)'` drops every package that any dev tool also reaches, which left about 230 of 470
  production packages unchecked since S1.
- **Decision:** CC-BY-4.0 joins the allowlist. The FSF lists it as compatible with GPLv3, and the package is data,
  not code. A per-version exception was rejected because caniuse-lite releases weekly. Amends D-029: the check now
  reads `npm query '*'` and counts every package whose npm `dev` flag is false, i.e. what a production install
  contains. The packages that surfaced: MIT-0 (`@csstools/color-helpers` via jsdom) joins the allowlist;
  `@visx/vendor` (declared "MIT and ISC") is listed as reviewed; `elkjs` (EPL-2.0, not GPL-compatible) ships only in
  Prisma Studio, the GUI of the `prisma` CLI that production runs as its own process for migrations, and is listed
  by name and version as a separate program (aggregation, not a combined work).
- **Consequences:** Attribution is kept by shipping the package's licence file. A new version of a listed separate
  program fails the check until a person reviews it again.

### D-072 · Design tokens: generated CSS, a Tailwind v4 theme file and colour lint
- **Context:** `UD-001` makes `packages/design-tokens/tokens.json` the only source of colour and asks for "a Tailwind
  preset". Tailwind v4 configures themes in CSS (`@theme`); a JS preset loads only through the legacy `@config`.
- **Decision:** A generator writes `dist/tokens.css` (custom properties, forced-colours overrides) and
  `dist/tailwind-theme.css` (`@theme` aliases to `var(--hvl-*)`, with Tailwind's own palette removed). Both are
  committed and checked by `npm run tokens:check`, so the server needs no build step. `SPEC-DEVIATION`: the Tailwind
  "preset" is this theme file. Stylelint (`color-no-hex`, no colour functions or names, no `uppercase` or `justify`)
  and an ESLint rule against colour literals in `apps/*/src` and `packages/*/src` apply everywhere except
  `packages/design-tokens`; vendored H5P files, the mock platform and test fixtures are exempt, each with a `WHY`.
- **Consequences:** HVL's confirmed values (Q2) change one file; the contrast test decides whether they may be used.
- **Amendment (2026-10-23, W1):** (a) the visually hidden feedback prefix comes from the theme's static
  `feedbackPrefixes.js` in S4, not from the xAPI bridge that `UD-003` names (S6); (b) where a library already draws
  its own ✓/✗ for a state (MultiChoice, Blanks, DragText), that icon is the `UD-003` icon and the visible prefix is
  the label only, so no icon is doubled; (c) the prefix language follows `:lang()` of the element: the UI locale on
  our player page, `metadata.defaultLanguage` in iframes Core writes, and a container `lang` wins; (d) Stylelint also
  bans `color-mix()` (derived shades need HVL's approval, D-017) and ignores all of `tools/spec-site` (the generated
  spec website, not product UI); (e) the generated `dist/` folders are committed through package-level `.gitignore`
  files that re-include `dist/`; (f) H5P's own hard-coded colours remain where a library ignores Daylight
  (BranchingScenario 1.10 start screen); the accessibility suite decides whether they need overrides.
- **Amendment (2026-10-24, review A11Y-1/A11Y-2 and THEME-V1/V2/V9):** the answer prefixes also cover the question
  types the containers offer: TrueFalse 1.8, MarkTheWords 1.11 with its missed words, SingleChoiceSet 1.11, Summary
  1.10, MultiMediaChoice 0.3, and ImageHotspotQuestion 1.8 (offered by Column 1.18 and 1.22; none of the ten example
  packages installs it, a Hub package of Column does). They also cover MultiChoice's solution, whose filled or empty
  radio is no ✓/✗ and so gets the full prefix. Where a library uses the answer's pseudo-elements itself (TrueFalse,
  Summary, MultiMediaChoice), `feedbackPrefixes.js` shows its label as text (`prefixOn: "label"`,
  `.hvl-feedback-text`), which is then both the visible and the announced prefix beside the library's own icon.
  `SPEC-DEVIATION`: UD-003 names a `::before` prefix plus a visually hidden text node. ImageHotspotQuestion marks a
  click with a fixed 32 px circle that its image clips, so its visible label is the image's `::after` (`prefixPseudo:
  "after"`), placed beside the circle with CSS anchor positioning (in the image's corner where that is not supported).
  Where a library styles the answer's first paragraph as `:first-child` (SingleChoiceSet), the label goes into that
  paragraph. An answer inside a radio, checkbox, option or button named by `aria-label` (Summary's wrong claim,
  MultiMediaChoice's option) does not read its content, so the script puts the label in front of that name unless the
  name already states the state as H5P writes it (the label's word and a full stop, Summary's "Feil. …"), and restores
  the name when the state ends. `tokens.json` pairings may name a `color-mix(in srgb, …)` of two tokens where an H5P
  library draws one (CoursePresentation's progress bar), and the contrast test fails when a pair drawn over Daylight
  is not declared there. The cues for where an answer goes and which tasks are answered (DragText's empty drop zone,
  CoursePresentation's answered-task dot, the dot also under forced colours) are in `hvl-h5p-indicators.css`.
- **Amendment (2026-10-24, final review F11):** `SPEC-DEVIATION`: `UD-003`'s acceptance "Checked in greyscale
  screenshots" is not an automated check; no test renders or stores a greyscale screenshot. A grey screenshot proves
  nothing until a person judges it, and a stored reference image would need that judgement again after every
  library update (D-078). The browser tests check instead what lets a state be told apart without colour: the text
  prefix drawn as `::before` content or as `.hvl-feedback-text` (with its own ✓ or ✗ where the library draws none,
  W1 (b) above) and announced in the accessibility tree, for the ten types and the question types they offer
  (`apps/server/test/h5p/hvlFeedback.browser.int.test.ts`, `hvlFeedbackContainers.browser.int.test.ts`,
  `hvlFeedbackHotspot.browser.int.test.ts`); `packages/design-tokens/test/contrast.test.ts` checks the colour pairs
  they are drawn in. The look in greyscale is a step of the manual protocol
  (`docs/accessibility/manual-test-protocol.md` §7, "Greyscale"), which HVL runs with the operating system's
  greyscale filter and records with the other manual results (D-079).
- **Amendment (2026-10-24, final review NEW-1):** a correction of the F11 amendment above, which says more than the
  tests prove. The browser tests answer in MultiChoice, Blanks and DragText, and in the question types inside
  QuestionSet (TrueFalse, MarkTheWords, MultiMediaChoice), Column (SingleChoiceSet, ImageHotspotQuestion) and
  InteractiveVideo (Summary). No browser test answers a question inside CoursePresentation, InteractiveBook or
  BranchingScenario; the questions there are the same libraries, and
  `packages/hvl-h5p-theme/test/feedbackPrefixesCss.test.ts` checks that the target list covers each of these question
  types in both states. The prefix is drawn as `::before` content, as the image's `::after`
  (ImageHotspotQuestion, `prefixPseudo: "after"`, amendment of review A11Y-1 above) or as `.hvl-feedback-text`. So
  "for the ten types and the question types they offer" should read "for the question types the ten types offer".

### D-073 · The validator is pure: shape-based walk, configuration passed in
- **Context:** `UD-020` asks for a pure, deterministic `validateContent`. The S2 parameter walker needs an
  asynchronous semantics lookup, and spec 04 §5 keeps hint thresholds in `content/laeringsdesign/hint-thresholds.yaml`.
- **Decision:** `validateContent(input, context)`: `context` carries the thresholds and the captioned media origins,
  loaded and checked with zod once at start-up (a bad file stops the server). Sub-content is found by shape (an object
  with `library: "H5P.Name x.y"` and `params`), recursively. Rich text is parsed with `htmlparser2` (synchronous, the
  parser sanitize-html already uses); `htmlparser2` and `yaml` become direct, pinned dependencies. Lint forbids I/O
  modules under `src/validation/`. Rule messages live in `src/validation/locales/`.
- **Consequences:** The second parameter is an addition to the spec's signature, not a change to its behaviour.
- **Amendment (2026-10-23, W2):** interpretations the rules make where spec 04 §5 and UD-021 leave room, each also in
  its rule's module header, for ALU to confirm: PED-H06's main path is the path from the first node that meets the
  most decision points without repeating a node (the search stops after 20 000 steps), and "a way back" is backwards
  navigation or a loop to an earlier node; PED-H08 counts learner tasks only, also in InteractiveBook chapters (which
  are Columns); PED-H05 also flags verdict-only wrong-answer feedback («Feil.») and reads TrueFalse's
  `behaviour.feedbackOnWrong`; SingleChoiceSet has no per-answer feedback to check; V-VID-CAPTIONS counts a track
  only when its kind is subtitles, captions or unset (stricter than "any text track"); PED-H01 uses a lower bound of
  the video length from the latest interaction time, because content.json has no duration; V-VID-TRANSCRIPT accepts
  any authored text or link that mentions a transcript, since H5P has no transcript field; V-HOTSPOT-ORDER accepts
  numbered icons or a list order that follows reading order. Findings are unique per `(ruleId, path)`, as the
  acknowledgements of D-074 need.
- **Amendment (2026-10-24, review fixes, validator):** corrections after checking the rules against the code of the
  installed libraries (D-078); each one is also in its rule's module header. V-HOTSPOT-ORDER checks the order in which
  learners meet the hotspots, and only the hotspots the player shows: from 1.10, ImageHotspots drops a hotspot whose
  content has no item with a library, and 1.5 drops one without content. Unless the icons are numbers, ImageHotspots
  (1.5, 1.10, 1.11) sorts the hotspots strictly by y, then x, before it builds the DOM (a hotspot whose x or y is 0
  goes last), so the list order never reaches the learner. The rule warns when hotspots on one visual row (within 10
  percentage points of height) are read right to left, or when a hotspot moved last breaks the reading order. Its
  remedy is to place each hotspot of a row a little lower than the one to its left, because hand-placed hotspots
  rarely get exactly the same height. Numbers as icons are offered only from ImageHotspots 1.11
  (`V-HOTSPOT-ORDER.unorderedWithoutNumbers` for older versions). With numbers (1.11) the list order is kept and only
  hotspots with the default icon get a number, so a list with unnumbered hotspots must follow the image
  (`V-HOTSPOT-ORDER.partlyNumbered`). V-VID-CAPTIONS counts a track only when its kind is subtitles or captions:
  H5P.Video 1.6 does not add a track without a kind, and InteractiveVideo hands its tracks to it
  (`V-VID-CAPTIONS.kindNotSet`). V-IMG-ALT and V-IMG-ALT-LENGTH also check Dialogcards (`dialogs[n].imageAltText`),
  MemoryGame from 1.2 (`cards[n].imageAlt`, `cards[n].matchAlt`; 1.1 has no alt-text fields, and 1.2 gained them in
  patch 1.2.6), Collage (`collage.clips[n].alt`) and a shown QuestionSet cover from 1.21
  (`introPage.backgroundImageAltText`). These have no decorative flag, so an empty alt text is an error to fix or
  acknowledge. V-HEADING-ORDER reads the reading texts of an H5P.Column (every InteractiveBook chapter) as one
  outline. V-COLOUR-WORDS leaves only a BranchingQuestion's choice texts to V-BRANCH-COLOUR. PED-H07 does not report a
  task's switch that its QuestionSet, CoursePresentation or InteractiveVideo forces on with `override.* = "on"`.
  PED-H06 merges alternatives that lead to the same node and computes the best path on from each node on no cycle only
  once. A case without loops is therefore counted exactly as long as it is at most 500 nodes deep and fits the 20
  000-expansion budget, which in practice limits only the search inside loops; past either bound PED-H06 reports no
  count rather than a guess. Message numbers are written per locale (`11,5` and `1 500` in nn and nb), and
  PED-H01/PED-H02 round minutes up to a tenth, so a message never contradicts its threshold. Findings stay keyed on
  the same (ruleId, path) for unchanged content.

### D-074 · Publishing: server re-validation, acknowledgements and concurrency
- **Context:** `PROD-003` and `UD-022` let an author publish despite an error with a recorded reason, raised again
  after 14 days. D-066 waited for this flow.
- **Decision:** `GET /api/content/:id/findings` returns the findings and which errors are acknowledged.
  `POST /api/content/:id/publish` takes the `updatedAt` it checked and acknowledgements `{ruleId, path, reason}`;
  the server validates the stored content again and never trusts the client's findings. An error is covered by an
  acknowledgement for the same rule and path younger than 14 days, or by one in the request; acknowledging something
  that is not a current error is a 400; remaining errors are 409 `hvl:publish-blocked`. The status change, the new
  acknowledgements and an audit event (rule IDs only, no reason text, `DATA-007`) are one transaction conditional on
  `updatedAt` (409 `hvl:content-changed`). `POST …/unpublish` returns an activity to draft. Saving an activity that is
  already published runs the same gate. Only those who may edit (H5P-006) may publish.
- **Consequences:** Acknowledgements keyed on a path ask again when list items move; that fails safe.
- **Amendment (2026-10-23, W3):** every save of an existing activity increases `H5PContent.version` (the inventory
  used to say "on structural change"; since D-093's 2026-10-29 amendment only a structural save does); a refused
  save of a published activity is 409 `hvl:published-save-blocked` with the findings, and nothing is saved; findings, publish and unpublish answer 404 when the person may not view
  the activity and 403 `hvl:edit-not-allowed` when they may view but not edit; unpublish clears `publishedAt`, and
  publishing an activity that is already published validates again and moves `publishedAt` to now.
- **Amendment (2026-10-24, review fixes F-01, F-02):** the save gate validates what the editor will store, not the
  request: HVL's sub-content policy and Lumi's semantics enforcer run on copies of the request first
  (`apps/server/src/content/savedForm.ts`), so markup the sanitiser removes (e.g. an alt text that is only
  `<style>…</style>`) is judged as removed. A save of an existing activity (gate, Lumi's write, version count) and a
  publish (from its read to its commit) each hold the activity's Redis lock `hvli:content:write-lock:<contentId>` with
  the ID in lower case (`apps/server/src/content/ContentWriteLock.ts`, `writeLockKey`; lease 60 s, wait 30 s, then
  409 `hvl:content-changed`), because the save passes the ID as its URL spells it and the publish passes the stored
  ID; so a publish can no longer commit between the gate's status read and Lumi's write. A PostgreSQL lock was
  rejected because it would hold a pooled connection through the whole Lumi save, which needs connections from the
  same pool. Residual risk: if the gate's read and Lumi's write of the parameters were more than the 60-second lease
  apart, a publish could commit in between; only database reads and semantics walks lie between them, no file
  transfer. While Redis is unreachable, the client's offline queue holds the lock command, so a save or publish waits
  for Redis, as the Redis-backed session on the same request already does; it is refused only on an error answer
  from Redis. The saved form repeats the editor's cleaning steps;
  `apps/server/test/content/publishedSaveRealTypes.int.test.ts` compares it with what the editor stores, so a new
  step in `HvlH5PEditor`'s save must be added to `savedForm.ts` as well.
- **Amendment (2026-10-24, final review F1, F3, F4, F5, NEW-6):** a published activity with an error that has no
  acknowledgement that holds (it ran out, or the error is new to a later rule; the findings show both as
  `acknowledgement: null`, so the note names neither) offers **Grunngje på nytt** on **Sjekk og publiser**, next to
  **Gjer om til utkast**: the publish dialog, labelled for new reasons, which sends the same `POST …/publish` (W3:
  it validates again and moves `publishedAt`). With nothing to explain it offers only **Gjer om til utkast**.
  Publish and unpublish share one button element, so keyboard focus stays on it when the status changes, and after
  a publish or new reasons focus is put on it again, since **Grunngje på nytt** goes away once every error has a
  reason; unpublishing runs one request at a time (`aria-disabled` while it runs;
  `apps/web/src/features/activity/CheckPanel.tsx`). The refusal of such a save no longer blames the change:
  `error.publishedSaveBlocked` and the editor page's `page.editor.blockedSave` say that some errors have no reason
  that holds, that a reason holds for 14 days, and how to fix, explain or unpublish; the editor page lists the
  errors in its error summary, each with «Gå til feltet»
  (`apps/server/test/h5p/editorBlockedSave.browser.int.test.ts`). The Canvas page has no **Sjekk og publiser** tab
  (`LTI-006`), so in Canvas the editor says `page.editor.blockedSaveCanvas`: fix the errors and save again, or
  explain them on the activity's page in HVL Interaktiv, which needs a Feide login.
- **Amendment (2026-10-24, second verification V2-ED-4, SEC2-1, V2W-1, V2W-2):** the F3 amendment's refusal texts
  offered «Grunngje på nytt» for every refused save. Sjekk og publiser checks the stored version, and a refused save
  stores nothing, so an error that the change itself adds is never listed there and «Grunngje på nytt» cannot explain
  it; the publish request would refuse a reason for it too. `error.publishedSaveBlocked`, `page.editor.blockedSave`
  and `page.editor.blockedSaveCanvas` (nn, nb, en) now say so by case: fix the errors and save again; an error that is
  also in the published version can be explained with «Grunngje på nytt» (a reason holds for 14 days); an error new
  in the change can be explained only by publishing: in the portal, «Gjer om til utkast», save, and publish with a
  reason; in Canvas, it must be fixed while the activity is published
  (`apps/server/test/h5p/render/blockedSaveTexts.test.ts`). On the tab itself, a `hvl:content-changed` answer to the
  dialog now reloads the activity as well as the findings, so `renew` compares the two of one moment again; and when
  the control that had focus goes away (**Grunngje på nytt** behind its dialog, **Sjekk på nytt** after a retry that
  worked), focus moves to the main action instead of `body` (`apps/web/src/features/activity/CheckPanel.tsx`,
  `apps/web/test/features/CheckPanelFocus.test.tsx`).

### D-075 · Notice dismissals are stored per user
- **Context:** `PROD-011` remembers the formative-use notice's dismissal per user; `User` has no preference fields and
  the Redis session ends at logout.
- **Decision:** A table `NoticeDismissal(userId, noticeId, noticeVersion, at)`; a new notice version is shown again.
  `GET /api/me` and `PUT /api/me/notices/:noticeId`. Learners never see these notices, so no learner data is added.
- **Consequences:** New rows in `docs/privacy/DATA-INVENTORY.md`; deleted with the account.
- **Amendment (2026-10-24, review fix F-03):** `PUT /api/me/notices/:noticeId` refuses a `version` above
  `NOTICE_VERSIONS[noticeId]` with 400 `error.badRequest`, so a stored version always fits the INTEGER column and can
  never hide a later version of the notice in advance; an older version is stored as sent (a page left open).

### D-076 · The web app's own typed translations
- **Context:** UI strings exist in `nn`, `nb` and `en` only (CLAUDE.md). The server's messages are typed from
  `nn.json` (D-046). next-intl adds routing and middleware that D-068 does not use.
- **Decision:** `apps/web/src/i18n/` has the same typed `t()` and `locales/{nn,nb,en}.json` (locale-parity checked);
  the locale comes from Express's `x-hvli-locale` header (session or launch locale, else `nn`).
- **Consequences:** No next-intl dependency; one key style across server and web.
- **Amendment (2026-10-24, final review WEBSEC-2/F2, NEW-3, WEBA11Y-1/DOC-2):** the locale is the launch's, else an
  allowlisted `?lang=` (`nn`, `nb`, `en`; any other value or a repeated parameter is ignored), else the portal
  session's, else `nn` (`apps/server/src/web/webRoutes.ts`). The web app's **Hjelp** and **Personvern** links carry
  the page's locale (`apps/web/src/config/paths.ts` `infoHref`), and so does **Hjelp** on the server-rendered pages
  (`apps/server/src/http/pages/htmlPage.ts`), because inside Canvas they open a new tab without the launch, and
  portal sessions are always Nynorsk; without it the nb and en privacy notices (`DATA-006`) were unreachable. Every
  page but the start page now has its own title, "<page> – HVL Interaktiv" (WCAG 2.4.2,
  `apps/web/src/i18n/pageTitle.ts`); the start page is titled "HVL Interaktiv", and the activity page is titled
  "Aktivitet – HVL Interaktiv" until the activity has loaded, then "<activity's title> – HVL Interaktiv". Tests:
  `apps/server/test/web/webChrome.browser.int.test.ts` (an English launch's links open English pages; each route's
  title), `apps/web/test/features/ActivityView.test.tsx`.

### D-077 · API schemas in `packages/api-contract` and an OpenAPI document
- **Context:** `DOC-012` (moved from S3) asks for zod request and response schemas and an OpenAPI document at
  `/api/docs` in development. The web app becomes the first client of the API.
- **Decision:** `packages/api-contract` holds the zod schemas the server validates with and the web app types against.
  The OpenAPI 3.1 document is built from them with zod 4's own `z.toJSONSchema`, served at `/api/docs` when
  `NODE_ENV` is not `production`, and a test checks that every `/api` route is listed.
- **Consequences:** No OpenAPI library is added.

### D-078 · Real H5P libraries from GitHub at pinned commits
- **Context:** hub-api.h5p.org and github.com's web pages are unreachable from the build environment (Q7), but `git`
  reaches public GitHub repositories. Without real content types, `UD-003`, `UD-011` and `UD-030` would be tested
  on stand-ins only, and R-01 (D-047) stays open.
- **Decision:** `tools/h5p-libraries` (`npm run h5p:fetch-libraries`) clones each library's repository at a commit
  pinned in a committed manifest (repository, tag, commit SHA), resolves `library.json` dependencies recursively,
  builds libraries whose built files are not committed (`npm ci --ignore-scripts` and their build script), and packs
  one `.h5p` per content type with our own example content into the gitignored `apps/server/var/h5p-real/`. The
  packages are installed through the admin package import, so the S2 package checks run on them. Library files are
  not committed (Q10 stays open); synthetic libraries remain for unit tests.
- **Consequences:** Versions can differ from what the Hub serves; the Hub packages (D-042) replace them when Q7 is
  resolved. A type that cannot be assembled stays synthetic and is listed in PROGRESS. `SPEC-DEVIATION`: `H5P-003`
  seeds from packages downloaded from the Hub; these are built from H5P's own repositories at pinned commits and
  serve development, tests and CI until the Hub is reachable.
- **Amendment (2026-10-23, probe 1):** the H5P registry (`github.com/h5p/h5p-registry`, pinned) maps machine names to
  repositories. The resolver follows required dependencies and, as optional, the sub-content types each library's
  semantics offers (without them InteractiveBook could not save its own pages): 120 libraries, 23 of them built
  with webpack; 39 offered old versions are skipped and listed in the manifest (their dependencies are not in the
  registry, or they need a build without a lockfile). Three libraries have no matching release tag and are pinned to
  a reviewed commit (D-022 rule). Network errors are retried and never cause a skip. Builds run outside the repository, because a library's
  build otherwise picks up this repository's TypeScript configuration. Installing the first real package showed
  that S2's narrowed `contentWhitelist` (SEC-002) also applied to library folders through Lumi's
  `libraryWhitelist`, so every real package, from GitHub or the Hub, was refused for its icon fonts:
  `libraryWhitelist` now adds `eot ttf woff woff2 otf` (library folders only; content files keep the SEC-002 list).

- **Amendment (2026-11-25, D-143):** the tool holds a repository address, a machine name, a version, a ref and a
  commit to fixed forms before any of them reaches git or a folder name (`tools/h5p-libraries/sourceRules.mjs`):
  for the registry's addresses, for the names and versions in fetched `library.json` and `semantics.json` files,
  and for every line of the pin list when it is read. A repository is `https://github.com/<owner>/<name>`.

### D-079 · What S4 verifies automatically and what HVL records by hand
- **Context:** `NFR-003` names the last two versions of four browsers and three screen readers; `UD-031` asks for
  dated manual results. The build environment has Chromium only and no assistive technology.
- **Decision:** CI runs the axe suite and the browser checks in Chromium. `docs/accessibility/manual-test-protocol.md`
  scripts the manual tasks and the browser/assistive-technology matrix; HVL/ALU record dated results in
  `docs/accessibility/results/`. The S4 gate lists what remains manual.
- **Consequences:** Firefox, Safari, Edge and the screen-reader results stay open until HVL runs the protocol.
- **Amendment (2026-10-24, final review DOC-7):** `docs/TRACEABILITY.md` lists `UD-031` and `NFR-003` as "tested"
  because `apps/server/a11y/accessibilityDocs.a11y.test.ts` carries their IDs. That test checks that the protocol,
  the matrix and the results README agree with each other, and it passes while no result is recorded. We accept
  this mechanical status and do not give spec-trace a special case for the two. The traceability legend defines
  "tested" as "at least one test title carries the ID". `spec:trace --check --done-through=S4` must still count
  both as covered, because this decision leaves their manual results to HVL and outside the S4 gate. A status kept by
  hand inside the generator would be a second record of what PROGRESS already tracks, and nothing would clear it once
  HVL records results. The open work is the unchecked S4 item "First manual run of the protocol and the matrix" in
  PROGRESS.md. The matrix (§1, §3), the Evaluator Guide (§2, limitation 15) and `tools/spec-trace/README.md` say
  what "tested" means for these two.
- **Amendment (2026-11-05, S6 step 6: the conformance report, `UD-040`):** the split of this decision continues
  inside `docs/accessibility/WCAG-CONFORMANCE-REPORT.md`, which `npm run a11y:report` (`tools/a11y-report/`) writes
  with one section for each WCAG 2.2 Level A and AA success criterion: 56, counting 4.1.1 *Parsing*, which WCAG 2.2
  marks obsolete but WCAG 2.1 and EN 301 549, on which the Norwegian regulation rests, still list.
  - **Generated parts:** per criterion, how it is tested (the axe rules that carry the criterion's tag in the
    axe-core that `@axe-core/playwright` runs, under the suite's own tags, without the rules axe excludes by default;
    our own checks by requirement ID and suite file), which views, the result of the last full run of
    `npm run test:a11y`, links to the tests, the manual protocol's steps and §7 checks for it, and the upstream
    entries of `apps/server/a11y/support/upstreamRegister.ts` it concerns, with their issue links (none filed yet,
    D-112). Also a summary table, the dated manual results in `docs/accessibility/results/`, the register in full,
    and an appendix of the last run. The mapping from criterion to our checks is data in the tool, reviewed like
    code; a protocol step it names must exist in the protocol, or the generator stops.
  - **Manual parts:** text between `<!-- manual:start <id> -->` and `<!-- manual:end <id> -->`: per criterion the
    verdict (*Supports*, *Partially supports*, *Does not support*, *Not applicable* or *Not yet determined*) and the
    manual evidence; and the scope, the assistive-technology runs, the cognitive review, the barriers axe cannot see
    and the notes for the uustatus.no statement. The generator copies each block as it is; it stops on a broken,
    duplicate or unknown marker, a missing verdict line or an unknown verdict instead of dropping or guessing text,
    and seeds a missing block with *Not yet determined* and *Not yet tested by HVL*. No verdict is derived from the
    automated results: axe and our checks find only part of the barriers (the protocol's §1), so a *Supports* from
    them would overstate; the summary table copies the verdict people wrote.
  - **Determinism:** a run enters through a distilled, committed summary, `docs/accessibility/automated-run.json`
    (`--from-run=<dir>` reads Vitest's JSON report and the axe JSON lines of `A11Y_REPORT_DIR`; `--run` runs the
    suite first and needs `npm run build`). The report carries no time except the run's date and commit from that
    summary, so regenerating an unchanged tree gives the same file, and `--check` fails when the committed report
    differs from what its sources give: the gate's «regenerates the automated parts unchanged» (D-113). A new test
    file whose title opens with a mapped ID, a new suite or a new register entry therefore needs a regeneration in the
    same commit, as `docs/TRACEABILITY.md` does.
  - **Alternatives considered:** (a) reading the raw run outputs on every regeneration: a fresh checkout could not
    regenerate the report, and two runs never give the same file; (b) one table for all criteria: the manual blocks
    need a place per criterion; (c) a status kept in spec-trace: rejected above for `UD-031`, for the same reason.
  - **Consequences:** `UD-040`'s tests (`tools/a11y-report/test/`, `[UD-040]`) are its document check under D-113:
    the manual blocks survive a regeneration byte for byte, two regenerations give the same file, every criterion is
    listed and the committed report's blocks parse. HVL's evaluation of each criterion stays open until HVL acts.
- **Amendment (2026-11-05, S6 step 6 review of the `UD-040` generator):** the review found four ways in which the
  report could say more than is true. They are closed as follows.
  - **A failed file is a failure.** Vitest 5 reports a file whose hook (`beforeAll`, e.g. the browser or the services
    not starting) or import failed as `failed`, with its tests `skipped` or none at all; the summary then said
    "0 failed". The summary (format 2) now records such files in `failedFiles`, the report names them in the run's
    header, in the criterion lines of their checks and in appendix A, and `--from-run` exits 1 for a failed run, as
    `--run` does. A run is "clean" only when `git status --porcelain` shows nothing, untracked files included,
    since an untracked test or source file changes what ran.
  - **Only the whole suite is "the last full run".** `--from-run` and `--run` refuse, writing nothing, a run that
    lacks a suite file with running tests (a run of one file or a filtered folder), and a run with two suite files
    of the same path. Files are keyed by their path under `apps/server/a11y/`.
  - **No HVL verdict without a dated HVL evaluation.** A criterion block whose verdict is not *Not yet determined*
    needs the line `**Evaluated by HVL:**` beginning with a date (`YYYY-MM-DD`), and a block holds one verdict line
    only; otherwise the generator stops. So the summary's «Verdict (HVL)» column never shows a verdict that no dated
    evaluation stands behind, nor one of two contradicting lines.
  - **No text is lost to a marker the parser does not see.** Markers are found whatever their letter case (a
    `<!-- Manual:start … -->` stops the generator instead of its block being rewritten as generated text), and the
    composed report is read back before it is returned: it must give exactly the blocks that went in, byte for byte.

### D-080 · H5P markup barriers: repaired in the page where we can, registered where we cannot
- **Context:** `UD-030` lets CI fail on any serious or critical axe violation on every route and inside each type's
  iframe. The suite found such violations in H5P's own markup (player, editor and the content-type list): empty
  links, `role="tab"` items inside `<li>`, inputs without labels, drop zones with `aria-label` but no role. They come
  from the pinned upstream libraries (D-078), which we do not fork; `UD-040` already expects known upstream
  limitations to be listed with links.
- **Decision:** Barriers that a local, attribute-only change can remove without changing behaviour are repaired at
  run time inside H5P documents by `packages/hvl-h5p-theme/src/a11yRepairs.js`, loaded like `feedbackPrefixes.js`
  into player and editor iframes: it adds names, roles and labels, and re-applies them when H5P rebuilds the markup
  (MutationObserver). It never removes H5P's own handlers, focus order or content. Every barrier the suite still
  finds is an entry in `apps/server/a11y/support/upstreamRegister.ts`, matched by rule and markup, with the reason and
  a link to the upstream source at the pinned commit; an entry that stops occurring fails the suite, so the register
  cannot hide a fixed problem or a new one. `SPEC-DEVIATION`: `UD-030` says CI fails on any serious or critical
  violation; registered upstream violations are reported in every run but do not fail CI. Our own pages (the web app
  and the server-rendered pages) have no registered entries.
- **Consequences:** The register is the list for the `UD-040` conformance report (S6) and for issues to file
  upstream. A library update (D-078) re-runs the suite: a repair that no longer matches shows up as a new failure.
- **Amendment (2026-10-24, repairs):** `a11yRepairs.js` repairs eight barriers, each read against the pinned upstream
  code. (1) CoursePresentation's progress bar becomes a list of links (`role="list"`/`"listitem"`, the current slide's
  link `aria-current="step"`, a link without text named by its part's `aria-label`, the slide title). The parts keep
  that `aria-label`, which H5P.Tooltip shows, so they cannot become presentational for a valid tab structure.
  `aria-selected` is dropped from the list items, and so is the summary slide's `aria-controls`, which points at no
  element (cp.js creates that slide without an index, `id="slide-undefined"`). The slides, which H5P writes as the
  `role="tabpanel"` of those tabs, become groups still named by their part. The links keep H5P's roving tabindex: one
  of them is in the Tab order and the arrow, Home and End keys move between them, which the list no longer announces
  (manual protocol §8). (2) DragText's drop zones get `role="group"`, not `button`, because a dropped word (a button)
  sits inside them. (3) The score-range "to" field is labelled by the column heading, the row's "from" value and the
  dash, for example "Poengområde* 51 % –" in MultiChoice; the "*" is H5P's required marker, which the name of every
  required field in H5P's editor carries ("Tittel*"). (4) The editor's vertical tabs become a list of buttons, the
  open item `aria-current`, because a tab list may not hold the items' remove and order buttons; their forms
  (`<fieldset role="tabpanel">`) lose the role and are native groups. (5) The editor-mode switch becomes a group named
  by its title, the active mode `aria-pressed`. (6) The hotspot picker's copy of the background image gets `alt=""`.
  (7) DragNBar's paste button gets its tooltip text as its name: "Paste", which DragNBar 1.5 leaves untranslated in nn
  and nb (a translation gap to report upstream and to list for `UD-040`). (8) The hub's content-type list becomes a
  group named by its heading. What attributes cannot remove stays recorded. The hub's `nested-interactive` entry (tabs
  and content types) stays in the register: the tabs' focus and Enter belong to the inner link, the hub's CSS lays
  them out by `[role=tab]`, and each content type is a button that holds its own Details button. Two keyboard barriers
  that axe cannot see (WCAG 2.1.1, `UD-006`): QuestionSet's editor-mode switch cannot be used by keyboard (Enter and
  Space do nothing; `tabindex="1"`), and the vertical-tab buttons open with Space only, not Enter.
  `apps/server/test/h5p/a11yRepairs.browser.int.test.ts` holds an `upstream pin:` test for each (DOC-004), so a
  library update that fixes one fails there and this record is updated; both belong on the `UD-040` upstream list. The
  theme sizes CoursePresentation's progress-bar parts to 24 px itself, since they are no longer `[role=tab]`
  (`UD-005`). The theme also removed two register entries: under forced colours it sets the text fill of
  BranchingScenario's controls, so the forced-colours "measurement artefact" entry is gone, and while
  BranchingScenario's guided tour is open the parts it fades are inert (amendment of review THEME-V3 below), so the
  tour entry, whose pattern matched any element, is gone too. No entry may match a bare element
  (`apps/server/a11y/upstreamRegister.a11y.test.ts`). The editor's disabled «Paste» item stays registered in both
  colour modes, after the tour only, because its `opacity: .5` also fades it in a contrast theme (3.94:1). Of the
  register's 15 entries before the repairs, 2 remain. Tests: `packages/hvl-h5p-theme/test/a11yRepairs.test.ts`,
  `apps/server/test/h5p/a11yRepairs.browser.int.test.ts`, `apps/server/a11y/upstreamRegister.a11y.test.ts`.
- **Amendment (2026-10-24, review THEME-V3):** one repair changes focus order. While BranchingScenario's editor tour
  shows a step, H5P fades the rest of the editor (`.tour-fade`: opacity 0.15, `pointer-events: none`) but leaves it
  reachable by keyboard and screen readers, where its text and focus ring are all but invisible. `a11yRepairs.js`
  makes each faded part `inert` for as long as it has the class (marked `data-hvl-inert`, so only those parts are
  given back), as H5P's own `pointer-events: none` intends; the tour's dialog is never inside a faded part. The theme
  no longer keeps the faded parts at full opacity: that hid the spotlight while clicks there still did nothing. axe
  skips inert content, so the tour adds no register entry; the reuse panel with the Paste item is faded too, so the
  Paste entry applies after the tour only (`tour: false`).
- **Amendment (2026-10-24, final review DOC-9):** a third keyboard barrier that axe cannot see (WCAG 2.1.1,
  `UD-006`): ImageHotspots' hotspot position picker (H5PEditor.ImageCoordinateSelector 1.2.7,
  `scripts/image-coordinate-selector.js`) is a `<div>` with a click handler only, with no `tabindex`, no key handler
  and no x or y field, and a new hotspot starts at 50 % / 50 %. A keyboard-only author can add a hotspot but cannot
  move it. Attributes cannot add the missing input, so the barrier stays as H5P wrote it (repair 6 only gives the
  picker's copy of the image `alt=""`); the manual protocol (§8) names it, and it belongs on the `UD-040` upstream
  list with the other two. It has no `upstream pin:` test of its own yet: the repairs' browser test file has 199 of its
  200 lines (`DOC-007`), so the pin needs a file of its own; until it has one, the manual protocol is where the
  barrier is checked.
- **Amendment (2026-10-24, final review DOC-13):** no upstream issue has been filed for any repair or register
  entry. Filing them belongs to the `UD-040` work (S6), from this record and the register. `SPEC-DEVIATION`:
  `DOC-003` asks an `UPSTREAM` tag for a link to the upstream issue; until an issue exists, each tag links the
  library source at the pinned commit (D-078 manifest), and the issue link replaces it once the issue is filed. A
  repair can be removed once a pinned version of its library (version pinned now in brackets) writes itself what the
  repair adds: (a) CoursePresentation (1.28.25) a progress bar that is a list of named links,
  not a tab list of `<div>`s, and (b) slides that are no `role="tabpanel"`; (c) H5P.Components (1.0.99, DragText's
  drop zones) a role on the drop zone; (d) H5PEditor.RangeList (1.0.13) a label on the "to" field; (e)
  H5PEditor.VerticalTabs (1.3.16) no `role="tablist"` around items that hold other buttons and no `role="tabpanel"`
  on their forms; (f) the H5P editor (D-022 commit) a mode switch that is a named group whose active mode is
  pressed; (g) H5PEditor.ImageCoordinateSelector (1.2.7) an `alt` on its copy of the image; (h) H5P.DragNBar
  (1.5.23) a name on the paste button; (i) the hub client (in the H5P editor) a content-type list that is a list of
  items or a named group; (j) H5PEditor.BranchingScenario (1.5.13) a tour that makes the parts it fades inert. A
  repair is removed together with its expectations in `packages/hvl-h5p-theme/test/a11yRepairs.test.ts` and
  `apps/server/test/h5p/a11yRepairs.browser.int.test.ts`, and `npm run test:a11y` must then still pass. A register
  entry needs no such condition: an entry that stops occurring fails the suite (Decision above).
- **Amendment (2026-10-24, final review DOC-13, tests of (j)):** repair (j), the tour, is not tested in the two
  files the amendment above names. Its expectations are in `packages/hvl-h5p-theme/test/a11yRepairsTour.test.ts` and
  `apps/server/test/h5p/branchingTour.browser.int.test.ts`, and the axe scan of the BranchingScenario editor with the
  tour open is in `apps/server/a11y/axeEditor.a11y.test.ts`. Removing (j) removes or adjusts those.
- **Amendment (2026-10-24, pin):** the position picker now has its `upstream pin:` test,
  `apps/server/test/h5p/upstreamPins.browser.int.test.ts`, so the DOC-9 amendment's "no `upstream pin:` test of its
  own yet" no longer holds. The pin presses arrow keys, Enter and Space on the picker in the real editor and expects
  the hotspot not to move, then clicks as a positive control; a library update that gives the picker keyboard input
  fails it.
- **Amendment (2026-10-24, final review DOC-13 and NEW-1: repair (k) and the editor's own file):** the repairs are
  now two files, one per surface, loaded in this order into every H5P document after `feedbackPrefixes.js`
  (`apps/server/src/h5p/h5pAssets.ts`). `packages/hvl-h5p-theme/src/a11yRepairs.js` repairs the content types'
  markup: (a) to (c) of the DOC-13 amendment and (k) below. `packages/hvl-h5p-theme/src/a11yEditorRepairs.js`
  repairs H5P's editor, its widgets, DragNBar, the hub's list and BranchingScenario's tour: (d) to (j), so it is
  also the file that makes the tour's faded parts inert (amendment of review THEME-V3), which the Decision and the
  earlier amendments credit to `a11yRepairs.js`. The jsdom tests follow the split: (a) to (c) and (k) are in
  `packages/hvl-h5p-theme/test/a11yRepairs.test.ts`, (d) to (i) in
  `packages/hvl-h5p-theme/test/a11yEditorRepairs.test.ts` (not in `a11yRepairs.test.ts`, as the DOC-13 amendment
  says), and `a11yRepairsTour.test.ts` loads `a11yEditorRepairs.js`. A ninth barrier is repaired, (k):
  H5P.Question (1.5.47, `scripts/explainer.js`) writes the title of the explanation shown after a check (DragText's
  "Forklaring") as `role="heading"` without the `aria-level` that ARIA 1.2 requires (axe `aria-required-attr`,
  critical). `a11yRepairs.js` gives it level 2, because the player document has no heading of its own and the page
  around it gives the activity's title as its `h1`. It can be removed once a pinned H5P.Question writes a heading
  level itself; it is removed together with its case in `a11yRepairs.test.ts`, and the axe scan of DragText
  answered (`apps/server/a11y/axeContentTypes.a11y.test.ts`) must still pass. No upstream issue is filed for (k)
  either.
- **Amendment (2026-10-24, final review NEW-4: CoursePresentation's bar):** the 24 px progress-bar parts of the
  repairs amendment above lay over CoursePresentation's footer. The bar (`.h5p-cp-navigation`) is 3 % of the
  player's height, 5 px at 320 CSS px wide, and the parts' links (`z-index: 3`) covered «Vis sidemeny», «Neste side»
  and «Fullskjerm» at 320 and 640 px wide, so a pointer could not press them (WCAG 1.4.10, 2.5.8). A taller bar
  alone was clipped by the player's `overflow: hidden`. Outside full screen the theme now gives the bar room and the
  player grows by what that adds: `.h5p-wrapper` is `content-box` with `padding-bottom: max(0px, 24px - 1.6875%)`
  (CoursePresentation 1.28 keeps its height at 9/16 of its width, so 3 % of the height is 1.6875 % of the width), the
  bar and its parts are at least 24 × 24 px, and the summary slide's part keeps its 2.2em but at least 24 px
  (`packages/hvl-h5p-theme/src/hvl-h5p-theme.css`, with a removal condition).
  `apps/server/a11y/reflowAndMotion.a11y.test.ts` checks with a pointer that nothing covers a footer control at
  320 × 640 and 640 × 320, and `apps/server/a11y/targetSize.a11y.test.ts` measures the parts with every other target
  of the player. Residual: in full screen, which H5P fits to the screen, the bar stays H5P's own. Its parts then
  cover nothing, but on a phone they are 5 to 10 px high, below 2.5.8's size and spacing; `UD-005` is met there only
  through 2.5.8's equivalent-control exception, because the side menu and the previous and next buttons, which the
  theme's 24 px rule for buttons covers, reach every slide. No automated test opens full screen; the manual protocol
  (§8) checks it.
- **Amendment (2026-10-24, second verification V2T-1, V2T-2, V2T-3: CoursePresentation's footer):** the NEW-4
  amendment above is corrected. Its fix gave the bar room, but the footer stayed 7 % of the player's height (11 to
  15 px on a phone) with 24 to 29 px controls, so their top lay under the bar's links and the player's
  `overflow: hidden` cut off their bottom: a pointer reached «Neste side» in 15 × 11 px at 320 CSS px (WCAG 2.5.8,
  `UD-005`). The footer's middle column (20 %) was also narrower than the slide buttons, and the navigation around
  them (H5P.Components 1.0, a size container with `overflow: hidden`) cut 7 to 9 px off each. The sentence "checks
  with a pointer that nothing covers a footer control" was true of one point per control only, and "its parts then
  cover nothing" in full screen was false: there the bar's 5 to 7 px links lay over the top of the footer's controls,
  so no control met 2.5.8 itself and the equivalent-control exception did not apply. Now, in a file of its own,
  `packages/hvl-h5p-theme/src/hvl-h5p-targets.css` (loaded after `hvl-h5p-theme.css`, which keeps the general 24 px
  rule): outside full screen the footer is at least 24 px too and the player grows by both shortfalls
  (`padding-bottom: calc(max(0px, 24px - 1.6875%) + max(0px, 24px - 3.9375%))`, 7 % of a 9/16 height being 3.9375 %
  of the width); the middle column keeps its 20 % but is at least as wide as two buttons, their margins and the slide
  count; in full screen the footer lies above the bar, so each footer control meets 24 × 24 px itself and they are
  2.5.8's equivalent controls for the bar's smaller parts. QuestionSet's dot spacing moved to the same file.
  `apps/server/a11y/support/pointerReach.ts` now tries every pixel of a control and requires the points that reach it
  to span 24 rows and 24 columns; `apps/server/a11y/reflowAndMotion.a11y.test.ts` runs it at 320 × 640, 640 × 320
  and 390 × 844, in the page and in full screen, on the slide where both slide buttons work, and
  `apps/server/a11y/targetSize.a11y.test.ts` measures CoursePresentation's targets at 320 × 640 and 390 × 844. The
  accessibility suite now moves to CoursePresentation's question slide with a real pointer click on «Neste side»
  (`apps/server/a11y/support/views.ts`). The manual protocol (§8) still confirms the slides can be reached in full
  screen on a phone. Remove the rules when a pinned CoursePresentation gives its bar and footer 24 px.
- **Amendment (2026-10-24, second verification V2T-4):** the register guard (`matchesAnyElement`) accepted an entry
  that names only the start of a class or id (`class="h5p-`), which also matches a class H5P never writes. It now
  extends each class or id the pattern starts with an unknown name and treats a match as a catch-all; register
  entries name their classes whole (the hub entry's `class="h5p-hub-media` is now followed by `[ "]`, the space or quote
  that ends the name). Tests:
  `apps/server/a11y/upstreamRegister.a11y.test.ts`.
- **Amendment (2026-10-24, second verification V2D-5):** `DOC-003` asks an `UPSTREAM` tag for an issue link and
  when it can go. Two kinds of tag added in S4 had neither. `SPEC-DEVIATION`: as for the repairs (DOC-13 amendment),
  no issue is filed for them, and the pinned source stands in for the issue link. (a) Workarounds name their removal
  condition in the tag: the second `replaceState` for Next.js's router (`apps/web/src/features/lti/ltikFromAddress.ts`,
  until a pinned Next.js no longer writes its start-up `canonicalUrl` back) and the error answer to
  BranchingScenario's tour flags (`apps/server/src/http/routes/userDataRoutes.ts`, until HVL keeps author UI flags or
  H5P's editors stop letting the server's answer override localStorage). (b) Tags that record how pinned upstream
  code works, not a bug (where an editor keeps its widgets, how a tour is shown,
  `apps/server/src/h5p/render/client/editorFields.js` and `editorFieldReveal.js`), go when a pinned version changes
  that behaviour; each file's header says so once, and the browser tests in its `Tests:` line then fail.
- **Amendment (2026-10-24, S4 gate: what the CoursePresentation footer fix leaves):** two residuals of the V2T-1 fix,
  found by its fixer and not covered by a test. (1) The footer's middle column is at least as wide as two slide
  buttons, their margins and a slide count of about «10 / 12» in the default font; a presentation with 100 slides or
  more on a 320 px phone can again lose a few pixels of the slide buttons to H5P.Components' `overflow: hidden`
  (`UD-005`). The pointer test uses the four-slide example. (2) At phone width the bottom 2 to 3 px of a footer
  button's focus ring are clipped by the player's `overflow: hidden`; the ring stays visible on the other sides and
  the control is not hidden, so WCAG 2.4.7 and 2.4.11 hold (`keyboardFocus.a11y.test.ts` passes). Both are items for
  the manual protocol's next run and for the S6 conformance report (`UD-040`).
- **Amendment (2026-10-28, S5 probe P1):** without a start image, H5P.BranchingScenario 1.10 shows its default start
  and end pictures with no `alt` attribute (WCAG 1.1.1). The pictures are decorative, so the page repair gives them
  `alt=""`, and the upstream register records the barrier. H5P.Video's "Video source is missing." and
  H5P.ImageHotspots' "Missing required background image" are English text written by the libraries themselves
  (H5P.Video overwrites any `l10n` it is given), so they go into the register too; V-PLACEHOLDER (D-086 as amended)
  keeps an activity in that state from being published by mistake.
- **Amendment (2026-10-29, S5 W2a):** BranchingScenario's default pictures are now repaired (`alt=""`), so the upstream register names them in its header among the page repairs, still to be reported upstream for the conformance report (UD-040), rather than as an entry: an entry that no longer occurs would fail the suite. The two English library texts are entries in the register's `UPSTREAM_ENGLISH_TEXTS`, pinned by a test against the libraries' code.

### D-081 · One Node.js system with Lumi's H5P server half; an official PHP server half was considered and not chosen
- **Context:** H5P has a browser half (Core and the editor client) and a server half (storing content, installing
  libraries, the editor's AJAX, the Hub). We run H5P's official browser half unchanged (Core `1.28.0`, editor commit
  `ab2daa18`, D-022) and Lumi's Node.js server half, `@lumieducation/h5p-server@10.0.4` (D-002), which was built for
  Core 1.27. That costs us adapters: the config factory's Core 1.28 and `hub-api.h5p.org` settings, the 15-character
  `local_id` and the non-200 `/v1/sites` answer (spec 01 §1), Daylight's CSS that Lumi leaves out of the asset lists, our
  own Edit check before Lumi renders the editor (D-069), our own file security for CVE-2025-7062, which is Lumi's, not
  H5P's (D-003), and S6's data-subject tool deleting learner state through the storage (Lumi's
  `deleteAllContentUserDataByUser` deletes the acting user's data). The owner asked (2026-10-24) whether the H5P part could run on H5P's official server half in
  PHP instead, beside our Node.js system. That half is `h5p-php-library` with `h5p-editor-php-library`: a library, not
  a server; a host implements dozens of framework functions (about 60 in `H5PFrameworkInterface`, plus the editor's
  storage and AJAX interfaces) for its database, files, users and permissions, as the Moodle, WordPress and Drupal plugins do.
- **Decision:** Keep one Node.js/TypeScript system with Lumi's server half. Reasons:
  (1) Sign-in and permissions stay in one process. The ltik travels as a Bearer header in a cookie-less Canvas frame
  and lives in memory only (LTI-003, D-069); Feide sessions, CSRF and the View/Edit decisions (D-066) are made in one
  place. A PHP half would need every H5P request's identity and rights handed across a second service, a new
  security seam inside exactly the frames S3 and S4 hardened.
  (2) Privacy is enforced in one place: learners as HMAC pseudonyms (DATA-002), the yearly purge (DATA-003), the data
  inventory checked against one schema (DATA-001), *k*-suppression (INS-006). A PHP half would store learner state
  in its own tables and on local disk by default (`H5PDefaultStorage`), so each rule would be built and checked twice.
  (3) One language, runtime, deployment and set of checks for HVL IT to run, and one test suite.
  (4) The validator (D-073), the publish flow (D-074), the læringsdesign studio (S5) and the grade bridge (S6) read and
  write H5P content directly, inside the same transactions and locks (D-074's write lock).
  (5) The browser half, where H5P's behaviour and markup live, is already H5P's own. The accessibility barriers are in
  the content types and Core (D-080) and stay with either server half, and so does Core writing unescaped markup
  (D-039, D-070).
  (6) Lumi's server half works with Core 1.28 and the ten real types under these adapters (D-047), and a browser test
  replays them after every library change (D-078). A PHP half would mean redoing most of S2–S4's H5P work
  (D-035…D-080: permissions, upload security, the ten types, the editor in Canvas, the strict page policy, file grants).
- **Lumi's state (checked 2026-10-24):** npm's latest is still 10.0.4 (2025-03-08), but the repository's `master` is
  active: about 620 commits since that release, the newest on 2026-10-13. Unreleased changes that concern us:
  "buffer sanitizer and malware scanners and many other improvements in file security checks" (#4600, 2026-09-06),
  "accept SVG uploads with an XML prolog" (2026-10-04) and "reject packages with unsatisfied library dependencies"
  (#4625, 2026-10-06). Recheck: `npm view @lumieducation/h5p-server time` and the repository's commit log.
- **Consequences:** We keep carrying the adapters and the security work above, each marked `UPSTREAM:` or
  `SPEC-DEVIATION:` in code. S6 adds a checklist item: ask Lumi's maintainers for a release, or review and pin a Lumi
  commit built from source as D-022 pins the editor (a change to the CLAUDE.md invariant "h5p-server@10.0.4", so it
  needs its own decision and the full gate), then remove the adapters it makes unnecessary; report our fixes and the
  D-080 barriers upstream to Lumi and H5P.
- **Revisit when:** Lumi's repository has no commit for 12 months; a serious security flaw in Lumi can be neither
  fixed nor contained in our code; a Core version Lumi cannot support becomes necessary; or HVL decides to run regular
  H5P (h5p.com or a Moodle or WordPress installation) and give up the HVL-specific parts.

### D-082 · The studio's content pipeline: files in `content/`, loaded and checked at start-up
- **Context:** Spec 04 puts the phase labels, the guide, the patterns and the portfolio template in files that ALU edits
  without code (`PED-001`, `PED-011`, `MAPPE-002`). The web app reads no files (D-068), and the server already loads
  the hint thresholds from `content/` at start-up and refuses a bad value by name (D-073, `config/validationContext.ts`).
  ALU has not yet confirmed the proposals in `docs/reference/proposals/`.
- **Decision:** The studio's content lives in:
  - `content/laeringsdesign/phases.yaml`: the proposal (`status: proposed`), plus each phase's pedagogical purpose
    and Canvas placement for the phase matrix (spec 04 §3). The recommended patterns per phase come from the
    patterns' own `phase` field, so the matrix and the catalogue cannot disagree.
  - `content/laeringsdesign/references.yaml`: reference key → the full reference, with a `verify` flag until ALU has
    checked it.
  - `content/laeringsdesign/guide.{nn,nb,en}.md` (D-083).
  - `content/laeringsdesign/patterns/<id>/pattern.yaml` and `skeleton.json`, or `skeleton.<type>.json` for a pattern
    with two content types (D-084).
  - `content/mappe/template.{nn,nb,en}.md` and `content/mappe/criteria.{nn,nb,en}.yaml` (D-094).

  The server loads all of it once at start-up, checks it with strict zod schemas and freezes it; any error stops the
  start with a message that names the file and the key, as D-073 does. The checks:
  - every text exists in `nn`, `nb` and `en`; unknown and repeated keys are refused;
  - the three guides have the same headings (by level and order), markers and citation keys in the same order;
  - the three templates have the same template variables, and the three criteria files the same criteria IDs;
  - every reference key cited by a guide or a pattern exists;
  - every skeleton names its main library with a version (`H5P.X a.b`) that the pinned library list of D-078
    contains.

  `npm run content:check` runs the same loader without starting the server; CI runs it, and lint-staged runs it when
  a file under `content/` is staged. The web app gets the content as read-only JSON from `/api` routes. While
  `phases.yaml` says `status: proposed`, the studio pages show a banner saying the texts are a draft awaiting ALU.
- **Consequences:** Renaming a label is a content change (`PED-001`). A library that is pinned but not installed makes
  its patterns unavailable at runtime (D-085), not a boot failure. The shared YAML error reporting moves out of
  `validationContext.ts` into the new loader's folder, `apps/server/src/learningDesign/content/`.
- **Amendment (2026-10-29, S5 W2a):** skeleton versions are checked by `content:check` against the installed libraries' own semantics (the main library is the newest installed minor; each sub-content is a version its field offers), which CI runs after `h5p:fetch-libraries`. The server's start-up checks only the `H5P.X a.b` form, not the pinned list; a skeleton naming a library that is not installed is answered 409 `hvl:pattern-unavailable` at creation instead.
- **Amendment (2026-10-29, S5 integration of the accessibility suite):** a reference in `references.yaml` states the
  language it is written in (`language`, a language tag such as `nb`; English when left out, as most research is),
  the contract's `Reference` carries it, and the guide and pattern pages give the reference's text that `lang` when it
  differs from the page's (`UD-010`, WCAG 3.1.2): on a Nynorsk page an English reference was read with Norwegian
  pronunciation. A malformed tag is refused by `content:check`. `mogelvang2025` is in Bokmål and says `nb`.

### D-083 · `SPEC-DEVIATION` PED-002: the guide is CommonMark Markdown, not MDX
- **Context:** `PED-002` puts the guide in `guide.{nn,nb,en}.mdx`. MDX is compiled to JavaScript, so a content file
  becomes code: ALU could break the build or run script, and the web app bans `dangerouslySetInnerHTML` and reads no
  files (D-068). The guide needs headings, paragraphs, lists, emphasis, links, the "what this means for your activity"
  boxes, citations and the places where the phase matrix and the catalogue go.
- **Decision:** The guide is CommonMark, parsed on the server by `markdown-it` 14.3.3 with `html: false`, into a
  closed tree of nodes: heading, paragraph, list, list item, text, strong, emphasis, link, box, citation and marker.
  React renders the tree; links go through the existing `ExternalLink` component; there is no `innerHTML`.
  Conventions:
  - a line that is only `{{phase-matrix}}` or `{{pattern-catalogue}}` places that component;
  - a blockquote becomes the box, a `<section>` with its own heading «Kva dette betyr for aktiviteten din» (from the
    locale files);
  - a citation is `[@key]`, resolved against `references.yaml`, and the page ends with the references it cites;
  - headings start at `##`, because the page's `h1` comes from the locale files.

  Raw HTML, images, tables, code and links other than `https:`, `mailto:` and same-site paths are refused by the
  loader, naming the file and line.
- **Consequences:** `SPEC-DEVIATION` in spec 04 (`PED-002`, `PED-011`) and CLAUDE.md §2 ("ALU-editable YAML/Markdown").
  `content/laeringsdesign/README.md` documents the conventions for ALU.
- **Amendment (2026-10-28, S5 probe P5):** `html: false` cannot refuse raw HTML by line: markdown-it then emits no
  HTML tokens, and `<script>` reaches the tree as visible text. The guide builder therefore parses with a fresh
  `MarkdownIt({ html: true, linkify: false, typographer: false })`, only reads the tokens (it never calls `render`),
  and refuses every token type outside its closed allowlist, so `html: true` opens no HTML path:
  - **Allowed:** `heading_open` at level 2 or 3 written with `#` (a setext heading made with `===` or `---` is
    refused, because ALU may mean a rule), paragraph, bullet and ordered list (the start number is ignored), list
    item, blockquote (the box), and inline text, strong, emphasis, link and soft break (rendered as a space).
  - **Refused, naming the file and line:** `html_block`, `html_inline`, image, table, fenced and indented code,
    inline code, rule, strikethrough, hard break, a level-1 or level-4+ heading, `{{` outside a marker line, and
    reference definitions (found in `env.references`; they would silently turn citations into links).
  - **Links:** `md.validateLink` lets every link through and the builder checks the `href` itself: `https:` and
    `mailto:` ignoring case, or a same-site path that starts with `/` but not `//`. A `title` attribute is dropped.
    markdown-it would otherwise drop `javascript:` links silently and let `http:` and `data:image` through.
  - **Lines:** a block uses `map[0] + 1`; an inline token uses its paragraph's start line plus the line breaks
    before it, which is exact unless a link destination spans lines, so such a link is refused.
  - **Prose:** an ALU author who writes `<` before a letter gets an error and writes `&lt;` instead.
- **Amendment (2026-10-29, S5 W1a):**
  - **No guide yet:** the three guide files are optional until written: all three absent is "no guide yet" (the guide
    route answers no nodes and no references, so the contract's `Guide.nodes` may be empty, and the page shows the
    phase matrix and the catalogue alone); one or two present is an error naming each missing file.
  - **Markers:** each marker stands exactly once in each language, since the page shows each component once and the
    catalogue's section `id` must be unique; a missing marker would hide the catalogue (`PED-003`). The matrix has
    its own caption and the catalogue its own heading.
  - **Links:** a same-site path is also refused when it decodes to `//` or `/\` (for example `/%2F%2Fhost`), and a
    link whose text is empty or only spaces is refused, since nobody could see or name it.
  - **Patterns:** each pattern's `whyItWorks` is built with the same tree builder in prose mode (paragraphs and lists
    only) and checked when the pattern folder loads, so the pattern route never meets a text it cannot build.
  - **Routes:** `GET /api/studio` (phases, anchor, status and the catalogue with each pattern's `available`, asked per
    request), `GET /api/studio/guide/:locale` and `GET /api/studio/patterns/:patternId`, public (`auth: 'none'`); an
    unknown pattern or language is 404 `error.notFound`.
  - **Phase matrix:** the phases are columns with the *samling* as a column between the first and the second, and
    each phase has a link that filters the catalogue by it (spec 04 `PED-002` §4: "a filter by phase that also
    filters the pattern catalogue"); the filters live only in the address. Following that link moves focus to the
    catalogue's heading, because a Next.js link scrolls to `#monsterkatalog` but leaves focus on the link.
- **Amendment (2026-10-29, S5 integration of stage 3):** the public `GET /api/studio` and
  `GET /api/studio/patterns/:patternId` keep each pattern's availability for 60 seconds
  (`learningDesign/http/patternAvailabilityMemo.ts`), because working it out builds every skeleton and these routes
  need no sign-in ("asked per request" above now means within that minute). Requests that arrive during a build
  share it, and a failure is never kept. A library installed or removed shows in the catalogue within a minute;
  creating an activity always checks the libraries itself. Each guide box is a region named by its own heading and
  the guide heading it follows, so the three mechanisms' boxes have distinct names.

### D-084 · `SPEC-DEVIATION` spec 04 §4: pattern skeletons live in `content/`, with text tokens and pinned versions
- **Context:** Spec 04 §4 puts the skeletons in `apps/server/src/patterns/skeletons/`, but `PED-011` asks that a new
  pattern needs no code change, and ALU edits `content/`. A skeleton holds H5P parameters, and its texts must exist
  in three languages. Creating content on the server lacks the editor's localised semantics defaults and
  `subContentId`s.
- **Decision:** Each pattern is a folder `content/laeringsdesign/patterns/<id>/` with `pattern.yaml` (the fields of
  `PED-010` and the texts in `nn`, `nb` and `en`) and its skeleton JSON. The skeleton names its main library as
  `H5P.X a.b`, pinned to the versions of D-078. A text in the skeleton is a token `{{key}}` resolved from
  `pattern.yaml` in the language the author chooses; the value is plain text and is HTML-escaped on insertion, as H5P
  stores text fields. At creation the server:
  - fills in the fields the skeleton leaves out with the library's localised semantics defaults (a port of
    `tools/h5p-libraries/semanticDefaults.mjs`);
  - gives every sub-content node a fresh `subContentId` (UUID), ignoring any in the skeleton.
- **Consequences:** `SPEC-DEVIATION` in spec 04 §4. `content/laeringsdesign/README.md` explains how to make a skeleton
  from an exported `.h5p` file. A library update that changes a skeleton's fields shows up in `content:check` and in
  the integration test that creates every pattern (`PED-010`).
- **Amendment (2026-10-28, S5 probes P1 and P6):** what creating from a skeleton needs on the real libraries:
  - **Versions:** the main library is the newest installed minor, the one the editor offers (Column 1.22,
    CoursePresentation 1.28, ImageHotspots 1.11 and so on). A sub-content node names exactly a version its parent
    field's semantics `options` list (BranchingScenario 1.10 offers CoursePresentation 1.27); anything else is
    refused by SubContentPolicy. `content:check` checks both against the semantics of the pinned libraries that
    `npm run h5p:fetch-libraries` installs; without them it says so and, in CI, fails.
  - **Metadata:** the save gets `title`, `license: 'U'`, and both `defaultLanguage` and `language` set to the chosen
    language. Without them Lumi writes `language: 'en'`, and V-LANG treats a Nynorsk activity as English.
  - **Sub-content:** every node has `metadata: { title, license: 'U' }` (otherwise the editor writes "Untitled …");
    every list item is written out (the defaults never lengthen a list); BranchingScenario question nodes leave out
    `nextContentId` (its editor removes it) and end screens use `contentId: -1`.
  - **Language:** many `nn` and `nb` library defaults are English (MultiChoice, QuestionSet, InteractiveBook,
    BranchingScenario buttons and messages). A pattern sets these fields from its own `nn`, `nb` and `en` texts.
    Sub-content titles that learners see (InteractiveBook chapters and their table of contents) are pattern texts
    or guidance markers too.
  - **Escaping:** a token value is plain text, HTML-escaped on insertion; `⟦` and `⟧` stay raw characters. Lumi
    clips a text to its field's `maxLength` after escaping (`&` counts as five characters) and refuses a title over
    255 characters, so `content:check` checks every resolved value, escaped, in all three languages, against its
    field's limit. Guidance inside a Blanks blank or a DragText draggable may not contain `:` or `/`, which those
    types read as a tip or an alternative.
  - **Defaults:** `semanticDefaults.ts` also gives `isSubContent` groups (H5P.Summary statements) a
    `subContentId`, as the editor does, and the creation step passes a copy of the parameters, because the save
    changes them in place.
- **Amendment (2026-10-29, S5 W2b):** `content:check` also refuses a skeleton key that the library's semantics do not define, so a misspelt behaviour switch cannot silently leave a `PROD-009` setting at its default. A sub-content node may hold only `library`, `params`, `metadata` and `subContentId`; a key a library's own editor writes beside its semantics (BranchingScenario's `contentId` on each content item) is accepted, so a skeleton made from an exported `.h5p` passes as exported. A test runs the check on every real seed package.
- **Amendment (2026-10-29, S5 review): typo tolerance in fill-in tasks.** H5P.Blanks' «Godta mindre skrivefeil»
  (`acceptSpellingErrors`) counts an answer as correct when it is one edit away from a solution longer than three
  characters (two edits beyond nine), and numbers get no exception: «125» and «1,25» both pass for «12,5». Spec 04 §4
  asks for typo tolerance only in `ea-terms`, whose answers are terms; the real-pattern tests had widened it to every
  Blanks task without a record. Now:
  - `ea-terms`' Blanks accepts small typos (spec 04 §4).
  - `uv-column`, whose example is a dosage calculation, matches exactly (`acceptSpellingErrors: false`), so a number
    with one wrong or swapped digit is never marked correct. Its guidance tells the author to give each accepted
    form of a number as an alternative (`12,5/12.5`) and to switch typo tolerance on only when every answer is a
    word.
  - The other patterns' Blanks keep typo tolerance as ALU's draft choice; the tests no longer require it, so ALU
    can make a pattern strict with no code change (`PED-011`). Every Blanks task stays case-insensitive.
  - `apps/server/test/learningDesign/patterns/realPatternSkeletons.test.ts` pins the setting of `ea-terms` and
    `uv-column`; `content/laeringsdesign/README.md` («What catches mistakes in a pattern») and the ALU packet §6.2
    say so.

### D-085 · Creating an activity from a pattern is one server request
- **Context:** `PROD-001` opens the editor "pre-filled with a pedagogically sound skeleton". The editor client could
  prefill, but then the metadata and the skeleton would travel through the browser, and no test could create every
  pattern without one. Two patterns have a choice: `ea-terms` has two content types and `ea-diagnose` two phases.
- **Decision:** `POST /api/patterns/:patternId/activities` with `{ language, phase?, courseCode?, contentType? }`:
  - **who:** a signed-in portal author (Feide), with the CSRF token;
  - **what:** the server builds the skeleton (D-084) and saves it through `HvlH5PEditor`'s save path, so the
    whitelist, the sub-content policy and the installed-library check run as for any save. In the same request it
    writes the learning-design metadata (the phase, the `patternId`, the course code and the pattern's suggested
    student minutes) and answers `{ contentId }`. If writing the metadata fails, the new activity is deleted;
  - **language:** the activity's language is the one chosen (`nn`, `nb` or `en`), defaulting to the page's language;
  - **choices:** a pattern with two types needs `contentType`, and one with two phases takes `phase` from its own
    list; anything else is a 400;
  - **unavailable patterns:** a pattern whose library is not installed is shown as unavailable, and creating from it
    answers 409 `hvl:pattern-unavailable`.

  The web app then opens `/aktivitet/:id` on the **Rediger** tab. A blank activity stays available from
  `/aktivitet/ny` and from the catalogue.
- **Consequences:** The created activity is a private draft like any other. The Canvas side of "new from a pattern"
  waits for S6 (D-098).
- **Amendment (2026-10-28, S5 probe P1):** "unavailable" covers every library the completed skeleton names, not
  only the main one: the defaults add libraries (InteractiveVideo's summary brings H5P.Summary), and some are
  installed only as dependencies. Without that check Lumi's own error would answer 500 instead of 409
  `hvl:pattern-unavailable`.
- **Amendment (2026-10-29, S5 review):** an installed library whose skeleton cannot be built for another reason (a
  `semantics.json` that does not parse, which Lumi's package validator lets through, or a damaged library folder)
  makes only the patterns that use it unavailable in the overview and the pattern pages, as a missing library does;
  before, one such pattern made `GET /api/studio` answer 500, and with it the guide, the planner and `/mappe`. The
  failure is logged once per pattern and content type (a warning with the pattern ID, the content type and the
  error's name) until a build succeeds again. Creating from such a pattern still fails (500): the overview has already called it unavailable.

### D-086 · Guidance placeholders are marked `⟦…⟧`, and V-PLACEHOLDER is an error that can be acknowledged
- **Context:** `PROD-001` allows a created activity to fail validation only on "placeholders that are deliberately
  flagged as needing input". Guidance text published to students by mistake is a real defect. D-074 lets an author
  publish past an error by acknowledging it with a reason.
- **Decision:** Skeleton guidance is wrapped in `⟦` and `⟧` (U+27E6, U+27E7), which do not occur in ordinary text and
  are visible to the author. A new validator rule, **V-PLACEHOLDER**, has severity *error*. It reports every marked
  text in the parameters and in the metadata title, after decoding entities and removing tags, with the field's path
  for «Gå til feltet». It can be acknowledged with a reason as D-074 sets out; D-074 is unchanged. Probe P6 shows that
  the marker survives CKEditor and Lumi's sanitiser.
- **Consequences:** The integration test that creates every pattern expects V-PLACEHOLDER errors and no others
  (`PED-010`, `PROD-001`). The rule's messages exist in `nn`, `nb` and `en`.
- **Amendment (2026-10-28, S5 probes P1 and P6):**
  - **Where V-PLACEHOLDER looks:** every string of the parameters, including the `UI`, `l10n`, `texts`, `a11y`,
    `confirmCheck` and `confirmRetry` groups the shared walker skips, plus the activity's and every sub-content's
    `metadata.title` (InteractiveBook shows chapter titles as headings). It skips `extraTitle`, which the editor
    copies from the title, so a marker is reported once.
  - **How it reads them:** through `parseRichText` (validation/richText.ts), which removes tags and then decodes
    every character reference exactly once, zero-padded and semicolon-less ones included. Decoding twice would turn
    the literal text `&#10214;` into a marker. A lone `⟦` or `⟧` counts, because authors' partial edits leave them.
    The editor sends plain-text fields back as loaded and only the save makes them raw, and package imports store
    references as they are, so the rule never assumes raw text.
  - **Missing media:** the rule also reports a required media slot that is empty: an InteractiveVideo without a
    video source and an ImageHotspots without a background image. Learners would see only an English error
    message instead of the activity, and nothing else flags it. The finding can be acknowledged like the others.

### D-087 · Learning-design metadata: learner purpose, pattern, course code and access
- **Context:** `PED-030` lists the metadata fields. `PED-032` shows students a one-line "why this matters" that the
  model lacks. The planner and the portfolio need a course code that matches across activities, and outcomes that can
  be recognised again.
- **Decision:**
  - **New fields:** `learnerPurpose` (plain text, at most 200 characters, shown to learners in the activity's
    language) and `patternId` (the pattern the activity came from).
  - **Course code:** normalised (Unicode NFC, trimmed, upper case, inner spaces removed) and checked against
    `^[A-ZÆØÅ0-9][A-ZÆØÅ0-9-]{1,19}$`. The field suggests the course labels of the author's own Canvas placements,
    stored from the launch's `context.label` in the new `LtiPlacement.contextLabel` (a course label, not personal
    data).
  - **Outcomes:** two outcomes are the same when their category matches and their text matches after normalising
    (NFC, trimmed, inner whitespace collapsed, case ignored). The form offers the outcomes the author already uses
    for the same course code as checkboxes.
  - **API:** `GET` and `PUT /api/content/:id/learning-design`. `PUT` replaces everything and must send the `updatedAt`
    it read (409 `hvl:learning-design-conflict` when stale). Only people who may Edit the activity read or write it.
  - **Limits:** at most 20 outcomes of 1–300 characters, a rationale of at most 1 000 characters and 1–600 student
    minutes.
  - **What learners get:** the minutes and the purpose only, and only after the View check: in `/app/play` through
    the `x-hvli-launch` header, and in the portal's **Spel** tab through the activity summary. They never get the
    rationale.
  - **Publishing:** the publish dialog shows a prompt to fill in the metadata that never blocks publishing.
- **Consequences:** Migration `s5_learning_design` and new rows in the data inventory.
- **Amendment (2026-10-28, S5 contracts):**
  - **Course labels and privacy:** Canvas sandbox courses often carry a teacher's name in their label. The server
    therefore stores `LtiPlacement.contextLabel` only when the label, after D-087's normalisation, is a course code
    that contains at least one digit (HVL course codes do; names rarely do), and stores null otherwise. It strips
    control characters and cuts the label to 255 characters by code point. Each launch overwrites the value.
  - **Whose labels:** "the author's own placements" means placements of activities the author owns or co-authors;
    a placement has no user.
  - **The pattern:** a full replace keeps the stored `patternId`; only creation and duplication write it.
- **Amendment (2026-10-29, S5 W3):**
  - **The purpose:** besides a line break, any control character (a pasted tab) is refused (400). The web app's strict
    `x-hvli-launch` parser refuses the whole header on one, so a single stored tab would have shown «no launch» to
    every learner of the activity in Canvas. The server also leaves out such a stored purpose, and a language tag
    longer than the parser's 35 characters, rather than send them.
  - **The stored label:** `LtiPlacement.contextLabel` holds the cleaned label (control characters removed, at most
    255 code points), not the normalised code; suggestions normalise it when read. Residual risk, accepted: a
    sandbox label that normalises to a code with a digit, such as «Kari 2025», is stored as if it were a course code.
    It is never shown to anyone but the authors of activities placed in that course.
  - **The prompt:** the metadata prompt shows in the first-publish dialog only, not when an already published
    activity is published again with new reasons.

- **Amendment (2026-11-25, D-142):** the purpose, the outcomes and the rationale are held to the contract's rule
  for typed text (`packages/api-contract/src/textRules.ts`): besides control characters, U+2028, U+2029 and the
  bidirectional controls are refused (400). The web form takes them out of pasted text before it checks and sends
  it (`apps/web/src/config/typedText.ts`), as it already turned a pasted tab in the purpose into a space.

### D-088 · The alignment planner: one course, outcomes × phases, two gap rules
- **Context:** `PED-031` asks for a grid of learning outcomes × phases for one course, with gaps highlighted and
  *Create from pattern* in empty cells, as an accessible table.
- **Decision:**
  - **Scope:** one course code at a time, chosen from the author's own. The grid holds the author's own and
    co-authored activities with that code; drafts are included and marked as drafts.
  - **Rows and columns:** rows are the distinct outcomes (D-087), ordered by category (kunnskap, ferdigheiter,
    generell kompetanse) and then by text; columns are the three phases in content order.
  - **Untagged activities:** activities with the course code but no outcomes or no phase are listed below the table,
    not hidden.
  - **Gaps:** an outcome with no *Etterarbeid* activity, and a phase with no activity at all. Each gap is shown with
    an icon and a text, never by colour alone.
  - **Empty cells:** a link «Lag frå mønster» whose accessible name names the phase and the outcome. It opens the
    catalogue filtered by that phase, carrying the course code, which creation then pre-fills.
  - **Markup:** a `<table>` with a `<caption>`, `th scope="col"` for the phases and `th scope="row"` for the
    outcomes, inside a focusable, labelled region that scrolls sideways on narrow screens.
- **Amendment (2026-10-29, S5 W3):** the course chooser lists the codes the author's own and co-authored activities
  use; Canvas labels are only suggestions in the Læringsdesign tab. The outcomes of an activity that has the course
  code but no phase still become rows (with empty cells and the no-Etterarbeid gap), and the activity is also listed
  as untagged, so an outcome is never hidden. The empty-phase gap counts only activities that have a phase.

### D-089 · Studio access, routes and tabs
- **Context:** Spec 04 §2 says the guide is "public within HVL". The owner decided on 2026-10-28 that the guide and
  the catalogue are public: they hold research summaries and patterns, nothing about people.
- **Decision:**
  - **Public (no sign-in):** `/laeringsdesign` (guide, phase matrix and the catalogue, with its filters in the URL)
    and `/laeringsdesign/monster/[patternId]`. «Lag frå dette mønsteret» asks a signed-out visitor to sign in.
  - **Authors only:** `/laeringsdesign/planlegg`, `/laeringsdesign/innhaldsbank` (the content bank, D-091) and
    `/mappe`, with the same sign-in redirect and refusal pages as the other portal pages.
  - **New tabs on `/aktivitet/[id]`:** **Læringsdesign** (people who may Edit) and **Deling** (visibility, which
    until now had only an API, plus co-authors, the bank listing and «Lag ein kopi»).
  - **Navigation:** the header has the studio links in the same place on every portal page.
  - **Code location:** the pages are `apps/web/src/app/(portal)/laeringsdesign/…` and
    `apps/web/src/app/(portal)/mappe/`.
- **Consequences:** Spec 04 §2 and its code location are amended. `ActivityView` is split into a tab registry so that
  no file passes 200 lines.

### D-090 · Finding co-authors: HVL staff only, rate-limited, audited
- **Context:** `PROD-007` finds co-authors "by name or Feide ID" among HVL staff. Staff names come from Feide at login
  and are stored only for staff (D-021, DATA-001). Student authors may not share beyond their own work (D-059).
- **Decision:**
  - **Who can be found:** a person can be found only while `User.coAuthorSearchableAt` is set and less than 13
    months old. It is set at each Feide login of an HVL member with an `employee`, `faculty` or `staff` affiliation,
    and cleared at a Feide login without one. Student authors, LTI accounts and learners are never listed.
  - **Search:** `GET /api/people?q=` by name needs at least 3 characters and returns at most 10 matches as
    `{ userId, displayName }`, with no e-mail and no Feide ID. A query in the form of a Feide ID is an exact lookup
    through the identity's login hash. Searches are limited per user in Redis (429 when exceeded), and the query is
    never logged.
  - **Co-authors:** the owner adds and removes them; a co-author may remove themselves; an activity has at most 20.
    Only a person who can be found may be added, so student authors are refused (`hvl:coauthor-not-eligible`).
  - **Audit:** every change is audited with user IDs only.
- **Consequences:** `/personvern` says that colleagues can see staff names through co-author search and bank
  attribution.
- **Amendment (2026-10-28, S5 contracts):**
  - **Who can be found:** someone eligible for the co-author directory is an HVL member with the author role who is
    not a student author (`hvlMember`, `author`, not `studentAuthor` in the Feide login's roles), not anyone of
    kind `staff`: student authors and admin-only members are kind `staff` too. Only the Feide login path writes
    `coAuthorSearchableAt`, never an LTI launch.
  - **One predicate:** the name search, the exact Feide-ID lookup and the check when a co-author is added all use
    the same rule: eligible, and `coAuthorSearchableAt` less than 13 months old.
  - **Search:** LIKE wildcards in the query are escaped; the query is never logged or echoed in an error; a 429
    carries `Retry-After`.
  - **Portal only:** every studio route except the public guide and catalogue starts with
    `requirePortalAuthor` (learningDesign/http/studioPrincipal.ts), which refuses an LTI ltik (401) and a portal
    learner (403), so a Canvas launch can never search HVL staff names.
- **Amendment (2026-10-29, S5 W4):**
  - **Who may search and add:** only an HVL staff author (the same rule): a student author is refused with 403
    `hvl:sharing-not-allowed` (D-059: they share nothing beyond their own work), an admin-only member with 403
    `error.forbidden`. A student-author owner therefore adds no co-authors either; removing is always allowed.
  - **The limit:** 30 searches per person in a fixed 60-second window in Redis (`hvli:people-search:<userId>`, a
    count only); every valid search counts; the 429's `Retry-After` is the rest of the window, at least 1 second.
  - **The routes:** listing the authors needs Edit; adding and removing answer the list as it is afterwards; adding
    an existing co-author and removing someone who is not one change nothing and write no audit event. Adding locks
    the activity's row, so two concurrent adds never pass 20. The permission facts are read on every request, so a
    removed co-author loses Edit at the next one.
  - **The predicate:** `learningDesign/collaboration/staffEligibility.ts`; the Feide login writes
    `coAuthorSearchableAt` through `AccountResolver`, which ignores the field for an LTI launch.
- **Amendment (2026-10-29, S5 review): staff e-mail is no longer stored.** `SPEC-DEVIATION` AUTH-004 ("store a display
  name and e-mail only for authors and admins"). AUTH-004 kept the e-mail for co-author search and attribution, but
  search matches the display name or the Feide-ID hash and answers `{ userId, displayName }`, the bank and a copy
  show the name only, and nothing in the code base reads `User.email`. Keeping it had no purpose (GDPR Art. 5(1)(b)
  and (c)), and `/personvern` and the data inventory named a use that does not exist. The Feide login therefore keeps
  only the display name (`authorProfile`), and `AccountResolver` writes `email: null` at each staff login, so an
  address stored before is cleared at the next one; there is no migration, as nothing is deployed yet. The column
  stays until a schema change drops it. `FEIDE_SCOPE` keeps `email` (AUTH-001 fixes the scope string): the claim is
  only in the encrypted ID token kept for Feide logout, as `/personvern` already says.

### D-091 · The content bank: opt-in, published, shared with HVL, for HVL authors
- **Context:** `PROD-007` lets authors "publish an activity to the HVL content bank so that colleagues can duplicate
  and adapt it".
- **Decision:**
  - **Listing:** the owner lists an activity in the bank (`H5PContent.bankListedAt`). Listing needs a published
    activity whose visibility is HVL (`organisation`) or wider, and an owner who is not a student author.
  - **Unlisting:** making the activity private, or unpublishing it, removes the listing in the same transaction.
  - **Who sees it:** the bank page lists the activities for HVL authors only, with title, type, phase, purpose,
    minutes, outcomes and the owner's name.
  - **Consent text:** listing shows a consent text: colleagues see the activity, your name and its learning-design
    information and can make their own copies, and withdrawing the listing leaves existing copies with their authors.
    The text is a draft for ALU's and HVL's legal review.
  - **Audit:** listing and unlisting are audited.
- **Amendment (2026-10-28, S5 contracts):** the bank is for HVL staff authors, the same people D-090 lets be found:
  student authors neither see the bank nor list in it, because it shows colleagues' names, and `/personvern` says
  colleagues see them. The header link shows to every author, since the web app knows only roles; the bank page
  shows the server's refusal to a student author. Unpublishing an activity or making it private clears
  `bankListedAt` in the same transaction (ContentPublisher and the sharing routes).
- **Amendment (2026-10-29, S5 W4):**
  - **Who sees and changes the listing:** people who may edit the activity read its listing (`{ listedAt, eligible }`),
    so a co-author sees it on the **Deling** tab; only the owner lists and unlists. A student author's `GET /api/bank`
    and listing are 403 `hvl:sharing-not-allowed`, which the bank page explains.
  - **"Eligible":** published, `organisation` or `feide`, and an owner who is HVL staff: the owner's own login facts
    when the owner asks, else the owner's `coAuthorSearchableAt` (an owner who has not signed in as staff for 13
    months is not eligible).
  - **Not a change of the activity:** listing and unlisting do not move `H5PContent.updatedAt`, so the publish flow's
    precondition and the "newest change first" lists stay as they were. Listing is one conditional update, so an
    activity unpublished or made private meanwhile is never listed. Each real change is audited
    (`content.bank.list` with `{ consentVersion }`, `content.bank.unlist` with `{ cause: owner | unpublish | private }`).
  - **The bank list:** the 200 newest listings the reader may view, each passing the same View rule as opening it.
- **Amendment (2026-10-29, S5 integration of stage 4):** the bank shows a listing only while its owner is findable staff
  (D-090: an eligible Feide login in the last 13 months), checked each time the bank is read. The name of someone who
  has left HVL, or who now signs in as a student author, then stops showing to colleagues without anyone unlisting,
  and the listing returns at the owner's next eligible login. The bank shows the 200 newest listings, without paging,
  until use shows a need.

### D-092 · Duplicating an activity
- **Context:** `PROD-007`: a duplicate keeps a link to its source and the original author's attribution, and never
  copies learner data. Lumi copies a duplicate's files only when their paths are rewritten to the paste-source form
  `../<sourceId>/<file>`, and it checks View on the source.
- **Decision:**
  - **Permission:** a pure rule table (`duplicateRules`): a person may duplicate an activity they may Edit, or a
    published, bank-listed activity they may View.
  - **Copied:** the parameters, the H5P metadata and the files, through the paste-source rewrite. Of the
    learning-design data, the phase, `patternId`, outcomes, minutes and purpose are copied. A copy made through the
    bank leaves out the rationale and the course code, which belong to the source's author.
  - **Never copied:** learner state, statements, insight snapshots, placements, acknowledgements, co-authors, the
    bank listing and the published status.
  - **The copy:** a private draft owned by the person who copied it, with `sourceContentId` and the new
    `sourceAuthorUserId`. The source author's name is read when the copy is shown, so a later change of name shows.
  - **API:** `POST /api/content/:id/duplicate` answers `{ contentId }`; it is audited. The copy is saved through
    `HvlH5PEditor`'s save path.
- **Amendment (2026-10-28, S5 probe P2):** Lumi does **not** refuse a paste source the saver may not View: it
  saves the copy with every such file path emptied, and stores no file. Therefore:
  - **Our check first:** `ContentDuplicator` decides `duplicateRules` before it calls the editor and refuses with
    our own error.
  - **What is rewritten:** only references to files the source stores, to `../<sourceId>/<file>`. URLs and names
    the source does not store stay as they are. A `#tmp` reference is kept, because «Lagre som ny versjon» (D-093)
    saves new uploads with the copy.
  - **Unsafe names:** a stored name outside Lumi's pattern (`^[\w\-./_]+$`; spaces or æøå from an imported
    package) is copied by the duplicator itself, through the content storage under a safe name, and its path fixed.
  - **Checked afterwards:** a saved copy with an emptied path or a `../` path left is deleted and the duplicate
    fails, so nothing half-done remains. Lumi gives copied files new names (cut at the first hyphen or with stacked
    suffixes), so nothing may rely on the source's file names.
  - **Speed:** Lumi streams every file through the server; a large video makes a duplicate slow, so the route's time
    limit allows for it.
  - **Editor saves:** the editor's own save routes accept `../<id>/<file>` paths too (H5P's copy and paste).
    `HvlH5PEditor` now allows such a path only from an activity `duplicateRules` allows, and refuses a path the
    storage would refuse (`..`, a leading `/`, a backslash, control characters) before Lumi writes anything;
    before, Lumi wrote the activity and then failed with a 400, leaving a half-saved draft.
- **Amendment (2026-10-28, S5 contracts):**
  - **The rule, exactly:** `decideDuplicate` answers unavailable (404, D-066) for an unknown activity or one the
    person may not View, and refused (403) unless the person may create activities (an author or an admin in the
    account view). Then Edit allows it, and otherwise a published, bank-listed activity allows it for a person the
    bank is for (D-091 as amended: not a student author).
  - **Errors:** a refusal the editor raises before any row exists (the sub-content policy, the paste guard, Lumi's
    metadata schema) reaches the author unchanged as a 4xx; any failure after a row exists removes the copy and
    answers 500 `hvl:duplicate-failed`, logged with its cause by the route. The audit details are
    `{ sourceContentId, via, kind }`; the source author is on the copy's `sourceAuthorUserId`.
  - **Who sees the source:** the copy's detail shows its source's title and author only to people who may Edit the
    copy; learners and other viewers get none of it.
  - **Editor saves:** `PasteSourceGuard` checks every `../<id>/<file>` path on every editor save against the same
    rule, and every `#tmp` and paste path against the storage's safe-name rule, before Lumi writes anything; a web
    address whose scheme has capitals (`Https://`) passes, as H5P plays it. An existing activity that still holds
    a path the guard refuses must have that element removed before it can be saved.
- **Amendment (2026-10-29, S5 W4):**
  - **The bank branch in the actor:** `HvlH5pActor` carries the login's `studentAuthor`, so `duplicateRules`
    allows a bank copy only to an author signed in with Feide who is an HVL member and not a student author
    (`isBankReaderActor`); the editor's paste guard decides with the same rule. A Canvas launch never copies through
    the bank (D-098).
  - **The route:** `POST /api/content/:contentId/duplicate` (portal authors, CSRF) answers 201 `{ contentId }` and
    lets its socket stay idle for up to 15 minutes while Lumi streams a large video's files; a proxy in front must
    allow as long.
  - **Who sees the source:** the copy's detail names its source (ID and title) only while the person may View the
    source, and its author by the account's current display name; an unknown part is left out, and the page says so
    in words.
- **Amendment (2026-10-29, S5 integration of stage 4):** known limit, accepted: both links of a copy are `SetNull`, so
  a copy whose source and source author are both deleted (or whose source is deleted and whose author has no name)
  shows no «Kopi av …» sign and looks like an original. Telling it apart would need a column that survives the
  deletion; that waits until someone needs it. On the Deling tab a student-author owner still sees people search (the
  web app knows roles, not the student-author fact) and gets the server's explanation (`hvl:sharing-not-allowed`) when
  searching.
- **Amendment (2026-10-29, S5 review): a bank copy needs the listing to be in the bank now.** The bank shows a listing
  only while its owner is findable staff (D-091 amendment, S5 integration of stage 4), but the bank branch of
  `duplicateRules` checked only `bankListedAt`, so a colleague who knew the ID could still copy a hidden listing (by
  the duplicate route, «Lagre som ny versjon» or an editor paste), and the copy named the departed owner. The facts'
  `bankListed` (`ContentAccessRepository.factsFor`) now means "listed, and its owner is findable staff"
  (`isFindableStaff`, the in-memory form of the bank list's `findableStaffWhere`), so the duplicator, the copy route
  and the editor's paste guard refuse such a source with 403 `hvl:duplicate-not-allowed` until the owner's next
  eligible login. Copying through Edit is unchanged.
- **Amendment (2026-10-29, S5 review): copies are limited per person.** A duplicate and «Lagre som ny versjon» each
  stream every file of the source through the server, and nothing bounded how many one person could start. Both now
  count against one per-person fixed window in Redis, the people search's pattern (D-090): at most 20 copies in 10
  minutes (`hvli:copies:<userId>`, a count only), counted once the duplicate rule has allowed the copy, so an
  unknown or refused source answers as before. Past the limit the answer is 429 `hvl:rate-limited`, and
  `POST /api/content/:contentId/duplicate` sends `Retry-After` with the rest of the window (at least 1 second). The
  limiter is built with the H5P runtime and reaches the duplicator through the editor it saves with
  (`HvlH5PEditor.copyLimit`), because the studio services take only the editor from the runtime. Not covered: the
  bytes of one copy (a source that repeats one stored file many times) and the editor's own saves of pasted paths;
  both stay open for a per-save copy budget.
- **Amendment (2026-10-29, S5 review): the source's title carries its language.** The «Kopi av …» sign put the
  source's title in the page's language, so an English source on a Nynorsk page was read with a Norwegian voice
  (UD-010, WCAG 3.1.2). The attribution now also has `sourceLanguage`, the source's own language tag
  (`activityLanguage` of its metadata), given only together with `sourceTitle` and under the same View check; the
  sign marks the title with `lang` when it differs from the page's language.
- **Amendment (2026-10-29, S5 review leftovers): both copy routes send `Retry-After`.** «Lagre som ny versjon»
  (`POST /h5p/content/:contentId/copy`) answered the copy limit's 429 `hvl:rate-limited` without `Retry-After`, so
  only the duplicate route told the person when to try again. Now both send it, with the same seconds, and the
  `/api` contract documents the 429 of `duplicateContent` as it does people search's.

### D-093 · Safe editing: a structure signature, a confirmation, and saving as a copy
- **Context:** `PROD-013`: editing an activity that has learner state warns that structural changes reset saved
  progress, offers *Save as new version*, and invalidates state only when the author confirms. Today every save deletes
  the state H5P marks as invalidated (D-038, `HvlH5PEditor.ts`), including after a typo fix and including the author's
  own preview state.
- **Decision:**
  - **Structure signature:** for each sub-content node, its library, `subContentId` and position, plus the answer
    shape of leaf questions (for example the number of options or blanks). Probe P3 on the ten types settles the
    details, erring on the strict side. Any difference counts as structural.
  - **Whose state counts:** other people's. The saver's own state never prompts.
  - **Non-structural save:** keeps all learner state. This amends D-038.
  - **Structural save, other people's state present:** answers 409 `hvl:learner-state-reset-needed` and saves
    nothing. The answer has no counts, so it reveals nothing about how many learners there are.
  - **Confirmed reset:** a retry with `confirmLearnerStateReset: true` saves, deletes the activity's learner state and
    raises `H5PContent.version`, so S6 insight can separate results by version.
  - **Save as a copy:** `POST /h5p/content/:id/copy` saves the edited parameters as a copy (D-092, owner's copy) and
    leaves the original and its learner state untouched. This is the owner's choice for «Lagre som ny versjon»
    (2026-10-28).
  - **The dialog:** a new boot script, `editorSaveChoice.js`, shows a native `<dialog>` in the editor page: focus
    starts on «Avbryt», and Esc cancels. In Canvas it offers only reset or cancel, with a pointer to the portal.
- **Amendment (2026-10-28, S5 probes P3 and P7):**
  - **The signature, in detail:** a pre-order walk of every object with `library` and `subContentId`, recording its
    JSON path, its library as `Name major.minor` and its `subContentId`, plus the main library. Containers add:
    every CoursePresentation slide element's position; BranchingScenario's node count and every `nextContentId`;
    QuestionSet's `poolSize`; InteractiveVideo's video paths and its interactions sorted by start time, with the
    end summary after them. Leaves add their answer shape: MultiChoice's option count, its single or multiple mode
    and its option texts; Blanks' list of blank solutions; DragText's drop-zone and distractor words; a branching
    question's alternatives. A leaf list is structural if its length changes or its texts move; a text changed in
    place is not. Appends count: an appended InteractiveBook chapter crashes the player for learners with state.
  - **Two kinds of leaf:** a library without `getCurrentState` (AdvancedText, Text, Image, Table and others) is
    stateless, so only its position counts and editing its text is never structural. A stateful leaf without a rule
    counts any change of its parameters as structural.
  - **Old pages:** a learner page opened before a structural save keeps sending old state every few seconds. The
    player therefore sends the content `version` with each state write, and a write for an older version is dropped.
  - **The saver's own state:** a structural save always deletes it, even with no prompt, because stale state can
    crash the author's own preview. "Own" means the saver's current learner key; their Canvas or last year's preview
    counts as someone else's, which errs on the safe side.
  - **Reset:** a confirmed reset deletes the rows, and learners start again. H5P's RESET marker is not used: its
    dialog title is hard-coded English and Lumi's Nynorsk strings are Bokmål.
  - **Order:** the check runs before Lumi saves and before dropped files are deleted, so a refused save changes
    neither the parameters nor the files.
  - **The dialog:** the editor is always in a frame (the portal's **Rediger** tab and Canvas), where a native modal
    dialog lets Tab leave the frame. `editorSaveChoice.js` therefore keeps Tab and Shift+Tab inside the dialog, and
    takes focus back only when the H5P editor's own frame takes it. After the dialog closes it re-enables «Lagre»,
    focuses it and only then announces the outcome. In the portal the editor page asks the activity page to make
    its own controls inert while the dialog is open; Canvas's page is out of our reach. The dialog's look comes
    from a stylesheet file under the page's policy, with the `:focus-visible` ring the rest of the service uses.
- **Amendment (2026-10-29, S5 server side):**
  - **The version:** only a structural save that goes through raises `H5PContent.version`, not every save as D-074's
    2026-10-23 amendment said: a text-only save keeps the learners' state, so the pages they have open must go on
    saving under the same version. This amends D-074 and the data inventory.
  - **What a reset deletes:** every structural save that goes through deletes all the activity's state rows and
    raises the version in one transaction, also when the check found only the saver's: a row written between the
    check and the write belongs to the old structure.
  - **The confirmation:** `confirmLearnerStateReset` (a boolean, else 400) in the body of `PUT /h5p/content/:id`
    reaches `HvlH5PEditor.saveOrUpdateContent` as an explicit last argument (`SaveChoice`), not through the
    request's async context: every save of an existing activity comes through that route, so a save without it can
    never reset by accident. `POST /h5p/content` creates an activity, which has no state.
  - **Old pages:** the player's state URL (the portal and `/lti/play`) carries `contentVersion=<version>`, read
    before Lumi renders. The state route makes such a write only while the activity has that version, checked in
    the write's own transaction under a `FOR SHARE` lock on the activity row, which the reset's version update waits
    for. A stale write is answered 200 `{ success: false, message: 'hvl:learner-state-stale' }`: h5p.js hands it to
    an error callback the players' autosave does not set, so nothing is retried or shown. A write without the
    parameter is not checked; a malformed one is 400.
  - **Save as a copy:** `POST /h5p/content/:id/copy` takes `{ params, metadata }` as the editor gives them, is for
    portal authors only (an ltik is 401 `hvl:unauthenticated`, a portal learner 403, the CSRF token as on every
    unsafe method), answers 201 `{ contentId }`, and passes the duplicator's errors on unchanged.
  - **Shuffling:** MultiChoice's `randomAnswers` and QuestionSet's `randomQuestions` are not structural (a resumed
    attempt keeps its saved order, questionset.js:391); `poolSize` is.
  - **The real editor's round trip:** an unchanged save through the editor page must stay text-only for every type
    (`editorRoundTrip.browser.int.test.ts`). H5P's editor drops a branching-question node's own `nextContentId: -1`,
    which the player reads as -1 when it is missing, so a missing one counts as -1. The editor also upgrades an
    activity to the newest installed minor version of its library when it saves it; as the signature compares
    `Name major.minor`, the first save after HVL installs a newer minor version is structural and asks, which errs
    on the strict side.
- **Amendment (2026-10-29, S5 W5b):**
  - **Canvas wording:** from Canvas, the 409 keeps its status and code but its message (`safeEditing.resetNeededCanvas`) does not offer a new version, which Canvas does not have (D-098).
  - **«Gå til feltet» on titles:** `metadata.title` and a sub-content's title reach the title field (Column, QuestionSet, InteractiveBook and InteractiveVideo interactions) or the metadata popup (AdvancedText, ImageHotspots content). BranchingScenario node titles and CoursePresentation element titles are not reached by those custom editors; the page says so («feltet kan ikkje opnast») rather than failing silently, as for their other fields.
  - **The activity page:** while the dialog is open, the portal's activity page and `/app/play` make their own controls inert; after «Lagre som ny versjon» the portal opens the copy's editor tab.
- **Amendment (2026-10-29, S5 W4):**
  - **The copy's library version:** H5P's editor upgrades an activity to the newest installed minor version of its
    library and shapes the parameters for it, so «Lagre som ny versjon» saving them under the source's older version
    stored parameters its semantics did not describe. The editor page now sends its `content.library` with the copy
    (`POST /h5p/content/:id/copy` takes `{ params, metadata, library? }`; a `library` that is not a string is 400),
    and the copy is saved with it when it has the source's machine name and major version and is installed
    (`learningDesign/collaboration/copyLibraryChoice.ts`); anything else keeps the source's version without an error.
    «Lag ein kopi» names no library and always keeps the source's version.
  - **Who sees where it came from:** the copy's page shows «Kopi av <tittel> av <namn>» to the people who may edit it
    (D-092), so the copy «Lagre som ny versjon» opened says lastingly what it is, also when the announcement before
    the navigation was cut off.
- **Amendment (2026-10-29, S5 integration of the accessibility suite):** besides making everything around the editor
  frame inert, the page takes the `tabindex` of the elements that hold the frame (the tab panel's `0`, `main`'s `-1`
  as the skip link's target) while the dialog is open and gives it back afterwards: a click beside the frame focused
  the tab panel and left the dialog. `a11y/axeSaveChoice.a11y.test.ts` checks that nothing outside the frame takes
  focus or is exposed in the accessibility tree while the dialog is open.
- **Amendment (2026-10-29, S5 integration):** while «Nullstill …» or «Lagre som ny versjon» runs, the editor page's
  status region says so («Nullstiller framgangen og lagrar endringa …», `safeEditing.busy.*`) before the result, so a
  screen-reader user knows the request has started. (The `tabindex` of the frame's holders while the dialog is open is
  recorded once, in the amendment above; S5 review, 2026-10-29.)
- **Amendment (2026-10-29, S5 review): the reset is part of the parameter write.** A structural save's reset (state
  rows deleted, version raised) used to be its own transaction after Lumi's save. Lumi's first parameter write commits
  before it copies files and writes a second time, so a failed reset, a failed file copy or a restart in between left
  the new structure with the old state and the old version, and the next save, comparing against the new structure,
  never reset it. Now the editor's learner-state step marks the save in its async context
  (`h5p/storage/learnerStateResetWrite.ts`), and `PrismaContentStorage`'s first update of that activity writes the
  parameters, raises the version (that update comes first, for the `FOR SHARE` order) and deletes every state row in
  one transaction. A save that fails before that write changes nothing; one that fails after it leaves the new
  structure with its reset. A storage without the hook (the unit tests' file storage) gets the separate reset after
  the write, as before.
- **Amendment (2026-10-29, S5 review): focus while a chosen request runs.** The dialog's close removed the focused
  choice while «Lagre» was still natively disabled, so focus fell to the page's `<body>` for the whole reset or copy
  (a copy may take minutes), and Tab went into H5P's form. Now, once the author has chosen «Nullstill …» or «Lagre
  som ny versjon», the editor page focuses «Lagre» before the busy text is announced, keeping it unavailable with
  `aria-disabled="true"` (a click is ignored) instead of `disabled`, which cannot hold focus. When the request ends,
  «Lagre» is available again and the outcome is announced, as before. The ordinary save keeps its native `disabled`.

### D-094 · Rendering the pedagogisk mappe
- **Context:** `MAPPE-002` takes headings from the template and criteria from the criteria files, keyed by criteria
  set; switching the set changes every criterion text and the reader's guide. The word count excludes the references
  and the reader's guide. Activity titles and texts come from authors and must not turn into Markdown structure.
- **Decision:**
  - **Template:** `content/mappe/template.{nn,nb,en}.md` uses Mustache 4.2.0. The loader removes comments and front
    matter and checks every tag against an allowlist of variables; triple braces and `{{& }}` are refused.
  - **Escaping:** Mustache's escape function is replaced by a Markdown escaper, so a title such as `# x` or
    `[a](b)` stays text.
  - **Reader's guide:** built from the criteria data (criterion → chapter and attachment), not written in the
    template.
  - **Limits:** `criteria.{nn,nb,en}.yaml` holds, per set, the criteria and the limits: Del 1 words (default 7 500)
    and attachments (default 11). Both are marked *(verify)*.
  - **Word count:** counts Del 1 only, between markers the loader requires, without the reader's guide and the
    references.
  - **Activities:** the author's own and co-authored activities, filtered by course, phase and date. Each gives its
    title, type, phase, course, outcomes, rationale, the validator's result with any acknowledgements and their
    reasons, a link, and the aggregates of D-095.
  - **API:** `POST /api/mappe/preview` answers the word count, which the page announces politely.
    `POST /api/mappe/export?format=md|pdf` answers the file, which is not stored.
  - **Opprykk:** the promotion mode waits for ALU.
- **Consequences:** Amends D-020: the reader's guide is generated, and the limits live per criteria set.
- **Amendment (2026-10-28, S5 probe P5):** how Mustache is used safely:
  - **Rendering:** `Mustache.render(template, view, undefined, { escape, tags: ['{{', '}}'] })`. Never assign
    `Mustache.escape` or `Mustache.tags`, which are global to the process, and never pass `{}` as partials.
  - **Loading:** the loader reads `Mustache.parse`'s tokens without changing them (they are cached and reused by
    `render`) and strips comments in the source text. It allows only `name`, `#`, `^` and `!` tags with allowlisted
    names, and refuses `&` (which also covers triple braces), `>`, `=`, images, a value inside backticks, a value
    straight after `](` or a backslash, and a value at the start of a line that follows a table header.
  - **The view:** every key is present on every list item (null when unknown), so a missing field never falls back
    to the parent's field of the same name. Dates and numbers are formatted as strings first.
  - **Empty values:** an optional value sits in a `{{#x}}` section or gets a localised placeholder, because an empty
    value can turn the template's own `**…**` into a rule, `## …` into an empty heading and `[…](…)` into an empty
    link.
  - **The escaper** (`mappe/markdownEscape.ts`) is safe in inline positions only: line starts, after a heading,
    list or quote marker, mid-line, table cells and link text.
- **Amendment (2026-10-29, S5 W6a):** how the template, the counts and the routes are built:
  - **No portfolio yet:** the six files (`template.{nn,nb,en}.md`, `criteria.{nn,nb,en}.yaml`) are optional until
    written, all six or none, as the guide is (D-083 amendment). Without them the mappe routes answer 409
    `hvl:mappe-not-ready` (new in the contract), which the page explains; the activity list still answers.
  - **Markers:** the reader's guide and the references are blocks the server builds, so they are placed by markers
    instead of `{{{…}}}`: a line that is only `{{lesarrettleiing}}` or `{{referansar}}`. Two pairs mark the counted
    parts: `{{del1_start}}` … `{{del1_slutt}}` (the word count) and `{{vedlegg_start}}` … `{{vedlegg_slutt}}` (the
    suggested attachments, counted as the outermost list items between them, which the preview's `attachments`
    reports against the set's limit). Each marker stands once, outside every section; the loader cuts the template at
    the marker lines and Mustache parses each part, so a section cannot span a marker.
  - **Names:** the allowlist is a tree of Nynorsk names (`apps/server/src/learningDesign/mappe/mappeVariables.ts`): top
    values, the lists `aktivitetar` (with `uu_merknader` inside) and `emneoversikt`; a list opens only where it is
    defined. Every value is text and never empty: the view gives a localised placeholder for anything unknown, so no
    `{{#x}}` guard is needed around a single value.
  - **Value places:** besides the probe's refusals, a value may not stand straight after `<` (a title such as
    `script>` would open raw HTML in a renderer with HTML on) or straight after `]` (a value starting with `(` would
    turn the brackets into a link to the value). So `{{lenke}}` is written as plain text; the PDF does not make it a
    link.
  - **Word count:** what markdown-it reads as text in Del 1, without the blocks; a word is a run between spaces that
    holds a letter or a digit, and a no-break space joins, so a grouped number (`7 500`) is one word. The template
    is rendered twice, the second time with the count; the count cannot change between them.
  - **References:** the full references the chosen activities' patterns cite, each once, sorted by text.
  - **Validator result:** the UD-021 findings of the stored activity (the findings route's validator and input),
    each error with the newest reason given for it at any age: the 14 days decide whether publishing asks again,
    not whether a reason was given. Who gave it is not read.
  - **Routes:** `GET /api/mappe/activities`, `GET /api/mappe/criteria-sets` (the sets with their limits and the
    default set; new schemas `MappeCriteriaSet` and `MappeCriteriaSetList`), `POST /api/mappe/preview` and
    `POST /api/mappe/export?format=md|pdf`, all `requirePortalAuthor`. More than 50 IDs is 400
    `hvl:mappe-too-many` before the body's schema; an ID that is not the author's own or co-authored is 404
    `hvl:activity-unavailable`, like an unknown one. The file name is ASCII, `pedagogisk-mappe-YYYY-MM-DD.md|pdf`.
  - **The page** filters the author's list in the browser (course, phase from `GET /api/studio`, change dates in
    Oslo time), and the portfolio's language is chosen apart from the page's.
- **Amendment (2026-10-29, S5 integration):** `SPEC-DEVIATION` UD-007: the /mappe download buttons name the file type
  but not its size, because the server makes the file only when asked and stores nothing (MAPPE-003); the size is
  unknown until then. The reference list of the export carries no language per reference yet, so an English
  reference in a Nynorsk PDF is not tagged with `/Lang` (a residual for the manual PAC check, D-096).
- **Amendment (2026-10-29, S5 review): link destinations over two lines, and activity IDs in either case.**
  - **Value places:** CommonMark lets a link destination start on the line after `](` or `]:`, so the loader looks
    for an open destination in the whole paragraph before the value, not only on its line. It refuses a value in a
    destination that starts on the next line (also when the template writes the start of the address), and any
    value in a paragraph that holds a link reference definition. A value after a closed link, or in link text over
    two lines, is allowed. The verification of the review added: a `](` stays open until the `)` that balances it
    (a destination may hold balanced parentheses or an escaped `\)`), and a reference definition counts also in a
    block quote or a list item (`> [a]:`, `- [a]:`, `1. [a]:`); all three passed the loader before. A second
    verification added two more that had passed: a definition whose label holds an escaped bracket (`[a\]b]:`),
    and one whose label runs over a line that holds only a no-break space, because only a line of spaces and tabs
    ends a paragraph in CommonMark, and the scan had taken any white space for a blank line.
  - **IDs:** the mappe routes match an activity ID without regard to case, as the other S5 lookups do: an upper-case
    ID finds the author's activity, and the same ID twice in two cases is 400 `error.badRequest` ("named twice").

### D-095 · Minimum group size in exports
- **Context:** `MAPPE-003` applies `INS-006`'s minimum group size (*k* = 5, configurable, at least 3, with
  complementary suppression) to the portfolio's aggregates. No results are stored before S6: `setFinished` is off and
  no xAPI is recorded.
- **Decision:** `privacy/minimumGroupSize.ts` reads *k* from `MIN_GROUP_SIZE` (an integer of at least 3, default 5).
  It suppresses a count below *k*, and suppresses the completion rate when either the completers or the
  non-completers number fewer than *k*, so a hidden value cannot be worked out from the other. In S5,
  `ActivityResultsSource` answers "no results yet", and the export says so. S6 adds the real source and the insight
  views on the same module.
- **Consequences:** The 4-learner test of `MAPPE-003` runs against a fixture source.
- **Amendment (2026-10-29, S5 W6a):** `ActivityResultsSource.learnerSummaries` hands over one summary per learner
  (attempts, completed, the first and last scaled score) and no identifier or answer text; only aggregates leave
  `activityResults.ts`. Below *k* learners nothing at all is shown, not even the count; the median attempts need *k*
  learners, and the change from the first to the last attempt (the mean, in percentage points) needs *k* learners
  with both scores. A rate of 0 % or 100 % is always hidden by the two-sided rule.
- **Amendment (2026-11-04, S6 step 4, `MAPPE-003`: the real results source):** `StoredActivityResults`
  (`learningDesign/mappe/storedActivityResults.ts`) replaces S5's "no results yet". It reads the stored
  `XapiStatement` rows of the export's activities (the author's own and co-authored ones only, D-066), with no period:
  every row until the yearly purge (D-107). A learner's figures mean what insight's do (D-115): started with any stored
  statement, completed with a stored root result, attempts are the stored root results, and the scores are those of
  root results with a maximum above 0. *Decided:* the mappe adds up what insight shows one group at a time (D-106), so
  an activity's learners are grouped by context (a Canvas course as `<platformId>:<contextId>`, D-103, or the
  portal), content version (`PROD-013`) and semester (from midnight Oslo time on 1 January or 1 August, as insight's
  `semester` period), and only groups of at least *k* distinct learners count; a learner in two groups gives one
  summary in each. Otherwise the mappe's totals less insight's views would give a group that insight hides (the "all
  contexts minus one" D-106 refused), or tell how many learners played in two groups. When a counted group's
  completers number 1 to *k* − 1 (insight hides them), the completion rate and the median attempts are shown only if
  those groups' completers and non-completers each number at least *k* together. First and last scores are given only
  to a learner with two or more scored results in the group, so a single attempt never shows as a change.
  *Consequences:* an activity played only in small groups shows no figures in the mappe, even when its learners
  together number *k* or more, so the mappe's participants can be fewer than all who played; the hand-worked figures
  are tested on stored rows (`storedActivityResults.int.test.ts`, `learnerSummaries.test.ts`).

### D-096 · The portfolio PDF is rendered by Chromium on the server
- **Context:** `MAPPE-004` asks for a tagged PDF with language, title, outline and real text from the same semantic
  HTML. The owner decided on 2026-10-28 that the server renders it with Chromium. `playwright-core` 1.56.1 is already
  pinned as a development dependency, and its `page.pdf` has `tagged` and `outline`.
- **Decision:**
  - **Dependency:** `playwright-core` 1.56.1 becomes a production dependency.
  - **Rendering:** Markdown → semantic HTML with `lang` and `<title>` (markdown-it, `html: false`) →
    `page.pdf({ tagged: true, outline: true })`.
  - **Isolation:** one shared browser per process, started lazily, and a fresh context per export with JavaScript
    off, offline, and every request aborted. The browser starts with a scrubbed environment (no secrets) and keeps
    Chromium's sandbox.
  - **Limits:** at most `PDF_MAX_CONCURRENCY` (default 2) exports per process and one per user, with a time limit.
  - **No browser:** answers 503 `hvl:pdf-unavailable`, and the page points to the Markdown export, which always works.
    `PDF_BROWSER_EXECUTABLE` names the browser.
- **Consequences:** S6's production image needs Chromium and fonts with æ, ø and å. Probe P4 checks the structure
  tree, outline, `/Lang` and title with `pdfjs-dist`. Anything Chromium cannot set, such as `DisplayDocTitle`, is
  recorded as a residual for the manual PAC check.
- **Amendment (2026-10-28, S5 probe P4):**
  - **Launch:** `chromium.launch({ chromiumSandbox: true, env: { PATH, HOME }, executablePath })`, all explicit:
    playwright-core's defaults pass the server's whole environment (secrets included) to Chromium and turn the
    sandbox off. Each export uses a fresh context with JavaScript off and `offline: true` (which blocks prefetches
    the route never sees), every request aborted, and the context closed afterwards. The mappe HTML holds no
    images; even an aborted image paints a placeholder.
  - **Root:** Chromium refuses its sandbox when the process runs as root, as everything does in the development
    container. A development-only `PDF_ALLOW_NO_SANDBOX=true` lets the PDF export work there; the production checks
    refuse it. Production runs the server as a non-root user whose runtime allows unprivileged user namespaces
    (S6). CI runs as a non-root user and lifts Ubuntu 24.04's AppArmor restriction on those namespaces first.
  - **Tables:** markdown-it writes no `scope`, so the mappe renderer gives header cells `scope="col"` and makes the
    first cell of each body row a row header with `scope="row"`.
  - **Residuals:** Chromium sets `DisplayDocTitle`, so that is not a residual. The manual PAC check records these
    instead: list numbers are untagged and lists carry no numbering attribute, caption and thead become
    `NonStruct`, there is no XMP metadata and so no PDF/UA identifier, links have no `/Contents`, and the header
    says PDF 1.4.
  - **Fonts:** Georgia, the body font token, is not installed here, so the PDF uses Liberation Serif. The S6 image
    installs `fonts-liberation`, or the fonts HVL licenses, so that æ, ø and å always embed.
- **Amendment (2026-10-28, S5 contracts):** `PDF_ALLOW_NO_SANDBOX` (default false) lets the root development
  container render PDFs; the production checks refuse it. Tests set it from whether they run as root, so the same
  test keeps the sandbox on the non-root CI runner. `PDF_BROWSER_EXECUTABLE` must be an absolute path; start-up does
  not require it to exist, since a missing browser only means 503 `hvl:pdf-unavailable`.
- **Amendment (2026-10-29, S5 W6a):** the limits in numbers: one export may take 30 seconds and a launch 20; past
  either, or when the browser will not start, the answer is 503 `hvl:pdf-unavailable`, and the next export tries
  again. A full process or a person's second export is 503 `hvl:pdf-busy` at once (no queue) with `Retry-After: 10`.
  Playwright's signal handlers are off, so only the server's shutdown closes the browser. A crashed browser is
  forgotten on `disconnected` and started again on the next export.
- **Amendment (2026-10-29, S5 stage 5):** Chromium's tagged-PDF outline drops the space where a heading wraps over two
  lines («emneom»), so a screen reader's bookmark list ran words together for long activity titles. The PDF's
  headings now have `white-space: pre-wrap`, which keeps the space and renders a one-line Markdown heading the same;
  the PDF browser test has a title that wraps, and its outline must equal the Markdown headings.
- **Amendment (2026-10-29, S5 integration):** the full residual list for the manual PAC check, in one place: list
  items have no `Lbl`/`LBody` and lists no numbering attribute; captions, `thead` and `tbody` give no `Caption`,
  `THead` or `TBody` element (`NonStruct`); no XMP metadata, so no PDF/UA identifier; links have no `/Contents`;
  the header says PDF 1.4; activity titles have no language of their own; references have no language of their own
  (D-094 amendment); the activity address is plain text, not a link. `taggedPdf.browser.test.ts` pins the first two.
- **Amendment (2026-10-29, S5 review): the time limit covers opening the context, and a stalled browser is
  replaced.** In the review, a Chromium that was frozen (SIGSTOP) but still connected never answered `newContext`.
  That call ran before the 30-second limit started, so the export waited for good, and two such exports left every
  later one 503 `hvl:pdf-busy` until a restart.
  - **The limit** now starts before the context opens and covers opening, loading and printing. Past it the answer
    is 503 `hvl:pdf-unavailable`, and a context that opens late is closed at once. The launch keeps its own 20
    seconds.
  - **Discarding:** a browser that fails to open a context, or does not open one or finish closing one within the
    limit, is treated like a crashed one. It is forgotten and closed without waiting, and the next export starts a
    new one. An export that is only slow to print keeps the browser, so other exports running in it are not cut off.
    The context's close after an export still waits at most one more limit, so a browser that stalls during a
    print gets its answer after at most two limits (60 seconds), and its slots are free then.
  - **Tests:** `pdfRendererTimeLimit.test.ts` (a `newContext` that never answers, a late context, a hung close, a
    slow print). `pdfRenderer.test.ts` pins the request handler (abort, never continue), and
    `pdfRendererIsolation.browser.test.ts` shows with the real renderer and Chromium that no stylesheet, image or
    frame of the document reaches a local listener; `offline` alone does not stop a frame, so the abort is needed.

### D-097 · New dependencies in S5
- **Context:** CLAUDE.md pins every runtime dependency exactly, and D-029's checks allow only listed licences.
- **Decision:**
  - `markdown-it` 14.3.3 (MIT). 15.x would bring a dependency whose licence is not on the allowlist.
  - `mustache` 4.2.0 (MIT, no dependencies).
  - `@types/markdown-it` 14.2.0 and `@types/mustache` 4.2.6 (MIT, development).
  - `pdfjs-dist` 6.4.299 (Apache-2.0, development, for the PDF test).
  - `playwright-core` 1.56.1 (Apache-2.0) moves from development to production (D-096).

  All are pinned exactly and pass `check:pins`, `check:licences` and `check:audit`.

### D-098 · The Canvas side of the studio moves to S6
- **Context:** `LTI-005`'s picker includes the content bank and "new from a pattern" (D-061), and `LTI-007`'s
  duplicate was to come with `PROD-007` (D-062). LTI principals are not HVL members (`hvlMember` is false), Canvas and
  Feide accounts stay separate while `feideLinking` is off (D-063), and Canvas has no publish interface, so a draft
  from a pattern could not be placed.
- **Decision:** The owner decided on 2026-10-28 that the bank in the picker, "new from a pattern" in Canvas and the
  `LTI-007` duplicate in `/app/play` move to S6. In Canvas, S5's safe-editing dialog offers reset or cancel (D-093).
- **Consequences:** Amends D-061 and D-062. S6's checklist carries the three items.

### D-099 · The API contract gets binary responses and `DELETE`
- **Context:** D-077 describes every route as JSON in `packages/api-contract`. The portfolio returns Markdown and PDF
  files, and removing a co-author or a bank listing is a `DELETE`. `apiRoutes.ts` and `openApi` are close to 200
  lines.
- **Decision:** A route may declare `mediaType` for a binary or text answer, which the OpenAPI document shows with
  `Content-Disposition: attachment`. The web app's `apiRequest` gets `DELETE`. The route list and the OpenAPI builder
  are split by area.
- **Consequences:** Amends D-077. `docs:api` and the route test keep the document and the mounted routes in step
  (`DOC-012`).
- **Amendment (2026-10-28, S5 contracts):**
  - **Query parameters:** a route may declare `query`, documented as `in: query` parameters (people search, course
    code, export format).
  - **Leaf modules:** `content.ts` imports only the leaf modules `learnerInfo.ts` and `sourceAttribution.ts`, so the
    contract has no import cycle that would leave a schema undefined at load.
  - **Deliberate 5xx codes:** the studio's own 5xx answers (`hvl:duplicate-failed`, `hvl:pdf-*`) keep their code
    and translated message, like the authentication 503s.
  - **Areas:** each studio area registers routes only, under `/api`, in its own module; a path-less `router.use`
    would run for every later area and is refused by a test. Middleware sits on the route itself.
  - **The web app** imports only types from the contract, so zod stays out of the browser bundle.

### D-100 · The S5 gate, and the ALU and pilot review left open (Q17)
- **Context:** The studio's texts, patterns, references, mappe template and criteria, and the bank's consent text, are
  drafts until ALU confirms them. Teachers in the pilot have not tried the patterns. The owner decided on 2026-10-28
  that S5 may close with this review requested and open.
- **Decision:** The S5 gate is the S1–S4 gate plus:
  - `npm run content:check`;
  - `npx vitest run -t "PED-0"`, `-t "PROD-001|PROD-009"`, `-t "PROD-007|PROD-013"` and `-t "MAPPE-"`, and each S5 ID
    on its own;
  - `npm run spec:trace -- --check --done-through=S5`;
  - `WEB_APP=dev npm start` showing the studio pages and downloading both exports.

  The review is open question Q17, with a review packet in `docs/reference/alu-review-s5.md`.
- **Consequences:** Q17 must be answered before the pilot. The manual PDF check with PAC or NVDA is recorded in the
  accessibility results.

### D-101 · Session 6: order, specs to load, insight in tabs, and what passes to the bachelor students
- **Context:** S5 passed its gate on 2026-10-30 (`b8ab740`), and PR #8 merged it into `main` (`47e235e`), which also
  answers Q16: GitHub now runs CI. S6 is the last planned session: the xAPI → Canvas grade bridge, teacher insight
  with *k*-suppression, the privacy jobs, deployment and operations, and the carry-overs from S4 and S5 (PROGRESS,
  S6). It is too large for the days before 1 November 2026, when the project proposal for HVL's bachelor students in
  programming (spring 2027) goes to HVL; their project is to review this AI-written code with their own tools and to
  finish the Canvas integration against ALU's test instance. Mapping S6 (six agents, 2026-10-30) also found that
  PROGRESS's spec-load row for S6 ("02 §5–7; 05; 00 §6") is narrower than its checklist, while CLAUDE.md §4 says to
  read only the listed specs, and that several parts need HVL's own Canvas, Feide or servers, which this environment
  cannot reach.
- **Decision:** The owner decided on 2026-10-30:
  - **Order: learning data first.** (1) The grade bridge: `LTI-010`…`LTI-013`, `DATA-012`, `LTI-008` and the bridge
    part of `H5P-009`. (2) Insight: `INS-001`…`INS-010`, `PROD-010`, the **Innsikt** tab of `LTI-006`, results by
    version (`PROD-013`) and the mappe's real results source (`MAPPE-003`, D-095). (3) The privacy operations:
    `DATA-003`…`DATA-005`, `DATA-007`, `DATA-008`, `DATA-010` and `NFR-006`. Then deployment and operations
    (`NFR-001`, `NFR-002`, `NFR-007`, `SEC-004`, `SEC-006`, `UD-040`, Chromium in the image for `MAPPE-004`), then the
    carry-overs (the language overlay with `H5P-010`, problem reporting, upstream drafts). Before 1 November the
    realistic target is the start, the probes, the shared infrastructure, the grade bridge and insight, with parts of
    the privacy operations; the rest continues afterwards or passes to the students.
  - **Specs to load in S6:** 02 §4–§8; 05 (all); 00 §3 (journeys J1–J5) and §6; 01 `H5P-009`, `H5P-010`, `SEC-004`
    and `SEC-006`; 03 `UD-003` and §6 (`UD-040`); 04 `MAPPE-003` and `MAPPE-004`.
  - **Insight lives in tabs only:** an **Innsikt** tab on the activity page `/aktivitet/[id]` and in the Canvas view
    `/app/play`, one context at a time (D-106). There is no `/innsikt` page, so CLAUDE.md §2 (the `apps/web` routes),
    spec 05's code location (`apps/web/src/app/innsikt/`) and the Evaluator Guide §4.1 are amended.
  - **Running the session:** the hourly restart task stays on until S6's gate passes, and the gate keeps its full
    form, run in parts (D-113).
  - **What passes to the students** when S6 does not reach it, each with a design, a seam or a checklist:
    - the Canvas side of the studio that D-098 moved to S6: the content bank and "new from a pattern" in the Deep
      Linking picker, and the `LTI-007` duplicate in `/app/play`;
    - `LTI-009` Dynamic Registration (COULD), which needs a Canvas administrator to try and must not be undone by the
      start-up sync of `LTI_PLATFORMS` (D-051); S6 writes its design only;
    - confirming against the real services what S6 can only mock: HVL's Feide client (Q3); the developer key, the
      client and deployment IDs and `feide_login` (Q4); the AGS token audience, content type and error answers
      (D-104); how Canvas shows the line-item label (D-105, Q8); NRPS paging and role filter (`LTI-008`); a course
      copy keeping `custom.contentId` (`LTI-007`);
    - the Lumi path (D-112), including the `image-size` audit exceptions that expire on 2027-01-31 (D-030), early in
      the students' term, after which `check:audit` fails unless one of D-112's choices has been made;
    - whatever of the operations and carry-over steps is not reached.

    One index, `docs/handoff/README.md` (written in S6's step 7), says what is done, what needs HVL, where the
    live-contract seam is (`apps/server/live/`: an opt-in suite that runs the mock-platform tests against HVL's test
    Canvas and real Feide) and what the Canvas acceptance checklist holds. It links the runbook, the deployment
    checklist and the privacy documents instead of repeating them.
- **Alternatives considered:** (a) Operations first, so that a deployable image exists early: the owner chose
  learning data, which is the product's purpose (spec 05: insight for the next seminar) and the part nobody can
  build from the specs alone. (b) A separate `/innsikt` overview across activities and courses: spec 05 §1 defines the
  view as one activity in one context, and an overview across contexts invites the differencing D-106 guards
  against. (c) Reaching everything before 1 November by testing less: the owner kept the full gate (D-113).
- **Consequences:** PROGRESS's S6 row and checklist change in the same step. A part handed to the students is listed
  in the hand-off index, in PROGRESS's open items and in the Evaluator Guide's limitations, and its requirement is
  tested only for what S6 built. Where a MUST cannot pass without such a part (J1's Canvas half, "new from a pattern"
  in the picker, which `LTI-005`'s "E2e in J1" needs), the J1 test is split and the gap gets its own `SPEC-DEVIATION`
  amendment once it is certain, not before. What J5's end-to-end test covers (its staging-to-production promotion is
  an operations procedure, not a page) is decided at the integration step, also by amendment.
- **Amendment (2026-11-05, S6 step 7: problem reporting for the pilot):** the owner decided on 2026-10-24 that the
  pilot's testers report problems through GitHub issue forms, with a short tester guide in Nynorsk (PROGRESS, S4 and
  S6 step 7). This records how.
  - **Two forms and nothing else:** `.github/ISSUE_TEMPLATE/feil.yml` (a fault) and `uu-barriere.yml` (an
    accessibility barrier) ask for the steps, what was expected and what happened, the device, the browser, the
    assistive technology and the zoom, the page or tab and the activity type (the ten authorable types by the web
    app's Nynorsk names), a screenshot and the severity. The fault form also asks for the exact error text, the time
    and, for HVL IT, the server's log lines as a code block; the barrier form asks for the manual protocol's set-up
    and result file when the barrier was found in a protocol run. `config.yml` turns blank issues off, so no issue
    skips the forms, and links the guide (`docs/testing/rapportere-problem.md`) and the security policy.
  - **No personal data in an issue:** each form opens with the rule and requires a ticked confirmation: no names of
    students or colleagues, no e-mail addresses, Feide IDs, national identity or student numbers, no students'
    answers, and screenshots cropped or covered (Canvas shows the user's name and picture). The server's log lines
    may be pasted, because they hold no personal data by design (`DATA-009`); Canvas's and the browser's logs may
    not. A log line that does show personal data is itself a privacy fault and is reported privately. An issue is
    a path from the pilot to development, so this is `DATA-010`'s "production data is never copied to development"
    applied to issues; a fault is reproduced with synthetic test data only.
  - **Security goes privately:** `SECURITY.md` names HVL's contact (a placeholder the owner fills) and GitHub's
    private vulnerability reporting (which the owner turns on). A vulnerability, or a privacy fault that someone could
    misuse, never goes into an issue or a pull request.
  - **Severity and labels:** three levels, and the reporter picks the highest that fits: 1 *Kritisk* (someone cannot
    use it at all, or it concerns privacy or security), 2 *UU-barriere*, 3 *Kosmetisk*; a barrier that stops
    someone completely is level 1. The labels are listed in `.github/labels.yml`: two types, the three severities,
    four statuses and `H5P oppstraums`. A form adds its type label and `treng vurdering`; the person who triages sets
    the severity label that matches the reporter's choice, because a form cannot set a label from a choice. The
    owner creates the labels with `gh label create` (`docs/testing/labels-and-triage.md`); the agent creates nothing
    on GitHub.
  - **How a problem is fixed:** it is reproduced in the test set-up, a test that fails is written first, the cause is
    fixed, the area's tests and the gate pass, and the change goes on a branch with a pull request that HVL reviews
    and merges. A problem seen only in HVL's Canvas or Feide needs the error text and the server's log lines; one seen
    only on a device or with a screen reader needs a precise description and a re-test by HVL (`treng HVL-test`).
    H5P's own barriers are repaired at run time or registered (D-080) and reported upstream (D-112). Manual results
    stay dated in `docs/accessibility/results/` (D-079), linked from the issue and back.
  - **Language:** the guide and the forms are in Nynorsk only: GitHub's forms have no language switch, they are not
    product UI (the three locales of `DOC-009` cover the product), and the pilot's testers read Nynorsk. The
    maintainers' label and triage document is in English, as developer documents are.
  - **Alternatives considered:** (a) a feedback form in the product: it would store free text that can hold personal
    data, would need its own privacy review, and would come too late for the pilot; (b) e-mail to a shared inbox: no
    labels, no link from a problem to the test and the pull request that fix it, and nothing the bachelor students
    can pick up; (c) a GitHub Actions workflow that sets the severity label from the choice: it needs write access to
    issues and would run on text from anyone, for a step a person does in seconds.
  - **Consequences:** `tools/issue-forms/` checks the forms, the chooser and the label list on every test run. The
    hand-off index links the guide. Before the pilot the owner creates the labels, fills in HVL's security contact
    and turns on private vulnerability reporting. If the repository moves, the absolute links in the forms and in
    `config.yml` move with it.
- **Amendment (2026-11-05, S6 step 7: the students' hand-off index, the live-contract seam and the Canvas
  acceptance checklist):** decided before the documents and the seam were written.
  - **The index:** `docs/handoff/README.md` is in English, the language of the developer documents and of the
    students' project (`DOC-009`), with a short summary in Nynorsk at the top. Five parts: what is done, by session and
    requirement, with where to read it (the README module maps, this file, `docs/TRACEABILITY.md`, the spec site,
    PROGRESS's gate output); what needs HVL (the open questions, hosting, the DPO, the manual accessibility run, the
    200-learner load test, the restore drill and the owner's own tasks); what passes to the students; suggested review
    targets for their code-review project, the riskiest modules first, each with why; and how to set up (the
    Codespaces container, a local machine, CI). It links the runbook, the deployment checklist, the privacy documents
    and PROGRESS instead of repeating them, and names no person.
  - **One design note per item that passes on**, beside the index: `canvas-studio.md` (D-098's three items),
    `dynamic-registration.md` (`LTI-009`), `branching-paths.md` (`INS-004`, deferred by D-115),
    `insight-freshness.md` (Q24), `research-export.md` (the students' part of `docs/privacy/research-export.md`,
    Q25), `simplification-check.md` (plan step 10's check, for whatever S6 does not reach), `lumi-path.md`
    (D-112's three choices before 2027-01-31) and `live-contract-seam.md`. A note states what is known, the options
    and a recommended default, the tests it would need and what must be decided first. It decides nothing: each choice
    gets its own decision or amendment here before code (CLAUDE.md §1).
  - **The live-contract seam (`apps/server/live/`):** D-101 above describes it as running "the mock-platform tests
    against HVL's test Canvas". As written that cannot work: those tests drive the mock's own controls (fault
    injection, `setMembers`, `deleteLineItem`) and launch made-up users, which a real Canvas has no equivalent for.
    The seam instead states each fact the mocks assume as a check that can run against either platform: the
    client-credentials token (the assertion's audience, the token answer, a refused audience, a scope the developer
    key lacks); AGS (the line item a Deep Linking return created, with its label in the configured `AGS_LABEL_MODE`,
    a line item read, 404 for a missing line item, 401 without the `score` scope and with a bad token, the answer for
    a user outside the course and, only with a named test student, a score sent by our own `AgsScoreClient`); NRPS
    (the media type, the full role URI against the short name `Learner`, paging links, no names or e-mail addresses
    under `privacy_level` `anonymous`, 401 for a token without the NRPS scope); and Feide's discovery document and
    key set. The checks call the server's own modules where one exists (`signClientAssertion`, `AgsAccessTokens`,
    `AgsScoreClient`, `scoresUrlOf`, `outcomeOfStatus`, `LEARNER_ROLE_URI`, `activeLearnerCount`,
    `buildDeepLinkItems`), so a difference shows in the code that runs in production, and each failure message names
    the mock module that assumed otherwise.
  - **When it runs:** only when asked. The `LIVE_CANVAS_*` variables select ALU's test Canvas, with
    `LIVE_DATABASE_URL` and `LIVE_DATA_ENCRYPTION_KEYS` of the test server whose `/lti/keys` the developer key
    names, from which the tool key is read as the grade worker reads it, read-only. `LIVE_FEIDE_ISSUER` selects real
    Feide's public discovery. `LIVE_TARGET=mock` runs the same checks against the mock Canvas and the mock Feide on
    the local services, so a check is known to work before it meets Canvas, and refuses to start when a Canvas target
    is also set. With none of them every check is skipped; a partly set Canvas target fails at once, naming the
    missing variables, rather than skipping. The tests use `describe.runIf`, as `realClamd.test.ts` does, so
    spec-trace counts their `[ID]` titles; they lie outside the root Vitest projects, so the gate's per-ID runs do not
    select them, and they are evidence about Canvas only through a dated run recorded with the checklist.
  - **Safety:** the Canvas checks read only the platform row (and its key) from the test server's database, post a
    score only when `LIVE_CANVAS_STUDENT_SUB` names a test student, and never print a token, an assertion, a key or a
    member's ID (`DATA-009`). They are for a test course with test accounts only, never a course with real students.
  - **The Canvas acceptance checklist** (`docs/handoff/canvas-acceptance.md`) holds the steps against ALU's test
    instance that a test cannot automate: the developer key and deployment (Q4), launches in a browser that blocks
    third-party cookies, the Deep Linking round trip from each placement (Q13), the assignment name and points Canvas
    shows (Q8), a score in the gradebook, a deleted assignment, a course copy (`LTI-007`), Student View (D-102's
    test user), `feide_login` (Q4) and a real Feide login (Q3), and the seam's run. Each step names the mock
    assumption it confirms and what changes when Canvas differs: a decision or amendment first, then the mock and its
    tests, then the code. Results are recorded dated, without personal data.
  - **Alternatives considered:** (a) a Playwright flow that signs in to Canvas to automate the Deep Linking round
    trip: it needs a test account's password in the environment and breaks with each change to Canvas's pages; the
    checklist does it by hand and the seam checks its result through AGS. (b) A developer key for the seam alone:
    Canvas ties a line item to the tool that created it *(verify)*, so a second key could not read or score the
    tool's line items. (c) Running the seam against the mock in every CI run: worth doing, but it needs a script and
    a CI step outside the hand-off's files (below).
  - **Consequences:** for the integrator: a root script `test:live` (`vitest run --root apps/server --config
    live/vitest.live.config.ts`), `apps/server`'s `typecheck` script adding `live/tsconfig.json`, a CI step with
    `LIVE_TARGET=mock` if wanted, and links to the index from the root README's documentation map, the Evaluator
    Guide's limitations and PROGRESS's step 7.
- **Amendment (2026-11-05, S6 step 7: problem reporting, after review):** a review of the reporting files changed
  three things before the pilot. (1) *Health data:* why someone uses assistive technology is health information
  (GDPR art. 9), and an issue ties it to the reporter's GitHub account in public. The forms ask which assistive
  technology was used and say that the reason is not needed; the guide adds health to what is never written and
  offers the contact person, who opens the issue without the tester's account; triage removes such text like other
  personal data. (2) *Level 2, UU-barriere,* is any barrier that hinders someone or withholds information while they
  can still go on, also without assistive technology (low vision, no sound, a video without captions); level 1 stays
  "cannot use it at all". (3) *What an edit cannot undo:* an uploaded screenshot stays reachable at its URL after it
  is removed from the text *(verify)*, and notification e-mails cannot be recalled, so the guide asks testers to edit
  at once and tell their contact person, and triage asks GitHub Support to delete the file; real data about someone
  still goes to the DPO the same day.
- **Amendment (2026-11-05, S6 step 7: the live-contract seam and the hand-off index, after review):** a review of
  the seam and the index changed four things before hand-off. (1) *What a failing check prints:* Vitest prints what
  an assertion was given, so the NRPS checks printed members' `user_id`s and, in the very case they exist to catch, a
  member's name and e-mail address. They now compare counts and booleans only; the seam's safety rule above holds
  for failures too. (2) *Where a token goes:* a line item's `id` and a `Link: next` URL come from Canvas's answers,
  and the seam sent the bearer token to them unchecked; a URL that is not on `LIVE_CANVAS_API_ORIGIN` is now refused
  before anything is sent (`onApiOrigin`, tested in `canvasRequests.test.ts`), as the server checks a launch's
  service URLs (D-104). (3) `LIVE_AGS_LABEL_MODE` set alone counts as a Canvas target set in part and fails loudly,
  like `LIVE_CANVAS_STUDENT_SUB`. (4) *The index and the checklist as built:* `/app/play` shows **Innsikt** and
  **Poeng til Canvas** only to a launch that may edit (D-106's amendment), so a copied course's teacher who may not
  edit sees **Spel** only; the checklist expects that, and `canvas-studio.md` lists `LTI-007`'s insight tab with the
  duplicate. The index says which parts of `LTI-005` and `LTI-007` are built, since TRACEABILITY marks a requirement
  *tested* once one test names it.
- **Amendment (2026-11-05, S6 step 7: the integration):** decided before the integrator's changes; it applies what
  the five step-7 workstreams (the language overlay, problem reporting, the upstream drafts, the hand-off index with
  the live-contract seam, and the hardening after step 6's review) left for integration.
  - **The seam runs from the root and in CI against the mocks.** A root script `test:live` runs
    `apps/server/live/vitest.live.config.ts`; `apps/server`'s `typecheck` also checks `live/tsconfig.json`; and CI runs
    `npm run test:live` with `LIVE_TARGET=mock` after the end-to-end step (about 10 s), so a change to a mock or to the
    server code the seam calls cannot break the checks unnoticed before the students point them at Canvas. Without the
    variable, or with a Canvas target, nothing in CI changes: CI never holds a Canvas or Feide secret.
  - **One read of `content/h5p-tekstar/`.** `main.ts` passes the start-up's loaded H5P texts to `createH5pRuntime`
    (D-111), so the overlay the engine uses is the one the start checked, and a test's content folder reaches the
    engine (`startupLanguageOverlay.test.ts`). `createH5pRuntime` still loads the folder itself when no overlay is
    given (the seed command, the test beds).
  - **InteractiveVideo's scored end-screen summary** (D-111's review amendment) becomes the third entry of D-080's
    English-text register (`UPSTREAM_ENGLISH_TEXTS`), with a draft in `docs/upstream/h5p-accessibility/` (D-112);
    the conformance report shows it under 3.1.2. Checked on 2026-11-05 at the pinned commit and on the default branch
    (114f513): both pass `endCardTableRowSummary`, which the semantics do not have.
  - **Links:** the root README, PROGRESS and the Evaluator Guide link the hand-off index, the tester guide, the
    security policy and the upstream index; the index lists every workstream's hand-off item.
- **Amendment (2026-11-05, S6 step 8: the journey tests and the Canvas half of the studio):** it records what the
  Consequences above left to an amendment. The step-8 tests cited D-101 for both before it existed, and spec 02 §8
  still said these parts "come in S6" (found in the docs-trace review). The tests named are in `apps/server/`.
  - **J1 is split** (`SPEC-DEVIATION` from `LTI-005`'s "E2e in J1" and `PROD-001`'s "e2e for J1"). The picker lists
    the author's own and co-authored activities only: its content bank (`LTI-005` (a)) and «Create new» from a
    pattern (`LTI-005` (b), J1 step 2) pass to the students with `docs/handoff/canvas-studio.md` parts 1 and 2, as
    the `LTI-007` duplicate in `/app/play` and a copied course's **Innsikt** tab do with its part 3. J1 is proved in
    two halves. The portal half, steps 2–5 as the portal has them (a pattern's skeleton with placeholders, the check,
    publishing despite an error with a reason): `e2e/patternToPublish.e2e.test.ts` and
    `e2e/publishWithReason.e2e.test.ts`. The Canvas half, steps 1 and 6 (the picker from *Add item → External tool*
    as an assignment, a graded resource link with a formative line item, a learner's score in the gradebook):
    `e2e/journeyPlaceInCanvas.e2e.test.ts`. The picker's code carries `SPEC-DEVIATION: D-101`
    (`src/lti/deepLinking/deepLinkActivities.ts` and `deepLinkRoutes.ts`), and spec 00 §3 J1, `LTI-005`'s Verify
    line and spec 02 §8's `LTI-005` and `LTI-007` rows say what passes on. The deviation ends when `canvas-studio.md`'s
    parts are built and one J1 test runs from the picker's «Create new» to the gradebook.
  - **J5's coverage.** Step 1 (ALU edits a pattern's guidance in the content files alone, `PED-011`) is
    `e2e/journeyGovernance.e2e.test.ts`. Step 2 has no page of its own: libraries arrive by the seed step from the
    hash-checked bundle (D-041, D-110) or by an admin's `.h5p` import. That only `admin` installs or updates
    libraries, also through an uploaded `.h5p`, and that nobody installs from the Hub, is proved over HTTP by
    `test/http/packageImport.int.test.ts` and `test/http/ajax.int.test.ts` (`H5P-006`, `SEC-003`, `H5P-011`), not in
    a browser. Installing a new version in staging, verifying it and promoting it to production is the procedure *A
    new content-type version* in `docs/ops/runbook.md` §2: the re-pinned manifest in a pull request, one image with
    its bundle, the seed step and checks in staging, then the same image in production. No test runs it; HVL
    operations does.

### D-102 · `SPEC-DEVIATION` LTI-010: the xAPI bridge is plain JavaScript in the player document, for learners only
- **Context:** `LTI-010` puts the bridge in `packages/hvl-h5p-theme/src/xapiBridge.ts`: it subscribes to
  `H5P.externalDispatcher` and posts statements to `/api/h5p/xapi` every 2 s and on `pagehide`, with the ltik or the
  CSRF token, retrying from an in-memory queue and never slowing the activity down. `H5P-009` injects it "inside the
  H5P iframe", CLAUDE.md §2 describes the theme package as "injected into H5P player and editor iframes", and `UD-003`
  says the bridge adds the visually hidden ✓/✗ text. What S4–S6 found:
  - The theme's client scripts are plain JavaScript (an IIFE with JSDoc: `feedbackPrefixes.js`, `a11yRepairs.js`,
    `reducedMotion.js`), which the package exports from `src/` and the server serves unbundled under
    `script-src 'self'` (D-070). There is no browser build for TypeScript.
  - H5P Core relays every event raised in an iframe it wrote itself (`H5P.isFramed && H5P.externalEmbed === false`)
    to `window.parent.H5P.externalDispatcher` (`h5p.js`). The document that holds `H5PIntegration` therefore sees the
    statements of div-embedded and iframe-embedded content alike. A bridge only inside the iframes would miss
    div-embedded content, one in both places would send each iframe statement twice, and every frame would need the
    credential.
  - The hidden prefix already comes from `feedbackPrefixes.js` (D-072 amendment (a)); a second one from the bridge
    would be announced twice.
  - H5P sends no attempt identifier, but `DATA-012` stores an `attemptId`.
  - Authors play activities too: the portal's **Spel** tab is the author's preview, and teachers open `/app/play`.
- **Decision:**
  - **File and place:** `packages/hvl-h5p-theme/src/xapiBridge.js`, plain JavaScript in the style of its siblings.
    It runs only in the player document that `h5p/render/playerPage.ts` renders (`/h5p/play/:contentId` in the portal,
    `/lti/play` in Canvas): not in Core's iframes, not in the Next.js page around them, and never in the editor.
  - **Once per statement:** it subscribes to that document's `H5P.externalDispatcher` and queues a statement object
    once, so a statement relayed from a Core iframe is not queued twice. Probe P1 checks this on the ten real types.
  - **Learners only:** the player page loads the bridge only for a learner principal (whose highest role is
    `learner`), and the server stores and grades statements only from one; anyone else's request stores nothing.
    `LTI-011`'s View check still applies, and in Canvas the content must also be the launched activity.
    Previews in the portal and teachers' plays in Canvas never reach insight or the gradebook.
  - **Attempts:** the bridge makes a random `attemptId` for the root activity when the page loads, and a new one after
    the root's scored `completed` or `answered` statement, so a retry is a new attempt. Probe P1 records the real
    attempt boundaries of the ten types; a different rule is an amendment made before the mapper is written.
  - **Credentials:** in Canvas, the ltik as `Authorization: Bearer` from the page's memory (`LTI-003`); in the portal,
    the session cookie with the `X-CSRF-Token` header (D-057). `/api/h5p/xapi` takes no ltik in the query (D-058,
    D-069).
  - **Sending:** a batch every 2 s. On `pagehide`, `fetch` with `keepalive: true`, which can carry those headers
    (`navigator.sendBeacon` cannot). A failed batch stays in the in-memory queue and is retried while the page lives;
    nothing goes to browser storage, and the activity never waits for the bridge. Browsers limit keepalive requests
    to 64 KiB in flight per page, so a very large last flush can lose its tail; for formative data that is accepted.
  - **Time:** the stored `timestamp` is when the server received the batch, not what the browser claims.
  - **No feedback text:** the bridge adds no ✓/✗ prefix; `feedbackPrefixes.js` does (D-072).
- **Alternatives considered:** (a) A bridge inside every H5P iframe, as `H5P-009` reads: statements missed or sent
  twice, and the ltik or CSRF token handed to every frame. (b) TypeScript compiled for the browser: a build step for
  one file that its siblings do not have. (c) Storing everyone's statements and filtering when reading: previews
  would still be stored as learning data, and the grade worker would need the same filter.
- **Consequences:** `SPEC-DEVIATION` from `LTI-010` (the file is JavaScript, `xapiBridge.js`) and, for the bridge,
  from `H5P-009`: it runs in the player document, not "inside the H5P iframe", so the acceptance's check of the
  iframe document becomes a check of the player document (the theme part is unchanged; D-070 deviated from `H5P-009`
  the same way for nonces). The code carries `SPEC-DEVIATION: D-102`. Amended in the same step: CLAUDE.md §2 (the
  bridge's file and where it runs), `H5P-009`, and `UD-003` (the hidden prefix comes from `feedbackPrefixes.js`,
  never from the bridge, as D-072 amendment (a) already decided). Residuals, for the DPIA input and the students'
  checklist: Canvas's Student View sends the `TestUser` role, which D-059 maps to `learner`, so a teacher's Student
  View play counts as one learner in insight and is graded for Canvas's test student; reloading the page in
  the middle of an attempt starts a new `attemptId`, which inflates `INS-001`'s median attempts; and a learner can
  forge their own statements and attempt IDs, which `LTI-013` already accepts.
- **Amendment (2026-10-30, probe P1):** D-115 makes three parts of this decision concrete. *Once per statement:* the
  bridge registers only in a document that is not one of Core's iframes (`window.frameElement` is not an
  `h5p-iframe`) and ignores an event that `H5P.isFramed && H5P.externalEmbed === false` marks as relayed; a set of
  seen events cannot work, because each window's bridge has its own. *Learners only:* the bridge is the last script
  in `playerGlobalAssets`, and the player page leaves it and its configuration out for anyone but a learner
  principal; without a configuration it does nothing. The server's own check is unchanged.
  *Attempts:* the rule stands, written as `attemptId` = `<viewId>:<n>`. The bridge sends only the statements the
  server stores, each with a `statementId` that the server inserts once, and the stored `timestamp` keeps the
  batch's order (D-115).
- **Amendment (2026-11-04, step 3 integration):** the bridge is three player-only scripts, not one file, to keep
  within DOC-007's 200 lines: `xapiStatements.js` (D-115's root tests and the cut), `xapiBatching.js` (sizes, fitting,
  back-off) and `xapiBridge.js`, still the last script in `playerGlobalAssets` (`XAPI_BRIDGE_FILES`, never in
  `HVL_THEME_FILES`, so never in the editor). Its configuration is a separate inert JSON block `#hvl-xapi-bridge`
  (endpoint, content ID and version, and the request's own ltik or CSRF token), not a key of `H5PIntegration`, so
  Core's iframes, which copy `H5PIntegration`, never see the token. The endpoint must be same-origin path segments
  (`/api/h5p/xapi`), or the bridge does not start. ESLint's `LTI-003` storage ban covers the three scripts. Where
  CLAUDE.md §2 and spec 01's `H5P-009` and spec 02's `LTI-010` notes name `xapiBridge.js` alone, they mean these
  three (CLAUDE.md is the owner's to amend). The end-to-end test `e2e/xapiToCanvas.e2e.test.ts` runs the bridge in a
  real Canvas launch into `/app/play` and checks that a portal author's preview loads none of it.
- **Amendment (2026-11-04, the step-4 privacy review: Canvas's Student View):** *Found:* the residual above is worse
  than a single extra learner. Canvas's Student View launches a test student with the LTI `TestUser` role
  (`http://purl.imsglobal.org/vocab/lti/system/person#TestUser`, which D-059 maps to `learner`), and each «Reset
  Student» makes a new test student, so a new `sub` and a new `learnerKey` *(verify with TeCopp)*. A teacher who
  plays *k* − 1 test students beside one real learner makes a group of *k* in which every value is that learner's,
  so insight, the mappe and every *k* count would show what one learner did. *Decided:*
  - **Carried, not refused:** the launch facts say `testUser` when the roles claim holds the `TestUser` role
    (`lti/LtiRoleMapper.ts` `isLtiTestUser`, read in `lti/launchFacts.ts`), and the principal carries it as
    `Principal.lti.testUser` (`lti/ltikPrincipal.ts`). Nothing else about the principal changes: it is a learner.
  - **Stored, flagged:** a test student's statements are stored as before, with `XapiStatement.testUser = true` (a
    column, default false; migration `s6_test_user_statements`), so the grade worker still sends its score and a
    teacher can test the passback to Canvas's gradebook. The flag comes from the principal, never from the body.
  - **Left out of every aggregate:** insight's statement reader (`insight/data/insightStatements.ts`) and the mappe's
    results source (`learningDesign/mappe/storedActivityResults.ts`) read only rows with `testUser = false`, so a test
    student is never in a view, a distribution, a «Starta» count, a mappe group or any other count compared with
    *k*. The grade queue (`grades/`) reads one learner's own rows by `learnerKey` and is unchanged.
  - *Not chosen:* storing nothing for a test student (the teacher could not test the passback, and the grade job
    needs stored results, D-104); keeping test students out of the counts by their role at read time (the role is
    not stored, and every reader would need it).
  - *Consequences:* `testUser` is a field outside `DATA-012`'s list, a `SPEC-DEVIATION` like `academicYear` (D-107):
    it holds no statement data, only that the launch was Canvas's test student; spec 05 gets a note on `DATA-012`.
    The data inventory has its row. The purge and the data-subject CLI treat these rows like any other. Canvas's NRPS
    count (`LTI-008`) is Canvas's: whether it lists the test student is not known *(verify with TeCopp)*; if it
    does, the course count is one higher than the real learners, which only lowers a completion rate. Verified by
    `LtiRoleMapper.test.ts`, `launchFacts.test.ts`, `xapiTestUser.int.test.ts` (mock Canvas launches with the
    `TestUser` role through the real ingestion route: the flagged rows, the queued grade job, and the insight route,
    where four learners and two test students stay «< 5») and `storedActivityResults.int.test.ts`.

### D-103 · Course contexts are stored with their platform: `<platformId>:<contextId>`
- **Context:** `DATA-012` stores a `contextId?` per statement, `InsightSnapshot` has one, `LTI-008` caches a learner
  count per context, and `INS-007` limits a Canvas author to "that context only". A Canvas context ID is unique within
  one Canvas only. Every hosted Canvas shares the issuer `https://canvas.instructure.com`, so a platform is known by
  issuer and client ID (`docs/reference/canvas-platform-values.md`, D-051), and Canvas's test and beta instances are
  copies of production with the same course IDs *(verify with TeCopp)*. `LtiPlacement` keeps `platformId` and
  `contextId` apart, but `XapiStatement.contextId` and `InsightSnapshot.contextId` hold the bare ID, so courses from
  two of HVL's Canvas instances could merge in insight.
- **Decision:** Wherever S6 stores or compares a course for insight and grades, it uses the string
  `<LtiPlatform.id>:<context ID>`, where the context ID is the launch's context claim (`idToken.launch.context.id`,
  read in `lti/launchFacts.ts`; never ltijs's `LaunchContext.contextId`, CLAUDE.md §5). That covers
  `XapiStatement.contextId`, `InsightSnapshot.contextId`, the Redis key of the NRPS learner count, the insight scope
  and its list of contexts (D-106), and the data-subject export (D-108). The platform ID is a UUID, so the first `:`
  splits the string whatever the context ID contains. A portal play has no context (null). One module builds and
  parses the string; nothing else joins or splits it.
- **Alternatives considered:** (a) A `platformId` column beside `contextId` on the analytics tables: tidier, but a
  field outside `DATA-012`'s list (a `SPEC-DEVIATION`), and every index and query would need both. (b) Keeping the bare
  ID: a teacher in HVL's production Canvas could see aggregates that include plays from a test instance.
- **Consequences:** `DATA-012`'s field list is unchanged; the data inventory says what the value holds. The platform
  ID is stable while the platform stays in `LTI_PLATFORMS`, and a removed platform is deactivated, not deleted
  (D-051), so stored contexts still resolve. The NRPS count key and the xAPI rate-limit key are added by hand to the
  inventory's Redis section, which the inventory check does not read. `H5PUserData.contextId` (learner state per
  course, `auth/principalToH5pActor.ts`) keeps the bare ID: a collision there only shares one learner's own saved
  state between two copies of the same course, while changing the key would reset every learner's saved progress.
  The students' checklist names it.
- **Amendment (2026-11-04, step 3 integration):** the one module is `apps/server/src/xapi/platformContextKey.ts`
  (`platformContextKey`, `parsePlatformContextKey`, `principalContextKey`); the NRPS count imports it. *A Canvas
  launch without a storable course* (an empty context claim, over 255 characters, or with a line break; ltijs accepts
  such a launch): a learner's xAPI batch is answered 202, nothing is stored, and the log counts it as `noCourse`.
  Storing it under null would make it a portal play, 403 would misread a launched activity, and a 500 would make the
  bridge resend for as long as the page is open. Spec 02's `LTI-011` note says the same.

### D-104 · `SPEC-DEVIATION` LTI-012: our own minimal AGS client in a durable worker, not ltijs's `submitScore`
- **Context:** `LTI-012` has a worker call `context.grading.submitScore(lineItemUrl, …)`; spec 02 §1 lists
  `grading.submitScore` on ltijs's `LaunchContext` among "the APIs used below"; and CLAUDE.md §5 names
  `context.grading.submitScore` among the ltijs 7 calls to use (D-005). In ltijs 7.0.7 that method exists only on a
  `LaunchContext`, which `Provider.getLaunchContext(ltik)` rebuilds from a live ltik (24 h). It takes the platform and
  the learner's `sub` from that context, and its token from an internal `AccessTokenManager`
  (`services/grading/grading.service.js`). The package exports only `Provider` and types (its `exports` map has `"."`
  alone), so neither service can be used without a launch. A durable worker runs after the learner's request is gone
  and holds no ltik; keeping one for it would store a bearer credential for the learner's whole launch, against
  CLAUDE.md §1 (the ltik is kept in memory only). `LTI-012` itself already lets a job that outlives the 24 h "request
  a new client-credentials token itself".
- **Decision:**
  - **Token:** `AgsScoreClient` in `apps/server/src/grades/` requests the client-credentials token itself, from the
    first attempt. Its JWT client assertion is signed RS256 with the tool's private key for that platform, read through
    ltijs's `Provider.platformManager` (`getPlatformById`, `getPrivateKey`; our `PrismaLtiDatabaseManager` decrypts
    it, D-056). It carries the claims ltijs's own token manager signs: `iss` = `sub` = the client ID; `aud` = the
    platform's token endpoint (ltijs's default while `authorizationServer` stays unset, which Canvas accepts,
    `canvas-platform-values.md` §2); a fresh `jti`; a 60 s lifetime; and `kid` = the platform ID, which `/lti/keys`
    publishes. Scopes: `…/lti-ags/scope/score` and `…/lti-ags/scope/lineitem.readonly`. A token is cached per platform
    and scope until shortly before it expires, and is never logged.
  - **Score:** a `POST` to the line item's URL with `/scores` added to its path (any query string kept, as ltijs
    does), with the content type `application/vnd.ims.lis.v1.score+json` and `LTI-012`'s body: the learner's `sub` as
    `userId`, `scoreGiven`, `scoreMaximum: 100`, `activityProgress: 'Completed'`, `gradingProgress: 'FullyGraded'`
    and `timestamp`.
  - **Queue:** a `GradeSyncJob` is written only for a learner principal in a Canvas launch (D-102), a root statement
    (no `subContentId`) with the verb `completed` or `answered` and a `result.score`, and a placement found by
    `(platformId, contextId, resourceLinkId)` that has a `lineItemUrl`. Jobs are idempotent per
    `(placement, learnerKey, attemptId)`: a later scored statement of the same attempt updates its job. The learner's
    `sub` comes from the request's launch and is stored only encrypted (`ltiSubEncrypted`, D-056).
  - **Worker:** a `LeasedIntervalJob` (one node at a time) claims due jobs about every 15 s (`FOR UPDATE SKIP LOCKED`
    on the new `nextAttemptAt`) and coalesces them per `(placement, learnerKey)`. It applies the placement's stored
    attempt policy (`best`, `latest`, or `mastery` with its threshold; defaults as in `LTI-012`) to that learner's
    attempt scores in the placement's jobs (an `XapiStatement` has no placement, and `DATA-012` fixes its fields),
    sends one score with `timestamp` = the time of sending, and settles the coalesced jobs together. AGS lets a
    platform ignore a score older than the result it holds; sending one current score means that a late retry can
    never put an old result back.
  - **Outcomes:** a 2xx answer succeeds. A line item that no longer exists (404, confirmed with a `lineitem.readonly`
    read) marks the job `orphaned`, a new status, and it is not retried. A 429, a 5xx or a network error is retried
    with exponential backoff and jitter, at most 8 attempts, the last within 24 h of the first; then the job is
    `failed`. A 401 fetches a new token once. Any other 4xx fails the job at once. The new `terminalAt` records when a
    job stopped.
  - **The `sub`:** `ltiSubEncrypted` is set to null 30 days after `terminalAt`, whether the job succeeded, failed or
    was orphaned (`DATA-002` names success; a job that never succeeds keeps it no longer). A failed job retried after
    that has no `sub`; it stays failed, and the learner's next scored play makes a new job.
  - **Authors** see the counts sent, pending, failed and orphaned per placement on the activity page and in
    `/app/play`, and retry failed jobs there (`LTI-012`'s acceptance). Who may see them follows D-106; the counts are
    not *k*-suppressed (spec 05 §3).
  - **NRPS** (`LTI-008`) still uses ltijs's `context.namesAndRoles`: it runs during a launch, while the context lives.
- **Alternatives considered:** (a) `submitScore` with a stored ltik: a 24-hour bearer credential stored per learner,
  and the job still fails once it expires. (b) `submitScore` inside the learner's own request: learning would wait
  for Canvas, against `LTI-012`'s acceptance, and nothing would retry once the page is closed. (c) ltijs within the
  24 h and our client after, the spec's literal reading: two code paths for one request, and the first still needs an
  ltik in the worker. (d) Importing ltijs's internal `AccessTokenManager` by file path: refused by the package's
  `exports`, and it would break silently with an ltijs update.
- **Consequences:** `SPEC-DEVIATION`, exactly from: `LTI-012`'s sentence "A worker calls
  `context.grading.submitScore(…)`"; spec 02 §1's row naming `grading.submitScore` among the APIs used; and CLAUDE.md
  §5's list of ltijs calls, which repeats D-005's API context. D-005's decision (ltijs 7 with our
  `PrismaLtiDatabaseManager`) is unchanged, and ltijs still handles launches, Deep Linking, NRPS and the key set
  (D-061 likewise replaced `createDeepLinkingForm` with ltijs's message and our own form). Not deviated: the score
  body, the policies, the retry limit, idempotency, `orphaned` and the developer key's scopes. The code carries
  `SPEC-DEVIATION: D-104`; spec 02 §1 and §6 and CLAUDE.md §5 get amendment notes. Migration
  `s6_grade_bridge_insight` adds `orphaned`, `nextAttemptAt`, `attemptId` and `terminalAt`. What Canvas does that S6
  can only mock (the token's `aud` on HVL's instance, the answers for a deleted assignment and for a learner who has
  left the course) goes into the students' Canvas acceptance checklist (D-101). Residual: the learner key changes on
  1 August (D-011), so a learner's policy history starts again, and in a course that runs across 1 August an earlier
  best score can be replaced by a lower later one; accepted for D-011's reason (the summer break) and named in the
  checklist.
- **Amendment (2026-10-30, probe P1):** "a root statement (no `subContentId`) with the verb `completed` or
  `answered` and a `result.score`" is D-115's gradable root result: the root by three structural tests, the
  activity's main library in its category, `score.max` above 0, and not a replay. `scoreGiven` is `scaled × 100`.
  Each attempt holds at most one such result, so `latest` is the job created last. "A later scored statement of the
  same attempt" is then a duplicate, which the statement's ID already stops, or a forged one (`LTI-013`), which still
  updates its job as above (D-115).
- **Amendment (2026-10-30, S6 step 3):** `latest` is not "the job created last" (P1 amendment above): it is the job
  whose result was stored last, by `GradeSyncJob.resultAt`, then by attempt number and attempt ID (D-115's step-3
  amendment).
- **Amendment (2026-11-04, the step-3 security review, findings 1 and 4: the queue):** *Found:* jobs were per attempt,
  and D-115 makes every gradable root result an attempt, so one Canvas learner could write a job for each of the 120
  statements a minute that `LTI-011` lets them post per activity, all made up. The worker claims at most 50 due jobs a
  run, oldest first, every 15 s (about 200 a minute), so one learner could hold back every other learner's score, and
  the table grew with every result. Separately (finding 4), a job was lost when its write failed after the batch's
  statements were stored, since the batch is answered 202 and a resend is skipped. *Decided, in place of "Jobs are
  idempotent per `(placement, learnerKey, attemptId)`" above and the two amendments before this one:*
  - **One job per placement and learner.** `idempotencyKey` is `<placementId>:<learnerKey>`, so the queue holds at
    most one job per pair, however many results a learner stores. The job is that learner's score in that gradebook
    column. A newly stored gradable result updates its `attemptId`, `scoreGiven` and `resultAt` (the result the job
    took in last, which the worker's settlement compares) and the encrypted `sub` (from the request); a pending job
    keeps its attempts and `nextAttemptAt`; a stopped job (succeeded, failed or orphaned) becomes pending at once,
    with its attempts, `terminalAt`, `succeededAt` and `lastError` reset and `createdAt` set to that moment, so each
    reopening gets the 8 attempts within 24 hours again. An author's retry still keeps `createdAt` (one attempt per
    retry after the 24 hours). `LTI-012`'s idempotency per `(placement, learnerKey, attemptId)` holds a fortiori: a
    result taken in twice changes nothing but the job's state.
  - **The score comes from the stored results, read when it is sent.** The worker applies the placement's policy to
    the learner's stored gradable root results (D-115) of the placement's activity in the placement's course
    (`<platformId>:<contextId>`, D-103): `best` the highest, `latest` the last in D-115's result order (`timestamp`,
    then attempt number, then attempt ID), `mastery` 100 once any reaches the threshold, else the latest. It reads the
    best result and the results with the latest timestamp, which give the same score as all of them. A job with no
    stored result (a data-subject erasure, or a link that now opens another activity) fails as `no-result`, unsent.
  - **Fair claiming.** A run still claims at most 50 jobs, oldest due first; as a job is one learner's score, one
    learner takes at most one place a run. A job that takes in a result while its score is in flight is not settled
    over: it is due again at once (a retry keeps its backoff), so the new result goes at the next run, not after the
    30-minute claim.
  - **Reconciling (finding 4).** Each run also reopens a stopped job, `sub` still kept, whose learner has a gradable
    result in the job's activity and course stored after the job's `resultAt`, from 15 minutes up to 1 minute before
    the run (the minute lets the ingestion's own job write finish first), and takes that result in as above. This
    mends a failed job write for a learner who already has the job. One whose first job write failed has no job, and
    so no `sub` in our records: their next gradable result in that placement writes the job, whose send includes the
    lost result; if they never play again it never reaches Canvas. A failure while the worker was down for more than
    15 minutes is likewise left to the learner's next result. Both are residuals for the students' checklist; an
    outbox in the ingestion's transaction would close them, at the price of a grade write in every batch.
  - **No cap on stored results per minute:** with the queue bounded by pairs, a flood costs at most one score post
    per learner and run; `LTI-011`'s limit still bounds the statements, whose table grows with it as before.
  - *Consequences:* the status counts (D-106) are learners' scores in each state, one per learner and placement, not
    attempts; they are still `LTI-012`'s "counts of sent / pending / failed". That a count can then be about one
    learner, also in a colleague's course whose counts an owner or co-author sees unsuppressed (D-106's residual),
    is recorded for the DPO (`docs/privacy/DPIA-INPUT.md`, R1; Q22). Two links to one activity in one course read
    the same stored results (a statement names no link, `DATA-012`), graded or not: each graded link applies its own
    policy and has a job only for a learner who played that link, and that learner's score there also counts plays
    through the other link, an ungraded practice link included, whose newer results also reopen the stopped job
    (the reconciling pass). Keeping them apart needs the link in the statement, a `DATA-012` change for the owner to
    weigh (the skeptic review of 2026-11-04). The S6 migration is unchanged; the meaning of `idempotencyKey`,
    `attemptId`, `scoreGiven`, `resultAt` and `createdAt` changes as above, which the schema's comments and the data
    inventory must say. Rows written per attempt before this amendment (development databases; S6 is not deployed) are
    still sent and settled; their learner's next result writes the per-learner job. Spec 02 `LTI-012` gets an
    amendment note.
- **Amendment (2026-11-04, the step-3 security review, finding 2: the line item's URL):** the worker sends the
  learner's `sub` and a bearer token to the `lineItemUrl` that the launch's AGS claim names, and nothing checked it.
  Canvas serves AGS on the institution's own domain (`canvas-platform-values.md` §1, the AGS service URLs row), the
  domain `CANVAS_ORIGINS` already lists so that Canvas may frame the tool. *Decided:* a line item URL is allowed only
  when it parses as a URL, holds no user name or password, uses https where https is required (production), and its
  origin is in `CANVAS_ORIGINS` or is the origin of one of the platform's own configured URLs (its issuer, as a
  self-hosted Canvas serves AGS on its issuer's host, and its authorisation and token endpoints). The placement
  recorder checks it at every launch and stores none instead (the link is then not graded; the refusal is logged with
  its origin only); the worker checks it again before it asks for a token, and fails the job as `line-item-url`
  without any request (a URL stored before this rule, or after `CANVAS_ORIGINS` changed). Redirects were already
  refused. *Wiring:* the server passes `CANVAS_ORIGINS` and `NODE_ENV === 'production'` to both; without them only the
  platform's own origins are allowed, and production's checks keep those on https (`productionChecks.ts`). *Not
  chosen:* a per-platform origin list in `LTI_PLATFORMS` (a configuration change, while HVL's `CANVAS_ORIGINS` names
  HVL's own Canvas domains only); a DNS check against private addresses, which the allow-list makes unnecessary.

### D-105 · The formative line-item label is configurable, and scores are labelled formative wherever shown
- **Context:** `LTI-013` labels AGS scores formative with the suffix "(formativ)" on the line-item `label`. On
  `assignment_selection` Canvas uses that label as the assignment name and overwrites the teacher's own; spec 02
  leaves to HVL and ALU whether the suffix belongs there, or in the content item's description with Canvas's
  `preserveExistingAssignmentName` extension (Q8, open). `lti/deepLinking/deepLinkItems.ts` sends the plain title
  today. `LTI-013` (c) also says that these scores are never presented as exam evidence, and S6 shows scores in three
  new places: the insight views, the `INS-009` CSV and the grade-sync status.
- **Decision:**
  - `AGS_LABEL_MODE`, read at start-up, chooses between:
    - `suffix`, the default and the spec as written: the line item's `label` is «Tittel (formativ)», the title cut
      when needed so the suffix is never lost;
    - `preserve`: the label is the title, the content item carries
      `"https://canvas.instructure.com/lti/preserveExistingAssignmentName": true`, and its description says that the
      score is formative.
  - The suffix is «(formativ)», as `LTI-013` writes it, in every language.
  - The insight views, the CSV and the grade-sync status say that the scores are formative, computed in the browser
    and not exam evidence, with `PROD-011`'s notice or a label from the same locale texts.
  - Q8 stays open; HVL and ALU's answer changes the setting, not the code.
- **Alternatives considered:** (a) Only the suffix, waiting for Q8: a "no" from HVL would need a new release.
  (b) Only `preserve`: it departs from `LTI-013` (a) before HVL has decided.
- **Consequences:** A unit test checks the label in both modes (`LTI-013`'s Verify). A change of mode affects new
  placements only; assignments already in Canvas keep their names. How Canvas shows the name in each mode is on the
  students' Canvas acceptance checklist *(verify)*.

### D-106 · `SPEC-DEVIATION` spec 05 §1: insight per context, fixed periods, suppression as `INS-006` writes it
- **Context:**
  - `INS-007`: owners and co-authors see an activity's insight; in LTI mode, authors of the launch context see that
    context only; admins only through an audited support action; every view is audited (`DATA-007`).
  - Spec 05 §1: the view covers one activity in one Canvas context (or all portal users), with results "since a
    chosen date (default 7 days ago)". §3: teachers cannot see data from other courses' contexts, and they can see
    grade-sync status counts, which, unlike the learner counts and answer distributions there, carry no
    "(groups ≥ k)".
  - `INS-006`: a cell, bar or list item about fewer than *k* learners shows "< 5" and hides its value; the
    next-smallest cell is hidden too when a hidden value could be worked out from the totals; and there is no
    per-learner endpoint. `privacy/minimumGroupSize.ts` (D-095) shows nothing at all below *k* and also hides a rate
    of 0 % or 100 % (the two-sided rule).
  - Found while mapping: a free "since" date lets two overlapping views isolate one learner (differencing);
    `PROD-013` wants results separated by version; `tokens.json` has one non-text colour for chart marks (`accent`),
    and derived shades wait for HVL (D-017, D-072, Q2). Spec 00 §8 measures from the audit log whether pilot
    teachers opened *Før samlinga*.
- **Decision:** The owner decided on 2026-10-30 that insight is shown in tabs, one context at a time (D-101). In
  detail:
  - **One view:** one activity, one content version (the current one by default; `PROD-013`, D-093) and one context:
    a Canvas context the activity is placed in (D-103), or the portal's plays. There is no view across contexts.
  - **Who:** for a context, the activity's owner and co-authors, and an LTI author whose launch comes from that
    context, whether or not they own the activity (after a course copy, `LTI-007`). On the activity page the owner or
    co-author picks one of the activity's contexts, labelled with `LtiPlacement.contextLabel` where one is stored
    (D-087); in `/app/play` the context is the launch's and cannot be changed. An admin gets no insight through the
    role: `INS-007`'s audited support action is not built in S6, so admins see none.
  - **Periods:** fixed choices only: the last 7, 14 or 30 days, or since the semester started. Each starts at
    midnight, Oslo time, so a teacher cannot place two start dates to difference two views. The semester starts on
    1 January or 1 August until HVL gives its semester dates (open; HVL and ALU decide).
  - **Suppression as `INS-006` writes it:** each value is about a known number of distinct learners. A value about
    fewer than *k* is shown as «< *k*» (for example «< 5»), and the API answer carries no value for it; when a hidden
    value could be worked out from a shown total and the other cells, the next-smallest cell is hidden too. A
    free-text answer appears only when *k* distinct learners gave it (`INS-003`). D-095's two-sided rate rule is not
    added: a rate of 0 % or 100 % over at least *k* learners is shown, because "nobody got question 3 right" is the
    signal a seminar needs. `minimumGroupSize.ts` gets the insight rules beside the mappe's, and its "never shown as
    fewer than" stays true for the mappe.
  - **Exempt:** the grade-sync status counts (spec 05 §3), which Canvas's gradebook shows per learner anyway. The
    `INS-006` property tests (D-114) cover the insight endpoints and the CSV, not those counts.
  - **Charts (`INS-008`):** a single hue, the `accent` token, with each value written as a label next to its bar, a
    visible data table and a text summary; no new colours. A suppressed cell shows its «< *k*» text and no bar.
  - **Audit:** a view writes `insight.view` and a CSV download `insight.export` (`DATA-007`), with the activity as
    the target and details limited to the view, the period, the context (D-103's string, or the portal) and the
    content version: no learner key, count or answer. That is enough for spec 00 §8's measure.
  - **The formative label:** D-105.
- **Alternatives considered:** (a) An all-contexts view for owners: not in spec 05, and "all contexts minus one"
  differences out a single course. (b) A free "since" date, as spec 05 §1 reads: open to differencing. (c) The
  mappe's two-sided rule for insight rates too: it would hide the items a teacher most needs to see. (d) New chart
  colours: they need HVL's approval (Q2).
- **Consequences:** `SPEC-DEVIATION` spec 05 §1: the period is chosen from fixed values, not any date; the code that
  builds periods carries `SPEC-DEVIATION: D-106`, and spec 05 gets an amendment note. Residuals for the DPIA input
  (`DATA-005`) and the DPO (Q6): views of the same period on two days differ by one day's learners; an owner or
  co-author sees aggregates for every course their activity is placed in, including a colleague's course that placed
  it from the bank or copied it, which spec 05 §3's "data from other courses' contexts" can be read to forbid, so the
  DPO and the owner may narrow it by amendment; and a 0 % or 100 % rate tells what every learner in a group of at
  least *k* did.
- **Amendment (2026-11-04, S6 step 4: suppression and the tab as built):** *Found* in the insight core's review: an
  exhaustive check of every group of two to five cells for *k* = 3 to 6 showed that hiding only "the next-smallest
  cell" lets a reader who knows the rule (it is public, here and in `INS-006`) work hidden counts out in about one
  answer in ten (with *k* = 5, the cells `(hidden, 0, hidden, 5)` of a total of 6 can only be `[0, 0, 1, 5]`); and
  `INS-002`'s share right times its learners tells how many chose the right options, which `INS-003` may hide.
  *Decided, in place of "the next-smallest cell is hidden too" and "`minimumGroupSize.ts` gets the insight rules
  beside the mappe's" above:*
  - **A 0 is shown.** A count of 0 is about no learner, so it singles no one out, and it is the "nobody chose this" a
    seminar needs, as a rate of 0 % is. A 0 is hidden only as a complement or inside a hidden group (below).
    `SPEC-DEVIATION` `INS-006`, whose "fewer than *k*" read literally takes in 0 (`insight/suppression/insightCells.ts`).
  - **Complementary suppression.** In a group whose cells add up to a shown total (a choice question's options and
    «no answer»; a gap's right answers, listed wrong answers, other wrong answers and empty gaps), a complement is
    needed when exactly one cell is hidden, or when two or more are and all hold 1 or all hold *k* − 1. Then every
    shown 0 is hidden; in a group without a 0, the smallest shown count is hidden, then each next shown count less
    than *k* above the last one hidden. A hidden total hides every cell of its group. This hides more than one
    "next-smallest cell" where that is needed, and never less. The tab's privacy note says that a hidden cell may hold
    more than *k* − 1 learners; nothing says which cells are complements.
  - **Parts another view gives away.** A single-answer choice question is protected as two parts, its right options
    and its wrong options with «no answer», each with its own total, since `INS-002`'s share gives the right options'
    total; a task with one gap likewise (right, and the rest). A multi-answer question stays one group, since
    `INS-002` counts only fully right answers there.
  - **A hidden starter group hides every question cell.** When the learners who started number 1 to *k* − 1, every
    `INS-002` and `INS-003` cell is hidden, zeros included, as participation and video engagement already are.
  - **`INS-003` for the current content version only.** A version is raised only by a structural save (D-093), which
    may reorder options or change gaps, and older parameters are not stored, so an older version's option numbers
    and gap answers cannot be matched to texts. For an older version the tab says that answer distributions are shown
    for the current version only; participation, `INS-002` and `INS-005` read by sub-content and are shown for every
    version. `SPEC-DEVIATION` `INS-003` for older versions (`insight/buildInsightReport.ts`, the web's
    `MisconceptionSection.tsx`).
  - **Where the rules are:** `apps/server/src/insight/suppression/` (`insightCells.ts`, `additiveGroupCells.ts`),
    with *k* from `minimumGroupSize()` (`MIN_GROUP_SIZE`); `privacy/minimumGroupSize.ts` keeps the mappe's rules.
  - **The Canvas tab:** `/app/play` shows **Innsikt** to a launch that may edit the activity, as it shows **Poeng til
    Canvas**, since the launch tells the page only `mayEdit`. The API admits every LTI author of the launch's course
    where the activity is placed (as above), so a course copy's teacher who may not edit can read the view through
    the API but has no tab yet.
  - *Verified by* `additiveGroupExhaustive.test.ts` (every group of two to five cells, *k* = 3–6, with `INS-002`'s
    share as known) and the `[INS-006]` property tests over the report, the CSV rows, and the API's JSON and CSV.
  - *Residuals for the DPIA input (`DATA-005`, `docs/privacy/DPIA-INPUT.md` R6–R9) and the DPO (Q6):* a share in
    `INS-002` over *k* or more learners can give a count below *k* (10 % of 20 is 2) that `INS-003` hides; when *k* or
    more learners each hold a cell of their own and no cell is empty, every cell is hidden yet each must be 1; the
    fixed periods are nested (7 ⊂ 14 ⊂ 30 days ⊂ the semester), so two views of the same day can isolate the learners
    active only in their difference; and a "first answer" is the first within the chosen period, while answers H5P
    accepts as small spelling errors are listed as wrong in `INS-003`.
- **Amendment (2026-11-04, the step-4 privacy review: when a period ends, 1 August, the gap rule as built, the
  summaries, the roster URL):** *Found* in the privacy review of step 4: (a) every period ended at the request
  (`end: now`), so two views of the same period a few minutes apart differed only by what was stored in between,
  and a teacher who saw one learner play could read which cells that learner moved, below *k* (the residual above,
  and DPIA R3 and R8, named only views on different days); (b) a 7-, 14- or 30-day view opened from 2 to 30
  August spanned 1 August, when the pseudonym secret changes (`DATA-002`), so a learner who played on both sides
  counted twice, under two keys, and a portal session keeps the old year's key up to 12 hours past 1 August
  (D-057); (c) the chart summaries named "the hardest" question and "the most common" wrong answer among the shown
  cells only, which a hidden cell can make false; (d) the gap rule the review built is not written here; (e) the
  NRPS roster URL behind the course count was not checked as D-104 checks a line item's URL. *Decided:*
  - **Every period ends at the latest midnight in Oslo**, the start of today: a view holds the data up to and
    including yesterday, and the tab says so («Tal til og med i går»). Two views of the same period on the same day
    are the same whatever is stored in between. The start is N days before that midnight (7 whole days for `7d`), or
    for `semester` the start of the semester of the period's last day (yesterday), so on 1 January the view is the
    autumn semester and on 1 August the spring semester, never an empty one. *The trade-off:* a teacher sees today's
    plays tomorrow. The alternative, a new view only after *k* new learners, is open for the owner and ALU (PROGRESS
    Q24). `SPEC-DEVIATION` (spec 05 §1, already one for the fixed start): the view never holds today.
  - **No period crosses 1 August.** A view belongs to the academic year of its last day and starts no earlier than
    1 August 00:00 Oslo of that year: a 7-, 14- or 30-day view whose days would reach back before it starts on 1
    August instead (the 7-day view from 2 to 7 August, the 14-day view to 14 August, the 30-day view to 30 August),
    and the tab says the period is shortened and why. On 1 August itself the period ends at that midnight and lies
    wholly in the year that ended, so it is not shortened. The query also reads only rows whose `academicYear` (the
    year of the key, D-107) is the view's year, so the portal's 12-hour tail of old keys cannot count a learner twice;
    a portal play of 1 August under the old year's key is then in no view. The semester never crosses 1 August.
    *Corrected 2026-11-04 (the workstream's skeptic):* this item first said that every 7-, 14- and 30-day view from 2
    to 30 August starts on 1 August; only one whose days reach back before 1 August does.
  - **The mappe's semester groups read one year's keys too** *(added 2026-11-04, the workstream's skeptic)*: the
    mappe counts each course, version and semester as a group of its own and leaves out every group of fewer than
    *k* (D-095's amendment of 2026-11-04), and its autumn semester starts on 1 August. Read by time alone, the
    portal's 12-hour tail made one learner two in that group, under the old and the new key, so *k* − 1 learners could
    make a group of *k* that insight's semester view of the same course shows as «< *k*». The mappe's results source
    (`learningDesign/mappe/storedActivityResults.ts`) therefore reads, for each semester, only the rows whose
    `academicYear` is that semester's academic year, as insight's views do; a result counts only for a learner present
    in its group, so the old key's results of that tail are in no group either. The yearly purge's snapshots already
    select by the stored year (D-107).
  - **The gap rule as built**, in place of "a gap's right answers, listed wrong answers, other wrong answers and
    empty gaps" in the amendment above: a listed wrong answer, which `INS-003`'s public rule says *k* or more
    learners gave, is always shown and is never a complement; per gap, «right», «other wrong» and «empty» are one
    additive group whose total is the question's learners less the listed answers' learners
    (`insight/aggregate/gapMisconceptions.ts`, `insight/suppression/additiveGroupCells.ts`); a task with one gap stays
    split into two parts, «right» (which `INS-002`'s share gives away) and the rest.
  - **Summaries say "of those that can be shown"** (`INS-008`; «av dei som kan visast»): the hardest question, the
    most common wrong option or gap answer and the least answered video task are named among the shown values, and
    the sentence says so in `nn`, `nb` and `en`, so a hidden cell can never make it false. *Added 2026-11-04 (the
    workstream's skeptic):* the questions' list is headed «vanskelegast først» but sorts by shown shares only, with a
    question whose share cannot be shown last (so its place gives nothing away); its introduction now says so in each
    language, so the order is never read as the hidden questions being the easiest.
  - **The course count's roster URL** (the completion base, `LTI-008`): ltijs reads the course's learners with a
    token from the launch's `context_memberships_url`, which nothing checked. D-104's line-item URL rule (its
    amendment of 2026-11-04) applies to it too: the URL must parse, hold no user name or password, use https where
    https is required, and have an origin in `CANVAS_ORIGINS` or one of the platform's own; otherwise no token is
    asked for, the old count stays and the refusal is logged with the origin only (`lti/nrps/NrpsLearnerCounter.ts`,
    `nrps.url-refused`). The server passes the same rules as to the grade worker (`createNrpsServices`' `urlRules`);
    without them only the platform's own origins are allowed. *Added 2026-11-05 (integration):* `main.ts` and the
    test beds' `gradeBridgeInputs` now pass `{ origins: CANVAS_ORIGINS, requireHttps: NODE_ENV === 'production' }`,
    so a roster on the institution's Canvas domain is read when that origin is in `CANVAS_ORIGINS`; and the CSV's
    period-end row is labelled «Til (ikkje med)» (nb «Til (ikke med)», en «Up to (not included)»), since that
    midnight is not part of the view.
  - *Verified by*, besides the tests above: `additiveGroupExhaustive.test.ts`'s `[INS-006]` test that no hidden gap
    count can be worked out from a listed wrong answer; `insightScope.test.ts` (the end at midnight, every day of
    August); `insightPeriodEnd.int.test.ts` (a statement stored today never changes today's view; one learner under
    two years' keys counts once); `NrpsLearnerCounter.test.ts` (a roster URL on another origin is never read, and
    `createNrpsServices` hands the rules to the counter); `storedActivityResults.int.test.ts` (one learner under two
    years' keys is one learner in the mappe's autumn group); and the web's `InsightPeriodNote.test.tsx` and
    `insightSummaries.test.ts`.
  - *Residuals for the DPIA input and the DPO:* views of the same period on two consecutive days still differ by one
    day's learners (R3, R8: now day by day, never within a day); the course's NRPS count can change within a day,
    and with it the base of the completion rate; a learner active only on 1 August under the old key, through
    the portal, is in no view and no mappe group; and stored rows of earlier days still change within a day when
    operations erase a learner's data (D-108) or an activity is deleted, so a view taken before and after an erasure
    differs by that learner's rows (rare, run by operations, and nothing in the tab says that or whom it erased).
- **Amendment (2026-11-05, the step-5 privacy and security review: the mappe ends at midnight too):** *Found:* the
  mappe's results source (`learningDesign/mappe/storedActivityResults.ts`) read every stored row up to the moment of
  the export, while insight's views end at the latest midnight in Oslo (the amendment above). For an activity in one
  course and one version, the mappe's current-semester group is insight's `semester` view plus today's plays, so the
  mappe exported at 14:00 minus that view (or two exports on the same day) gives the participants, completion rate,
  attempts and change of the learners who played today: with one such learner, what that learner did, below *k*. That
  is the within-day differencing the amendment above closed for insight, and it breaks `learnerSummaries.ts`'s rule that
  the mappe's totals cannot be differenced against insight's views. *Decided:* the mappe reads, like insight, only rows
  stored before the latest midnight in Oslo at the moment of the export (presences and root results alike), so two
  exports on one day are the same and an export never holds today's plays. *The trade-off:* as for insight, a teacher
  sees today's plays in the mappe tomorrow (PROGRESS Q24 applies to both). The yearly purge's snapshots cover ended
  years only and are unchanged. *Verified by* `storedResultsBeforeToday.int.test.ts` (a learner who played today is in
  no group until the next day).
- **Amendment (2026-11-05, the S6 security review: another site cannot write the audit trail):** *Found*
  (SEC-S6-01): the view and the CSV download are GETs that write `insight.view` and `insight.export` (**Audit**
  above, `DATA-007`), D-057 asks for the CSRF token on unsafe methods only, and the `SameSite=Lax` session cookie goes
  with another site's top-level navigation. A page on any site could send a signed-in teacher to `…/insight/export`:
  the server wrote audit events under the teacher's name that the teacher never asked for (which spec 00 §8's measure
  reads), saved the aggregated CSV among their downloads, and used up their 60 insight requests a minute. That site
  never reads the answer. The same day's re-check found a second way in that a rule against other sites misses: an
  author can set an H5P image path to `https://<app>/api/content/<id>/insight/export` (`rightsOfUse.ts` and Lumi
  accept an http(s) path, h5p.js `getPath` plays an absolute path as it is, the player's CSP has `img-src 'self'`).
  A teacher who opens that activity in the portal loads it as an image of our own origin, which full Chromium sends
  as `Sec-Fetch-Site: same-origin`, `Sec-Fetch-Mode: no-cors`, `Sec-Fetch-Dest: image` with the session cookie, and
  the server wrote `insight.export` under that teacher's name. *Decided:* every insight route answers 403
  `error.forbidden` (already in the contract) to anything but what our pages send, a script's `fetch` from our own
  origin: `Sec-Fetch-Site` absent or `same-origin`, `Sec-Fetch-Mode` absent, `cors` or `same-origin`, and
  `Sec-Fetch-Dest` absent or `empty`. That refuses a top-level navigation from any site (a typed URL too), a request
  from another origin of any site (`cross-site`, or `same-site`, which takes in the files origin, D-045), and an
  image, video, frame or prefetch that a page of our own origin loads. The check comes after the sign-in check and
  before View, the rate limit and any audit write. Our pages' fetches (`apiRequest`, `apiFileRequest`; also in the
  Canvas frame, whose fetches go to its own origin) and clients that send no fetch metadata (Node's `fetch` sends only
  `Sec-Fetch-Mode: cors`) are served as before. D-057 is unchanged: no CSRF token on these GETs, which the web
  client's `apiHeaders` sends on unsafe methods only. *Residual:* a browser that sends no fetch metadata (Safari
  before 16.4) is not covered; only a token on these GETs would close that, a change to D-057 left open. A script
  running on our own origin can still fetch these routes, as it can every route. *Verified by*
  `insightForeignRequest.test.ts` (no audit event and no rate-limit take for a navigation, another origin's request or
  our own page's image, video, frame or prefetch, with the headers full Chromium sends; our pages' fetch still
  audited).

### D-107 · `SPEC-DEVIATION` DATA-003: the yearly purge runs on 31 August and deletes by a stored academic year
- **Context:** `DATA-003` runs the purge "on a configured date (default 15 August)" for the academic year that has
  ended, deleting rows "older than the academic-year boundary plus 30 days", keeping only *k*-suppressed snapshots
  for the mappe, and destroying that year's pseudonym secret. The academic year ends on 31 July
  (`privacy/academicYear.ts`, D-011), so the 30 days end on 30 August, and on 15 August nothing is old enough yet. The
  tables keep timestamps, not years, while a learner's rows belong to the year whose secret made their `learnerKey`
  (`privacy/deriveLearnerKey.ts`); a cut by timestamp can split them. The secrets are an environment value
  (`PSEUDONYM_SECRETS`), which the server cannot destroy.
- **Decision:**
  - **When:** by default on 31 August, Oslo time, for the academic year that ended on 31 July; the date is
    configurable, but not to a day before 31 August, so the 30 days always pass first. A leased job runs it on one
    node, and a CLI runs the same code by hand.
  - **What:** `XapiStatement`, `H5PUserData` and `GradeSyncJob` get an `academicYear` column, set when a row is
    written to the year of the secret that made its `learnerKey`. The purge deletes the ended year's rows by that
    column, in batched transactions; then the learner `Identity` rows created before that year ended; then learner
    `User` rows left without an `Identity` (D-034).
  - **Snapshots first:** before anything is deleted, it writes the year's `InsightSnapshot` rows per activity, context
    (D-103) and content version, already suppressed with the configured *k* (D-106). Only these outlive the purge.
    They are kept for the mappe (`DATA-003`), so the values the mappe reads from them also follow D-095's rules, the
    two-sided rate rule included, which D-106 leaves out of the insight views only.
  - **Dry run:** counts per table and deletes nothing. Every run, dry or real, writes an audit event with the counts
    (`DATA-003`, `DATA-007`).
  - **The secret:** destroying the year's pseudonym secret is an operations step in the runbook: after the real run,
    HVL removes it from the secret store and from `PSEUDONYM_SECRETS`. At start-up the server names, by year only, any
    secret still configured for a year the purge has completed, so a forgotten step shows.
- **Alternatives considered:** (a) 15 August with a timestamp cut: it deletes nothing on that day, or splits a
  learner's year. (b) The server destroying secrets itself: it would need write access to HVL's secret store.
- **Consequences:** `SPEC-DEVIATION` from `DATA-003` in three points: the default date (31 August instead of
  15 August), which rows go, and who destroys the pseudonym secret. The purge takes the ended year's rows by their
  stored year, and learner `Identity` rows created before 1 August, not every row "older than the academic-year
  boundary plus 30 days", which, read on the run date, would also take the new year's first 30 days. The 30 days
  after the boundary are kept, as the time before the purge may run. `DATA-003` has the scheduled job destroy that
  year's secret; here the job cannot, so HVL operations destroy it in a runbook step after the real run, and the
  start-up warning shows a forgotten one. `DATA-002`'s rule that a year's secret is destroyed when that year's data
  is purged still holds, through that step. `academicYear` on `XapiStatement` is a field outside `DATA-012`'s list,
  so this is a `SPEC-DEVIATION` from `DATA-012` too: it holds no statement data, only the year of the secret behind
  the row's `learnerKey`, which the key cannot reveal and a timestamp can misstate (a portal session made before
  1 August can keep its `learnerKey` for up to 12 hours after it, D-057). D-103 (a) refused a `platformId` column
  partly for this reason; there the context string can carry the platform, while nothing else carries the year.
  Spec 05 gets amendment notes on `DATA-003` and `DATA-012`. Migration `s6_grade_bridge_insight` adds the column, and a
  `contentVersion` to `InsightSnapshot`, which has none today. A learner who comes back after the purge gets new
  rows, as the new year's key already makes them a new pseudonym. The integration test travels through a year in
  time (`DATA-003`'s Verify) and checks D-034's rule.
- **Amendment (2026-11-04, step 3 integration):** where the year comes from. A portal session stores
  `learnerKeyYear`, computed at login from the same moment as its key (a session field; the data inventory's Redis
  section lists it); an LTI request's key and its year come from one moment in `LtiAccounts` (`lti/launch/
  ltiAccount.ts`), and `principalOfLaunch` puts the year on the principal, so no request at the turn of the year pairs
  a key with the other year. `learnerKeyYearOf(principal, receivedAt)` falls back to the request's year only for a
  principal built without one. `XapiStatement` rows (`XapiIngest`) and `GradeSyncJob` rows (from those statements)
  carry it. *Still open, for step 5:* `H5PUserData` rows are written without it (`h5p/storage/learnerStateWrites.ts`
  takes the database default, the year of the write), which is wrong for a portal session made before 1 August and
  used up to 12 hours after; the purge step carries `learnerKeyYear` through `principalToH5pActor` into that write.
- **Amendment (2026-11-04, step 5, the purge built):** how the job, the CLI and the H5P state write carry this out
  (`apps/server/src/privacy/purge/`).
  - *Date:* `PURGE_RUN_DATE` (`MM-DD`, default `08-31`) names a day from 31 August to 31 December; an earlier day, and
    any day from January to July, is refused. A day in spring would keep a year's rows for most of another year,
    which `DATA-003`'s retention does not allow. The leased job (lease `hvli:privacy:retention-purge`) checks every
    hour and runs once the Oslo date has reached that day of the current academic year while the audit log holds no
    completed real run for the year that ended, so a server that is down on the day purges at its first check after.
    The CLI (`privacy/purge/purgeCli.ts`) refuses a real run before that day; its dry run runs on any day.
    *Added 2026-11-05 (integration):* `config/env.ts` declares `PURGE_RUN_DATE`, so a value outside those days stops
    the start-up by name (`test/config/purgeEnv.test.ts`); before, an unknown variable was dropped and the default
    applied. Operations run the CLI as `npm run --silent privacy:purge -- --dry-run|--execute` from `apps/server`.
  - *Which rows:* every row whose stored `academicYear` is before the current academic year, not only the year that
    just ended, so a year that a missed run left behind goes too; a row of the current year is never selected. Then
    the learner `Identity` rows created before the current academic year began (the moment the ended year ended), then
    the learner `User` rows left without an `Identity` that were created before that moment and own no activity.
    *Amends D-034's consequence:* a learner account created in the current year and left without an identity (its
    platform removed, say) stays until the next purge, because the purge leaves everything of the current year alone;
    such a row holds an ID, a kind and a time only. (`AccountResolver` writes a new user and its identity in one
    nested create, one transaction, so no purge can find one without the other; the rule is about the year, not a
    race.) *Corrected
    2026-11-04 (step 5 review):* this sentence first gave such a race as the reason.
  - *Order and batches:* the snapshots first, then `GradeSyncJob`, `XapiStatement`, `H5PUserData`, `Identity` and
    `User`, each in transactions of at most 1 000 rows, so a large year neither locks a table for long nor is held in
    memory. A run that fails part-way keeps its snapshots and what it deleted; the next run deletes the rest. A table
    is done only when a page of its rows comes back empty or short: a batch that deletes fewer rows than it found
    (another writer took them meanwhile: an activity deleted with its statements, a state reset, a data-subject
    erasure, a second run) does not end it, since a run that ended early would be audited as completed and the job
    would leave the rest for a year. The same page found twice with nothing deleted fails the run (audited, retried
    at the next check) instead of looping. *Added 2026-11-04 (step 5 review):* the first version stopped a table at a
    batch that deleted nothing. *Added 2026-11-04 (second step 5 review):* each batch's delete repeats the filter its
    page was read with, so a row that stopped matching in between stays: a learner whom a login made staff after the
    page was read and before its delete (`AccountResolver` changes the kind of the account it found) keeps their
    identity, so their staff account is not left without one. The first version deleted a page's identities by their
    IDs alone. *Added 2026-11-05 (integration):* the other side of that race is closed in `AccountResolver`. A login
    that found an identity makes its account staff only while that identity still exists, in one statement (`UPDATE`
    with an `EXISTS` on the identity); if the purge removed it in between, or before the key rotation's re-hash, the
    login finds nothing and creates a new account, as for a first login. The old learner account, now without an
    identity, is left to the next purge, so no staff account (with a display name) is ever left that no login reaches.
    What remains is the window inside that one statement.
  - *Snapshots:* one per ended year, activity, context and content version, for the period from 1 August of that year
    to the next 1 August (midnight in Oslo), with the configured *k*. `aggregates` holds the mappe's figures
    (`MAPPE-002`: participants, completion rate, median attempts, mean change) as `activityAggregates` computes them
    from that year's rows (by their stored year) under the mappe's group rules (context, version and semester; groups
    below *k* left out; D-095 and its amendment of 2026-11-04), with `source: "yearly-purge"`, the year and
    `suppressed`; a hidden value is absent. They are written in one transaction under a PostgreSQL advisory lock, and
    not again for a year that has them. Insight's per-question cells are not kept: they describe at most a semester,
    which has ended. The mappe does not read the snapshots yet (open).
  - *Dry run and log:* a dry run counts, per table, the rows a real run would delete and the snapshots it would
    write, and changes nothing else. The job logs that plan, counts only, as the first line of every run.
  - *Audit (`DATA-007`):* every run, dry or real, from the job or the CLI, writes `purge.run` with target
    `AcademicYear` and the ended year, no actor (`actorUserId` null, as the schema has it for scheduled jobs; the CLI
    has no login), and the details `trigger` (`job` or `cli`), `dryRun`, `outcome` (`completed` or `failed`), `years`
    (the stored years the run covered) and `counts`. A run that fails writes its event with what it had done, then
    fails.
  - *Idempotent:* a second run finds nothing to delete and writes no snapshot, and is audited like any run; the job
    starts none once a completed real run for the ended year is audited.
  - *The secret:* when the job starts and after each completed real run, it logs a warning with the years (only the
    years) of the secrets in `PSEUDONYM_SECRETS` up to the latest ended year with a completed real run in the audit
    log (a run takes every stored year up to its own, so all those secrets are stale). The runbook
    (`docs/ops/yearly-purge.md`) gives the steps, the configuration change and how to check it.
  - *`H5PUserData`'s year:* `principalToH5pActor` puts `learnerKeyYearOf(principal, now)` on the H5P actor
    (`learnerKeyYear`); the state route runs Lumi's write inside `withLearnerKeyYear`
    (`h5p/storage/learnerStateYear.ts`), and `learnerStateWrites.ts` sets `academicYear` on insert and on update,
    which for one key is always the key's year.

- **Amendment (2026-11-26, D-144):** a real run writes a `purge.run` event with `outcome: "started"` and the plan's
  counts before its first change, and its end (`completed` or `failed`) as before. A run that is cut short leaves
  its start on record; only a `completed` real run marks a year as purged.

### D-108 · Data-subject requests: a server CLI that HVL operations run
- **Context:** `DATA-008` asks for an admin-only tool that takes a Feide ID or an `(iss, sub)` pair, derives the
  learner keys for the retained academic years, and exports (JSON) or deletes that learner's data, with every use
  audited. Lumi 10.0.4's `ContentUserDataManager.deleteAllContentUserDataByUser` checks the permission for the user
  named but deletes the acting user's data (`ContentUserDataManager.js:39-43`, unchanged on Lumi's `master`, D-081).
  Such a request reaches HVL through its data protection officer, not through the app, and the identifiers it needs
  are exactly those the app never stores (`DATA-002`).
- **Decision:**
  - **Form:** a CLI in `apps/server` (export, delete, and a dry run that counts), run by HVL operations where the
    server runs. No web page and no HTTP route.
  - **Finding the learner:** from the Feide ID and/or `(iss, sub)`, in memory only, the CLI derives the `learnerKey`
    for every year in `PSEUDONYM_SECRETS` and the `Identity.subjectHash` for every key in `IDENTITY_HASH_KEYS`
    (D-055).
  - **Scope:** the learner's `XapiStatement`, `H5PUserData` and `GradeSyncJob` rows, their learner `Identity` rows and
    the learner `User` rows then left without one (D-034). `H5PUserData` is deleted through our own storage
    (`h5p/storage/PrismaContentUserDataStorage.ts`), never through Lumi's manager. *k*-suppressed snapshots hold no
    learner data and stay. The export is JSON with the stored fields, contexts as D-103's strings.
  - **Audit:** each run writes an audit event (export or deletion) with the counts. Its target is a random request ID,
    never the Feide ID, the `sub` or a learner key. The operator names their own HVL admin account (a Feide ID in
    `ADMIN_FEIDE_IDS` that has a staff account), which is recorded as the actor; nothing else about them is stored.
- **Alternatives considered:** (a) An admin web page with a Feide admin session and the CSRF token: a page that
  accepts other people's Feide IDs and Canvas subjects over the web, for a rare task that the DPO's process brings to
  HVL operations anyway. (b) Lumi's `deleteAllContentUserDataByUser`: it deletes the wrong person's data.
- **Consequences:** `DATA-008`'s "admin-only" holds twice over: only operations can run the CLI, and only for an HVL
  admin. A staff member's own data (account, authored content, co-authorships) is outside the CLI; the runbook says
  how HVL handles such a request by hand until that is decided (open; HVL's DPO, Q6). The Lumi bug goes into the
  upstream drafts (D-112). The integration test exports and deletes a learner with rows in two academic years and
  checks that another learner's rows remain.
- **Amendment (2026-11-04, step 5, the CLI built):** how `apps/server/src/privacy/dsr/` carries this out; the runbook is
  `docs/ops/data-subject-requests.md`.
  - *Commands:* `export` and `erase`, each with `--operator <feide-id>`; `erase` is a dry run that counts unless it is
    given `--confirm`. Run from `apps/server` as `npm run --silent privacy:dsr -- …`. Exit codes: 0 done, 1 refused or
    failed, 2 usage or an unreadable data subject, 3 an erasure that found rows written while it ran.
  - *The data subject on standard input:* one JSON object, `{"feideId": "…", "lti": [{"issuer": "…", "sub": "…"}]}`,
    with at least one identifier; never in the arguments, which stay in the shell's history and show in the host's
    process list. The Feide ID is normalised as at login (D-054); `iss` and `sub` are taken exactly. A fault is named
    by its field, never by its value, and `JSON.parse`'s own message, which can quote the input, is never shown.
  - *Keys:* for every year in `PSEUDONYM_SECRETS` and every identifier given, the `learnerKey` of `feide|<id>` and of
    each `lti|<iss>|<sub>` (D-011, `DATA-002`), and their `Identity.subjectHash` under every `IDENTITY_HASH_KEYS` key
    (D-055). A Feide ID finds no Canvas rows and a Canvas `sub` no portal rows, as they are different pseudonyms, so
    the runbook asks for both (Canvas's `sub` is the user's `lti_id`). The CLI refuses to start without the secrets,
    and names by year only the stored academic years that no configured secret covers (`unreachableYears`): no
    identifier can find their rows, which the yearly purge should have removed (D-107).
  - *Operator:* `--operator` must be in `ADMIN_FEIDE_IDS` and have a staff account through a Feide identity. Otherwise
    the run is refused before any learner row is read, and the refusal is audited without an actor.
  - *Export:* one JSON document on standard output, with a count summary on standard error: the request ID and moment,
    the years searched, each `learnerKey` with its year and variant, then the stored fields of the `XapiStatement`,
    `H5PUserData` and `GradeSyncJob` rows, each grade job's course as D-103's string. The encrypted `sub` is left out,
    and `ltiSubStored` says whether one is held: its plaintext is the `sub` the request gave, and the ciphertext is of
    no use to the person. It also lists the matched learner `Identity` and `User` rows and, beyond D-108's scope, the
    learner accounts' `AuthAuditEvent` rows (D-064: portal logins and logouts), which are data about the person too.
  - *Erasure:* in the purge's order (D-107's amendment of 2026-11-04): `GradeSyncJob`, `XapiStatement`, `H5PUserData`
    (through `PrismaContentUserDataStorage.deleteAllContentUserDataByUser`, one key at a time, with D-036's state
    view), the matched learner `Identity` rows, then the learner `User` rows left without an identity and owning no
    content. Each table goes in its own statements, not in one transaction (the storage takes the server's client),
    so a run that fails part-way is audited `failed` with what it deleted, and a second run deletes the rest. It then
    counts again: rows a learner wrote meanwhile (a portal session lasts up to 12 hours, D-057; an LTI request stops
    once its identity is gone) are printed as `remaining`, with exit code 3.
  - *Not touched:* staff accounts (counted as `staffAccounts`; D-108 leaves a staff member's own data to HVL by hand);
    the `AuthAuditEvent` rows, kept their 2 years for security (`DATA-007`): once the account is gone no identifier
    finds them, though their `ipHash` stays linkable to an IP address (HVL's DPO to confirm, Q6); and records that
    expire on their own: ltijs's ID tokens (24 hours, D-052), portal sessions (12 hours) and logs, which hold no
    personal data (`DATA-009`).
  - *Audit (`DATA-007`):* `dataSubject.export` or `dataSubject.erase`, target `DataSubjectRequest` with a random
    request ID (printed for HVL's case record, which alone links it to the person), the operator's `User.id` as actor
    (none for a refusal), and the details `dryRun`, `outcome` (`completed`, `failed` or `refused`), `years`,
    `identifiers` (how many Feide IDs and Canvas subjects were given), `counts`, `unreachableYears` and, after an
    erasure, `remaining`: numbers, years and fixed words, never an identifier, key or hash. The CLI writes no log
    lines. A run stopped by its arguments, an unreadable data subject or the configuration reads and writes nothing,
    so it is not audited.
- **Amendment (2026-11-05, step 5 review):** gaps the review found, closed in `apps/server/src/privacy/dsr/` and the
  runbook.
  - *Interruption:* once the data subject is read, `SIGINT` (Ctrl-C), `SIGTERM` and `SIGHUP` are held until the run
    has written its audit event; the first prints one note. By default each of them ended the process at once, so an
    erasure stopped by Ctrl-C, a closed SSH session or a container stop deleted rows with no audit event, against
    `DATA-008`'s "every use is audited". `SIGKILL`, Ctrl-\ (`SIGQUIT`) and a crash cannot be held: such a run stays
    unaudited, a residual the runbook names.
  - *Export only to a file or a pipe:* `export` refuses, with exit code 2 and before standard input is read, when
    standard output is a terminal, so the person's record never lands in a terminal's scrollback or a recorded
    session by mistake.
  - *Failures:* a Prisma or driver error is printed by `logging/prismaErrorSummary.ts`'s value-free line (its name
    and database code), any other error by its name and code, as before (`DATA-009`).
  - *Staff accounts* (`staffAccounts`) are accounts of kind `staff`: a staff member's, but also a student author's
    (D-059; the citation read D-089 until the integration of 2026-11-05) and that of someone Canvas launched as an
    author (`LTI-004`). The runbook tells operations to handle such
    an account by hand, as for a staff member, whoever the person is.
  - *npm's debug log:* npm writes the command line, and so the operator's own Feide ID (never the data subject's,
    which is on standard input), to `~/.npm/_logs` even with `--silent`. The runbook's commands add `--logs-max=0`,
    which writes none (`DATA-009`).

### D-109 · Database roles, encrypted-connection checks in production, and a request log without personal data
- **Context:** `DATA-010` asks for separate database roles for the app, for migrations and for read-only analytics,
  with the migration role used only in CI/CD; today one user, `hvli`, does everything (compose, `.env.example`, CI).
  `DATA-004` asks for EEA hosting, TLS 1.2 or later and encryption at rest, verified by a deployment checklist in
  `docs/ops/`. `config/productionChecks.ts` already refuses some unsafe production settings (an http Feide issuer,
  `PDF_ALLOW_NO_SANDBOX`), but not an unencrypted database, Redis or S3 connection. `NFR-006` asks for structured logs
  with request ID, route, status and latency and no personal data; pino redacts by key (`DATA-009`), but there is no
  request log yet, and a raw URL can carry an ltik, a file grant or IDs.
- **Decision:**
  - **Roles:** an SQL script creates `hvli_migrator` (owns the schema and runs `prisma migrate deploy`), `hvli_app`
    (reads and writes rows only, with default privileges for the tables the migrator adds later) and `hvli_analytics`
    (read-only, without the encrypted and token columns, which the script and the data inventory list). The server
    connects with `DATABASE_URL` (the app role); migrations use their own URL, set only in CI/CD and in the
    deployment's migrate step. Development and CI may keep one user; a test proves that the app role cannot change
    the schema. Creating the roles in production is a step for HVL's database administrator (Q5).
  - **Production checks:** in production the server refuses to start with a `DATABASE_URL` whose `sslmode` is not
    `require` or `verify-full`, a `REDIS_URL` that is `redis://` rather than `rediss://`, or an `http:`
    `S3_ENDPOINT`. Residency in the EEA cannot be read from a setting: it stays a checklist item with the provider's
    facts (Q5), and the start-up log names the configured S3 region and the database and Redis hosts (never
    credentials), so the checklist can be ticked against them. If HVL's set-up protects a hop another way, the
    exception comes by amendment.
  - **Request log (`NFR-006`):** one structured line per response with a request ID (a well-formed inbound
    `X-Request-Id`, otherwise a random one, sent back in the response), the method, the matched route pattern (never
    the raw path or query), the status and the time taken in milliseconds. No user ID, IP address or body. The
    redaction key list (`DATA-009`) gains S6's keys (statement answers, the `sub`, client assertions and tokens).
- **Alternatives considered:** (a) TLS as a checklist item only: a missing `sslmode` is easy to overlook and silently
  unencrypted. (b) Logging the URL with its query redacted: the path itself carries grants and IDs
  (`/h5p/files/<grant>/…`).
- **Consequences:** `docs/ops/` (the deployment checklist and the runbook) describes the roles, the second URL, the
  TLS settings and the 30-day log retention (`DATA-009`); `.env.example` documents the migration URL. The checklist
  recommends `verify-full`, since `require` encrypts without checking the server's certificate.
- **Amendment (2026-11-04, step 5, the roles, checks and request log built):** what was built; the points marked
  *narrowed* or *changes* alter the decision above. The runbook is `docs/ops/database-roles.md`.
  - *Roles, as two scripts:* `apps/server/prisma/roles/01-roles.sql`, run once per database by HVL's database
    administrator (a superuser, or the database owner with `CREATEROLE`), creates the three roles if they are missing
    and resets their attributes (`LOGIN`, never superuser, `CREATEDB`, `CREATEROLE`, replication or `BYPASSRLS`),
    takes every privilege on the database and on schema `public` from `PUBLIC`, gives the three roles `CONNECT`, gives
    `hvli_migrator` `CREATE` on the database and makes it the owner of `public`. `02-grants.sql`, run as
    `hvli_migrator` after every `prisma migrate deploy` (it refuses any other user, because `ALTER DEFAULT PRIVILEGES`
    binds to the user that runs it), grants the app its rows and builds the analytics views. Both are idempotent and
    hold no password: the administrator sets them with psql's `\password` (sent hashed) or uses certificates. A small
    runner, `apps/server/src/infra/databaseRolesCli.ts roles|grants`, runs one script in one transaction with the
    `DATABASE_URL` of that run (the administrator's, or the migration URL, as `prisma migrate deploy` reads it), and
    never prints the URL.
  - *The app (narrowed):* `SELECT`, `INSERT`, `UPDATE` and `DELETE` on every table in `public`, also on the tables
    later migrations add (default privileges), and sequences; nothing on Prisma's `_prisma_migrations`; and on the
    three audit tables (`AuditEvent`, `AuthAuditEvent`, `LibraryAuditEvent`) `SELECT` and `INSERT` only, so a flaw in
    the app cannot rewrite or erase the audit trail (`DATA-007`). Never `TRUNCATE`, `REFERENCES`, `TRIGGER`, `CREATE`
    or `TEMPORARY`. No server code updates or deletes audit rows today (a test scans for it); the two-year deletion of
    audit rows, when it is built, needs its own amendment and grant.
  - *Analytics (narrowed):* instead of "read-only, without the encrypted and token columns", `hvli_analytics` reads
    aggregate views only, and no table at all: it has no `USAGE` on `public`, `USAGE` on schema `analytics`, and
    `SELECT` on `analytics.insight_snapshot`, a view (owned by the migrator) of the `InsightSnapshot` rows, which are
    stored only after *k*-suppression (D-106, D-107), with the activity's content type and snake_case column names for
    R and Python. Its sessions start read-only (`default_transaction_read_only`). A new view is a new amendment and
    may show only aggregates already suppressed with *k*; `02-grants.sql` re-creates the views after each migration,
    and a migration that changes a column a view reads drops that view first.
  - *Storage location (changes "residency cannot be read from a setting"):* in production the server also refuses
    storage outside an EEA allow-list in `apps/server/src/config/storageResidency.ts`. Without `S3_ENDPOINT` (AWS
    itself), `S3_REGION` must be an AWS region in the EEA: `eu-north-1` (Stockholm), `eu-west-1` (Ireland),
    `eu-west-3` (Paris), `eu-central-1` (Frankfurt), `eu-south-1` (Milan) or `eu-south-2` (Spain), not `eu-west-2`
    (London) or `eu-central-2` (Zurich), which are outside the EEA *(verify)*. With `S3_ENDPOINT`, its host must be
    the S3 endpoint of one of those regions (`s3.<region>.amazonaws.com`, also `s3.dualstack.…`) or lie under an
    approved domain: `hvl.no` or `sikt.no` *(verify, Q5)*. The lists are code, not an environment variable, because
    whoever sets `S3_ENDPOINT` would set the list as well; a reviewed change with an amendment here adds an entry. The
    check catches a wrong setting (a region outside the EEA, a test endpoint left in place); it proves nothing about
    where a server stands, which stays the checklist's evidence (Q5). Database and Redis hosts are usually internal
    names or addresses, so they are not judged by name: `deploymentLocations(env)` gives the database and Redis
    hosts, the S3 region and the S3 endpoint's host (never a user, password or path) for the start-up log line.
  - *TLS, made exact:* `DATABASE_URL`'s `sslmode` may also be `verify-ca` (it encrypts and checks the certificate
    authority, more than `require`). Only `sslmode` counts, the parameter libpq tools read too; node-postgres's own
    `ssl=true` is not accepted. node-postgres 8.23 treats `require` and `verify-ca` as `verify-full` (and warns at
    start) unless the URL says `uselibpqcompat=true`; the checklist recommends `verify-full`. Messages name the
    variable, and the region or host for storage, never a URL.
  - *Request log, made exact:* `apps/server/src/http/requestLog.ts`, mounted first in `createApp` (after the proxy
    setting), so every response carries `X-Request-Id`, health checks included. An inbound `X-Request-Id` is kept only
    when it is a UUID or 32 hexadecimal digits (nginx's `$request_id`), lower-cased; anything else is replaced by a
    random UUID, so a client cannot write text of its choice (a name, a token) into the log. The ID is also in
    `res.locals.requestId` for error logs. `route` is the pattern of the last route Express matched, after the paths
    its routers are mounted at (`/api` and `/content/:contentId` give `/api/content/:contentId`), taken when the route
    matches; a response no route served (a static file, the 404 page, the web app) names its router's mount path with
    `/*`, or `*` at the top. Mount paths are static (a test scans the sources for a mount with parameters), so `route`
    holds no ID. One `info` line, `msg: "request"`, when the response closes: `requestId`, `method`, `route`, `status`,
    `durationMs` (to 0.1 ms) and `aborted: true` when the client left first; no URL, query, header, cookie, body, user
    ID, IP address or learner value.
  - *Verified by:* `apps/server/test/db/databaseRoles.int.test.ts` (connects as each role to a throwaway database and
    proves the statements each may and may not run), `auditAppendOnly.test.ts`, `apps/server/test/config/`
    `connectionEncryption.test.ts` and `storageResidency.test.ts`, `apps/server/test/http/requestLog.test.ts` and
    `requestLog.int.test.ts` (an LTI launch, a play and an xAPI batch through the whole app; no line holds the ltik,
    the learner's `learnerKey` or a path with the activity's ID).
- **Amendment (2026-11-05, step 5 review of the roles, checks and request log):** five gaps found and closed; the
  points marked *changes* alter the amendment above.
  - *The AWS SDK's own endpoint variables (changes the storage check):* without an endpoint in its configuration, the
    AWS SDK for JavaScript (3.1155.0) sends S3 requests to `AWS_ENDPOINT_URL_S3`, else `AWS_ENDPOINT_URL`, else an
    `endpoint_url` in the shared AWS config file. Verified: with `S3_ENDPOINT` unset, `S3_REGION=eu-north-1` and
    `AWS_ENDPOINT_URL_S3=http://…`, the client sent to that http host, past both the TLS and the EEA checks. Production
    therefore refuses either variable when it is set (any value), naming the variable only: `S3_ENDPOINT` is the one
    setting for another store. `productionProblems` gets the raw environment for this (`loadEnv` passes its source).
    The shared config file is not in the environment: `apps/server/src/infra/s3Client.ts` should make the SDK ignore
    configured endpoints (an integrator item); until then the deployment checklist says no AWS config file is mounted.
    *Added 2026-11-05 (integration):* done. The client is built with the SDK's `ignoreConfiguredEndpointUrls: true`,
    so `AWS_ENDPOINT_URL_S3`, `AWS_ENDPOINT_URL` and a config file's `endpoint_url` are never read, in any mode, and
    `S3_ENDPOINT` still names the store (`apps/server/test/infra/s3Client.test.ts`, which fails without it). The
    production refusal of the two variables stays, so a mistaken setting is named at start-up rather than silently
    ignored. `main.ts` now writes the start-up line (`deployment locations`: the database and Redis hosts, the S3
    region and endpoint host).
  - *The migration URL's TLS (changes the runbook):* Prisma 7.10.1's CLI (`migrate deploy`, `db execute`) does not
    honour `sslmode=verify-full`: it connected to a server whose certificate names another host. It checks the
    certificate and its host only with `sslaccept=strict`. node-postgres, which the `grants` runner uses, reads
    `sslmode=require` as `verify-full`. The migration URL is therefore `…?sslmode=require&sslaccept=strict` (plus
    `sslrootcert=<CA file>` when the CA is not in the system store): both tools then refuse a wrong certificate
    (verified against the local PostgreSQL with `127.0.0.1` for a `localhost` certificate). The server's
    `DATABASE_URL` keeps `verify-full`; its client is node-postgres.
  - *Start-up facts:* node-postgres connects to a `host` query parameter rather than the URL's host
    (pg-connection-string), so `deploymentLocations` names that host when the URL has one.
  - *The role test:* it sets the three cluster-wide roles' passwords to a published test value, so it refuses a
    database server other than this machine (`localhost`, a `127.x` address, `::1` or a socket), where it would reset
    real roles' passwords.
  - *Views down before each migration (changes "a migration that changes a column a view reads drops that view
    first"):* once `02-grants.sql` has built `analytics.insight_snapshot`, PostgreSQL refuses a migration that retypes
    or drops a column the view reads (verified: `InsightSnapshot.k` or `H5PContent.mainLibrary` to another type gives
    SQLSTATE `0A000`, dropping `InsightSnapshot.contextId` gives `2BP01`). The development database and CI have no
    views, so such a migration would fail first in a production deployment, and `InsightSnapshot` is a table the
    yearly purge (D-107) has just begun to write. A third script, `apps/server/prisma/roles/00-views-down.sql`, run as
    `hvli_migrator` (it refuses any other user) by the runner's `views-down` step right before `prisma migrate
    deploy`, drops every view in schema `analytics` and nothing else: no table, schema or grant. The grants step then
    builds the views again. The views hold no data; analysts miss them only during the deployment. The migrate step is
    `views-down`, `prisma migrate deploy`, `grants`.
- **Amendment (2026-11-05, the step-5 privacy and security review: bucket names):** *Found:* the storage check judges
  `S3_REGION` and `S3_ENDPOINT` only, but the AWS SDK for JavaScript (3.1155.0) also routes by the bucket. Verified:
  with `S3_ENDPOINT` unset, `S3_REGION=eu-north-1` and `S3_CONTENT_BUCKET` set to an S3 access point ARN of
  `us-east-1`, the client sent to `<name>-<account>.s3-accesspoint.us-east-1.amazonaws.com`, and an Outposts ARN of
  `us-west-2` to `…s3-outposts.us-west-2.amazonaws.com`, without `AWS_S3_USE_ARN_REGION` and past the EEA check;
  `ignoreConfiguredEndpointUrls` does not change it. *Decided (changes the storage check):* in production
  `S3_CONTENT_BUCKET` and `S3_TEMPORARY_BUCKET` must each be a plain bucket name by S3's naming rules (3 to 63
  lower-case letters, digits, dots and hyphens, beginning and ending with a letter or digit), so an ARN, which holds
  `:` and `/`, is refused; the message names the variable only, never the value (an ARN holds an account ID)
  (`apps/server/src/config/storageResidency.ts`, `bucketNameProblems`; `test/config/storageResidency.test.ts`).
  An access point alias (`…-s3alias`) is a plain name and goes through the client's own region.

### D-110 · Deployment and operations design: runtime, image, compose, content types, files origin, ClamAV
- **Context:** `NFR-007` asks for Docker images and compose files for local and staging use; `NFR-002` for daily
  backups and a tested restore; `SEC-004` for a separate files origin in production (D-012, D-045); `SEC-006` for
  ClamAV when `CLAMAV_HOST` is set; D-096 for Chromium with æ, ø and å in the image. Found while mapping:
  - `npm start` runs the server's TypeScript through `tsx`, a development dependency of the repository root, so the
    server cannot start from a production install (Evaluator Guide limitation 13). A bundle or a `tsc` emit would
    break at least nine `import.meta.url` anchors (`SERVER_ROOT` and `WEB_APP_DIR` among them).
  - The real content types come only from `npm run h5p:fetch-libraries`, which needs GitHub (D-078);
    `apps/server/var/` is not committed, the seed folder holds only hashes (Q10), the Hub is out of reach (Q7), and
    HVL's hosts may have no GitHub access.
  - Chromium refuses its sandbox as root (D-096), and playwright-core 1.56.1 is made for one Chromium build.
  - `@lumieducation/h5p-clamav-scanner` 10.0.4 (GPL-3.0-or-later; it brings `clamscan` 2.4.x, MIT, and `ts-deepmerge`
    7, ISC) does not by itself refuse every upload that was not scanned (the detail is in the private record, D-112's
    amendment of 2026-11-13), so we wrap it. It also reads `CLAMSCAN_*` and `CLAMDSCAN_*` environment variables, which
    override the options passed to it. clamd's default stream limit (25 MB) is below `SEC-005`'s 50 MB.
  - A files origin would fail the `DATA-011` tests, which count every other origin as third-party
    (`apps/server/a11y/support/motionAndNetwork.ts`).
  - Whether Docker runs in this environment is known only after probe P3.
- **Decision:** a design that steps 1 and 6 build; what they find changes it by amendment.
  - **Runtime:** `tsx` (4.23.15, already pinned) becomes an exact-pinned runtime dependency of `apps/server`, and
    `npm start` keeps running the sources. A build step waits for a reason worth reworking the anchors.
  - **Image:** one multi-stage `Dockerfile`. The build stage installs everything, generates Prisma, builds the tokens,
    theme and web app, and fetches H5P core and editor with their hash checks (D-027). The runtime stage has
    production dependencies only, runs as a non-root user, and carries the Chromium that Playwright 1.56.1 pins, with
    `fonts-liberation` (or fonts HVL licenses) so that æ, ø and å embed (D-096); the sandbox runs on unprivileged user
    namespaces or a seccomp profile, whichever HVL's runtime allows (Q5). No secret is baked into an image.
  - **Compose:** the app, a migrate step (with D-109's migration role) and a seed step go under a compose profile
    `app`, so plain `docker compose up -d` still starts only the test services (D-023, CLAUDE.md §3). A smoke test
    starts the profile and checks health, a launch and a player page (`NFR-007`'s Verify).
  - **Content types:** a bundle of the libraries D-078 pins, built with `npm run h5p:fetch-libraries` where GitHub is
    reachable, with a SHA-256 manifest kept in the repository. The seeder installs from the bundle and refuses any
    file whose hash differs. Committing the bundle itself waits for Q10.
  - **Files origin (`SEC-004`):** `FILES_BASE_URL`, which in production must be https and another host than
    `PUBLIC_BASE_URL`; by default `files.<host>`, as spec 02 §2 draws it. The player's signed content-file URLs
    (D-058) move there first; the editor's cookie-authenticated file route stays on the main origin until a later
    step. The files origin serves files only, with `SEC-004`'s headers, no cookies and no ltik, and with CORS for the
    app origin and H5P's `crossorigin` setting, so captions (VTT) still load. The `DATA-011` tests count the configured
    files origin as first-party, since it is ours (D-012), and the player page's policy (D-070) gains it in the
    directives that load content files (at least `img-src` and `media-src`), and nowhere else. A separate registrable
    domain would isolate more (a same-site subdomain still gets `SameSite` cookies sent with requests a file could
    start, although it cannot set our `__Host-` cookies and a file cannot run script under `CSP: sandbox`); the
    domain is HVL's choice (Q5).
  - **ClamAV (`SEC-006`):** when `CLAMAV_HOST` is set (with a port and a time limit), the scanner is registered in
    `malwareScanners`, which covers editor uploads and package imports alike. Our wrapper makes it fail closed: a
    `NotScanned` answer or a time-out refuses the upload with our own error, not "malware found". The scanner gets its
    options only from our checked configuration; the checklist says not to set `CLAMSCAN_*` or `CLAMDSCAN_*`, and
    that clamd's `StreamMaxLength` must be at least 50 MB. Signature updates are HVL's (runbook). The package is
    pinned at 10.0.4, the version that matches Lumi 10.0.4's scanner interface (D-112).
  - **Backups and runbook (`NFR-002`):** backup and restore scripts with a round-trip test on PostgreSQL 16,
    `docs/ops/RUNBOOK.md` and `docs/ops/DEPLOYMENT-CHECKLIST.md`. The real daily backups, their 30-day retention and
    the restore drill each semester are HVL's.
- **Alternatives considered:** (a) A compiled server (a bundle or `tsc` output): every path anchor reworked, to save
  the in-memory compile at start-up. (b) Debian's Chromium package: the distribution's security updates, but its
  DevTools protocol can drift from playwright-core 1.56.1. (c) Our own clamd client instead of Lumi's scanner: no new
  dependency and explicit failure handling, but a `SPEC-DEVIATION` from `SEC-006`, which names the package; a wrapper
  gives the same handling. (d) The editor's files on the files origin at once: that needs a grant model for the
  editor's cookie-authenticated requests, while the player is where learners meet uploaded files.
- **Consequences:** Limitation 13 closes when this is built. The runtime dependency changes (`tsx` moved,
  `@lumieducation/h5p-clamav-scanner` 10.0.4 with `clamscan` and `ts-deepmerge`) pass `check:pins`, `check:licences`
  and `check:audit`.
  Until the editor's file route moves, `SEC-004`'s "in production, content files are served from a separate origin"
  holds for the player only: a `SPEC-DEVIATION` for the editor route (marked `SPEC-DEVIATION: D-110`), mitigated
  because every file keeps `nosniff`, the sandbox CSP and `attachment` for all but media (D-045). If Docker does not
  run here, the image and compose files are written here and GitHub CI runs them (D-113). HVL decides the runtime (a
  Docker host, Kubernetes or OpenShift), the sandbox settings, DNS and certificates (Q5).
- **Amendment (2026-10-30, probe P3):** Docker works here (Docker 29.8.2 with BuildKit and compose 5.6.0: builds with
  network steps, compose with health checks, and Chromium's sandbox as a non-root user), and a second agent re-ran
  every decisive step. So one `Dockerfile` and one smoke script run both here and in GitHub CI, and the fallback
  above ("written here, and GitHub CI runs them") is not needed. What changes:
  - **Base:** the builder and runtime stages start from
    `ubuntu:24.04@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852`, with Node 24 copied from
    `node:24-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c`
    (`/usr/local/bin/node` and `/usr/local/lib/node_modules`, with links for `npm` and `npx`). That digest holds
    v24.22.2, this host v24.22.1 and `.nvmrc` says `24`: the digest decides. Ubuntu, because apt works here only from
    `archive.ubuntu.com` (`deb.debian.org` is refused), playwright-core 1.56.1's `install-deps` targets it, CI runs
    `ubuntu-24.04`, and its `libssl3` makes Prisma 7.10.1 install its OpenSSL 3 schema engine. Not used: Debian slim
    (no libssl, so Prisma falls back to its OpenSSL 1.1 engine with a warning, and apt cannot fix that here), Alpine,
    and `mcr.microsoft.com/playwright:v1.56.1-noble` (Node 22.20.0, root, 3.68 GB).
  - **Build:** `npm ci` runs on the Ubuntu builder, with install scripts (the `@prisma/engines` postinstall fetches
    the schema engine from `binaries.prisma.sh`) and with the root `package.json`, whose `allowScripts` names
    `prisma`, `@prisma/engines` and `esbuild` at their pinned versions, so a bump of one changes `allowScripts` in the
    same commit. Network steps use the bridge network. The agent proxy's CA reaches them only as an optional BuildKit
    secret (`RUN --mount=type=secret,id=proxy_ca,required=false`, which sets `NODE_EXTRA_CA_CERTS` only when the
    file exists), passed here and never in CI; it never enters a layer (checked with `docker history`). apt uses plain
    HTTP and needs no CA. Not used: `--network host` with proxy build arguments, which breaks apt (the agent proxy
    answers 405 to plain HTTP).
  - **Egress:** a build fetches only from Ubuntu's archive (`archive.ubuntu.com`, `security.ubuntu.com`),
    `registry.npmjs.org` (every package in the lockfile resolves there) and `binaries.prisma.sh`, and in CI from
    Playwright's download host for Chromium. It never
    fetches GitHub repository content: GitHub is gated per repository for this session, `raw.githubusercontent.com`
    answering is not a sanctioned route, and testing GitHub from inside a container was refused as a containment
    escape. So the H5P core and editor, fetched and hash-checked on the host by `npm run h5p:fetch-core` (D-027), and
    the content-type bundle above come into the build as build contexts, and their hashes are checked again there;
    this replaces "fetches H5P core and editor" under **Image**. The owner is asked to confirm the bridge network's
    direct egress (Q21).
  - **Chromium:** full Chromium (`chromium-1194`, about 597 MB), not the headless shell (about 323 MB):
    `SharedChromium`'s default `chromium.executablePath()` finds it, so no new setting is needed, and the image runs
    the binary the tests run (D-065). The browsers come from a stage `pwbrowsers` (`FROM scratch`), filled in CI by
    `npx playwright-core@1.56.1 install chromium` and replaced here by `--build-context pwbrowsers=/opt/pw-browsers`,
    since Playwright's download hosts are refused here. The host's `headless_shell` is never copied: it is a shell
    wrapper with an absolute path. The host's `chrome` binary changed after its install marker, so the smoke prints
    `chrome --version` and the binary's SHA-256, and an image built here can be compared with CI's.
  - **Sandbox:** the app runs as a non-root user (uid 10001), `PDF_ALLOW_NO_SANDBOX` stays unset (D-096), and the app
    service gets `security_opt: ['seccomp=<file>']` with Playwright's v1.56.1 seccomp profile vendored in the
    repository (`utils/docker/seccomp_profile.json` at tag `v1.56.1`, 12 997 bytes, SHA-256
    `cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849`, Apache-2.0), with its source in a README
    beside it and a test of the hash. It is taken from that tag through `git`, the route D-027 and D-078 use, and
    checked against the hash; P3's copy came over `raw.githubusercontent.com` (see **Egress**) and is not committed.
    Under Docker's default profile Chromium stops with "No usable sandbox!", as root it refuses its sandbox, and
    `seccomp=unconfined` or `SYS_ADMIN` work but allow far more. This replaces
    "unprivileged user namespaces or a seccomp profile" under **Image**. Whether HVL's runtime allows a custom seccomp
    profile joins Q5; if it does not, PDF export needs a renderer container of its own, never `--no-sandbox`. CI keeps
    its `kernel.apparmor_restrict_unprivileged_userns=0` step before the container smoke; whether AppArmor needs more
    there cannot be tested here.
  - **Fonts:** `install-deps chromium`, and `fonts-dejavu-core` named so the image does not depend on what
    `install-deps` brings; Chromium picks Liberation Sans, which embeds æ, ø and å. The smoke checks one PDF with
    `pdftotext` (the æ, ø and å text), `pdffonts` (embedded subsets), `pdfinfo` (tagged, A4) and the launch log (no
    "No usable sandbox", no `--no-sandbox`); poppler-utils run on the host or in CI, never in the image.
  - **Compose:** the app's stack (the app, the migrate and seed steps, and its own PostgreSQL 16, Redis 7 and S3
    emulator) is a separate compose file with its own project name, not a profile `app` in `docker-compose.yml`:
    that file's services have no profile, so they start with any profile, and they publish 5432, 6379 and 5000, which
    the native services hold here ("address already in use", observed). The new file publishes only the app, on
    127.0.0.1, reaches the other containers by service name, and pins every image by digest; `docker-compose.yml`
    keeps the test services for `docker compose up -d` (D-023), and it and CI's service containers take the same
    digests. `SPEC-DEVIATION` from
    `NFR-007`, the file name only: the app's local and staging stack is not in `docker-compose.yml`.
  - **Docker Hub through a mirror here:** the anonymous pull quota counts per address of a rotating egress pool and
    was used up on two of three addresses, so this sandbox's `dockerd` runs with
    `--registry-mirror=https://mirror.gcr.io`, which serves the same digests. Dockerfiles and compose files keep plain
    `docker.io` names pinned by digest, and scripts resolve images only through the daemon (`docker pull`,
    `docker build`), never with client-side registry calls (`docker buildx imagetools inspect`,
    `docker manifest inspect`), which bypass the mirror. CI needs no mirror.
  - **`dockerd` here:** it does not persist (PID 1 is Firecracker's `process_api`, with no systemd), so it is
    started by hand with the mirror flag. The smoke script starts no daemon: it checks `docker info` and stops with
    that instruction. The sandbox's extras (the CA secret and the browser build context) are passed only when
    `HVLI_DOCKER_SANDBOX=1` is set, never because a path exists, so CI cannot pick them up by accident.
  - **Disk:** the image is about 2.2 GB, an `npm ci` stage about 1.7 GB and the build cache up to about 6 GB, against
    about 17 GB free here at rest (the probes reached 92 % use). The smoke script prints the free space before and
    after, ends with `docker compose down -v`, removes its own image tags and prunes only its own build cache (its
    own buildx builder), never `docker builder prune -af` or `docker system prune`, which would remove other sessions'
    cache. The stopped `hvli-pg`, `hvli-redis` and `hvli-s3` containers and their volumes (2026-10-21) are left to
    the owner.
  - **Load test (`NFR-001`, D-114):** k6, as
    `grafana/k6:2.3.0@sha256:2dd4756ec6e14e62778916e1eb850108e4b499304c02df56760fa0bdb0fba0b8` (AGPL-3.0, a separate
    program outside the npm tree), observed working against a local target on the host and bridge networks (p95
    about 4 ms, no failed requests). Not Artillery: 2.0.34 adds about 463 MB and a second Playwright (1.62.1 beside
    the pinned 1.56.1), and its floating ranges already broke 2.0.30 ("Cannot find module
    '@smithy/node-config-provider'"). 2.3.0 rather than the 1.x line, because the scripts are new and it is the
    version tested; the image rather than the release binary, so one pinned digest serves here and in CI.
- **Amendment (2026-11-05, step 6: the files origin, `SEC-004`):** decided before the code; it settles what
  **Files origin** above leaves open.
  - **Setting:** `FILES_BASE_URL`, an origin. Unset, it is `files.<host>` of `PUBLIC_BASE_URL` with the same scheme
    and port, so development gets `http://files.localhost:3000` (Chromium and Firefox resolve every `*.localhost`
    name to the loopback, RFC 6761 §6.3; Node does not, so server tests name the files host in the `Host` header). A
    `PUBLIC_BASE_URL` whose host is an IP address has no `files.` name, so `FILES_BASE_URL` must then be set. In every
    environment the files host must differ from the app's host: a second port on the same host is refused, because
    a browser sends a host's cookies to all its ports (RFC 6265 §8.5). Production also requires https. The start
    stops with a message that names the variable, never its value.
  - **One process, two host names:** the server tells the origins apart by the request's host (`req.hostname`, so
    `X-Forwarded-Host` counts only behind `TRUST_PROXY`). A request for the files host goes to a files-only router
    right after the request log and the base headers, before the portal session, LTI, Feide, `/api`, `/h5p` and the
    web app, so nothing there reads a cookie, an ltik or a session, and nothing sets one. HVL's reverse proxy sends
    both names to the same upstream and passes `Host` on (deployment checklist). Not chosen: a second listener, which
    needs a second port in every deployment and gains nothing, since the files router reads no credential.
  - **What the files origin serves:** only `GET` and `HEAD /h5p/files/<grant>/<contentId>/<file>` with a player
    grant (purpose `content-file-url`, issued by the player render after the View check, D-058), and `OPTIONS` for a
    CORS preflight of those; everything else is 404. Every answer, refusals included, carries D-045's `nosniff` and
    sandbox policy, and files keep `attachment` for all but media and `Cache-Control: private`. Answers allow the app
    origin by CORS (`Access-Control-Allow-Origin: <PUBLIC_BASE_URL>`, never credentials), and the player's
    integration sets H5P's `crossorigin: 'anonymous'`: H5P then loads content files in CORS mode (`H5P.setSource`),
    and H5P.Video's captions (`<track>`), which a browser refuses from another origin without CORS, keep working.
  - **The app origin** no longer answers a player grant: `/h5p/files/…` there is 404 whatever the grant, with no
    redirect (every player render issues new URLs, and a redirect would make the app origin answer for grants and
    copy them into `Location`).
  - **The editor stays on the app origin**, as decided above, with a grant of its own: saved files at
    `/h5p/editor-files/<grant>/<contentId>/<file>` under a new purpose `editor-file-url`, issued only by the editor
    render after the Edit check, and fresh uploads at `/h5p/uploads/…` as before (D-069). A player grant opens nothing
    on the app origin, and an editor grant nothing on the files origin. Why the editor waits: H5P's image editor
    (`scripts/h5peditor-image-popup.js`, `libs/cropper.js`) draws a saved image into a canvas without `crossorigin`
    and exports it with `toBlob`, which a cross-origin image would refuse, so cropping and rotating would break. The
    code marks this `SPEC-DEVIATION: D-110`; it is mitigated by D-045's headers and because only people who may edit
    the activity get these URLs. The cookie-authenticated `/h5p/content/:id/*file` and `/h5p/temp-files/*file` stay
    (H5P's fallback when an integration names no `contentUrl`, e.g. a pasted file from another activity).
  - **Page policy:** the player pages (portal and Canvas) name the files origin in `img-src` and `media-src` only;
    the editor page's policy does not name it.
  - **Lifetime and scope of a URL:** D-058's grant lifetime stays (12 to 13 hours): a player page fetches files long
    after it opened (InteractiveBook chapters, video seeking), so a shorter grant would break long sessions. A grant
    opens the registered files of one activity, never another activity's: H5P appends each file's path to one
    `contentUrl`, so a grant per file would mean patching H5P Core.
  - **Tests:** the `DATA-011` helper counts the configured files origin as first-party. Test beds that serve the H5P
    router alone on one loopback server (`httpTestbed`) keep relative file URLs and mount the player's file route
    themselves; the app test bed, the e2e set and the accessibility suite run the real split on `files.localhost`.
  - **Residual:** `files.<host>` is the same site as the app; a separate registrable domain (HVL's choice, Q5) would
    also keep `SameSite` cookies set with a `Domain` away from file requests (see **Files origin** above).
- **Amendment (2026-11-05, step 6: the image, the app stack and its smoke test, `NFR-007`, `MAPPE-004`):** decided
  before the code, after the P3 amendment; what the smoke test measures is added at the end of this block.
  - **Files:** `deploy/Dockerfile` (with `deploy/Dockerfile.dockerignore`), `deploy/compose.app.yml`,
    `deploy/seccomp/`, `deploy/smoke/` (the smoke script), `tools/h5p-bundle/` (the content-type bundle) and
    `.github/workflows/docker.yml`, apart from `ci.yml`. The runbook is `docs/ops/docker.md`.
  - **Stages:** `node` (only the source of `/usr/local/bin/node` and npm), `base` (the Ubuntu digest with Node copied
    in), `deps` (`npm ci` with install scripts and the optional CA secret), `build` (`prisma generate` and
    `npm run build`: tokens, theme, web app), `prod-deps`, `pwbrowsers-download` and `pwbrowsers` (P3), the empty
    stages `h5pcore` and `h5pbundle` that the build contexts of the same names replace, `inputs` (their checks) and
    `runtime`. Only `runtime` is tagged.
  - **Runtime dependencies (narrows **Runtime** for now):** `prod-deps` is the `npm ci` tree after
    `npm prune --omit=dev`, plus `tsx` and the packages it needs, taken from the same tree before the prune
    (`npm query '#tsx, #tsx *'`), because `tsx` is still a development dependency of the repository root. Moving it to
    `apps/server`'s dependencies, as **Runtime** decides, is a change to shared files left to the integrator; the copy
    is then a no-op. `prisma` stays in the pruned tree as `@prisma/client`'s optional peer (`devOptional` in the
    lockfile), so the migrate step runs `prisma migrate deploy` from the same image, with the OpenSSL 3 schema engine
    the Ubuntu `deps` stage installed. The build fails if `tsx`, `prisma` or `playwright-core` is missing after it.
  - **Runtime image:** H5P core and editor and the bundle are copied only from `inputs`, after their checks. Chromium
    `chromium-1194` lives in `/ms-playwright` (`PLAYWRIGHT_BROWSERS_PATH`), with `install-deps chromium`,
    `fonts-dejavu-core` and `tini` from Ubuntu's archive; poppler stays out. The code is owned by root and read-only to
    the app's user `hvli` (uid and gid 10001), who owns only the H5P library folder (a volume). `tini` is PID 1, so
    Chromium's exited children are reaped, and the command is `node --import tsx src/server/main.ts`, not npm, so
    `SIGTERM` reaches the server's own shutdown. `NODE_ENV=production` and `WEB_APP=prod` are the image's defaults.
  - **Content types (narrows **Content types** and the P3 **Egress** point):** `tools/h5p-bundle` builds the bundle
    from `apps/server/var/h5p-real/packages` (or another folder) into a folder of its own: exactly the ten types'
    packages, each matching the fetch's `SHA256SUMS` (a changed, missing or extra file is refused), copied with a
    `SHA256SUMS` the build stage `inputs` checks again and the seeder a third time. **SECURITY:** it also refuses a
    package that carries an environment variable whose name says secret (`TOKEN`, `SECRET`, `PASSWORD`, `API_KEY`,
    `ACCESS_KEY`, `PRIVATE_KEY`, `CREDENTIAL`) with a value, and names the package, the file and the variable, never
    the value. Found while building it: the build of two H5P libraries wrote values from the build machine's
    environment into JavaScript the player sends to learners (reported upstream privately; D-112 and its amendment
    of 2026-11-13). The fix here belongs to D-078's tools (build every library with a minimal environment).
    Until the packages are reproducible across machines, which this also prevents, the SHA-256 list **kept in the
    repository** waits: the bundle carries the list its builder wrote after these checks, and the GitHub workflow
    fetches the libraries with a scrubbed environment (`env -i` with `PATH` and `HOME`) and a cache key of its own.
  - **Seccomp profile:** `deploy/seccomp/playwright-v1.56.1.seccomp`, fetched with `git` from
    `https://github.com/microsoft/playwright` tag `v1.56.1` (commit `54c711571a37de525377e6f3d3608c3e029b1829`),
    file `utils/docker/seccomp_profile.json`, byte for byte (12 997 bytes, SHA-256 as in the P3 amendment). The file
    name has no `.json`, so no formatter rewrites it; `deploy/seccomp/README.md` names the source, and a test checks
    the hash and that `clone`, `setns` and `unshare` are allowed.
  - **The app stack (`deploy/compose.app.yml`, project `hvli-app`):** PostgreSQL 16, Redis 7 and moto 5.1.16 by
    digest, no published ports; one-off services `buckets` (creates the two buckets in moto), `migrate` and `seed`
    (from the bundle, into the library volume); then `app`, on `127.0.0.1` only, with the seccomp profile,
    `no-new-privileges`, every capability dropped but `SYS_CHROOT` (see *Measured* below), a read-only root file
    system and `tmpfs` for `/tmp`, the user's home and Next.js's cache. The keys and secrets come from the environment and are never in the file; the smoke script makes random
    throwaway ones. This stack is local: it sets `NODE_ENV=development`, because the production checks rightly
    refuse its plain-HTTP database, Redis, S3 and public URL; staging sets `production` with TLS endpoints and D-109's
    two database URLs (runbook). Its public URL is `http://localhost:<port>`, so the files origin is
    `files.localhost` (amendment above).
  - **The smoke script (`deploy/smoke/dockerSmoke.sh`):** prints the free disk space; builds with its own buildx
    builder (`docker-container` driver, `moby/buildkit:v0.33.1` by digest) and `--load`s the image; brings the stack
    up with `up --wait`; checks `/healthz`, the migration and a seeded content type (its library folder and audit
    row); renders a sample mappe through `mappeHtml` and the real `PdfRenderer` inside the app container with the
    sandbox on (the probe below), and checks the PDF on the host with `pdftotext` (`æ ø å Æ Ø Å`), `pdffonts` (every
    font embedded) and `pdfinfo` (`Tagged: yes`, A4); prints `chrome --version` and the binary's SHA-256; then
    `down -v`, removes its image tags and removes its builder with that builder's cache. A BuildKit container resolves
    images itself, not through the daemon, so with `HVLI_DOCKER_SANDBOX=1` the builder gets the mirror and the proxy's
    CA in its own configuration (refines the P3 **Docker Hub** point); the CA secret and the `pwbrowsers` context are
    passed under the same flag, never because a path exists.
  - **PDF availability probe (`MAPPE-004`):** `apps/server/src/learningDesign/mappe/pdf/pdfAvailability.ts` starts
    Chromium with the export's own launch options, opens one offline context and page with JavaScript off, closes
    it, and logs one line with `pdfAvailable`, `pdfSandbox` and a reason code (`ok`, `sandbox-off`, `no-browser`,
    `no-usable-sandbox`, `root-without-no-sandbox`, `launch-timeout`, `launch-failed`, `page-failed`), never an error
    text or path; it never throws. `pdfCheckCli.ts` beside it runs the probe and prints one sample PDF for the smoke.
    Calling the probe once after the server listens is a line in `main.ts`, left to the integrator.
  - **GitHub workflow (`docker.yml`):** on pull requests and pushes to `main`: `npm ci`, `h5p:fetch-core`, the
    scrubbed library fetch, the bundle, poppler-utils, the AppArmor step of `ci.yml`, then the same smoke script
    without the sandbox flag, so Chromium comes from Playwright's download host and images from Docker Hub.
  - *Measured here (2026-11-05, three runs on a snapshot of `5064a49` with this step's files, 4 vCPU):*
    - *Changes:* Chromium's namespace sandbox also needs `CAP_SYS_CHROOT` in the container's bounding set. With every
      capability dropped the launch fails (`Check failed: sys_chroot("/proc/self/fdinfo/") == 0`, after the
      namespaces are made), and with `--cap-drop ALL --cap-add SYS_CHROOT`, the seccomp profile,
      `no-new-privileges` and a read-only root it prints. So the app, and only the app, adds back `SYS_CHROOT`
      (`tools/deploy-check` refuses any other added capability), the probe reports that failure as
      `no-usable-sandbox`, and Q5 gains it: OpenShift's `restricted-v2` allows neither the profile nor the
      capability.
    - *Passed* (`HVLI_DOCKER_SANDBOX=1 bash deploy/smoke/dockerSmoke.sh`, 152 s with a cold builder): image build
      105 s, image 2 776 MB; `up --wait` with the one-off steps 24 s; `/healthz` `{"status":"ok"}`; 7 of 7
      migrations; 77 libraries and 77 seed audit rows from the 10 packages; the probe
      `{pdfAvailable: true, pdfSandbox: true, reason: "ok"}` as uid 10001; a 25 179-byte PDF with
      `æ ø å Æ Ø Å — Lærar, øving, årsplan.`, `LiberationSans-Bold` and `LiberationSerif` embedded as subsets,
      `Tagged: yes`, A4; Chromium 141.0.7390.37, SHA-256 of the host cache's `chrome`
      `dd794b4e31017bc184f872bb65f1d8e5a2986a896f09d559b903bd0eaf83144a` (CI's CDN copy to be compared). Free disk
      went from 16 GB to 8.2 GB at the peak and back to 16 GB; no container, volume, image tag or build cache of the
      run was left, and `moby/buildkit:v0.33.1` stays pulled for the next run.
    - *The bundle here* was built from packages repacked in the scratchpad after the two affected libraries were
      rebuilt with `env -i PATH HOME`; the older packages in `apps/server/var/h5p-real` that carry them are refused
      by the guard, as they should be.
    - *Fixed in D-078's tools (2026-11-05, the step-5 follow-ups):* `tools/h5p-libraries/libraryBuild.mjs` runs each
      library's `npm run build` with `PATH` (Node's own folder and the system folders), `HOME` (an empty folder of its
      own, made anew for each build) and `NODE_ENV=production` only, plus what npm itself sets for a script (`npm_*`,
      `INIT_CWD`, `NODE`, `COLOR`, `EDITOR`); `npm ci --ignore-scripts` keeps `PATH`, `HOME` and the proxy and CA
      variables it needs (`HTTPS_PROXY`, `NO_PROXY`, `NODE_EXTRA_CA_CERTS`, npm's `registry`, `cafile`, proxy and
      `userconfig` settings), which never reach the build; the stamp's `buildEnv` version makes every cached build
      rebuild in place (`git clean -ffdx` after `verifiedHead`, no new checkout), and `[H5P-003]` tests prove that a
      build sees no other variable. *Verified here:* the two rebuilt files now carry only npm's own variables and
      `PATH`, `HOME` and `NODE_ENV`; the other 21 builds
      came out byte for byte the same; the bundle guard accepted the new packages and refused the old ones; the local
      library storage was re-seeded from the new ones. *Residual for HVL:* every `.h5p` package, library folder or
      library storage built or seeded before this fix, on any machine or from a CI cache, carries that machine's
      environment: rebuild and re-seed it, and rotate any token it held.
    - *Follow-ups review (2026-11-05), decided before the code:* "npm's own script variables" were not all npm's own.
      npm exports every setting that is not its default as `npm_config_<name>`, also those read from the Node
      install's global `npmrc` (`<prefix>/etc/npmrc`), which an administrator may have given a proxy with its password
      (`https-proxy=http://user:password@…`). A probe here with a planted global `npmrc` found its value in the
      build's environment, so the affected libraries would have carried it. The build therefore also gets
      `npm_config_globalconfig`, naming a file in its own empty `HOME` that never exists, so no global `npmrc` is read;
      the user `npmrc` was already out of reach. The recipe becomes `buildEnv` 3, and an `[H5P-003]` test runs a build
      under a Node whose global `npmrc` holds a planted proxy password. npm's built-in `npmrc` inside its own install
      folder is still read; it is part of npm, not of the machine's settings. *Verified here:* without the setting
      that test fails on the planted password; a full fetch rebuilt the 23 builds in place in 137 s, and only the two
      affected files changed (`npm_config_globalconfig` now inside the build's `HOME`), with
      them the two packages that carry them; the bundle guard accepted these, and the local
      library storage was re-seeded from them.
    - *Skeptic review (2026-11-05), recorded with its fixes, before the final smoke runs:* three of the smoke test's
      proofs were weaker than this block says, and two static guards failed open. (1) The CA check read
      `docker history`, which shows instructions, never file contents; the smoke now searches **every file** of the
      image for the lines of the proxy CA bundle's own certificates (those that are not among the image's Node roots;
      a CA planted in a test image was found). (2) `pdfSandbox: true` only repeats the launch option; the smoke now
      also reads the kernel's view while a page renders (`deploy/smoke/sandboxProof.mjs`): every renderer must have a
      PID namespace of its own and Chromium's seccomp filter on top of the container's (measured here: 3 `NSpid`
      levels and 2 filters with the sandbox, 1 and 1 with `--no-sandbox`). (3) Nothing showed the built web app or H5P
      core served from the image; the smoke now fetches `/hjelp` (nn), one of its scripts and `/h5p/core/js/h5p.js`. A
      player page and a launch (**Compose** above) still need content and a platform, so they stay with the e2e
      suites. The guards: `tools/deploy-check` missed plural secret names (`PSEUDONYM_SECRETS` written in the compose
      file passed), a password in a URL other than `DATABASE_URL`, list-form `environment`, and `privileged`,
      `unconfined` or host namespaces on any service; the bundle guard missed this server's own key lists
      (`URL_SIGNING_KEYS`, `DATA_ENCRYPTION_KEYS`), `_KEY` and `_AUTH` names, single-quoted values and `…_URL` values
      with a password, and scanned only some text types. All of these are refused now, with tests. PRIVACY: only the
      stack turned off Prisma's usage report (`CHECKPOINT_DISABLE`); the image now sets it beside
      `NEXT_TELEMETRY_DISABLED`, so a staging run of the same image and its `prisma generate` do not report either.
- **Amendment (2026-11-05, step 6: ClamAV, `SEC-006`):** decided before the code; it settles what **ClamAV** above
  leaves open. Read in `@lumieducation/h5p-clamav-scanner` 10.0.4 and `clamscan` 2.4.0, and measured against
  `clamav/clamav:1.4@sha256:8ad6197396974726c35d017e50aaaaf4b91745726a04faec8480c203edd98052` (ClamAV 1.4.6 with
  signatures 28171 in the image), pulled through the mirror in 7 s:
  - *Found:* Lumi's `ClamAVScanner.create` merges `CLAMSCAN_*` and `CLAMDSCAN_*` over the options passed to it and
    asks clamd for its version before it returns. Neither Lumi's scanner nor `clamscan` turns every scan without a
    verdict into a refusal; the cases are in the private record (D-112's amendment of 2026-11-13). `clamscan`'s
    time-out is an idle time-out per socket, and by default it falls back to a local `clamdscan` or `clamscan` binary.
    ClamAV 1.4.6's `StreamMaxLength` is 100 MiB by default (measured; the 25 MB above is an older default); 30 MB and
    60 MB streams were scanned, and clamd refused a 110 MB stream. EICAR comes back as `Eicar-Test-Signature`.
  - *Adapter* (`apps/server/src/security/malware/`): we build `clamscan`'s client ourselves from our checked settings
    only (TCP or TLS to `CLAMAV_HOST`:`CLAMAV_PORT`, no local binary and no fallback to one, no connection test at
    start, never remove, quarantine or log files), and hand it to Lumi's `ClamAVScanner` through its constructor,
    which is private in TypeScript only (`UPSTREAM:`; `create` is not used, so the environment variables above are
    never read). Lumi's `scan` still turns the verdict into `MalwareFound`, `Clean` or `NotScanned`; a strict client
    between the two makes a missing verdict an error, so Lumi answers `NotScanned`. The scanner registered in
    `malwareScanners` (`FailClosedMalwareScanner`) refuses with our own `RejectedUploadError`:
    `upload.file.malwareFound` on a finding, `upload.file.scanUnavailable` on `NotScanned`, a thrown error or its own
    limit on the whole scan (`CLAMAV_TIMEOUT_MS`). Both are 400 with a translated message, which the H5P editor shows
    whatever the status. An empty file is clean without asking clamd. At most four scans run at once in one process,
    because a package import scans its files in parallel; the time limit counts the wait for a turn, and a turn ends
    only when `clamscan` has finished with its socket. `clamscan` 2.4.0 becomes an exact pin of its own (MIT, the
    version Lumi's `^2.4.0` resolves to) and `@types/clamscan` 2.4.1 a development one.
  - *Logs:* one `warn` line per refusal with a reason code (`malware-found` with the signature names, `unreachable`,
    `timeout`, `tls`, `connection-lost`, `size-limit`, `no-verdict`, `scanner-error`), never a file name, a path or
    text from clamd; one line at start says whether scanning is on. `clamscan` itself writes socket errors to stderr
    (`console.error`, Node's error text, no personal data; `UPSTREAM:`), and Lumi logs to its `debug` logger, which is
    silent unless `DEBUG=h5p:*` is set.
  - *Configuration:* `CLAMAV_HOST` (a host name or IP address), `CLAMAV_PORT` (3310), `CLAMAV_TIMEOUT_MS` (30 000;
    1 000 to 600 000) and `CLAMAV_TLS` (false). With no host there is no scanner: the default in development and
    tests. Production refuses to start without `CLAMAV_HOST` unless `CLAMAV_ALLOW_UNSCANNED_UPLOADS=true` says so
    (for a pilot without ClamAV, `docs/ops/clamav.md`; the start then logs a warning), and every environment refuses
    the two together, so the override can never be read as "let files through when clamd is down". Every environment
    refuses a `CLAMSCAN_*` or `CLAMDSCAN_*` variable by name, since nothing reads it. Production requires
    `CLAMAV_TLS=true` unless the host is the loopback (`localhost`, `127.0.0.0/8`, `::1`, e.g. a sidecar), because
    uploaded files would cross the network in clear text (`DATA-004`); clamd has no TLS of its own, so HVL puts a TLS
    proxy in front of it (runbook). Messages name variables, never values.
  - *Scope:* both upload paths, editor uploads (`H5PEditor.saveContentFile`) and package imports (`ContentStorer`),
    through `malwareScanners`, before a file is stored; the editor-upload route still runs the sanitisers first for
    their reasons, so an SVG is scanned after sanitising. Library files in a package are not scanned (admins only,
    D-004; the seed bundle is hash-checked). Signature updates (`freshclam`) and clamd's limits stay HVL's (runbook).
  - *Tests:* a fake clamd that speaks `INSTREAM` (EICAR found, clean, no verdict, an error reply, an answer that never
    comes, a closed port, TLS against a plain clamd), the configuration rules, and both upload paths over HTTP; one
    more test runs against a real clamd only when `CLAMAV_TEST_HOST` is set (run here with the image above and
    `freshclam` off, so `database.clamav.net` was not needed).
  - *Residual:* after a time-out, `clamscan`'s socket stays half-closed until clamd closes it (its `ReadTimeout`,
    120 s by default), so a hung clamd holds at most four connections, and uploads meanwhile are refused at the time
    limit. If clamd's host vanishes from the network instead, the kernel ends those connections only after its TCP
    retransmissions give up (about 15 minutes on Linux); uploads are refused, never let through, meanwhile.
  - *Skeptic review (2026-11-05), with its fixes:* no fail-open path was found. Both upload paths reach the scanner
    (production builds the editor only in `createH5pRuntime`; package imports use `ContentStorer`'s temporary-files
    path, which scans every referenced file before it is copied, and files the parameters do not reference are never
    stored); refusals leave no temporary file (the route's cleanup and `PackageImporter`'s `finally`). Measured with
    a TLS endpoint here: with `CLAMAV_TLS=true` an untrusted certificate and a certificate for another name are
    refused (`reason: "tls"`) and the endpoint receives no byte of the file; a trusted one is scanned. One test was
    missing: dropping the signature-name filter passed every test, so a fake clamd now answers a finding named like a
    person and a file, which must still be refused while the name stays out of the log. The `UPSTREAM:` mark for
    `clamscan`'s `console.error` (*Logs* above) is now in `clamdClient.ts`, and the runbook says that files stored
    while no scanner was configured are never scanned later, and that `DEBUG=h5p:*` makes Lumi log file paths.
- **Amendment (2026-11-05, step 6: backups, restore and the runbook, `NFR-002`):** decided before the code; it
  settles what **Backups and runbook** above leaves open. What the round-trip test measures is added at the end.
  - **Files:** `tools/ops/` (the CLI `backupCli.mjs` and its modules, with tests), the runbook
    `docs/ops/runbook.md` (lower case, as the other runbooks in `docs/ops/`; it replaces the planned `RUNBOOK.md`),
    and the deployment checklist as a section of that runbook rather than a file of its own, so the start, the
    settings and the checklist are read together. Root scripts: `ops:backup`, `ops:backup-verify`, `ops:restore`.
  - **What a backup holds:** the database as `pg_dump --format=custom` (every table, `_prisma_migrations` and the
    `analytics` views) and the objects of the content bucket (`S3_CONTENT_BUCKET`). Not the temporary bucket: its
    files are editor uploads not yet saved, with a 1-day lifecycle; after a restore nothing refers to them, and a
    30-day backup would keep them 30 times longer than the bucket does. Not the H5P library folder: the deployment's
    seed step installs the libraries again from the hash-checked bundle (the step-6 image amendment above); a
    library an administrator installed by hand needs that volume copied too (runbook).
  - **Format:** one folder `hvli-backup-<UTC yyyymmddThhmmssZ>` with `database.dump`, `objects/<sha256>` (each
    object stored once under its own hash, never under its key, so no key can name a path on restore),
    `MANIFEST.json` (format, time, the PostgreSQL major version, each table's row count, and each object's key,
    size, content type and SHA-256) and `SHA256SUMS` over every other file. It is written as a hidden
    `.hvli-backup-….partial` folder, renamed only when complete, and removed if the run fails. Folders are 0700 and
    files 0600.
  - **Exact counts:** the manifest's row counts are read from the dump itself (`pg_restore --data-only` to a
    stream, counting each table's `COPY` lines), so they describe exactly the snapshot `pg_dump` took, also while the
    server writes. Order: the database first, then the bucket, so an object added meanwhile is only an extra file;
    the restore reports `H5PContentFile` rows whose object is missing.
  - **Restore:** checks `SHA256SUMS` first (a changed, missing or extra file stops it and names the file), then
    refuses a target database that has any table or view in `public` or `analytics`, and a target bucket that holds
    any object, so it can never overwrite data; it then runs `pg_restore --no-owner --no-privileges --single-transaction
    --exit-on-error`, uploads the objects, and verifies: every table's count against the manifest, every object read
    back and hashed, and every content-file row's object present. It prints one JSON line and exits 1 on any
    difference. The grants come back with `db:roles -- grants` (D-109), as after a migration.
  - **Who runs it, with which role:** the same environment variables as the server (`DATABASE_URL`, the `S3_*`
    settings), so the CLI needs no settings of its own. A backup needs a role that can read every table, which
    `hvli_app` cannot (`_prisma_migrations`, D-109): it runs with the migration URL, or with a backup role holding
    `pg_read_all_data` if HVL's database administrator creates one (open for D-109's roles). A restore runs as
    `hvli_migrator` into a new database set up with `01-roles.sql`.
  - **SECURITY:** the password reaches `pg_dump`, `pg_restore` and `psql` only as `PGPASSWORD` in their own
    environment, which holds nothing else of the caller's, never in arguments, output or the manifest; a database or
    S3 endpoint not on the loopback needs TLS that checks the server (`sslmode=verify-full` or `verify-ca`, an
    `https` endpoint), as in production (`DATA-004`, D-109); `AWS_ENDPOINT_URL_S3` and `AWS_ENDPOINT_URL` are refused
    and the SDK's configured endpoints ignored, as in the server's client; the client tools and both servers must
    share one PostgreSQL major version (16), which the tool checks, because a newer `pg_dump`'s output can fail on an
    older server. Messages name a variable or a file, never a value.
  - **Retention:** after a successful backup, `--keep-days` (default 30, `NFR-002`) removes older complete backups
    in the same folder, recognised by their exact name, and nothing else.
  - **HVL's part (runbook):** the daily schedule, an encrypted copy outside the server (in the EEA, `DATA-004`), the
    restore drill each semester with its log, and the managed database's own backups where HVL uses one. A backup
    holds pseudonymised learner rows; while a year's pseudonym secret exists, that year's backups can still be linked
    to people (docs/ops/yearly-purge.md, step 4).
  - **Tests:** `tools/ops/test/` titled `[NFR-002]`: the round trip on the local services (a database migrated
    with the real migrations, seeded rows and objects, back up, wipe, restore, compare every table's count and an
    object's SHA-256), a tampered file refused, a non-empty target refused, and the connection and retention rules
    as unit tests. In CI it needs `pg_dump` and `pg_restore` 16 on the runner.
  - **What the round trip measures (2026-11-05, built):** `tools/ops/test/backupRoundTrip.test.mjs` migrates a
    database of its own with the real migrations (23 tables with `_prisma_migrations`), seeds six of them (250
    `XapiStatement` rows, 40 `H5PUserData` rows, content-file rows naming two objects, one of 300 KiB and one with
    æ, ø and å in its key), backs up through the CLI, drops and re-creates the database and the bucket, restores, and
    finds every table's count equal and the image's SHA-256 unchanged; a dump with one byte changed is refused by
    `verify` and `restore` alike ("database.dump has changed") and nothing is written; a second restore into the
    filled database is refused; and no run printed the password, a URL or an object key, also when the server refused
    a wrong password. Two mutations (the upload skipped; each `COPY` line counted twice) each fail the round trip.
    The whole drill of the runbook ran once by hand on role-managed databases: a source deployed as the migrate step
    does (`01-roles.sql`, `views-down`, `migrate deploy`, `grants`), backed up with the migration role's
    `sslmode=require&sslaccept=strict` URL (read as libpq's `verify-full`), restored as `hvli_migrator` into a new
    database set up with `01-roles.sql` and a new bucket (`"ok":true`, 23 tables, 0 differing), then `grants`:
    `hvli_migrator` owns every table and the view, `hvli_app` reads the rows, `hvli_analytics` reads its view.
    Added while building: a missing bucket is a named error (`S3_CONTENT_BUCKET names does not exist`), as is a
    missing PostgreSQL tool. The runbook is `docs/ops/runbook.md`, its section 9 the deployment checklist.
  - *Skeptic review (2026-11-05), with its fixes:* no row or object was lost, and no secret reached a dump, a
    manifest or the output; the round trip passes again. Found and fixed: (1) the restore's own checks were untested
    in the direction a drill depends on: with the table, object and content-file comparisons forced to 0 and the
    empty-bucket check removed, every test still passed. `tools/ops/test/backupRestoreChecks.test.mjs` now restores a
    copy whose manifest (its checksums made again) expects one more user, a larger object and no second object, and
    must report `tablesDiffering`, `objectsDiffering` and `contentFilesMissing` of 1 each, `"ok":false` and exit 1;
    and it refuses a bucket holding an object while the database is empty, writing no row. Each of the four
    mutations now fails a test. (2) A run stopped by SIGTERM, SIGKILL or a reboot left its hidden
    `.hvli-backup-<time>.partial` folder, with learner rows, for ever; a backup now also removes such a folder once
    it is a day old (`stalePartials`, counted in `removedExpired`), tested alone and through the CLI. (3) The runbook
    gave `db:roles`, `privacy:purge` and `privacy:dsr` as root scripts; they are the server's (`npm run db:roles` at
    the root fails with "Missing script"), so those steps now say "from `apps/server`". (4) The runbook's
    `DATA_ENCRYPTION_KEYS` rotation removed the old key 12 hours after step 2 (D-056, written before the grade jobs),
    but `GradeSyncJob.ltiSubEncrypted` keeps the key of the job's last result write until 30 days after the job
    stops (D-104), and a job whose key is gone fails as `subject-unreadable`; the runbook now says at least 31 days.
    D-056 and `apps/server/.env.example` still say 12 hours (for their owners). (5) The runbook's Redis row says what
    is lost with Redis (the sessions; the NRPS counts until the next launches). Residual: a content file deleted
    between the dump and the bucket copy is not in that backup, and the restore reports it as
    `contentFilesMissing` (runbook section 6, step 3).
- **Amendment (2026-11-05, step 6 integration):** decided before the integration's code; it settles what the five
  step-6 amendments above left to the integrator.
  - **Runtime (ends the image amendment's narrowing):** `tsx` 4.23.15 moves from the repository root's development
    dependencies to `apps/server`'s dependencies, as **Runtime** decides, so `npm ci --omit=dev` keeps it (Evaluator
    Guide limitation 13). The image's copy of `tsx`'s closure becomes a no-op and stays as a guard; the build still
    fails if `tsx` is missing.
  - **Start-up probe:** `startServer` (`apps/server/src/server/main.ts`) runs the PDF availability probe once after it
    listens, and its `stop()` waits for the probe before closing the clients, so no probe browser outlives a server,
    also where a test starts and stops one at once. The smoke test now requires that line with the sandbox
    (`"pdfAvailable":true,"pdfSandbox":true,"reason":"ok"`) instead of noting that it is missing.
  - **ClamAV in the app stack:** `deploy/compose.app.yml` gains `clamav`
    (`clamav/clamav:1.4@sha256:8ad6197396974726c35d017e50aaaaf4b91745726a04faec8480c203edd98052`, the ClamAV 1.4.6
    the ClamAV amendment measured), not published, with `freshclam` off (`CLAMAV_NO_FRESHCLAMD`): the stack is local,
    and the smoke needs only the image's own signatures; HVL runs its own clamd with signature updates
    (`docs/ops/clamav.md`). Every service built from the app image gets `CLAMAV_HOST=clamav` and `CLAMAV_PORT=3310`,
    and the app waits until clamd is healthy (the image's own `clamdcheck.sh`, checked every 5 s), so the stack scans
    as production does, without TLS, which only production requires off the loopback.
  - **The smoke proves an upload in the image (`SEC-006`, `SEC-004`):** `deploy/smoke/uploadProof.mjs` runs in the
    app container with the app's environment, builds the engine with `createH5pRuntime` as the server does, and
    uploads through the editor's own upload method (`saveContentFile`, which the AJAX route calls): the stack's clamd
    must refuse the EICAR test file as `upload.file.malwareFound`, with the scanner's `malware-found` log line, and a
    clean PNG must be stored after its scan. It saves a draft MultiChoice with that image as a fresh staff account
    with no person behind it, renders the player, and prints the player's file URL. On the host the smoke fetches
    that URL from the running app with the files host in `Host` (`files.localhost:<port>`): 200, the PNG's bytes,
    `Content-Security-Policy` with `sandbox`, `nosniff`, no `Set-Cookie`; the same path on the app's host answers
    404. The upload does not go through the HTTP route, because the stack has no Feide or LTI platform to log in
    with; the route is covered by `apps/server/test/http/malwareScan.int.test.ts` (fake clamd) and, in CI, by the
    real-clamd tests below. The grant in the URL is never printed. As a safety net, Lumi's own `upload-malware-found`
    answers with the scanner's translated message (`h5pErrorResponse.ts`), although our scanner refuses first;
    `upload.file.scanUnavailable` stays 400, since a 503 is a change for the owner of the HTTP errors.
  - **CI:** `ci.yml` gains a `clamav` service (the same digest, `freshclam` off) and `CLAMAV_TEST_HOST` and
    `CLAMAV_TEST_PORT`, so the real-clamd `[SEC-006]` tests (`realClamd.test.ts`) run on every push rather than only
    by hand; and the step `npm run a11y:report -- --check`, which D-079's amendment of 2026-11-05 makes part of the
    gate. Its cache comment names the build recipe (`buildEnv`, the image amendment's follow-ups).
  - **Key rotation:** the old `DATA_ENCRYPTION_KEYS` key now stays at least 31 days (D-056's amendment of today).
- **Amendment (2026-11-05, S6 step 7: hardening after step 6's security review):** decided before the changes; it
  settles the findings the review left open (PROGRESS, step 6, «Still open»).
  - **clamd's alerts are required (`SEC-006`).** clamd answers `OK` for a file it did not scan in full unless it is
    told otherwise. Measured with the ClamAV 1.4.6 image above, its signatures and nothing else changed: with the
    image's defaults every one of these was `OK`: a ZIP and a PDF that need a password to open, an office file of
    10 050 entries (over `MaxFiles`, 10 000; 75 s of clamd's time), one of ZIPs nested 20 deep (over `MaxRecursion`,
    17), one that unpacks to 450 MiB (over `MaxScanSize`, 400 MiB) and, with `MaxScanTime` set to 5 s, one of 9 000
    entries cut off after 5 s. With `AlertExceedsMax yes` and `AlertEncrypted yes` they were answered
    `Heuristics.Encrypted.Zip`, `Heuristics.Encrypted.PDF` and `Heuristics.Limits.Exceeded.MaxFiles`, `.MaxRecursion`,
    `.MaxScanSize` and `.MaxScanTime` (so `AlertExceedsMax` covers more limits than `clamd.conf`'s comment names), also
    with `HeuristicAlerts no`; the EICAR file, a clean text, a plain PDF, a PDF with only an owner password (it opens
    without one) and 60 MiB of random bytes were answered as before. Both settings become required wherever HVL runs
    clamd for this service (`AlertEncryptedArchive yes` with `AlertEncryptedDoc yes` may stand for
    `AlertEncrypted yes`), and `MaxScanTime` should be no higher than `CLAMAV_TIMEOUT_MS`, so that a scan the server has
    given up on also ends in clamd. The server cannot ask clamd for its settings, so this is a deployment checklist
    item ([runbook](ops/runbook.md) §9, [clamav.md](ops/clamav.md)). The stacks that start a clamd set both through the
    official image's `CLAMD_CONF_<option>` variables, which its entrypoint writes into `clamd.conf` (read in its
    `/init`; measured above): `deploy/compose.app.yml`'s `clamav` (the Docker smoke) and `ci.yml`'s `clamav` service.
  - **Accepted:** such files are refused as malware. The author sees `upload.file.malwareFound` (a password-protected
    PDF or an office file too large or too deeply nested to check), and the log line's `signatures` names the
    heuristic, so support can tell the cases apart. This includes a very long, ordinary PDF: `MaxFiles` also counts a
    PDF's streams, so a plain 4 MB PDF of 12 000 pages (one content stream each) was refused as
    `Heuristics.Limits.Exceeded.MaxFiles`, while 5 000 pages and the ordinary PDFs tried passed (measured by the
    step's review). Not chosen: mapping `Heuristics.*` names to a message of their own; the scanner wrapper treats
    every finding alike, and a heuristic name is clamd's to choose.
  - **Not closed by these settings:** the two settings do not make clamd see everything. What the measuring found
    beyond them is a security finding and went to the owner outside the repository (D-112's rule for security
    reports), with a proposed check of our own in the upload path.
  - **The root `docker-compose.yml` publishes on the loopback only.** It published PostgreSQL (with a fixed password),
    Redis (with none) and the S3 emulator on every interface, and runbook §8 runs those services on a production-like
    node for the full load test. Each port is now `127.0.0.1:<port>:<port>`. The development and test settings name
    `localhost` (`.env.example`, `ci.yml`, `.devcontainer/createS3Buckets.mjs`), and in the dev container
    docker-in-docker's daemon runs inside the container, so its loopback is the container's own. Node's clients try
    `127.0.0.1` when `localhost` also resolves to `::1` (Node 24's `autoSelectFamily`). Measured with a copy of the
    file on other ports: `pg`, `ioredis`, the S3 client and `.devcontainer/createS3Buckets.mjs` connect through
    `localhost`, a lookup that answers `::1` first ends on `127.0.0.1`, and the host's other address is refused.
    Every user and process on the host can still connect, so runbook §8 warns against running the file on a node that
    holds real data or serves users, and the deployment checklist (§9) says so. Not chosen: a variable for the bind
    address, which invites `0.0.0.0`; a developer who needs the services from another machine uses an SSH tunnel.
  - **A name the storage refuses is "not found" on the cookie route.** `/h5p/content/:id/*file` passed a NUL byte in
    the file name to PostgreSQL, which refused the query, so a signed-in person could cause a 500 and an error-level
    log line at will. `PrismaContentStorage`'s `requireFile` and `fileExists` now treat a name that
    `assertSafeObjectName` refuses as missing, before the database (`storableFileName.ts`, a predicate that
    `signedFileRoutes.ts`' own copy of the check can share later): no stored file can have such a name, because the
    store refuses it when it writes. Tests: `[SEC-004]` in `contentFiles.int.test.ts` (500 before the fix),
    `[H5P-004]` in `contentStorage.int.test.ts` and `storableFileName.test.ts`. Narrowing or retiring the cookie
    route itself stays open.
  - **`frame-ancestors 'none'` in the user-file policy.** `USER_FILE_CSP` becomes
    `sandbox; default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'`, so no page, ours or another
    site's, can frame a user file (`frame-ancestors` does not fall back to `default-src`). Nothing frames one: the
    player shows images with `<img>`, video and audio with `<video>` and `<audio>`, captions with `<track>`, and
    documents are downloads; the editor's image editor draws an `<img>` into a canvas; the web app frames only the
    player and editor pages. Of the 120 libraries D-078 fetches, only `H5P.IFrameEmbed` frames a content file (Column
    offers it); it is in none of the ten seed packages, so the editor does not offer it, and the HTML it would frame
    is refused by the allowlist (`SEC-002`). Should an administrator install it, its frames of content files are
    refused, as intended. A stricter superset of D-045's policy, so not a deviation from `SEC-004`.
  - **Smaller items:** `persist-credentials: false` on the checkout steps of `ci.yml` and `docker.yml`, since no
    later step pushes or fetches with the job's token (`git diff` reads only the work tree); runbook §6 keeps the
    local backup folder on an encrypted volume and restores from the authenticated off-server copy; `clamav.md` says
    that `clamscan` 2.4.0 sends no server name (SNI), so the TLS proxy must present the certificate for
    `CLAMAV_HOST` without one (D-112's amendment of today measured it). `upload.file.scanUnavailable` stays 400: a
    503 changes the shared error mapping (`h5pErrorResponse.ts`), which is not the upload route's.
- **Amendment (2026-11-06, the old library builds closed out):** checked by AI agents with counts only, never
  values. No build made before `buildEnv` 3 was ever committed, pushed in an image, uploaded as a CI artefact or
  sent. The last two old packages, in the agent's scratch folder, were deleted, and the bundle's own check found
  secret-named variables in none of the 260 affected files and packages left on the machine, apart from two
  deliberate canary reproductions. In the old builds, the variables named like GitHub, AWS and gcloud credentials
  held the cloud session's proxy placeholders, not credentials. Only codespaces created from
  `ccr-07f63266-6cere5` between 2026-10-30 17:02 and 2026-11-05 08:39 UTC could have built with the old recipe and
  their own real environment; the owner deleted those codespaces and had no Codespaces secrets. Two corrections to
  the residual above:
  - **Re-seeding does not replace an old build.** Lumi installs a library that is already there only when its patch
    version is higher (`LibraryManager.js`, `installFromDirectory`), so a library storage seeded before the fix
    needs the affected library folder (`npm run libraries:check` names it), or the whole library volume, deleted
    before it is seeded again. Library files may be cached publicly for a long time (`staticRoutes.ts`), so caches in
    front of a server that held an old build are purged too.
  - **Two ways in skip the bundle's secret scan.** `npm run seed:libraries` checks hashes only, and with no folder it
    seeds H5P Group's own Hub packages from `docs/reference/h5p-core-1.28-seed-packages/` (`seedCli.ts`); an admin's
    package import (`HvlH5PEditor.uploadPackage`) can install or patch libraries. Either could bring in a build
    made elsewhere, which we have not been able to check. The scan also misses some forms (a proxy URL with a
    password, lower-case names, unquoted values). Until the scan covers both ways in, production libraries come
    only from a bundle built in CI, and admins import no package that carries libraries.

- **Amendment (2026-11-06, follow-up: the build-secret scan on every way in, decided before the code):** it closes
  the two ways in and the blind spots that the amendment above names. Probed with names and counts only, never values.
  - **One set of rules, in the server, loaded by the bundle tool too.** The rules live in
    `apps/server/src/h5p/libraries/libraryBuildSecrets.ts`: pure functions over a file's text, with no import at all
    and only erasable TypeScript, so `tools/h5p-bundle/contentTypeBundle.mjs` imports the file by its relative path
    and Node 24 strips its types itself (Node 24.22.1 here prints no warning), while the server and its tests load it
    through `tsx` and Vitest. Each host keeps its own file reader: the bundle tool its yauzl loop over every text
    entry; the server `packageSecretScan.ts` (zip entries of library folders, through `zipEntryGuard`'s reader) and
    `installedLibraryScan.ts` (the files of an installed library folder). The image build's `inputs` stage then needs
    the one file next to the tool: `COPY apps/server/src/h5p/libraries/libraryBuildSecrets.ts
    apps/server/src/h5p/libraries/` (`Dockerfile.dockerignore` already lets `apps/server/src` through; the `deps`
    stage's `apps/server/package.json` makes it a module). Not chosen: a workspace package (a `package.json` in the
    `deps` stage, the lockfile, an exports map and two Dockerfile stages for about 180 lines); the rules in
    `tools/h5p-bundle` imported by the server (the runtime image and its `.dockerignore` leave `tools/` out, so the
    seed step in the image would break, and production code would depend on a tool folder); two copies with a parity
    test (they drift, and the test only finds it afterwards). A test keeps the file free of imports and runs
    `bundleCli.mjs` under plain Node, so a change that only Vitest or `tsx` could load fails in CI, not in the image
    build; another (`tools/h5p-bundle/test/imageInputsStage.test.mjs`) reads the `inputs` stage and fails until it
    copies every script its `RUN` line starts and every file they import by a relative path, this rules file too.
  - **What the rules find (`SECURITY:`; a finding names a variable or the kind of value, never the value):**
    (1) a secret-like name with a literal value. Upper-case names (environment style) match a secret word anywhere in
    the name, also joined to another word, as the old guard matched (`TOKEN`, `SECRET`, `PASSWORD`, `PASSWD`,
    `PASSPHRASE`, `CREDENTIAL`, `APIKEY`, `PRIVATEKEY`, `ACCESSKEY`: `PGPASSWORD`, `GITHUBTOKEN`, `CLIENTSECRET`),
    the whole words `JWT`, `BEARER` and `WEBHOOK`, and `KEY` or `KEYS` after `API`, `ACCESS`, `PRIVATE`, `SECRET`,
    `SIGNING`, `ENCRYPTION`, `MASTER` or `CLIENT`; and at the end after a prefix (`_AUTH`, `_PASS`, `_PAT`,
    `_COOKIE`, `_DSN`, and a weak `_KEY` or `_KEYS`), with a string, a template literal without `${…}` or a number;
    a weak ending only with a string, so `ENTER_KEY:13` stays a key code, and a bare `COOKIE` stays jQuery UI's date
    format. Lower-case and mixed-case names (`GhToken`, `gh_token`, `npm_config__authtoken`,
    `"npm_config_//registry.npmjs.org/:_authToken"`) match by their last word only, need a word before it, and only with a string or template: a single word such as `token` or
    `password:"Passord"` is ordinary code or an interface text. The value after a name is looked at, never consumed:
    a text that ends in `word:` (`"Score:"`, `"env:"`) right before an object would otherwise be read as a name whose
    value runs to the next quote and swallow the name after it. (2) A value that is a URL with a password
    (`https_proxy:"http://user:pw@proxy:3128"`; after the first `:` the password may hold more, as RFC 3986 allows,
    but never `/`, so a port is not one) under any name, or by its kind where it has none. (3) A value shaped
    like a well-known credential, under any name or none: GitHub, GitLab, npm, Slack and AWS access-key tokens,
    Google API keys, JSON Web Tokens and PEM private keys. (4) In an environment dump, every key that our minimal
    build environment (`buildEnv` 3) does not produce. Each rule also runs on the text with its escaped quotes undone,
    so JSON inside a string is scanned.
  - **The environment-dump allowlist.** A dump is a flat object literal whose values are all literals and which has a
    key starting with `npm_`, or both `PATH` and `HOME`. Allowed in it are exactly the 28 keys that `buildEnv` 3's
    build produces with npm 11 (Node 24.22.1), counted in `apps/server/var/h5p-real/packages` and
    `apps/server/var/h5p/libraries`: `COLOR`, `EDITOR`, `HOME`, `INIT_CWD`, `NODE`, `NODE_ENV`, `PATH`, `PWD`,
    `npm_command`, `npm_execpath`, `npm_lifecycle_event`, `npm_lifecycle_script`, `npm_node_execpath`,
    `npm_package_json`, `npm_package_name`, `npm_package_version` and twelve `npm_config_*` keys (`allow_scripts`,
    `cache`, `global_prefix`, `globalconfig`, `init_module`, `local_prefix`, `node_gyp`, `noproxy`, `npm_version`,
    `prefix`, `user_agent`, `userconfig`). Named exactly rather than as `npm_config_*`, since npm exports every
    setting under that prefix, a proxy with its password and a registry token too. Allowed keys still go through
    rules (2) and (3). `SECURITY:` the search for dumps is bounded: each `{` is parsed once, at most the 64 before a
    marker (`npm_*:`, `PATH:`, `HOME:`) are tried, and a pair parsed or a `{` tried costs one unit of a budget of a
    quarter of the text's length (plus 4096); a text that uses it up is a finding, `(too complex to scan)`, never
    skipped. The real packages use at most 0.3 % of it, and crafted texts of 1 MB take under 0.4 s (before, an
    object that never closed took time that grew with the square of its length: 72 KB took 5 s). The fixture test above that left `npm_package_name:"x"` alone keeps that key allowed, but its
    `token` and `password` keys are now findings, because they sit in a dump.
  - **Where it runs.** The bundle tool (`build`, `verify`) scans every text entry of a package, as before. The
    server scans the library folders of a package (every folder but `content/`) and leaves `content/` alone: content
    is the author's data and is never installed as code, and a programming course may well show `API_KEY: "…"`.
    `npm run seed:libraries` scans every package after the hash and archive checks and before the first install, so
    a finding installs nothing; the error names the package, the library folder, the file and the variables, and the
    command exits 1. After seeding it scans the installed library folder (`H5P_LIBRARY_DIR`) and fails, naming each
    library folder to delete, since Lumi keeps an installed library of the same patch version;
    `npm run libraries:check [-- <folder>]` runs that scan alone, without the database or Redis (a relative folder is
    read from `apps/server`, as `seed:libraries` reads its folder, wherever the command is typed). An administrator's
    package import (`HvlH5PEditor.uploadPackage`, only on the path that may install) scans before the audit rows and
    Lumi's install, and refuses with 400 and `upload.package.librarySecrets` (nn, nb, en), naming the library
    folders; the error carries its own message key, so `h5pErrorResponse.ts` maps it without a change. An author's
    import is not scanned: Lumi never installs an author's libraries, and `SEC-003` already refuses any that differ
    from the installed ones.
  - **Consequences.** The ten real packages and this machine's seeded library folder pass; the scan of the ten
    packages (22 MB zipped) takes a few seconds, and of the largest (CoursePresentation, 12.5 MB of text) about
    1.5 s, which an import of it adds. An npm that exports a new key, or an H5P Group package whose build dumped
    its environment, is refused with that key's name, and a text the dump search cannot finish within its budget as
    `(too complex to scan)`: fail closed, and the allowlist grows only after someone has
    checked the key carries nothing secret. A storage seeded before `buildEnv` 3 fails the seed step (the image's and
    `.devcontainer/setup.sh`'s too) until the library folder the check names, or the whole library volume, is
    deleted (runbook §2). The scan is a guard, not a licence: production libraries still come only from a bundle
    built in CI, and an administrator imports a package with libraries only to install a reviewed library.
- **Amendment (2026-11-06, follow-up: a clamd settings probe, decided before the code):** the review of today found
  that `AlertExceedsMax` and `AlertEncrypted`, required since step 7, are only a checklist item: a clamd without
  them answers "OK" after a partial scan, and the wrapper stores the file as clean. Measured today with the ClamAV
  1.4.6 image above, a strict clamd (both settings, as in `ci.yml`) and a lax one (neither, as a misconfigured HVL
  clamd would be): a ZIP with a password is `Heuristics.Encrypted.Zip` from the strict clamd and "OK" from the lax
  one; nested ZIPs are `Heuristics.Limits.Exceeded.MaxRecursion` and "OK"; a plain stream is "OK" from both. The
  server now proves the settings itself (`SEC-006`).
  - **What is sent.** Three streams, built in code (`clamdProbeStreams.ts`, `clamdProbeZip.ts`; no binary fixture):
    a ZIP whose one entry needs a password (ZIP's traditional encryption, as `zip -P` writes it; `unzip` opens it
    with the password, measured) for `AlertEncryptedArchive`; a one-page PDF with the standard security handler and
    keys the empty password does not open for `AlertEncryptedDoc`; and ZIPs nested 64 deep for `AlertExceedsMax`.
    A setting is proven only when its stream is answered `FOUND` with exactly its heuristic
    (`Heuristics.Encrypted.Zip`, `Heuristics.Encrypted.PDF`, `Heuristics.Limits.Exceeded.MaxRecursion`); "OK",
    another name or no verdict proves nothing. The PDF is a third stream because `AlertEncryptedArchive yes`
    alone (half of the pair `clamav.md` accepts in place of `AlertEncrypted yes`) passes the ZIP and answers "OK"
    for the PDF (measured, with `AlertEncryptedDoc no`). `AlertExceedsMax` is one switch for every limit (step 7
    measured `MaxFiles`, `MaxScanSize`, `MaxScanTime` and `MaxRecursion`), so `MaxRecursion`, the cheapest to reach
    (7.5 KB), proves it.
  - **A fresh nonce in every stream.** clamd answers a file it has already scanned clean from its cache, so a probe
    made of fixed bytes could be answered without being scanned (measured; the sequence is in the private record,
    D-112's amendment of 2026-11-13). So 16 random bytes, drawn for each probe run, go inside every stream: clamd has
    never seen any layer. The bytes are otherwise fixed, and the test pins each stream's SHA-256 for a nonce of zeros.
    The same cache also spoiled our first measurements of where the limit lies; with fresh streams, ZIPs nested 15
    deep are "OK" and 16 deep are reported at clamd's default `MaxRecursion 17`; with `MaxRecursion 31`, 29 and 30.
    The 64-deep probe therefore proves `AlertExceedsMax` while `MaxRecursion` is at most 65 (measured with 65 and
    66); `clamav.md` asks HVL to keep the default.
  - **When it runs.** Before the first scan of a server process, not at its start: `seed:libraries` and the other
    commands build the same H5P runtime, and the scanner contacts nobody at start (a clamd that is down then refuses
    uploads instead of stopping the server). Then again before a scan when the last result is 60 s old, and at once
    after a file's scan ended without a verdict (time-out, lost or refused connection, TLS, an error answer), since
    clamd may have restarted with other settings; a configuration change needs a clamd restart. A refusal before the
    file was sent does not make the probe forget: the probe's streams start first and have the same limit, so a scan
    that waits for a probe gets the probe's own reason. Concurrent scans wait for one probe; its three streams go
    through the same clamscan client (`scanStream`, which `isInfected` calls for a file over TCP, so the same
    connection, TLS and verdict parsing), each takes one of the four turns and has the `CLAMAV_TIMEOUT_MS` limit,
    and an upload's own time limit includes the wait. Not chosen: probing
    with every file (three more scans per file; a package import scans hundreds at once), only at start (the
    settings change with a restart), or a timer (it would scan while nobody uploads, and keep the process alive).
  - **Result and caching.** Proven, or not proven (a verdict that was not the heuristic): either is kept for 60 s,
    so a lax clamd costs three small scans a minute while uploads come, and a corrected clamd is used within a
    minute without restarting the server. The 60 s are measured on a monotonic clock (`performance.now()`), so a
    wall clock set back (an NTP step, a resumed VM) cannot keep a proof longer. No verdict for a probe stream is not
    kept: that upload is refused with the probe's reason (`unreachable`, `timeout`, `tls`, ...), as today, and the
    next upload probes again.
  - **Fail closed, and what operators see.** While not proven, every upload is refused with
    `upload.file.scanUnavailable` (400), the message for a scan without a verdict; no new locale key. Each refusal
    logs the usual `warn` line with `reason: "clamd-settings"`, a new reason code. When the result changes to "not
    proven" (or the unproven settings change), one `error` line:
    `{"reason":"clamd-settings","unproven":[{"setting":"AlertExceedsMax","answer":"OK"}]}` with the message
    `uploads are refused: clamd answers OK for files it cannot scan in full; set AlertEncrypted yes and
    AlertExceedsMax yes in clamd.conf and keep MaxRecursion at its default (docs/ops/clamav.md)`. When it changes to
    proven, one `info` line, `{"clamdSettings":"proven"}`. `answer` is "OK", a name shaped like a signature, or
    "other"; no file name, path or text from clamd is logged. A probe's `FOUND` never reaches `malware-found`: the
    probe reads the verdict itself and never goes through Lumi's scanner. clamd itself, however, logs each probe
    stream as a finding (three `FOUND` lines from the server's address within a second or two) and runs any
    `VirusEvent` for each (measured); `clamav.md` tells operators how to recognise them and to alert on the server's
    `malware-found` lines instead.
  - **Deploy time.** `deploy:check` reads files only, so it does not fit; the Docker smoke already fails when its
    clamd lacks the settings (the EICAR upload is then refused as `scanUnavailable`, not `malwareFound`). New:
    `src/security/malware/clamdCheckCli.ts`, which reads only `CLAMAV_*` and `LOG_LEVEL`, runs the same probe once,
    prints one JSON line (`clamdCheck`, `proven`, `reason`) and exits 0 only when proven. Its log lines and that
    summary go through one synchronous stdout destination, so the summary is always last (pino's default destination
    writes asynchronously, and its `flush()` does not wait for a write in flight: under load the summary came
    first). HVL runs it at deployment and after changing clamd (runbook §9). It needs a package script
    (`clamd:check`) and the runbook line, which the integrator adds.
  - **Tests.** The fake clamd (`test/support/fakeClamd.ts` with `fakeClamdHeuristics.ts`) answers the probe
    streams as clamd does, from their structure (an encrypted ZIP entry, a PDF with `/Encrypt`, ZIPs nested past
    15), strict by default and lax on request. The real-clamd tests
    run the probe against `CLAMAV_TEST_HOST`/`CLAMAV_TEST_PORT` (strict, proven) and, when `CLAMAV_TEST_LAX_PORT`
    names a clamd without the alerts on the same host, show that it is detected and the upload refused. `ci.yml`
    gains a second ClamAV service, the same image digest without the two settings, on port 3311, and
    `ciWorkflow.test.mjs` checks both services and the three `CLAMAV_TEST_*` variables, so CI cannot skip these
    tests silently. Further tests pin what review found unguarded: each probe run sends new bytes, a probe in flight
    is not joined after `forget`, the minute is monotonic, probe streams wait for one of the four turns, an upload's
    limit includes the probe, a probe answer without a verdict is `no-verdict` (not kept), and a file's own scan
    failure is the reason logged.
  - **Not proven by the probe** (stays on HVL's checklist, `clamav.md`): `StreamMaxLength`, `MaxFileSize` and
    `MaxScanSize` of at least 50M, `MaxScanTime`, `MaxFiles`, fresh signatures; that every clamd behind one
    `CLAMAV_HOST` (a load balancer) is set up alike, since each probe stream reaches whichever answers; and a clamd
    reconfigured and restarted between two probes is trusted for up to 60 s unless an upload failed meanwhile.

- **Amendment (2026-11-25, D-143):** waiting scans get the free turns person by person: a free turn goes to the
  author who has waited longest since their last turn (`security/malware/ScanTurns.ts`, `scanOwner.ts`). Four scans
  at once and the time limit that includes the wait stay as they are.

- **Amendment (2026-11-26, D-144):** three settings of the image and the stack. The runtime stage sets
  `TSX_DISABLE_CACHE=1`, so tsx keeps no translated code in `/tmp`. The seccomp profile is
  `deploy/seccomp/chromium-sandbox.seccomp`: Docker's default profile (Engine 29.9.2) with one rule added for
  Chromium's user namespaces, in place of Playwright's file, which is an older Docker default. The app's health
  check has a time limit of 3 seconds, an interval of 5 seconds, 3 retries and a start period of 120 seconds.

- **Amendment (2026-11-26, D-145):** the `deps` stage copies `.npmrc` with the lock file, so the image's `npm ci`
  stops at an install script that `allowScripts` does not name (`strict-allow-scripts=true`);
  `tools/deploy-check` requires the copy. The workflows name their actions by commit and the gate's service
  images by the digests of `deploy/compose.app.yml`.

### D-111 · An HVL language overlay in a library-storage wrapper; `H5P-010`'s guidance through it
- **Context:** S5's probe P1 found that many `nn` and `nb` defaults of the real libraries are English (MultiChoice,
  QuestionSet, InteractiveBook and BranchingScenario buttons and messages). Patterns set their own texts (D-084), but
  activities made in the editor stay English. PROGRESS suggested Lumi's `alterLibraryLanguageFile` hook; in 10.0.4,
  once that hook is set, `LibraryManager.getLanguageWithoutFallback` returns only `{ semantics }` for every library's
  language file, so the editor libraries lose their `libraryStrings`, the editor's own texts. `H5P-010` replaces the
  video upload field's description with `alterLibrarySemantics`, but the `language/nn.json` and `nb.json` of
  H5P.InteractiveVideo and H5P.Video override a description in the semantics, so that change alone never reaches a
  Norwegian author. D-046 already wraps the library storage for the nn → nb → en fallback.
- **Decision:** a design that step 7 builds.
  - **Mechanism:** a library-storage wrapper after D-046's. For `language/nn.json` and `language/nb.json` of a listed
    library version (major.minor), it sets the `default` (and, for `H5P-010`, the `description`) of each field an
    overlay entry names by its semantics path, on a copy, never on the cached object (D-046). Each entry also states
    the English text it translates; when a library update changes that text, the entry is skipped and
    `content:check` reports it, so a changed field never gets a stale translation.
  - **Scope:** learner-facing defaults in `nn` and `nb` for the ten types and the sub-content they usually hold (about
    60 texts per language). Editor labels and the editor's `libraryStrings` are outside S6.
  - **Texts:** in `content/`, under D-082's pipeline (loaded and checked at start-up and by `npm run content:check`),
    so that ALU and HVL's language advisers edit them without code. They are drafts until reviewed (Q2, Q17).
  - **`H5P-010`:** `alterLibrarySemantics` (composed with the DragQuestion filter) sets the English guidance, and the
    overlay the `nn` and `nb` guidance. HVL's Panopto host name and the guidance texts are for HVL and ALU to confirm
    (open, with Q17's review).
- **Alternatives considered:** (a) Lumi's `alterLibraryLanguageFile`: it breaks the editor's texts. (b) Editing the
  libraries' language files: that changes files fetched and pinned by hash (D-078). (c) Only upstream translations:
  right in the long run (D-112), but slow, and the pilot needs Norwegian now.
- **Consequences:** An extension of `H5P-008`, as D-046 was; spec 01 gets amendment notes on `H5P-008` and
  `H5P-010`, and PROGRESS's mention of the hook is corrected. Only new activities and fields left at their defaults
  change; existing activities keep the English they stored, and pattern texts still win. A few English texts come
  from library code, not language files (H5P.Video's "Video source is missing.", ImageHotspots' "Missing required
  background image"); D-086's missing-media check reports the empty slot to the author before publishing (an error
  that can be acknowledged, so it warns rather than blocks). Tests that pin English on purpose (probe P1's
  `ENGLISH_IN_NYNORSK`) change where the overlay reaches them.
- **Amendment (2026-11-05, S6 step 7: the overlay as built):**
  - **Files (`content/h5p-tekstar/`, with a README for ALU):** `library-texts.nn.yaml` and `library-texts.nb.yaml`,
    one per language because Nynorsk and Bokmål may have different reviewers; English needs none, since the
    libraries' own texts are English. Each names library versions (`H5P.Name major.minor`) and, per version,
    `defaults` and `labels` by semantics path, and `libraryStrings` by key; every entry gives `en`, the library's
    English text it translates, and the text in its own language (`nn` or `nb`). A path is the semantics field names
    joined by `.`, with `[]` after a list's name for its item (the list item field's own name is left out), so it is
    the path probe P1 reports. `video-guidance.yaml` holds `H5P-010`'s guidance once, in `nn`, `nb` and `en`, and
    the video fields it goes under. Every file has `status: draft` until HVL's language advisers and ALU review it
    (Q2, Q17). The texts are plain: `<` and `>` are refused, because the editor writes labels, descriptions and
    library strings into its page as HTML.
  - **Scope, widened:** besides the learner-facing defaults, an entry may give a field's `label`, so that a
    field the overlay translates is not labelled in English in the editor, and `libraryStrings`, the editor's own
    texts. The first are H5P.DragNBar 1.5's (the toolbar of CoursePresentation's and InteractiveVideo's editors),
    English in both `nn.json` and `nb.json`; its «Paste» was D-080's example of a name we could only copy. The
    drafts cover MultiChoice, QuestionSet, InteractiveBook and BranchingScenario first (probe P1), then
    InteractiveVideo, ImageHotspots and CoursePresentation and the question types the containers offer most
    (TrueFalse, MarkTheWords, SingleChoiceSet, Summary, Essay). A text that is already the Norwegian word («Pause»,
    «Video») or holds no words (`@score / @maxscore`) gets no entry. Labels are given for the first four types; the
    remaining English labels are for ALU to add.
  - **Mechanism:** `LanguageOverlayLibraryStorage` wraps D-046's storage in the editor and the player. For
    `language/nn.json` and `language/nb.json` of a listed version it parses the file Lumi would otherwise serve
    (for `nn`, nb.json when nn.json is missing, D-046; the English file when the library has neither), sets each
    entry on that copy, and keeps every other key, `libraryStrings` included. It resolves a path against the library's own
    `semantics.json`, because a language file's fields are positional, filling a missing position with `{}` (which
    H5P's deep merge ignores) and never with `null`. An entry whose path no longer resolves, or whose `en` is no
    longer the library's English text (`semantics.json` for defaults and labels, `language/en.json` or `.en.json`
    for library strings), is skipped, and a file where no entry applies is served as the library ships it. Every
    other read is passed through, so packages, exports and installs see the library as it is. The player reads no language file in Lumi 10.0.4; it is wrapped too, so that a later Lumi
    that does still gets the overlay.
  - **`H5P-010`:** the editor's `alterLibrarySemantics` is D-006's DragQuestion filter followed by the English
    guidance, set as the `description` of the listed fields (`H5P.InteractiveVideo 1.28`
    `interactiveVideo.video.files` and `H5P.Video 1.6` `sources`); the overlay sets the `nn` and `nb` guidance on the
    same fields. Neither library has an English language file that would hide the English guidance; `content:check`
    refuses a listed version that has one.
  - **Checks:** the server's start-up and `content:check` load the three files with D-082's loader (strict schema,
    every problem with file, line and key; the folder may be absent, as the mappe's may). `content:check`, which has
    the installed libraries, also refuses a version that is not installed, a path or a library string the library
    does not have, a default on a field that has none, a field that is not a video field under the guidance, and an
    `en` that is not the library's English text, so that a library update that changes a text is reported, not
    silently skipped.
  - **Loading:** `createH5pRuntime` takes the loaded texts; without them it loads `content/h5p-tekstar/` itself, so
    every engine the server, the seed command or a test builds has the overlay. The overlay never changes stored
    content: an activity keeps the texts it was saved with.
  - **Tests:** the wrapper and the path resolver (unit), `content:check` refusing a broken file and a stale or
    unknown entry, the editor's AJAX library data in `nb` with Norwegian defaults, labels and library strings and
    in `en` unchanged, the guidance in all three languages, and in the real player and editor
    (`languageOverlay.browser.int.test.ts`): a MultiChoice and a QuestionSet created in `nn` as the editor creates
    them, whose buttons a screen reader names in Nynorsk and whose QuestionSet says «Neste», «Resultat» and «Poeng»,
    and the editor in `nb` showing the overlay's labels (`[H5P-008]`, `[H5P-010]`). MultiChoice's visible «Sjekk»
    was already Nynorsk; its «Send inn» is stored but shown only where a platform marks an activity as submitted
    for scoring (H5P.Question's `isScoringEnabled` or `isReportingEnabled` in the content's data, which our player
    does not set). Probe P1's `ENGLISH_IN_NYNORSK` keeps only «Pause», and the editor repair test's copied
    DragNBar markup now reads «Lim inn».
- **Amendment (2026-11-05, S6 step 7 review):**
  - **No `"` in HVL's texts.** Libraries also put these texts into double-quoted HTML attributes (DragNBar 1.5
    builds `title="' + H5PEditor.t('H5P.DragNBar', 'moreElements') + '"`; CoursePresentation 1.28 builds
    `aria-label="'+this.cp.l10n.…+'"`), and the editor stores a default as it is, where it escapes what an author
    types (`h5peditor.js` sets defaults, `h5peditor-text.js` escapes input). So the `nn` and `nb` texts and the three
    guidance texts may not hold a straight double quote either (`SECURITY:`); «» is the Norwegian quotation mark the
    files already use. `en` may hold one, because H5P's own English labels do and `en` is only compared, never shown.
  - **Wording kept consistent with H5P's own Norwegian** in the same editor and player: MultiChoice's labels for
    assistive technology say «Beskriving» and «assisterande teknologi» (nb «Beskrivelse», «assisterende teknologi»),
    as Blanks and DragText say, not «Skildring» and «hjelpemiddel»; BranchingScenario's fullscreen name is
    «Fullskjerm» and CoursePresentation's slide menu heading «Sider», as their own texts and the `nb` files say
    elsewhere.
    InteractiveVideo 1.28's end-screen summary without a score gets an entry, because its `nn.json` has «and» in it
    and its `nb.json` lacks «og». Its summary *with* a score cannot be translated: the library passes
    `l10n.endCardTableRowSummary`, a key its semantics do not have, so its English default is always shown
    (`UPSTREAM:` H5P.InteractiveVideo, for D-112's owner and the UD-040 register).
  - **Test added:** every entry of the real files applies on the pinned libraries and every other value of the file
    H5P ships reaches the editor unchanged (`overlayKeepsShippedTexts.test.ts`).
  - **Correction:** H5P.DragNBar 1.5's `nb.json` already has 3 of its 13 strings in Bokmål («Transformer»,
    «Rediger», «Fjern»); the `nb` entries for them repeat H5P's words, so all 13 stay together for review.

### D-112 · Upstream reports drafted for the owner to file; Lumi stays at 10.0.4
- **Context:** D-081 left two items for S6: ask Lumi's maintainers for a release with their unreleased file-security
  work, or review and pin a Lumi commit built from source; and report our fixes and the D-080 barriers upstream.
  npm's newest `@lumieducation/h5p-server` is still 10.0.4 (2025-03-08), while the repository is active (R-09).
  Pinning a commit changes a CLAUDE.md invariant (`@lumieducation/h5p-server@10.0.4`); `check:pins` accepts only
  registry versions; the sanitiser, Redis-lock and ClamAV packages would have to move with it (`master` changed the
  malware-scanner interface); and it needs a review of about 620 commits in D-022's manner and the full gate. The
  `image-size` audit exceptions (D-030, R-08) expire on 2027-01-31, and only a Lumi version with `image-size` 2.0.3 or
  later removes their cause. Filing needs a GitHub account, and H5P's reporting channel per library must be checked
  *(verify)*.
- **Decision:**
  - **Lumi stays at 10.0.4 in S6.** No commit is pinned; our adapters and our own file security stay (D-003, D-081).
  - **Drafts the owner files:** `docs/upstream/` holds texts ready to file: a release request to Lumi naming the
    unreleased changes we need and the `image-size` advisories; Lumi issues for `deleteAllContentUserDataByUser`
    deleting the acting user's data (D-108), `alterLibraryLanguageFile` dropping `libraryStrings` (D-111), the ClamAV
    scanner's handling of a scan that failed (D-110; since the amendment of 2026-11-05 part of the private report),
    and Core 1.28 with the new Hub (the adapters of spec 01 §1); and
    H5P reports for the barriers in D-080's register (`upstreamRegister.ts`). The owner files them from an account of
    their choice; the agent files nothing. Each filed issue's link goes back into the register and into `UD-040`'s
    report.
  - **Before 2027-01-31,** HVL or the bachelor students choose one of: a Lumi release with a fixed `image-size`; a
    reviewed Lumi commit pinned by its own decision; or a reviewed renewal of the exception with a new expiry
    (`SEC-007`). Until then `check:audit` passes; after it, CI turns red, as designed.
- **Alternatives considered:** (a) Pinning a reviewed Lumi commit in S6: a long review of a security-relevant
  dependency, not possible before 1 November beside the MUSTs. (b) A probe build of `master` without switching: useful
  evidence, left to the students with the drafts. (c) The agent filing from the owner's account: the owner decides
  what is published under their name.
- **Consequences:** R-09 stays open, and the hand-off index (D-101) carries the expiry date and the three choices.
- **Amendment (2026-10-30, probe P1):** the drafts also hold an H5P report for QuestionSet 1.21, whose `resetTask`
  resets every `.h5p-progress-dot` in the document, so its «Prøv igjen» fails on a page with several sets
  (D-115, Q20).
- **Amendment (2026-11-05, S6 step 7: the drafts as written):** decided before the drafts.
  - **Where:** `docs/upstream/`, one file per report (the H5P accessibility reports one per library, in
    `docs/upstream/h5p-accessibility/`), and a README that lists every draft with its recipient, its channel and
    whether it is ready or needs the owner's check, and says where each filed link goes back. The drafts are in
    English, name our tests by file and title without links, and carry no personal data.
  - **Security reports stay out of the repository.** The repository is public on GitHub (checked 2026-11-05), so a
    private report committed here would be published before its vendor reads it. Two drafts are security reports: to
    H5P Group, about a fault in the build of two H5P libraries (D-110's amendment of 2026-11-05); and to Lumi, at the
    address in Lumi's `SECURITY.md` (`security@lumi.education`, read at `master` 493cd3e), about three findings in
    10.0.4. Their full text is handed to the owner outside the repository; the README names them by recipient and
    subject only. The owner sends them, to a security contact the owner has confirmed, never as a public issue first;
    a public issue or a copy in `docs/upstream/` follows only once the vendor has published a fix or agreed. (A last
    sentence here let earlier entries keep their public detail; the amendment of 2026-11-13 withdrew it.)
  - **Checked against upstream (2026-11-05, read-only shallow clones, nothing filed):** npm's newest
    `@lumieducation/h5p-server` is still 10.0.4. Lumi's `master` (493cd3e, 2026-10-13) still deletes the acting user's
    state in `deleteAllContentUserDataByUser` and keeps only `semantics` when `alterLibraryLanguageFile` is set; it
    fixes F1–F3 of spec 01 §1, changes how SVG uploads are handled, and depends on `probe-image-size` instead of
    `image-size`, so a release would also end D-030's audit exceptions. The findings of the two security reports were
    unchanged upstream on that date (the private record names the commits). QuestionSet's default branch (a961bac,
    1.21.14) still resets every progress dot in the document. `clamscan` 2.4.0 is still npm's newest; it opens TLS to
    clamd without a server name (SNI), which Node 24's `tls.connect` then does not send (measured), and writes socket
    errors to stderr without its debug mode.
  - **Reproduced without secrets (2026-11-05):** the build fault of the H5P report was reproduced with one made-up
    variable and no real secret, and a change to the libraries' build configuration removed it (the suggested fix; not
    played in a browser; the steps are in the private record). Against the installed Lumi 10.0.4: an identity
    `alterLibraryLanguageFile` drops `libraryStrings`; `deleteAllContentUserDataByUser('learner-1', operator)` asks
    the storage to delete the operator's state; the scanner finding of the Lumi report was reproduced as well.
  - **Scope, widened:** besides the drafts the Decision names, the README lists drafts for `clamscan` (SNI, stderr)
    and ltijs 7.0.7 (its launch page's unguarded `localStorage.removeItem`, D-050), a Lumi issue collecting small
    API and typing gaps that `UPSTREAM:` tags work around, and a Core 1.28 and new-Hub backport that is filed only if
    Lumi declines a release. `UPSTREAM:` tags that record how pinned upstream code works (D-080's V2D-5 amendment,
    (b)) get no report. Texts H5P lacks in `nn` and `nb` go, once HVL's language advisers have reviewed D-111's
    drafts, into pull requests to the libraries' language files, as H5P's contribution guide asks (`h5p/.github`,
    read at e979edf), not into issues. H5P's issues use its organisation's Bug Report form (title `[Bug]: `), which
    the H5P drafts follow; neither that guide nor the two libraries' repositories name a security contact.
  - **After filing:** the owner, or whoever edits the code next, puts each link where the README says: a register
    entry's `UPSTREAM:` comment (as its second link, which `npm run a11y:report` shows in `UD-040`'s report), the
    `UPSTREAM:` tag of a repair in `a11yRepairs.js` or `a11yEditorRepairs.js` in place of "no issue filed yet"
    (D-080's DOC-13 amendment), and the `UPSTREAM:` tags of the Lumi workarounds.
- **Amendment (2026-11-13, third-party security detail leaves the public text):** decided by the owner, before the
  edit.
  - **Why:** a review of the public documents found that the substance of the two private security reports could be
    rebuilt from this log and from documents that repeat it: where in the upstream code a weakness is, what triggers
    it, how to reproduce it and how to fix it. The amendment of 2026-11-05 had let the earlier public text stand. That
    sentence is withdrawn.
  - **Rule:** for a weakness in someone else's software that has no released fix, a public document names the
    component and its version, the class of weakness, and what our own control does. It does not say where in the
    upstream code the weakness is, which input triggers it, how to reproduce it or how to fix it. That detail is the
    private record, which the owner holds outside the repository with the report drafts.
  - **Done:** D-039, D-040, D-044, D-110 and this entry are reworded, and with them the passages that repeated the
    detail in `docs/upstream/` (the README and the release request), `docs/handoff/lumi-path.md`, `docs/ops/` (the
    runbook, `clamav.md`, `docker.md`), `docs/privacy/DPIA-INPUT.md` (R39), the assurance pack (`docs/assurance/`),
    two tool READMEs and `PROGRESS.md`. The assurance pack's line references into this file are corrected.
  - **Not done:** the code, its comments and its tests are unchanged by this amendment; whether any of them is
    reworded is decided together with later security work. Git history keeps the earlier text. The edit therefore
    lowers the exposure and does not end it: what ends it is a fix from each vendor, so the two reports are sent
    without waiting for anything else.
  - **Return:** once a vendor has published a fix or agreed, the detail of that finding may return to these entries,
    with the vendor's reference.

### D-113 · The S6 gate in full, run in parts; CI raised to S5; per-ID runs that select tests; a licence guard
- **Context:** S5's gate took about 5 hours here, in parts of under 2 hours (the limit of a background command), and
  its runs under full load found three timing faults. S6 adds more tests and the Docker steps. Since PR #8, GitHub
  runs CI on `main`; the push run 41075981429 on the merge failed one e2e test (`appPlayEditor.e2e`: its click on
  «Lagre» landed in H5P's editor iframe while H5P was still growing it, so no save was sent; reproducing it also found
  that «Lagre» was enabled before H5P's editor could save), fixed at the start of S6. CI checks
  traceability only through S4 (`--done-through=S4` in `ci.yml`, pinned by `ciWorkflow.test.mjs`). The per-ID runs
  for `NFR-003` and `UD-031` select no tests in the root Vitest project, because their tests are in the accessibility
  suite, and `check:licences` passed while a stray `node_modules/node_modules` link hid the workspaces and it counted
  1 production package instead of 482 (S5 open item 8). Some MUSTs can only be checked as documents here
  (`DATA-004`, `DATA-005`, `DATA-010`, `NFR-002`'s restore drill, `UD-040`), as with `UD-031` and `NFR-003` (D-079).
- **Decision:** The owner decided on 2026-10-30 that the gate keeps its full form.
  - **What it runs:** every S1–S5 gate command and per-ID run (Evaluator Guide §5), plus S6's: `-t "LTI-01"`,
    `-t "INS-0"`, `-t "DATA-0"` and `-t "NFR-00"`; each S6 ID alone;
    `npm run spec:trace -- --check --done-through=S6`; the Docker build and the compose smoke; the conformance report
    and the DPIA input (with `npm run a11y:report` regenerating the automated parts unchanged); and the running server
    showing the insight and grade-sync views. The Evaluator Guide's S6 row is rewritten in S5's manner.
  - **How:** in parts of under 2 hours, each a tracked background task whose output goes into PROGRESS; the hourly
    restart task stays on until the gate passes (D-101).
  - **IDs tested only in the accessibility suite** (`NFR-003`, `UD-031`, and any S6 ID whose tests are only there)
    run as `npm run test:a11y -- -t "\[<ID>\]"`, so no per-ID row selects zero tests.
  - **CI:** `--done-through=S5` now (with `ciWorkflow.test.mjs`), and `S6` once S6's gate passes.
  - **Licence guard:** `check:licences` fails when a workspace named in the root `workspaces`, or a runtime
    dependency declared in the root or a workspace manifest, is missing from the production set it checked; the
    expected set comes from the manifests, so no minimum count is needed.
  - **Evidence from CI:** a step this environment cannot run (the image with Chromium, the compose smoke, ClamAV) may
    cite GitHub CI's run on the gate commit by its run ID.
  - **Document checks:** tests that compare a document with its sources (for example, the DPIA input's custom fields
    with the developer key's) count as tested for `DATA-004`, `DATA-005`, `DATA-010`, `NFR-002` and `UD-040`, as
    D-079 decided for `UD-031` and `NFR-003`; the Evaluator Guide lists them as not verified until HVL acts.
  - **`NFR-001`:** a reduced-scale load smoke with the spec's p95 limits here; the 200-learner run on HVL's hardware
    stays open.
  - **Listed as open with the output:** Q2–Q8, Q13, Q15 and Q17, the confirmation against real Canvas, the
    200-learner load test, the manual assistive-technology run and the DPO's review.
- **Alternatives considered:** (a) Counting the S1–S5 per-ID evidence from one full run's reports, which would save
  about 3 hours a gate: the owner kept the full form. (b) A separate "documented" status in spec-trace: a second
  record of what PROGRESS tracks (D-079's reasoning).
- **Consequences:** Extends D-100's gate to S6 and amends the Evaluator Guide §5. The gate output says which parts
  ran where.
- **Amendment (2026-10-30, probes P1 and P3):** Q18–Q20 (D-115) and Q21 (D-110's P3 amendment) join the questions
  listed as open with the gate output. The image with Chromium and the compose smoke run here as well as in CI
  (D-110's P3 amendment), so the gate runs them here; **Evidence from CI** stays for a step that still cannot.

### D-114 · New development dependencies in S6
- **Context:** CLAUDE.md pins every dependency exactly, and D-029's checks allow only listed licences. `INS-006` asks
  for a `fast-check` property test. `NFR-001` asks for "a k6 or Artillery load test script in `tools/load/`" and
  Lighthouse CI on the player route. Here, k6's download host is refused and its container image needs Docker (probe
  P3).
- **Decision:**
  - `fast-check` (MIT; one dependency, `pure-rand`, MIT), a development dependency pinned exactly at the version
    current when it is added (4.10.2 on 2026-10-30).
  - **The load tool** is chosen in the operations probe and recorded here by amendment, with its exact version and
    licence: k6 as a pinned container image (AGPL-3.0, a separate program outside the npm tree), Artillery from npm
    (MPL-2.0, a large development tree), or a small harness of our own in Node, which departs from `NFR-001`'s "k6 or
    Artillery" and would make that amendment a `SPEC-DEVIATION`. Lighthouse CI (`@lhci/cli`, Apache-2.0), if the
    player timing uses it, is added the same way.

  Each passes `check:pins`, `check:licences` and `check:audit`. The runtime changes (`tsx`, the ClamAV scanner) are
  in D-110.
- **Alternatives considered:** Hand-written random cases for `INS-006`: no shrinking to a smallest failing dataset,
  and the spec names `fast-check`.
- **Consequences:** The property tests are titled `[INS-006]` and run in `npm test`; this is D-097's rule applied to
  S6.
- **Amendment (2026-10-30, probe P3):** the load tool is **k6**, the container image
  `grafana/k6:2.3.0@sha256:2dd4756ec6e14e62778916e1eb850108e4b499304c02df56760fa0bdb0fba0b8`, AGPL-3.0, run as a
  separate program outside the npm tree, so `check:pins`, `check:licences` and `check:audit` see nothing new. Its
  scripts are ours, in `tools/load/` as `NFR-001` asks, so this is no `SPEC-DEVIATION`. The reasons, and why not
  Artillery, are in D-110's P3 amendment.
- **Amendment (2026-11-05, step 6: the load harness, `NFR-001`):** decided before the code; what the smoke measures
  is added at the end of this block.
  - **Files:** `tools/load/` (the k6 scripts in `tools/load/k6/`, the runner `runLoad.mjs`, a README and tests) and
    the bench `apps/server/test/load/loadBench.ts`, which uses the test beds' code and so lives beside them. Root
    scripts: `load:smoke` and `load:full`.
  - **The server under load (the bench):** the server as `createApp` builds it in one Node process, so one
    application node (`NFR-001`), through the app test bed (the mock Canvas and Feide pointed at it), in a PostgreSQL
    database of its own that the bench creates, migrates and drops, so a run never adds rows to the shared
    development database; Redis and S3 are the local services. It installs the ten real content types from the D-078
    packages and publishes the QuestionSet example (four questions of three types: one of the larger player pages).
    It writes the mock Canvas's launch addresses for its learners to a file (addresses, no tokens), prints one ready
    line, and on `SIGTERM` prints the rows the load stored, then closes and drops its database. The mock Canvas runs
    in the same process; its answers are taken out of the measured time (below).
  - **A virtual user is one learner in one Canvas course; one iteration is one visit:** the LTI launch over HTTP as a
    browser makes it (the mock's login form, `POST /lti/login`, the mock's authorization answer, `POST /lti/launch`
    and ltijs's second post with the recovered state), the player page `/lti/play?ltik=…` and every script and
    stylesheet it names, fetched like a browser with an empty cache (at most 6 connections per host); then the
    root `attempted` batch the page sends when it opens, and `rounds` answers, each after a think time: one xAPI
    batch with one question's `answered` and its score, and one state save (H5P saves every 5 s while something
    changed, so once per answer); and at the end the root `completed` with the total. These are the items the bridge
    sends and the server stores (D-115), with the activity's real question IDs, valid under the contract's schema,
    with the ltik as `Bearer`.
  - **Measured, with the spec's numbers as thresholds:** `hvli_player_ready`, from the tool's `/lti/login` to the
    last script or stylesheet, less the mock Canvas's answer, p95 < 3 000 ms; `http_req_duration{kind:api}` (the
    xAPI batches and state saves) p95 < 300 ms; `http_req_failed` < 1 %; checks > 99 %. Also shown: the page alone,
    the launch, each API route, and the bytes a visit fetched.
  - **Not measured by k6 (stays open):** the browser's own work (parsing, running H5P, layout) and Fast 4G's latency
    and bandwidth, since k6 runs no browser and throttles nothing; the bytes per visit are reported so they can be
    held against Fast 4G's throughput. The in-browser half of `NFR-001`'s Verify (Lighthouse CI on the player route
    with Fast 4G) is not added here (D-114's Lighthouse option waits). Content files from the files origin (images,
    video) are file downloads, outside the API limit, and not needed before the player answers; they are not fetched.
  - **Scale:** `full` is `NFR-001`'s 200 learners (ramp up 60 s, hold 10 min, ramp down 30 s), thinking 5–15 s,
    6 answers per visit; `smoke` is 20 learners for 30 s, thinking 2–4 s, 4 answers (about the request rate of 60
    learners of the full model). Both use the same thresholds. The full run is HVL's, on hardware like a production
    node (Q5), with the command in the runbook; its output goes into PROGRESS like the smoke's.
  - **k6:** the image by digest above, with `--network host`, the caller's uid and gid, the scripts mounted read-only
    and one writable output folder; its only settings are `HVLI_LOAD_*` variables. `handleSummary` writes
    `summary.json` and our own short text summary, so no script loads anything at run time (k6's summary helpers
    are a remote module).
  - **SECURITY and PRIVACY:** an ltik lives only in its virtual user's memory and travels as on a real page (the
    landing query, the `Bearer` header and H5P's state URL), never in a file or an argument; every request has a
    fixed `name` tag, so no URL with an ltik becomes a metric name or a line of the summary. The learners are random
    `sub` values of the mock Canvas, gone with the bench's database. The runner gives k6 no other environment.
  - **Residuals:** the test bed logs every line at `debug` into memory, more work than production's `info` to a
    stream, so the numbers err on the slow side; there is no grade worker (the launches have no line item), so AGS
    sending is not under load; the in-browser time and Fast 4G above.
  - **Tests:** `tools/load/test/` titled `[NFR-001]`: the thresholds and both profiles against the spec's numbers,
    the batch against `xapiBatchSchema`, the launch-form parsing against the real mock Canvas, and the `docker run`
    arguments (digest, read-only mount, no extra environment).
  - **What the smoke measures (2026-11-05, built and run here):** `npm run load:smoke` on the development sandbox
    (4 CPUs, PostgreSQL, Redis, the S3 emulator and k6 on the same machine): 20 learners for 30 s made 60 visits and
    6 180 requests; `hvli_player_ready` p95 1 235 ms (median 102 ms; the slow ones are the first visits, before the
    server's caches are warm), the API p95 22 ms (xAPI 31 ms, state saves 14 ms), no failed request, every check
    passed, and 360 statements and 20 learner states stored (6 statements per visit, 1 state per learner); exit 0.
    An earlier run of the same code gave 1 351 ms and 38 ms. A visit fetches 1 496 KiB (the player page with its 49
    scripts and 37 stylesheets, and the script of ltijs's login page), which the app sends **uncompressed**: at Fast
    4G that transfer alone is about 1.3 s, so the reverse proxy must compress scripts and styles (the runbook's
    checklist). What changed from the design while building:
    k6 2.3.0 has no `noUsageReport` option, so the runner passes `--no-usage-report` (and `--quiet`); the container
    also gets `--cap-drop ALL` and `no-new-privileges`; `url` is left out of k6's system tags and the runner removes
    `ltik=…`, `Bearer …` and JWT-shaped values from k6's output, because k6 prints a failed request's URL; the
    scripts of ltijs's login and launch pages count as assets of the visit, as a browser loads them before it goes
    on; each question scores 0 or 1 out of 1. The bench and the runner are split into `loadDatabase.ts`,
    `benchProcess.mjs` and `k6Container.mjs` to stay within 200 lines, and `tools/load/test/loadBench.test.mjs` makes
    one visit with the same readers and builders in Node against the real bench (every asset 200, four batches 202,
    the state read back) and checks that the bench drops its database.
  - *Skeptic review (2026-11-05), with its fixes:* the smoke ran again here, and once with the API limit set to 5 ms,
    which printed `FAIL http_req_duration{kind:api} p(95)<5` and exited 99 through `npm run`, so the thresholds can
    fail and the exit code reaches the caller. Fixed: (1) the runner redacted k6's output per pipe chunk, so a chunk
    boundary inside `ltik=…` let the rest of the token through; it now redacts whole lines (`pipeRedactedLines`),
    and a test that cuts a line inside the token fails with the old code. (2) The container's own file system was
    writable; it now runs with `--read-only`, so the output folder is the one place k6 can write, as the design
    says. The final smoke with both: exit 0, `hvli_player_ready` p95 1 506 ms (median 82 ms), the API p95 22 ms, no
    failed request, every check passed, 60 visits, 6 180 requests, 360 statements and 20 learner states stored
    (runbook section 8). Across the five smoke runs of this step the p95 lies between 1 136 and 1 506 ms while the
    median stays near 0.1 s, a slow tail that fits the 20 first, concurrent visits before the caches are warm (a
    third of the 60). Residual: where the caller is root (as in this sandbox) k6 runs as uid 0 in its container,
    without capabilities or new privileges; elsewhere it runs as the caller.

### D-115 · xAPI capture, statement identity, attempts and gradable results (probe P1)
- **Context:** Probe P1 played the ten real types (D-078) in Chromium on the production player and router, and
  recorded every statement with its document, timing and size (332 statements); a second agent re-ran seven types,
  the S5 pattern `uv-module` and a stand-in bridge (188 statements). D-102 left the attempt rule and the
  de-duplication to this probe. Observed:
  - **Where:** all ten types run div-embedded in the player document (`playerPage.ts` renders
    `<div class="h5p-content">`, although nine of the libraries declare `embedTypes: ["iframe"]`), and every statement
    arrives there exactly once. None reaches the web app's top window, which has no `window.H5P`. With H5P's own
    `<iframe class="h5p-iframe">` embedding, which the production CSP allows and only our div template prevents, each
    statement arrives twice, in the iframe and relayed to the player document as the same event object, and a
    `playerGlobalAssets` script runs in both documents, because H5P copies `H5PIntegration.core.scripts` into the
    iframe. In that iframe `H5P.externalEmbed` is still undefined while scripts are evaluated (H5P sets it to `false`
    later), a set of seen events kept per window misses the other window's copy, and `location.href` is the player's
    URL in both.
  - **Shape:** no `id` and no `timestamp`; the actor is always `{"name":"","mbox":"mailto:"}`; `object.id` is the
    bare content ID or `<contentId>?subContentId=<uuid>`; the verbs are exactly `LTI-011`'s five.
  - **Volume:** `interacted` and `progressed` are 38–76 % of all statements, and none of them carries what an `INS`
    requirement uses: BranchingScenario's choice `interacted` has no response, and InteractiveVideo sends no
    `progressed` at all. The peak was 43 statements a minute at automated speed, 22 without those two verbs.
    Statements are 681 B at the median and 1 524 B at p95, but H5P does not bound answers: one gap of 5 000
    characters made a statement of 7 967 B.
  - **Attempts:** H5P marks none. A retry sends nothing, or only `progressed` (CoursePresentation,
    BranchingScenario). Root `attempted` means "the page loaded": it comes again on every reload, never on a retry,
    and never from Column or ImageHotspots, nor from InteractiveBook before «Les». On resume, CoursePresentation
    re-sends its scored `completed` with no learner action when it opens on the summary slide, and InteractiveBook
    offers the same submission again. Column sends a scored root `completed` after every «Sjekk» once all its tasks
    are answered, and InteractiveBook sends each chapter's `completed` twice within about 30 ms.
  - **The root:** no single test finds it. H5P's own (no `contextActivities.parent`) takes InteractiveBook's chapter
    `completed` for the root; `LTI-012`'s (no `subContentId`) takes the context-less `interacted` that DragText sends
    while it restores state inside a QuestionSet, and every child of content saved without `subContentId`s, which
    `POST /h5p/content` accepts. InteractiveBook without a cover sends one root `attempted` with no context at all.
  - **Scores:** `result.success` comes at the root only from MultiChoice and QuestionSet. InteractiveBook (its «Send
    inn rapport» needs `H5PIntegration.reportingIsEnabled`, which we do not set) and InteractiveVideo (no submit
    screen in our example or in `fa-video`) send no root score, and ImageHotspots sends no statement at all. Every
    ending of `uv-case` scores 10 of 10 (read from the pattern). In `uv-module`, a chapter check's «Prøv igjen»
    throws in QuestionSet 1.21 (its `resetTask` walks every `.h5p-progress-dot` in the document, and the book holds
    three sets), and the results page stays.
  - **Durations** mean different things by type: summed across retries, reset by DragText's retry, counted from
    pre-rendering in nested content, or absent from a nested QuestionSet.

  Not observed: a play through the real portal page or a Canvas launch into `/app/play`; the code renders the same
  div template there.
- **Decision:** binding for step 3. Where a point is ALU's or the owner's, the default below holds until they answer
  (Q18–Q20), so nothing waits.
  - **Where the bridge runs:** `xapiBridge.js` is the last script in `playerGlobalAssets`, after the theme scripts,
    and never in `editorGlobalAssets`. It is therefore evaluated after `h5p.js` and the `x-api` scripts and before the
    library scripts and document-ready, where H5P sends root `attempted`. While it is evaluated, it registers
    synchronously with its own document's `H5P.externalDispatcher.on('xAPI', …)`, unless `window.frameElement` has
    the class `h5p-iframe` (a Core iframe, whose events the parent's bridge sees; a cross-origin parent such as Canvas
    gives `null`, and the web app's frame never carries that class). At event time it also ignores an event when
    `H5P.isFramed && H5P.externalEmbed === false`. The player page includes the script, and renders its configuration
    (the endpoint and the content's ID and version; no identity), only for a learner principal; for anyone else it
    leaves both out (D-102), and without a configuration the script does nothing. The div template stays; the guard
    covers a future iframe embedding. `H5P.externalEmbed` read at evaluation, a per-window set of seen events and
    `location.href` are not used: each failed in the probe.
  - **What the bridge sends:** only what the server may store: the first root `attempted` of the page load, every
    `answered`, and a root `completed`; never `interacted`, `progressed`, or a sub-content `attempted` or
    `completed`. Each statement is cut down to what the server reads: `verb.id`; `object.id` and
    `object.definition.interactionType`; `context.contextActivities.parent` and `category`; the extensions
    `h5p-subContentId` and `h5p-local-content-id`; and `result.score`, `success`, `completion`, `duration` and
    `response`, capped as below. No `actor`, question text, choices, feedback or other extensions. Each item carries
    a `statementId` (`crypto.randomUUID()`, one per dispatched event) and an `attemptId`.
  - **Batches:** every 2 s, at most 50 items and 60 000 bytes of JSON, one request in flight. A batch that fails
    with a network error, a 5xx or a 429 goes back to the head of the queue; one refused with any other 4xx is
    dropped. On `pagehide`, everything not yet acknowledged, the request in flight included, goes in one `keepalive`
    request, within the browser's 64 KiB and the same 50 items and 60 000 bytes, oldest first; what does not fit is
    lost, as D-102 accepts for a large last flush. The server skips what an earlier request already stored. A batch
    names its content and version once: the version the page was rendered with (D-093), which the server accepts from
    1 up to the current version, so a page opened before a structural save never labels its statements with the new
    one.
  - **What the server accepts and stores (`LTI-011`, `DATA-012`):** it still accepts all five verbs. It ignores
    `actor`, since the learner comes only from the request's principal (D-102), and it accepts a bare UUID as
    `object.id`, a missing `context` and a numeric `response` (stored as text). Each item is checked on its own: an
    invalid one (including one about another activity) is discarded and counted in the log, without its content, so
    one odd statement never blocks its batch. A batch for an activity the principal may not view (in Canvas, any but
    the launched one), or with over 50 items or over 64 KiB, is refused with 403, 400 or 413, and the bridge drops it.
    Stored: a root `attempted`; an `answered` of the root or of sub-content (its `subContentId` from the extension,
    else from `object.id`); a root `completed` that is not a replay. Discarded: `interacted`, `progressed`, a
    sub-content `attempted` or `completed`, a sub-content statement without a `subContentId`, and a replay. The answer
    is 202, with no detail per item.
  - **Identity and time:** the `statementId` becomes `XapiStatement.id`, inserted so that an existing ID is skipped
    (the `pagehide` flush, a request retried after a lost answer); `DATA-012` gains no field. A content hash is never
    an identity, since identical statements are normal (seven identical Blanks `interacted` within 100 ms). The
    stored `timestamp` is the server's receive time plus the item's place in the batch in milliseconds, so the
    batch's order survives as a strict order (D-102's receive time, within 49 ms); the browser's clock is never read.
  - **The root and gradable results:** a statement is **root** when `object.id` is the content ID with no
    `?subContentId=`, it has no `h5p-subContentId` extension, and it has no `contextActivities.parent`. A **root
    result** is a root `answered` or `completed` whose `category[0].id` names the activity's main library
    (`http://h5p.org/libraries/<machineName>-<major>.<minor>`); it is **gradable** when `result.score.max` is above 0
    and it is not a replay. Each test alone misclassifies a case above; a root `attempted` needs no category, since
    InteractiveBook's has none. The score is `scaled`, checked against `raw / max` within 0.0001 (Core rounds it to
    four decimals; an item outside is discarded), never `success`. One server module holds these tests, the bridge
    repeats them for its attempt counter, and both are tested on P1's fixtures.
  - **Attempts:** `attemptId` is `<viewId>:<n>`. `viewId` is a `crypto.randomUUID()` made once per page load, and
    `n` starts at 1 and goes up by one right after the bridge sends a root result with `score.max` above 0 (the
    bridge cannot tell a replay; the server can). An attempt therefore holds at most one result, and a retry, which
    H5P does not announce, becomes a new attempt at its next result; statements after the last result form an open
    attempt. The server checks the shape (a UUID, a colon, a positive integer) and reads the view part only for the
    replay rule. This keeps D-102's rule.
  - **The attempt policy (`LTI-012`, D-104):** each stored gradable result in a Canvas launch writes a
    `GradeSyncJob` per `(placement, learnerKey, attemptId)`, with `scoreGiven` = `scaled × 100`. `best` sends the
    learner's highest job score in the placement, `latest` the score of the job created last (jobs are created in
    result order), and `mastery` 100 once any job's score reaches the threshold, else `latest`.
  - **Replays and repeats:** a root `completed` is a **replay** when its page load stored no `answered` since its
    previous root result (or since the load), and its `scoreRaw` and `scoreMax` equal those of the learner's latest
    stored root result for the same content, context and version. BranchingScenario is exempt: an end screen is
    reached by navigation alone, its choices are `interacted`, and it was not seen to replay. The rule drops
    CoursePresentation's `completed` re-sent on resume or on a revisit of the summary slide, and a re-submission of
    InteractiveBook or QuestionSet after a reload; it keeps a first submission after a reload (there is no earlier
    result) and a check after changed answers. P1's guard in the bridge (no learner activity since the page loaded)
    is not used: it would drop that first submission. Column's `completed` after each «Sjekk» follows an `answered`,
    so each is a result and an attempt, and D-104's coalescing sends one current score. InteractiveBook's double
    chapter `completed` and DragText's context-less `interacted` are never sent.
  - **Gradable root result per type:**

    | Type | Gradable root result | Score | `success` at root |
    |---|---|---|---|
    | MultiChoice 1.16 | `answered`, at every «Sjekk» | H5P's | yes |
    | Blanks 1.14 | `answered`, at every «Sjekk» | correct gaps | no |
    | DragText 1.10 | `answered`, at every «Sjekk» | correct drops | no |
    | QuestionSet 1.21 | `completed`, at every finish («Avslutt») | sum of the questions | yes (pass mark) |
    | Column 1.18, 1.22 | `completed`, at every «Sjekk» once all tasks are answered | sum of the tasks | no |
    | CoursePresentation 1.28 | `completed`, at every arrival on the summary slide | sum of the tasks | no |
    | InteractiveBook 1.15 | `completed`, at «Send inn rapport», with `reportingIsEnabled` (the default, Q18) | sum of the chapters | no |
    | InteractiveVideo 1.28 | `completed`, at «Send inn svar», only with a submit screen its author added (Q18) | sum of the interactions | no |
    | BranchingScenario 1.10 | `completed`, at an end screen, unless its scoring is `no-score` (maximum 0) | the end screen's or the path's | no |
    | ImageHotspots 1.11 | none: it sends no statement | none | none |

  - **InteractiveBook and InteractiveVideo (Q18):** the player page sets `reportingIsEnabled: true`, H5P's switch
    for a platform that records results, which ours is. Of the ten types only InteractiveBook reads it (so does
    DocumentationTool, which is not offered). The learner then sees «Send inn rapport» on the book's summary page,
    and H5P's own score reaches Canvas as QuestionSet's does at its finish; the library's text after sending («Svara
    dine er sende inn til vurdering») can get a formative wording through D-111's overlay if ALU wants one. An
    InteractiveVideo is graded only when its author adds a submit screen: no validator rule and no pattern change in
    S6, so `fa-video` sends no score. Not chosen: a score the bridge computes from `getScore()` (a statement H5P never
    sent), or no grade for the main InteractiveBook pattern.
  - **`uv-case` (Q19):** unchanged. Its pattern gives every ending 10 on purpose ("the score shows that the student
    has worked through the case"), so Canvas gets 100 for every completed case: a completion mark, and formative like
    every score here (D-105). Not chosen without ALU: scores per choice (a pattern change that would grade
    professional judgement) or no Canvas score for it.
  - **`uv-module`'s chapter checks (Q20):** the pattern sets `endGame.showRetryButton: false` on its three
    QuestionSets, so the failing «Prøv igjen» is not offered, and each question keeps its own «Prøv igjen»
    (`override.retryButton: "on"`). If the regression test shows that the book's own «Prøv igjen» fails the same
    way, the pattern turns that off too. A teacher's own page with two or more QuestionSets is expected to keep the
    fault (read from the code, not observed): an accepted limitation for the pilot, drafted as an upstream report
    (D-112). Not chosen now: a run-time repair of QuestionSet's `resetTask`, which would change library behaviour,
    not attributes as D-080's repairs do, and needs its own decision.
  - **Activities that send no score** (ImageHotspots, InteractiveVideo without a submit screen, BranchingScenario
    with `no-score`): no `GradeSyncJob` is ever written, and the Deep Linking picker says so when the placement is
    `assignment_selection`, in `nn`, `nb` and `en`.
  - **What insight reads (`INS-001`…`INS-005`):** a learner has **started** with any stored statement for the
    activity, so InteractiveBook without a cover counts at load, Column counts from the first answer, and no statement
    is made up. **Completed** is a stored root result, **attempts** are the stored root results, and **time on task**
    comes from the stored timestamps of each page load, never from `durationMs`. Where a type cannot send a root
    result, completed, the rate and attempts are shown as not available, never as 0, and ImageHotspots' tab says that
    it sends no learning data. `INS-002` and `INS-003` read `answered` by `subContentId` (correct is `success`, or
    full marks where H5P sends no `success`). `INS-005`: InteractiveVideo sends no `progressed`, so there is no
    drop-off curve, and the share of learners who answered each interaction is the measure, as `INS-005` allows.
    `INS-004` (SHOULD) is not built in S6: BranchingScenario's choices are in no dispatched statement, only in its
    `getXAPIData()` and saved state, and the last choice before an end screen sends nothing at all; building it
    means statements the bridge makes (a `SPEC-DEVIATION`), after a probe shows that retried choices are kept. The
    mappe's `ActivityResultsSource` (D-095) reads the same: attempts and completed as here, and the first and last
    scaled score from the learner's first and last root results with `score.max` above 0.
  - **Answers, durations and rates:** `response` is kept only for the interaction types `choice` and `fill-in`
    (`INS-003`). Each gap (between `[,]`) is cut to 100 characters, which is enough to group the answers *k* learners
    share; a response still over 1 000 characters (the column's limit) is not stored, because a shortened list would
    shift its gaps. The bridge applies the same caps to keep batches small; the server enforces them. `durationMs` is
    parsed from `result.duration` and stored, as `DATA-012` lists it (null when absent, unreadable or over 24 hours),
    and no insight reads it. `LTI-011`'s 120 statements a minute per learner and activity stays: the measured peak
    without `interacted` and `progressed` is 22, and the bridge sends fewer still, so a 429 (with `Retry-After`;
    nothing from that batch is stored, and the bridge retries after it) means misuse.
  - **Missing `subContentId`s:** creating, copying and importing content fill in each missing `subContentId` and keep
    the existing ones; a save of stored content does not, since that would change D-093's structure signature. (The
    pattern builder instead gives every node a new ID, since a skeleton's IDs must never be shared, D-084.) Nodes are
    found by shape, as `learningDesign/patterns/subContentIds.ts` finds them, so a sub-content group with no
    `subContentId` key still gets none until the editor adds it. A child of content without them sends statements the
    server does not store.
- **Alternatives considered:** (a) Identity by `(attemptId, seq)`: a field outside `DATA-012`, where the row's own ID
  does the same. (b) Sending every statement, as `LTI-010` reads: 38–76 % more statements, raw statements of up to
  8 KB with question text in a 64 KiB `keepalive` budget, and data no requirement uses. (c) A root `attempted` that
  the bridge makes on H5P's `initialized` event for Column, ImageHotspots and InteractiveBook before «Les»: more
  learners counted as started, from a statement H5P never sent. (d) One attempt per page load: a retry in the same
  load would replace the better result under `best`. (e) P1's guard in the bridge: see **Replays and repeats**.
  (f) Storing replays with a flag: a field outside `DATA-012`. (g) Any one of the root tests alone: each
  misclassifies an observed case.
- **Consequences:**
  - `SPEC-DEVIATION`, exactly: `LTI-010` ("It POSTs each statement"): the bridge sends only what the server stores,
    cut down, with a `statementId` and an `attemptId`. `LTI-011` ("Then it stores the minimal fields"): `interacted`,
    `progressed`, sub-content `attempted` and `completed`, replays, and sub-content statements without a
    `subContentId` are accepted and not stored, and an invalid item is discarded on its own. `LTI-012` (the root as
    "no `subContentId`"): the tests above. The code carries `SPEC-DEVIATION: D-115`. Not deviated: `DATA-012`'s
    fields, the five verbs, the score checks and the rate limit.
  - D-102, D-104 and D-112 get amendments that point here, and D-113 lists Q18–Q20 as open. Step 3 adds amendment
    notes to spec 02 (`LTI-010`, `LTI-011`, `LTI-012`) and spec 05 (`DATA-012`, `INS-001`, `INS-004`, `INS-005`).
  - Tests: the mapper and the root tests on P1's fixtures (`[DATA-012]`, `[LTI-012]`); the bridge capturing each
    statement once in H5P's iframe mode, and through the real portal page and a mock-platform launch into
    `/app/play`, which P1 could not run (`[LTI-010]`); the replay rule on CoursePresentation's resume and
    InteractiveBook's re-submission; and the nested QuestionSet retry in `uv-module`, pinned to the upstream
    behaviour, so that a fixed version shows.
  - Residuals, for the DPIA input and the students' checklist: `INS-001`'s attempts count each Column re-check and
    each CoursePresentation summary reached after new answers; a learner who opens a Column and never checks is not
    counted as started; ImageHotspots gives no insight and no grade; on a teacher's page with several QuestionSets a
    set cannot be retried; content stored without `subContentId`s gives no insight per question; and time on task
    runs only from a page load's first to its last stored statement, so reading before the first answer of a Column
    and time after the last stored statement are not counted.
- **Amendment (2026-10-30, step 3):** three points made concrete while building. *`latest`:* migration
  `s6_grade_bridge_insight` also adds `GradeSyncJob.resultAt`, the stored `timestamp` of the result that made the job
  or last updated it, and `latest` (and `mastery` below its threshold) sends the score of the job with the latest
  `resultAt`, then the highest attempt number `n` of `<viewId>:<n>`, then the attempt ID as text, so equal times still
  give one answer. Creation order is not used: it can differ from result order when two requests of one learner are
  handled at once (the `pagehide` flush beside the request in flight), and a job that a later result of its attempt
  updates (`LTI-013`) keeps its creation time. This replaces "the job created last" above and in D-104's P1
  amendment; spec 02 §7 and the data inventory list the field. *`reportingIsEnabled`:* the player page sets it only
  together with the bridge, for a learner principal, so an author's preview never offers «Send inn rapport». *Q20:*
  `uv-module`'s skeleton stores `endGame.showRetryButton: false` on its three QuestionSets, pending ALU's review of
  the patterns (Q17). Each question keeps its own «Prøv igjen» until its set is finished (`override.retryButton:
  "on"` sets its `behaviour.enableRetry`, the field spec 04's `PED-H07` names). The S5 real-pattern tests
  (`PROD-009`) and `PED-H07`'s implementation also read `endGame.showRetryButton`, which spec 04's `PED-H07` does not
  name, and the tests report each set's stored pass mark (the library's default `passPercentage`) as one that cannot
  be retried; how they treat these switches is settled at the step's integration, by amendment.
- **Amendment (2026-11-04, step 3 review):** two more points. *What is stored:* a root `answered` or `completed` is
  stored only as a root result; one whose category does not name the main library is discarded, since `DATA-012`
  stores no category and insight (completed, attempts) and the grade queue read every stored root `answered` and
  `completed` as a root result (spec 02 `LTI-011` and spec 05 `DATA-012` as amended say so). *The book's «Prøv
  igjen» (Q20):* it is no way round the hidden set button. In a scratch run (not kept as a test) a freshly loaded
  `uv-module` held six progress dots, and the book's `resetTask`, which its summary page's «Prøv igjen» calls, threw
  QuestionSet's `TypeError` in the first chapter check, so the book is not reset either: a finished chapter check
  cannot be retried in this pattern at all. The regression test listed above is not written yet; once it pins this,
  the rule above turns the book's retry off too (`behaviour.enableRetry: false`), which `PED-H07` reports on a field
  spec 04 names. Whether the pattern then departs from `PROD-009` ("*Retry* … enabled" for all patterns), and so
  needs a `SPEC-DEVIATION`, is the owner's call at the step's integration, together with the S5 tests above.
- **Amendment (2026-11-04, step 3 integration):** the S5 tests and `PED-H07`, settled as the step-3 amendment asked.
  A QuestionSet whose results-page «Prøv igjen» is off (`endGame.showRetryButton: false`) while it forces each
  question's own «Prøv igjen» on (`override.retryButton: "on"`) keeps retry on, in the sense of spec 04's `PED-H07`
  (`enableRetry`) and `PROD-009`: `PED-H07` gives no hint for that switch then (a hint would send the author back to a
  button that breaks when a page holds several sets), the real-pattern tests (`realPatternSwitches.ts`) accept it,
  and its pass mark counts as informative, since each question can be retried until the set is finished. Without the
  override, the hint and the tests' report stay. Fixtures `PED-H07/negative-set-retry-off-questions-keep-theirs.json`
  and `positive-set-retry-off-without-override.json` pin both sides. *Not settled here:* the book's own «Prøv igjen»
  in `uv-module` (the step-3 review amendment). Its regression test is still to be written, and whether the pattern
  then turns the book's retry off, and so departs from `PROD-009` with a `SPEC-DEVIATION`, stays the owner's call
  (Q20); until then the book's retry stays on and the tests above require it.
- **Amendment (2026-11-04, the step-3 security review):** *The attempt policy:* D-104's amendment of the same day
  replaces "each stored gradable result in a Canvas launch writes a `GradeSyncJob` per `(placement, learnerKey,
  attemptId)`" and the step-3 amendment's `latest` by `GradeSyncJob.resultAt`: there is one job per placement and
  learner, and the policy reads the stored gradable results themselves, in the same result order (`timestamp`, then
  the attempt number `n` of `<viewId>:<n>`, then the attempt ID as text). The attempt rule itself is unchanged.
- **Amendment (2026-11-04, the step-3 security review): *the book's «Prøv igjen» (Q20), pinned.*** The regression test
  the step-3 review amendment asked for is `uvModuleBookRetry.browser.int.test.ts` (an upstream pin, DOC-004). It
  creates `uv-module` through the pattern route on the real content types, plays it as its author in Chromium in
  Nynorsk, finishes the first chapter check and presses «Prøv igjen» on the book's summary page. It pins what
  QuestionSet 1.21 and InteractiveBook 1.15 do today: the document holds six progress dots at load (two sets) and nine
  on the summary page; the check's results page offers no «Prøv igjen» (`endGame.showRetryButton: false`); the book's
  «Prøv igjen» raises one `TypeError` (reading `classList`, in `toggleFilledDot` of H5P.Components 1.0, which
  QuestionSet's reset calls for a dot that is not its own); the book stays on its summary page; and the first check
  keeps its results page, so a finished chapter check cannot be retried at all. An upstream fix, or a change of the
  pattern's retry switches, fails the pin. Not decided here: whether the pattern turns the book's retry off
  (`behaviour.enableRetry: false`), and so departs from `PROD-009` with a `SPEC-DEVIATION`; that stays the owner's
  call (Q20), and until then the book's retry stays on, as the S5 tests require.
- **Amendment (2026-11-23, D-140):** the page policy no longer allows Core's inline script, so H5P's own iframe
  embedding is prevented by the policy as well as by our template. The bridge's handling of that mode stays, and
  its browser test adds the script's hash itself.

### D-116 · An IT assurance pack for HVL IT and an SBOM generator, outside the specs; a request in three stages
- **Context:** On 2026-11-05 the owner asked for an "IT assurance pack" for HVL IT, whose operations and security
  staff will want assurances from people before they host HVL Interaktiv, even for testing. No spec asks for one: the
  specs describe the product, and `docs/ops/` (D-109, D-110) says how to run it, not whether IT should. The code, its
  tests and every review of them were written by the same AI (213 of the repository's 214 commits; the other is the
  merge of pull request #8), and no person has reviewed the code. The repository does not know HVL's infrastructure,
  routines or people, and no document names who at HVL owns or maintains the system. `npm sbom` sees only npm
  packages; H5P core, the editor and the content types come from GitHub at pinned commits (D-022, D-027, D-078), and
  the server image rests on base images pinned by digest (D-110).
- **Decision:**
  - **The pack:** `docs/assurance/`, outside the specs' scope, in plain English for HVL IT, with Norwegian domain
    terms kept as in the glossary: `README.md` (start here, with a Nynorsk *samandrag*), `architecture.md`,
    `threat-model.md` (STRIDE), `ros-analyse.md`, `human-review.md` and `test-environment.md`. Each document is a
    draft for IT to correct; says that AI wrote and fact-checked it and that no person has reviewed it; cites its
    evidence (a path, a decision, a requirement ID or a test); marks HVL facts *(IT to fill in)* and its own
    suggestions *(proposal)*; and names variables only, never a secret value.
  - **The SBOM:** `npm run sbom` (`tools/sbom/`) writes `docs/assurance/sbom.cdx.json` in CycloneDX 1.5: the npm
    packages of a production install, H5P core and the editor, the ten content types by commit, and the container
    images by digest. `--check` says whether the committed file is current. The output is deterministic (no time
    stamp, a serial number derived from the content), and the tool reads files and the installed tree only. Its
    tests are titled `[SEC-007]` (dependency hygiene), which does not itself ask for an SBOM; `npm test` runs them in
    CI, and CI does not run `--check` yet. What the SBOM leaves out is listed in its README.
  - **No change to the app:** nothing in `apps/`, `packages/`, `deploy/`, `content/` or `docs/specs/` changes.
    Where the pack finds a gap, it proposes a measure; a change to the code needs its own decision first
    (CLAUDE.md §1, "Deviation").
  - **A request in three stages**, in the same words in every document of the pack. **Stage 0:** students and
    reviewers run the app on their own machines or in Codespaces, against the mock Feide and mock Canvas (D-049),
    with made-up users; IT is not needed. **Stage 1:** an isolated test server with made-up data only, Feide test
    users, HVL's test Canvas, named testers and an end date. **Stage 2:** a pilot with real students in one or two
    courses, only after the DPO's approval (Q6), a human security review, the ROS-analyse in HVL's form and an
    operations agreement. PROGRESS.md's «Blocks» column keeps naming sessions or "the pilot"; the pilot is stage 2.
  - **Who is accountable** is open: Q31 asks HVL to name a system owner (*systemeigar*) and a maintainer
    (*forvaltar*) for HVL Interaktiv, the system owner and a contact for the test install before stage 1, the
    maintainer before stage 2 at the latest. Until then the repository owner makes the product decisions, as before.
- **Alternatives considered:** (a) Widening `docs/ops/`: it says how to run the service for readers who already have
  IT's go-ahead, not whether to give it. (b) The SBOM from `npm sbom --omit dev` alone: on 2026-11-05 it kept 239 of
  the 477 production packages (`playwright-core`, `tsx`, `react` and `prisma` among the missing) and lists no H5P code
  or images. (c) The risk analysis in HVL's own template: the template is HVL's and unknown here, so the draft scores
  on a 5 × 5 scale with `ROS-nn` IDs that IT keeps when it moves the risks over. (d) Waiting for a human review
  before writing to IT: IT's questions come first, and the pack says where a human review should start.
- **Consequences:** The pack describes the repository at `92ca2c5` on 2026-11-05; its figures (commits, test
  counts, the commits after `main`) age as the S6 gate and later work land, and are refreshed with the gate output.
  The SBOM is regenerated after a change to the lockfile, the H5P pins or the images (`tools/sbom/README.md`).
  Neither the pack nor the SBOM is a review, and neither changes what the code does. Q31 joins PROGRESS.md's open
  questions.
- **Amendment (2026-11-06, the owner's request; pull request #18):** the pack gains `how-it-was-built.md`, at the
  owner's request of 2026-11-06: the method used throughout (the plan, build, test, verify cycle of CLAUDE.md §4;
  fixes as experiments, a fault reproduced before its fix and the same test shown passing after it; mutation and
  revert-run-restore checks of the tests; adversarial AI review with skeptics and fact-checkers; the session gates),
  how the local gate and GitHub CI differ (where they run, what runs, who vouches) and their shared limit, that the
  same AI wrote the tests both run, with the evidence and what people must still review and test. It follows this
  decision's rules for the pack: a draft for IT to correct, written and fact-checked by AI, each claim with its
  evidence, and no fact about HVL that the repository cannot know. The snapshot is refreshed to commit `8d4eaf0` and
  pull request #18's CI result: the first finished CI run on S6 (run 42166052880, on `3eeea8d`) failed one test that
  relied on a developer `apps/server/.env`, which GitHub's runner does not have; it was reproduced without `.env` and
  fixed in the test helper (`8d4eaf0`); the Session gate then passed on `8d4eaf0` (run 42170423046, finished
  06:45:23 UTC), and `docker.yml` passed on GitHub for the first time (runs 42166052745 and 42170423045). Commit
  counts, the commits after `main` and the review state (no review on pull request #18) are as read on 2026-11-06.
  This amendment changes no app code, test, spec or CI file. A green CI run is not a review, so the pack's caveats
  stand, and `README.md` lists the new document.
- **Amendment (2026-11-06, the owner's request; after pull requests #18 and #21 were merged):** the pack is refreshed to
  commit `43c6673`, `main` after both merges, without changing its documents or its rules. Pull request #18 was merged
  as `38b1743`, after CI and `docker.yml` had passed on its last head `eb79b30` (runs 42183630447 and 42183630572), and
  both passed on `main` (runs 42205391766 and 42205391749). Pull request #21 (`9bfa1b2`, with `9ad481e`) passed CI and
  `docker.yml` (runs 42253214678 and 42253214575) and was merged as `43c6673`; on `main`, `docker.yml` passed (run
  42266303382) and CI (run 42266303529) passed, every step (17:57–18:44 UTC). The pack now names pull request #21's
  controls where IT looks for them: the clamd settings probe and `npm run clamd:check`, and the build-secret scan on
  every way a library gets in with `npm run libraries:check` (README's status table, `architecture.md`,
  `test-environment.md`, `human-review.md` A2 and C4). Its counts are as read at `43c6673`: 224 commits, 221 by Claude
  and three merges by the owner's account; 147 dated amendments with this one; 209 review findings confirmed and fixed
  where counts were recorded, the 22 of pull request #21 (13 on the scan, 9 on the probe) taken from that pull request's
  description on GitHub. The review plan's estimate grows to about 37.5–41.5 person-days, because area A2 grew with the
  probe and C4 gained the scan. Line references into files that pull request #21 changed are corrected. Pull requests
  #8, #18 and #21, the three with the app's code (the other 18 are Dependabot's), have no review (GitHub's API,
  2026-11-06), and pull request #21's changes have passed GitHub CI, the full local test run and the Docker smoke, not
  the whole local gate. This amendment changes no app code, test, spec or CI file, and the pack's caveats stand.

### D-117 · Repairing the security audit's findings in small steps, and the behaviour changes of the first step
- **Context:** The three-sitting security audit (sitting 1 read the code, sitting 2 attacked a running local copy)
  produced a private register of findings. Sitting 3 repairs them, highest value first, each as a small change with
  a test that proves the rule now holds. The repository is public, so the fixes themselves become public; the tool
  is pre-pilot, with no real students, and the bugs are already in the public code, so closing them in the open is a
  net improvement. The findings' own exploit detail stays in the owner's private papers, never in the repository.
- **Decision — how repairs are published:** public text (commit messages, test titles, comments, this log,
  `PROGRESS.md`) states the rule the code now enforces and the requirement ID, never how to find, trigger or exploit
  what was wrong, and never a finding that is not yet fixed. The private register maps each commit to its finding.
  One commit per repair; a new behaviour gets a test that fails before the change and passes after it.
- **Decision — the first step's behaviour changes:**
  - **A saved activity never changes owner, and a save cannot resurrect a deleted one.** `PrismaContentStorage.addContent`
    sets `ownerUserId` only on the path that creates a row (no ID given). With an ID it updates the existing row
    through `contentUpdate.ts` and answers 404 `content-not-found` when there is none, instead of re-creating it
    under the saver (H5P-006). Every caller that creates passes no ID. An ID comes with the editor's save of an
    existing activity, and with the second write Lumi makes inside one save when it has moved files
    (`ContentStorer.addOrUpdateContent`): that write names the row the same save has just written, for a new
    activity and for a copy alike, so the row exists in every case.
  - **A delete runs under the activity's write lock and is audited.** `ContentDeleter` (built with the save gate in
    `contentRouteGuards.ts`) holds the same `ContentWriteLock` as save and publish (D-074), so a delete and a save of
    one activity no longer interleave, and writes one `content.delete` audit event (actor, owner's `User.id`, the
    status it had; no title, DATA-007). The new audit action is added to the data inventory.
  - **Cookie names are matched byte for byte.** `parseCookieHeader` trims only SP and HTAB around a pair, not every
    Unicode space, so a name that differs from a cookie's name by another space character is a different name and
    is ignored (AUTH-003). The trim is one pass over the pair, so parsing takes time in step with the header's
    length. The written cookies are unchanged.
- **No spec change.** These restore behaviour the specs already require (H5P-006's permission matrix, AUTH-003's
  cookie rules); they are repairs, not new features. Later steps are logged in `PROGRESS.md` when they are made.
- **Amendment (2026-11-20, the re-check of the first step):** the cookie trim is one pass over the pair, and a test
  holds its time to the header's length; the sentence on which callers pass an ID is corrected (Lumi's second
  write); the data inventory names `content.delete` beside the co-author events as holding a staff `User.id`; and
  the wording of this entry, of `PROGRESS.md` and of the cookie parser's comments was brought in line with the
  publishing rule above.

### D-118 · Security repairs, step 2: how uploaded packages and files are read
- **Context:** The second step of the repairs D-117 describes. It concerns the paths that take a file from an
  author: the package import, the multipart reader and the SVG style rules. No spec changes: SEC-001, SEC-003 and
  SEC-005 already require what follows.
- **Decision — one reader for a package (SEC-005, SEC-003).** A package is read only through
  `security/zipEntryGuard.ts` (yauzl, with its size validation): by the archive check, by the manifest reader, by
  the library secret scan, and now also when Lumi unpacks it. `h5p/libraries/checkedPackageReading.ts` replaces the
  two Lumi 10.0.4 functions that open a package themselves (`PackageImporter.extractPackage`, which is static, and
  `PackageValidator.prototype.validateFileSizes`); Lumi goes on working on the unpacked folder. What is unpacked is
  what was checked: the same entries under the same names (a backslash in an entry name is a folder separator, as
  the archive check reads it), an entry must unpack to exactly the size it declares, the total limit is counted
  while writing, and the file is closed afterwards whatever happens. An entry that cannot be read, or whose name
  is at once a file and a folder of the package, is 400 `upload.archive.unreadable`; a failure of the disk or of
  the temporary area stays a server error. Lumi's choice of entries is kept (`content/`, the library folders, `h5p.json`; no
  file whose name starts with `.` or `_`), and an ordinary package unpacks to the same files as with Lumi's own
  function (tested). `test/h5p/upstream/lumiPackageReading.test.ts` pins the two places where Lumi opens a package,
  so a Lumi upgrade that adds a third fails there. Not chosen: a patch of Lumi's files in `node_modules` (not
  reproducible), or a second check of the unpacked folder (it keeps two readers and checks late).
- **Decision — every reader lets go of the package (SEC-005).** An entry is read only through `readEntryBytes` or
  `openEntryStream`; a stream that fails is destroyed, so closing the package always frees the file. A refused or
  failed import therefore leaves no open file and no upload folder (`test/http/packageImportOpenFiles.int.test.ts`).
- **Decision — a package's file references follow the storage's name rule (SEC-005).** Lumi stores a file that the
  package carries under the spelling of its reference in content.json. Such a reference must be a name
  `assertSafeObjectName` accepts (no empty or `.` segment, no control character); otherwise the import answers 400
  `upload.archive.unsafePath` before anything is unpacked. A reference to a file the package does not carry, a web
  address and an empty reference are judged as before: nothing is stored for them. Not chosen: a `sanitizeFilename`
  on the storages, which would rename authors' files silently and change the names D-092's guards compare. Both S3
  stores also close the data they were handed when they refuse a name (`keyForUpload`).
- **Decision — a broken upload is cleaned up at once (SEC-005).** When a multipart request fails part-way,
  `readMultipart` stops the file being written before it waits for the write, then removes the folder and answers.
  At start the server removes its own folders in the temporary area (`hvli-upload-*`, `hvl-svg-*`) that are more
  than an hour old, which a run that was stopped in the middle of a request left behind
  (`http/staleUploadFolders.ts`); no other folder is touched, and a failure there never stops the start.
- **Decision — `url()` in SVG style text is found by a one-pass scanner (SEC-001).** `security/svg/cssUrlScan.ts`
  replaces the single pattern in `svgRules.ts`. It reports exactly the functions the pattern reported (tested on
  every text of up to five grammar pieces), so which style texts are kept, rewritten or refused does not change;
  the time of `findCssViolation` and `neutraliseCss` now grows in step with the length of the text.
- **Consequences:** Nothing changes for an ordinary package or picture. A package with a damaged or mis-declared
  entry is answered with the "unreadable archive" message, and one whose content.json names a carried file with a
  `./`, an empty segment or a control character with the "unsafe path" message. `lumiInternals.ts` now also loads
  Lumi's `PackageImporter` and `PackageValidator`; a Lumi upgrade that moves them fails at start.

### D-119 · Security repairs, step 3: the SVG cleaning runs in a worker thread, within limits
- **Context:** Making an uploaded SVG safe (D-044) parses the author's text into a document twice with the HTML
  parser and once as XML. How long that takes, and how much memory it needs, depend on the text and not only on its
  size, which D-044 limits to 5 MB. The server answers every request on one main thread, so the cleaning must not
  run there, and it must end. SEC-001 is unchanged; this is how its sanitiser is run.
- **Decision:** The steps (`security/svg/svgPipeline.ts`, the same four in the same order) run in one worker thread
  (`svgCleaningWorker.ts`), started with the server and kept ready. `security/svg/SvgCleaner.ts` hands it one file
  at a time and holds it to three limits (`SVG_CLEANING_LIMITS`):
  - **Time: 5 seconds for one file** (the owner's choice, 2026-11-20). Past it the worker is stopped, the file is
    refused with the new message `upload.file.svgTooComplex`, and the next file gets a new worker.
  - **Memory: 512 MB of heap for the worker**, enforced by Node (`resourceLimits`). Past it the same happens.
  - **Waiting: 20 seconds for a turn.** A file that waits longer is refused with the new message
    `upload.file.svgCheckBusy` ("try again in a moment", like `upload.file.scanUnavailable`) and is never cleaned,
    so requests cannot pile up behind a slow file. A worker that is not ready within 30 seconds is treated the same.
  The folder of Lumi's temporary copy is made and removed by the main thread, after the worker has answered or has
  stopped, so a stopped worker leaves nothing in the temporary area. The worker loads the TypeScript sources with
  the server's own loader (tsx, named by its file), and is `unref`ed once it runs, so it never keeps a stopping
  server alive. A worker that cannot start is logged at start (`the SVG cleaning worker did not start`); SVG
  uploads are then refused or fail, never stored unchecked.
- **Why limits on time and memory, and not on the file's shape:** a count of elements or of nesting depth, taken
  from the text, does not bound the work, because the HTML parser decides what document a text becomes. Time and
  memory bound it whatever the text holds, and the main thread is free meanwhile.
- **Why a worker thread and not a separate program:** a thread can be stopped at once and its memory is limited by
  the runtime; it ends with the server by itself, needs no extra capability in the hardened container, and no
  second copy of the configuration. A separate program would add start-up, signals and orphans to look after.
- **Consequences:** An ordinary SVG is cleaned exactly as before (tested: the worker's output equals the steps'
  output in the calling thread, and every existing SVG test runs through the worker). A drawing that takes longer
  than 5 seconds to clean is refused with a message that says what to do (simplify it, or save it as PNG); where
  that point lies depends on the server's speed. One file is cleaned at a time, so many large SVGs sent at once
  wait for each other, at most 20 seconds each. The server process uses about 90 MB more while the worker is idle
  and up to 512 MB more while it cleans one file (`docs/ops/docker.md`). The folder prefix `hvl-svg-` now belongs
  to `SvgCleaner.ts`; D-118's start-up sweep looks for it there.
- **Amendment (2026-11-20): the memory limit is held twice.** Node's limit for a worker thread is not in force
  when the process is started with a heap flag (`--max-old-space-size`, on the command line or through
  `NODE_OPTIONS`): V8 then gives every thread the process's limit. Operations often set that flag, so the limit
  must not depend on its absence. While a file is being cleaned, the main thread asks the worker for its heap use
  every 50 ms (`worker.getHeapStatistics()`, answered within milliseconds also while the worker is busy) and stops
  it past the limit (`security/svg/svgCleaningLimits.ts`, which now also holds the numbers and the folder prefix
  `hvl-svg-`). A test starts a process with the flag and checks that a file past a small limit is refused.

### D-120 · Security repairs, step 4: limits on a learner's saved state and on what an author sends
- **Context:** H5P-005 keeps a learner's answers so that a reload resumes them, and SEC-005 limits the size of one
  upload. Neither said how much state one learner may keep, how often it may be saved, or how many files one person
  may send. For the ten content types a real activity keeps exactly one state per learner, activity and course:
  h5p.js saves data type `state` for sub-content `0` (H5P core 1.28, `H5P.setUserData(contentId, 'state', …)`),
  every five seconds while the activity is open; none of the ten libraries saves any other. No spec change.
- **Decision — the names of a state (H5P-005).** The state route accepts data type `state` only and a sub-content
  ID that is `0` or a UUID; any other name is 400, for reads and writes, before the storage is asked.
- **Decision — how much one learner may keep (H5P-005).** Per learner, activity and course: at most 20 states,
  each at most 512 KB, together at most 1 MB (`h5p/storage/learnerStateLimits.ts`), counted as the stored JSON
  text. A state past a limit is 413 and stores nothing. A write counts and stores in one transaction that first
  takes a lock for that learner, activity and course (`pg_advisory_xact_lock`), so writes at the same moment
  cannot pass the limits together; it holds the activity's row in share mode as before (D-093). Replacing a stored
  state counts only the difference, and deleting one (`data=0`) is never refused.
- **Decision — how often (H5P-005).** 60 saves a minute per learner and activity, counted in Redis before the body
  is read; past it 429 `hvl:rate-limited` with `Retry-After`. h5p.js ignores a refused autosave, so a learner at a
  limit keeps what was saved before and sees nothing.
- **Decision — what a page load reads (H5P-005).** The player's preload reads only states marked `preload` (all
  that Lumi's one caller keeps), at most 20 rows, the main state first, and passes on at most 1 MB in all,
  whatever the table holds.
- **Decision — what one author may send (SEC-005, SEC-001).** 120 editor file uploads and 20 package imports per
  author in ten minutes, counted before the body is read; past a limit 429 `hvl:rate-limited` with `Retry-After`
  (`http/h5pRouteLimits.ts`). And an author whose SVG files were refused as too complex (D-119) three times in ten
  minutes gets the same answer for further SVG files until the ten minutes end: the cleaning worker takes one file
  at a time, and this keeps one person from holding it. Other files and other authors are not affected.
- **Why these numbers:** each is far above what the player and an author at work send (one state of a few
  kilobytes, twelve saves a minute per open tab, a handful of files), and low enough that one person's worst case
  is small: 1 MB per activity and course, and a bounded number of requests that reach the disk, the scanner or the
  cleaning worker. They are constants, changed by a new decision, not settings.
- **Consequences:** Nothing changes for an ordinary learner or author. The counters are four new Redis keys with a
  number under an account ID (and an activity ID for saves), listed in `docs/privacy/DATA-INVENTORY.md`. Every
  state write now runs in a transaction with one extra indexed count. The limits are not applied to states stored
  before this step; the preload bounds what such rows can cost.

### D-121 · Security repairs, step 5: limits on stored xAPI statements and on what insight lists from them
- **Context:** LTI-011 stores the player's statements with DATA-012's minimal fields, 120 a minute per learner and
  activity (D-115), and insight (INS-001 to INS-006) is built from the stored rows. Three things had no bound: the
  `subContentId` of a part's answer was any text of up to 64 characters from the learner's browser, and INS-002
  listed every `subContentId` it found; nothing limited how many statements a learner may add over time; and the
  replay rule (D-115) read back every stored row of the batch's page loads. No spec change.
- **Decision — a part's answer is stored only under a UUID (LTI-011, DATA-012).** H5P's sub-content IDs are UUIDs.
  `classifyXapiItem` discards a part's `answered` whose sub-content ID has any other shape, counted as `invalid` in
  the batch's log line like an item that fails the contract. The contract's item schema is unchanged.
- **Decision — a limit per day beside the one per minute (LTI-011).** 3 000 statements per learner and activity in
  24 hours (`XAPI_STATEMENTS_PER_DAY` in `xapi/XapiRateLimit.ts`), a second fixed window in Redis that only
  batches the minute's limit allowed are counted in. Past it the batch is refused whole with 429 and
  `Retry-After`, as past the minute's limit. A learner at work sends about 22 statements a minute at most (probe
  P1), so a long working day stays far below it.
- **Decision — the replay rule reads a window (DATA-012).** `XapiStatementStore.replayHistory` reads the learner's
  latest 500 rows for the activity, newest first, in one query the `[learnerKey, contentId, timestamp]` index ends
  after the window, and takes the rule's facts from them. The rule (`xapiReplayRule.ts`) is unchanged and gets
  the same facts as before for any learner with fewer than 500 rows since their latest result. Beyond the window
  a page load reads as having no stored answer and a result as not stored, which can at most store a repeated
  result once more or drop one after 500 other statements; neither is reachable by normal use. Not chosen: a query
  per page load (it must look through all the learner's rows when a page load has no result), or a new index on
  `attemptId` (a migration for a case the window already bounds).
- **Decision — insight lists a question outside the current content only for k learners (INS-002, INS-006).** A
  `subContentId` that is not in the activity's current parameters (a question of an older version) is listed only
  when at least *k* learners answered it, most learners first, and at most 50 of them (`MAX_UNLISTED_ITEMS` in
  `insight/aggregate/itemDifficulty.ts`). So one learner's statements can neither add a row to a teacher's view
  nor put an ID of their own choosing in it. Questions of the current content are listed as before, with their
  counts suppressed below *k*.
- **Consequences:** Nothing changes for an ordinary learner or teacher. One new Redis counter
  (`hvli:xapi-day:<userId>:<contentId>`, a number, 24 hours), listed in `docs/privacy/DATA-INVENTORY.md`. A view of
  an older version no longer lists a question that fewer than *k* learners answered; its cells were suppressed
  already.

### D-122 · Security repairs, step 6: one insight view reads at most 200 000 stored statements
- **Context:** INS-001 to INS-005 are counted in the server from the stored rows of one activity, version, context
  and period (D-106), and INS-009's CSV is the same view. The read was one query for every row of the scope,
  whatever their number. No spec change.
- **Decision — a view covers at most 200 000 stored statements (INS-001, INS-009).**
  `insight/data/readInsightStatements.ts` first asks the database whether the scope holds more than
  `INSIGHT_READ_LIMITS.maxStatements` rows, in time order on the `[contentId, contextId, timestamp]` index and
  without a row leaving the database. A scope that does is refused (`InsightScopeError`, `viewTooLarge`). The
  number: a course of 1 000 students who each do a 50-question activity three times stores about 150 000.
- **Decision — below the limit the rows are read in pages.** 10 000 rows at a time, each page starting after the
  last row of the one before by the order's own columns (`timestamp`, then `id`), and made into the aggregators'
  statements as they arrive, so the server never holds more than one page of stored rows. The numbering of
  learners and page loads continues across pages, so the view is the same as from one read.
- **Decision — the API answers 422 `insight.viewTooLarge`, and the tab says what to do.** A status of its own, so
  the web app can tell this refusal from a query the activity cannot answer (400). The Innsikt tab shows «Denne
  perioden har for mange svar til at innsikta kan visast samla. Vel ein kortare periode …» as an alert and keeps
  the period, version and course choices, also when the first view is the one refused. The view and the CSV export
  share the answer. A refused view is not audited, like the other refusals: nothing was shown.
- **Measured (2026-11-20, the development container):** a view of exactly 200 000 statements of 1 000 learners
  took about 1 second and about 100 MB of heap above the idle server, and completes with Node's old-space limit
  at 128 MB; refusing a scope of 2 000 000 statements took about 50 ms and no measurable memory.
- **Consequences:** Nothing changes for a view within the limit. A period over it shows no view until a shorter
  one is chosen. The contract documents 422 for `getInsight` and `exportInsightCsv`. New texts in nn, nb and en:
  `insight.viewTooLarge` (server) and `insight.tooLarge` (web).

### D-123 · Security repairs, step 7: a save stores only what the semantics describe; three more types refused as sub-content; production runs with the web app
- **Context:** SEC-008 has content parameters cleaned by their semantics on save, H5P-002 (c) keeps
  `H5P.DragQuestion` out of sub-content, and LTI-006 shows the player inside the web app's page (`/app/play`).
  Lumi's `SemanticsEnforcer` cleans text fields and checks sub-content; its own source lists removing the keys the
  semantics do not name, and checking the other values, as not yet done. H5P's PHP validator
  (`H5PContentValidator`) does both before content is shown. The owner decided two questions on 2026-11-21 (the
  fourth and fifth decisions below).
- **Decision — on every save the parameters are fitted to their semantics, as H5P's validator does (SEC-008).**
  `h5p/semantics/semanticsConformance.ts` runs at the end of `SubContentPolicy.enforce`, so for a new activity, an
  edit, a copy and a pattern alike. It removes every key a field list does not name: in a library's parameters
  and in a group; a sub-content entry keeps `library`, `params`, `subContentId`, `metadata` and its field's
  `extraAttributes`; a file value keeps H5P's keys for its kind (`fileValueConformance.ts`). A `subContentId` is
  kept only when it is a UUID. A number is a finite number within `min` and `max` (a numeric string becomes a
  number), a boolean a boolean, a select one of its options, a file's `mime` a plain `type/subtype` and its sizes
  numbers. What does not fit is removed, not refused: content from other H5P systems and from older library
  versions carries harmless leftovers, and H5P's own validator removes them too. How many keys and values a save
  lost is logged, never what they held.
- **Decision — a single-field group has one stored form (SEC-008).** H5P's editor stores such a group as the
  field's value, and its player reads it so. Lumi's `ContentScanner` also reads an object with a key named like
  the group as the group itself. `paramsWalker.ts` now reads every single-field group as its field, so a list
  there must be a real array, and refuses a value Lumi would read the other way (400 `hvl:invalid-params`).
- **Decision — refusals first, fitting last.** The refusals of D-039 (a library a field does not offer, a
  `library` value under a key no field names, an unsafe file path wherever it sits, nesting that is too deep) are
  unchanged and run before anything is removed, so a refused save is left as it came.
- **Decision — three more types are not accepted as sub-content (H5P-002; the owner, 2026-11-21).** The
  containers among the ten offer nine installed types beside the ten. Six stay, because the project already
  adapts and checks them (the feedback prefixes, the validator's rules): `H5P.TrueFalse`, `H5P.SingleChoiceSet`,
  `H5P.MarkTheWords`, `H5P.Summary`, `H5P.MultiMediaChoice` and `H5P.Dialogcards`. `H5P.AudioRecorder` (records
  the learner's voice), `H5P.TwitterUserFeed` (loads a third party's content) and `H5P.Questionnaire` (a survey
  with free-text answers) join `H5P.DragQuestion` in `EXCLUDED_SUB_CONTENT`: no library field offers them in the
  editor, and a save that carries one is refused with 403 `hvl:sub-content-not-allowed`. The libraries stay
  installed. Spec 01 §3 says so.
- **Decision — production runs with the web app (LTI-006; the owner, 2026-11-21).** `productionChecks.ts`
  refuses `WEB_APP=off` under `NODE_ENV=production`, named or left at its default, as it refuses `dev`. `off` and
  `dev` stay for tests and development. The image and `deploy/compose.app.yml` set `prod` already.
- **Verified:** the example activity of each of the ten types and every pattern skeleton (nn, nb and en) pass the
  fitting with nothing removed or changed, with one exception. BranchingScenario's editor writes a `contentId`
  into each content node, which its semantics do not name; the player numbers the nodes itself when it starts,
  so the key goes like any other.
- **Consequences:** An activity that holds one of the three refused types as a piece still plays, and must have
  the piece taken out before it can be saved again. A production deployment with `WEB_APP=off` no longer starts,
  and says why. Text PostgreSQL cannot store (PROD-012) no longer refuses a save when it sits in or under a key
  no field names: it goes with the key. No new stored data.

### D-124 · Security repairs, step 8: the player and the editor are handed fitted content, whatever the stored row or the package holds
- **Context:** D-123 fits the parameters to their semantics on every save. Content also reaches a browser without
  passing a save: the player reads the stored row, the editor reads it when an activity is opened, and an uploaded
  package's content.json goes to the editor before anything is saved. H5P's own server software fits content each
  time it is shown or edited, and hands the editor text in the form of PHP's `htmlspecialchars` (a double quote as
  `&quot;`); H5P's editor writes a text field's value straight into `value="…"` on that assumption. Lumi stores a
  plain `"` in text and hands rows over as they are.
- **Decision — fit when read; stored rows are not rewritten (SEC-008, H5P-004).** `h5p/semantics/playedParams.ts`
  wraps the player's `render`: every model's `jsonContent` goes through D-123's fitting. Nothing else is judged
  again: text was cleaned when the row was saved, and no sub-content is refused, so what could be stored still
  plays. Rewriting the rows once was not chosen: it needs an operator's step at each deployment, and a row
  written later by other means would escape it. Fitting when read needs neither, costs one walk over cached
  semantics, and the row is fitted for good at its next save.
- **Decision — the editor's form is handed cleaned content (SEC-008, SEC-005, H5P-006).**
  `h5p/semantics/editorFormParams.ts`, put on the editor's `getContent` and `uploadPackage` by
  `h5p/editorFormReads.ts`: the parameters are fitted, every text field is cleaned by the save's rules, what the
  "Rights of use" dialog renders is cleaned and an unsafe file path refused. In every text field that is not rich
  text, and in title data (`metadata`, `copyright`), `"` is written `&quot;` and `'` `&#039;`, as the editor's own
  `htmlspecialchars` writes them. A save reads both forms alike, so what is stored does not change. No
  sub-content is refused here: an activity or a package with a type the save refuses still opens, and the author
  can take the piece out.
- **Decision — an import whose content cannot be read is a 400 (PROD-012).** `h5p/libraries/packageContentCheck.ts`
  walks the content of a non-admin's package by its semantics before Lumi's importer does. Content whose values
  do not have the JSON types Lumi's scanners assume is refused with `hvl:invalid-params`, where Lumi's walk ended
  with a TypeError.
- **Verified:** BranchingScenario's editor opens and saves its example with and without the `contentId` D-123
  removes (the same five nodes, no error). A label with a double quote, cut off at the quote before, is shown
  whole in the editor, and so is the title.
- **Consequences:** A text with a quote is no longer cut off when an activity is opened for editing. A row that
  cannot be read as its semantics describe, which the editor's save never stores, fails to play or to open with
  400. No new stored data.

### D-125 · Security repairs, step 9: a web-app page is framed by nothing, the player frames only outside media, and three controls ask first
- **Context:** Since D-070 a page of our own origin could frame any other page of ours: web-app pages were sent
  with `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN`, and H5P pages with `frame-src 'self'`. The H5P
  player is a page of our own origin, and what it shows is content that authors made. On the activity page three
  controls acted on a single press: «Gjer om til utkast», «Fjern» for a co-author and «Ta ut av innhaldsbanken».
  A page of ours shown inside an activity would put those controls under whatever the activity draws over them.
  D-123 and D-124 keep content from carrying a frame of its own; this step does not rest on that.
- **Decision — a web-app page is framed by nothing (DATA-011, LTI-003).** `web/webRoutes.ts` sends every web-app
  page without a Canvas launch with `frame-ancestors 'none'` and `X-Frame-Options: DENY`. Nothing of ours shows
  such a page in a frame: the web app frames the H5P player and editor, never the other way round. A page with a
  launch (`/app/*`) keeps its rule: our own origin and `CANVAS_ORIGINS`, and no `X-Frame-Options`. The H5P pages
  and the server's own message pages keep `frame-ancestors 'self'`, because the web app shows them in its frames;
  they hold no control that changes an activity's status, authors or listing.
- **Decision — the player frames only outside media (DATA-011).** `http/h5pPageCsp.ts`: a player page's
  `frame-src` lists `EXTERNAL_MEDIA_ORIGINS` only, and is `'none'` when there are none. The editor page keeps
  `'self'`. The frames H5P builds itself start from an empty page it writes into, which `frame-src` does not
  refuse. This replaces D-070's `frame-src 'self' <EXTERNAL_MEDIA_ORIGINS>` for the player page.
- **Decision — three controls ask before they act (PROD-007, UD-006).** `components/ConfirmDialog.tsx`, built on
  the existing `Dialog` (focus moves in, Escape closes, focus returns to the control): a question as the heading,
  one sentence on what follows, the action and «Avbryt». It is used by «Gjer om til utkast»
  (`features/activity/CheckPanel.tsx`), by «Fjern» and «Fjern meg» in the co-author list
  (`features/sharing/CoAuthorSection.tsx`) and by «Ta ut av innhaldsbanken»
  (`features/sharing/BankUnlistButton.tsx`). The first press sends no request; «Avbryt», «Lukk» and Escape send
  none either. Publishing and listing already asked (their dialogs carry the check's result and the conditions).
- **Why both.** The framing rules are enforced by the browser, header by header. The question is ours, and holds
  whatever a browser does with a header and whatever a later change does to one. Either alone would do; an
  activity going back to draft in the middle of a course is worth two.
- **Verified:** the ten real content types play with the tighter `frame-src`, interactive video and course
  presentation included. In a browser, a web-app page put in a frame by a page with the player's policy is refused
  by `frame-src`, and by a page with the editor's policy by `frame-ancestors 'none'`; opened directly it loads.
  Each question passes the axe scan, and the «Fjern meg» journey is answered by keyboard alone.
- **Consequences:** A web-app page can no longer be embedded in any page, ours or another site's. An activity
  cannot embed another page of this service in a frame; embedding goes through the content types' own
  sub-content. The three actions take one more press. No new stored data.

### D-126 · Security repairs, step 10: one activity's parameters have a size limit, checked before anything reads them
- **Context:** SEC-005 limits files and packages. The parameters of an activity (content.json) and its metadata
  were bounded only by the size of the request, 20 MB. Every step of a save reads them, and each was written for
  content an author makes in the editor: the example activity of each of the ten types is 2 to 15 kB with at
  most 350 values, and a very large real activity is around 1 MB. Some steps take time that grows with the
  square of what they read. htmlparser2 12.0.0, which sanitize-html (Lumi's cleaning and ours) and our own text
  reading parse with, keeps the open tags in a list it adds to at the front, so a text whose tags are never
  closed costs the square of its length. Lumi's pattern for a library and its version, `/.+ \d+\.\d+/`, tries
  every start for every space. Our comparison of two text lists compared each item with every item, and the
  trim of a drag word's trailing white space used `/\s+$/`.
- **Decision — the limits (SEC-005, PROD-012).** `h5p/semantics/contentBudget.ts`, for the parameters and for
  the metadata of one activity: 4 000 000 characters in all strings and keys together; 200 000 values (objects,
  lists and leaves); one string 200 000 characters, with at most 100 tags open at once; a key 256 characters; a
  string under a key named `library` 255 characters. One iterative pass that stops at the first limit passed.
  Past a limit the answer is 400 `hvl:content-too-large`, with a message in nn, nb and en that says whether the
  activity as a whole, one text's length or one text's formatting is the reason, and nothing from the content.
- **Decision — open tags are counted by the parser itself.** `h5p/semantics/markupDepth.ts` feeds the text to
  htmlparser2 in pieces of 2 048 characters, counts the tags it opens and closes, and feeds no further piece
  once the limit is passed. The count is therefore the parser's own (a `<p>` it closes by itself and a `<br>`
  count as it treats them), in this version and in a later one, and counting costs time that follows the
  text's length.
- **Decision — checked first, at every door.** `http/routes/contentSaveBodies.ts` reads the body of a save, of
  «Lagre som ny versjon» and of the editor's paste check (`action=filter`, where Lumi cleans what it is sent),
  and checks the limits before the publish gate's validator, the sub-content policy or Lumi read anything.
  `SubContentPolicy.enforce` checks them on every save, the server's own included. `packageManifest.ts` checks
  the content.json of an imported package, `editorFormParams.ts` what the editor's form is handed. A save
  request is at most 6 MB, where it was 20 MB.
- **Decision — a list holds at most its field's `max` (SEC-008).** The fitting of D-123 cuts a longer list to
  `max`, as H5P's own server software does (`validateList`); the editor never adds more. H5P.InteractiveBook's
  `chapters` (50) and H5P.Blanks' `questions` (31) are such lists. A long list is written back item by item: a
  list of 150 000 numbers ended the save with a RangeError before.
- **Decision — three steps read long input in time that follows its length (PROD-013, H5P-002).**
  `libraryReferences.ts` tests for a library and its version with `/[^\n\r  ] \d+\.\d/`, which
  matches exactly when Lumi's pattern does; Lumi's own copy only ever reads 255 characters. `structuralChange.ts`
  compares two text lists through a set. `answerMarkup.ts` trims with `trimEnd()`. A stored version past the
  limits is not compared by `LearnerStateGate`: the save counts as structural, so the author is asked before
  saved progress is reset.
- **Why these numbers.** Four times the largest activity we expect, and small enough to measure. The largest
  content inside the limits (nineteen texts of 200 000 characters, each with 100 tags open throughout) is
  measured by the limit pass in 0.17 s, cleaned by sanitize-html in 0.5 s and saved through the route in about
  1.4 s (1.1 s without the check). One text of 200 000 characters whose tags are never closed took 0.37 s to
  parse; the limit pass refuses it in 2 ms.
- **Verified:** the example activity of each of the ten types is inside every limit, at less than a hundredth
  of the largest size; the new pattern agrees with Lumi's on a table of values and on 300 000 random strings.
- **Consequences:** Content brought in from elsewhere with one text over 200 000 characters, or with more than
  100 tags left open in one text, is refused with a message; the H5P editor produces neither. A list past its
  `max` loses the items after it when saved. No new stored data.

### D-127 · Security repairs, step 11: the validator reads only content within the limits, in time that follows its size; a slow pattern is a lint error
- **Context:** D-126 keeps content past the limits from being stored. The validator (UD-020) reads the stored row
  for the findings list, on publishing and for every activity in the mappe, and the submitted form when a
  published activity is saved. A row can be written by other means than a save. Inside the limits, two rules took
  time that grew with the square of what they read: V-LINK-TEXT trimmed a link text with a pattern that tried
  every start in a run of punctuation, and PED-H10 went through all nodes once for each chapter of an Interactive
  Book. Several rules parsed texts that the walk had parsed already, and the validator builds a path for
  everything it reads.
- **Decision — a guard where the validator is wired (UD-020, SEC-005, PROD-003).** `content/boundedValidator.ts`
  wraps the validator in the publish flow's dependencies (`content/publishingDeps.ts`, which `createApp` builds
  them with): parameters or metadata past a limit of D-126 are answered with exactly one finding, `V-SIZE`, an
  error at the path of the activity as a whole, with a message in nn, nb and en, and the validator is not called.
  The findings list, publishing and the save of a published activity share the guard, and the mappe lists the
  finding, so it never shows an unchecked activity as one without findings. The guard lives outside
  `src/validation`, which imports nothing but itself (D-073); no rule file produces `V-SIZE`.
- **Decision — one more limit (amends D-126).** `CONTENT_LIMITS.pathCharacters`: the paths of all values of one
  activity together are at most 50 000 000 characters, a path counted as its keys and indices with their
  separators. It bounds the memory the paths of one check can take. The example activity of each of the ten types
  has at most 14 000.
- **Decision — two rules read in time that follows the size of what they read (UD-021, PED-020).**
  `rules/linkTextRule.ts` finds the punctuation around a link text by stepping over its characters once from each
  end. `rules/chapterInteractionHint.ts` tallies every chapter of a book in one pass over the nodes after it,
  which come in pre-order. The verdicts are the same.
- **Decision — one validation run parses each distinct text once (UD-020).** `richText.ts` has a reader that keeps
  what it has parsed; `rule.ts` builds a scope with one reader per run (`ruleScope`), the walk reads through it,
  and every rule and helper reads through its scope. Nothing is kept between runs, so the validator stays pure.
- **Decision — a slow pattern is a lint error (NFR-004, NFR-002).** `eslint-plugin-regexp` 3.3.3, a development
  dependency (four packages, MIT), with `regexp/no-super-linear-move` and `regexp/no-super-linear-backtracking` as
  errors for `apps/server/src`, `apps/web/src` and `packages/*/src`. It found five places, each rewritten to give
  what it gave before: the slashes at the end of the Groups API URL, the hyphens and dots at the ends of a copied
  file name, the tip of a drag word in insight, the backslashes in front of quotes in the build-secret scan
  (`(?<!\\)` lets a match begin only where a run begins) and the end of a JSON error message. No exception was
  needed.
- **Why the validator runs in the server's own process still.** With the limits and these changes, the guard and
  the validator together take at most about a third of a second on content inside the limits: nineteen texts of
  200 000 characters 0.13 s, 20 000 small texts with a finding each 0.33 s, a book of 50 chapters with 400 texts
  each 0.34 s. A worker would add a queue and a second wiring of the validator for that much work.
- **Verified:** every rule fixture gives the findings it gave (the rule tests), and no fixture has a text parsed
  twice. The five rewritten functions and the link-text rule were compared with the earlier code on lists of
  inputs and gave the same. A book with 2 000 chapters of ten texts went from 2.7 s to 0.2 s, and a link text of
  199 000 punctuation marks is judged in 9 ms.
- **Consequences:** A stored activity past the limits shows one finding on «Sjekk og publiser» where it showed
  the validator's own. A new development dependency. No new stored data.

### D-128 · Security repairs, step 12: limits per person on new activities, the planner and the mappe; the planner and the mappe do their work in bounded portions
- **Context:** Three things a signed-in author asks for cost the server work the author chooses the amount of. A
  new activity is a save. The planner (PED-031) read every activity of a course and built its grid by going
  through all of them once for each cell. A mappe (MAPPE-001) read up to fifty selected activities with their
  parameters in one query, checked them one after the other without a pause, and listed every finding. None of
  the three was counted per person.
- **Decision — three limits per person (PROD-007, PED-031, MAPPE-001).** Fixed ten-minute windows in Redis, with
  the counter of D-090 and D-120 (`PersonRateLimit`): 60 new activities (the editor's save of a new activity and
  the creation from a pattern count under one key; copies keep D-092's limit of their own), 120 planner
  requests, and 120 mappe previews and exports together. Past a limit the answer is 429 `hvl:rate-limited` with
  `Retry-After`, before the request is read. `http/h5pRouteLimits.ts` holds the first,
  `learningDesign/http/studioRouteLimits.ts` the other two.
- **Why these numbers.** An author at work creates a handful of activities in an hour, opens the planner now and
  then, and gets a mappe preview each time the choice of activities rests (the page waits 400 ms after a change),
  which is 30 to 50 in a busy session. The limits are several times that.
- **Decision — a planner holds at most 300 activities (PED-031).** `metadata/plannerSource.ts` reads the 300 most
  recently changed activities of the course and one more, which tells whether there are more; the answer's
  `moreActivities` says so, and the page then says how many it shows. A course has a few dozen activities.
  `metadata/plannerGrid.ts` files each activity under its outcomes and its phase in one pass: the same rows,
  cells, order and gaps as before.
- **Decision — a mappe reads and checks one activity at a time (MAPPE-001, MAPPE-002).**
  `mappe/mappeActivitySource.ts` lists the selected activities without their parameters; `MappeRenderer` then
  reads each activity's parameters, checks them and lets them go before it reads the next one's. The server holds
  one activity's parameters at a time, and each read is a pause in which it answers other requests.
- **Decision — a mappe lists the first 50 findings of an activity (MAPPE-002).** The universal design status
  still counts all errors and warnings; when an activity has more than 50 findings the status line ends with a
  sentence that says the first 50 are listed (nn, nb, en). The templates in `content/mappe/` are unchanged.
- **Verified:** a grid of 3 000 activities with twenty outcomes each took 18 s to build and takes under 2 s; the
  planner's existing table tests give the same result. The mappe's existing exports are unchanged.
- **Consequences:** An author who passes a limit waits up to ten minutes. A course with more than 300 activities
  of one author shows the 300 most recently changed in the planner. A new field in the planner's answer. Three
  new counters in Redis, each a number under an account ID (`docs/privacy/DATA-INVENTORY.md`).

### D-129 · Security repairs, step 13: a Canvas user is known per platform registration; launch input no platform sends is refused with 400
- **Context:** A person who arrives from Canvas was known by the launch's issuer and `sub`: the account by a keyed
  hash of `lti|<iss>|<sub>` (D-055), the learner pseudonym by the yearly HMAC of the same text (D-011, DATA-002).
  A platform, though, is registered by issuer **and** client ID (LTI-001), because every Canvas that Instructure
  hosts sends the same issuer (`docs/reference/canvas-platform-values.md`), and a `sub` is unique within one
  platform only. With two registrations of one issuer, the same `sub` from either would have been one account and
  one pseudonym. D-103 keeps courses apart per platform; the identity did not. Which Canvases HVL Interaktiv will
  be connected to is not decided (owner, 2026-11-21), so the rule must hold for any number of registrations.
  Separately, a login field or a launch claim holding a character PostgreSQL cannot store failed inside the
  database driver and was answered with 500 and an error line, although the sender was at fault (PROD-012).
- **Decision — the identity text names the registration (DATA-002, LTI-001).** It is
  `lti|<iss>|<client-id>|<sub>`. The client ID is the registered platform's: ltijs writes it on the stored
  launch after it validated the token against that registration, and `lti/launchFacts.ts` reads it from there,
  never from a claim. The identity hash and the learnerKey are both derived from this one text
  (`privacy/deriveLearnerKey.ts`, `auth/identity/subjectSources.ts`): at the launch, for a request that resumes a
  launch, in account linking (AUTH-005) and in the data-subject tool. Neither issuer nor client ID may contain
  `|` or a control character; `LTI_PLATFORMS` refuses one that does, so the text reads one way whatever the `sub`
  holds.
- **Why issuer and client ID, and not the platform row's ID.** They are what `LTI_PLATFORMS` says, so the
  data-subject tool derives a person's keys from what an operator knows, without a database row. They name the
  registration exactly as the row does, since the pair is unique.
- **Decision — the data-subject tool takes the client ID (DATA-008; amends D-108's input form).** A Canvas
  identity on standard input is `{"issuer": "…", "clientId": "…", "sub": "…"}`. One without `clientId` is refused
  by field name; the tool never guesses a registration.
- **Decision — nothing is converted.** HVL Interaktiv has not been used by real people through Canvas (owner,
  2026-11-21); only test data exists. A hash of the earlier text can never match a launch again, and left on a
  Feide account it would count as another person's identity from the same platform when that teacher is linked
  anew (D-063). The migration `20261121190000_lti_identity_per_registration` therefore removes the `Identity`
  rows of provider `lti`; accounts and Feide identities stay. A person who used a test Canvas gets a new account
  at the next launch, a teacher's Canvas identity joins their Feide account again at the next Deep Linking
  launch, and an ltik from before the change answers «open again from Canvas». Learner rows under the earlier
  pseudonyms go with the yearly purge (DATA-003).
- **Decision — launch input no platform sends is the sender's error (LTI-001, PROD-012, NFR-006).**
  `lti/ltiInputText.ts`: a query or form field of the login and launch routes with a control character is
  refused before ltijs reads any field; of the claims that are stored, the `sub` may hold no control character,
  and every string and key must be text the database can hold (no U+0000, no unpaired surrogate; a description
  on several lines is fine). The check runs before the deployment check and the write. The answer is 400
  `hvl:launch-malformed` with the existing «could not be opened from Canvas» page, logged as a warning with the
  fixed code and, on the launch route, audited as a failed launch (`launch-invalid`). An issuer, client ID or
  nonce that no row could hold is "not found" in `PrismaLtiDatabaseManager`, never a query.
- **Consequences:** Changing a Canvas developer key (a new client ID) gives its users new accounts and new
  pseudonyms, as a new platform already gave their courses new IDs (D-103): keep the key, or plan the change
  for the turn of the academic year. A person who uses two registrations is two learners in the counts. The
  operator of a data-subject request needs the client ID from `LTI_PLATFORMS`
  (`docs/ops/data-subject-requests.md`). One data-only migration; no new stored field.

### D-130 · Security repairs, step 14: an ltik reaches only what its launch's pages ask for; an address with an ltik counts only from our own pages
- **Context:** The ltik stands in for a cookie in the Canvas frame (LTI-003, D-058): a signed token that names
  the stored launch and lives for 24 hours. Every request with a valid ltik acted as the launch's account without
  further limit, so the token of a teacher's launch could list, create, delete and download that teacher's
  activities and change their sharing, none of which a Canvas page does. And the four pages a launch lands on
  (`/app/play`, `/lti/play`, `/lti/edit`, `/lti/deeplink`) took an address with an ltik wherever the browser came
  from, for the token's whole life: someone who followed a link carrying another person's ltik worked inside
  that person's launch.
- **Decision — a list per kind of launch, default deny (LTI-003, LTI-004, LTI-006, PROD-007).**
  `lti/ltikScope.ts` lists the methods and paths the Canvas pages ask for. `auth/requestPrincipal.ts` asks it
  for every request that carries an ltik, as a Bearer token or in one of H5P's URLs, and answers anything else
  with 403 `hvl:not-from-canvas` («this cannot be done from Canvas; open HVL Interaktiv in the portal»; nn, nb,
  en). A resource-link launch reaches the launched activity's saved state and xAPI answers and, for its author,
  the Canvas editor (H5P's AJAX, the stored parameters, the save, and the findings that block a save), insight
  and the score status of the launch's course; an ID in the path must be the launch's own activity. A Deep
  Linking launch reaches no activity route: its picker and its answer are LTI routes that check the launch
  themselves (D-061). Every launch may ask `GET /api/me` and acknowledge a notice. Routes the API contract marks
  `auth: 'none'` (D-089) answer as they do without a token. The list was drawn from what the pages were recorded
  to ask in the integration tests and the browser journeys. Each route's own role and permission checks still
  run; the list only narrows what reaches them.
- **What an ltik no longer reaches.** The list of activities; creating, deleting, downloading and copying an
  activity; publishing and unpublishing; sharing, which had no control on a Canvas page (PROD-006); the
  portal's own player and editor pages; and every activity but the launched one. These need the portal's Feide
  session. A route added later is closed to ltiks until it is listed.
- **Decision — the lifetime stays 24 hours.** ltijs fixes it, and a working day in Canvas (an author who edits,
  a learner who returns to a long activity in the same tab) needs no second launch. What a held token is worth
  is now bounded by the list.
- **Decision — an address with an ltik counts only from our own pages (LTI-003).** `lti/landingLtik.ts`, used by
  the four landing routes: when the browser sends `Sec-Fetch-Site` and it is not `same-origin`, the address is
  refused before the ltik is looked at; when the browser sends no fetch metadata, the address is accepted only
  within ten minutes of the ltik's issue. The answer is the «open it again from Canvas» page
  (`hvl:ltik-invalid`), as for any ltik that is not valid. This refuses no launch: ltijs 7 processes a launch
  only on its own second POST, which it requires to be same-origin (D-050), so the redirect to the landing page
  is a same-origin navigation, and the frames inside `/app/play` are ours. Measured in Chromium through the mock
  Canvas: every landing arrives with `Sec-Fetch-Site: same-origin` and `Sec-Fetch-Dest: iframe`.
- **Consequences:** A copied or bookmarked address with an ltik no longer opens. In a browser that sends no
  fetch metadata (Safari before 16.4), the **Rediger** tab first opened more than ten minutes after the launch
  asks for a new launch. `LTIK_QUERY_PATHS` holds only H5P's two URL shapes; the landing pages read their own
  address. Browser tests that hold an ltik arrive through `test/support/openLanding.ts`. No stored data
  changes.
- **Amendment (2026-11-25, D-141):** that ltijs requires its second POST to be same-origin held only for browsers
  that send fetch metadata; since D-141 our handler requires it of every browser, by `Origin` where
  `Sec-Fetch-Site` is missing.

### D-131 · Security repairs, step 15: the portal's login, its answers and the save gate are closed to other sites' requests and to a second spelling of an ID
- **Context:** Four small things on the portal side. Starting a Feide login replaces the session a browser has,
  and with Feide's single sign-on it needs no step from the person: a request to `/auth/feide/login` that another
  site made in the background changed the session token under the person's open pages, and a callback with
  made-up values used up the pending login, because the login transaction was taken out of Redis before its
  `state` was compared. Answers about the signed-in person carried no rule against being embedded by another
  site, portal pages kept the window handle of whoever opened them, and some H5P answers behind authentication
  had no cache rule. The publish gate on saves (D-074) took its write lock under the ID as the request wrote it,
  and stepped aside when its lookup found no activity.
- **Decision — only a page the person opened starts a login (AUTH-001, AUTH-003).** `auth/feide/loginNavigation.ts`
  reads the browser's fetch metadata. A request that is no navigation (an image, a script, a background fetch)
  is refused. A whole page that began on our own origin, in the address bar or a bookmark, or with a click by
  the person (a link in an e-mail, in Canvas, on another site) starts the login as before. Any other navigation,
  a page another site opened without a click or a frame, gets the sign-in page (`page.signIn.*`, nn, nb, en),
  whose button starts the login as a click on our own page, in the whole window. A browser that sends no fetch
  metadata is treated as before.
- **Decision — a callback uses up only its own login (AUTH-001).** `/auth/feide/callback` is taken only as a
  page navigation. It looks at the pending login first (`LoginTransactions.peek`) and consumes it, and clears
  its cookie, only when the callback's `state` is that login's; any other callback is refused and leaves the
  login in place for Feide's own answer. Consuming stays single-use (GETDEL).
- **Decision — a page asks once for the current CSRF token (AUTH-003).** When a portal request is refused with
  `hvl:csrf-invalid`, the web app's API client asks `GET /auth/session` once, repeats the request with the
  session's current token and remembers it (`apps/web/src/api/csrfRetry.ts`). The session cookie decides who
  that is; the token only proves the request came from our page, so a page of the same browser may fetch it.
  A session is still replaced at every login (D-057): a login never keeps a session ID that existed before it.
- **Decision — answers about the signed-in person are same-origin only (AUTH-003, H5P-007).**
  `ownAnswerHeaders` (`http/securityHeaders.ts`) on `/api`, `/auth/session` and every H5P route behind
  authentication: `Cache-Control: no-store`, `Cross-Origin-Resource-Policy: same-origin` and the portal framing
  rule. Portal pages send `Cross-Origin-Opener-Policy: same-origin`. LTI pages do not: Canvas frames them, and
  ltijs's Platform Storage messages go to the window that opened or holds the tool (D-050). H5P's static files
  and the signed file addresses come before authentication and keep their own rules.
- **Decision — one spelling of an activity ID (PROD-003, H5P-006).** The content routes read the ID in lower
  case (`contentIdParam`), `PublishedSaveGate` lower-cases it for its lock and its lookup, and it refuses with
  404 when it finds no activity. PostgreSQL finds a UUID in any case, so the check itself ran; what a second
  spelling got past was the lock a publish of the same activity holds.
- **Recorded, not changed — cookies from other `hvl.no` sites.** The session and login cookies have the `__Host-`
  prefix, so no other host can set or replace them. Another site under `hvl.no` can still set cookies for the
  whole domain until a visitor's requests are larger than the proxy or the server accepts; the person is then
  refused until they clear their cookies. This follows from the address, not from the code: it is in the threat
  model (T-43) and the risk analysis (ROS-07) with the two remedies that are HVL's to choose, a page at the
  proxy that says to clear cookies, or a registrable domain of its own (with Q5).
- **Consequences:** One new server page (the sign-in page), scanned with axe. A redirect to our login that
  another site makes without a click (an interstitial, a link checker) shows that page and costs one click. A
  request refused for its CSRF token costs two extra requests once. No stored data changes.

### D-132 · Security repairs, step 16: a backup counts rows at real row ends and reads file keys exactly
- **Context:** The backup tool checks its own work (D-110's backup amendment): it records each table's row count
  from the dump, and a restore compares the counts and looks for content files without an object. The counts
  were taken by counting lines of `pg_restore`'s output with `node:readline`, which ends a line at the newline
  but also at U+2028 and U+2029. A database value may hold those characters (an author or a learner pastes them
  from a word processor), and COPY's text format writes them as they are. Such a row was counted twice: the
  backup recorded a count the restore could never meet, so every restore of that backup reported a difference
  where there was none. The content-file check read the keys through `psql`'s text output, split at line ends
  and at `|`, so a key holding either was read as something else and reported as missing.
- **Decision — rows end at the newline byte only (NFR-002).** `newlineSplitter` in `tools/ops/toolProcess.mjs`
  cuts the output at the byte 0x0A and nowhere else, and decodes each line as UTF-8 after joining its chunks.
  COPY's text format writes a newline inside a value as backslash and `n`, so a newline byte is always the end of
  a row; no other character is.
- **Decision — the restore names the tables that differ (NFR-002, DATA-009).** Its summary has `differingTables`
  beside `tablesDiffering`. A table's name says nothing about a person, and an operator needs to know where to
  look.
- **Decision — keys are read as hex (NFR-002).** `missingContentFiles` asks for
  `encode(convert_to("s3Key", 'UTF8'), 'hex')` and decodes it, so no character of a file name can be taken for the
  end of a field or a row. The other values this tool reads through `psql` are table names it has checked
  against `TABLE_NAME`, counts and version numbers.
- **Verified:** a round trip of rows whose texts and JSON hold U+2028, U+2029 and U+0085, and of content files
  whose keys hold a bar and those characters: the recorded counts are the real ones and the restore reports
  nothing differing or missing. A key with a line break is checked against the database alone, because the
  storage emulator accepts no line break in a key.
- **Consequences:** A backup made before this change keeps the counts it recorded: where a text held one of the
  characters, its restore still reports that table as differing, and now names it; the next backup is right.
  The restore's summary has one more field.

### D-133 · Security repairs, step 17: the server states its mode, a reachable address keeps the key and https rules, every fault ends through the logger, and every answer has a policy
- **Context:** Three things at the server's edges rested on habit instead of a check. (1) The production start-up
  checks (D-055, D-109 and others) ran only when `NODE_ENV` was `production`, and a missing `NODE_ENV` silently
  meant `development`: an installation that lost the variable ran on a real address with every check off, the
  published example keys included, and said nothing. (2) Three kinds of fault went around the logger, which is
  the only place that removes personal data and secrets (DATA-009): a fault after an answer had begun went to
  Express's own final handler, a fault nothing caught and a failed start went to Node's own printing, and the
  debug switches `DEBUG` and `NODE_DEBUG` make libraries and Node print addresses and headers on their own. A
  start that failed after a client had connected could also leave a process that served nothing. (3) An answer
  that is not a page (a status, an error, a static file) carried no `Content-Security-Policy`, so nothing limited
  it if a browser showed it as a page.
- **Decision — the mode is stated (DOC-008).** `NODE_ENV` has no default: a missing or empty value stops the
  start with `NODE_ENV: must be development, test or production`. The same holds for the commands that read the
  whole configuration (`seed:libraries`, `privacy:purge`, `privacy:dsr`). `.env.example`, the image
  (`production`) and the local compose stack (`development`) already state it.
- **Decision — the address decides too (DATA-002, AUTH-001, LTI-001).** When `PUBLIC_BASE_URL` is not a local
  address (`localhost`, a name under `.localhost`, 127.0.0.0/8, `[::1]`), the key rules (no readable text, at
  least 16 distinct bytes, no key in two places; `config/keyStrengthRules.ts`) and the https rules (the public
  URL, Feide, the Groups API, Canvas origins, LTI platform URLs and a set `FILES_BASE_URL`;
  `config/httpsRules.ts`) hold in every mode (`config/publicAddressRules.ts`). A private network address counts
  as reachable: other machines open it. The other production checks stay with the mode, because a test
  installation may rightly lack next year's secret or a TLS database.
- **Decision — the log says which mode runs (NFR-006).** The first start line (`deployment locations`) carries
  `mode`, and a `warn` line follows when it is not `production`. The deployment checklist reads the line and asks
  for one outside check: `GET /api/docs` answers 404 in production.
- **Decision — faults end through the logger (NFR-006, DATA-009).** The app's chain ends in
  `http/lastResortError.ts`: before an answer has begun it sends the error page as before; after, it writes one
  `error` line (method and route pattern) and closes the connection, and never passes the fault on.
  `server/processFaults.ts` turns an uncaught exception and an unhandled rejection into one `fatal` line and exit
  code 1. `server/serverProcess.ts` (the former `main()`) lists a configuration problem by name on standard error
  as before, and writes any other failed start as one `fatal` line before it ends the process with exit code 1; a
  part that does not stop at shutdown is an `error` line. The logger writes to standard output synchronously, so
  the line is out before the process ends.
- **Decision — production refuses the debug switches (DATA-009).** With `DEBUG` or `NODE_DEBUG` set, production
  does not start and names the variable (`config/debugOutput.ts`). Development may use both.
- **Decision — a default policy for every answer (SEC-004, LTI-003).** `baseSecurityHeaders` sets
  `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` on every response; every page (the web
  app, the player, the editor, the LTI pages, the message pages) and every user file replaces it with its own.
  Answers about the signed-in person keep `frame-ancestors 'self'` and gain `default-src 'none'`. The server's
  own start page (`WEB_APP=off`) gets `form-action 'self'` and Feide's origin, as the web app's pages have.
- **Decision — `includeSubDomains` is a switch (LTI-003).** `HSTS_INCLUDE_SUBDOMAINS=true` adds
  `includeSubDomains` to `Strict-Transport-Security`. It is off by default: a browser then refuses plain http for
  every name under the server's host for a year, so HVL IT turns it on once it has confirmed that every such name
  is https only (deployment checklist).
- **Verified:** unit and integration tests for each rule, the entry point started as its own process (the mode in
  the first line; a taken port ends the process with one `fatal` line and no stack around it), a real process that
  fails outside any handler (one cleaned line on standard output, nothing on standard error), and the browser
  suites, which open every kind of page under the new default policy.
- **Consequences:** A `.env` without `NODE_ENV` stops the start. A development or test installation on an address
  other machines reach needs https and random keys. A production start with a debug switch is refused. A start
  that fails after a client connected now ends its process, where it could stay alive before. Test servers that
  stand in for a framed page must say who may frame it, as the real pages do.

### D-134 · Security repairs, step 18: the app container comes back and has a memory limit, the server says whether its memory fits, and work that holds memory waits its turn
- **Context:** Steps 2 to 13 gave each single thing the server does a ceiling: one upload, one SVG (D-119), one
  learner's saved state (D-120), one insight view (D-122), one check of an activity (D-126, D-127). Their sum
  and the deployment around them were left for this step. The app stack had no restart rule, so a server that
  ended its process after a fault (D-133) stayed down, and no memory limit, so one runaway process could take
  the machine. Nothing said how much memory the server may use, and nothing bounded how many insight views or
  saved states were handled at the same moment.
- **Measured (2026-11-22, the development container, Node 24.22.2 in the image):** the heap limit Node chooses
  follows the container's limit: 560 MiB at 1 GiB, 1 120 at 2, 1 728 at 3, 2 240 at 4 GiB and above, 4 288 with
  no limit on a 16 GiB machine. A process past its container's limit is stopped by the kernel with exit code 137
  and no output; past its own heap limit Node first writes «JavaScript heap out of memory». Chromium printing one
  sample mappe: 246 MB in 10 processes. The idle server: about 500 MB resident in all. A saved state at the size
  limit is a form body of about 0.9 MB; after 100 such saves and a collection the heap is back at its baseline,
  so nothing is kept after a request. While a body is read, Express's form parser makes about 6 MB of
  short-lived text from it, and the storage path about 4 MB of buffers. 150 such saves at the same moment ran a
  process with a 256 MB heap limit out of memory; through the gate below all 150 were stored, with the heap at
  most at 179 MB.
- **Decision — the app comes back and has a ceiling (NFR-007, NFR-002).** In `deploy/compose.app.yml` the app has
  `restart: unless-stopped`, `mem_limit: 5g` and `memswap_limit: 5g`; the steps that run once (buckets, migrate,
  seed) have no restart rule. The budget, in MiB: the heap limit Node chooses (2 240), the SVG worker (512), the
  server outside its heap (256), Chromium for two exports (256 + 128) and a full `/tmp` kept in memory (512):
  3 904. 4 GiB is the least that fits while Node chooses its heap; below that the heap needs
  `--max-old-space-size` (docs/ops/docker.md). `tools/deploy-check/resourceRules.mjs` holds the stack file to it,
  and the smoke test stops the server process inside the app container and waits until it answers again.
- **Decision — the server says what it has (NFR-002, NFR-006).** `server/memoryBudget.ts` writes one start line,
  `memory limits`, with the container's limit, the heap limit and what the server may use beside its heap, and a
  `warn` line when production has no limit or when the limit is below the need. It warns and does not refuse:
  the figures for Chromium and for the server outside its heap are measured estimates, and an estimate must not
  keep a working installation from starting.
- **Decision — two insight views at once (INS-001, INS-009).** `InsightService.forActivity` reads and counts a
  view inside a gate (`infra/BoundedGate.ts`, `insight/InsightViewGate.ts`): two at once, twenty waiting in the
  order they came. Past that the view and the CSV answer 503 `insight.busy` with `Retry-After: 5`; nothing was
  read, and nothing is audited. The web app shows its ordinary «could not load» message for it. The scope is
  resolved before the gate, so a refused scope takes no place.
- **Decision — eight saved states at once (H5P-005).** The save route takes a turn in a gate before its body is
  read (`http/routes/stateSaveGate.ts`): eight at once, two hundred waiting, and past that 429
  `hvl:rate-limited` with `Retry-After: 1`, the answer of the per-minute limit, which the player's autosave
  ignores. The place is given back when the response closes, however the request ends.
- **Verified:** unit and integration tests for the rules, the budget, the gates and both answers; the entry
  point's start log holds the `memory limits` line. The smoke test ran in the development container (194 s):
  inside the app container the server wrote `containerLimitMb` 5 120, `heapLimitMb` 2 240, `besideHeapMb` 1 664
  and `neededMb` 3 904 with no warning, and the app answered again after its server process was stopped (restart
  count 1). A container stopped by hand stayed stopped.
- **Consequences:** No requirement changes its meaning; NFR-002 and NFR-007 have an "Amended" line. Whatever runs
  the container in production needs its own memory limit and restart rule; the stack file is the example. On a
  very busy moment a view of insight waits a few seconds, or is asked for again. One more line in the start log.

- **Amendment (2026-11-26, D-144):** the stack's health check is held short by the same rules file
  (`tools/deploy-check/resourceRules.mjs`), and the server writes a warning when it stood still for a second or
  more (`server/eventLoopWatch.ts`). The server does not restart itself when it stands still.

### D-135 · Security repairs, step 19: Next.js is pinned at 16.4.6
- **Context:** D-068 pinned `next` at 16.4.2, the first release past the three advisories its probe found.
  On 2026-11-22 `npm audit` listed seven further advisories, all moderate, for 16.0.0 to 16.4.4:
  GHSA-7qx7-33qx-rqx2 (the image optimiser), GHSA-f3mh-rxg3-f5g2 (Edge runtime routes), GHSA-pc58-hwjq-p385
  (applications that forward fetched responses), and GHSA-mfr8-8qww-v76h, GHSA-rhh4-g77r-r9qj,
  GHSA-vc7v-qv4w-wrv8 and GHSA-vvgp-ww4w-46vf (`use cache` and Cache Components). The web app uses none of
  these: the image optimiser is off (D-068), it has no Edge runtime route, no route handler and no server-side
  `fetch`, and no `use cache`. The framework itself stopped the first run of every build to say that its
  version is affected. SEC-007 asks for a review only of high and critical advisories, so nothing forced this
  update; the owner decided on 2026-11-22 to make it now, because a patch release exists and costs little.
- **Decision — the pin is 16.4.6 (SEC-007).** `next` is 16.4.6, pinned exactly, in `apps/web` and `apps/server`
  (one copy shared by the server and the app, as D-068 set), and `@next/eslint-plugin-next` is 16.4.6 with it.
  The lock file changed in Next.js's own packages only: `next`, `@next/env`, its compiler binaries and the lint
  plugin.
- **Re-checked — what leans on the framework's inner workings.** `apps/web/src/features/lti/ltikFromAddress.ts`
  works with the router's own history marker (D-080's amendment): the router files it depends on
  (`client/components/app-router.js` and `app-router-instance.js` of the installed package) are byte for byte
  the same in 16.4.2 and 16.4.6, its `[LTI-003]` test passes, and its `UPSTREAM:` pointer names the new tag. The
  in-process mount (D-068) is covered by the web integration tests, the browser journeys and the image's smoke
  test.
- **Verified:** `npm audit` lists no advisory for `next`; the first run of `npm run build` passes; screenshots
  of five public pages in nn at 1280 px and 390 px are pixel for pixel the same before and after (two runs of
  the same build are identical too, so the comparison means something); the full gate and the smoke test, whose
  image is built with the new version.
- **Consequences:** No page looks or behaves differently. `docs/assurance/sbom.cdx.json` is regenerated. The
  advisory check (`npm run check:audit`) is not changed by this step: it reads only high and critical
  advisories, and none of these was one.

### D-136 · Security repairs, step 20: the insight CSV follows its language, quotes and guards every field, and carries no ID a learner chose
- **Context:** INS-009 exports a view of insight as a CSV file, which a teacher opens in a spreadsheet program
  (D-106). The file was comma-separated in every language, quoted a field only when it held a comma, a quote or
  a line break, and guarded a field against being read as a formula only at its first character. A Norwegian
  spreadsheet program splits columns at `;` and reads `1.5` as a date, so the file was left to the program's
  guessing: a label with a `;` in it (a question text, a learner's wrong answer in a gap) could be cut in two,
  and the piece after the cut began a cell of its own, where a leading `=`, `+`, `-` or `@` starts a formula.
  Shares and medians came out as text or as dates. And a question that is no longer in the activity (D-121) was
  written with the `subContentId` of the learners' statements: an ID that *k* learners who agree can choose.
- **Decision — the file follows its language (INS-009, PROD-012).** In nn and nb the separator is `;` and the
  decimal mark a comma; in en `,` and a point (`insight/http/insightCsvFields.ts`, `CSV_DIALECTS`). A `sep=` first
  line was not chosen: only Excel reads it, other programs show it as a row, and Excel is reported to stop
  honouring the byte-order mark after it, which would break æ, ø and å. The rows stay language-neutral
  (`insight/export/insightCsvRows.ts`); the decimal mark is set when the text is written.
- **Decision — every field is quoted, and no piece of a field can start a formula (INS-009).** `csvField` quotes
  every field, also an empty one and a number. `guardFormulas` puts a `'` before a formula character wherever a
  cell could start: at the start of the field and after every `;`, `,`, tab and line break, with only white
  space or quotes in between; a field that starts with a tab or a carriage return gets a leading `'` as before.
  It is one pass over the text. So a program that splits at another character than the writer's still finds no
  cell that begins with a formula.
- **Decision — a question outside the current content has no ID (INS-009, INS-006).** Its rows have an empty
  `item` and the name «Spørsmål *n* (ikkje i aktiviteten no)» (nn, nb, en), *n* being its place in the view's
  list. A question of the activity keeps its ID, which comes from the author's content. The JSON view is
  unchanged: the tab never showed the ID.
- **Verified:** unit tests of the fields and of the file in the three languages; a property test over generated
  texts (split at any of the five characters, no piece of a written field starts with a formula character; the
  guard only adds apostrophes); the routes' tests read the files with their own separator.
- **Consequences:** A file in nn or nb opens in a Norwegian spreadsheet with its columns and numbers right. Its
  form differs from before (separator, quotes, decimal comma); nothing else reads these files. The contract
  describes the form per language.

### D-137 · Security repairs, step 21: a save that changes an answer key starts a new content version
- **Context:** Insight shows one content version at a time (D-106), and a stored xAPI statement names the version
  of the page it came from, so that insight compares like with like (DATA-012, PROD-013). D-093 raised the
  version only with a structural save, since that is what a learner's saved state depends on. An author can also
  change an answer key and leave the structure as it is: mark another MultiChoice option correct while the
  single or multiple mode stays, change in place what a Blanks gap or a DragText drop zone accepts, or switch
  Blanks' case sensitivity. The version then stayed. INS-003 marks options and gap answers right or wrong by the
  stored parameters, so it showed first answers that were judged against the old key under the new key's marks,
  while INS-002's share came from each answer's own stored verdict. The two lists disagreed, and the two-group
  suppression of a single-answer question and of a one-gap task (D-106) rests on their agreeing.
- **Decision — the answer key is part of the version (PROD-013, INS-003, INS-006).** A save of an existing
  activity whose structure is the same and whose answer key differs raises `H5PContent.version` and keeps every
  learner's saved state. The author is asked nothing, because nothing is lost. The key is read with insight's own
  readers (`insight/content/answerKeys.ts` on `questionCatalogue` and `questionShape`), so what insight judges by
  is what is compared: a choice question's `correct` marks in stored order; for each gap of a Blanks or DragText
  task the set of accepted answers as insight compares them, and whether upper and lower case differ. Question
  and option texts, tips and feedback are no part of it, nor is the order of a gap's alternatives. Questions are
  matched by item ID, since PostgreSQL orders the keys of the stored parameters its own way. The other question
  types need no rule here: they have no leaf rule in the structure signature, so any change of their parameters
  is structural already (D-093).
- **Decision — the raise commits with the parameters.** `LearnerStateGate.admit` returns a plan for it, and
  Lumi's write runs inside a mark (`h5p/storage/contentVersionRaiseWrite.ts`) that `h5p/storage/contentUpdate.ts`
  claims once, so the version is raised in the statement that writes the new parameters. A page reads its
  version before its parameters (D-093), so no page carries the new version with the old key.
- **Not chosen:** storing each version's question shapes (a new table and a migration, for a view that D-106
  does not show for an older version anyway); hiding the distribution of a version whose key changed (a teacher
  who corrects a key would lose INS-003 for the corrected activity until its structure changes).
- **Verified:** unit tests of the keys (each question type, any depth, what is and is not a change) and of the
  mark; the gate's unit tests; integration tests through the save route on the real MultiChoice and Blanks (the
  version, the state rows, a state write from a page rendered before the change), and insight after such a save:
  the current version counts none of the answers given before it, the previous version shows them without
  distributions.
- **Consequences:** After an author corrects an answer key, the Innsikt tab starts on a new version; the answers
  given before are under the previous version, without distributions, as for every older version. The tab's
  sentence for an older version names the answer key too (nn, nb, en). A page that was open when the key changed
  keeps its version: its statements are stored under the previous version, and its state writes are dropped as
  stale until the activity is opened again; the state stored before the change is kept. The mappe and the yearly
  snapshots count each version as a group of its own, as after a structural save. The version rises more often
  while an activity is being written. A save that starts a new version also decides where the old version's
  answers end, within a day; each version is suppressed on its own and no view adds versions up (R3 in
  `docs/privacy/DPIA-INPUT.md` says so). PROD-013 and INS-003 have an "Amended" line.

### D-138 · Security repairs, step 22: whose play is recorded, and a version that is no longer current takes no new learner
- **Context:** INS-006 hides every number about fewer than *k* learners. That protects a learner only when the
  person who reads insight cannot fill a group with learners of their own choosing: beside *k* − 1 such learners,
  what the group shows is what the one other learner did. Three doors were wider than they need be. In the
  portal, anyone with a Feide login from any organisation who played an activity shared with «anyone with Feide»
  was a learner whose statements were stored and counted (D-059, D-102; R37); in practice these are the
  external assessors a mappe is sent to (`content/mappe/`), and their plays also blurred the teacher's numbers.
  In Canvas every launch that is not an author's was a learner (LTI-004): also Canvas's observer (`Mentor`), an
  unknown role and a launch without roles. And a batch names the version its page was rendered with, any version
  up to the current one being accepted (D-093, D-115), so a learner could be added to an older version's group
  long after it had been left behind; since D-137 a version ends more often.
- **Decision — whose play is recorded (LTI-011, DATA-012, INS-006; the owner, 2026-11-22).** One rule,
  `xapi/learningDataScope.ts`, serves the ingestion and, through the actor, the player page, which carries the
  xAPI bridge only for a play the server would store (as D-102 does for authors). In the portal: a learner who
  is an HVL member (`hvlMember`: the realm is in `ALLOWED_FEIDE_ORGS` and Feide's Groups API confirms the
  organisation). In Canvas: a learner whose launch holds the context role `Learner` (`isLtiLearner`: the role's
  URI or its short name, exact values), and Canvas's test student, stored flagged as before (D-102's amendment
  of 2026-11-04). Anyone else opens and plays as before, and no statement of theirs is stored: they are in no
  insight view, no *k* count, no mappe result and no score sent to Canvas. The owner chose that a person from
  another organisation keeps their saved state («where was I?»): it is stored under their pseudonym as for
  everyone, purged with the year, and shown to no teacher. `/personvern` says so (nn, nb, en).
- **Decision — a version that is no longer current takes no new learner (INS-006, PROD-013).** A batch that names
  a version older than the current one is stored only for a learner who already has a statement under that
  version in that context (`XapiStatementStore.hasRowsIn`); otherwise it is answered 202 like every batch and
  stores nothing, counted in the log. A page reports `attempted` when it opens, so a learner who had the
  activity open when its version changed can finish, and their result reaches Canvas; a learner who was not in
  the version when it was left behind cannot be added to it.
- **Decision — the share rule stays (INS-002, INS-006; the owner, 2026-11-22).** Insight goes on showing a share
  over *k* or more learners, 0 % and 100 % included (D-106); the mappe's two-sided rule (D-095) is not added. R4
  in `docs/privacy/DPIA-INPUT.md` records the choice for the DPO.
- **Recorded as a residual:** *k* counts pseudonyms. *k* − 1 learners who cooperate with the person who reads
  insight are learners like any other, and in Canvas a launch's roles are what Canvas sends: they are not
  compared with the course's roster (NRPS gives a count, LTI-008, and no list is kept). R41 says so, with the
  options.
- **Verified:** unit tests of the rule, of `isLtiLearner` and the launch facts, of the actor and of the bridge's
  configuration; integration tests of the ingestion on PostgreSQL (a guest from another organisation, an
  observer, a launch without roles; an older version for a new learner, for a learner already in it, and across
  courses); content tests that hold R37, R40, R41 and the privacy notice to the code.
- **Consequences:** External assessors' plays no longer appear in insight or the mappe. A Canvas user who is not
  enrolled as a student plays without being recorded, and no score is sent for them. A page that was opened
  before a version change and had stored nothing yet must be opened again before its results count. The rule
  applies when statements arrive; no installation holds real learners' statements yet, so nothing stored is read
  again. LTI-011, DATA-012, INS-006 and LTI-004 have an "Amended" line; R37, R40 and R4 are updated and R41 is
  new.

### D-139 · Security repairs, step 23: one activity's files have a limit, are kept under the stored ID, and a clean-up cannot fail a stored save
- **Context:** A package that is imported may unpack to 200 MB and hold files of 50 MB at most (SEC-005). A
  person may send 120 uploads and start 20 copies in ten minutes (D-120, D-092). Nothing bounded what one
  activity holds: a save copies the file behind every paste-source path it names (D-092), and a duplicate copies
  every file of its source, so one request could write as many files of up to 50 MB as its paths name. The copy
  limit counted requests, not what a request writes. Two smaller things lay in the same code: the storage keyed an
  activity's files by the ID as a caller spelled it (the routes spell it one way since D-131, the storage itself
  did not), and the clean-up of dropped files after Lumi's write could throw, which turned a save that was
  already stored into an error answer.
- **Decision — a limit for one activity's files (SEC-005, PROD-007).** At most 200 MB (`MAX_TOTAL_SIZE`: what one
  imported package may bring, so every activity can still be exported and imported again) and 1 000 files (real
  activities of the ten types hold tens). `h5p/activityFileBudget.ts` checks a save before Lumi writes: the
  references Lumi's scanner reports, each once; an upload sized from temporary storage, a pasted file from its
  source, a kept file from the activity; a web address is no file. Past the limit the save is refused with 413
  `hvl:activity-files-over-limit` and a message that names both numbers (nn, nb, en), and nothing is written. A
  duplicate saves through the editor (D-092), so it meets the same check. The storage holds the limit as well,
  for every file it is given (`h5p/storage/activityFileRoom.ts`): room is checked before the bytes are stored,
  and a file that takes the activity past its bytes is removed again, so neither an import nor the duplicator's
  own copies go around it. One copy now writes at most 200 MB, so 20 copies in ten minutes are at most 4 GB,
  where the upload limit already allows 6 GB in that time.
- **Decision — files under the stored ID (H5P-004).** `S3ContentFileStore` writes the ID in lower case into every
  key and prefix, and `PrismaContentStorage.addFile` uses the row's own ID, so every spelling of one ID names the
  same files: a second guard beside D-131's at the routes.
- **Decision — a clean-up cannot fail a stored save (H5P-006).** `EditorSaveSteps.afterWrite` reports a failed
  clean-up by its kind (one `warn` line) and the save is answered as stored: the parameters are committed by
  then, and an error answer would only tell the author that a stored save had failed.
- **Verified:** unit tests of the budget (what counts, where each size is read, where it stops, the message in
  three languages); editor tests with small limits (one file too many, the bytes of an upload, a clean-up that
  fails); integration tests of the storage on PostgreSQL and S3 (the count, the bytes, the removed object, one
  spelling of the ID).
- **Consequences:** An author who saves an activity with more than 200 MB of files gets a message that points to
  Panopto for large video, as the guidance already does. A file that a failed clean-up left stays in storage
  until its activity is deleted. SEC-005 and PROD-007 have an "Amended" line; T-33 in the threat model names the
  limit.

### D-140 · Security repairs, step 24: a text field without a tag list is plain text; a link address cannot leave its attribute; the H5P pages allow no inline script
- **Context:** H5P's content types write the text of their parameters into the page as HTML. H5P's own server
  software therefore knows two kinds of text field: one whose semantics give a `tags` list keeps those tags, every
  other is made plain text. Lumi's enforcer cleans a field without a list with sanitize-html's defaults, which
  keep links, tables, headings and more, and since D-039 only list items went through our own cleaner, so a button
  label or a heading could be stored with a link or a table in it. The page policy stops script (D-070), not
  markup. Lumi also cuts a text to its field's `maxLength` after cleaning it, at a fixed position, which can end
  the stored text inside a tag or a character reference. Three smaller things lay beside it: the address of H5P's
  link field (H5P.Link, Interactive Video's "go to" and its hotspot) is joined into `<a href="…">` as text, and a
  plain text keeps its quotation marks; the pages' small scripts found their data block by its ID alone; and the
  page policy allowed one inline script by its hash that no page of ours runs.
- **Decision — a text field without a `tags` list is plain text (SEC-008).** `h5p/semantics/lumiTextSanitizer.ts`
  is the one rule for a text value: Lumi's for a field with `tags`, no markup at all for any other (tags removed,
  `<`, `>` and `&` as references). What the editor sends for such a field is unchanged: a typed `<` arrives as
  `&lt;` and stays text. `SubContentPolicy` cleans every text field on a save, not only list items, so the rule
  holds before Lumi reads the content, and Lumi's own pass then changes nothing. The editor's form goes through
  the same rule (D-124). The player page makes a value of such a field plain when it holds a `<`
  (`h5p/semantics/playedParams.ts`), so a row stored earlier is handed over like one stored now; the row is not
  rewritten (as in D-124). Not chosen: writing a refused tag out as text, as H5P's own server software does; the
  editor never sends a raw tag for such a field, so what is removed was never typed into a form. None of the 120
  installed libraries has a field with the HTML widget and no `tags` list, and the example activities of the ten
  types hold 544 plain text fields, none of which the rule changes.
- **Decision — a text past its length is cut whole (SEC-008).** `h5p/semantics/textLengthCut.ts` makes the cut
  before Lumi's: a text longer than `maxLength` is cut as plain text and ends in a whole character and a whole
  character reference. A cut cannot keep markup whole and within the length, so a text that is too long keeps its
  words and not its markup; H5P's editor never sends one, and no installed library gives a field with `tags` a
  `maxLength`. Lumi's rule runs last, on text it neither changes nor cuts, so its `regexp` check stays.
- **Decision — a link field's address holds no character that ends an attribute (SEC-008).**
  `h5p/semantics/linkAddressConformance.ts`, called by D-123's fitting: in the `url` of a field with `widget:
  'linkWidget'`, `"`, `'`, `<`, `>`, a backtick and a space are percent-encoded and control characters removed, as
  a browser's URL parser treats them. The address is fitted on a save (after its text is cleaned), on the player
  page and in the editor's form.
- **Decision — a page script reads only the page's own data block (SEC-008, H5P-009).** `h5pIntegration.js`,
  `editorPage.js` and the xAPI bridge read their JSON block only when the element with its ID is an inert `<script
  type="application/json">` directly in the document's head, where the page writes it.
- **Decision — no inline script on an H5P page (DATA-011, H5P-009).** `script-src` on the player and editor pages
  is `'self'` (and Panopto's one file when configured, D-070): the hash of H5P Core's constant inline script is
  gone, and `h5p/render/coreInlineScripts.ts` with it. Core writes that script only into an iframe it builds for
  an `iframe.h5p-iframe` element; the player page is that document itself, and the editor's own iframe holds
  `<script src>` tags only. This amends D-070, and the sentence of D-115 that the production policy allows H5P's
  own iframe embedding: a page that embedded that way would have to allow the script again, and the bridge's
  browser test for that mode adds the hash itself.
- **Verified:** unit tests of the rule for one value beside Lumi's enforcer (the plain rule, the tags rule, what
  the editor sends, every length from 1 to 90), of the three places content passes (save, player page, editor
  form) and of the link address; an integration test with the ten real types (no plain field of an example
  changes; a save through the routes; a row written to the database and played); unit tests of the three scripts'
  block; the policy test; and the browser tests that play all ten types and open the editor, which report no
  refused script.
- **Consequences:** A label, a heading or any other plain field shows the words of what was sent, never markup. A
  text sent past its field's length, which the editor does not allow, loses its formatting. A link address with a
  quote or a space is stored percent-encoded. SEC-008 and H5P-009 have an "Amended" line; T-03 in the threat model
  follows.

### D-141 · Security repairs, step 25: a launch is finished by the browser that began it; requests before sign-in have a bound; ltijs asks a platform only through our request handler
- **Context:** ltijs 7 processes a launch on its own second POST: Canvas posts the ID token to `/lti/launch`,
  ltijs's page there reads a recovery token from the browser that began the login and posts everything again. That
  this second post comes from our own page is what ties a launch to its browser. ltijs checks it by
  `Sec-Fetch-Site` alone and lets a request without the header through (D-050 and D-130 both rested on that
  check). Browsers before Safari 16.4 and Firefox 90 send no such header: there, another site could post a launch
  of its own, recovery token included, and the person landed inside it. Four smaller things lay around the launch.
  An error page for an address with an ltik kept the token in the address bar. The login, launch and key-set
  routes answer before any sign-in, and a request could make the server store a nonce, sign tokens and write an
  audit row, with no ceiling; a token that named an unknown key ID made ltijs fetch the platform's key set again,
  every time. ltijs's own request handler follows redirects and has neither a time nor a size limit, and a
  roster's «next page» link comes from the answer itself. And which course may open an activity (LTI-007) was
  nowhere stated as a rule.
- **Decision — the last step of a launch comes from our own page (LTI-001, LTI-003).**
  `lti/http/launchPostOrigin.ts`, called by `ExpressRouterHttpHandler` before ltijs reads the request: a post that
  carries ltijs's recovery token is taken with `Sec-Fetch-Site: same-origin`, or, without that header, with an
  `Origin` that is exactly ours (`PUBLIC_BASE_URL`). A missing `Origin`, `null` and any other origin are refused
  as ltijs refuses a wrong recovery token (the «could not be opened from Canvas» page, audit reason
  `state-invalid`). Canvas's own post, cross-site by nature, is not judged. For a browser to name our origin,
  ltijs's launch page is sent with `Referrer-Policy: same-origin`: under `no-referrer` Chromium puts `Origin:
  null` on that page's own post (measured). The page holds no ltik, and under either rule no referrer goes to
  another origin, so LTI-003's rule for pages that receive an ltik is unchanged. Not built: a single-use state. A
  nonce is used once (LTI-002), so a finished launch cannot be sent again, and the state carries no right of its
  own.
- **Decision — an LTI error page takes an ltik out of its address (LTI-003).** `http/pages/messagePage.ts` takes
  static scripts, and `lti/http/ltiErrorPages.ts` gives every page the landing script (its path now in
  `lti/pages/ltiStaticScripts.ts`), so the «open it again from Canvas» page for `/lti/play?ltik=…` leaves no token
  in the address bar or the history. Where a browser holds an ltik: in the address of the landing request until
  the page's first script runs, in the page's memory, and in H5P's own request URLs inside the frame (D-058);
  never in a cookie or in storage.
- **Decision — requests before sign-in have a bound (LTI-001, DATA-007, NFR-006).** (a)
  `lti/http/launchRequestCeiling.ts`: 6 000 requests a minute from one network address to ltijs's three routes,
  which is 2 000 launches; past it 429 `hvl:rate-limited` with `Retry-After`, before the body is read. The address
  is counted under its keyed fingerprint (`auth-audit-ip`), for a minute. When Redis cannot be reached the request
  goes ahead and a line says so: this is a backstop behind the reverse proxy's own limit (the question to HVL IT
  stands), and it must not make a launch depend on Redis. `TRUST_PROXY` must be right, or every person shares one
  count. (b) `LtiCacheManager` keeps a platform's key set for a minute after it was fetched, whatever asks for its
  removal, so an unknown key ID costs at most one fetch a minute; a real change of keys is seen a minute later at
  most. (c) `auth/audit/failureAuditBudget.ts`: failed logins and failed launches add at most 10 audit rows a
  minute per address and 300 in all; what is past that is counted in one log line a minute, without an address.
  With Redis unreachable the row is written.
- **Decision — ltijs asks a platform only through our request handler (LTI-001, LTI-008).**
  `lti/http/LtiOutboundRequests.ts` replaces ltijs's `FetchRequestHandler` (a `Provider` option): a URL is asked
  only on the origins of the configured platforms (issuer, the two endpoints, the key-set URL) and
  `CANVAS_ORIGINS`, over https in production, without credentials in it; no redirect is followed; a request ends
  after 10 seconds and an answer after 4 MB. So a roster's «next page» link that names another host is refused
  before any request is made (D-104 set this for the first roster URL and for scores), and a slow key-set answer
  cannot hold a launch open.
- **Recorded, not changed — which course may open an activity (LTI-006, LTI-007).** A published activity is opened
  by any resource link of a registered platform and deployment that carries its ID in `custom.contentId`. Links
  are made in the Deep Linking picker, which offers an author only their own and co-authored activities and signs
  its answer; Canvas keeps the ID when a course is copied, which is what LTI-007 asks for. A course whose teacher
  never owned the activity can therefore play it, see its own course's insight and duplicate it, and cannot edit
  it (D-060). The ID is a UUID that cannot be guessed, but it is no secret: whoever holds a link can place it
  again. An owner withdraws an activity from every course by unpublishing or deleting it. A rule that tied an
  activity to the courses its owner chose would have to refuse copied courses.
- **Verified:** unit tests of the last-step rule and of ltijs's routes on our router; an integration test through
  the whole app with the mock Canvas, with a genuine ID token, state and recovery token and only the post's
  headers changed; a browser test in full Chromium whose launch posts reach the server without fetch metadata
  (taken with the browser's own `Origin`, refused with `null`); integration tests of the ceiling, the audit bound
  and the key-set cache on Redis; a test that five launches naming an unpublished key cause no key-set fetch; unit
  tests of the request handler against local servers (another origin, a redirect, a slow and an over-large answer,
  a «next page» link that points elsewhere).
- **Consequences:** A browser that sends neither `Sec-Fetch-Site` nor `Origin` on a form post can no longer finish
  a launch; Canvas supports none. After Canvas replaces its signing keys a launch can fail for up to a minute.
  More than 2 000 launches a minute from one address get the «try again» page. The load scripts and the test
  launch driver send `Sec-Fetch-Site: same-origin` on the last step, as a browser does. LTI-001, LTI-003, LTI-007
  and LTI-008 have an "Amended" line; T-13, T-18, T-60, T-63 and T-111 in the threat model follow.

### D-142 · Security repairs, step 26: a logout and a cookie order follow the session; one Feide ID rule; typed text holds no hidden characters; the editor endpoint takes known actions only
- **Context:** Five places where a request was read more loosely than its rule said. (1) `POST /auth/logout` asked
  for the CSRF token only when the request carried a live session, and cleared the session cookie either way. A
  form post from another site carries no `SameSite=Lax` cookie, so it met no check, and its answer still told the
  browser to delete the cookie: any page could log a person out of the portal. (2) A request whose session cookie
  named no live session had the cookie cleared on whatever answer it got, also on H5P's core and library files and
  the web app's files under `/_next/static/`, which are `public` and kept by caches for a year; a shared cache that
  kept such an answer would hand its `Set-Cookie` to other people. (3) A Feide ID was trimmed and lower-cased by
  JavaScript's Unicode rules before it was checked: `trim` removes a no-break space or a byte-order mark, and
  `toLowerCase` turns U+212A (the Kelvin sign) into `k`. A login ID in Canvas written with such a character named,
  through `custom.feide_login` (AUTH-005), the Feide account of the plain ID. (4) The free-text fields of the API
  took any character: U+0000, which PostgreSQL refuses (the request ended as a 500), the line and paragraph
  separators U+2028 and U+2029 (a line break that the learner purpose's «one line» rule did not see), and the
  bidirectional controls, which reorder what a reader sees. (5) Lumi's AJAX endpoint answers an unknown POST action
  with status 500, so an author could raise that answer and its error-level log line at will.
- **Decision — a logout ends what its cookie names (AUTH-003).** `endPortalSession` clears the session cookie only
  when the request had a live session, which the route has by then held to the CSRF token. A request without one
  gets the same redirect to `/`, `no-store`; it changes no cookie and writes no audit row.
- **Decision — the order to delete a dead cookie never travels on an answer a cache may keep (AUTH-003).**
  `auth/session/staleCookieClearing.ts`: the session middleware no longer sets the clearing cookie when it finds a
  dead session ID. The order is added when the answer's headers are written (`writeHead`), and only when
  `Cache-Control` says `no-store` or `private`. An answer that names no caching gets `no-store` and the order: it
  answers one browser's cookie. An answer that names any other caching (`public`, `max-age`, `no-cache`) never
  carries it; the next answer about the person does. An answer that sets the session cookie itself (a login) is
  left as it is. Next.js writes its own headers, so the rule is tested on the built web app's real answers.
- **Decision — one Feide ID rule, in ASCII only (AUTH-002, AUTH-005, DATA-008).** `auth/identity/feideId.ts`
  (`normaliseFeideId`) with `auth/identity/asciiText.ts`: SP and HTAB are trimmed, `A`–`Z` are lower-cased, every
  other character stays as written, and then `FEIDE_ID_PATTERN` is checked. Every reader uses it: the login's
  claims, `custom.feide_login`, `ADMIN_FEIDE_IDS` and the other configured lists, the people search, the
  data-subject tool, and the two guards that refuse a Feide subject that is not normalised; Feide group IDs are
  compared in ASCII case too. Two IDs as written now give one Feide ID only when they differ in ASCII case or in
  blanks at their ends. Not decided: whether a Feide ID may hold a letter outside ASCII at all. Feide's rule for
  `eduPersonPrincipalName` could not be read from the build environment, so the rule does not depend on it: such a
  letter is kept as written and never folded *(verify with HVL IT, Q32; a stricter pattern is a one-line change)*.
- **Decision — typed text holds no control character, hidden line break or bidirectional control (PED-030,
  PED-032, UD-022, PROD-007).** `packages/api-contract/src/textRules.ts`: a one-line text refuses Unicode `Cc`,
  `Zl`, `Zp` and `Bidi_Control`; a free text is the same but keeps tab, CR and LF. It holds the learner purpose (one
  line), the outcomes, the rationale, a reason for publishing with its rule ID and path, and the people search. A
  request that breaks it is a 400, like any other body the contract refuses. Other format characters (a soft
  hyphen, the joiner inside an emoji) are text and stay. The web forms clean pasted text before they check and
  send it (`apps/web/src/config/typedText.ts`): a bidirectional control is dropped, a hidden line break becomes a
  line break (a space on one line) and any other control character a space; a test keeps the web app's copy of the
  classes equal to the contract's. A stored learner purpose that breaks the rule is not handed to learners
  (`learnerInfoFields` reads it through the schema).
- **Decision — the editor's AJAX endpoint takes known actions only (H5P-002).** `http/routes/ajaxRoutes.ts`: a
  request names exactly one action that Lumi's `H5PAjaxEndpoint` knows for its method (three for GET, seven for
  POST). A missing, repeated or unknown action is 400 `error.badRequest`, after the role check and before any body
  is read.
- **Verified:** unit tests of the cookie order with every way a route writes its headers, an integration test of
  the session middleware on Redis, of the logout route and of the whole app's shared H5P files, and one against the
  built web app; unit tests of the ASCII folding and of the Feide ID rule at every reader, and the people search on
  the database; contract tests of the two text patterns and of every field that keeps them, route tests that each
  field answers 400 and logs no fault, and web tests that the forms send cleaned text that the contract's schema
  takes; route tests of every refused and every known AJAX action. The new tests fail on the code before this step.
- **Consequences:** A browser with a dead session cookie keeps it until the next answer about the person. A Feide
  ID with a capital letter outside ASCII is no longer folded (none is known at HVL). Text stored before this step is
  not changed; a stored purpose that breaks the rule stays hidden from learners until it is saved again. No page
  looks different and no message is new. AUTH-002, AUTH-003, AUTH-005, PED-030, PED-032, UD-022, PROD-007 and
  H5P-002 have an "Amended" line; D-054, D-057 and D-087 an amendment; T-02, T-05, T-21 and the new T-25 in the
  threat model follow.

### D-143 · Security repairs, step 27: a `.json` file is checked in portions; an upload's text fields are few and small; library sources are held to their forms; scan turns go person by person
- **Context:** Four places where the handling of something sent or fetched cost more, or trusted more, than its
  rule needs. (1) SEC-002 accepts a `.json` content file only when it is valid UTF-8 and valid JSON. The check read
  the whole file (up to 50 MB) and gave it to `JSON.parse`: the file, its text and the parsed value were in memory
  together, many times the file's size, and no other request was served during the parse; an editor upload ran the
  check twice (ours, for the reason, and Lumi's own). (2) An upload request could carry 20 text fields of 4 MB each,
  all kept in memory, although H5P's editor sends two small ones (`field`, at most 434 bytes among the installed
  content types, and `contentId`); a field past the size limit was cut short and passed on. (3)
  `tools/h5p-libraries` with `--resolve` reads repository addresses from H5P's public registry, and library names
  and versions from the `library.json` and `semantics.json` of repositories it has just fetched, and gave them to
  `git` and to folder names as they were. An address that begins with `-` is an option to git, an address in
  another form reaches another transport or a local path, and a name with `../` joins to a folder outside the work
  folder, which a checkout removes first. A test checked the committed pin list afterwards; the code checked
  nothing. (4) The malware scanner lets four scans talk to clamd at a time and counts the wait for a turn against a
  scan's time limit (D-110). With one queue for everybody, one author's many files at the same moment could hold the
  turns long enough for other authors' uploads to pass the limit and be refused.
- **Decision — a `.json` file is checked in portions (SEC-002).** `security/sniff/jsonFileCheck.ts` reads the file
  64 KB at a time, decodes it as UTF-8 (fatal, one leading byte-order mark removed) and follows its syntax with
  `security/sniff/jsonSyntax.ts`, a state machine for RFC 8259 that builds nothing. The answer is exactly that of
  `JSON.parse`; no size or depth rule is added. Memory is one portion and one bit for each open bracket, and the
  reads are asynchronous, so other requests are served between the portions. The check still runs twice for an
  editor upload; each run is now cheap.
- **Decision — an upload request's text fields are few and small (SEC-005).** `http/multipartUpload.ts`: at most 4
  text fields of at most 64 KB each (about 150 times the largest real one), a field name of at most 100 characters,
  at most 8 parts in all. A request past one of these is 400 `error.badRequest` after its body was read, and its
  folder is removed; a value is never cut short and passed on. A second file within the 8 parts is still discarded
  unread.
- **Decision — a library source is held to its form before git or a folder sees it (H5P-003).**
  `tools/h5p-libraries/sourceRules.mjs`: a repository is `https://github.com/<owner>/<name>`; a machine name is
  parts of letters, digits, `_` and `-` joined by single dots; a version part is a whole number, given as a number;
  a ref is `HEAD`, a version tag's ref or a full commit; a commit is 40 hex characters. `resolveManifest.mjs` applies
  them to the registry's address and to every name and version before a folder name is made or the source is asked;
  `gitSource.mjs` applies them again before git runs or a folder is touched, and puts `--` before the address;
  `fetchLibraries.mjs` holds every line of the committed pin list to them before it fetches the first. A required
  library that fails stops the run; an offered one is listed as skipped with the reason, like any other that cannot
  be resolved. All 120 lines of today's pin list pass. The image build copies the new file beside the resolver
  (`deploy/Dockerfile`).
- **Decision — waiting scans get the free turns person by person (SEC-006).** `security/malware/ScanTurns.ts`: a
  free turn goes to the owner who has waited longest since their last turn, and to that owner's oldest waiting scan.
  The upload route records the author for the length of the request (`security/malware/scanOwner.ts`, an
  `AsyncLocalStorage`, as `h5p/storage/contentCreations.ts` uses one), and the scanner names that author when it
  asks for a turn; the settings probe has a place of its own in the rotation. Four scans at a time and the time
  limit that includes the wait stay as D-110 set them: an author whose own files fill the queue may still see the
  later ones refused, the other authors no longer do. PRIVACY: the owner is an internal account ID held in memory
  while a request runs; it is not logged or stored.
- **Not changed — what an imported package shows in the editor (SEC-005, SEC-008).** D-124 already hands the editor
  an uploaded package's content fitted and cleaned, with its title data and that of its pieces as plain text. A
  test now states it for a title, a licence note, an author, a piece's author role and a file field's settings.
- **Verified:** a property test compares the syntax check with `JSON.parse` on generated JSON, on generated JSON
  with one character changed and on texts of JSON's own characters, however they are cut into pieces; file tests
  with characters, escapes, numbers and words across two portions; a 30 MB file checked by a process whose heap
  (64 MB) cannot hold it parsed. Unit tests of the upload reader at and past each limit, and of the editor's upload
  route. Unit tests of each source rule, of the resolver with a registry address, a name and a version out of form
  (no source asked, no folder made), of the git access (refused before git runs, the folder untouched) and of the
  pin list. Unit tests of the rotation and of the owner's async context, and an integration test with a fake clamd
  whose scans take a while: with forty files of one author waiting, another author's file is scanned among the
  first and stored. The new tests fail on the code before this step (the test of the imported package passes on
  both, as it should). The tool was run for real: tags read from GitHub with the `--` form, and a fetch from the
  cached checkouts packed the same ten packages (the same SHA-256 list).
- **Consequences:** No page looks different and no message is new in normal use. An upload with more than four text
  fields or a field over 64 KB, which no H5P client sends, is refused. A registry entry that names a repository
  outside GitHub cannot be resolved until the rule is widened on purpose. One person's scans delay another's only by
  the scans that already run. No new stored data. SEC-002, SEC-005, SEC-006 and H5P-003 have an "Amended" line;
  D-043, D-078 and D-110 an amendment; T-33, T-80 and T-112 in the threat model, ROS-07, the architecture
  description, the ClamAV runbook and the server README follow.

### D-144 · Security repairs, step 28: a server that stands still is unhealthy within half a minute and says so; Redis commands fail at once while Redis is unreachable; the image runs no code from a writable folder; the seccomp profile is Docker's default plus one rule; a real purge run records its start
- **Context:** Five places where the running service said too little, waited too long or kept an old default. (1)
  The app stack's health check gave each try Docker's default 30 seconds and allowed 40 failed tries, so a server
  whose process no longer answered kept its "healthy" mark for about twenty minutes, and whatever routes requests
  by that mark went on sending them; nothing in the log said that the server had stood still. (2) The Redis
  client's default keeps every command sent while the connection is down in a list without a limit and sends it
  when the connection is back. Requests that need Redis (sessions, limits, locks) then waited instead of failing,
  although `xapi/XapiRateLimit.ts` and the threat model say such a request fails, and a count meant for one minute
  was added whenever Redis came back. (3) The image runs the server's TypeScript through tsx, which writes each
  translated file to `/tmp/tsx-<uid>` and reads it back at the next load without checking it. The root file system
  is read-only, but `/tmp` is not: whatever can write a file there as the app's user decides what code the next
  worker thread, CLI run or start of the process loads. (4) The seccomp profile of the app's containers was
  Playwright's, byte for byte: a copy of an older Docker default with `clone`, `setns` and `unshare` opened for
  Chromium's sandbox. Docker's default has since stopped allowing the `io_uring` calls and `socket` for every
  address family; Playwright has not updated its file (v1.65.1's is the same bytes as v1.56.1's). (5) A real purge
  run wrote its audit event when it ended, `completed` or `failed`. A run cut short by a deployment, a crash or
  Ctrl-C reached neither, so its deletions were in no record, and the next run's event counted only what was left.
- **Decision — the health check is short, and a standstill is written (NFR-002).** `deploy/compose.app.yml`: a try
  has 3 seconds (the request itself gives up after 2.5), tries come every 5 seconds, the third failed one in a row
  makes the app unhealthy (about 25 seconds), and a start period of 120 seconds keeps a starting server from being
  counted as failing. `tools/deploy-check/resourceRules.mjs` refuses a stack whose check has a time limit over 5 s,
  an interval over 10 s, more than 5 retries or no start period. `server/eventLoopWatch.ts` measures the event
  loop's delay (Node's `monitorEventLoopDelay`) and, every 10 seconds, writes one warning with the longest
  standstill when it reached a second: two numbers, nothing of a request or a person. The line is written after the
  standstill; a server that never runs again is the health check's to report. The server does not end or restart
  itself when it stands still: Docker alone does not restart an unhealthy container, and what acts on the mark (an
  orchestrator, a load balancer that stops routing) is the platform's choice (`docs/ops/docker.md`).
- **Decision — a Redis command fails at once while Redis is unreachable (H5P-004, LTI-011).**
  `infra/redisClient.ts` creates the client with `disableOfflineQueue`: a command sent while the connection is down
  rejects with the client's `ClientOfflineError`, and nothing is kept to be sent later; the client reconnects by
  itself, at most half a second between tries. UPSTREAM: node-redis 4.7.1 applies the option to single commands and
  scripts but not to `multi().exec()`; the rate limits count in transactions, so the same rule is put on the
  client's `multiExecutor` here. A request that needs Redis then fails like any server fault instead of waiting,
  `/healthz` answers 503 at once, and the background jobs, which already log a failed lease and try again at their
  next tick, do the same.
- **Decision — the image switches the loader's cache off (NFR-007).** `deploy/Dockerfile` sets
  `TSX_DISABLE_CACHE=1` in the runtime stage: tsx keeps translated code in memory and neither writes nor reads
  `/tmp/tsx-<uid>`. `tools/deploy-check/deployRules.mjs` requires the setting in the runtime stage and refuses a
  service of the stack that changes it. Cost, measured on the development machine: loading the server's code takes
  about 4 s without the cache and about 2 s with a filled one, but a container starts with an empty `/tmp`, and the
  first load that has to fill the cache took about 14 s; the SVG worker starts in about 1.1 s instead of 0.9 s (its
  limit is 30 s).
- **Decision — the seccomp profile is Docker's default plus one rule (MAPPE-004, NFR-007).**
  `deploy/seccomp/chromium-sandbox.seccomp` is the default profile of Docker Engine 29.9.2
  (`https://github.com/moby/moby`, tag `docker-v29.9.2`, file `vendor/github.com/moby/profiles/seccomp/default.json`,
  SHA-256 `785b2429…9334`), fetched with git, with one rule inserted first: `clone`, `setns` and `unshare` allowed
  without a condition, which Chromium needs to create the user namespaces of its sandbox (D-096). Against the
  profile before: the `io_uring` calls are no longer allowed, `socket` only for the address families Docker's
  default allows, and `clone3` answers "not implemented", so the C library falls back to `clone`.
  `tools/deploy-check/seccompRules.mjs` holds the file to its hash and proves that, with the one rule taken out, it
  is Docker's file byte for byte. Playwright's file is removed, and the stack, the rules and the operations notes
  name the new one.
- **Decision — a real purge run records its start (DATA-007, DATA-003).** `privacy/purge/retentionPurge.ts` writes
  a `purge.run` event with `outcome: "started"` and the plan's counts before the run's first change, then
  `completed` or `failed` as before. A run that is cut short leaves its `started` event; the next run's `started`
  event shows what was left, so the difference is what the cut run did. Only a `completed` real run marks a year as
  purged (`purgeAudit.ts`). If the start cannot be audited, the run changes nothing.
- **Verified:** unit tests of the health-check rule on the real stack file and on copies with a long time limit, a
  long interval, many retries, no start period or no check, and of the standstill watch (one line for a standstill
  of a second, none below it, none after `stop`). An integration test with a relay in front of the real Redis that
  cuts and restores the connection: a command, a transaction (the xAPI limit), a script and a PING are refused
  within a second, no refused command is sent later, and the client works again when the connection is back.
  Tests that start a TypeScript program and its worker thread with the pinned tsx: with the setting the temporary
  area stays empty, without it the loader's folder appears. Unit tests of the profile rules on the real file and on
  copies with a changed byte, a second or moved rule, an open default, a missing namespace call, `io_uring` or an
  unconditional `socket`. Integration tests of a purge run whose process ends at its first statement delete: the
  `started` event with the full plan is in the log before the first change and is all the cut run leaves, the year
  does not count as purged, and the next run completes with the rest. The new tests fail on the code before this
  step. The Docker smoke test ran on the final tree: the image builds, the mappe PDF prints with Chromium's sandbox
  on under the new profile (seen in `/proc` too), no tsx folder is in the app's `/tmp`, and a server process
  stopped in place (SIGSTOP) made the app unhealthy after 18 s; it was healthy again 5 s after it ran on, and its log named a standstill of 18 707 ms (the smoke passed in 686 s, most of it the image build).
- **Consequences:** No page looks different. During a Redis outage a user gets an error at once instead of a
  request that hangs, and the node reports itself unavailable. The profile's file has a new name: a deployment that
  copied the old path must use the new one, and a runtime with its own policy needs the three namespace calls
  allowed, as before. One more audit row for each real purge run, and one possible warning line in the log. NFR-002,
  NFR-007, H5P-004, MAPPE-004, DATA-003 and DATA-007 have an "Amended" line; D-107, D-110 and D-134 an amendment;
  T-54, T-70, T-103, T-110 and T-114 in the threat model, ROS-20, the architecture description, the Docker and
  yearly-purge operations notes, the runbook and the READMEs of `deploy/`, `deploy/seccomp/` and
  `tools/deploy-check/` follow.

### D-145 · Security repairs, step 29: the lock file is held to one source and one checksum, an install script outside the reviewed list stops the install, the workflows name commits and digests, an audit exception is dated and bound to its package, and the advisories are checked every day
- **Context:** Six gaps in how the dependencies and the build steps are held. (1) `npm run check:audit` failed:
  `effect` 3.20.0, an exact dependency of `@prisma/config` 7.10.1 (Prisma's command-line tool), is named by
  GHSA-7589-6fvf-x4pw (a slow pattern in `Schema.TemplateLiteral`; fixed in 3.22.1). (2) The audit check compared
  an exception's `expires` with today as text, so an entry without a date, with a misspelt one or with a date
  years ahead never expired, and it matched an exception to an advisory by the advisory's ID alone, whatever
  package the entry named. (3) That every package of `package-lock.json` comes from the npm registry with a
  SHA-512 value had been checked once by hand (threat model T-90); nothing held it. (4) The root `package.json`
  lists the reviewed install scripts in `allowScripts`, but npm 11 runs a script outside the list with a notice
  unless `strict-allow-scripts` is set, and there was no `.npmrc`. (5) The workflows named their actions by major
  tag and three of the gate's service images by tag; a tag can be moved by its publisher. (6) The audit check ran
  only on a push or a pull request, and Dependabot proposes updates once a month (the owner's choice of
  2026-10-28, where `SEC-007` says weekly), so an advisory published in between waited for the next push.
- **Decision — `effect` 3.22.4 by an exact override (SEC-007).** The root `overrides` pins `effect` at 3.22.4, as
  D-030 did for `underscore`: Prisma 7.10.1 is the newest 7.x and names 3.20.0 exactly. 3.22.4 was five weeks old;
  the newest, 3.22.5, one week. The package is used by Prisma's CLI (`generate`, `migrate deploy`) to read our own
  `prisma.config.ts`; `@prisma/client`, which the server runs, does not load it. Remove the override when a Prisma
  release names a fixed `effect` itself. The two `image-size` exceptions stay (D-030): no 1.x release is fixed.
- **Decision — an exception is complete, dated and bound to its package.**
  `tools/dependency-check/auditExceptionRules.mjs`: an entry needs `advisory`, `package`, `decision`, `expires`
  and `mitigation`; `expires` is a real calendar date (`2027-02-30` is not one) at most 120 days after today, so
  every exception is read again within four months; two entries for the same advisory and package are refused.
  `checkAudit.mjs` matches an advisory to an exception by ID and package, and reports an advisory once for each
  package npm names. D-030's entries (until 2027-01-31) pass.
- **Decision — `npm run check:lockfile` (SEC-007).** `tools/dependency-check/checkLockfile.mjs` holds every
  package of the lock file that is not one of our workspaces to
  `https://registry.npmjs.org/<name>/-/<name>-<version>.tgz` and to a `sha512-` value of the full length; an alias
  or a bundled package fails until a person has reviewed it; a link points at a local package. It uses Node alone,
  and both workflows run it before `npm ci`. Not required: a rule for another registry. A mirror at HVL would be a
  change of this check on purpose.
- **Decision — an install script outside the reviewed list stops the install.** `.npmrc` sets
  `strict-allow-scripts=true`. `allowScripts` names the four packages of the lock file with a script, each as
  `name@version`: `esbuild`, `prisma` and `@prisma/engines` run theirs, and `fsevents` (macOS only) is `false`,
  because it ships its built file and its script would only build it again. `installScriptRules.mjs` compares the
  lock file with the list both ways and requires the setting; `deploy/Dockerfile` copies `.npmrc` before its
  `npm ci`, and `tools/deploy-check` requires that copy.
- **Decision — the workflows name commits and digests (`npm run check:workflows`).** Each action is written as
  `owner/repo@<commit> # v1.2.3` (checkout v7.0.1, setup-node v7.1.0, cache v6.1.0, upload-artifact v7.0.2; each
  commit read from the action's tag list and fetched). The gate's `postgres`, `redis` and `moto` services carry
  the digests of `deploy/compose.app.yml`, and the check refuses another digest for an image the stack names.
  It also requires top-level `permissions` without `write`, and `persist-credentials: false` on every checkout,
  which the two workflows already had. Dependabot proposes new action commits; an image digest is changed by hand.
- **Decision — a daily advisory run; Dependabot stays monthly (the owner, 2026-11-26).**
  `.github/workflows/audit.yml` runs `check:lockfile` and `check:audit` once a day on the default branch. Nothing
  is installed for it: both read the lock file and use Node and npm alone. `SEC-007` is amended. Not known from
  here: whom GitHub notifies about a failed scheduled run, and when it pauses a schedule in a quiet repository
  *(verify; GitHub's documentation could not be reached from the development sandbox)*.
- **Recorded, not built.** A secret scan of the repository: the repository is public, so GitHub's secret scanning
  and push protection are settings the owner can switch on; no scanner was added to CI, because none could be run
  in the development sandbox to see what it reports (Q34). Signing the image and stating where it was built: no
  workflow publishes an image, so there is nothing to sign yet; where the production image is built and whether it
  is signed there is HVL IT's choice (Q33).
- **Verified:** unit tests of each rule on the real files and on changed copies: an exception without a date,
  with text for a date, with a date that does not exist, more than 120 days ahead, for another package or twice;
  a lock-file entry from another server or another package's address, with a weak, cut or missing checksum, as an
  alias or bundled, and a link out of the repository; a script the list does not name, a stale or loosely written
  entry, and npm settings without the strict line; an action by tag, branch or short commit or without its
  version, an image without a digest or with another than the stack's, a token that may write, a checkout that
  keeps the token; an image build that does not copy `.npmrc`. The old code accepted each of the exception cases,
  and the old workflows fail the new check. A real `npm ci` in a copy of the manifests passed with the strict
  setting and the full list, and ended with `ESTRICTALLOWSCRIPTS`, changing nothing, with one entry removed.
  `npm run check:audit` passes; `prisma validate`, `generate`, `migrate deploy` and `migrate status` ran with
  `effect` 3.22.4, and the server suite, which applies the migrations, passes as before. The two commands of the
  daily run were run in a copy with nothing installed. The Docker smoke test ran on the committed tree (278 s): a
  fresh builder built the image, its `npm ci` with the strict setting among the steps; the `migrate` step applied
  8 of 8 migrations with `effect` 3.22.4; the PDF printed with Chromium's sandbox on, and the checks of D-144
  passed (no code cache, a stopped server unhealthy after 19 s). The workflow files themselves have not run on
  GitHub: GitHub runs them for `main` and for pull requests only, so they first run with the pull request that
  brings this branch to `main`.
- **Consequences:** `package.json`, `package-lock.json`, `.npmrc`, `docs/assurance/sbom.cdx.json` (the SBOM lists
  `effect` 3.22.4); `tools/dependency-check/` (`auditExceptionRules.mjs`, `checkLockfile.mjs`,
  `installScriptRules.mjs`, `checkWorkflows.mjs`, `checkAudit.mjs`, their tests and the README);
  `tools/deploy-check/deployRules.mjs`; `deploy/Dockerfile`; `.github/workflows/ci.yml`, `docker.yml`, `audit.yml`
  and `.github/dependabot.yml`; `tools/doc-lint/test/ciDependencyGates.test.mjs`; `CLAUDE.md` §3. An upgrade of a
  package with an install script now changes `allowScripts` in the same commit, and an exception renewed on its
  last day can run 120 days. Amends D-029, D-030 and D-110, and `SEC-007`. Open questions Q33 and Q34.
