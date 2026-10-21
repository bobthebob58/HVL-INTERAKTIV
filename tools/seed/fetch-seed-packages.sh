#!/usr/bin/env bash
# fetch-seed-packages.sh
#
# What:  Downloads the ten HVL Interaktiv seed content-type packages (.h5p) from
#        the H5P Content Type Hub, checks them as DATA ONLY, and writes SHA256SUMS
#        into docs/reference/h5p-core-1.28-seed-packages/ (spec 01, H5P-003).
# Why:   H5P-003 needs verified, offline .h5p packages. This host could not reach
#        hub-api.h5p.org on 2026-10-21, so the script is written to be run later,
#        by a person, on a machine where the Hub is reachable.
# Spec:  H5P-003 (docs/specs/01-h5p-core128.md). Size limits mirror the upload limits of spec 01.
#        docs/reference/README.md row 6.
# Request shape (evidence in docs/reference/h5p-core-1.28-seed-packages/README.md):
#        GET https://hub-api.h5p.org/v1/content-types/<machineName>
#        No body and no site UUID. This is what @lumieducation/h5p-server 10.0.4
#        (ContentTypeInformationRepository.js:105) and the official PHP
#        editor (h5peditor-ajax.class.php:307 + :415, passing data=NULL, which
#        the H5P WordPress plugin sends as GET) both do.
# Tests: run with --dry-run (no network); Session 2 adds an automated test with fixture zips.
# SECURITY: Nothing downloaded is executed, sourced, or unpacked to disk. The
#        script only reads the zip listing and prints library.json to stdout,
#        then parses that JSON. Only https is allowed, also for redirects.
#
# Usage: fetch-seed-packages.sh [--dest DIR] [--replace] [--dry-run]
#   --dest DIR   target folder (default: <repo root>/docs/reference/h5p-core-1.28-seed-packages)
#   --replace    delete existing *.h5p and SHA256SUMS in DIR first (default: refuse)
#   --dry-run    print the plan and URLs, contact no host, write nothing
# Env:   H5P_HUB_CONTENT_TYPES_ENDPOINT (default https://hub-api.h5p.org/v1/content-types/)
#        H5P_HUB_METHOD=GET|POST (default GET; POST = empty-body POST, as Catharsis does)
#        MAX_PACKAGE_BYTES (default 209715200 = 200 MB, SEC-005 maxTotalSize)
set -euo pipefail

readonly HUB="${H5P_HUB_CONTENT_TYPES_ENDPOINT:-https://hub-api.h5p.org/v1/content-types/}"
readonly METHOD="${H5P_HUB_METHOD:-GET}"
readonly MAX_BYTES="${MAX_PACKAGE_BYTES:-209715200}"
readonly CORE_MAJOR=1 CORE_MINOR=28

# machineName  minMajor  minMinor   (spec 01 §3; DragQuestion is deliberately absent)
readonly TYPES=(
  "H5P.CoursePresentation 1 27"
  "H5P.InteractiveVideo 1 28"
  "H5P.QuestionSet 1 21"
  "H5P.InteractiveBook 1 12"
  "H5P.Column 1 19"
  "H5P.DragText 1 10"
  "H5P.MultiChoice 1 16"
  "H5P.Blanks 1 14"
  "H5P.ImageHotspots 1 10"
  "H5P.BranchingScenario 1 9"
)

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '%s\n' "$*" >&2; }

DEST="" REPLACE=0 DRY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dest) [[ $# -ge 2 ]] || die "--dest needs a value"; DEST="$2"; shift 2 ;;
    --replace) REPLACE=1; shift ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) sed -n '2,32p' "$0"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done
if [[ -z "$DEST" ]]; then
  root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  DEST="$root/docs/reference/h5p-core-1.28-seed-packages"
fi
[[ "$HUB" == https://* ]] || die "Hub endpoint must be https: $HUB"
[[ "$HUB" == */ ]] || die "Hub endpoint must end with '/': $HUB"
hub_host="${HUB#https://}"; hub_host="${hub_host%%/*}"
[[ "$hub_host" != "api.h5p.org" ]] || die "api.h5p.org is the retired Hub (CLAUDE.md invariant)"
[[ "$METHOD" == GET || "$METHOD" == POST ]] || die "H5P_HUB_METHOD must be GET or POST"

if [[ $DRY -eq 1 ]]; then
  log "Dry run. Destination would be: $DEST"
  for entry in "${TYPES[@]}"; do
    read -r name maj min <<<"$entry"
    printf '%s %s%s  (minimum %s.%s)\n' "$METHOD" "$HUB" "$name" "$maj" "$min"
  done
  exit 0
fi

for tool in curl unzip; do command -v "$tool" >/dev/null || die "missing tool: $tool"; done
if command -v sha256sum >/dev/null; then SHA=(sha256sum); elif command -v shasum >/dev/null; then SHA=(shasum -a 256); else die "missing sha256sum/shasum"; fi
if command -v node >/dev/null; then JSON=node; elif command -v python3 >/dev/null; then JSON=python3; else die "need node or python3 to read library.json"; fi

# Prints "machineName major minor patch coreMajor coreMinor" from library.json on stdin.
read_library_json() {
  if [[ $JSON == node ]]; then
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const c=j.coreApi||{};console.log([j.machineName,j.majorVersion,j.minorVersion,j.patchVersion,c.majorVersion??0,c.minorVersion??0].join(" "))})'
  else
    python3 -I -c 'import json,sys;j=json.load(sys.stdin);c=j.get("coreApi") or {};print(j["machineName"],j["majorVersion"],j["minorVersion"],j["patchVersion"],c.get("majorVersion",0),c.get("minorVersion",0))'
  fi
}

mkdir -p "$DEST"
shopt -s nullglob
existing=("$DEST"/*.h5p)
if [[ ${#existing[@]} -gt 0 ]]; then
  [[ $REPLACE -eq 1 ]] || die "$DEST already has .h5p files; re-run with --replace to start over"
  rm -f -- "$DEST"/*.h5p "$DEST/SHA256SUMS" "$DEST/SOURCES.tsv"
fi
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/hvl-seed.XXXXXX")"
trap 'rm -rf -- "$STAGE"' EXIT
printf 'machineName\tversion\tcoreApi\turl\tmethod\thttp\tretrieved_utc\tsha256\n' >"$STAGE/SOURCES.tsv"

for entry in "${TYPES[@]}"; do
  read -r name min_major min_minor <<<"$entry"
  url="${HUB}${name}"
  part="$STAGE/$name.part"
  log "Fetching $name ($METHOD $url)"
  curl_args=(--silent --show-error --location --proto '=https' --proto-redir '=https' --tlsv1.2
             --max-time 900 --retry 2 --max-filesize "$MAX_BYTES" -o "$part" -w '%{http_code}')
  if [[ $METHOD == POST ]]; then curl_args+=(-X POST --data ''); fi
  code="$(curl "${curl_args[@]}" "$url")" || die "$name: curl failed (proxy/firewall? exit $?)"
  [[ "$code" =~ ^2[0-9][0-9]$ ]] || die "$name: HTTP $code from $url (try H5P_HUB_METHOD=POST if 405)"
  bytes="$(wc -c <"$part" | tr -d ' ')"
  [[ "$bytes" -gt 0 && "$bytes" -le "$MAX_BYTES" ]] || die "$name: bad size $bytes"
  [[ "$(head -c 4 "$part" | od -An -tx1 | tr -d ' \n')" == 504b0304 ]] || die "$name: not a zip (magic bytes)"
  listing="$(unzip -Z1 "$part")" || die "$name: unreadable zip"
  # SEC-005: no absolute paths, no '..' components, no backslashes.
  if grep -qE '(^/|(^|/)\.\.(/|$)|\\)' <<<"$listing"; then die "$name: unsafe path in zip"; fi
  total="$(unzip -Zt "$part" | sed -nE 's/.* ([0-9]+) bytes uncompressed.*/\1/p')"
  [[ -n "$total" && "$total" -le "$MAX_BYTES" ]] || die "$name: uncompressed size ${total:-?} > $MAX_BYTES"
  libjson="$(grep -E "^${name//./\\.}-[0-9]+\.[0-9]+/library\.json$" <<<"$listing" | sort -V | tail -n 1)" \
    || die "$name: no $name-<major>.<minor>/library.json in package"
  meta="$(unzip -p "$part" "$libjson" | read_library_json)" || die "$name: cannot parse $libjson"
  read -r got maj min pat cmaj cmin <<<"$meta"
  [[ "$got" == "$name" ]] || die "$name: library.json names '$got'"
  for v in "$maj" "$min" "$pat" "$cmaj" "$cmin"; do [[ "$v" =~ ^[0-9]+$ ]] || die "$name: bad version field '$v'"; done
  if (( maj < min_major || (maj == min_major && min < min_minor) )); then
    die "$name: got $maj.$min.$pat, below minimum $min_major.$min_minor"
  fi
  if (( cmaj > CORE_MAJOR || (cmaj == CORE_MAJOR && cmin > CORE_MINOR) )); then
    die "$name: needs core API $cmaj.$cmin, newer than $CORE_MAJOR.$CORE_MINOR"
  fi
  final="$name-$maj.$min.$pat.h5p"
  mv -- "$part" "$STAGE/$final"
  sum="$("${SHA[@]}" "$STAGE/$final" | cut -d' ' -f1)"
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$name" "$maj.$min.$pat" "$cmaj.$cmin" "$url" "$METHOD" "$code" \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$sum" >>"$STAGE/SOURCES.tsv"
  log "  ok: $final ($bytes bytes, core API $cmaj.$cmin)"
done

mv -- "$STAGE"/*.h5p "$DEST"/
mv -- "$STAGE/SOURCES.tsv" "$DEST/SOURCES.tsv"
( cd "$DEST" && "${SHA[@]}" -- *.h5p >SHA256SUMS )
log "Wrote $DEST/SHA256SUMS and $DEST/SOURCES.tsv. Record provenance in docs/reference/README.md."
