# deploy

The server's Docker image, the app's own local stack and its smoke test (`NFR-007`, `MAPPE-004`, `SEC-006`,
`SEC-004`; D-110 and its amendments). The runbook, with every command, is [docs/ops/docker.md](../docs/ops/docker.md).

| Path | What it is |
|---|---|
| `Dockerfile` | The multi-stage image: Ubuntu 24.04 with Node 24 (both by digest), production dependencies, the built web app, H5P core, editor and the content-type bundle from checked build contexts, full Chromium, uid 10001 |
| `Dockerfile.dockerignore` | What the build context never holds: `.env` files, `.git`, `node_modules`, fetched folders, tests, documentation |
| `compose.app.yml` | The local stack (project `hvli-app`): PostgreSQL 16, Redis 7, moto and ClamAV by digest and unpublished; the bucket, migrate and seed steps; the app on `127.0.0.1` only, hardened, scanning every upload |
| `seccomp/` | Playwright v1.56.1's seccomp profile, byte for byte, so Chromium keeps its sandbox as a non-root user (see its README) |
| `smoke/dockerSmoke.sh` | The smoke test: build, `up --wait`, health, migration, seeded content type, pages from the image, an upload scanned and served from the files origin, the mappe PDF with the sandbox on, the start-up probe line, cleanup (with `smokeBuild.sh` and `smokeChecks.sh`) |
| `smoke/uploadProof.mjs` | Run in the app container: uploads EICAR and a clean PNG as the upload route does, so the stack's clamd scans both, saves a draft activity with the PNG and prints the player's URL for it on the files origin |
| `smoke/sandboxProof.mjs` | Run in the app container: reads from `/proc` that Chromium's renderers have their own PID namespace and seccomp filter |
| `smoke/proxyCaLines.mjs` | The lines of the proxy CA's own certificates, which the smoke looks for in every file of the image (sandbox only) |

The repository root's `docker-compose.yml` stays the test services for development and CI (`docker compose up -d`,
D-023); the app's stack is this folder's file (D-110, `SPEC-DEVIATION` of `NFR-007` in the file name only).
`tools/deploy-check` checks these files on every test run and before every smoke build.
