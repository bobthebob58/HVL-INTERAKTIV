# tools/ops

## Purpose

The backup, its check and the restore drill for HVL operations (`NFR-002`; D-110's backup amendment of 2026-11-05):
one folder per backup with the database (`pg_dump` custom format), every object of the content bucket under its
SHA-256, a manifest with each table's row count and each object's hash, and `SHA256SUMS` over every file. A restore
checks the folder first, writes only into an empty database and an empty bucket, and then compares every count and
hash. The steps HVL follows, and the restore drill each semester, are in
[docs/ops/runbook.md](../../docs/ops/runbook.md) (section 6).

## How to run

With the server's own variables (`DATABASE_URL`, the `S3_*` settings) and PostgreSQL 16's client tools on `PATH`:

```bash
npm run --silent ops:backup -- --out /srv/hvli-backups [--keep-days 30]   # one JSON line with counts
npm run --silent ops:backup-verify -- --from /srv/hvli-backups/hvli-backup-<time>
npm run --silent ops:restore -- --from /srv/hvli-backups/hvli-backup-<time>  # into an empty database and bucket
npx vitest run tools/ops                                                    # the [NFR-002] tests
```

Exit codes: 0 done and nothing differs, 1 failed or something differs, 2 bad arguments. Messages name a variable, a
file or a rule, never a value; the password reaches PostgreSQL's tools only as `PGPASSWORD` in their own environment.
A database on another host needs `sslmode=verify-full` (or `verify-ca`, or Prisma's `sslmode=require&sslaccept=strict`),
and an S3 endpoint on another host `https`. The round-trip test runs against the local services of
`docker compose up -d` (skipped without them locally, required in CI).

## Folder structure

| File | Responsibility |
|---|---|
| `backupCli.mjs` | The command line: arguments, umask 077, one JSON line, exit codes |
| `backupRun.mjs` | Back up, verify, restore: the order of the steps and the summaries |
| `backupFolder.mjs` | The folder's name, the manifest, `SHA256SUMS`, the 30-day retention and stopped runs' partial folders |
| `postgresConnection.mjs` | `DATABASE_URL` to libpq's environment, and the TLS rule |
| `postgresDump.mjs` | `pg_dump`, the row counts read from the dump, the empty-target check, `pg_restore` |
| `bucketBackup.mjs` | The S3 settings and their checks, objects to and from the folder, reading every object back |
| `toolProcess.mjs` | Runs one PostgreSQL tool with its own environment; a failure as one safe line |
| `test/backupRoundTrip.test.mjs` | Seed, back up, wipe, restore, compare; a changed dump and a non-empty target refused |
| `test/backupRestoreChecks.test.mjs` | The restore's own checks fail when they should: a full bucket refused, a differing table, object and content file reported; a stopped run's partial folder removed |
| `test/backupBench.mjs` | The test's databases (with the real migrations), buckets and CLI runs |
| `test/backupFolder.test.mjs`, `test/postgresConnection.test.mjs` | Names, retention, checksums; the connection and S3 rules |
