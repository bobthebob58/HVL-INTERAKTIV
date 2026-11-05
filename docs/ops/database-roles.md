# Runbook: database roles, encrypted connections and where the data lives

| | |
|---|---|
| **Requirements** | `DATA-010` (separate roles; production data never in development), `DATA-004` (EEA, TLS), `DATA-007` (audit) |
| **Decisions** | D-109 and its amendments of 2026-11-04 and 2026-11-05 |
| **Code** | `apps/server/prisma/roles/` (the three SQL scripts), `apps/server/src/infra/databaseRolesCli.ts` (the runner), `apps/server/src/config/connectionEncryption.ts` and `storageResidency.ts` (the start-up checks) |
| **Tests** | `apps/server/test/db/databaseRoles.int.test.ts` logs in as each role and proves what it may and may not do; `databaseRolesDeploy.int.test.ts` runs a migration that changes a column a view reads; `databaseRolesTls.test.ts` proves the runner's TLS rule; `test/config/storageResidency.test.ts` the plain bucket names |
| **Who** | HVL's database administrator (once per database), the deployment's migrate step (every deployment) |

Development and CI keep one database user (`hvli`); everything below is for staging and production.

## The three roles

| Role | Used by | May | May not |
|---|---|---|---|
| `hvli_migrator` | `00-views-down.sql`, `prisma migrate deploy` and `02-grants.sql`, in the deployment's migrate step and in CI/CD only | Own schema `public` and every table in it; create, change and drop tables; create schema `analytics` and its views | Be a superuser, create databases or roles |
| `hvli_app` | The server (`DATABASE_URL`) | Read, add, change and delete rows in every table of `public`, also in tables later migrations add; add and read audit rows | Create, change, drop or empty (`TRUNCATE`) a table; create a schema or a temporary table; read Prisma's `_prisma_migrations`; change or delete an audit row (`AuditEvent`, `AuthAuditEvent`, `LibraryAuditEvent`) |
| `hvli_analytics` | Analysts and researchers' tools (read-only) | Read the views in schema `analytics`: today `analytics.insight_snapshot`, the *k*-suppressed snapshots with each activity's content type | Read any table, so no learner row, `learnerKey`, encrypted value or token; write anything (its sessions also start read-only) |

No role holds a password from the scripts. Use psql's `\password <role>`, which sends the password hashed, or
certificate authentication.

## Set up a new database (once)

1. Create the database, then connect to it as a superuser (or as the database owner with `CREATEROLE`, who must
   first `GRANT hvli_migrator TO <you>`).
2. Run the first script. Either with psql:

   ```sh
   psql --single-transaction -v ON_ERROR_STOP=1 -f apps/server/prisma/roles/01-roles.sql "<admin connection>"
   ```

   or, from `apps/server`, with the runner, which prints no URL and runs the script in one transaction:

   ```sh
   DATABASE_URL='<admin URL>' npm run --silent db:roles -- roles
   ```

   It prints `{"applied":"01-roles.sql","as":"<your user>"}`. Running it again changes nothing.
3. Set the three passwords: `\password hvli_migrator`, `\password hvli_app`, `\password hvli_analytics`.
4. Store two connection URLs in the secret store. Both check the database server's certificate and host name, but
   they say so differently, because the migrate step uses Prisma's own CLI:
   - the **app URL** (`hvli_app`) as the server's `DATABASE_URL`, ending in `?sslmode=verify-full`;
   - the **migration URL** (`hvli_migrator`) for the migrate step only, ending in `?sslmode=require&sslaccept=strict`
     (add `&sslrootcert=<path to the CA certificate>` when the CA is not in the system's store). It never reaches the
     server's environment. Do not use `verify-full` here: Prisma's CLI ignores it and checks no certificate. With
     `sslaccept=strict` it does, and the grants runner (node-postgres) reads `require` as `verify-full`.

## Every deployment: the migrate step

With the migration URL as that step's own `DATABASE_URL`, from `apps/server`:

```sh
DATABASE_URL="$MIGRATION_DATABASE_URL" npm run --silent db:roles -- views-down
DATABASE_URL="$MIGRATION_DATABASE_URL" npx prisma migrate deploy
DATABASE_URL="$MIGRATION_DATABASE_URL" npm run --silent db:roles -- grants
```

Stop at the first command that fails. The first drops the views in schema `analytics` and nothing else (no table, no
grant): PostgreSQL refuses a migration that drops or changes the type of a column a view reads, and only a deployment
has the views, so without this step such a migration would fail here first. The views hold no data; analysts miss them
while the step runs. The last command prints `{"applied":"02-grants.sql","as":"hvli_migrator"}`. Both runner steps
refuse any other user (for the grants, because PostgreSQL ties default privileges to the user that sets them). The grants step grants
the app its rows (new tables are covered by default privileges anyway), keeps the audit tables append-only and builds
the analytics views again. If the migration fails, run the grants step anyway once the migration is fixed or rolled
back, so the views come back.

The runner applies the server's production TLS rule to its own `DATABASE_URL` in every environment: unless the
database is on the same machine (a socket, `localhost`, `127.x.y.z` or `::1`), it refuses a URL without `sslmode`
`require`, `verify-ca` or `verify-full`, read as node-postgres reads it (the last `sslmode`, the last `host` parameter,
`PGHOST` when the URL names no host). It then prints `database roles refused: DATABASE_URL: …` without the URL and
exits 1 before it connects (`DATA-004`).

## A database that already runs with one user

If the tables belong to an earlier single user (for example `hvli`), give them to the migrator once, as a superuser,
after step 2 above:

```sql
REASSIGN OWNED BY hvli TO hvli_migrator;
```

Then run the grants step and point the server at the app URL. Remove the old user when nothing uses it.

## Check it

As the administrator, connected to the database:

```sql
-- Every table and view belongs to the migrator.
SELECT DISTINCT relowner::regrole FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE nspname IN ('public', 'analytics') AND relkind IN ('r', 'v');
-- The app may not change the audit trail (expect false, false).
SELECT has_table_privilege('hvli_app', '"AuditEvent"', 'UPDATE'), has_table_privilege('hvli_app', '"AuditEvent"', 'DELETE');
-- Analytics reaches no table (expect false).
SELECT has_schema_privilege('hvli_analytics', 'public', 'USAGE');
```

## What the server refuses to start with (production)

With `NODE_ENV=production` the server stops at start-up, naming the variable, when:

- `DATABASE_URL` has no `sslmode` of `require`, `verify-ca` or `verify-full`. Use `verify-full`: `require` encrypts
  without checking the server's certificate. (node-postgres 8.23 checks the certificate for all three and prints a
  warning for the first two, unless the URL adds `uselibpqcompat=true`.) `ssl=true` alone is not accepted.
- `REDIS_URL` is `redis://` rather than `rediss://`.
- `S3_ENDPOINT` is set and is not `https:`.
- `AWS_ENDPOINT_URL_S3` or `AWS_ENDPOINT_URL` is set: the AWS SDK would send the files there instead, past these
  checks. Use `S3_ENDPOINT`. For the same reason, mount no AWS config file (`~/.aws/config`, `AWS_CONFIG_FILE`) with an
  `endpoint_url` into the server's container; the server cannot see that file.
- `S3_CONTENT_BUCKET` or `S3_TEMPORARY_BUCKET` is not a plain bucket name (3 to 63 lower-case letters, digits, dots
  and hyphens, beginning and ending with a letter or digit). An S3 access point or Outposts ARN is refused: the AWS
  SDK sends its files to the ARN's own region, past the EEA check below. An access point alias (`…-s3alias`) is a
  plain name and stays in `S3_REGION`. The message names the variable only (an ARN holds an account ID).
- The storage is outside the EEA allow-list in `apps/server/src/config/storageResidency.ts`: without `S3_ENDPOINT`
  (AWS itself), `S3_REGION` must be `eu-north-1`, `eu-west-1`, `eu-west-3`, `eu-central-1`, `eu-south-1` or
  `eu-south-2` *(verify)*; with `S3_ENDPOINT`, its host must be AWS's endpoint of one of those regions or lie under
  `hvl.no` or `sikt.no` *(verify, Q5)*. Another host needs a reviewed change to that file and an amendment to D-109.

These checks catch a wrong setting; they do not prove where a server stands. The deployment checklist still needs
the provider's facts for the database, Redis and storage (Norway or the EEA, encryption at rest, encrypted backups
kept 30 days; `DATA-004`, Q5). The server can name its database and Redis hosts, S3 region and S3 endpoint host for
that check (`deploymentLocations` in `storageResidency.ts`; never a user or password).

## Production data never goes to development

Development and CI use synthetic data only (`DATA-010`): the seed scripts, fixtures and the mock Canvas and Feide. Do
not restore a production backup outside production, not even for debugging; use a synthetic reproduction instead.
