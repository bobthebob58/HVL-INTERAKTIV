# deploy/Dockerfile — the HVL Interaktiv server image: the Express server with the built web app, H5P core and editor,
# the content-type bundle and Playwright's Chromium for the PDF export, run as a non-root user.
#
# Why:   NFR-007 asks for a Docker image for local and staging use, and MAPPE-004's PDF needs Chromium with fonts for
#        æ, ø and å and with its sandbox on (D-096). The design is D-110 with its P3 and step-6 amendments.
# Spec:  NFR-007, MAPPE-004, H5P-001, H5P-003
# Tests: tools/deploy-check/test/deployFiles.test.mjs (pins, user, no GitHub, the CA only as a secret);
#        deploy/smoke/dockerSmoke.sh builds and runs it (here and in .github/workflows/docker.yml).
# Invariants:
#   - Every base image is pinned by digest; Node 24 comes from the node image onto Ubuntu 24.04 (D-110, probe P3).
#   - SECURITY: the build never fetches GitHub content. H5P core and editor (context `h5pcore`) and the content-type
#     bundle (context `h5pbundle`) come in as build contexts and are checked against their hashes in stage `inputs`.
#   - SECURITY: the proxy CA (this sandbox only) is an optional BuildKit secret and never a layer; no other secret
#     is used, and none is baked in.
#   - The runtime runs as uid 10001, owns only the H5P library folder and `.next/cache`, and never sets
#     `PDF_ALLOW_NO_SANDBOX` (D-096): Chromium's sandbox needs the seccomp profile in deploy/seccomp/.
# Build: docs/ops/docker.md. The contexts `h5pcore` (apps/server/h5p) and `h5pbundle` (tools/h5p-bundle) are needed;
#        `pwbrowsers` (a Playwright browser folder) only where Playwright's download host is out of reach.

FROM node:24-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS node

FROM ubuntu:24.04@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852 AS base
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && node --version
# PRIVACY: Next.js (D-068) and Prisma's CLI (its "checkpoint", in `prisma generate` and `migrate deploy`) report usage
# to their vendors unless told not to; the image says so for every stage and every deployment, not only the stack.
ENV NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1

# Every dependency from the lockfile, with install scripts: @prisma/engines fetches the OpenSSL 3 schema engine here.
FROM base AS deps
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/api-contract/package.json packages/api-contract/
COPY packages/design-tokens/package.json packages/design-tokens/
COPY packages/hvl-h5p-theme/package.json packages/hvl-h5p-theme/
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --no-audit --no-fund --logs-max=0 --cache /tmp/npm-cache && rm -rf /tmp/npm-cache

# The Prisma client, the design tokens, the theme and the web app.
FROM deps AS build
COPY . .
RUN npm run db:generate --workspace apps/server && npm run build && rm -rf apps/web/.next/cache

# Production dependencies only. tsx is a runtime dependency of apps/server (D-110 integration amendment); copying its
# closure past the prune is now a no-op, kept as a guard with the checks below.
FROM deps AS prod-deps
RUN npm query '#tsx, #tsx *' \
      | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{for(const p of JSON.parse(s))console.log(p.location)})' \
      | sort -u > /tmp/tsx-closure \
 && tar -cf /tmp/tsx-closure.tar -T /tmp/tsx-closure \
 && npm prune --omit=dev --no-audit --no-fund --logs-max=0 \
 && tar -xf /tmp/tsx-closure.tar \
 && rm /tmp/tsx-closure /tmp/tsx-closure.tar \
 && ln -sf ../tsx/dist/cli.mjs node_modules/.bin/tsx \
 && test -f node_modules/tsx/dist/cli.mjs \
 && test -f node_modules/prisma/build/index.js \
 && test -f node_modules/playwright-core/cli.js

# Full Chromium as Playwright 1.56.1 pins it; replaced by `--build-context pwbrowsers=<folder>` where the download host
# is refused (D-110 P3 amendment). Never the headless shell.
FROM deps AS pwbrowsers-download
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright node node_modules/playwright-core/cli.js install --no-shell chromium

FROM scratch AS pwbrowsers
COPY --from=pwbrowsers-download /ms-playwright/ /

# Only playwright-core, so the system-package layer below changes only when Playwright does.
FROM scratch AS playwright-core
COPY --from=deps /app/node_modules/playwright-core/ /

# Empty unless the build context of the same name is passed: H5P core and editor, and the content-type bundle.
FROM scratch AS h5pcore
FROM scratch AS h5pbundle

# SECURITY: every input from outside the repository is checked against its hashes before it reaches the image.
FROM deps AS inputs
COPY tools/h5p-core/verifyClientFiles.mjs tools/h5p-core/
COPY tools/h5p-libraries/resolveManifest.mjs tools/h5p-libraries/
COPY tools/h5p-bundle/contentTypeBundle.mjs tools/h5p-bundle/bundleCli.mjs tools/h5p-bundle/
COPY docs/reference/h5p-core-1.28-seed-packages/*.files.sha256 docs/reference/h5p-core-1.28-seed-packages/
COPY --from=h5pcore core /inputs/h5p/core
COPY --from=h5pcore editor /inputs/h5p/editor
COPY --from=h5pbundle / /inputs/h5p-bundle
RUN node tools/h5p-core/verifyClientFiles.mjs verify /inputs/h5p/core \
      docs/reference/h5p-core-1.28-seed-packages/h5p-php-library-1.28.0.files.sha256 \
      --prefix=h5p-php-library-1.28.0/ \
 && node tools/h5p-core/verifyClientFiles.mjs verify /inputs/h5p/editor \
      docs/reference/h5p-core-1.28-seed-packages/h5p-editor-php-library-ab2daa18.files.sha256 \
      --prefix=h5p-editor-php-library-ab2daa18/ \
 && node tools/h5p-bundle/bundleCli.mjs verify /inputs/h5p-bundle

FROM base AS runtime
# Chromium's system libraries (playwright-core's own list for Ubuntu 24.04), fonts with æ, ø and å, and tini.
RUN --mount=type=bind,from=playwright-core,target=/opt/playwright-core \
    node /opt/playwright-core/cli.js install-deps chromium \
 && apt-get install -y --no-install-recommends fonts-dejavu-core tini \
 && rm -rf /var/lib/apt/lists/*
RUN groupadd --gid 10001 hvli \
 && useradd --uid 10001 --gid 10001 --create-home --home-dir /home/hvli --shell /usr/sbin/nologin hvli
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright NODE_ENV=production WEB_APP=prod PORT=3000
COPY --from=pwbrowsers /chromium-1194 /ms-playwright/chromium-1194
WORKDIR /app
COPY --from=prod-deps /app /app
COPY --from=build /app/package.json /app/tsconfig.base.json /app/
COPY --from=build /app/content /app/content
COPY --from=build /app/packages /app/packages
COPY --from=build /app/apps/server/src /app/apps/server/src
COPY --from=build /app/apps/server/prisma /app/apps/server/prisma
COPY --from=build /app/apps/server/prisma.config.ts /app/apps/server/tsconfig.json /app/apps/server/
COPY --from=build /app/apps/web/.next /app/apps/web/.next
COPY --from=build /app/apps/web/next.config.mjs /app/apps/web/
COPY --from=inputs /inputs/h5p/core /app/apps/server/h5p/core
COPY --from=inputs /inputs/h5p/editor /app/apps/server/h5p/editor
COPY --from=inputs /inputs/h5p-bundle /app/h5p-bundle
# WHY: the code stays root's and read-only to the app; only the library folder (a volume) and Next.js's cache are its.
RUN mkdir -p apps/server/var/h5p/libraries apps/web/.next/cache \
 && chown -R 10001:10001 apps/server/var apps/web/.next/cache
USER 10001:10001
WORKDIR /app/apps/server
EXPOSE 3000
# WHY: tini reaps Chromium's exited children; node, not npm, receives SIGTERM for the server's own shutdown.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--import", "tsx", "src/server/main.ts"]
