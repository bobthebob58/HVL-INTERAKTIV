#!/usr/bin/env bash
# dockerSmoke.sh — builds the server image, starts the app stack (deploy/compose.app.yml), checks health, the
# migration, a seeded content type, a page served from the image, an upload scanned by the stack's clamd and served
# from the files origin, and the mappe PDF with Chromium's sandbox on (seen in /proc too), then removes all it made.
#
# Why:   NFR-007's Verify is a compose smoke test, and MAPPE-004's PDF must print in the image with æ, ø and å
#        (D-096). One script runs here and in GitHub CI (D-110 and its amendments of 2026-10-30 and 2026-11-05).
# Spec:  NFR-007, MAPPE-004, H5P-003, SEC-006, SEC-004
# Tests: it is the test: .github/workflows/docker.yml runs it; tools/deploy-check checks the files it uses first.
# Invariants:
#   - Starts no Docker daemon: it stops with an instruction when `docker info` does not answer.
#   - The sandbox's extras (proxy CA, registry mirror for the builder, the host's Playwright browsers) are used only
#     with HVLI_DOCKER_SANDBOX=1, never because a path exists, so CI cannot pick them up.
#   - Whatever happens, it ends with `docker compose down -v`, removes its own image tag and its own builder with that
#     builder's cache; it never prunes other images or caches (unless HVLI_KEEP=1 keeps them for inspection).
# Usage: bash deploy/smoke/dockerSmoke.sh
# Env:   HVLI_DOCKER_SANDBOX=1 (this development sandbox only), HVLI_H5P_PACKAGES_DIR (default
#        apps/server/var/h5p-real/packages), HVLI_H5P_CORE_DIR (default apps/server/h5p), HVLI_APP_PORT (default
#        18080), HVLI_PROXY_CA (default /root/.ccr/ca-bundle.crt), HVLI_PW_BROWSERS (default /opt/pw-browsers),
#        HVLI_KEEP=1.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
# shellcheck source=deploy/smoke/smokeBuild.sh
source "$HERE/smokeBuild.sh"
# shellcheck source=deploy/smoke/smokeChecks.sh
source "$HERE/smokeChecks.sh"

RUN_ID="$(date +%Y%m%d%H%M%S)-$$"
export HVLI_IMAGE="hvli-app:smoke-$RUN_ID"
BUILDER="hvli-smoke-$RUN_ID"
PROJECT="hvli-smoke-$RUN_ID"
APP_PORT="${HVLI_APP_PORT:-18080}"
PACKAGES_DIR="$(cd "${HVLI_H5P_PACKAGES_DIR:-$ROOT/apps/server/var/h5p-real/packages}" && pwd)"
CORE_DIR="$(cd "${HVLI_H5P_CORE_DIR:-$ROOT/apps/server/h5p}" && pwd)"
PROXY_CA="${HVLI_PROXY_CA:-/root/.ccr/ca-bundle.crt}"
PW_BROWSERS="${HVLI_PW_BROWSERS:-/opt/pw-browsers}"
WORK="$(mktemp -d)"
COMPOSE=(docker compose -p "$PROJECT" -f "$ROOT/deploy/compose.app.yml" --env-file "$WORK/stack.env")
STARTED=$SECONDS

step() { echo "── $1 ($((SECONDS - STARTED)) s)"; }

cleanup() {
  local status=$?
  if [[ $status -ne 0 && -f "$WORK/stack.env" ]]; then
    echo "── the stack's last log lines (failure)" >&2
    "${COMPOSE[@]}" logs --no-color --tail 40 2>&1 | tail -n 120 >&2 || true
  fi
  if [[ "${HVLI_KEEP:-0}" == 1 ]]; then
    echo "HVLI_KEEP=1: left project $PROJECT, image $HVLI_IMAGE, builder $BUILDER and $WORK"
    exit "$status"
  fi
  step "cleanup"
  [[ -f "$WORK/stack.env" ]] && "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  docker image rm "$HVLI_IMAGE" >/dev/null 2>&1 || true
  # WHY: removing the builder removes its BuildKit state, i.e. exactly this run's build cache and nobody else's.
  docker buildx rm "$BUILDER" >/dev/null 2>&1 || true
  rm -rf "${WORK:?}"
  disk "after"
  if [[ $status -eq 0 ]]; then echo "✓ docker smoke passed in $((SECONDS - STARTED)) s"; else echo "✗ docker smoke failed" >&2; fi
  exit "$status"
}
trap cleanup EXIT

step "preflight"
disk "before"
preflight
step "static checks of the deploy files"
node "$ROOT/tools/deploy-check/checkDeployFiles.mjs"
step "content-type bundle from $PACKAGES_DIR"
make_bundle
step "builder"
create_builder
step "image build (log: build.log in the smoke's temporary folder)"
build_image
step "stack up --wait ($PROJECT)"
write_stack_env
"${COMPOSE[@]}" up -d --wait --wait-timeout 300 app
"${COMPOSE[@]}" ps --all --format '  {{.Service}}: {{.State}} {{.Status}}'
step "checks"
check_health
check_migration
check_seed
check_pages
check_upload
check_pdf
check_sandbox_processes
check_startup_probe
check_chromium
disk "at the peak"
