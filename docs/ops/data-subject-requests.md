# Runbook: data-subject requests (access and erasure)

| | |
|---|---|
| **Requirements** | `DATA-008` (data-subject requests), `DATA-007` (audit), `DATA-002` (pseudonyms), `DATA-009` (no personal data in logs) |
| **Decisions** | D-108 and its amendment of 2026-11-04; D-011 and D-055 (the keys); D-034 (learner accounts); D-057 (sessions last at most 12 hours); D-064 (authentication events); D-107 (the yearly purge) |
| **Code** | `apps/server/src/privacy/dsr/` (the CLI `dsrCli.ts` and the request it runs) |
| **Who** | HVL operations, on the instruction of HVL's data protection officer (DPO), where the server runs |

## What the tool does

A learner's data in HVL Interaktiv is stored under pseudonyms only (`DATA-002`): a `learnerKey` per academic year,
made from the person's Feide ID or Canvas identity with that year's secret. The tool takes the identifiers HVL can
verify, derives every pseudonym the person can have under the secrets still configured, and then:

- **`export`** (right of access): prints one JSON document with everything stored under those pseudonyms;
- **`erase`** (right to erasure): counts what it would delete (a dry run, the default), and deletes it with
  `--confirm`.

Every run that gets as far as the database, also a refused one, writes an audit event (`DATA-007`); a run stopped by
its arguments, an unreadable data subject or the configuration reads and writes nothing. The tool is a command for
operations only: there is no web page or HTTP route for it (D-108).

**Once the identifiers are read, let the run finish.** Ctrl-C, a container stop (`SIGTERM`) or a closed SSH session
(`SIGHUP`) no longer stop it at once: the tool prints `the request is finishing so that it is audited …`, finishes
(usually within seconds) and writes its audit event (D-108's amendment of 2026-11-05). Ctrl-\ and `kill -9` do stop it
at once, and then an erasure may have deleted rows **without an audit event**: never use them during an erasure. If
it happens anyway, note it in the DPO's case file and run the erasure again, which deletes the rest and is audited.
Before the identifiers are read (while you paste them), Ctrl-C stops the tool as usual.

| Covered | Export | Erase |
|---|---|---|
| xAPI statements (`XapiStatement`) under the person's pseudonyms | yes | yes |
| Saved H5P progress (`H5PUserData`) | yes | yes (through the server's own storage, never Lumi's manager) |
| Canvas grade jobs (`GradeSyncJob`); the encrypted Canvas ID is left out of the export, `ltiSubStored` says whether one is held | yes | yes |
| Learner identities (`Identity`) the identifiers match, and the learner accounts (`User`) left without an identity | yes | yes |
| Portal login and logout events of those learner accounts (`AuthAuditEvent`) | yes | no: kept their 2 years for security (`DATA-007`); HVL's DPO to confirm (Q6) |

**Not covered:**

- **A staff member's own data** (their account and name, the activities they authored, co-authorships, content-bank
  listings, audit events they caused). The tool counts a staff account it finds (`staffAccounts`) and leaves it
  alone. See [A staff member's request](#a-staff-members-request).
- **Canvas's own data**, such as the scores already in the Canvas gradebook: Canvas handles those through HVL's
  Canvas process.
- **Backups** (kept 30 days, `DATA-004`): they keep erased rows until they expire. See
  [After a restore from backup](#after-a-restore-from-backup).
- **Records that expire on their own:** ltijs's launch records (24 hours, D-052), portal sessions (12 hours, D-057).
  Logs hold no personal data (`DATA-009`).
- **Rows of an academic year whose secret is destroyed:** no identifier can find them. The tool names such years as
  `unreachableYears`; the yearly purge should have removed them ([yearly-purge.md](yearly-purge.md)).
- **Aggregates** (`InsightSnapshot`): they hold no learner data.

## Before you start

1. **The request comes through HVL's DPO**, who has verified who the person is. Ask the DPO for:
   - the person's **Feide ID** (for example `name@hvl.no`), if they used HVL Interaktiv through the portal; and
   - their **Canvas identity**, if they used it through Canvas: the platform's **issuer** (the `url` of that
     platform in `LTI_PLATFORMS`, for example `https://canvas.instructure.com`) and the person's **`sub`**, which is
     their Canvas `lti_id` ([canvas-platform-values.md](../reference/canvas-platform-values.md) §6, the `sub` row).
     How a Canvas administrator at HVL reads a user's `lti_id` *(verify with HVL's Canvas team)*.

   A Feide ID finds **no** Canvas rows, and a Canvas identity finds no portal rows: they are different pseudonyms
   (D-108). Give both whenever the person may have used both.
2. **You run it as yourself:** your own Feide ID must be in `ADMIN_FEIDE_IDS`, and you must have logged in to HVL
   Interaktiv with Feide at least once, so that you have a staff account. The audit names that account.
3. **Where:** from `apps/server`, with the server's environment (the same variables as the running server; in a
   container, the same image and environment), like the purge CLI. Without `PSEUDONYM_SECRETS` the tool refuses to
   run.
4. **Keep identifiers out of every record:** the DPO's case file holds them. Never write a Feide ID or `sub` in the
   operations log, a ticket, a chat or a commit. The tool prints none.

## How to give the person's identifiers

The tool reads them from **standard input**, as one JSON object, never from its arguments: arguments stay in the
shell's history and show in the host's process list. Run the command, paste the object when the tool asks, press
Enter, then Ctrl-D:

```json
{"feideId": "name@hvl.no", "lti": [{"issuer": "https://canvas.instructure.com", "sub": "<the person's lti_id>"}]}
```

- `feideId` and `lti` are each optional, but one must be given; `lti` may list up to 20 Canvas identities.
- The Feide ID is normalised as at login (spaces trimmed, lower case); the issuer and `sub` are used exactly.
- Do not use a heredoc (`<<EOF`) or `echo … |`: the shell's history keeps them. Do not store the object in a file on
  the server. Afterwards, clear the terminal's scrollback.
- A mistake is named by its field (for example `lti[1].sub must be 1–255 characters without spaces at either end`),
  never by its value, and exits with code 2 before anything is read.

## 1. Access: export

```sh
(umask 077; npm run --silent --logs-max=0 privacy:dsr -- export --operator <your-feide-id> > <DPO case number>.json)
```

(`umask 077` makes the file readable by you only: with the usual umask, every account on the host could read it.
`--silent` keeps npm's own banner out of the file; `--logs-max=0` stops npm from writing its debug log under
`~/.npm/_logs`, which records the command line and so your Feide ID, even with `--silent`.) Without the redirect
(`>` or a pipe), the tool refuses with exit code 2 before it asks for the identifiers: the export is never printed to a
terminal, where scrollback or session recording would keep it. Standard output is the export document; standard error
is one summary line with the **request ID**, the years searched and the counts, for example
`{"requestId":"8d0b…","action":"export","dryRun":true,"outcome":"completed","years":[2025,2026],"identifiers":{"feide":1,"lti":1},"counts":{"xapiStatements":312,"h5pUserData":14,"gradeSyncJobs":3,"learnerIdentities":2,"learnerUsers":2,"authEvents":5},"staffAccounts":0,"otherIdentities":0,"unreachableYears":[]}`.

The document (`format: "hvl-interaktiv/data-subject-export/1"`) has these sections: `request` (its ID, time and the
academic years searched), `pseudonyms` (each `learnerKey` with its year and whether it comes from the Feide ID or a
Canvas identity), `xapiStatements`, `h5pUserData`, `gradeSyncJobs` (with the Canvas course as
`<platform ID>:<course ID>`, D-103), `identities`, `accounts` and `authEvents`, each with the stored fields.

The file **is personal data**. Hand it to the DPO through HVL's secure channel at once, then delete it from the
server (and from any copy). Give the DPO the request ID for the case file.

## 2. Erasure: dry run, then `--confirm`

1. **Dry run.** It deletes nothing:

   ```sh
   npm run --silent --logs-max=0 privacy:dsr -- erase --operator <your-feide-id>
   ```

   It prints one line, for example
   `{"requestId":"…","action":"erase","dryRun":true,"outcome":"completed","years":[2025,2026],"identifiers":{"feide":1,"lti":1},"counts":{"gradeSyncJobs":3,"xapiStatements":312,"h5pUserData":14,"learnerIdentities":2,"learnerUsers":2},"staffAccounts":0,"otherIdentities":0,"unreachableYears":[]}`.
   Check it against the request with the DPO (see [Reading the summary](#reading-the-summary)).
2. **Erase**, with the same identifiers:

   ```sh
   npm run --silent --logs-max=0 privacy:dsr -- erase --operator <your-feide-id> --confirm
   ```

   It deletes, in this order, the grade jobs, the statements, the saved H5P progress, the matched learner identities
   and the learner accounts left without one, then counts again and prints the counts it deleted and what it found
   afterwards (`remaining`).
3. **Exit code 3** (`remaining` is not zero): rows were written while it ran, because the person was using HVL
   Interaktiv at that moment. Run step 2 again.
4. **12 hours later**, run the dry run (step 1) once more: every count must be 0. A portal session lasts up to 12 hours
   (D-057) and can write until it ends; a Canvas launch stops at once, as its identity is gone. If the person has used
   HVL Interaktiv again since, new rows are new data; ask the DPO.
5. Give the DPO the request IDs of the dry run and the erasure for the case file.

A second erasure of the same person finds nothing and is safe to repeat.

## Reading the summary

| Field | Meaning |
|---|---|
| `requestId` | A random ID, the audit event's target. Only the DPO's case file links it to the person. |
| `years` | The academic years searched: those in `PSEUDONYM_SECRETS`. |
| `identifiers` | How many Feide IDs (0 or 1) and Canvas identities were given. |
| `counts` | Rows exported, deleted, or (dry run) that would be deleted, per table. |
| `staffAccounts` | Accounts of kind `staff` the identifiers match, left alone: a staff member's, but also a student author's (D-089) or that of someone Canvas launched as a teacher (`LTI-004`). If it is not 0, handle that account by hand as in [A staff member's request](#a-staff-members-request), whoever the person is. |
| `otherIdentities` | Identities on the matched learner accounts that the identifiers given do not match, such as another Canvas. Such an account stays. Ask the DPO whether the person used another Canvas, and if so, run again with that identity too. |
| `unreachableYears` | Academic years that have stored learner rows but no configured secret: no identifier can find them. Tell the DPO, and check the yearly purge ([yearly-purge.md](yearly-purge.md), step 2). |
| `remaining` | After an erasure only: rows found under the pseudonyms after it ran. |

## Exit codes and messages

| Code | Message (standard error) | What to do |
|---|---|---|
| 0 | the summary | Done. |
| 1 | `refused (not-an-admin)` or `refused (no-staff-account)` | `--operator` must be your own Feide ID, listed in `ADMIN_FEIDE_IDS`, and you must have logged in once. The refusal is audited with its request ID. |
| 1 | `data-subject request failed: Invalid server configuration:` naming `PSEUDONYM_SECRETS` (or another variable) | Run with the server's environment, the same variables as the running server. Nothing was read or changed. |
| 1 | `data-subject request failed: <error name> <code>` | Fix the cause (for example the database connection) and run again. A failed erasure is audited as `failed` with what it had deleted; the next run deletes the rest. Database messages are not printed, as they can quote query values. |
| 2 | the usage, or `the data subject is not readable: …` | Correct the command or the JSON object. Nothing was read or changed. |
| 2 | `export prints personal data: redirect standard output to a file …` | Run the export with `> <DPO case number>.json`, as in step 1. Nothing was read or changed. |
| 3 | `rows were written under the keys while the erasure ran …` | Run the erasure again (step 2.3). |

## Checking the audit log

Every run writes one audit event: action `dataSubject.export` or `dataSubject.erase`, target type
`DataSubjectRequest`, target ID the request ID, actor your staff account (none for a refusal), and details with
`dryRun`, `outcome` (`completed`, `failed` or `refused`), `years`, `identifiers`, `counts`, `unreachableYears` and,
after an erasure, `remaining`. No identifier, pseudonym or hash is stored.

```sql
SELECT at, action, "actorUserId", details->>'outcome' AS outcome, details->'counts' AS counts
FROM "AuditEvent"
WHERE "targetType" = 'DataSubjectRequest' AND "targetId" = '<request ID>';
```

## A staff member's request

D-108 leaves a staff member's own data outside the tool: their account and display name, the activities they own or
co-author, content-bank listings and copies attributed to them, and the audit events they caused. HVL handles such a
request by hand with the DPO and the system owner until that is decided (open, Q6). What the tool still does for a
staff member is what it does for anyone: their own plays as a learner, under their pseudonyms, are exported and
erased; their staff account is only counted (`staffAccounts`).

The same holds for anyone whose account is of kind `staff` although they are not staff: a student author (D-089) and
a student whom Canvas launched as a teacher or TA (`LTI-004`). An account never goes back to `learner`, so such a
student's account, with any display name it holds (a Feide login stores one), stays until it is handled by hand
with the DPO.

## After a restore from backup

A restore brings the database back to the moment the backup was taken (at most 30 days ago, `DATA-004`): every
erasure completed **after** that moment is undone, and so is its audit event. After any restore, the DPO lists from the
case files the erasures completed since the backup was taken, and operations run each erasure again with the
identifiers from the case file. Do not look for them in the restored audit log: it ends at the backup.
