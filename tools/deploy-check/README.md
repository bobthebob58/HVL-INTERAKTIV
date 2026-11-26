# tools/deploy-check

## Purpose

Static checks of the deployment files in `deploy/` against D-110 and its amendments (`NFR-007`, `MAPPE-004`), so a
broken rule fails in a second rather than after a slow image build:

| File | What must hold |
|---|---|
| `deploy/seccomp/chromium-sandbox.seccomp` | The pinned hash (SHA-256 `42127de9…8017`); with its one added rule taken out it is Docker's default profile byte for byte (SHA-256 `785b2429…9334`); the default denies; `clone`, `setns` and `unshare` are allowed, so Chromium keeps its sandbox; no `io_uring` call and no `socket` of every address family (D-144) |
| `deploy/Dockerfile` | Every base image pinned by digest; no GitHub fetch and no `ADD` from a URL; the proxy CA only as the optional secret `proxy_ca` (no `.crt` or `.pem` copied, no `update-ca-certificates`); never `PDF_ALLOW_NO_SANDBOX` or `--no-sandbox`; no secret as `ARG` or `ENV`; the runtime stage ends as `USER 10001:10001` and sets `TSX_DISABLE_CACHE=1` (D-144) |
| `deploy/Dockerfile.dockerignore` | `.env` files, `.git`, `node_modules` and the fetched folders (`apps/server/var`, `apps/server/h5p`) stay out of the build context |
| `deploy/compose.app.yml` | Every image by digest; only the app published, on `127.0.0.1`; no secret written in the file (plural names such as `PSEUDONYM_SECRETS` too, and no password in any `…_URL`, map or list form); no service privileged, `unconfined` or sharing a host namespace, and none adding a capability but the app's `SYS_CHROOT`; the app and its steps run as 10001, read-only, without capabilities or new privileges, under the seccomp profile, and none changes `TSX_DISABLE_CACHE` |

The app stack's limits are checked too (D-134, `NFR-002`): the app has a restart rule, a memory limit of at least
4 GiB and no swap beyond it, and the steps that run once have no restart rule. So is its health check (D-144): a
try ends within 5 seconds, tries come at least every 10 seconds, at most 5 failed ones count, and there is a start
period.

## How to run

```bash
node tools/deploy-check/checkDeployFiles.mjs   # exit code 1 and one ✗ line per problem
npx vitest run tools/deploy-check              # the [NFR-007] tests, also on broken copies
```

The smoke script (`deploy/smoke/dockerSmoke.sh`) runs the command before it builds.

## Folder structure

| File | Responsibility |
|---|---|
| `deployRules.mjs` | The rules for the Dockerfile, the ignore file and the stack, as pure functions over file contents |
| `seccompRules.mjs` | The seccomp profile: its hash, Docker's default plus the one rule, and what it must not allow |
| `resourceRules.mjs` | The app stack's restart rule, memory limit and health check |
| `checkDeployFiles.mjs` | The command over the repository's files |
| `test/deployFiles.test.mjs` | The real files pass; broken copies are caught |
| `test/seccompRules.test.mjs` | The real profile passes; a changed byte, a second rule, an open default, `io_uring` or an unconditional `socket` is caught |
| `test/resourceRules.test.mjs` | The real stack file passes; a copy without a limit or a restart rule, or with a slow health check, is caught |
