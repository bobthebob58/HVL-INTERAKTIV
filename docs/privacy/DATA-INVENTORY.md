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
| Category | **None**: not personal data. **Staff PII**: personal data about staff (authors, admins). **Learner PII**: a direct identifier of a learner. **Pseudonymous**: learner data that can be linked to a person only with that academic year's secret (`DATA-002`); it becomes unlinkable when the yearly purge destroys the secret. **Pseudonymous (stable key)**: a keyed HMAC whose key does not rotate yearly, so the value stays linkable as long as that key exists; the key and its rotation are defined with the authentication code in Session 3 (spec 02). **Secret**: a credential, not personal data. |
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
| `displayName` | Name shown to co-authors and in the portfolio export (staff only) | Staff PII | 6(1)(e) | Account | PG |
| `email` | Contact for co-author invitations (staff only) | Staff PII | 6(1)(e) | Account | PG |
| `createdAt` | Account age, for purge and audit | None | n/a | Account; learner rows: yearly purge | PG |

## Identity

One login method of a user. The subject is stored only as an HMAC.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | Account; learner rows: yearly purge | PG |
| `userId` | Links the login to the user | Staff PII (by reference); learner rows: Pseudonymous | 6(1)(e) | Account; learner rows: yearly purge | PG |
| `provider` | Feide or LTI | None | n/a | Account; learner rows: yearly purge | PG |
| `subjectHash` | Recognises the same person at the next login without storing the Feide ID or LTI `sub` | Pseudonymous (stable key) | 6(1)(e) | Account; learner rows: yearly purge | PG |
| `platformId` | Which LMS an LTI identity comes from | None | n/a | Account; learner rows: yearly purge | PG |
| `createdAt` | Purge boundary | None | n/a | Account; learner rows: yearly purge | PG |

## AuthAuditEvent

Login, logout and role events (spec 02).

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | 2 years | PG |
| `at` | When it happened | None | n/a | 2 years | PG |
| `actorUserId` | Who logged in (internal ID; empty for failed logins) | Staff PII (by reference); learner rows: Pseudonymous | 6(1)(e) | 2 years | PG |
| `event` | Event code, e.g. `login.feide` | None | n/a | 2 years | PG |
| `ipHash` | Keyed hash of the IP address, for abuse detection only | Pseudonymous (stable key) | 6(1)(e) | 2 years | PG |

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
| `version` | Increments on structural change; insight compares like with like | None | n/a | Until deleted by the author | PG |
| `sourceContentId` | The activity this one was copied from | None | n/a | Until deleted by the author | PG |
| `createdAt` | Sorting and audit | None | n/a | Until deleted by the author | PG |
| `updatedAt` | Sorting and audit | None | n/a | Until deleted by the author | PG |

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
| `contextId` | Canvas course, so state is separate per course; empty outside Canvas | None | n/a | Yearly purge | PG |
| `data` | The learner's answers so far, so they can resume | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `preload` | H5P: send with the player | None | n/a | Yearly purge | PG |
| `invalidate` | H5P: drop when the activity changes | None | n/a | Yearly purge | PG |
| `updatedAt` | Purge boundary | None | n/a | Yearly purge | PG |

## LibraryAuditEvent

An admin changed the installed H5P libraries.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | 2 years | PG |
| `actorUserId` | The admin | Staff PII (by reference) | 6(1)(e) | 2 years | PG |
| `machineName` | Library, e.g. `H5P.Blanks` | None | n/a | 2 years | PG |
| `fromVersion` | Version before | None | n/a | 2 years | PG |
| `toVersion` | Version after (empty on removal) | None | n/a | 2 years | PG |
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
| `claims` | LTI claims of the launch. With Canvas `privacy_level` anonymous it holds no name or e-mail, but it holds `sub` | Learner PII | 6(1)(e) | 24 h | PG |
| `createdAt` | Expiry calculation | None | n/a | 24 h | PG |
| `expiresAt` | When it is deleted | None | n/a | 24 h | PG |

## LtiNonce

Used OIDC nonces, to reject replayed launches.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `nonce` | Random value from the launch | None | n/a | 1 h | PG |
| `createdAt` | Expiry calculation | None | n/a | 1 h | PG |

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
| `createdAt` | Audit | None | n/a | While placed | PG |
| `updatedAt` | Audit | None | n/a | While placed | PG |

## GradeSyncJob

One score waiting to be sent to the Canvas gradebook.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | Yearly purge | PG |
| `placementId` | Which placement | None | n/a | Yearly purge | PG |
| `learnerKey` | The learner's pseudonym | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `ltiSubEncrypted` | Canvas user ID, which AGS requires; the only raw learner ID kept longer than 24 hours (`LtiIdToken.claims` holds `sub` for 24 h) (DATA-002) | Learner PII (encrypted) | 6(1)(e) | Set to null 30 days after success | PG |
| `scoreGiven` | Formative score to send | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `status` | Pending, succeeded or failed | None | n/a | Yearly purge | PG |
| `attempts` | Retry count | None | n/a | Yearly purge | PG |
| `lastError` | Error code and HTTP status from Canvas, no response body | None | n/a | Yearly purge | PG |
| `idempotencyKey` | Prevents sending the same score twice | None | n/a | Yearly purge | PG |
| `succeededAt` | Starts the 30-day clock for `ltiSubEncrypted` | None | n/a | Yearly purge | PG |
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
| `reason` | The author's reason, shown in insight and the portfolio | Staff PII (authored text) | 6(1)(e) | With the activity or the author's account | PG |
| `userId` | The author | Staff PII (by reference) | 6(1)(e) | With the activity or the author's account | PG |
| `at` | When | None | n/a | With the activity or the author's account | PG |

## XapiStatement

One learning event, reduced to the DATA-012 fields.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | Yearly purge | PG |
| `contentId` | The activity | None | n/a | Yearly purge | PG |
| `subContentId` | The question inside it | None | n/a | Yearly purge | PG |
| `contentVersion` | Compare like with like across edits | None | n/a | Yearly purge | PG |
| `contextId` | Canvas course, for per-course insight | None | n/a | Yearly purge | PG |
| `learnerKey` | Counts distinct learners for *k*-suppression | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `verb` | answered, completed, … | None | n/a | Yearly purge | PG |
| `scoreRaw` | Item difficulty (INS-002) | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `scoreMax` | Item difficulty | None | n/a | Yearly purge | PG |
| `scaled` | Item difficulty | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `success` | Correct or not | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `completion` | Completed or not | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `response` | Choice indices or short gap text, for misconceptions (INS-003) | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `durationMs` | Time on task | Pseudonymous | 6(1)(e) | Yearly purge | PG |
| `attemptId` | Groups events of one attempt | None | n/a | Yearly purge | PG |
| `timestamp` | Insight period and purge boundary | None | n/a | Yearly purge | PG |

## InsightSnapshot

Aggregates already suppressed below *k* learners; no row identifies anyone.

| Field | Purpose | Category | Legal basis | Retention | Location |
|---|---|---|---|---|---|
| `id` | Internal key | None | n/a | With the activity (survives the purge) | PG |
| `contentId` | The activity | None | n/a | With the activity (survives the purge) | PG |
| `contextId` | Canvas course | None | n/a | With the activity (survives the purge) | PG |
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
| `details` | Structured details, never free text with personal data | None | n/a | 2 years | PG |
