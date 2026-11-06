# Runbook: malware scanning with ClamAV

| | |
|---|---|
| **Requirements** | `SEC-006` (malware scanning), `DATA-004` (encrypted traffic), `DATA-009` (no personal data in logs), `SEC-005` (50 MB uploads) |
| **Decisions** | D-110 and its amendments of 2026-11-05 (ClamAV, `SEC-006`; step 7: clamd's alerts) and of 2026-11-06 (the settings probe); D-004 (only admins install libraries); D-112 (`clamscan` and TLS) |
| **Code** | `apps/server/src/security/malware/` (the scanner, its settings probe and `clamdCheckCli.ts`), `apps/server/src/config/malwareScanConfig.ts` (the start-up rules) |
| **Who** | HVL operations, where the server and clamd run |

## What the server does

When `CLAMAV_HOST` is set, every file an author uploads is sent to clamd, the ClamAV daemon, before it is stored:
files uploaded in the H5P editor and the content files of an imported `.h5p` package. The server uses Lumi's
`@lumieducation/h5p-clamav-scanner` 10.0.4 with its own wrapper, which **fails closed**: a file is stored only when
clamd answers "clean", and only while the server has proven that clamd reports the files it cannot scan in full
([the settings probe](#the-settings-probe)). The author sees one of two messages in Nynorsk, Bokmål or English:

| What happened | The author sees (nn) | Log line (`warn`) |
|---|---|---|
| clamd found malware | «Viruskontrollen fann skadeleg innhald i fila, så ho vart ikkje lagra.» | `reason: "malware-found"`, `signatures: [...]` |
| clamd cannot be reached, gives no answer in time, answers with an error or answers something that is not a verdict | «Fila kunne ikkje kontrollerast for virus akkurat no, så ho vart ikkje lagra. Prøv igjen om litt.» | `reason`: `unreachable`, `timeout`, `tls`, `connection-lost`, `size-limit`, `no-verdict` or `scanner-error` |
| clamd is not set up to report files it cannot scan in full (`AlertEncrypted`, `AlertExceedsMax`) | the same second message | `reason: "clamd-settings"`, and one `error` line for the operator ([below](#the-settings-probe)) |

The log line names the reason (and, for a finding, the signature names from clamd's database), never a file name, a
path or text from clamd. At start the server logs `uploads are scanned for malware` (`malwareScan: "clamav"`) or
`uploads are not scanned for malware` (`malwareScan: "off"`).

When clamd is set up as [clamd's own settings](#clamds-own-settings) requires, a file clamd cannot check in full is
a finding too: a PDF that needs a password to open, an office file with a part that needs one, an office file too
large or too deeply nested, and a PDF or office file with more parts than clamd's `MaxFiles` (10 000). A very long
PDF can be one: a plain 4 MB PDF of 12 000 pages, each with its own content stream, was refused, and one of 5 000
pages passed (measured with ClamAV 1.4.6). The author then sees the first message, and the log names clamd's
heuristic (`Heuristics.Encrypted.PDF`, `Heuristics.Limits.Exceeded.MaxFiles` and the like), so support can tell it
from a virus. Such a file can be uploaded without its password, or split up.

Not scanned: the library files inside a package (only admins may install libraries, D-004, and the seed bundle is
checked by hash), and files copied from one activity to another (they were scanned when they were uploaded, if
scanning was on then). Files stored while no scanner was configured (before ClamAV, or with
`CLAMAV_ALLOW_UNSCANNED_UPLOADS=true`) are never scanned later by the server: when scanning is turned on after such a
period, scan a copy of the content bucket's objects once with clamd and deal with what it finds.

## Settings

All in `apps/server/.env.example`; the server refuses to start on a wrong value and names the variable.

| Variable | Default | Meaning |
|---|---|---|
| `CLAMAV_HOST` | empty (no scanner) | clamd's host name or IP address. **Required in production**, unless `CLAMAV_ALLOW_UNSCANNED_UPLOADS=true`. |
| `CLAMAV_PORT` | `3310` | clamd's TCP port (`TCPSocket` in `clamd.conf`), or the TLS proxy's port. |
| `CLAMAV_TIMEOUT_MS` | `30000` | The limit on one whole scan, including the wait for one of the four scans a server process sends at once. |
| `CLAMAV_TLS` | `false` | `true` connects over TLS. **Required in production** unless clamd runs on the loopback (`localhost`, `127.0.0.0/8`, `::1`). |
| `CLAMAV_ALLOW_UNSCANNED_UPLOADS` | `false` | Production only: start without a scanner. Refused together with `CLAMAV_HOST`. |

- The commands that read the whole configuration (`seed:libraries`, `privacy:purge`, `privacy:dsr`) apply the same
  start-up rules, so run them with the server's environment; they build no scanner connection of their own.
- **Never set `CLAMSCAN_*` or `CLAMDSCAN_*`.** Lumi's scanner would read them over the server's settings; the server
  does not use that path, and refuses to start while one is set, naming it.
- **Keep `DEBUG` without `h5p:*` in production.** Lumi's own debug logger is silent unless `DEBUG=h5p:*` is set, and
  then it writes the paths of scanned files, which for a package import hold the package's own file names
  (`DATA-009`). The library `clamscan` writes socket errors (Node's error text, never a file name) to stderr on its own.
- **`CLAMAV_ALLOW_UNSCANNED_UPLOADS` never lets a file through when clamd fails.** It only allows a production start
  with no clamd at all, for example a pilot before HVL runs ClamAV; the start then logs a warning. Decide it with
  HVL's security officer and write the decision down.
- **TLS:** clamd has no TLS of its own. Either run clamd beside the server on the loopback (a sidecar container in
  the same pod or network namespace, `CLAMAV_HOST=127.0.0.1`), or put a TLS proxy (for example stunnel or HAProxy) in
  front of clamd and set `CLAMAV_TLS=true`, with `CLAMAV_HOST` the name on the proxy's certificate. Node must trust
  the certificate: a public CA, or HVL's own CA through `NODE_EXTRA_CA_CERTS`. Uploaded files can hold personal data,
  so they never cross a network in clear text (`DATA-004`).
- **The TLS proxy must not depend on SNI.** `clamscan` 2.4.0 opens its TLS connection without a server name (SNI;
  measured, D-112), so the proxy must present the certificate for `CLAMAV_HOST` to a client that names no server:
  give clamd's proxy a listener or an address of its own, or make that certificate the listener's default. A proxy
  that chooses its certificate by SNI answers with its default one, which the server refuses as a name mismatch;
  every upload is then refused with `reason: "tls"` (it fails closed, never open).

## clamd's own settings

clamd decides what it can scan, and by default it answers "clean" for a file it did not scan in full. No clamd
command reports its settings, so check `clamd.conf` against this list; `clamconf -n` prints every setting that
differs from the default (`AlertExceedsMax = "yes"`). Items 1 and 2 are **required** (D-110's amendment of
2026-11-05, step 7), and the server proves them itself before it scans: without them it refuses every upload
([the settings probe](#the-settings-probe)). Items 3 to 8 stay HVL's to check. In the official image, set items 1
and 2 as `CLAMD_CONF_AlertExceedsMax=yes` and `CLAMD_CONF_AlertEncrypted=yes`: its entrypoint writes every
`CLAMD_CONF_<option>` variable into `clamd.conf`.

1. `AlertExceedsMax yes`. Without it, a file over one of clamd's limits is answered "clean" after a partial scan.
   With it, the file is reported as `Heuristics.Limits.Exceeded.<limit>` and refused as malware. Measured with
   ClamAV 1.4.6 for `MaxScanSize`, `MaxFiles`, `MaxRecursion` and `MaxScanTime`, more limits than the comment in
   `clamd.conf` names. Keep `MaxRecursion` at its default (17): the probe proves this setting with ZIPs nested 64
   deep, which a `MaxRecursion` above 65 lets clamd unpack in full, and the server then refuses every upload.
2. `AlertEncrypted yes` (or both `AlertEncryptedArchive yes` and `AlertEncryptedDoc yes`). Without it, a ZIP or a PDF
   that needs a password to open is answered "clean", because clamd cannot look inside. With it, the file is
   reported as `Heuristics.Encrypted.Zip` or `Heuristics.Encrypted.PDF` and refused. A PDF with only an owner
   password (it opens without one; printing or copying is restricted) is scanned as usual (measured).
3. `StreamMaxLength` at least `50M` (uploads go up to 50 MB, `SEC-005`). ClamAV 1.4.6 defaults to 100 MiB. A file
   over the limit is refused (`reason: "size-limit"`), never stored unscanned.
4. `MaxFileSize` and `MaxScanSize` at least `50M` (1.4.6: 100 MiB and 400 MiB), so an ordinary upload is scanned in
   full rather than refused under item 1.
5. `MaxScanTime` no higher than `CLAMAV_TIMEOUT_MS` (clamd's default is 120 s, the server's 30 s). The server
   refuses an upload whose scan takes longer anyway; with this, clamd stops too instead of keeping a thread busy. A
   file with many small parts takes clamd long: an office file of 1 MB with 10 050 entries took 75 s.
6. `TCPSocket 3310`, and `TCPAddr` limited to the network the server uses (or the loopback for a sidecar).
7. `MaxThreads` and `MaxQueue` large enough for the servers you run: each server process sends at most four scans
   at once.
8. `ReadTimeout` (default 120 s) above `CLAMAV_TIMEOUT_MS`.

These settings do not make clamd see everything, so the server's own checks of each file's type (`SEC-002`) stay in
place before the scan.

## The settings probe

Before it scans an upload, the server sends clamd three small streams that only a clamd with items 1 and 2 reports,
through the same connection settings (host, port, TLS, time limit) as the uploads (D-110's amendment of
2026-11-06):

| Stream | Proves | A clamd with the setting answers |
|---|---|---|
| a ZIP whose one entry needs a password | `AlertEncryptedArchive` (part of `AlertEncrypted`) | `Heuristics.Encrypted.Zip FOUND` |
| a one-page PDF that needs a password to open | `AlertEncryptedDoc` (part of `AlertEncrypted`) | `Heuristics.Encrypted.PDF FOUND` |
| ZIPs nested 64 deep | `AlertExceedsMax` | `Heuristics.Limits.Exceeded.MaxRecursion FOUND` |

A clamd without the setting answers "OK" to its stream (measured with ClamAV 1.4.6). Each stream holds 16 random
bytes drawn for each probe, so clamd has never seen it before: clamd skips a file whose hash it once scanned clean,
and with fixed streams an author could make a correct clamd answer "OK" by uploading their inner parts first. The
streams hold no personal data, and their findings are never reported as malware.

- **When.** Before the first upload a server process scans (not at start: the commands that build the same runtime,
  such as `seed:libraries`, then contact nobody), then again before an upload when the last result is a minute old,
  and at once after a file's scan ended without a verdict, since clamd may have restarted with other settings.
  Uploads that arrive together wait for one probe, within their own time limit (`CLAMAV_TIMEOUT_MS`).
- **Proven.** Every stream got its heuristic. The log shows once, at the first proof and after a change,
  `{"clamdSettings":"proven"}` with `clamd reports files it cannot scan in full (AlertEncrypted, AlertExceedsMax)`.
- **Not proven.** Any stream answered "OK" or another name. Every upload is then refused (the second message above,
  `reason: "clamd-settings"`), and the log shows one `error` line when this starts or the missing settings change:

  ```json
  {"level":"error","reason":"clamd-settings","unproven":[{"setting":"AlertExceedsMax","answer":"OK"}],"msg":"uploads are refused: clamd answers OK for files it cannot scan in full; set AlertEncrypted yes and AlertExceedsMax yes in clamd.conf and keep MaxRecursion at its default (docs/ops/clamav.md)"}
  ```

  `answer` is `OK`, the name clamd reported (when it is shaped like a signature name) or `other`. Fix `clamd.conf`
  and restart clamd; the server notices within a minute of the next upload, without a restart of its own.
- **No answer.** When clamd cannot be reached or gives no verdict to a stream, the upload is refused with that reason
  (`unreachable`, `timeout`, ...) as before, and the next upload probes again.
- **In clamd's own log.** clamd logs the probe's streams as it logs any finding, so a correctly set-up clamd writes
  three lines within a second or two from the server's address (measured with ClamAV 1.4.6):
  `instream(<address>@<port>): Heuristics.Encrypted.Zip FOUND`, `... Heuristics.Encrypted.PDF FOUND` and
  `... Heuristics.Limits.Exceeded.MaxRecursion FOUND`; a `VirusEvent` command, if HVL has set one, runs for each
  (measured: one run per stream, with these three names in `CLAM_VIRUSEVENT_VIRUSNAME`).
  Expect one set per probe: before a server process's first upload, then at most once a minute per process while
  uploads come, after a scan that failed, and at each run of the check below. They are not malware. Alert on the server's own `reason: "malware-found"` lines, which
  come only from authors' files, rather than on clamd's `FOUND` lines; if an alert must read clamd's log, leave out
  these three names when all three come from the server's address within a few seconds. Should a copy of a stream
  ever be kept (for example with `LeaveTemporaryFiles yes`), the nested ZIP holds the plain text
  `HVL Interaktiv clamd settings probe (SEC-006)`.

What the probe does **not** prove, so it stays on HVL's checklist: items 3 to 8 above (`StreamMaxLength`,
`MaxFileSize` and `MaxScanSize` of at least 50M, `MaxScanTime`, `MaxFiles`, the network and thread settings), that
the signatures are fresh ([below](#signature-updates)), and that every clamd behind one `CLAMAV_HOST` (a load
balancer) is set up alike: each stream reaches whichever clamd answers. A clamd that is set up again and restarted
between two probes is trusted for up to a minute, unless an upload failed meanwhile.

To check a clamd at deployment, or after changing it, run the probe once with the server's `CLAMAV_*` settings:
`npm run clamd:check` from the repository root, or, in the image, from `apps/server`:

```bash
node --import tsx src/security/malware/clamdCheckCli.ts
# last line: {"clamdCheck":"done","proven":true}; exit code 0 only when proven
```

## Signature updates

The signatures are HVL's to keep current. Run `freshclam` as a daemon beside clamd (the official image does this
unless `CLAMAV_NO_FRESHCLAMD=true`), allow it to reach `database.clamav.net` (or HVL's own mirror), and watch its log.
A clamd whose signatures are old still answers, so the server cannot see it: check `clamd --version`, whose third
field is the date of the daily signatures.

## Checking that it works

1. At start, the log shows `uploads are scanned for malware` with `malwareScan: "clamav"`.
2. Run the settings check above: it must end with `"proven":true`. After the first upload, the server's log shows
   `"clamdSettings":"proven"`, never an `error` line with `reason: "clamd-settings"`.
3. Ask clamd directly: `printf 'zPING\0' | nc <host> 3310` answers `PONG`, and
   `printf 'zVERSION\0' | nc <host> 3310` answers `ClamAV 1.4.6/<signatures>/<date>`.
4. Save the EICAR test string (a harmless text that every virus scanner reports; it is `EICAR` in
   `apps/server/test/support/fakeClamd.ts`) as a `.txt` file and upload it as an author in the H5P editor (a file
   field): the upload must be refused with the first message above, and the log shows `reason: "malware-found"`.
5. Upload a PDF that needs a password to open (any PDF exported with an opening password): it must be refused with
   the first message, and the log shows `signatures: ["Heuristics.Encrypted.PDF"]`. If the second message comes
   instead, with `reason: "clamd-settings"`, item 1 or 2 of [clamd's own settings](#clamds-own-settings) is missing.
6. Stop clamd and upload any file: it must be refused with the second message, and the log shows
   `reason: "unreachable"`. Start clamd again.

## Running a clamd for development and tests

Tests use a fake clamd, strict or lax on request, and need nothing. To try the real one (here with the image's own
signatures and without `freshclam`; pin the image by digest), start one clamd with both alerts and, for the lax
case, one without them:

```bash
IMAGE=clamav/clamav:1.4@sha256:8ad6197396974726c35d017e50aaaaf4b91745726a04faec8480c203edd98052
docker run -d --name hvli-clamav -p 127.0.0.1:13310:3310 -e CLAMAV_NO_FRESHCLAMD=true \
  -e CLAMD_CONF_AlertExceedsMax=yes -e CLAMD_CONF_AlertEncrypted=yes "$IMAGE"
docker run -d --name hvli-clamav-lax -p 127.0.0.1:13311:3310 -e CLAMAV_NO_FRESHCLAMD=true "$IMAGE"
# wait until `docker inspect <name> --format '{{.State.Health.Status}}'` says healthy (about 30 s, 1 GB memory each)
CLAMAV_TEST_HOST=127.0.0.1 CLAMAV_TEST_PORT=13310 CLAMAV_TEST_LAX_PORT=13311 \
  npx vitest run --root apps/server test/security/malware
docker rm -f hvli-clamav hvli-clamav-lax
```

With `CLAMAV_HOST=127.0.0.1` and `CLAMAV_PORT=13310` in `apps/server/.env`, the development server scans too.

CI runs the same image as two services, one with both alerts (`CLAMAV_TEST_HOST`, `CLAMAV_TEST_PORT`) and one
without them (`CLAMAV_TEST_LAX_PORT`), so the real-clamd tests, the probe's included, run on every push
(`.github/workflows/ci.yml`). The app stack in `deploy/compose.app.yml` has its own `clamav` service, also with both
alerts: its smoke test uploads EICAR and a clean image in the image and checks that the first is refused as malware
and the second stored and served from the files origin ([docker.md](docker.md); D-110's integration amendment of
2026-11-05). Without the alerts the probe would refuse both as unscanned, so the smoke fails then too.
