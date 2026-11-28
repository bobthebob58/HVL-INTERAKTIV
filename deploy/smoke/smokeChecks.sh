# smokeChecks.sh — the smoke test's checks on the running stack: health, the migration, a seeded content type, a web
# page and H5P core served from the image, an upload scanned by the stack's clamd and served from the files origin,
# the mappe PDF printed in the app container with Chromium's sandbox, the kernel's view of that sandbox, the start-up
# probe's line, which Chromium the image carries, the server's own memory line, and that the app has its memory
# limit and comes back after its server process stops. Sourced by ./dockerSmoke.sh, never run alone.
#
# Why:   NFR-007's Verify is a compose smoke test, and MAPPE-004's PDF must print in the image with æ, ø and å embedded,
#        tagged and A4, with the sandbox on (D-096; D-110 amendments of 2026-10-30 and 2026-11-05).
# Spec:  NFR-007, MAPPE-004, H5P-003, SEC-006, SEC-004, NFR-002
# Tests: .github/workflows/docker.yml and a run here run it through ./dockerSmoke.sh.
# PRIVACY: the checks read counts, folder names, the sample PDF and a 1×1 test image only; no log line holds a secret,
#          a grant or a person.

check_health() {
  local answer
  answer=$(curl -fsS --max-time 10 "http://127.0.0.1:$APP_PORT/healthz")
  [[ "$answer" == *'"ok"'* ]] || { echo "✗ /healthz answered: $answer" >&2; return 1; }
  echo "✓ /healthz: $answer"
}

psql_count() { "${COMPOSE[@]}" exec -T postgres psql -U hvli -d hvli -tAc "$1"; }

check_migration() {
  local applied expected
  applied=$(psql_count 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')
  expected=$(find "$ROOT/apps/server/prisma/migrations" -mindepth 1 -maxdepth 1 -type d | wc -l)
  [[ "$applied" -eq "$expected" ]] || { echo "✗ migrations: $applied applied, $expected in the repository" >&2; return 1; }
  echo "✓ migrations: $applied of $expected applied by the migrate step"
}

check_seed() {
  local folders rows
  folders=$("${COMPOSE[@]}" exec -T app ls var/h5p/libraries)
  grep -qx 'H5P.MultiChoice-1.16' <<<"$folders" || { echo "✗ H5P.MultiChoice-1.16 was not seeded" >&2; return 1; }
  rows=$(psql_count "SELECT count(*) FROM \"LibraryAuditEvent\" WHERE source = 'seed'")
  [[ "$rows" -gt 0 ]] || { echo "✗ the seed wrote no LibraryAuditEvent" >&2; return 1; }
  echo "✓ seed: $(wc -l <<<"$folders") library folders from the bundle, H5P.MultiChoice-1.16 among them; $rows seed audit rows"
}

# The built web app and H5P core come from the image: a page in nn, one of its scripts, and H5P's own script.
check_pages() {
  local base="http://127.0.0.1:$APP_PORT" page chunk status
  page=$(curl -fsS --max-time 20 "$base/hjelp") || { echo "✗ /hjelp did not answer 200" >&2; return 1; }
  grep -q '<html lang="nn"' <<<"$page" || { echo "✗ /hjelp is not the nn page" >&2; return 1; }
  chunk=$(grep -oE '/_next/static/[^"]+\.js' <<<"$page" | head -n 1)
  for path in "$chunk" /h5p/core/js/h5p.js; do
    status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$base$path")
    [[ -n "$path" && "$status" == 200 ]] || { echo "✗ ${path:-a web app script}: $status" >&2; return 1; }
  done
  echo "✓ pages: /hjelp (nn), its script $chunk and /h5p/core/js/h5p.js answer 200 from the image"
}

check_pdf() {
  local summary
  "${COMPOSE[@]}" exec -T app node --import tsx src/learningDesign/mappe/pdf/pdfCheckCli.ts \
    --out /tmp/hvli-pdf-check.pdf --require-sandbox >"$WORK/pdf-check.log" 2>&1 ||
    { cat "$WORK/pdf-check.log" >&2; return 1; }
  summary=$(tail -n 1 "$WORK/pdf-check.log")
  echo "  probe: $(grep 'PDF export availability' "$WORK/pdf-check.log")"
  [[ "$summary" == *'"available":true,"sandbox":true,"reason":"ok"'* ]] ||
    { echo "✗ PDF check: $summary" >&2; return 1; }
  if grep -qiE 'No usable sandbox|--no-sandbox' "$WORK/pdf-check.log"; then
    echo "✗ Chromium ran without its sandbox" >&2
    return 1
  fi
  "${COMPOSE[@]}" exec -T app cat /tmp/hvli-pdf-check.pdf >"$WORK/mappe.pdf"
  local text fonts info
  text=$(pdftotext -enc UTF-8 "$WORK/mappe.pdf" -)
  fonts=$(pdffonts "$WORK/mappe.pdf" | tail -n +3)
  info=$(pdfinfo "$WORK/mappe.pdf")
  grep -qF 'æ ø å Æ Ø Å' <<<"$text" || { echo "✗ pdftotext: no 'æ ø å Æ Ø Å'" >&2; return 1; }
  grep -qF 'Pedagogisk mappe: Blåbærsyltetøy' <<<"$text" || { echo "✗ pdftotext: no title text" >&2; return 1; }
  [[ -n "$fonts" ]] && awk '$(NF-4) != "yes" { bad = 1 } END { exit bad }' <<<"$fonts" ||
    { echo "✗ pdffonts: a font is not embedded" >&2; echo "$fonts" >&2; return 1; }
  grep -qE '^Tagged: +yes' <<<"$info" || { echo "✗ pdfinfo: not tagged" >&2; return 1; }
  grep -qE '^Page size: +595\.[0-9]+ x 842\.[0-9]+ pts \(A4\)' <<<"$info" || { echo "✗ pdfinfo: not A4" >&2; return 1; }
  echo "✓ PDF in the app container with the sandbox: $summary"
  echo "  pdftotext: $(grep -F 'æ ø å' <<<"$text")"
  awk '{ print "  pdffonts: " $1 " emb=" $(NF-4) " sub=" $(NF-3) " uni=" $(NF-2) }' <<<"$fonts"
  echo "  pdfinfo: $(grep -E '^(Tagged|Page size|Producer):' <<<"$info" | tr -s ' ' | paste -sd ';' -)"
}

# MAPPE-004, D-096: the kernel's view, not only the launch option: each renderer in a PID namespace of its own and
# under Chromium's own seccomp filter on top of the container's (./sandboxProof.mjs).
check_sandbox_processes() {
  local proof
  proof=$("${COMPOSE[@]}" exec -T app node --import tsx --input-type=module - <"$HERE/sandboxProof.mjs" 2>&1) ||
    { echo "✗ Chromium's renderers are not sandboxed: $proof" >&2; return 1; }
  echo "✓ sandbox seen in /proc: $proof"
}

# MAPPE-004, D-110 integration amendment: the server's own start-up line says the export works with its sandbox.
check_startup_probe() {
  local line
  line=$("${COMPOSE[@]}" logs --no-color app 2>/dev/null | grep -o '{.*"msg":"PDF export availability"}' || true)
  [[ "$line" == *'"pdfAvailable":true,"pdfSandbox":true,"reason":"ok"'* ]] ||
    { echo "✗ the server's start-up probe: ${line:-no line}" >&2; return 1; }
  echo "✓ start-up probe: $(grep -o '"pdfAvailable".*"reason":"[a-z-]*"' <<<"$line")"
}

# SEC-004 in the image: one signed file URL is served by the files origin (200, the PNG, the sandbox policy, nosniff,
# no cookie) and never by the app's own origin (404). SECURITY: the URL carries a grant, so it is used, never printed.
files_origin_only() {
  local what=$1 url=$2 files_host path status
  files_host=$(node -e 'process.stdout.write(new URL(process.argv[1]).host)' "$url")
  path=$(node -e 'process.stdout.write(new URL(process.argv[1]).pathname)' "$url")
  [[ "$files_host" == "files.localhost:$APP_PORT" ]] ||
    { echo "✗ $what is on $files_host, not the files origin" >&2; return 1; }
  status=$(curl -s -D "$WORK/files.headers" -o "$WORK/files.body" -w '%{http_code}' --max-time 20 \
    -H "Host: $files_host" "http://127.0.0.1:$APP_PORT$path")
  [[ "$status" == 200 ]] || { echo "✗ $what: the files origin answered $status" >&2; return 1; }
  [[ "$(head -c 8 "$WORK/files.body" | od -An -tx1 | tr -d ' \n')" == 89504e470d0a1a0a ]] ||
    { echo "✗ $what: the files origin did not send the PNG" >&2; return 1; }
  grep -qiE '^content-security-policy:.*sandbox' "$WORK/files.headers" ||
    { echo "✗ $what: no CSP sandbox on the files origin" >&2; return 1; }
  grep -qiE '^x-content-type-options: *nosniff' "$WORK/files.headers" ||
    { echo "✗ $what: no nosniff" >&2; return 1; }
  ! grep -qi '^set-cookie:' "$WORK/files.headers" ||
    { echo "✗ $what: the files origin set a cookie" >&2; return 1; }
  status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -H "Host: localhost:$APP_PORT" \
    "http://127.0.0.1:$APP_PORT$path")
  [[ "$status" == 404 ]] || { echo "✗ $what: the app origin answered $status" >&2; return 1; }
}

# SEC-006 and SEC-004 in the image (./uploadProof.mjs): the stack's clamd refuses EICAR and passes a clean PNG; the
# running app serves the stored PNG to the player and to the editor, and a fresh upload, on the files origin with
# the sandbox policy, never on its own origin (D-153).
check_upload() {
  local out line kind url
  out=$("${COMPOSE[@]}" exec -T app node --import tsx --input-type=module - <"$HERE/uploadProof.mjs" 2>&1) ||
    { echo "✗ the upload proof failed: $(tail -n 1 <<<"$out")" >&2; return 1; }
  line=$(tail -n 1 <<<"$out")
  [[ "$line" == *'"eicar":"upload.file.malwareFound"'* ]] ||
    { echo "✗ EICAR was not refused as malware: ${line%%\"fileUrl\"*}" >&2; return 1; }
  grep -q '"reason":"malware-found","signatures":\["Eicar' <<<"$out" ||
    { echo "✗ no malware-found line from the scanner" >&2; return 1; }
  for kind in fileUrl editorFileUrl uploadUrl; do
    url=$(node -e 'process.stdout.write(JSON.parse(process.argv[1])[process.argv[2]] ?? "")' "$line" "$kind")
    files_origin_only "the $kind" "$url" || return 1
  done
  echo "✓ upload: the stack's clamd refused EICAR ($(grep -o '"signatures":\[[^]]*\]' <<<"$out" | head -n 1)) and passed a"
  echo "  clean PNG; files.localhost:$APP_PORT serves it to the player and to the editor, and a fresh upload (200, CSP"
  echo "  sandbox, nosniff, no cookie); the app origin answers 404 for each"
}

check_chromium() {
  "${COMPOSE[@]}" exec -T app sh -c \
    'id; /ms-playwright/chromium-1255/chrome-linux64/chrome --version; sha256sum /ms-playwright/chromium-1255/chrome-linux64/chrome' |
    sed 's/^/  chromium: /'
}

# NFR-002, D-134: inside the container the server reads the stack's limit and finds that its budget fits.
check_memory_budget() {
  local logs line
  logs=$("${COMPOSE[@]}" logs --no-color app 2>/dev/null)
  line=$(grep -o '{.*"msg":"memory limits"}' <<<"$logs" | head -n 1 || true)
  [[ "$line" == *'"containerLimitMb":5120,'* ]] ||
    { echo "✗ the server's memory line: ${line:-no line}" >&2; return 1; }
  if grep -q 'the memory limit is below what the server may use\|the container has no memory limit' <<<"$logs"; then
    echo "✗ the server warns that its memory budget does not fit: $line" >&2
    return 1
  fi
  echo "✓ memory budget: $(grep -o '"containerLimitMb".*"neededMb":[0-9]*' <<<"$line") MiB, no warning"
}

# NFR-002, D-134: the app has its memory limit, and a server that ends its process comes back by the stack's restart
# rule. Run last: it stops the server once.
check_restart() {
  local id limit before after
  id=$("${COMPOSE[@]}" ps -q app)
  limit=$(docker inspect -f '{{.HostConfig.Memory}}' "$id")
  [[ "$limit" -ge $((4096 * 1024 * 1024)) ]] ||
    { echo "✗ the app's memory limit is $limit bytes, below 4 GiB" >&2; return 1; }
  before=$(docker inspect -f '{{.RestartCount}}' "$id")
  # WHY: the server process itself. PID 1 (tini) ignores a kill from inside, and `docker kill` counts as a stop by
  # hand, which the restart rule rightly leaves alone.
  "${COMPOSE[@]}" exec -T app node -e '
    const fs = require("node:fs");
    for (const pid of fs.readdirSync("/proc").filter((name) => /^[0-9]+$/.test(name) && Number(name) !== process.pid)) {
      try {
        if (fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").includes("src/server/main.ts")) process.kill(Number(pid), "SIGKILL");
      } catch {}
    }' || true
  for _ in $(seq 1 60); do
    after=$(docker inspect -f '{{.RestartCount}}' "$id")
    if [[ "$after" -gt "$before" ]] && curl -fsS --max-time 5 -o /dev/null "http://127.0.0.1:$APP_PORT/healthz"; then
      echo "✓ restart: the app came back after its server process stopped (restart count $after; memory limit $((limit / 1024 / 1024)) MiB)"
      return 0
    fi
    sleep 2
  done
  echo "✗ the app did not come back after its server process stopped (restart count $after)" >&2
  return 1
}
