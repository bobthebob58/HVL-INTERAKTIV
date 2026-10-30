#!/usr/bin/env bash
# setup.sh — prepares a new dev container (GitHub Codespaces) to run HVL Interaktiv against the mock Feide and the
# mock Canvas: dependencies, local services and S3 buckets, H5P core and editor, the ten real content types, the
# database, Chromium and the web app build. devcontainer.json runs it once, when the container is created.
#
# Why:   the owner and HVL's testers can try the app without installing Node.js or Docker (owner request,
#        2026-10-30). The steps and their order are those of apps/server/README.md ("How to run") and CI
#        (.github/workflows/ci.yml), so nothing here is new. services.sh runs that README's bucket step
#        (createS3Buckets.mjs) on every start, because the S3 emulator keeps its buckets in memory.
# Spec:  none of its own: development tooling (H5P-001 core fetch, D-078 real content types, D-068 web app build).
# Invariants:
#   - An existing apps/server/.env is never overwritten. A new one is apps/server/.env.example with the built web app
#     (`WEB_APP=prod`), whose pages answer faster than the development server's, and nothing else changed.
#   - Development values only: .env.example's keys are public test values, which production refuses.
#   - A failed step stops the script with its own message, then the name of the step and how to run it again.
#     Running it again is safe: every step either checks what it finds or does the same thing again.
# Collaborators: ./services.sh, ./createS3Buckets.mjs, ./start.sh, ../apps/server/.env.example,
#   ../tools/h5p-core/fetchCoreClients.sh, ../tools/h5p-libraries/fetchLibraries.mjs.
# Tests: none automated; README.md in this folder says how to check it.
set -euo pipefail
cd "$(dirname "$0")/.."

current='start'
step() {
  current=$1
  printf '\n== %s\n' "$1"
}
# WHY: devcontainer.json runs this once, in the codespace's creation log; a stop there must say where and what next.
trap 'status=$?; [ "$status" -eq 0 ] || printf "\nsetup.sh stopped at «%s» (exit code %s). Fix the cause above, then run: bash .devcontainer/setup.sh\n" "$current" "$status" >&2' EXIT

step 'Dependencies (exact lockfile)'
npm ci

step 'Local settings (apps/server/.env)'
if [ -f apps/server/.env ]; then
  echo 'apps/server/.env exists; left as it is.'
else
  # WHY: written beside it and moved, so a failed step never leaves a partial .env that a re-run would keep.
  sed 's/^WEB_APP=dev$/WEB_APP=prod/' apps/server/.env.example > apps/server/.env.new
  grep -qx 'WEB_APP=prod' apps/server/.env.new || {
    echo '.env.example no longer has the line WEB_APP=dev; set WEB_APP=prod by hand.' >&2
    rm -f apps/server/.env.new
    exit 1
  }
  mv apps/server/.env.new apps/server/.env
  echo 'Created from .env.example, with WEB_APP=prod.'
fi

step 'PostgreSQL, Redis, the S3 emulator and its buckets'
bash .devcontainer/services.sh

step 'H5P core 1.28.0 and the pinned editor'
npm run h5p:fetch-core

step 'The ten real content types from GitHub at pinned commits (a cold fetch builds about 2 GB)'
npm run h5p:fetch-libraries

step 'Database'
npm run db:generate --workspace apps/server
npm run db:migrate

step 'Installing the content types'
# WHY: npm runs the workspace's script in apps/server, so the folder is apps/server/var/h5p-real/packages, where
# h5p:fetch-libraries wrote the packages.
npm run seed:libraries -- var/h5p-real/packages

step 'Chromium (the PDF export of the pedagogisk mappe)'
npx playwright-core install --with-deps chromium

step 'Web app build'
npm run build

step 'H5P engine start-up check'
npm run boot-check --workspace apps/server

printf '\nReady. Start the app with: bash .devcontainer/start.sh\n'
