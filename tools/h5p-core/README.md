# tools/h5p-core

## Purpose

Fetches the H5P client files the server serves to players and editors, and proves they are the reviewed
versions (`H5P-001`, decisions D-022 and D-027):

| Part | Source | Pinned by | Verified against |
|---|---|---|---|
| Core | `h5p/h5p-php-library`, tag `1.28.0` | commit `2aeb0b83…` | `docs/reference/h5p-core-1.28-seed-packages/h5p-php-library-1.28.0.files.sha256` (67 files) |
| Editor | `h5p/h5p-editor-php-library` (no 1.28 tag exists) | commit `ab2daa18…` | `docs/reference/h5p-core-1.28-seed-packages/h5p-editor-php-library-ab2daa18.files.sha256` |

The files land in `apps/server/h5p/{core,editor}`, which git ignores. A wrong commit, or any changed,
missing or extra file, stops the script before anything is copied. At startup the server checks the core
API version in the fetched files again and refuses to run on anything but 1.28.

## How to run

```bash
npm run h5p:fetch-core                       # fetch, verify, copy into apps/server/h5p/
npm run boot-check --workspace apps/server   # confirm the server accepts them (logs core 1.28 and the Hub host)
npx vitest run tools/h5p-core                # tests of the verifier
```

Needs `git` and network access to github.com.

## Changing the pinned editor commit

1. Review the diff between the old and the new commit in `h5p/h5p-editor-php-library`.
2. Change `EDITOR_COMMIT` (and the hash-list file name) in `fetchCoreClients.sh`, record the decision in
   `docs/DECISIONS.md` (amend D-022 or add a new entry).
3. Run `bash tools/h5p-core/fetchCoreClients.sh --record-editor-hashes`, review the new list, commit both.
