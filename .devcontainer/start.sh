#!/usr/bin/env bash
# start.sh — starts HVL Interaktiv with the mock Feide and the mock Canvas in one terminal: the local services, then
# the mocks in the background, then the server in the foreground. Ctrl+C stops both.
#
# Why:   the documented way needs two terminals (`npm run mock:platform`, then `npm start`; apps/server/README.md);
#        one command is easier for someone who is trying the app (owner request, 2026-10-30).
# Spec:  AUTH-001, LTI-001 (the logins and launches it demonstrates, through D-049's mocks); otherwise development
#        tooling.
# Invariants: the server starts only after the mock Canvas and the mock Feide answer, because it registers the mock
#   Canvas from LTI_PLATFORMS at start-up and its logins need both; if the mocks stop, or do not answer after 30
#   tries a second apart, the script stops with a message instead. However the script ends (Ctrl+C, a server that
#   fails to start), the mocks stop with it and the script waits for them. The mocks keep everything in memory.
# Collaborators: ./services.sh, ../tools/mock-platform/cli.mjs, ../apps/server/src/server/main.ts.
# Tests: none automated; README.md in this folder says how to check it.
set -euo pipefail
cd "$(dirname "$0")/.."

bash .devcontainer/services.sh
# WHY: node itself, with the arguments of `npm run mock:platform` (package.json). npm passes a signal only to its
# `sh -c`, which ends without passing it on, so stopping npm left the mock's node process on ports 4100 and 4200.
node tools/mock-platform/cli.mjs --tool-url http://localhost:3000 --canvas-port 4100 --feide-port 4200 &
mock=$!
# WHY: wait too, so the prompt returns only when the ports are free again.
trap 'kill "$mock" 2>/dev/null || true; wait "$mock" 2>/dev/null || true' EXIT

for attempt in $(seq 1 30); do
  curl -s -o /dev/null --max-time 2 http://127.0.0.1:4100/ &&
    curl -s -o /dev/null --max-time 2 http://127.0.0.1:4200/.well-known/openid-configuration && break
  if ! kill -0 "$mock" 2>/dev/null || [ "$attempt" -eq 30 ]; then
    echo 'The mock Canvas or the mock Feide did not start (see the message above; is port 4100 or 4200 in use?).' >&2
    exit 1
  fi
  sleep 1
done

cat <<'TEXT'

Open on your own computer (VS Code or `gh codespace ports forward` forwards these addresses):
  http://localhost:3000/   HVL Interaktiv: «Logg inn med Feide» logs in the mock teacher `author`
  http://127.0.0.1:4100/   the mock Canvas: course page, launches as teacher or student, Deep Linking
Ctrl+C stops the server and the mocks.

TEXT
npm start
