# smokeRuntimeChecks.sh — the smoke test's checks of how the running app behaves when something is wrong with it:
# the TypeScript loader keeps no translated code in the writable /tmp, and a server that stands still loses its
# "healthy" mark within the stack's limit, gets it back when it runs again, and says in its log how long it stood
# still. Sourced by ./dockerSmoke.sh, never run alone.
#
# Why:   the image's root file system is read-only, but tsx would keep and re-read translated code in /tmp; and a
#        health check that waits long keeps a standing server "healthy" while requests are still sent to it (D-144).
#        Both are settings of the image and the stack, so they are checked on the running stack.
# Spec:  NFR-007, NFR-002
# Tests: .github/workflows/docker.yml and a run here run it through ./dockerSmoke.sh.
# PRIVACY: the checks read a setting, folder names, the container's health mark and one log line of two numbers.

# Sends a signal to the server process itself (PID 1 is tini), from a short-lived node process in the container.
signal_server() {
  "${COMPOSE[@]}" exec -T app node -e '
    const fs = require("node:fs");
    for (const pid of fs.readdirSync("/proc").filter((name) => /^[0-9]+$/.test(name) && Number(name) !== process.pid)) {
      try {
        if (fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").includes("src/server/main.ts")) process.kill(Number(pid), process.argv[1]);
      } catch {}
    }' "$1"
}

# NFR-007, D-144: after the server, the seed and the checks above ran TypeScript in the container, /tmp holds no
# folder of translated code, because the image switches the loader's cache off.
check_code_cache() {
  local setting found
  setting=$("${COMPOSE[@]}" exec -T app sh -c 'printf %s "${TSX_DISABLE_CACHE:-}"')
  found=$("${COMPOSE[@]}" exec -T app sh -c 'ls -d /tmp/tsx-* 2>/dev/null || true')
  [[ "$setting" == 1 ]] || { echo "✗ code cache: TSX_DISABLE_CACHE is '$setting' in the app, not 1" >&2; return 1; }
  [[ -z "$found" ]] || { echo "✗ code cache: the loader wrote $found" >&2; return 1; }
  echo "✓ code cache: off in the image (TSX_DISABLE_CACHE=1); /tmp holds no folder of translated code"
}

health_of() { docker inspect -f '{{.State.Health.Status}}' "$1"; }

# NFR-002, D-144: the server process is stopped in place (SIGSTOP), as a server that stands still; the stack must
# mark the app unhealthy within 45 seconds, healthy again after SIGCONT, and the server must then log the standstill.
check_standstill() {
  local id waited=0 back=0 line
  id=$("${COMPOSE[@]}" ps -q app)
  [[ "$(health_of "$id")" == healthy ]] || { echo "✗ standstill: the app is not healthy to begin with" >&2; return 1; }
  signal_server SIGSTOP
  until [[ "$(health_of "$id")" == unhealthy ]]; do
    if ((waited >= 45)); then
      signal_server SIGCONT
      echo "✗ standstill: a server that stood still for 45 s is still $(health_of "$id")" >&2
      return 1
    fi
    sleep 1
    waited=$((waited + 1))
  done
  signal_server SIGCONT
  until [[ "$(health_of "$id")" == healthy ]]; do
    ((back < 60)) || { echo "✗ standstill: the app did not become healthy again in 60 s" >&2; return 1; }
    sleep 1
    back=$((back + 1))
  done
  for _ in $(seq 1 20); do
    line=$("${COMPOSE[@]}" logs --no-color app 2>/dev/null | grep -o '"standstillMs":[0-9]*' | tail -n 1 || true)
    [[ -z "$line" ]] || break
    sleep 1
  done
  [[ "${line#*:}" -ge $((waited * 1000 - 5000)) ]] ||
    { echo "✗ standstill: no log line for a standstill of about $waited s (${line:-none})" >&2; return 1; }
  echo "✓ standstill: unhealthy after $waited s, healthy again $back s after it ran on; the log says ${line#*:} ms"
}
