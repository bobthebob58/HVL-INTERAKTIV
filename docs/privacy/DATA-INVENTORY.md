# Data inventory

> Requirement `DATA-001`. Every model and field in `apps/server/prisma/schema/*.prisma` appears here.
> `npm run privacy:inventory-check` fails in CI when the schema and this file disagree, and when a
> learner table gains a column that looks like a direct identifier (`DATA-002`).
> HVL is the data controller. The legal basis must be confirmed by HVL's data protection officer in
> the DPIA (`DATA-005`); until then it is the assumption stated in spec 05 §2.

## How to read the tables

| Column | Meaning |
|---|---|
| Purpose | Why the field is stored. A field with no purpose is not stored. |
| Category | **None**: not personal data. **Staff PII**: personal data about staff (authors, admins). **Learner PII**: a direct identifier of a learner. **Pseudonymous**: learner data that can be linked to a person only with that academic year's secret (`DATA-002`); it becomes unlinkable when the yearly purge destroys the secret. **Pseudonymous (stable key)**: a keyed HMAC whose key does not rotate yearly, so the value stays linkable as long as that key exists. The key is `IDENTITY_HASH_KEYS` (D-055): a new key is added second, then put first once every server holds it, matching rows are re-hashed at the next login, and the old key is removed at least 13 months later (a leaked key follows the same steps; whoever holds it can test guessed Feide IDs and IP addresses against a copy of the database for as long as rows hashed with it remain, also after the key is removed: audit IP hashes up to 2 years, identities never re-hashed by a later login). **Secret**: a credential, not personal data. |
| Legal basis | **6(1)(e)**: GDPR Art. 6(1)(e), a task in the public interest (higher education). **n/a**: not personal data. |
| Retention | **Yearly purge**: deleted 30 days after the academic year ends, and that year's pseudonym secret is destroyed (`DATA-003`). **Account**: until the staff account is deleted. **2 years**: audit records (`DATA-007`). Other periods are stated in the row. |
| Location | **PG**: PostgreSQL hosted in Norway or the EEA, encrypted at rest (`DATA-004`). Media bytes are in S3-compatible storage in the same region. |

Logs are not stored in the database. They contain no personal data (`DATA-009`) and are kept for 30 days.

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

One formative score for one attempt, waiting to be sent to the Canvas gradebook (`LTI-012`, D-104, D-115). The
worker sends one score per learner and placement, chosen by the placement's attempt policy, and settles that learner's
due jobs together.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | Yearly purge | PG |
| `placementId` | Which placement | None | n/a | Yearly purge | PG |
| `learnerKey` | The learner's pseudonym | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `ltiSubEncrypted` | Canvas user ID, which AGS requires; the only raw learner ID kept longer than 24 hours (`LtiIdToken.claims` holds `sub` for 24 h) (DATA-002) | Learner PII (encrypted) | 6(1)(e) | Set to null 30 days after `terminalAt`, whether the job succeeded, failed or was orphaned (D-104) | PG |
| `attemptId` | The bridge's attempt (`<viewId>:<n>`, a random page-load ID and a counter) whose gradable result made the job (D-115) | None | n/a | Yearly purge | PG |
| `scoreGiven` | The attempt's formative score (`scaled × 100`), from which the attempt policy chooses the score to send | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `resultAt` | When the server stored that result (its statement's `timestamp`); orders a learner's attempts for the `latest` policy (D-115) | None | n/a | Yearly purge | PG |
| `status` | Pending, succeeded, failed or orphaned (the assignment is gone from Canvas, D-104) | None | n/a | Yearly purge | PG |
| `attempts` | How many times the worker has tried to send it (at most 8, D-104) | None | n/a | Yearly purge | PG |
| `lastError` | Error code and HTTP status from Canvas, no response body | None | n/a | Yearly purge | PG |
| `idempotencyKey` | `<placementId>:<learnerKey>:<attemptId>`: one job per placement, learner and attempt, so a repeated result updates its job instead of sending twice (D-104). PRIVACY: it holds the learner's pseudonym, as `learnerKey` does | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `nextAttemptAt` | When the worker may next try (backoff); null once the job is no longer pending | None | n/a | Yearly purge | PG |
| `succeededAt` | When Canvas accepted the score | None | n/a | Yearly purge | PG |
| `terminalAt` | When the job stopped (succeeded, failed or orphaned); starts the 30-day clock for `ltiSubEncrypted` (D-104) | None | n/a | Yearly purge | PG |
| `academicYear` | The academic year of the pseudonym secret that made `learnerKey`; the yearly purge deletes by it (`DATA-003`, D-107). Database default: the year of the write in Oslo time. PRIVACY: a year, not about the learner | None | n/a | Yearly purge | PG |
| `createdAt` | Audit | None | n/a | Yearly purge | PG |
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
| `learnerKey` | Counts distinct learners for *k*-suppression | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `verb` | answered, completed, … | None | n/a | Yearly purge | PG |
| `scoreRaw` | Item difficulty (INS-002) | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `scoreMax` | Item difficulty | None | n/a | Yearly purge | PG |
| `scaled` | Item difficulty | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `success` | Correct or not | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `completion` | Completed or not | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `response` | Choice indices or short gap text, for misconceptions (INS-003) | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `durationMs` | Time on task | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `attemptId` | Groups events of one attempt: `<viewId>:<n>`, a random page-load ID and a counter made by the bridge (D-115) | None | n/a | Yearly purge | PG |
| `timestamp` | When the server received the statement (plus its place in the batch in milliseconds, never the browser's clock, D-115); insight periods and time on task | None | n/a | Yearly purge | PG |
| `academicYear` | The academic year of the pseudonym secret that made `learnerKey`; the yearly purge deletes by it (`DATA-003`). A field outside `DATA-012`'s list (`SPEC-DEVIATION`, D-107). Database default: the year of the write in Oslo time; migration `s6_grade_bridge_insight` set existing rows from `timestamp`. A portal session keeps its key up to 12 hours past 1 August (D-057), so the writer of a portal play's row sets the key's year itself. PRIVACY: a year, not about the learner | None | n/a | Yearly purge | PG |

## InsightSnapshot

Aggregates already suppressed below *k* learners; no row identifies anyone.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | With the activity (survives the purge) | PG |
| `contentId` | The activity | None | n/a | With the activity (survives the purge) | PG |
| `contextId` | Canvas course as `<LtiPlatform.id>:<context ID>` (D-103), null for the portal; a database CHECK refuses any other shape | None | n/a | With the activity (survives the purge) | PG |
| `contentVersion` | The content version the aggregates describe (`PROD-013`); the purge writes one snapshot per activity, context and version (D-107) | None | n/a | With the activity (survives the purge) | PG |
| `periodStart` | Period covered | None | n/a | With the activity (survives the purge) | PG |
| `periodEnd` | Period covered | None | n/a | With the activity (survives the purge) | PG |
| `k` | Suppression threshold used | None | n/a | With the activity (survives the purge) | PG |
| `aggregates` | Counts, rates and medians | None | n/a | With the activity (survives the purge) | PG |
| `createdAt` | Audit | None | n/a | With the activity (survives the purge) | PG |

## AuditEvent

Who did what to which object (DATA-007).

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | 2 years | PG |
| `at` | When | None | n/a | 2 years | PG |
| `actorUserId` | Who (empty for scheduled jobs) | Staff PII (by reference) | 6(1)(e) | 2 years | PG |
| `action` | Action code, e.g. `insight.view` | None | n/a | 2 years | PG |
| `targetType` | Kind of object | None | n/a | 2 years | PG |
| `targetId` | Which object | None; Pseudonymous when the target is a learner (data-subject actions, `DATA-008`) | 6(1)(e) | 2 years | PG |
| `details` | Structured details, never free text with personal data; in `content.coauthor.add` and `content.coauthor.remove` it holds the co-author's `User.id` (D-090), so a search for a person's audit events reads it as well as `actorUserId` | None; Staff PII (by reference) in `content.coauthor.*` | 6(1)(e) | 2 years | PG |

## Redis keys

Everything the server writes to Redis: portal sessions, login transactions, caches, locks and job leases. Not
database models, so the inventory check does not read this section. Redis is hosted with PostgreSQL
(`DATA-004`); session and login keys are a SHA-256 of the cookie value, so a Redis dump does not reveal a usable
cookie (D-057). Learner state is never in Redis: it lives in PostgreSQL (`H5PUserData`).

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| session `userId` | Who is logged in | Staff PII (by reference); learner: Pseudonymous (stable key, by reference) | 6(1)(e) | Logout, 2 h idle or 12 h absolute | Redis |
| session `roles`, `hvlMember`, `studentAuthor`, `locale` | Permissions computed at login (D-057) | None | n/a | Logout, 2 h idle or 12 h absolute | Redis |
| session `learnerKey` | The learner pseudonym for H5P state, computed at login | Pseudonymous | 6(1)(e) | Logout, 2 h idle or 12 h absolute | Redis |
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
