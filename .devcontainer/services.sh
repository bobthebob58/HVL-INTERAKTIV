#!/usr/bin/env bash
# services.sh — starts docker-compose.yml's PostgreSQL, Redis and S3 emulator in the dev container, waits until they
# answer, creates the server's S3 buckets, and lets Chromium's sandbox start for the container's non-root user.
#
# Why:   after every codespace start the services are stopped (docker-compose.yml sets no restart policy; the
#        database's volume is kept), so setup.sh runs this once and devcontainer.json's postStartCommand on every
#        later start. The S3 emulator keeps its data in memory, so its buckets are created again each time
#        (createS3Buckets.mjs). The PDF export keeps Chromium's sandbox (D-096);
#        where the host's AppArmor blocks the unprivileged user namespaces it needs, the restriction is lifted, as CI
#        does on its throwaway runner (.github/workflows/ci.yml).
# Spec:  H5P-004 (the S3 buckets), MAPPE-004 (the PDF export's Chromium); otherwise development tooling for trying
#        the app (owner request, 2026-10-30).
# Invariants:
#   - Development values only (docker-compose.yml's fixed passwords); never used in production.
#   - Safe to run again: running services and existing buckets are left as they are.
# Collaborators: ../docker-compose.yml, ./createS3Buckets.mjs, ./setup.sh, ./start.sh, ./devcontainer.json.
# Tests: none automated; README.md in this folder says how to check it.
set -euo pipefail
cd "$(dirname "$0")/.."

# WHY: lifecycle commands start as soon as the container runs, while the docker-in-docker feature's entrypoint may
# still be starting dockerd (it waits for the daemon itself, but the commands do not wait for it).
for _ in $(seq 1 60); do
  docker info >/dev/null 2>&1 && break
  sleep 1
done

docker compose up -d --wait
node .devcontainer/createS3Buckets.mjs
if [ -e /proc/sys/kernel/apparmor_restrict_unprivileged_userns ]; then
  sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0 >/dev/null || true
fi
