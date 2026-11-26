# deploy/seccomp

`chromium-sandbox.seccomp` is the seccomp profile the app's containers run under, so that Chromium keeps its own
sandbox as a non-root user when it prints the pedagogisk mappe (`MAPPE-004`, D-096, D-110, D-144).

It is Docker's own default profile with **one rule added**, the first in its list:

```json
{ "names": ["clone", "setns", "unshare"], "action": "SCMP_ACT_ALLOW", "comment": "HVL Interaktiv: …" }
```

Docker's default allows these three calls only with `CAP_SYS_ADMIN` (and `clone` without namespace flags). Chromium
creates the user namespaces of its sandbox with them, and under the default it stops with "No usable sandbox!"
(probe P3). `seccomp=unconfined` and `--cap-add SYS_ADMIN` also work, but allow far more, and running as root or
with `--no-sandbox` is refused (D-096).

| | |
|---|---|
| Source | `https://github.com/moby/moby`, tag `docker-v29.9.2` (Docker Engine 29.9.2), commit `d7dfd6629b22aed77600050ab53695149b8c550d`, file `vendor/github.com/moby/profiles/seccomp/default.json` (module `github.com/moby/profiles/seccomp` v0.2.4) |
| Fetched | 2026-11-26 with `git fetch --depth 1 --filter=blob:none … refs/tags/docker-v29.9.2` and `git show FETCH_HEAD:vendor/github.com/moby/profiles/seccomp/default.json`, the `git` route of D-027 and D-078 |
| Docker's file | 14 122 bytes, SHA-256 `785b2429264afba4d594320337cb17f144f3c7d51585f9805eef72e28f4f9334` |
| This file | 14 363 bytes, SHA-256 `42127de905b5c57c10e93d012dfe89bd494b03de7e122734900157e64d938017` |
| Licence | Apache-2.0 (the `LICENSE` beside Docker's file at that commit) |
| Changes | The one rule above, inserted right after `"syscalls": [`. Nothing else: with the rule taken out, the file is Docker's byte for byte. The name ends in `.seccomp`, not `.json`, so no formatter in this repository rewrites it |
| Checked by | `tools/deploy-check/seccompRules.mjs` (`npm` tests `[MAPPE-004]` and `[NFR-007]`, and the smoke script before every build): the hash, the byte-for-byte proof, and what the profile must not allow |

Until D-144 the profile was Playwright's (`utils/docker/seccomp_profile.json`, v1.56.1), which is an older copy of
Docker's default with the same three calls opened. Against that file, this one no longer allows the `io_uring`
calls, allows `socket` only for the address families Docker's default allows, answers `clone3` with "not
implemented" (the C library then uses `clone`), and knows the system calls Docker has added since. Playwright's
newest release (v1.65.1) still carries the old file, byte for byte.

To update it with Docker: fetch `default.json` the same way at the new tag, review the diff against the old one,
insert the rule (the text is `ADDED_RULE` in `tools/deploy-check/seccompRules.mjs`), and change the two hashes there
and this table in one change; then run the smoke test, which prints the PDF with the sandbox on.
