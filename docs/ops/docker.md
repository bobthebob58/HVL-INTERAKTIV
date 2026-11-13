# Runbook: the Docker image, the app stack and its smoke test

| | |
|---|---|
| **Requirements** | `NFR-007` (Docker images and compose for local and staging use, a compose smoke test in CI), `MAPPE-004` (the mappe PDF in the image), `SEC-006` (uploads scanned in the stack), `SEC-004` (files origin in the stack), `H5P-001`, `H5P-003` |
| **Decisions** | D-110 and its amendments of 2026-10-30 (probe P3) and 2026-11-05 (step 6 and its integration); D-096 (Chromium for the PDF); D-109 (database roles) |
| **Files** | `deploy/Dockerfile`, `deploy/Dockerfile.dockerignore`, `deploy/compose.app.yml`, `deploy/seccomp/`, `deploy/smoke/`, `tools/h5p-bundle/`, `tools/deploy-check/`, `.github/workflows/docker.yml` |
| **Who** | Developers (local), CI (every pull request), HVL operations (staging and production, Q5) |

## What the image holds

One multi-stage `deploy/Dockerfile`, built from the repository root. Only its last stage, `runtime`, is tagged:

| Part | From | Checked by |
|---|---|---|
| Ubuntu 24.04 and Node 24 | `ubuntu:24.04` and `node:24-bookworm-slim`, both by digest | The digests in the Dockerfile (`tools/deploy-check`) |
| Production dependencies, `tsx` among them | `npm ci` from the lockfile, then `npm prune --omit=dev`; `tsx` is a dependency of `apps/server` (D-110 integration amendment), `prisma` stays as `@prisma/client`'s optional peer | The build fails if `tsx`, `prisma` or `playwright-core` is missing |
| The server's TypeScript, the Prisma client, the built web app, the tokens and the theme | The repository | The build (`prisma generate`, `npm run build`) |
| H5P core 1.28.0 and the pinned editor | Build context `h5pcore` (`apps/server/h5p`, from `npm run h5p:fetch-core`) | Every file against the committed hash lists, in stage `inputs` |
| The ten content types | Build context `h5pbundle` (from `tools/h5p-bundle`) | Their `SHA256SUMS`, the ten names and the build-secret scan, in stage `inputs` (its rules file, `apps/server/src/h5p/libraries/libraryBuildSecrets.ts`, is copied there too); the seeder checks the hashes and scans each package again, then scans the library volume |
| Full Chromium 141 (`chromium-1194`) | Playwright 1.56.1's download host, or build context `pwbrowsers` where that host is refused | `chrome --version` and its SHA-256, printed by the smoke test |
| Chromium's system libraries, `fonts-dejavu-core`, `tini` | Ubuntu's archive (`install-deps chromium`) | The PDF check (æ, ø and å embedded) |

The server runs as `hvli` (uid and gid 10001) under `tini`, as `node --import tsx src/server/main.ts` in
`/app/apps/server`. The code is root's and read-only to it; it owns only `apps/server/var/h5p/libraries` (mount a
volume there) and `apps/web/.next/cache`. The image's defaults are `NODE_ENV=production`, `WEB_APP=prod` and
`PORT=3000`; everything else comes from the environment (`apps/server/.env.example`). No secret is in the image.

**Chromium's sandbox needs Playwright's seccomp profile and `CAP_SYS_CHROOT`.** The PDF export keeps Chromium's
sandbox (D-096), and `PDF_ALLOW_NO_SANDBOX` is refused in production. Under Docker's default seccomp profile
Chromium stops with "No usable sandbox!", so run the container with `deploy/seccomp/playwright-v1.56.1.seccomp`.
After it creates its namespaces the sandbox chroots into `/proc/self/fdinfo`, which needs `SYS_CHROOT` in the
container's capability bounding set: with every capability dropped the launch fails with
`Check failed: sys_chroot("/proc/self/fdinfo/") == 0` (found by the smoke test, 2026-11-05). So drop all capabilities
and add back that one, for the app only:

```sh
docker run --security-opt seccomp=deploy/seccomp/playwright-v1.56.1.seccomp --security-opt no-new-privileges:true \
  --cap-drop ALL --cap-add SYS_CHROOT --read-only --tmpfs /tmp --tmpfs /home/hvli:uid=10001,gid=10001 --tmpfs /app/apps/web/.next/cache:uid=10001,gid=10001 \
  -v hvli-libraries:/app/apps/server/var/h5p/libraries --env-file <your env file> -p 127.0.0.1:3000:3000 <image>
```

Never use `seccomp=unconfined`, `--cap-add SYS_ADMIN`, root or `--no-sandbox` instead: they work, but allow far
more. Whether HVL's runtime (a Docker host, Kubernetes, OpenShift) allows a custom seccomp profile and
`SYS_CHROOT` is part of Q5 (OpenShift's `restricted-v2` allows neither); if it does not, the PDF export needs a
renderer container of its own. The server logs its PDF availability at start-up
(`PDF export availability`, with `pdfAvailable`, `pdfSandbox` and a reason code, once `main.ts` calls the probe):

| Reason | Meaning | What to do |
|---|---|---|
| `ok` | The export works, with the sandbox | Nothing |
| `no-usable-sandbox` | Chromium cannot set up its sandbox | Run with the seccomp profile and `--cap-add SYS_CHROOT` above; on Ubuntu hosts also allow unprivileged user namespaces (AppArmor) |
| `root-without-no-sandbox` | The process runs as root | Run as uid 10001 (the image's user) |
| `no-browser` | No Chromium at the configured path | Use the image as built; check `PDF_BROWSER_EXECUTABLE` |
| `launch-timeout`, `launch-failed`, `page-failed` | Chromium started badly or too slowly | Check the container's memory and CPU, then the log of a PDF export |
| `sandbox-off` | `PDF_ALLOW_NO_SANDBOX=true` (development only) | Never in staging or production |

The Markdown export always works, also when the PDF does not (D-096).

## Build the image

The build needs three inputs from outside the repository, as build contexts; a build never fetches GitHub content
(D-110):

```sh
npm run h5p:fetch-core                                         # H5P core and editor, checked (D-027)
npm run h5p:fetch-libraries                                    # the ten content types (needs GitHub; D-078)
node tools/h5p-bundle/bundleCli.mjs build --out /tmp/hvli-bundle
docker buildx build -f deploy/Dockerfile --target runtime -t hvli-app:local --load \
  --build-context h5pcore=apps/server/h5p --build-context h5pbundle=/tmp/hvli-bundle .
```

On a host without GitHub, copy the bundle folder from a machine with GitHub and check it there with
`node tools/h5p-bundle/bundleCli.mjs verify <folder>`. **If the bundle is refused for a secret**, the library build
wrote its machine's environment into a package (D-110 amendment of 2026-11-05): rebuild that library with a
minimal environment, as `.github/workflows/docker.yml` does (`env -i PATH="$PATH" HOME="$HOME" …`), and never ship
the refused packages. The same rules run when the `seed` step installs the bundle and when it then checks the library
volume: a volume seeded before the build fix fails that step until the library folder the check names, or the whole
volume, is deleted ([runbook](runbook.md) §2; `npm run libraries:check` runs the volume check alone; D-110's
amendments of 2026-11-06).

## The app stack (local)

`deploy/compose.app.yml` (project `hvli-app`) runs the image with its own PostgreSQL 16, Redis 7, moto and ClamAV
1.4.6 (clamd, with the image's own signatures and `freshclam` off), all by digest and none published; the app listens on `127.0.0.1:${HVLI_APP_PORT:-18080}` only, as uid 10001 with a
read-only root file system, no new privileges, the seccomp profile and no capability but `SYS_CHROOT`. One-off steps run in order:
`buckets` (creates `hvli-content` and `hvli-temporary` in moto), `migrate` (`prisma migrate deploy`) and `seed` (the
ten types from `/app/h5p-bundle` into the library volume); then `app` starts once clamd is healthy. Every service from
the image has `CLAMAV_HOST=clamav`, so every upload is scanned as in production (`SEC-006`), and the files origin is
`files.localhost:<port>` (`SEC-004`; Chromium and Firefox resolve `*.localhost` themselves). Every key, password and secret comes
from the environment (`${NAME:?}`); the file holds none. It is a local stack: `NODE_ENV=development`, because the
production checks refuse its plain-HTTP connections. The plain `docker compose up -d` in the repository root still
starts only the test services (D-023).

```sh
HVLI_IMAGE=hvli-app:local docker compose -f deploy/compose.app.yml --env-file <file with the variables> up -d --wait app
```

For **staging**, run the same image with `NODE_ENV=production`, TLS endpoints (`sslmode=verify-full`, `rediss://`,
an `https` S3 endpoint), `PUBLIC_BASE_URL` and the files origin on https (`FILES_BASE_URL`, D-110), the app role's
`DATABASE_URL`, and the migrate step with the migration role's URL and D-109's role scripts
([database-roles.md](database-roles.md)). Create the buckets once with HVL's S3 provider; the seed step is the same.
Point `CLAMAV_HOST` at HVL's own clamd, with `CLAMAV_TLS=true` unless it is on the loopback and signatures that update
daily ([clamav.md](clamav.md)), rather than the stack's `clamav` service.

## The smoke test

```sh
bash deploy/smoke/dockerSmoke.sh                        # GitHub CI, and any machine with Docker and GitHub
HVLI_DOCKER_SANDBOX=1 bash deploy/smoke/dockerSmoke.sh  # the development sandbox only (see below)
```

It needs Docker with buildx and compose, Node 24, curl and poppler-utils (`pdftotext`, `pdffonts`, `pdfinfo`), the
fetched H5P core (`HVLI_H5P_CORE_DIR`) and packages (`HVLI_H5P_PACKAGES_DIR`). In order it: prints the free disk
space; runs `tools/deploy-check`; builds the bundle; creates a buildx builder of its own (`docker-container` driver,
`moby/buildkit:v0.33.1` by digest); builds and loads the image; starts the stack with `up --wait` and random
throwaway secrets; checks `/healthz`, that every migration is applied, that `H5P.MultiChoice-1.16` and its audit rows
were seeded, that `/hjelp` (nn), one of its scripts and `/h5p/core/js/h5p.js` are served from the image; that an
upload is scanned and served from the files origin (`deploy/smoke/uploadProof.mjs` in the app container: the stack's
clamd refuses the EICAR test file as `upload.file.malwareFound` and passes a clean PNG, which is saved in a draft
activity; the player's URL for it answers 200 on `files.localhost:<port>` with a sandbox policy, `nosniff` and no
cookie, and 404 on the app's own host; the upload goes through the route's sanitisers and Lumi's `files` action, not
the HTTP route, because the stack has no Feide or LTI login); and that the mappe sample prints **inside the app container with the sandbox on** (`pdftotext` finds `æ ø å Æ Ø Å`, `pdffonts`
shows every font embedded, `pdfinfo` says `Tagged: yes` and A4); reads the sandbox from `/proc` while a page renders
(`deploy/smoke/sandboxProof.mjs`: every renderer in a PID namespace of its own and under Chromium's own seccomp filter,
which `--no-sandbox` would remove); requires the server's own start-up line `PDF export availability` with `pdfSandbox: true` and `reason: "ok"`; prints
Chromium's version and SHA-256; then runs
`docker compose down -v`, removes its image and removes its builder, which removes exactly its own build cache (the
pulled `clamav/clamav` and `moby/buildkit` images stay for the next run).
`HVLI_KEEP=1` keeps all of it for inspection.

**In the development sandbox** (D-110 P3 amendment): `dockerd` does not persist; start it by hand with the mirror,
`cd / && setsid nohup dockerd --registry-mirror=https://mirror.gcr.io >dockerd.log 2>&1 < /dev/null &`. With
`HVLI_DOCKER_SANDBOX=1` the smoke passes the agent proxy's CA as the BuildKit secret `proxy_ca`, gives its builder the
mirror and that CA, and takes Chromium from `/opt/pw-browsers` (`HVLI_PROXY_CA`, `HVLI_PW_BROWSERS`); after the build
it searches every file of the image for the CA's own certificates (`deploy/smoke/proxyCaLines.mjs`). Test anything
else with Docker through a builder of your own too: a test build on the default builder leaves cache records that keep
the image's layers on disk after the image is removed. The image is about
2.8 GB (2 776 MB measured) and a run needs about 8 GB free at its peak (image, its builder's cache and the stack);
the smoke prints the free space before, at the peak and after, and a passing run takes about 2.5 minutes here. Never run
`docker system prune` or `docker builder prune -af` there: they remove other sessions' images and cache.
