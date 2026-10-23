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
  `npm query ':not(.dev)'` and checks their SPDX expressions against a GPL-3.0-compatible allow-list.
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
  denied; files an author removes are deleted by our code as that author. The H5P-006 boot check is a guard in
  the editor and player factories (every Lumi component must hold `HvlPermissionSystem`) plus an ESLint ban on
  `LaissezFairePermissionSystem`.
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
  behaviour so we notice when Lumi fixes it.
- **Consequences:** The walker (`semantics/paramsWalker.ts`) is reused by the S4 validator.

### D-040 · Our own player and editor page templates with script-safe JSON
- **Context:** Lumi's default templates write `JSON.stringify(integration)` into a `<script>` element
  (`renderers/player.js:16`). `JSON.stringify` does not escape `</script>`, so a title or an unknown parameter
  key containing it would run script for every learner. `H5PIntegration.user` also carries the user's ID.
- **Decision:** We render the pages ourselves and escape `<`, `>`, `&`, U+2028 and U+2029 in the embedded JSON.
  `H5PIntegration.user` is blank (no pseudonym or account ID in the page).
- **Consequences:** S4 extends the same templates with the theme and the xAPI bridge.

### D-041 · Library change control: one audited install path, no Hub installs
- **Context:** `H5P-011` requires an audit event for every library change and no Hub installs on demand in
  production. Lumi has no install hook, and an empty content-type cache makes it call the Hub on every request.
- **Decision:** Libraries change only through (a) the seed command and (b) an admin's package import; both
  write a `LibraryAuditEvent` per new or patched library. Installing from the Hub is refused for everyone, in
  every environment. `LibraryAuditEvent.actorUserId` becomes nullable (the seed command has no user) and gains
  `source` (`seed` or `upload`). An empty content-type cache is stored as `[]`, so the server never calls the
  Hub while serving requests; `npm run hub:check` contacts it explicitly (spike step 3).
- **Consequences:** New content types arrive through new seed packages, reviewed like code.

### D-042 · The seeder lives in `apps/server`; where the seed packages are kept
- **Context:** Spec 01 §2 places `seedLibraries.ts` in `tools/seed/`, but seeding needs the server's H5P
  configuration, library storage and Prisma (for the audit).
- **Decision:** `SPEC-DEVIATION`: the seeder is `apps/server/src/h5p/libraries/` (`npm run seed:libraries`);
  `tools/seed/` keeps the fetch script. The ten packages are committed under
  `docs/reference/h5p-core-1.28-seed-packages/` when every file is under 50 MB and all together under 150 MB;
  otherwise they are published as a GitHub Release asset and only `SHA256SUMS` is committed (as D-027).
- **Consequences:** CI seeds from committed (or release) packages and never fetches from the Hub.

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
  `data:image/(png|jpeg|gif|webp)`. `script`, `foreignObject`, `set`, `on*` attributes and animations of `href`
  are removed; `@import` and external `url()` are removed from styles. Order: our pre-check, Lumi's sanitiser,
  our stricter DOMPurify pass, and a final check that nothing forbidden is left. Benign SVGs must render
  identically in Chromium before and after (screenshot comparison).
- **Consequences:** SVG files larger than 5 MB are refused. DOMPurify parses with the HTML parser (its XML mode
  returns nothing for a file with an `<?xml?>` prolog); that parser keeps `xmlns` but its SVG profile removes
  `<use>`, so a drawing that relies on `<use>` loses those parts. The S2 probes recorded this behaviour.
  Lumi's profile is SVG only (no filter elements), so filter primitives such as `feGaussianBlur` are lost too,
  and DOMPurify removes ids that name document properties (`title`, `blur`, …), which breaks `url(#…)`
  references to them; a test pins all three losses. Our pass writes its result with XMLSerializer, and the final
  check parses it again as XML, as a browser does, and fails closed. Lumi alone let 13 of the 41 attack payloads
  in `SvgSanitizer.bypass.test.ts` through; the added layers stop all of them.

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
