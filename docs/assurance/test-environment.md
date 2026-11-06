# Stage 1: an isolated test environment

| | |
|---|---|
| **For** | HVL IT (operations and security), with HVL's Feide administrator and TeCopp |
| **Status** | **Draft request for HVL IT to correct.** Written 2026-11-05 by the AI assistant (Claude) that wrote the code; reviewed by nobody yet |
| **Asks for** | One isolated test install with **made-up data only**, Feide test users, HVL's test Canvas, named testers and an end date |
| **Overview** | [README.md](README.md) (the stages, the status, the caveat); install steps in [docs/ops/](../ops/README.md) |

Items marked *(IT to fill in)* are HVL facts the repository cannot know. Items marked *(proposal)* are this draft's
suggestion, for IT to accept or change.

## 1. Purpose

Stage 0 runs the app against mocks only (`tools/mock-platform`, D-049). Stage 1 is the first install on HVL's own
infrastructure and the first contact with the real Feide and a real Canvas, with nothing real at stake. It is where:

- TeCopp and the testers run the Canvas acceptance checklist, steps A1–H3, in HVL's test Canvas
  ([docs/handoff/canvas-acceptance.md](../handoff/canvas-acceptance.md)), which answers Q3, Q4, Q8 and Q13;
- the live-contract seam (`apps/server/live/`, `npm run test:live`) runs against the test Canvas and real Feide for
  the first time; so far it has passed only against the mocks
  ([live-contract-seam.md](../handoff/live-contract-seam.md));
- IT answers the parts of Q5 that need a real host: the runtime and the PDF sandbox, the files host's DNS name and
  certificate, and clamd;
- HVL's bachelor students can finish the Canvas integration (D-101), if IT gives them tester access.

## 2. What HVL IT provides

| Item | What we ask | Evidence |
|---|---|---|
| **Host** | One VM or container host that runs the server image (Docker, Kubernetes or OpenShift). The app container runs as uid 10001, read-only, with every capability dropped except `SYS_CHROOT`, under Playwright's seccomp profile (`deploy/seccomp/`) | [docker.md](../ops/docker.md), «What the image holds»; `deploy/compose.app.yml:52-59,143` |
| **If the runtime refuses that profile** | OpenShift's `restricted-v2` allows neither the profile nor `SYS_CHROOT`. Then the PDF export of the pedagogisk mappe answers 503 and the Markdown export still works; record it as a Q5 finding *(proposal: acceptable in stage 1)*. Never `--no-sandbox` or `SYS_ADMIN` | docker.md:43-58; Evaluator Guide §6, item 17; D-096 |
| **Sizing** | **To be agreed.** Measured so far: the image is about 2.8 GB, and the smoke test (build, builder cache and app stack) needs about 8 GB free disk at its peak; a 20-learner load smoke passed on one 4-CPU machine with every service on it; the development clamd (ClamAV 1.4) took about 1 GB memory; `/tmp` is a 512 MB tmpfs; at most `PDF_MAX_CONCURRENCY` (default 2) Chromium pages render at once. The dev container, which builds and runs everything, asks for 4 CPUs, 16 GB memory and 32 GB disk; that is not a server sizing. The 200-learner test (`npm run load:full`) decides production sizing | docker.md:135-137; [runbook](../ops/runbook.md) §1, §8; `docs/ops/clamav.md:134`; `deploy/compose.app.yml:58-59`; `apps/server/.env.example:248`; `.devcontainer/devcontainer.json:12` |
| **Two DNS names and TLS certificates** | The app (`PUBLIC_BASE_URL`) and the files host (`FILES_BASE_URL`, default `files.<host>`), which must be a different host. A separate registrable domain isolates more *(IT to choose, Q5)* | `apps/server/src/config/filesOrigin.ts:1-20`; runbook §1, §9; D-110; `SEC-004` |
| **Reverse proxy** | TLS for both names; an access log **without the query string** (a few routes accept `?ltik=`); a request ID in `X-Request-Id`; `X-Forwarded-Host` set by the proxy itself; `Host` passed on; scripts and styles compressed; `TRUST_PROXY` set to the number of proxies | runbook §9; `NFR-006` |
| **PostgreSQL 16** | In the EEA, with TLS that checks the server (`sslmode=verify-full`); the three roles `hvli_migrator`, `hvli_app` and `hvli_analytics` created by HVL's database administrator | [database-roles.md](../ops/database-roles.md); `DATA-004`, `DATA-010`; D-109 |
| **Redis 7** | In the EEA, over TLS (`rediss://`), with `maxmemory-policy noeviction` | `apps/server/.env.example:32-37`; runbook §1 |
| **S3-compatible storage** | In the EEA, over https; two plain-named buckets, content and temporary, the temporary one with a 1-day lifecycle rule; no public access. With `NODE_ENV=production` the server accepts a custom endpoint only under `hvl.no` or `sikt.no`, or AWS in an EEA region; both lists are marked *(verify)*, and another domain needs a reviewed code change and an amendment to D-109 | runbook §1, §9; `apps/server/src/config/storageResidency.ts:9-15,31-41`; Q5 |
| **clamd** | Daily signature updates; `AlertExceedsMax yes` and `AlertEncrypted yes` (required); `StreamMaxLength` at least 50 MB; `MaxScanTime` no higher than `CLAMAV_TIMEOUT_MS`; a TLS proxy without SNI unless clamd is on the loopback. Without a clamd the server starts only with `CLAMAV_ALLOW_UNSCANNED_UPLOADS=true` (uploads then go unscanned); *(proposal)* use a clamd, since stage 1 should prove that path | [clamav.md](../ops/clamav.md); runbook §9; `apps/server/.env.example:256-284`; `SEC-006` |
| **Outbound from the server** | Feide: `auth.dataporten.no` (discovery, token endpoint, signing keys) and `groups-api.dataporten.no`. HVL's test Canvas: `sso.test.canvaslms.com` or `sso.beta.canvaslms.com` for its keys, and the institution's test or beta domain for the token endpoint, grades and roster; which instance it is is Q4. Plus the database, Redis, S3 and clamd. **Nothing else at runtime:** no H5P Hub, no GitHub, no npm | `apps/server/src/config/env.ts:87,90`; [canvas-platform-values.md](../reference/canvas-platform-values.md) §1, §2, §10; D-041; docker.md, «Build the image» |
| **Inbound** | Testers' browsers reach both host names. Canvas reads the tool's public keys at `<PUBLIC_BASE_URL>/lti/keys` to check Deep Linking responses and grade-token requests, so any network restriction must leave that path reachable from Instructure's Canvas *(IT to confirm Instructure's source addresses)* | `docs/reference/canvas-lti13-developer-key.json:6`; canvas-platform-values.md:52 |
| **Secret store** | For every variable marked `Secret: yes` in `apps/server/.env.example`; never in the image or a file | runbook §1, §4; docker.md:27 |
| **Logs and health** | Somewhere to keep the server's JSON log lines (stdout) and a check of `GET /healthz` *(IT to fill in)*. The logs are designed to hold no personal data or tokens | runbook §7; `DATA-009`; `apps/server/src/logging/logger.ts` |
| **Backups** | Not needed for made-up data. *(Proposal)* IT may use stage 1 to try `npm run ops:backup` and a restore drill | runbook §6 |

## 3. What HVL's other parties provide

- **Feide (HVL's Feide administrator; Q3).** A registration in Feide's Customer Portal for the test server's address:
  the redirect URIs `<PUBLIC_BASE_URL>/auth/feide/callback` and `<PUBLIC_BASE_URL>/auth/logged-out`, a confidential
  client, and the attribute groups `userinfo-name`, `email`, `userid-feide`, `groups-org` and `groups-edu`, never
  `userinfo-photo` or `userid-nin` ([feide-values.md](../reference/feide-values.md), «What HVL IT registers»).
  - **Feide test users: to confirm with Sikt.** The Customer Portal has a login-provider setting for Feide test users
    that must be off before production (feide-values.md:147, 166). That comes from search-engine extracts of Feide's
    documentation, not from pages we opened. Whether the test users suit this registration is for Sikt to confirm.
  - A user can author only if their realm is in `ALLOWED_FEIDE_ORGS`, the Groups API returns their organisation
    group, and that group gives them a staff affiliation (`employee`, `faculty` or `staff`) or the `student`
    affiliation together with a course group listed in `AUTHOR_COURSE_GROUPS`; anyone else is a learner
    (`apps/server/src/auth/feide/FeideRoleMapper.ts:145-161`, D-059). If the test users have their own realm, add
    it to `ALLOWED_FEIDE_ORGS` on the test install only, and confirm with Sikt that they carry affiliations.
  - «Restrict login to selected organizations» (Q29): *(proposal)* on for stage 1, limited to the test users'
    organisation (and HVL, if named HVL testers use their own accounts).
- **TeCopp (Q4, Q13).** Paste `docs/reference/canvas-lti13-developer-key.json` into HVL's test Canvas, with the test
  server's address in place of `https://interaktiv.hvl.no` (also in `extensions[].domain`); keep `hvl_placement` in
  each placement; set the key's Redirect URIs field, which the pasted JSON does not carry, to
  `<PUBLIC_BASE_URL>/lti/launch` (canvas-platform-values.md §1.1); deploy the key only to a test course with one
  test teacher and at least two test students (canvas-acceptance.md, steps A2 and A4). Report the client ID, the
  deployment IDs and whether the instance is Instructure's test or beta environment (canvas-platform-values.md
  §10). `feideLinking` stays `false` in
  `LTI_PLATFORMS` until a test launch confirms `feide_login` (Q4, D-063).
- **The repository owner, or the maintainer once named (Q31).** Build the image and the content-type bundle from one
  commit on a machine that can reach GitHub, and hand IT the image by its digest (docker.md, «Build the image»;
  runbook §2). No workflow publishes or signs an image yet (`.github/workflows/docker.yml:29`). *(Proposal)* the
  commit is one that has passed the S6 gate and GitHub CI; the S6 gate passed locally on 2026-11-06, GitHub CI has not
  run on S6 yet (PROGRESS.md, session log «2026-11-06 · S6 gate»).
  The owner also names the testers, and the Feide IDs for `ADMIN_FEIDE_IDS`, if any tester must install libraries.

**The variables to set**, by name (`apps/server/.env.example` documents each; runbook §3 groups them). Secrets are
marked *; each key is new and random (`openssl rand -base64 32`), used on this install only and destroyed at the end.

| Group | Variables | Supplied by |
|---|---|---|
| Mode | `NODE_ENV=production` (the image's default, with `WEB_APP=prod`), so every production start-up check runs | Fixed (docker.md:26) |
| Services | `DATABASE_URL`* (the `hvli_app` role), `REDIS_URL`*, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`*, `S3_SECRET_ACCESS_KEY`*, `S3_FORCE_PATH_STYLE`, `S3_CONTENT_BUCKET`, `S3_TEMPORARY_BUCKET`; the `hvli_migrator` URL* for the migrate step only | HVL IT |
| Addresses | `PUBLIC_BASE_URL`, `FILES_BASE_URL`, `PORT`, `TRUST_PROXY`, `CANVAS_ORIGINS` | HVL IT; the Canvas hosts from TeCopp |
| Canvas | `LTI_PLATFORMS` (issuer, client ID, endpoints, deployment IDs), `AGS_LABEL_MODE`, `LTI_TOKEN_MAX_AGE_SECONDS`, `NRPS_MAX_PAGES` | TeCopp's values; defaults otherwise |
| Feide | `FEIDE_CLIENT_ID`, `FEIDE_CLIENT_SECRET`*, `ALLOWED_FEIDE_ORGS`, `ADMIN_FEIDE_IDS`, `AUTHOR_COURSE_GROUPS`; `FEIDE_ISSUER` and `FEIDE_GROUPS_API_URL` keep their defaults | The Feide registration; the owner |
| Keys | `PSEUDONYM_SECRETS`* (a secret for academic year 2026, which runs from 1 August 2026), `IDENTITY_HASH_KEYS`*, `DATA_ENCRYPTION_KEYS`*, `URL_SIGNING_KEYS`* | HVL IT (runbook §4; `apps/server/src/privacy/academicYear.ts:8`) |
| PDF and uploads | `PDF_MAX_CONCURRENCY`, `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT_MS`, `CLAMAV_TLS` | HVL IT |
| Never set | `PDF_ALLOW_NO_SANDBOX`, `AWS_ENDPOINT_URL_S3`, `AWS_ENDPOINT_URL`, `CLAMSCAN_*`, `CLAMDSCAN_*`. Runbook §3 also says never `CLAMAV_ALLOW_UNSCANNED_UPLOADS` in production; *(proposal)* for stage 1 only if IT has no clamd and accepts unscanned uploads | runbook §3; `apps/server/.env.example:280-284` |

The rest (`LOG_LEVEL`, `MIN_GROUP_SIZE`, `PURGE_RUN_DATE`, the `H5P_*` settings, the media origins, and
`PDF_BROWSER_EXECUTABLE`, whose empty default uses the image's own Chromium; `deploy/Dockerfile:109`) keep their
defaults.

## 4. The rules

- **Made-up data only.** No real student data and no copy of any production data: "test data is synthetic"
  (`DATA-010`). Activities hold made-up text and images with no real people in them. Problem reports carry no
  personal data ([rapportere-problem.md](../testing/rapportere-problem.md); [SECURITY.md](../../SECURITY.md)).
- **Test users only.** Feide test users and Canvas test accounts in a test course. If a named HVL tester must use
  their own Feide account (for example to test the staff author role), the staff data it stores (such as the display
  name and a keyed hash of the Feide ID) is listed in [DATA-INVENTORY.md](../privacy/DATA-INVENTORY.md) and deleted
  at the end
  *(IT and the DPO to decide)*.
- **No production Canvas.** The developer key goes only into HVL's test Canvas, never into a course with real
  students (canvas-acceptance.md; live-contract-seam.md:53).
- **Named testers only.** A list kept by the system owner *(IT to fill in; Q31)*. Access is limited by the Feide setting
  above, by deploying the key to the test course only, and *(IT to choose)* by a network rule that still lets
  testers' browsers reach both names and Canvas reach `/lti/keys`.
- **Time-limited.** An end date *(IT to fill in)*. *(Proposal)* no later than 2027-01-31, when the `image-size`
  audit exceptions expire and CI fails until one of D-112's choices is made (D-030; hand-off §2); extend only by a
  new decision.
- **Patched by rebuilding.** Security fixes, Chromium's included, reach the install only through a rebuilt image
  (Evaluator Guide §6, item 17; runbook §2).
- **Torn down at the end** *(proposal)*: stop the app; drop the database and its roles; delete both buckets and their
  objects, the Redis data and the library volume; delete the logs by IT's routine; destroy every key and secret and
  revoke the S3 key and database passwords; ask HVL's Feide administrator to delete the registration and TeCopp to
  delete the developer key; remove the DNS names and certificates; write a short note (date, who, what) without
  personal data. The secrets to destroy are listed in runbook §4.

## 5. How it is installed

Follow the operations documents; nothing here replaces them.

1. **Image:** [docker.md](../ops/docker.md): what the image holds, how it is built, the run flags (seccomp profile,
   `SYS_CHROOT`, read-only root, tmpfs) and the paragraph on staging. Do not use `deploy/compose.app.yml` (a local
   stack in development mode) or the root `docker-compose.yml` (fixed passwords) on this host (docker.md:88-89;
   runbook §8, §9).
2. **Database:** [database-roles.md](../ops/database-roles.md): the roles, the two connection URLs and the migrate step.
3. **First deployment:** [runbook](../ops/runbook.md) §2: configuration and secrets; migrate (`views-down`,
   `prisma migrate deploy`, `grants`); seed the ten content types from the bundle; start. The server refuses to start
   on a wrong setting and lists the problems by variable name.
4. **Checks after start:** the first log line `deployment locations` names the expected hosts and region;
   `GET /healthz` answers 200; the `PDF export availability` line gives its reason code (docker.md:46-58); the
   clamd checks in [clamav.md](../ops/clamav.md), «Checking that it works», pass.
5. **Checklist:** tick the lines of runbook §9 that apply to a test install; backups and the full load test may wait
   for stage 2.

## 6. What stage 1 proves, and what it does not

**If it passes, stage 1 shows that:**

- the image runs on HVL's infrastructure with every production start-up check on, or shows which part (such as
  the PDF sandbox) the runtime does not allow (Q5);
- Feide login, roles from the Groups API and logout work with the real Feide (Q3);
- launch, Deep Linking, grades and the roster work with a real Canvas, as the acceptance checklist and the live seam
  record (Q4, Q8, Q13);
- the files host, clamd and a proxy log without query strings work as the runbook describes;
- the runbook can be followed by someone other than its author.

**It does not show:**

- that the code is secure or correct. No person has reviewed it, and a test install shows behaviour, not the
  absence of flaws ([human-review.md](human-review.md), [threat-model.md](threat-model.md));
- that the processing of real personal data is lawful: the DPO has not reviewed the DPIA input (Q6);
- accessibility for real users: the manual assistive-technology run is separate (`UD-031`;
  [conformance report](../accessibility/WCAG-CONFORMANCE-REPORT.md));
- capacity: `npm run load:full` runs on a production-like node of its own (runbook §8);
- operations over time: backups, restores, monitoring, key rotations and the yearly purge (runbook §4–§7);
- readiness for stage 2, which still needs everything in the stage-2 row of [README.md](README.md) and the
  [ROS-analyse](ros-analyse.md).
