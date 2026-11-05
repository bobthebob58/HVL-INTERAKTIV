# Runbook: the yearly purge and the pseudonym secret

| | |
|---|---|
| **Requirements** | `DATA-003` (yearly purge), `DATA-002` (the year's secret is destroyed), `DATA-007` (audit) |
| **Decisions** | D-107 and its amendment of 2026-11-04; D-034 (learner accounts); D-057 (sessions last at most 12 hours) |
| **Code** | `apps/server/src/privacy/purge/` (the job, the CLI and the purge they share) |
| **Who** | HVL operations, where the server runs |

## What happens on its own

Every server checks once an hour, on one node at a time (Redis lease `hvli:privacy:retention-purge`), whether the
purge is due. It is due from midnight in Oslo on the run date, by default **31 August**, until the academic year
ends. On the first check after that moment, the job:

1. logs its plan as its first line, `retention purge plan`, with `dryRun: true` and the counts it will delete;
2. writes the ended year's *k*-suppressed `InsightSnapshot` rows (one per activity, Canvas course or the portal, and
   content version; these are all that remain of the year);
3. deletes the `GradeSyncJob`, `XapiStatement` and `H5PUserData` rows of every academic year before the current one
   (by the year stored on each row), then the learner `Identity` rows created before 1 August, then the learner
   `User` rows left without an identity, in transactions of at most 1 000 rows;
4. writes an audit event `purge.run` (no actor) with the counts, and logs `retention purge check done` with `due: 1`
   and the same counts;
5. logs a warning that names the **year** of every pseudonym secret still configured for a purged year.

It runs once per year: later checks find the completed run in the audit log. If the server was down on the day, the
first check after it starts runs the purge. The server never destroys a secret; that is step 4 below.

The run date is `PURGE_RUN_DATE`, written `MM-DD`, from `08-31` to `12-31`. An earlier day, or a day in January to
July, stops the start-up with a configuration error (D-107: the 30 days after 31 July must pass first, and a spring
date would keep the year's data for most of another year).

## Steps for HVL operations

All commands run from `apps/server` with the server's environment (the same variables as the running server; in a
container, the same image and environment). They print counts, years and dates only.

### 1. Before the day: a dry run

```sh
npm run --silent privacy:purge -- --dry-run
```

It deletes nothing, runs on any day and prints one line, for example
`{"endedYear":2025,"years":[2025],"dryRun":true,"counts":{"snapshots":412,"gradeSyncJobs":3120,"xapiStatements":1843210,"h5pUserData":20511,"learnerIdentities":2804,"learnerUsers":2790}}`.
The dry run is audited too (`purge.run` with `dryRun: true`, `trigger: "cli"`).

### 2. On or after the day: check the run

Look for the job's lines in the application log (`"job":"retention-purge"`), or ask the database:

```sql
SELECT at, "targetId", details->>'outcome' AS outcome, details->'counts' AS counts
FROM "AuditEvent"
WHERE action = 'purge.run' AND (details->>'dryRun')::boolean = false
ORDER BY at DESC LIMIT 5;

-- Each must be 0, with 2026 standing for the current academic year (1 August 2026 to 31 July 2027):
SELECT count(*) FROM "XapiStatement" WHERE "academicYear" < 2026;
SELECT count(*) FROM "H5PUserData" WHERE "academicYear" < 2026;
SELECT count(*) FROM "GradeSyncJob" WHERE "academicYear" < 2026;
```

The newest real run for the ended year must have `outcome = completed`.

### 3. If a run failed

A failed run is audited with `outcome: "failed"` and the counts of what it did before the error, and the job tries
again at its next hourly check. To run it at once, after fixing the cause (for example the database connection):

```sh
npm run --silent privacy:purge -- --execute
```

The CLI refuses `--execute` before the run date (exit code 1) and deletes nothing then. A second run writes no new
snapshots and deletes only what is left; it is safe to repeat. If the job's hourly check starts while the CLI runs,
both finish: the snapshots are written once, and each run deletes what the other has not taken yet. A run that ends
with `the yearly purge made no progress on a table` is audited as failed and retried like any other; if it keeps
failing that way, a lock or trigger in the database is stopping the delete, and the database administrator should
look before the next try.

### 4. After the completed run: destroy the year's pseudonym secret

This is the operations step D-107 leaves to HVL. While the secret exists, the deleted year's backups (kept 30 days,
`DATA-004`) can still be linked to people; once it is gone, nothing that remains can be (`DATA-002`).

1. Confirm step 2: a completed real run for the ended year is in the audit log.
2. In HVL's secret store, delete the ended year's secret, **including every earlier version or history entry** the
   store keeps. Do the same in every other place `PSEUDONYM_SECRETS` is set: each server node or container
   environment, the CI/CD deployment secret, and any host where operations run the server's CLIs.
3. Change `PSEUDONYM_SECRETS` to keep only the current year's secret (and next year's, if it is already added). For
   the purge of academic year 2025 on 31 August 2026:

   ```text
   before:  PSEUDONYM_SECRETS=2025=<secret of 2025>,2026=<secret of 2026>
   after:   PSEUDONYM_SECRETS=2026=<secret of 2026>
   ```

   Never remove the current year's secret: production refuses to start without it. No session can still need the
   old one: a portal session lasts at most 12 hours (D-057), and the run date is at least 30 days after 31 July.
4. Restart or redeploy every server node so it reads the new value.
5. Verify, without printing any secret, from `apps/server` with the server's environment as in step 1:

   ```sh
   node --env-file-if-exists=.env -e "console.log((process.env.PSEUDONYM_SECRETS ?? '').split(',').map((entry) => entry.trim().split('=')[0]).filter(Boolean))"
   ```

   prints only the years still configured (for example `[ '2026' ]`; an empty list `[]` means the variable is not set
   in this shell, so check where the command ran), and the start-up log of every node has **no**
   warning `pseudonym secrets of purged academic years are still configured`. While that warning appears, with
   `"years":[2025]`, the step is not done.
6. Note in HVL's operations log the date, the ended year and the audit event's `id`. No personal data is needed.

## What remains after the purge

- `InsightSnapshot` rows of the year (`aggregates.source` is `yearly-purge`): aggregates only, already suppressed
  below *k* (D-095, D-106), kept with the activity.
- The `purge.run` audit events (kept 2 years, `DATA-007`).
- Learners of the current year, with this year's keys; a learner who comes back after the purge is a new pseudonym.
