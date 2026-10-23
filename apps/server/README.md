# apps/server

## Purpose

The back end of HVL Interaktiv. It runs the H5P engine (Core API 1.28) for authoring and playing the ten
content types, stores activities and learner progress, and (from later sessions) handles Feide login, LTI 1.3
launches from Canvas, the validator and teacher insight. It holds no learner names or e-mail addresses:
learners are yearly pseudonyms (`DATA-002`).

**Status after Session 2.** On top of the Session 1 foundations (configuration, privacy-safe logging,
pseudonyms, messages in nn/nb/en, schema, storage adapters, archive guard), the H5P engine is complete:
the ten content types only, HVL's permission system, learner state under the pseudonym, Nynorsk-first
strings, upload sniffing and SVG sanitising, offline audited seeding, and our own Express 5 routes with a
script-safe player page. There is no listening server yet: S3 adds the entry point with Feide and LTI
authentication and mounts `createH5pRouter` at `/h5p`.

## How to run

```bash
# once
npm install                                  # from the repository root
cp apps/server/.env.example apps/server/.env # local settings; matches docker-compose.yml
docker compose up -d                         # PostgreSQL 16, Redis 7, S3 emulator
npm run h5p:fetch-core                       # H5P core 1.28.0 + pinned editor, verified (D-027)
npm run db:generate --workspace apps/server  # Prisma client into src/generated/
npm run db:migrate                           # apply prisma/migrations

# every day
npm run boot-check --workspace apps/server   # proves the H5P engine would start (logs core 1.28 + Hub host);
                                             # needs only the fetched H5P files, no services or .env
npx vitest run --project server              # unit + integration + browser tests (need the services, Chromium)
npm run typecheck
npm run seed:libraries                       # install the content types from the verified seed packages (offline)
npm run docs:api                             # browsable API docs into docs/api/ (TypeDoc)
NODE_USE_ENV_PROXY=1 npm run hub:check       # spike step 3: Hub registration and versions (needs the Hub)
```

Integration tests (`*.int.test.ts`) are skipped with a warning that names the missing variables when
`DATABASE_URL`, `REDIS_URL`, the S3 credentials or `PSEUDONYM_SECRETS` are not set; in CI (`CI=true`) a
missing variable fails the run instead (D-023).

## Folder structure

| Path | Responsibility |
|---|---|
| `src/config/env.ts` | The zod schema of every environment variable; startup fails with the variable's name |
| `src/config/productionChecks.ts` | Extra startup rules for `NODE_ENV=production` (a current-year pseudonym secret exists; no pseudonym secret is readable text or low in distinct bytes) |
| `src/logging/` | pino logger with key-based redaction (sensitive keys, endings and Feide attributes) and pattern-based redaction of credentials and e-mail addresses in free text; Prisma errors are logged by name and code only, in `err` and in `msg`. Names in free text cannot be detected, so callers never put them in messages |
| `src/privacy/` | Academic-year boundary, pseudonym secrets, `deriveLearnerKey` (HMAC-SHA256) |
| `src/i18n/` | Server messages in `nn` (default), `nb`, `en`, and the typed `t()` lookup |
| `src/infra/` | Clients: Prisma (PostgreSQL), Redis, S3 |
| `src/h5p/H5pConfigFactory.ts` | H5P config: Core 1.28, hub-api.h5p.org, 50 MB / 200 MB limits, allowlist, finished data off, 5 s state saves; only harmless stored settings survive loading |
| `src/h5p/createH5pRuntime.ts` | Builds the whole engine once: config check, storages, permission system, sanitisers, editor, player, guard |
| `src/h5p/H5pEditorFactory.ts`, `H5pPlayerFactory.ts`, `h5pAssets.ts` | Every engine option HVL depends on (F1 local ID, F3 Core 1.28 styles, language fallback, renderers) |
| `src/h5p/HvlH5PEditor.ts`, `HvlTop10ContentTypeFilter.ts`, `semantics/` | The ten types, DragQuestion removal, sub-content policy, save order, package import rules |
| `src/h5p/HvlPermissionSystem.ts`, `permissions/`, `permissionSystemGuard.ts`, `HvlH5pUser.ts` | Who may do what (`H5P-006`), the actor's account and state views (D-036), and the start-up check that every Lumi component uses it |
| `src/h5p/HvlTranslationCallback.ts`, `h5pTranslationResources.ts` | Lumi's strings in nn → nb → en (`H5P-008`) |
| `src/h5p/libraries/` | Package manifest and version checks, library audit, the offline seeder (`seed:libraries`) |
| `src/h5p/render/` | Our player page with script-safe JSON (D-040) |
| `src/h5p/hubCheck.ts` | `hub:check`: registration and Hub versions, on demand only (D-041) |
| `src/http/` | `createH5pRouter`: public client files, then the authenticated editor, file, state, content and player routes, and the translated error handler |
| `src/h5p/coreVersionCheck.ts`, `h5pServerInit.ts`, `bootCheck.ts` | Refuse to start when the fetched core files are not API 1.28 |
| `src/h5p/h5pStorage.ts` | Builds every storage adapter from the clients (the `H5P-004` table) |
| `src/h5p/storage/` | The adapters: content (PostgreSQL + S3), temporary files (S3), settings (Redis), libraries (with the nn → nb fallback), learner state (PostgreSQL, by pseudonym) |
| `src/h5p/jobs/` | `TemporaryFileCleanupJob`: every 5 minutes, once per interval across all nodes |
| `src/security/zipEntryGuard.ts` | Rejects zip-slip, absolute paths, symlinks and oversize packages before extraction |
| `src/security/FileTypeSniffer.ts`, `sniff/` | Refuses files whose bytes do not match their extension (`SEC-002`) |
| `src/security/SvgSanitizer.ts`, `svg/` | Pre-check, Lumi's sanitiser, DOMPurify pass and final XML check for SVGs (`SEC-001`, D-044) |
| `src/security/ContentFileHeaders.ts` | Content-Type, `nosniff`, sandbox CSP and disposition for every user file (`SEC-004`, D-045) |
| `prisma/schema/*.prisma` | Database schema, one file per domain; described field by field in `docs/privacy/DATA-INVENTORY.md` |
| `prisma/migrations/` | Generated SQL migrations (plus one hand-written CHECK constraint, marked in the file) |
| `h5p/core`, `h5p/editor` | H5P client files, fetched and verified; not in git |
| `src/generated/` | Generated Prisma client; not in git |
| `test/` | Vitest tests; titles start with the requirement ID, e.g. `[DATA-002] …` |

## Key flows

**Startup (`npm run boot-check`, the seeder, and from S3 the HTTP server via `createH5pRuntime`).**

```mermaid
sequenceDiagram
    participant Boot as bootCheck / server
    participant Env as config/env.ts
    participant Init as h5pServerInit
    participant Files as h5p/core, h5p/editor
    participant Log as logger
    Boot->>Env: loadEnvPart(LOG_LEVEL and H5P keys); the seeder (and from S3 the server) calls loadEnv
    Env-->>Boot: typed config, or InvalidEnvironmentError naming each variable
    Boot->>Init: h5pServerInit(env, logger)
    Init->>Init: createH5pConfig: load stored settings, then reset all but the allowlist and apply 1.28, hub-api, limits
    Init->>Files: read $coreApi from h5p.classes.php, check editor entry script
    alt core API is not 1.28 or files missing
        Init-->>Boot: CoreVersionMismatchError → exit 1
    else
        Init->>Log: {h5pCoreApi: "1.28", hubHost: "hub-api.h5p.org"}
    end
```

**An H5P request (`createH5pRouter`).** Public client files are served first; every other route needs the
actor that S3's `authenticate` middleware sets, and Lumi asks HVL's permission system before it acts:

```mermaid
sequenceDiagram
    participant B as Browser (editor or player)
    participant R as createH5pRouter
    participant A as authenticate (S3)
    participant L as Lumi (HvlH5PEditor / H5PPlayer)
    participant P as HvlPermissionSystem
    B->>R: GET /h5p/core/js/h5p.js
    R-->>B: 200, nosniff, cached for a year (no actor needed)
    B->>R: POST /h5p/contentUserData/:id/state/0
    R->>A: who is this?
    A-->>R: res.locals.h5pActor (or none → 401)
    R->>L: createOrUpdateContentUserData(…, asStateUser(actor), actor.contextId)
    L->>P: checkForUserData(EditState, id, learnerKey)
    P-->>L: allow only for the actor's own pseudonym and a viewable activity
    L-->>R: stored under learnerKey + course
    R-->>B: {success: true}; any error → translated JSON, never an internal message
```

**Where H5P data is stored (`H5P-004`).**

```mermaid
flowchart LR
    Editor[HvlH5PEditor / H5PPlayer] --> CS[PrismaContentStorage]
    CS -->|metadata, parameters, file list| PG[(PostgreSQL)]
    CS --> FS[S3ContentFileStore] -->|media files| S3[(S3 content bucket)]
    Editor --> TS[S3TemporaryFileStorage] -->|uploads before save| S3T[(S3 temporary bucket)]
    Editor --> KV[RedisKeyValueStorage] -->|settings, content-type cache| R[(Redis)]
    Editor --> LK[RedisLockProvider] --> R
    Editor --> LS[LanguageFallback → CachedLibraryStorage → FileLibraryStorage] -->|installed libraries| VOL[(shared volume)]
    Editor --> UD[PrismaContentUserDataStorage] -->|learner state by learnerKey| PG
    Job[TemporaryFileCleanupJob] -->|lease: once per 5 min| R
    Job -->|delete expired| TS
```

**Learner pseudonym (`DATA-002`).** The raw Feide ID or LTI `iss`/`sub` exists only during the request
(the callers arrive with Feide login and LTI launch in S3):

```mermaid
sequenceDiagram
    participant Launch as LTI launch / Feide login (S3)
    participant Derive as deriveLearnerKey
    participant Year as academicYearOf
    participant Secrets as PSEUDONYM_SECRETS
    participant DB as PostgreSQL
    Launch->>Derive: {kind: 'lti', issuer, subject}, secrets, now
    Derive->>Year: now
    Year-->>Derive: 2026 (from 1 August, Oslo time)
    Derive->>Secrets: get(2026)
    alt no secret for 2026
        Secrets-->>Derive: undefined → MissingPseudonymSecretError
    else
        Secrets-->>Derive: 32+ random bytes
        Derive->>Derive: HMAC-SHA256(secret, "lti|iss|sub") → base64url
        Derive-->>Launch: learnerKey (43 characters)
        Launch->>DB: H5PUserData / XapiStatement keyed by learnerKey only
    end
    Note over Secrets,DB: Yearly purge (S6): rows deleted, the year's secret destroyed — leftovers cannot be linked to anyone.
```

## Configuration

Every variable is listed, with purpose, whether it is secret, its default and an example, in
[`.env.example`](.env.example) (`DOC-008`). The schema in `src/config/env.ts` is the single source; doc-lint
fails if the two disagree. Summary:

| Variable | Secret | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection |
| `REDIS_URL` | yes* | Shared cache, locks, job leases |
| `S3_ENDPOINT`, `S3_REGION`, `S3_FORCE_PATH_STYLE` | no | S3-compatible storage location |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | yes | S3 credentials |
| `S3_CONTENT_BUCKET`, `S3_TEMPORARY_BUCKET` | no | Buckets for activity files and editor uploads |
| `H5P_CORE_DIR`, `H5P_EDITOR_DIR`, `H5P_LIBRARY_DIR` | no | H5P client files and installed libraries |
| `H5P_SITE_UUID` | no | Pre-registered Hub site (workaround F2) |
| `PSEUDONYM_SECRETS` | yes | One HMAC secret per academic year |
| `NODE_ENV`, `LOG_LEVEL` | no | Runtime mode and log level |

\* when the URL contains a password.

## Implements

| Requirement | Where | Tests |
|---|---|---|
| `H5P-001` Core 1.28 and the new Hub | `src/h5p/H5pConfigFactory.ts`, `coreVersionCheck.ts`, `h5pServerInit.ts`, `bootCheck.ts` | `test/h5p/H5pConfigFactory.test.ts`, `test/h5p/h5pServerInit.test.ts` |
| `H5P-004` Production storage adapters | `src/h5p/h5pStorage.ts`, `src/h5p/storage/*`, `src/h5p/jobs/*` | `test/h5p/contentStorage.int.test.ts`, `test/h5p/sharedState.int.test.ts`, `test/h5p/S3TemporaryFileStorage.test.ts`, `test/h5p/s3Objects.test.ts`, `test/h5p/cleanupJob.test.ts`, `test/h5p/libraryStorageFactory.test.ts` |
| `H5P-002`, `PROD-002`, `SEC-008` The ten types, no DragQuestion, inert markup | `src/h5p/HvlTop10ContentTypeFilter.ts`, `HvlH5PEditor.ts`, `semantics/*`, `render/*` | `test/h5p/HvlTop10ContentTypeFilter.test.ts`, `test/h5p/HvlH5PEditor*.test.ts`, `test/h5p/semantics/*`, `test/http/ajax.int.test.ts`, `test/http/contentSave.int.test.ts`, `test/http/player.int.test.ts` |
| `H5P-003`, `H5P-011` Offline seeding and library audit | `src/h5p/libraries/*` | `test/h5p/libraries/*`, `test/http/packageImport.int.test.ts` |
| `H5P-005`, `PROD-008` Resume learner state | `src/h5p/storage/PrismaContentUserDataStorage.ts`, `src/http/routes/userDataRoutes.ts` | `test/h5p/PrismaContentUserDataStorage*.int.test.ts`, `test/http/userData.int.test.ts`, `test/http/player.browser.int.test.ts` |
| `H5P-006` Permission system | `src/h5p/HvlPermissionSystem.ts`, `permissions/*`, `permissionSystemGuard.ts` | `test/h5p/permissions/*`, `test/h5p/HvlPermissionSystem.test.ts`, `test/h5p/permissionSystemGuard.test.ts`, `test/http/*.int.test.ts` |
| `H5P-008` Nynorsk first | `src/h5p/HvlTranslationCallback.ts`, `storage/LanguageFallbackLibraryStorage.ts` | `test/h5p/HvlTranslationCallback.test.ts`, `test/h5p/LanguageFallbackLibraryStorage.test.ts` |
| `SEC-001` SVG sanitising | `src/security/SvgSanitizer.ts`, `svg/*` | `test/security/SvgSanitizer*.test.ts`, `test/security/svgFinalCheck.test.ts`, `test/http/editorUpload.int.test.ts` |
| `SEC-002` Allowlist and type sniffing | `src/h5p/H5pConfigFactory.ts`, `src/security/FileTypeSniffer.ts`, `sniff/*` | `test/security/FileTypeSniffer*.test.ts`, `test/http/editorUpload.int.test.ts` |
| `SEC-003` Only admins install libraries | `src/h5p/HvlH5PEditor.ts`, `permissions/contentRules.ts` | `test/h5p/HvlH5PEditor.upload.test.ts`, `test/http/packageImport.int.test.ts`, `test/http/ajax.int.test.ts` |
| `SEC-004` Headers for user files | `src/security/ContentFileHeaders.ts`, `src/http/sendUserFile.ts` | `test/security/ContentFileHeaders.test.ts`, `test/http/contentFiles.int.test.ts` |
| `SEC-005` Size limits and archive safety | `src/security/zipEntryGuard.ts`, `src/h5p/storage/s3Objects.ts`, `src/http/multipartUpload.ts` | `test/security/zipEntryGuard.test.ts`, `test/h5p/s3Objects.test.ts`, `test/http/multipartUpload.test.ts` |
| `DATA-001` Data inventory | `prisma/schema/*.prisma`, `prisma.config.ts` | `tools/privacy/test/checkInventory.test.mjs`, `test/db/schema.int.test.ts` |
| `DATA-002` Pseudonymous learners | `src/privacy/*`, `src/config/productionChecks.ts`, CHECK constraint in the first migration | `test/privacy/deriveLearnerKey.test.ts`, `test/config/env.test.ts`, `test/db/schema.int.test.ts` |
| `DATA-009`, `NFR-006` No personal data in logs | `src/logging/*` | `test/logging/logger.test.ts`, `test/logging/loggerMessages.test.ts`, `test/logging/redactText.test.ts` |
| `PROD-012`, `DOC-009` Three languages, Nynorsk first | `src/i18n/*` | `test/i18n/translate.test.ts` |
| `DOC-008` Configuration documented | `src/config/env.ts`, `.env.example` | `test/config/env.test.ts` |

Decisions that shape this package: D-023 (test services), D-024 (TypeScript 6.0), D-025 (own S3 adapters),
D-026 (library storage), D-027 (fetched H5P files), D-028 (user-data adapter), D-030 (accepted
`image-size` advisory), D-031 (S1 items finished in S2), D-032 (superseded), and D-035…D-046 for Session 2
(own Express 5 routes, actor views, state storage, sub-content policy, own templates, library change control,
seeder location, uploads, SVG rules, file headers, language fallback).
