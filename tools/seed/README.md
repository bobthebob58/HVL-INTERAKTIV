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

Needs `bash`, `curl`, `unzip` and `sha256sum`. Session 2 adds `npm run seed:libraries`, which installs
the packages without network access.
