# tools/seed

## Purpose

Prepares the verified H5P content-type packages that offline seeding (`H5P-003`, Session 2) installs.
`fetch-seed-packages.sh` downloads the ten seed types from the H5P Content Type Hub on a machine where
the Hub is reachable, checks each package as data only (nothing is unpacked or executed), and writes
`SHA256SUMS` into `docs/reference/h5p-core-1.28-seed-packages/`. The status of that folder and the
evidence for the request shape are in its [README](../../docs/reference/h5p-core-1.28-seed-packages/README.md).

## How to run

```bash
bash tools/seed/fetch-seed-packages.sh --dry-run    # print the plan and URLs; no network, no writes
bash tools/seed/fetch-seed-packages.sh              # download into docs/reference/…/ (refuses to overwrite)
bash tools/seed/fetch-seed-packages.sh --replace    # replace existing packages and SHA256SUMS
```

Needs `bash`, `curl`, `unzip` and `sha256sum`.

Then install the libraries, offline (needs the services from `docker compose up -d`):

```bash
npm run seed:libraries                       # from docs/reference/h5p-core-1.28-seed-packages/
npm run seed:libraries -- /path/to/folder    # any folder with .h5p files and their SHA256SUMS
```

The seeder lives in `apps/server/src/h5p/libraries/` because it uses the server's storage, locks and audit
(D-042). It refuses the whole folder if a package is unlisted, missing, or does not match its hash, checks
every archive like an upload, records one `LibraryAuditEvent` (`source: seed`) per new or patched library, and
changes nothing on a second run.
