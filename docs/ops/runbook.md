# Operations runbook

How HVL operations run HVL Interaktiv: what HVL IT provides, starting and stopping, configuration, secrets and their
rotation, the yearly purge and data-subject requests, backups and the restore drill, monitoring, incidents, the load
test, and the deployment checklist (`NFR-002`, `NFR-001`, `NFR-006`, `NFR-007`, `DATA-004`; D-109, D-110 and its
amendments of 2026-11-05, D-114). Commands run from the repository root unless a step says otherwise, with the
server's own environment (the variables in `apps/server/.env.example`). Every command here prints counts, names of
variables and files, years and dates; never personal data, a token or a secret (`DATA-009`).

The other runbooks in this folder hold the details: [yearly-purge.md](yearly-purge.md),
[data-subject-requests.md](data-subject-requests.md), [database-roles.md](database-roles.md),
[docker.md](docker.md) and [clamav.md](clamav.md).

## 1. What HVL IT must provide

Hosting is open: HVL on its own servers or Sikt, both in the EEA (Q5, `DATA-004`). Whichever it is, it needs:

| What | Requirement | Why |
|---|---|---|
| One or more application nodes running the image (Docker, Kubernetes or OpenShift) | The full load test on a node like production decides the size (section 8); the smoke here ran on 4 CPUs with every service on the same machine | `NFR-001`, `NFR-007` |
| A custom seccomp profile for the app container (Playwright's v1.56.1 profile, in `deploy/seccomp/`) | If the runtime cannot take one, the PDF export needs a renderer container of its own, never `--no-sandbox` | D-096, D-110 |
| PostgreSQL 16 in the EEA, with TLS that checks the server (`sslmode=verify-full`) | Three roles from [database-roles.md](database-roles.md); its own backups if managed | `DATA-004`, `DATA-010` |
| Redis 7 in the EEA over TLS (`rediss://`) | Sessions, rate limits, locks, caches and the courses' learner counts; not backed up: losing it logs everyone out, and the counts come back with the next launches | `DATA-004` |
| S3-compatible storage in the EEA over https | Two buckets with plain names: content, and temporary with a 1-day lifecycle rule; no public access | `DATA-004`, D-109 |
| Two DNS names with TLS certificates: the tool (`PUBLIC_BASE_URL`) and its files origin (`files.<host>`, `FILES_BASE_URL`) | Both reach the same app; another registrable domain for files isolates more (D-110) | `SEC-004` |
| A reverse proxy in front | TLS; an access log without the query string; `X-Request-Id`; compression of scripts and styles | section 9 |
| A secret store and a CI/CD secret for every variable marked `Secret: yes` | Never in the image, the compose file or a log | `DATA-009` |
| Backup storage outside the server, encrypted, in the EEA, kept 30 days | Daily copy of the backup folder | `NFR-002` |
| A log store and monitoring of `/healthz` | 99.5 % monthly availability during the semester is about 3.6 hours of downtime | `NFR-002`, `NFR-006` |
| ClamAV (`clamd`), optional but recommended | `AlertExceedsMax yes` and `AlertEncrypted yes`; `StreamMaxLength` at least 50 MB; signature updates are HVL's ([clamav.md](clamav.md)) | `SEC-006` |
| PostgreSQL 16's client tools (`pg_dump`, `pg_restore`, `psql`) on the host that runs backups | The same major version as the server | `NFR-002` |

## 2. Start and stop

**First deployment** (and every upgrade), in this order:

1. Set the configuration and the secrets (section 3 and 4). Production (`NODE_ENV=production`) refuses to start on
   the example keys, a clear-text database, Redis or S3 connection, a non-EEA region or a bucket ARN, and prints
   the list of problems by variable name.
2. Migrate with the migration role, as [database-roles.md](database-roles.md) describes, from `apps/server` (these
   scripts are the server's own, not the root's): `npm run --silent db:roles -- views-down`,
   `npx prisma migrate deploy`, `npm run --silent db:roles -- grants`.
3. Install the content types from the hash-checked bundle (the compose file's `seed` step; [docker.md](docker.md)).
   Before it installs anything, the seed step scans the library files of every package for a build machine's
   secrets, and afterwards it scans the whole library folder; a finding stops it with exit 1 and names the package,
   the library folder, the file and the variables, never a value (D-110's amendment of 2026-11-06). A library folder
   it names is handled as in *A library storage seeded before the build fix* below.
4. Start the app. Its first log line, `deployment locations`, names the database and Redis hosts and the S3 region and
   endpoint host: check them against the checklist (section 9). `GET /healthz` must answer 200.

The image and its compose file are in `deploy/` ([docker.md](docker.md)). Without Docker, on a host with Node 24:
`npm ci`, `npm run h5p:fetch-core`, `npm run build`, then `npm start` (the server runs its TypeScript through `tsx`,
D-110).

**A new content-type version** (spec 00 J5 step 2; D-101's amendment of 2026-11-05, S6 step 8) goes to staging
first and reaches production in the same image. Nobody installs libraries by hand on a running server or from the
Hub (D-041):

1. A developer re-pins the library in `tools/h5p-libraries/libraries.manifest.json`
   (`node tools/h5p-libraries/fetchLibraries.mjs --resolve`, the diff reviewed) in a pull request. CI then runs the
   tests, `npm run content:check` (the patterns' library versions) and the accessibility suite on the player and
   editor of all ten types.
2. From the merged commit, build the bundle and the image ([docker.md](docker.md), *Build the image*), and note the
   image's digest.
3. **Staging:** run steps 2–4 above with that image. The seed step installs only new or patched libraries, writes one
   library audit row for each (`H5P-011`) and logs the counts (`seed libraries finished`). Verify: `GET /healthz`
   answers 200; an author creates an activity of the changed type, saves it in the editor and plays it; an existing
   activity of that type still plays.
4. **Production:** run steps 2–4 above with the same image by its digest, so with the same hash-checked bundle.
   Nothing is fetched or built for production.

**Libraries come only from a bundle built in CI** (D-110's amendments of 2026-11-06). The bundle tool, the seed step
and an administrator's package import all scan library files for a build machine's secrets: a variable that names a
token, password or key, a URL with a password, a value shaped like a known credential, or, in a dumped build
environment, any variable the minimal build environment does not set. The scan is a guard, not a licence: an
administrator imports a package that carries libraries only to install a library that has been reviewed, and an
import the scan refuses (`upload.package.librarySecrets`, 400) has installed nothing.

**A library storage seeded before the build fix** (the library builds' minimal environment, `buildEnv` 3, of
5 November 2026), or from packages of unknown origin, may still hold a library build that carries values from its build
machine's environment, and re-seeding does not replace it, because Lumi keeps an installed library of the same patch
version:

1. Check the storage: `npm run libraries:check` (from the repository root, or
   `node --import tsx src/h5p/libraries/libraryStorageCheckCli.ts` in the app image with the library volume mounted),
   which scans `H5P_LIBRARY_DIR` or the folder given after `--`. A relative folder is read from `apps/server`, as
   for `seed:libraries` (`npm run libraries:check -- var/h5p/libraries`); give an absolute path for any other
   folder. It needs no database and prints only library folders, files and variable names; exit 0 means clean.
2. If it names a library folder, stop the app, delete that folder from the library volume,
   or delete the whole library volume (`docker volume rm <project>_h5p-libraries` for the
   compose stack), and run the seed step again from the bundle built in CI. The seed step checks the folder again
   and fails until it is clean.
3. Library files may be cached publicly for a long time, so purge the reverse proxy's or CDN's cache for that
   library's files too, and rotate any credential whose variable name the check printed.

**Stop** with SIGTERM (`docker stop`, a Kubernetes rollout): the server stops its jobs, stops accepting connections,
closes the PDF browser and its clients, and exits 0 (or 1 if a service failed to close). Allow 30 seconds. The jobs
(the grade worker, the cleanups, the yearly purge) each run on one node per interval through a lease, so nodes can be
stopped and started in any order.

## 3. Configuration

Every variable is in `apps/server/.env.example` with its purpose, whether it is a secret, its default and, where it
matters, its production value; the server checks them at start-up (`apps/server/src/config/env.ts`). The groups:

| Group | Variables |
|---|---|
| Services | `DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_CONTENT_BUCKET`, `S3_TEMPORARY_BUCKET` |
| Addresses | `PUBLIC_BASE_URL`, `FILES_BASE_URL`, `PORT`, `TRUST_PROXY`, `CANVAS_ORIGINS`, `EXTERNAL_MEDIA_ORIGINS`, `CAPTIONED_MEDIA_ORIGINS` |
| Canvas (LTI) | `LTI_PLATFORMS`, `LTI_TOKEN_MAX_AGE_SECONDS`, `AGS_LABEL_MODE`, `NRPS_MAX_PAGES` |
| Feide | `FEIDE_ISSUER`, `FEIDE_CLIENT_ID`, `FEIDE_CLIENT_SECRET`, `FEIDE_GROUPS_API_URL`, `ALLOWED_FEIDE_ORGS`, `ADMIN_FEIDE_IDS`, `AUTHOR_COURSE_GROUPS` |
| Keys | `PSEUDONYM_SECRETS`, `IDENTITY_HASH_KEYS`, `DATA_ENCRYPTION_KEYS`, `URL_SIGNING_KEYS` |
| Privacy | `MIN_GROUP_SIZE` (*k* = 5), `PURGE_RUN_DATE` (31 August) |
| PDF and uploads | `PDF_BROWSER_EXECUTABLE`, `PDF_MAX_CONCURRENCY`, `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT_MS`, `CLAMAV_TLS` |

Never set `PDF_ALLOW_NO_SANDBOX` or `CLAMAV_ALLOW_UNSCANNED_UPLOADS` in production, nor `AWS_ENDPOINT_URL_S3`,
`AWS_ENDPOINT_URL`, `CLAMSCAN_*` or `CLAMDSCAN_*`; do not mount an AWS config file into the container.

## 4. Secrets and their rotation

Make every key with `openssl rand -base64 32`, keep it only in the secret store, and restart every node after a
change. A key ring is `id=base64,…` with the current key first; the three-step rotation never stops the service.

| Secret | Rotation |
|---|---|
| `IDENTITY_HASH_KEYS` | (1) Add the new key second, restart every node; (2) move it first, restart every node; (3) remove the old key at least 13 months later. A ring without a key cannot find the accounts hashed with it |
| `DATA_ENCRYPTION_KEYS` | The same three steps; start-up re-encrypts the LTI tool private keys; remove the old key no earlier than 31 days after step 2. Sessions and access tokens need it only 12 hours (D-056), but a grade job keeps the learner's `sub` encrypted with it until 30 days after the job stopped (D-104), and a job whose key is gone fails as `subject-unreadable` (the learner's next scored play sends again) |
| `URL_SIGNING_KEYS` | The same three steps; remove the old key at least 13 hours 5 minutes after step 2 (the longest file grant) |
| `PSEUDONYM_SECRETS` | One secret per academic year, never changed during its year (every learner key of the year comes from it). Add next year's before 1 August; destroy the ended year's after its purge ([yearly-purge.md](yearly-purge.md), step 4) |
| `FEIDE_CLIENT_SECRET` | Make a new one in Feide's customer portal, set it, restart, then revoke the old one |
| Database passwords | `ALTER ROLE … PASSWORD` for the role, update its URL in the secret store, restart ([database-roles.md](database-roles.md)) |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Make a new key at the provider, set both, restart, revoke the old one |
| Redis password | In `REDIS_URL`; change it at Redis and in the secret store together, then restart |

The LTI tool's key pair per Canvas is made and stored by the server (encrypted with `DATA_ENCRYPTION_KEYS`, D-056).
Replacing the pair itself is not automated; if it may have leaked, treat it as an incident (section 7).

## 5. The yearly purge and data-subject requests

Both CLIs are the server's own scripts: run them from `apps/server`, with the server's environment.

- **Yearly purge** (`DATA-003`, D-107): it runs by itself on `PURGE_RUN_DATE`. Before the day,
  `npm run --silent privacy:purge -- --dry-run`; after it, check the audit event and destroy the year's pseudonym
  secret. All steps: [yearly-purge.md](yearly-purge.md).
- **Data-subject requests** (`DATA-008`, D-108): access with `npm run --silent --logs-max=0 privacy:dsr -- export
  --operator <feide-id>`, erasure with `erase` (a dry run) and then `erase --confirm`, only on the DPO's case.
  All steps: [data-subject-requests.md](data-subject-requests.md).

## 6. Backups and the restore drill (`NFR-002`)

A backup is one folder `hvli-backup-<UTC time>` with the database (`pg_dump` custom format), every object of the
content bucket under its SHA-256, `MANIFEST.json` (each table's row count, each object's key, size and hash) and
`SHA256SUMS` over every file. Not in it: the temporary bucket (editor uploads not yet saved) and the H5P library
folder, which the seed step installs again from the bundle; a library an administrator installed by hand needs that
volume copied too. A backup holds pseudonymised learner rows: its folder is for its owner only (0700, files 0600).
Keep the local backup folder (`--out`) on an encrypted volume as well, and restore from the off-server copy, whose
tool (e.g. restic) authenticates it: `SHA256SUMS` shows that no file changed by accident, but someone who can write
the folder can change a file and its sum together.

**Daily backup** (HVL schedules it, e.g. a systemd timer or a Kubernetes CronJob at 02:17), with the migration
role's `DATABASE_URL` (the app role cannot read `_prisma_migrations`) or a backup role with `pg_read_all_data`, and
the server's `S3_*` variables:

```sh
npm run --silent ops:backup -- --out /srv/hvli-backups          # keeps 30 days (--keep-days)
npm run --silent ops:backup-verify -- --from /srv/hvli-backups/hvli-backup-20261105T021700Z
```

It prints one JSON line, e.g. `{"backup":"hvli-backup-20261105T021700Z","tables":23,"rows":…,"objects":…,
"objectBytes":…,"removedExpired":1}`, and exits 1 with `{"error":…}` on standard error when a step fails; a failed
run leaves no folder behind. A run that is killed (a scheduler's time limit, a reboot) leaves a hidden
`.hvli-backup-<time>.partial` folder; the next backup removes it once it is a day old, so it never outlives the
retention. Then copy the complete folder, encrypted, to the off-server backup storage (HVL's tool, e.g. restic, in
the EEA) and keep 30 days there too.

**Restore drill, once per semester** (and the same steps for a real restore):

1. Create a new, empty database and set it up with the roles script ([database-roles.md](database-roles.md):
   from `apps/server`, `npm run --silent db:roles -- roles` as the administrator), and a new, empty content bucket.
2. Check the backup: `npm run --silent ops:backup-verify -- --from <backup folder>` must print `"problems":[]`.
3. Restore with `DATABASE_URL` set to the new database as `hvli_migrator` and `S3_CONTENT_BUCKET` to the new bucket:
   `npm run --silent ops:restore -- --from <backup folder>`. It refuses a database or a bucket that is not empty, and
   a backup whose files changed. It prints `{"restored":…,"tables":…,"rows":…,"objects":…,"tablesDiffering":0,
   "objectsDiffering":0,"contentFilesMissing":0,"ok":true}` and exits 0 only when every count and hash matches.
   `contentFilesMissing` above 0 with nothing else differing means a content file was deleted between the dump and
   the bucket copy (the backup takes the database first): that file is not in this backup; note it in the log.
4. From `apps/server`, `npm run --silent db:roles -- grants` as `hvli_migrator` (the restore made it the owner of
   every table and view, as after a migration), then the seed step, then start one node against the restored
   database and bucket: `/healthz` answers 200, and a teacher opens an activity and its Innsikt tab.
5. After a **real** restore, the DPO's erasures since the backup are re-run
   ([data-subject-requests.md](data-subject-requests.md), "After a restore from backup"), and, from `apps/server`,
   `npm run --silent privacy:purge -- --dry-run` shows whether rows of an ended academic year came back; if so, run
   the purge again ([yearly-purge.md](yearly-purge.md), step 3).
6. For a drill, drop the drill database and bucket afterwards.
7. Write the drill log: date, who, the backup's name, the restore's JSON line, how long each step took, and what
   went wrong. No personal data is needed. The tested round trip (seed, back up, wipe, restore, compare) is
   `tools/ops/test/backupRoundTrip.test.mjs` (`[NFR-002]`); `tools/ops/test/backupRestoreChecks.test.mjs` shows that
   the restore reports a difference and refuses a bucket that is not empty.

## 7. Monitoring and incidents

**Health:** `GET /healthz` answers 200 `{"status":"ok"}`, or 503 `{"status":"unavailable","failing":["database"]}`
(or `redis`) when one does not answer in 2 seconds; it is never cached and needs no login. Poll it every 10–30 s and
take a node out of rotation on 503.

**Request log** (`NFR-006`): one JSON line per request, `msg: "request"`, with `requestId`, `method`, `route` (the
pattern, e.g. `/api/content/:contentId`, never the path or the query), `status`, `durationMs`, and `aborted: true`
when the client left. The `X-Request-Id` of the proxy (a UUID or 32 hexadecimal digits) is kept, so the two logs can
be matched. Watch the API's p95 (`NFR-001`: ≤ 300 ms) and the rate of 5xx answers. Alert also on every `error` line,
on `retention purge` lines that are not `done`, and on the start-up warning `pseudonym secrets of purged academic
years are still configured`.

**Incident steps:**

1. Find the scope: `/healthz` and its `failing` list, the request log by `route` and `status`, one case by
   `requestId`. Log lines hold no personal data, so they can be shared within the incident team.
2. A secret may have leaked: rotate it at once (section 4); for `URL_SIGNING_KEYS` and `IDENTITY_HASH_KEYS` the
   old key can leave the ring early, at the price of refused file URLs or second accounts.
3. Personal data may have leaked or been lost: tell HVL's data protection officer the same day. The DPO decides on
   the 72-hour notice to Datatilsynet; operations give the facts (what, when, which tables), not names.
4. The database or the content bucket is lost or damaged: stop the nodes, restore (section 6, steps 1–5), start.
5. Malware found or ClamAV down: [clamav.md](clamav.md) (uploads are refused while clamd does not answer).
6. Grades stop reaching Canvas: the teacher's grade-sync view shows failed and orphaned jobs; check `CANVAS_ORIGINS`
   and the Canvas developer key; the worker retries for 24 hours.
7. Afterwards: write a short incident note (cause, time line, fix) without personal data, and add a test that fails
   without the fix.

## 8. The load test (`NFR-001`)

`NFR-001`: the activity page interactive in ≤ 3 s at p95 with 200 concurrent learners on one node; API p95 ≤ 300 ms.
The harness in `tools/load/` (D-114) starts the server as one node with a mock Canvas, the ten real content types and
QuestionSet's example, in a database of its own, and runs k6 2.3.0 (pinned by digest) against it: each learner
launches from Canvas, loads the player page with every script and stylesheet, sends the xAPI batches and state saves
of an answered activity, and starts again. It needs Docker, the services of `docker compose up -d` and the real
content types (`npm run h5p:fetch-libraries`).

**Warning:** the root `docker-compose.yml` is for development and tests. Its PostgreSQL has a fixed password and its
Redis none; it publishes them and the S3 emulator on 127.0.0.1 only (D-110's amendment of 2026-11-05, step 7), but
every user and process on the node can still reach them. Never run it on a node that holds real data or serves
users, never change its ports to another interface, and run the full load test on a production-like node of its
own; afterwards remove the services and their data with `docker compose down -v`.

```sh
npm run load:smoke                      # 20 learners for 30 s (about the request rate of 60 learners)
npm run load:full -- --out /srv/load    # 200 learners: 60 s up, 10 min, 30 s down (HVL, on a production-like node)
```

Exit code 0 means every threshold passed, 99 that one failed. The folder holds `summary.txt`, `summary.json` and
`rows.json` (the rows the load stored, counts only). The smoke's whole output (from `HVL Interaktiv load test`) on
2026-11-05 in the development sandbox (4 CPUs, every service on the same machine), the final code of step 6; earlier
runs of the same code gave a `hvli_player_ready` p95 of 1 136 to 1 351 ms and an API p95 of 22 to 38 ms, and a run
with the API limit set to 5 ms ended `FAIL` and exit code 99:

```text
HVL Interaktiv load test (NFR-001), profile smoke: 20 learners, 41 s
Thresholds (all passed):
  PASS  hvli_player_ready p(95)<3000: 1506 ms
  PASS  http_req_duration{kind:api} p(95)<300: 22 ms
  PASS  http_req_failed rate<0.01: 0.00 %
  PASS  checks rate>0.99: 100.00 %
Also measured:
  hvli_launch (login to redirect, less the mock Canvas): p95 425 ms
  hvli_player_ready: median 82 ms, max 1589 ms
  http_req_duration{name:lti-play}: p95 234 ms, median 13 ms
  http_req_duration{name:xapi}: p95 43 ms, median 10 ms
  http_req_duration{name:state}: p95 15 ms, median 7 ms
  http_req_duration{kind:asset}: p95 44 ms, median 3 ms
  http_req_duration{kind:launch}: p95 217 ms, median 9 ms
  http_req_duration{kind:mock}: p95 67 ms, median 1 ms
Visits: 60 (1.45/s), requests: 6180, checks passed: 100.00 %
Bytes per visit (page, scripts, styles): 1496 KiB
load smoke: rows the load stored {"xapiStatement":360,"h5PUserData":20,"ltiPlacement":1,"identity":20,"user":21}
load smoke: k6 exited with 0; summary in <output folder>/summary.txt
```

Not measured by k6: the browser's own work (parsing, running H5P) and Fast 4G's latency and bandwidth. The page and
its scripts are about 1.5 MiB per empty-cache visit, sent uncompressed by the app, so the proxy must compress them
(section 9). The full run's output goes into PROGRESS.md like the smoke's.

## 9. Deployment checklist

Tick every line before the first learner, and again after a change of hosting:

- [ ] `NODE_ENV=production`, and the server starts without a refusal.
- [ ] Every key and secret is new and random (section 4), stored only in the secret store, and `PSEUDONYM_SECRETS`
      holds the current academic year (and next year's before 1 August).
- [ ] `DATABASE_URL` is the `hvli_app` role with `sslmode=verify-full`; the migration URL is used only by the migrate
      step ([database-roles.md](database-roles.md)).
- [ ] `REDIS_URL` is `rediss://`; `S3_ENDPOINT` is `https` (or empty for AWS); `PUBLIC_BASE_URL` and
      `FILES_BASE_URL` are `https`.
- [ ] The database, Redis and the storage are in the EEA; the start-up line `deployment locations` names the
      expected hosts and region (`DATA-004`).
- [ ] `S3_CONTENT_BUCKET` and `S3_TEMPORARY_BUCKET` are plain bucket names (never an access point or Outposts ARN),
      without public access; the temporary bucket has a 1-day lifecycle rule.
- [ ] No AWS config file is mounted, and `AWS_ENDPOINT_URL_S3` and `AWS_ENDPOINT_URL` are unset.
- [ ] The reverse proxy: TLS for both names; its access log leaves out the query string (a few routes accept
      `?ltik=`, which the server keeps out of its own log but cannot remove from the proxy's, `NFR-006`); it passes
      its request ID as `X-Request-Id` (a UUID or 32 hexadecimal digits); `TRUST_PROXY` is the number of proxies in
      front (usually 1); it compresses scripts and stylesheets (gzip or brotli).
- [ ] `CANVAS_ORIGINS` names HVL's Canvas hosts; `LTI_PLATFORMS` matches the Canvas developer key.
- [ ] `ALLOWED_FEIDE_ORGS` and `ADMIN_FEIDE_IDS` are set; an LTI launch never makes an administrator.
- [ ] The files origin (`SEC-004`): a DNS name and a TLS certificate for `files.<host>` (or `FILES_BASE_URL`, a
      separate registrable domain if HVL prefers, Q5); the proxy sends both host names to the same server and passes
      `Host` on, and behind `TRUST_PROXY` it sets `X-Forwarded-Host` itself rather than forwarding the client's;
      people open the app at exactly `PUBLIC_BASE_URL`, the one origin the files origin allows (CORS).
- [ ] ClamAV: `CLAMAV_HOST` is set, `CLAMAV_TLS=true` unless clamd is on the loopback (its TLS proxy presents the
      certificate for `CLAMAV_HOST` without SNI), no `CLAMSCAN_*` or `CLAMDSCAN_*` variable is set; clamd has
      `AlertExceedsMax yes` and `AlertEncrypted yes` (required: without them clamd answers "clean" for files it did
      not scan in full; `clamconf -n` shows both), `StreamMaxLength` at least 50 MB and `MaxScanTime` no higher than
      `CLAMAV_TIMEOUT_MS`, `MaxRecursion` at its default; the clamd settings check (`npm run clamd:check`, or
      `clamdCheckCli.ts` in the image, [clamav.md](clamav.md)) ends with `"proven":true`, and the server log has no
      `error` line with reason `clamd-settings`; a password-protected PDF upload is refused; signatures update daily; and the content
      bucket is scanned once if files were stored before scanning was on ([clamav.md](clamav.md)).
- [ ] The content types come from a bundle built in CI, and `npm run libraries:check` passes on the library
      volume (a storage seeded before the build fix needs the library folder the check names deleted first,
      section 2).
- [ ] The app container runs as uid 10001 with Playwright's seccomp profile ([docker.md](docker.md)); never
      `PDF_ALLOW_NO_SANDBOX`.
- [ ] The daily backup runs, its copy reaches the off-server storage, and a restore drill has passed (section 6).
- [ ] `/healthz` is monitored, the logs reach the log store, and the alerts of section 7 are set.
- [ ] The full load test has passed on a node like production (section 8), and its services were removed afterwards.
- [ ] The root `docker-compose.yml` runs on no production node (section 8).
