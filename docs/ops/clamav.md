# Runbook: malware scanning with ClamAV

| | |
|---|---|
| **Requirements** | `SEC-006` (malware scanning), `DATA-004` (encrypted traffic), `DATA-009` (no personal data in logs), `SEC-005` (50 MB uploads) |
| **Decisions** | D-110 and its amendments of 2026-11-05 (ClamAV, `SEC-006`; step 7: clamd's alerts); D-004 (only admins install libraries); D-112 (`clamscan` and TLS) |
| **Code** | `apps/server/src/security/malware/` (the scanner), `apps/server/src/config/malwareScanConfig.ts` (the start-up rules) |
| **Who** | HVL operations, where the server and clamd run |

## What the server does

When `CLAMAV_HOST` is set, every file an author uploads is sent to clamd, the ClamAV daemon, before it is stored:
files uploaded in the H5P editor and the content files of an imported `.h5p` package. The server uses Lumi's
`@lumieducation/h5p-clamav-scanner` 10.0.4 with its own wrapper, which **fails closed**: a file is stored only when
clamd answers "clean". The author sees one of two messages in Nynorsk, Bokmål or English:

| What happened | The author sees (nn) | Log line (`warn`) |
|---|---|---|
| clamd found malware | «Viruskontrollen fann skadeleg innhald i fila, så ho vart ikkje lagra.» | `reason: "malware-found"`, `signatures: [...]` |
| clamd cannot be reached, gives no answer in time, answers with an error or answers something that is not a verdict | «Fila kunne ikkje kontrollerast for virus akkurat no, så ho vart ikkje lagra. Prøv igjen om litt.» | `reason`: `unreachable`, `timeout`, `tls`, `connection-lost`, `size-limit`, `no-verdict` or `scanner-error` |

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

clamd decides what it can scan, and by default it answers "clean" for a file it did not scan in full. The server
cannot ask clamd for its settings, so check `clamd.conf` against this list; `clamconf -n` prints every setting that
differs from the default (`AlertExceedsMax = "yes"`). Items 1 and 2 are **required** (D-110's amendment of
2026-11-05, step 7). In the official image, set them as `CLAMD_CONF_AlertExceedsMax=yes` and
`CLAMD_CONF_AlertEncrypted=yes`: its entrypoint writes every `CLAMD_CONF_<option>` variable into `clamd.conf`.

1. `AlertExceedsMax yes`. Without it, a file over one of clamd's limits is answered "clean" after a partial scan.
   With it, the file is reported as `Heuristics.Limits.Exceeded.<limit>` and refused as malware. Measured with
   ClamAV 1.4.6 for `MaxScanSize`, `MaxFiles`, `MaxRecursion` and `MaxScanTime`, more limits than the comment in
   `clamd.conf` names.
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

## Signature updates

The signatures are HVL's to keep current. Run `freshclam` as a daemon beside clamd (the official image does this
unless `CLAMAV_NO_FRESHCLAMD=true`), allow it to reach `database.clamav.net` (or HVL's own mirror), and watch its log.
A clamd whose signatures are old still answers, so the server cannot see it: check `clamd --version`, whose third
field is the date of the daily signatures.

## Checking that it works

1. At start, the log shows `uploads are scanned for malware` with `malwareScan: "clamav"`.
2. Ask clamd directly: `printf 'zPING\0' | nc <host> 3310` answers `PONG`, and
   `printf 'zVERSION\0' | nc <host> 3310` answers `ClamAV 1.4.6/<signatures>/<date>`.
3. Save the EICAR test string (a harmless text that every virus scanner reports; it is `EICAR` in
   `apps/server/test/support/fakeClamd.ts`) as a `.txt` file and upload it as an author in the H5P editor (a file
   field): the upload must be refused with the first message above, and the log shows `reason: "malware-found"`.
4. Upload a PDF that needs a password to open (any PDF exported with an opening password): it must be refused with
   the first message, and the log shows `signatures: ["Heuristics.Encrypted.PDF"]`. If it is stored, item 2 of
   [clamd's own settings](#clamds-own-settings) is missing.
5. Stop clamd and upload any file: it must be refused with the second message, and the log shows
   `reason: "unreachable"`. Start clamd again.

## Running a clamd for development and tests

Tests use a fake clamd and need nothing. To try the real one (here with the image's own signatures and without
`freshclam`; pin the image by digest):

```bash
docker run -d --name hvli-clamav -p 127.0.0.1:13310:3310 -e CLAMAV_NO_FRESHCLAMD=true \
  -e CLAMD_CONF_AlertExceedsMax=yes -e CLAMD_CONF_AlertEncrypted=yes \
  clamav/clamav:1.4@sha256:8ad6197396974726c35d017e50aaaaf4b91745726a04faec8480c203edd98052
# wait until `docker inspect hvli-clamav --format '{{.State.Health.Status}}'` says healthy (about 30 s, 1 GB memory)
CLAMAV_TEST_HOST=127.0.0.1 CLAMAV_TEST_PORT=13310 npx vitest run --root apps/server test/security/malware
docker rm -f hvli-clamav
```

With `CLAMAV_HOST=127.0.0.1` and `CLAMAV_PORT=13310` in `apps/server/.env`, the development server scans too.

CI runs the same image as a service with `CLAMAV_TEST_HOST` and both alerts, so the real-clamd tests run on every push
(`.github/workflows/ci.yml`), and the app stack in `deploy/compose.app.yml` has its own `clamav` service, also with
both alerts: its smoke
test uploads EICAR and a clean image in the image and checks that the first is refused and the second stored and
served from the files origin ([docker.md](docker.md); D-110's integration amendment of 2026-11-05).
