# deploy/seccomp

`playwright-v1.56.1.seccomp` is the seccomp profile the app container runs under, so that Chromium keeps its own
sandbox as a non-root user when it prints the pedagogisk mappe (`MAPPE-004`, D-096, D-110's amendments of 2026-10-30
and 2026-11-05).

| | |
|---|---|
| Source | `https://github.com/microsoft/playwright`, tag `v1.56.1`, commit `54c711571a37de525377e6f3d3608c3e029b1829`, file `utils/docker/seccomp_profile.json` |
| Fetched | 2026-11-05 with `git fetch --depth 1 --filter=blob:none … refs/tags/v1.56.1` and `git show FETCH_HEAD:utils/docker/seccomp_profile.json`, the `git` route of D-027 and D-078 |
| Size and hash | 12 997 bytes, SHA-256 `cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849` |
| Licence | Apache-2.0 (Playwright's `LICENSE` at that commit) |
| Changes | None: the file is byte for byte upstream's. Only its name differs, without `.json`, so no formatter in this repository rewrites it |
| Checked by | `tools/deploy-check` (`npm` test `[NFR-007]`, and the smoke script before every build) |

What it changes from Docker's default profile: `clone`, `setns` and `unshare` are allowed without conditions (its
first rule, "Allow create user namespaces"), so Chromium can create the user namespaces its sandbox needs. Under
Docker's default profile Chromium stops with "No usable sandbox!" (probe P3). `seccomp=unconfined` and
`--cap-add SYS_ADMIN` also work, but allow far more, and running as root or with `--no-sandbox` is refused (D-096).

To update it with Playwright: fetch the file the same way at the new tag, review the diff, and change the file name,
the hash in `tools/deploy-check/deployRules.mjs`, this table, `deploy/compose.app.yml` and D-110 in one change.
