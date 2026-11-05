# tools/deploy-check

## Purpose

Static checks of the deployment files in `deploy/` against D-110 and its amendments (`NFR-007`, `MAPPE-004`), so a
broken rule fails in a second rather than after a slow image build:

| File | What must hold |
|---|---|
| `deploy/seccomp/playwright-v1.56.1.seccomp` | Byte for byte the hashed upstream file (SHA-256 `cc3e61ca…7849`); the default denies; `clone`, `setns` and `unshare` are allowed, so Chromium keeps its sandbox |
| `deploy/Dockerfile` | Every base image pinned by digest; no GitHub fetch and no `ADD` from a URL; the proxy CA only as the optional secret `proxy_ca` (no `.crt` or `.pem` copied, no `update-ca-certificates`); never `PDF_ALLOW_NO_SANDBOX` or `--no-sandbox`; no secret as `ARG` or `ENV`; the runtime stage ends as `USER 10001:10001` |
| `deploy/Dockerfile.dockerignore` | `.env` files, `.git`, `node_modules` and the fetched folders (`apps/server/var`, `apps/server/h5p`) stay out of the build context |
| `deploy/compose.app.yml` | Every image by digest; only the app published, on `127.0.0.1`; no secret written in the file (plural names such as `PSEUDONYM_SECRETS` too, and no password in any `…_URL`, map or list form); no service privileged, `unconfined` or sharing a host namespace, and none adding a capability but the app's `SYS_CHROOT`; the app and its steps run as 10001, read-only, without capabilities or new privileges, under the seccomp profile |

## How to run

```bash
node tools/deploy-check/checkDeployFiles.mjs   # exit code 1 and one ✗ line per problem
npx vitest run tools/deploy-check              # the [NFR-007] tests, also on broken copies
```

The smoke script (`deploy/smoke/dockerSmoke.sh`) runs the command before it builds.

## Folder structure

| File | Responsibility |
|---|---|
| `deployRules.mjs` | The rules, as pure functions over file contents |
| `checkDeployFiles.mjs` | The command over the repository's files |
| `test/deployFiles.test.mjs` | The real files pass; broken copies are caught |
