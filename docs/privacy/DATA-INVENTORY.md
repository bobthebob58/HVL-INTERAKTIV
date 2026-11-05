# Data inventory

> Requirement `DATA-001`. Every model and field in `apps/server/prisma/schema/*.prisma` appears here.
> `npm run privacy:inventory-check` fails in CI when the schema and this file disagree, and when a
> learner table gains a column that looks like a direct identifier (`DATA-002`).
> HVL is the data controller. The legal basis must be confirmed by HVL's data protection officer in
> the DPIA (`DATA-005`); until then it is the assumption stated in spec 05 §2. The DPIA input
> ([DPIA-INPUT.md](DPIA-INPUT.md)) takes its data categories, retention periods and locations from this file.

## How to read the tables

| Column | Meaning |
|---|---|
| Purpose | Why the field is stored. A field with no purpose is not stored. |
| Category | **None**: not personal data. **Staff PII**: personal data about staff (authors, admins). **Learner PII**: a direct identifier of a learner. **Pseudonymous**: learner data that can be linked to a person only with that academic year's secret (`DATA-002`); it becomes unlinkable once HVL operations destroy that year's secret after the yearly purge (D-107; a manual step, DPIA input R15). **Pseudonymous (stable key)**: a keyed HMAC whose key does not rotate yearly, so the value stays linkable as long as that key exists. The key is `IDENTITY_HASH_KEYS` (D-055): a new key is added second, then put first once every server holds it, matching rows are re-hashed at the next login, and the old key is removed at least 13 months later (a leaked key follows the same steps; whoever holds it can test guessed Feide IDs and IP addresses against a copy of the database for as long as rows hashed with it remain, also after the key is removed: audit IP hashes up to 2 years, identities never re-hashed by a later login). **Secret**: a credential, not personal data. |
| Legal basis | **6(1)(e)**: GDPR Art. 6(1)(e), a task in the public interest (higher education). **n/a**: not personal data. |
| Retention | **Yearly purge**: deleted by the yearly purge, by default on 31 August (at least 30 days after the academic year ends on 31 July), by the academic year stored on the row; HVL operations then destroy that year's pseudonym secret (`DATA-003`, D-107, `docs/ops/yearly-purge.md`). **Account**: until the staff account is deleted; nothing deletes a staff account automatically today, so this is done by hand (DPIA input R28). **2 years**: audit records (`DATA-007`); no job deletes them yet, so until one is built they are kept longer (DPIA input R27). Other periods are stated in the row. |
| Location | **PG**: PostgreSQL hosted in Norway or the EEA, encrypted at rest (`DATA-004`; the host is HVL's choice, Q5). Media bytes are in S3-compatible storage in the same region. **Redis**: Redis in the same hosting. In production the server refuses unencrypted database, Redis and S3 connections and storage outside an EEA allow-list (D-109); where a server stands stays a deployment-checklist item. |

Logs are not stored in the database. They contain no personal data (`DATA-009`) and are kept for 30 days; the
request log's fields are listed at the end of this file.

## User

A person who uses the service. Learner rows have no name or e-mail (database CHECK constraint, DATA-002).

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | Account; learner rows: yearly purge | PG |
| `kind` | Staff or learner; decides which fields may be filled | None | n/a | Account; learner rows: yearly purge | PG |
| `displayName` | Name shown to co-authors and in the portfolio export (staff only); from S5 also to HVL colleagues in co-author search (D-090), on the owner's content-bank listings (D-091) and as the source author of a copy (D-092) | Staff PII | 6(1)(e) | Account | PG |
| `email` | Not stored (D-090 amendment 2026-10-29: nothing uses it; co-author search matches names and Feide IDs). Each staff login writes null, so an address stored before is cleared; the column stays until a migration drops it | Staff PII (none stored) | n/a | Cleared at the next staff login | PG |
| `createdAt` | Account age, for purge and audit | None | n/a | Account; learner rows: yearly purge | PG |
| `coAuthorSearchableAt` | Lets colleagues find an HVL staff member as a co-author (PROD-007, D-090): set at each Feide login of an HVL staff author (an HVL member with the author role, i.e. an `employee`, `faculty` or `staff` affiliation, who is not a student author), cleared at a Feide login that is not one, never changed by an LTI launch, and ignored once 13 months old. Never set for learners, student authors, admin-only members or LTI-only accounts | Staff PII | 6(1)(e) | Account; replaced at each Feide login, not searchable after 13 months | PG |

## Identity

One login method of a user. The subject is stored only as an HMAC.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | Account; learner rows: yearly purge | PG |
| `userId` | Links the login to the user | Staff PII (by reference); learner rows: Pseudonymous (stable key, by reference; D-034) | 6(1)(e) | Account; learner rows: yearly purge | PG |
| `provider` | Feide or LTI | None | n/a | Account; learner rows: yearly purge | PG |
| `subjectHash` | Recognises the same person at the next login without storing the Feide ID or LTI `sub` | Pseudonymous (stable key) | 6(1)(e) | Account; learner rows: yearly purge | PG |
| `subjectKeyId` | Which identity key made `subjectHash`, so a rotated key can be found and the row re-hashed (D-055) | None | n/a | Account; learner rows: yearly purge | PG |
| `platformId` | Which LMS an LTI identity comes from | None | n/a | Account; learner rows: yearly purge | PG |
| `createdAt` | Purge boundary | None | n/a | Account; learner rows: yearly purge | PG |

## AuthAuditEvent

Login, logout, author launch and account-linking events (D-064). Learner LTI launches are not recorded
(minimisation).

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | 2 years | PG |
| `at` | When it happened | None | n/a | 2 years | PG |
| `actorUserId` | Who logged in (internal ID; empty for failed logins) | Staff PII (by reference); learner rows: Pseudonymous (stable key, by reference; D-034) | 6(1)(e) | 2 years | PG |
| `event` | Event code, e.g. `login.feide` | None | n/a | 2 years | PG |
| `reason` | Fixed failure code, e.g. `deployment-not-allowed`; never free text | None | n/a | 2 years | PG |
| `ipHash` | Keyed hash of the IP address, for abuse detection only | Pseudonymous (stable key) | 6(1)(e) | 2 years | PG |
| `ipKeyId` | Which identity key made `ipHash` (D-055) | None | n/a | 2 years | PG |

## NoticeDismissal

A notice a staff user dismissed, such as the formative-use notice (PROD-011, D-075). Learners never see these
notices, so no learner row is ever written. Deleted with the account (foreign key with cascade).

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `userId` | Whose dismissal it is | Staff PII (by reference) | 6(1)(e) | Account | PG |
| `noticeId` | Which notice, from a fixed allowlist (e.g. `formative-use`) | None | n/a | Account | PG |
| `noticeVersion` | The version dismissed; a newer version is shown again | None | n/a | Account | PG |
| `at` | When it was dismissed | None | n/a | Account | PG |

## H5PContent

One H5P activity.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | Until deleted by the author | PG |
| `mainLibrary` | Content type, e.g. `H5P.MultiChoice` | None | n/a | Until deleted by the author | PG |
| `title` | Shown in lists and Canvas | None | n/a | Until deleted by the author | PG |
| `params` | The activity itself (questions, feedback texts) | None | n/a | Until deleted by the author | PG |
| `metadata` | H5P metadata: licence, authors as entered by the author, dependencies | Staff PII (author names, if entered) | 6(1)(e) | Until deleted by the author | PG |
| `status` | Draft or published | None | n/a | Until deleted by the author | PG |
| `visibility` | Who may open it outside Canvas (PROD-006) | None | n/a | Until deleted by the author | PG |
| `ownerUserId` | The author who owns it | Staff PII (by reference) | 6(1)(e) | Until deleted by the author | PG |
| `version` | Increments on a structural save of the activity, which resets learners' saved progress (D-093, amending D-074); xAPI statements record it, so insight compares like with like; learner pages send it with each state write | None | n/a | Until deleted by the author | PG |
| `sourceContentId` | The activity this one was copied from | None | n/a | Until deleted by the author | PG |
| `createdAt` | Sorting and audit | None | n/a | Until deleted by the author | PG |
| `updatedAt` | Sorting and audit; the publish flow checks it so a changed activity is never published unseen (D-074) | None | n/a | Until deleted by the author | PG |
| `publishedAt` | When the activity was last published through the publish flow (PROD-003); empty while it is a draft | None | n/a | Until deleted by the author | PG |
| `bankListedAt` | When the owner listed the activity in the HVL content bank, where HVL staff authors (not student authors) see it and may copy it while the owner is findable staff (PROD-007, D-091 and D-092 as amended); empty when not listed | None | n/a | Until the owner withdraws the listing, makes the activity private or unpublishes it | PG |
| `sourceAuthorUserId` | The owner of the source activity when this copy was made, so the copy credits them; their name is read when the copy is shown (PROD-007, D-092) | Staff PII (by reference) | 6(1)(e) | Until the copy is deleted; set to empty when the source author's account is deleted | PG |

## H5PContentFile

A media file inside an activity. The bytes are in S3.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | With the activity | PG |
| `contentId` | Which activity uses it | None | n/a | With the activity | PG |
| `filename` | Name H5P uses to load it | None | n/a | With the activity | PG |
| `s3Key` | Where the bytes are | None | n/a | With the activity | PG; bytes in S3 |
| `size` | Quota and limits (SEC-005) | None | n/a | With the activity | PG |
| `sha256` | Integrity and de-duplication | None | n/a | With the activity | PG |
| `createdAt` | Audit | None | n/a | With the activity | PG |

## ContentCollaborator

A co-author of an activity.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `contentId` | The activity | None | n/a | With the activity or the account | PG |
| `userId` | The co-author | Staff PII (by reference) | 6(1)(e) | With the activity or the account | PG |
| `role` | What the co-author may do | None | n/a | With the activity or the account | PG |
| `createdAt` | Audit | None | n/a | With the activity or the account | PG |

## H5PUserData

Resume state of one learner in one activity (H5P-005).

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | Yearly purge | PG |
| `contentId` | The activity | None | n/a | Yearly purge | PG |
| `subContentId` | Part of the activity (`0` = whole) | None | n/a | Yearly purge | PG |
| `dataType` | H5P state type, e.g. `state` | None | n/a | Yearly purge | PG |
| `learnerKey` | The learner's yearly pseudonym (DATA-002) | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `contextId` | Canvas course, so state is separate per course; empty outside Canvas. The bare launch context ID, not `<platformId>:<contextId>`: a collision between two Canvas instances only shares one learner's own saved state, and changing the key would reset everyone's progress (D-103) | None | n/a | Yearly purge | PG |
| `data` | The learner's answers so far, so they can resume (H5P's state as a JSON string, D-038) | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `preload` | H5P: send with the player | None | n/a | Yearly purge | PG |
| `invalidate` | H5P: drop when the activity changes | None | n/a | Yearly purge | PG |
| `updatedAt` | When the state was last saved | None | n/a | Yearly purge | PG |
| `academicYear` | The academic year (e.g. `2026` for 2026/27) of the pseudonym secret that made `learnerKey`; the yearly purge deletes the ended year's rows by it (`DATA-003`, D-107). The database default is the year of the write in Oslo time; migration `s6_grade_bridge_insight` set existing rows from `updatedAt`. A portal session keeps its key up to 12 hours past 1 August (D-057), so the writer sets the key's year itself. PRIVACY: a year, not about the learner | None | n/a | Yearly purge | PG |

## LibraryAuditEvent

An H5P library was installed or updated, by the seed command or an admin's package import (D-041).

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | 2 years | PG |
| `actorUserId` | The admin; empty when the seed command installed it | Staff PII (by reference) | 6(1)(e) | 2 years | PG |
| `source` | How the library arrived: `seed` or `upload` | None | n/a | 2 years | PG |
| `machineName` | Library, e.g. `H5P.Blanks` | None | n/a | 2 years | PG |
| `fromVersion` | Version before | None | n/a | 2 years | PG |
| `toVersion` | Version after | None | n/a | 2 years | PG |
| `sha256` | Hash of the installed package | None | n/a | 2 years | PG |
| `at` | When | None | n/a | 2 years | PG |

## LtiPlatform

A registered LMS such as HVL's Canvas.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | While registered | PG |
| `url` | Issuer (`iss`) | None | n/a | While registered | PG |
| `clientId` | Developer key client ID | None | n/a | While registered | PG |
| `name` | Display name of the platform | None | n/a | While registered | PG |
| `authenticationEndpoint` | OIDC login endpoint | None | n/a | While registered | PG |
| `accessTokenEndpoint` | OAuth2 token endpoint | None | n/a | While registered | PG |
| `authorizationServer` | Token audience, if different | None | n/a | While registered | PG |
| `idTokenValidationMethod` | How launch tokens are verified (JWKS URL or key) | None | n/a | While registered | PG |
| `idTokenValidationKey` | The JWKS URL or public key | None | n/a | While registered | PG |
| `active` | Launches allowed | None | n/a | While registered | PG |
| `publicKey` | Tool public key for this platform | None | n/a | While registered | PG |
| `privateKeyEncrypted` | Tool private key, encrypted by the application | Secret | n/a | While registered | PG |
| `createdAt` | Audit | None | n/a | While registered | PG |
| `updatedAt` | Audit | None | n/a | While registered | PG |

## LtiDeployment

A deployment of the tool that may launch it, from `LTI_PLATFORMS` (D-051).

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | While configured | PG |
| `platformId` | Which LMS | None | n/a | While configured | PG |
| `deploymentId` | Canvas deployment ID; launches from other deployments are refused | None | n/a | While configured | PG |
| `createdAt` | Audit | None | n/a | While configured | PG |

## LtiAccessToken

Cached OAuth2 token for AGS and NRPS calls.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | Until expiry (≤ 1 h) | PG |
| `platformUrl` | Platform issuer | None | n/a | Until expiry (≤ 1 h) | PG |
| `clientId` | Client ID | None | n/a | Until expiry (≤ 1 h) | PG |
| `scopes` | Granted scopes | None | n/a | Until expiry (≤ 1 h) | PG |
| `tokenEncrypted` | The token, encrypted | Secret | n/a | Until expiry (≤ 1 h) | PG |
| `createdAt` | Expiry calculation | None | n/a | Until expiry (≤ 1 h) | PG |
| `expiresAt` | When it is deleted | None | n/a | Until expiry (≤ 1 h) | PG |

## LtiIdToken

A validated launch token, needed by ltijs during the launch.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | ltijs record key | None | n/a | 24 h | PG |
| `claims` | The allowlisted LTI claims of the launch (D-052): never names, e-mail, `lis` or unknown custom fields, but it holds `sub` | Learner PII | 6(1)(e) | 24 h (never read after; deleted at most 10 minutes later) | PG |
| `createdAt` | Expiry calculation | None | n/a | 24 h | PG |
| `expiresAt` | When it is deleted | None | n/a | 24 h | PG |

## LtiNonce

Used OIDC nonces, to reject replayed launches.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `nonce` | Random value from the launch | None | n/a | 10 minutes (D-052) | PG |
| `createdAt` | Expiry calculation | None | n/a | 10 minutes (D-052) | PG |

## LtiPlacement

An activity placed in a Canvas course.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | While placed | PG |
| `platformId` | Which LMS | None | n/a | While placed | PG |
| `contextId` | Canvas course ID | None | n/a | While placed | PG |
| `resourceLinkId` | Canvas link ID | None | n/a | While placed | PG |
| `contentId` | Which activity | None | n/a | While placed | PG |
| `lineItemUrl` | Gradebook column, if graded | None | n/a | While placed | PG |
| `attemptPolicy` | Best, latest or mastery (LTI-012) | None | n/a | While placed | PG |
| `masteryThreshold` | Score needed for mastery | None | n/a | While placed | PG |
| `contextLabel` | The course label from the launch (`context.label`, e.g. `SYK110`), suggested to the author as a course code (D-087); kept only when, normalised, it is a course code with a digit, else null, because a sandbox label may hold a teacher's name; overwritten at each launch. Residual risk, accepted in D-087 (W3 amendment): a sandbox label that normalises to a code with a digit, such as «Kari 2025», is stored as if it were a course code and may name a teacher; it is shown only to the authors of activities placed in that course | None (a course code); Staff PII in the accepted residual | 6(1)(e) | While placed | PG |
| `createdAt` | Audit | None | n/a | While placed | PG |
| `updatedAt` | Audit | None | n/a | While placed | PG |

## GradeSyncJob

One learner's formative score in one Canvas gradebook column: one job per placement and learner (`LTI-012`, D-104 and
its amendment of 2026-11-04, D-115). Each new gradable result reopens the job; the worker sends the score that the
placement's attempt policy gives over the learner's stored results (`XapiStatement`), read when it sends.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | Yearly purge | PG |
| `placementId` | Which placement | None | n/a | Yearly purge | PG |
| `learnerKey` | The learner's pseudonym | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `ltiSubEncrypted` | Canvas user ID, which AGS requires; the only raw learner ID kept longer than 24 hours (`LtiIdToken.claims` holds `sub` for 24 h) (DATA-002) | Learner PII (encrypted) | 6(1)(e) | Set to null 30 days after `terminalAt`, whether the job succeeded, failed or was orphaned (D-104) | PG |
| `attemptId` | The bridge's attempt (`<viewId>:<n>`, a random page-load ID and a counter) of the result the job took in last (D-115, D-104 amendment of 2026-11-04) | None | n/a | Yearly purge | PG |
| `scoreGiven` | That result's formative score (`scaled × 100`); the worker compares it to see whether a result came in while a score was being sent (the score sent is computed from the stored results) | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `resultAt` | When the server stored that result (its statement's `timestamp`); compared like `scoreGiven`, and read by the reconciling pass, which reopens a stopped job for a newer stored result (D-104 amendment of 2026-11-04) | None | n/a | Yearly purge | PG |
| `status` | Pending, succeeded, failed or orphaned (the assignment is gone from Canvas, D-104) | None | n/a | Yearly purge | PG |
| `attempts` | How many times the worker has tried to send it (at most 8, D-104) | None | n/a | Yearly purge | PG |
| `lastError` | Error code and HTTP status from Canvas, no response body | None | n/a | Yearly purge | PG |
| `idempotencyKey` | `<placementId>:<learnerKey>`: one job per placement and learner, so the queue never grows with the number of results and a repeated result updates the job instead of sending twice (D-104 and its amendment of 2026-11-04). PRIVACY: it holds the learner's pseudonym, as `learnerKey` does | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `nextAttemptAt` | When the worker may next try (backoff); null once the job is no longer pending | None | n/a | Yearly purge | PG |
| `succeededAt` | When Canvas accepted the score | None | n/a | Yearly purge | PG |
| `terminalAt` | When the job stopped (succeeded, failed or orphaned); starts the 30-day clock for `ltiSubEncrypted` (D-104) | None | n/a | Yearly purge | PG |
| `academicYear` | The academic year of the pseudonym secret that made `learnerKey`; the yearly purge deletes by it (`DATA-003`, D-107). Database default: the year of the write in Oslo time. PRIVACY: a year, not about the learner | None | n/a | Yearly purge | PG |
| `createdAt` | When the job's current sending began: its creation, or the moment a new result reopened it after it had stopped; the 8 attempts fall within 24 hours of it (D-104 amendment of 2026-11-04) | None | n/a | Yearly purge | PG |
| `updatedAt` | Audit | None | n/a | Yearly purge | PG |

## LearningDesignMetadata

Pedagogical metadata on an activity (PED-030).

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `contentId` | The activity | None | n/a | With the activity | PG |
| `phase` | Forarbeid, Mellomarbeid or Etterarbeid | None | n/a | With the activity | PG |
| `courseCode` | Course, e.g. `SYK110` | None | n/a | With the activity | PG |
| `rationale` | The author's reasoning, used in the portfolio | Staff PII (authored text) | 6(1)(e) | With the activity | PG |
| `estimatedStudentMinutes` | Shown to students before they start | None | n/a | With the activity | PG |
| `patternId` | The pattern the activity was created from (D-085, D-087), e.g. `ea-retrieval`; copied with a duplicate (D-092) | None | n/a | With the activity | PG |
| `learnerPurpose` | One line, at most 200 characters, on why the activity matters, shown to learners before they start (PED-032, D-087); copied with a duplicate (D-092) | None | n/a | With the activity | PG |
| `updatedAt` | Audit | None | n/a | With the activity | PG |

## LearningOutcome

A læringsutbyte an activity serves.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | With the activity | PG |
| `metadataContentId` | The activity | None | n/a | With the activity | PG |
| `text` | The outcome in the author's words | None | n/a | With the activity | PG |
| `category` | NKR category | None | n/a | With the activity | PG |
| `position` | Order | None | n/a | With the activity | PG |

## ValidationAcknowledgement

An author published despite a validator error (UD-022).

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | With the activity or the author's account | PG |
| `contentId` | The activity | None | n/a | With the activity or the author's account | PG |
| `ruleId` | Which rule, e.g. `V-IMG-ALT` | None | n/a | With the activity or the author's account | PG |
| `path` | Where in the activity | None | n/a | With the activity or the author's account | PG |
| `reason` | The author's reason, shown to the activity's editors in the publish flow, in insight and the portfolio; never copied into the audit log (DATA-007) | Staff PII (authored text) | 6(1)(e) | With the activity or the author's account | PG |
| `userId` | The author | Staff PII (by reference) | 6(1)(e) | With the activity or the author's account | PG |
| `at` | When | None | n/a | With the activity or the author's account | PG |

## XapiStatement

One learning event, reduced to the DATA-012 fields (D-115: only what insight and grading read is stored).

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | The bridge's random `statementId`, so a statement sent twice is stored once (D-115) | None | n/a | Yearly purge | PG |
| `contentId` | The activity | None | n/a | Yearly purge | PG |
| `subContentId` | The question inside it | None | n/a | Yearly purge | PG |
| `contentVersion` | Compare like with like across edits | None | n/a | Yearly purge | PG |
| `contextId` | Canvas course, for per-course insight, as `<LtiPlatform.id>:<context ID>` so courses of two Canvas instances never merge (D-103); null for a portal play. A database CHECK refuses any other shape | None | n/a | Yearly purge | PG |
| `learnerKey` | Counts distinct learners for *k*-suppression (insight numbers each view's learners and never returns the key; the mappe groups by it the same way, D-095's amendment of 2026-11-04); the grade worker reads a learner's own gradable results by it when it sends their score to Canvas (D-104 amendment of 2026-11-04) | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `verb` | answered, completed, … | None | n/a | Yearly purge | PG |
| `scoreRaw` | Item difficulty (INS-002) | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `scoreMax` | Item difficulty | None | n/a | Yearly purge | PG |
| `scaled` | Item difficulty; for a gradable root result, its formative score, from which the grade worker computes the placement's policy score when it sends (D-115, D-104 amendment of 2026-11-04) | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `success` | Correct or not | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `completion` | Completed or not | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `response` | Choice indices or short gap text, for misconceptions (INS-003); a wrong gap answer is shown only when *k* or more learners gave it, and only for the current content version (D-106's amendment of 2026-11-04) | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `durationMs` | Time on task | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `attemptId` | Groups events of one attempt: `<viewId>:<n>`, a random page-load ID and a counter made by the bridge (D-115) | None | n/a | Yearly purge | PG |
| `timestamp` | When the server received the statement (plus its place in the batch in milliseconds, never the browser's clock, D-115); insight periods and time on task; orders a learner's results for the `latest` policy and bounds the grade worker's reconciling pass (D-104 amendment of 2026-11-04) | None | n/a | Yearly purge | PG |
| `academicYear` | The academic year of the pseudonym secret that made `learnerKey`; the yearly purge deletes by it (`DATA-003`). A field outside `DATA-012`'s list (`SPEC-DEVIATION`, D-107). Database default: the year of the write in Oslo time; migration `s6_grade_bridge_insight` set existing rows from `timestamp`. A portal session keeps its key up to 12 hours past 1 August (D-057), so the writer of a portal play's row sets the key's year itself. PRIVACY: a year, not about the learner | None | n/a | Yearly purge | PG |
| `testUser` | True for a statement of Canvas's Student View test student (the LTI `TestUser` role), set from the launch, never from the statement (D-102's amendment of 2026-11-04). Stored so that a teacher can test the score passback (the grade worker reads the learner's own rows by `learnerKey`); insight, the mappe and the purge's snapshots never read a flagged row, so a test student is in none of their aggregates and no *k* count (its grade job is still in the grade-sync status counts, which are not *k*-suppressed). A field outside `DATA-012`'s list (`SPEC-DEVIATION`, D-102); database default false (migration `s6_test_user_statements`). PRIVACY: says only that the launch was Canvas's test student, a teacher's own test | None | n/a | Yearly purge | PG |

## InsightSnapshot

Aggregates already suppressed below *k* learners; no row identifies anyone.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | With the activity (survives the purge) | PG |
| `contentId` | The activity | None | n/a | With the activity (survives the purge) | PG |
| `contextId` | Canvas course as `<LtiPlatform.id>:<context ID>` (D-103), null for the portal; a database CHECK refuses any other shape | None | n/a | With the activity (survives the purge) | PG |
| `contentVersion` | The content version the aggregates describe (`PROD-013`); the purge writes one snapshot per activity, context and version (D-107) | None | n/a | With the activity (survives the purge) | PG |
| `periodStart` | Period covered; for a yearly-purge snapshot, 1 August of the ended year at midnight in Oslo (D-107) | None | n/a | With the activity (survives the purge) | PG |
| `periodEnd` | Period covered; for a yearly-purge snapshot, the next 1 August at midnight in Oslo (D-107) | None | n/a | With the activity (survives the purge) | PG |
| `k` | Suppression threshold used | None | n/a | With the activity (survives the purge) | PG |
| `aggregates` | Counts, rates and medians, already suppressed below *k*. A snapshot the yearly purge writes (`source: "yearly-purge"`, D-107) holds the mappe's figures for the year (`MAPPE-002`: participants, completion rate, median attempts, mean change) under the mappe's group rules (D-095 and its amendment), with the academic year and whether it is `suppressed`; a hidden value is absent, and no learner key, answer or count of a group below *k* is stored. A suppressed snapshot still shows that between 1 and *k* − 1 learners played the activity in that course and version that year (DPIA input R18) | None | n/a | With the activity (survives the purge) | PG |
| `createdAt` | Audit | None | n/a | With the activity (survives the purge) | PG |

## AuditEvent

Who did what to which object (DATA-007).

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | 2 years | PG |
| `at` | When | None | n/a | 2 years | PG |
| `actorUserId` | Who: the staff member who acted; for a data-subject request the HVL admin account of the operator who ran it (D-108); empty for scheduled jobs, the purge CLI and a refused data-subject request | Staff PII (by reference) | 6(1)(e) | 2 years | PG |
| `action` | Action code, e.g. `insight.view`, `purge.run` (D-107), `dataSubject.export` or `dataSubject.erase` (D-108) | None | n/a | 2 years | PG |
| `targetType` | Kind of object: `H5PContent`, `LtiPlacement` (a grade-sync retry), `AcademicYear`, `DataSubjectRequest`, or `learner` in the dormant event named below | None | n/a | 2 years | PG |
| `targetId` | Which object: an activity (`content.*`, `insight.*`); a placement (`content.gradeSync.retry`); an academic year (`purge.run`, D-107); or, for a data-subject request, a random request ID that only HVL's case record links to the person, never a Feide ID, `sub`, learner key or hash (D-108). The H5P permission system's audit of an admin's access to another learner's H5P state (`h5p.userData.dataSubjectAccess`, `H5P-006`) would name a `learnerKey`, but nothing gives an admin such a request (the data-subject CLI deletes through the storage without that check), so no such event is written today | None; Pseudonymous only in the dormant `h5p.userData.dataSubjectAccess` event | 6(1)(e) | 2 years | PG |
| `details` | Structured details, never free text with personal data; `insight.view` and `insight.export` hold only the view (`beforeSession`), the period, the context (D-103's key or `portal`) and the content version, never a count, answer or learner (D-106); in `content.coauthor.add` and `content.coauthor.remove` it holds the co-author's `User.id` (D-090), so a search for a person's audit events reads it as well as `actorUserId`; `purge.run` holds the trigger, dry run, outcome, years and row counts (D-107); `dataSubject.*` holds the dry run, outcome, years, how many identifiers were given, counts, unreachable years and what remained after an erasure: numbers, years and fixed words, never an identifier, key or hash (D-108) | None; Staff PII (by reference) in `content.coauthor.*` | 6(1)(e) | 2 years | PG |

## Database views (schema `analytics`)

Views of rows that are already in this inventory, for the read-only analytics role `hvli_analytics` (`DATA-010`,
D-109 and its amendments). They store nothing, so the inventory check does not read this section.
`apps/server/prisma/roles/02-grants.sql` builds them after every migration; the role reads these views and no table.
A new view needs an amendment to D-109 and may show only aggregates already suppressed below *k*.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `analytics.insight_snapshot.id`, `content_id`, `context_id`, `content_version`, `period_start`, `period_end`, `k`, `aggregates`, `created_at` | `InsightSnapshot`'s fields in snake_case, for analysts' tools in R and Python | None (aggregates already suppressed below *k*) | n/a | As the `InsightSnapshot` row | PG (view) |
| `analytics.insight_snapshot.content_type` | The activity's content type (`H5PContent.mainLibrary`), so content types can be compared | None | n/a | As the `H5PContent` row | PG (view) |

## Redis keys

Everything the server writes to Redis: portal sessions, login transactions, caches, locks and job leases. Not
database models, so the inventory check does not read this section. Redis is hosted with PostgreSQL
(`DATA-004`); session and login keys are a SHA-256 of the cookie value, so a Redis dump does not reveal a usable
cookie (D-057): a portal session is the value of `hvli:sess:<base64url SHA-256 of the session ID>` and a login
transaction that of `hvli:login:<base64url SHA-256 of the transaction ID>`; the rows below name their fields. Learner
state is never in Redis: it lives in PostgreSQL (`H5PUserData`). Checked 2026-11-05 against every Redis call in
`apps/server/src` (each key prefix is a constant next to its call) and ltijs 7.0.7's cache keys.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| session `userId` | Who is logged in | Staff PII (by reference); learner: Pseudonymous (stable key, by reference) | 6(1)(e) | Logout, 2 h idle or 12 h absolute | Redis |
| session `roles`, `hvlMember`, `studentAuthor`, `locale` | Permissions computed at login (D-057) | None | n/a | Logout, 2 h idle or 12 h absolute | Redis |
| session `learnerKey` | The learner pseudonym for H5P state, computed at login | Pseudonymous | 6(1)(e) | Logout, 2 h idle or 12 h absolute | Redis |
| session `learnerKeyYear` | The academic year of the secret behind `learnerKey`, computed at login from the same moment, so a learner's rows carry the year the yearly purge deletes them by (D-107) | None | n/a | Logout, 2 h idle or 12 h absolute | Redis |
| session `csrfToken` | Synchronizer token for state-changing requests (AUTH-003) | Secret | n/a | Logout, 2 h idle or 12 h absolute | Redis |
| session `idTokenEncrypted` | Feide ID token for `id_token_hint` at logout (D-021), encrypted (D-056) | Staff or learner PII (encrypted) | 6(1)(e) | Logout, 2 h idle or 12 h absolute | Redis |
| session `createdAt`, `lastSeenAt` | Idle and absolute expiry | None | n/a | Logout, 2 h idle or 12 h absolute | Redis |
| login `state`, `nonce`, `codeVerifier` | Bind the Feide callback to this browser (login CSRF, PKCE) | Secret | n/a | Single use, at most 10 minutes | Redis |
| login `returnTo` | A checked local path to open after login | None | n/a | Single use, at most 10 minutes | Redis |
| login `createdAt` | Enforces the 10-minute limit alongside the Redis expiry | None | n/a | Single use, at most 10 minutes | Redis |
| LTI cache `hvli:lti:cache:keyset:default` | The tool's own public keyset, served at `/lti/keys` (D-050) | None | n/a | 60 seconds | Redis |
| LTI cache `hvli:lti:cache:oidc:jwks:<url>` | A platform's public JWKS, for launch-token signatures (D-050) | None | n/a | 5 minutes | Redis |
| lease `hvli:lti:record-cleanup` | A random node ID: one server runs the LTI record cleanup per interval | None | n/a | About 10 minutes | Redis |
| lock `hvli:content:write-lock:<contentId>` (ID in lower case) | A random token: one save or publish of an activity at a time across servers (D-074) | None | n/a | Until the save or publish ends, at most 60 seconds | Redis |
| H5P key-value store `hvli:h5p:kv:*` | Lumi's settings and the Hub content-type cache (`RedisKeyValueStorage`) | None | n/a | Until replaced | Redis |
| H5P locks `@simple-redis-mutex:lock-install-library:<library>` and `…:lock-install-from-directory:<library>` (Lumi's `RedisLockProvider`; no `hvli:` prefix) | Serialise library installs across servers | None | n/a | Seconds (while the install runs) | Redis |
| `@simple-redis-mutex:fencing-tokens` | The lock library's fencing counter (an integer) | None | n/a | Never expires | Redis |
| lease `hvli:h5p:temporary-file-cleanup` | A random node ID: one server cleans temporary editor files per interval | None | n/a | About 5 minutes | Redis |
| counter `hvli:people-search:<userId>` | How many co-author searches the person made in the current minute, for the rate limit (D-090); a number, never the query | Staff PII (by reference) | 6(1)(e) | 60 seconds | Redis |
| counter `hvli:copies:<userId>` | How many copies (duplicates and «Lagre som ny versjon») the author started in the current ten minutes, for the copy limit (D-092 amendment 2026-10-29); a number, never the source | Staff PII (by reference) | 6(1)(e) | 10 minutes | Redis |
| counter `hvli:xapi:<userId>:<contentId>` | How many xAPI statements the learner sent about the activity in the current minute, for `LTI-011`'s limit of 120 (D-115); a number, never a statement | Pseudonymous (by reference) | 6(1)(e) | 60 seconds | Redis |
| counter `hvli:grade-sync-retries:<userId>` | How many grade-sync retries the author asked for in the current ten minutes, for the retry limit (`LTI-012`, D-104); a number, never the activity, placement or learners | Staff PII (by reference) | 6(1)(e) | 10 minutes | Redis |
| count `hvli:nrps:count:<platformId>:<contextId>` | The number of active learners in a Canvas course and when it was counted, read from NRPS after a launch: insight's denominator (`LTI-008`, `INS-001`, D-103); never a member, ID or role | None (an aggregate) | n/a | 30 days after the last successful count | Redis |
| mark `hvli:nrps:fresh:<platformId>:<contextId>` | The course's count is fresh, so no launch reads the roster again within the hour (`LTI-008`) | None | n/a | 1 hour; 5 minutes after a failed read | Redis |
| counter `hvli:insight-requests:<userId>` | How many insight views, contexts, CSV downloads and findings the person asked for in the current minute, for the limit of 60 (`INS-007`); a number, never the activity, context or period | Staff PII (by reference) | 6(1)(e) | 60 seconds | Redis |
| lease `hvli:grades:sync` | A random node ID: one server sends queued grades per interval (D-104) | None | n/a | About 15 seconds | Redis |
| lease `hvli:grades:subject-cleanup` | A random node ID: one server clears expired encrypted Canvas `sub`s per interval (`DATA-002`, D-104) | None | n/a | About 1 hour | Redis |
| lease `hvli:privacy:retention-purge` | A random node ID: one server checks the yearly purge per hour (`DATA-003`, D-107) | None | n/a | About 1 hour | Redis |

## Logs and the request ID

Not stored by the server: it writes JSON lines to standard output, and HVL's log collection keeps them for 30 days
(`DATA-009`; where they are kept is HVL's choice, Q5). The logger redacts by key (`DATA-009`); other log lines hold
fixed event names, IDs of activities, platforms or jobs, counts, HTTP statuses and error names or codes, never a user
ID (checked 2026-11-05 by a search of the server's log calls). Not database models, so
the inventory check does not read this section.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| request log `requestId` | Ties a response to its error lines (`NFR-006`, D-109): a well-formed inbound `X-Request-Id` (a UUID or 32 hexadecimal digits, as nginx's `$request_id`), otherwise a random UUID; anything else is replaced, so a client cannot write a name or token into the log. Also sent back in the `X-Request-Id` response header | None | n/a | 30 days | Log store |
| request log `method`, `status`, `durationMs`, `aborted` | Observability: what kind of request, its outcome, its time to 0.1 ms, and whether the client left first | None | n/a | 30 days | Log store |
| request log `route` | The route pattern Express matched (e.g. `/api/content/:contentId`), or its router's mount path with `/*`; never the path or query, which can carry an ltik, a signed file grant or IDs (D-109) | None | n/a | 30 days | Log store |

| upload scanner `reason`, `signatures` | Why an upload was refused (`SEC-006`, D-110's amendment): a reason code (`malware-found`, `unreachable`, `timeout`, `tls`, `connection-lost`, `size-limit`, `no-verdict`, `scanner-error`) and, for a finding, at most five signature names filtered to `[A-Za-z0-9._:-]`; never a file name, path, user or clamd's text | None | n/a | 30 days | Log store |
| `PDF export availability` (`pdfAvailable`, `pdfSandbox`, `reason`) | One start-up line on whether the mappe PDF can print with Chromium's sandbox (`MAPPE-004`, D-110's amendment); never Chromium's error text | None | n/a | 30 days | Log store |
| LTI error-page line (`route`, `status`, `requestId`, `code`) | Why an LTI request was refused: the route pattern and a fixed code, never the path, the body or a client's error text (`NFR-006`) | None | n/a | 30 days | Log store |

The reverse proxy in front of the server keeps its own access log, outside this application. It must not log the
query string, because some routes accept `?ltik=` (`docs/ops/`, DPIA input R26). clamd keeps its own log on HVL's
host (DPIA input R38). Backups made with `npm run ops:backup` hold the database's rows and the content bucket's
objects as they are, so every table above is in them for 30 days (`NFR-002`; DPIA input F13).
