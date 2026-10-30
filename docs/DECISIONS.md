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
| D-110 | Deployment and operations design: runtime, image, compose, content types, files origin, ClamAV | Accepted (2026-10-30), HVL's runtime and DNS open (Q5), build egress to the owner (Q21) |
| D-111 | An HVL language overlay in a library-storage wrapper; `H5P-010`'s guidance through it | Accepted (2026-10-30), texts to HVL's language advisers and ALU (Q2, Q17) |
| D-112 | Upstream reports drafted for the owner to file; Lumi stays at 10.0.4 | Accepted (2026-10-30) |
| D-113 | The S6 gate in full, run in parts; CI raised to S5; per-ID runs that select tests; a licence guard | Accepted (2026-10-30) |
| D-114 | New development dependencies in S6 | Accepted (2026-10-30) |
| D-115 | xAPI capture, statement identity, attempts and gradable results (probe P1) | Accepted (2026-10-30), ALU and the owner to answer Q18–Q20 |

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
- **Context:** Lumi's `ContentScanner` passes a list's array, not its parent object, to the
  `SemanticsEnforcer` for list items (`ContentScanner.js:119`). Text fields that are list items (for example
  H5P.Blanks `questions`) are therefore never sanitised (a CVE-2025-47828 regression), and a disallowed library
  that is a list item (for example a DragQuestion in a QuestionSet) is neither removed nor checked. Metadata
  titles are not sanitised either.
- **Decision:** On save, our `SubContentPolicy` walks the params with the (altered) semantics, refuses with 403
  any sub-library that the field does not offer and `H5P.DragQuestion` anywhere, sanitises list-item text with
  Lumi's own text rules, and sanitises the titles in main and sub-content metadata. A test pins the upstream
  behaviour so we notice when Lumi fixes it. Two gaps found in the S2 review are closed the same way: Lumi
  adds every `library: "H5P.Name 1.2"` value it finds, under any key, to the content's dependencies, so the
  policy refuses any such value the semantics walk did not reach (`semantics/libraryReferences.ts`); and H5P's
  "Rights of use" dialog shows metadata without escaping, so every metadata string is reduced to plain text,
  `source` is kept only as an http(s) URL, and a field that becomes empty is dropped. The verification pass
  after that review showed the dialog reads more than the semantics reach: h5p.js `findCopyrights` walks the
  whole tree, renders every `metadata` and file `copyright` object, and writes an image's `path` and the
  sub-content's `alt` into `<img src="…" alt="…">`. So `semantics/rightsOfUse.ts` cleans these anywhere in
  the parameters: metadata and copyright objects become plain text (sanitize-html with no tags, pinned as a
  direct dependency at the version Lumi uses; Lumi's own default for a field without tags still allows links
  and tables); a `path` with quotes, angle brackets, control characters or a scheme other than http(s) is
  refused with 400; and a straight double quote in `alt` becomes `”`, because Lumi's sanitiser runs after ours
  and turns `&quot;` back into `"`. A second verification pass found three more ways out, now closed: WHATWG
  keeps a quote in a URL's host raw, so a `source` whose serialised form still holds `"`, `'`, `<`, `>` or a
  backtick is removed; the walk now continues inside metadata and copyright objects, as h5p.js does; and h5p.js
  joins arrays into the HTML, so an array `path` is refused, an array `alt` is emptied, and metadata nested
  deeper than the limit is dropped instead of kept as it was. A third, focused check (a sink audit of h5p.js and
  Chromium fuzzing with more than 60 variants) found no further way to run script, but five inputs that Lumi or
  PostgreSQL turned into a 500. They are now refused as the request's fault (400): text with U+0000 or a lone
  surrogate (`storage/storableText.ts`, also for learner state), nesting deeper than 256 levels before Lumi's
  recursive walks see it (`semantics/nestingDepth.ts`, also for an imported content.json), and values whose
  JSON type Lumi's scanners cannot read (`paramsWalker.ts`: text, list, group, library, file, image, video and
  audio fields); a sub-content `library` object without a usable `toString` is refused with 403 like any other.
- **Consequences:** The walker (`semantics/paramsWalker.ts`) is reused by the S4 validator. Cleaning data for a
  renderer that does not escape is a list of known sinks, not a guarantee: the real ten types render their own
  copyright data (`getCopyrights`), so their sinks must be reviewed when the Hub packages arrive (Q7), and the
  player page gets a script CSP without `'unsafe-inline'` in S4 (`DATA-011`), which stops injected handlers
  whatever their source.

### D-040 · Our own page templates with script-safe JSON
- **Context:** Lumi's default templates write `JSON.stringify(integration)` into a `<script>` element
  (`renderers/player.js:16`). `JSON.stringify` does not escape `</script>`, so a title or an unknown parameter
  key containing it would run script for every learner. `H5PIntegration.user` also carries the user's ID.
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
  check parses it again as XML, as a browser does, and fails closed. Lumi alone let 15 of the 41 attack payloads
  in `SvgSanitizer.bypass.test.ts` through (13 once our pre-check had run); the added layers stop all of them.

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
  - `@lumieducation/h5p-clamav-scanner` 10.0.4 (GPL-3.0-or-later; it brings `clamscan` 2.4.x, MIT, and
    `ts-deepmerge` 7, ISC) answers `NotScanned` when ClamAV fails, and Lumi refuses an upload only on `MalwareFound`
    (`ContentStorer.js`, `H5PEditor.js`), so it fails open. It also reads `CLAMSCAN_*` and `CLAMDSCAN_*`
    environment variables, which override the options passed to it. clamd's default stream limit (25 MB) is below
    `SEC-005`'s 50 MB.
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
    scanner's `NotScanned` being accepted (D-110), and Core 1.28 with the new Hub (the adapters of spec 01 §1); and
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
