#!/usr/bin/env bash
# fetchCoreClients.sh — fetches the H5P core and editor client files into apps/server/h5p/{core,editor}.
#
# Why:   the server serves H5P's own JavaScript and CSS to every player and editor. The files are fetched
#        from H5P's repositories at a fixed tag or commit and verified file by file, instead of being
#        committed (D-027). Core comes from release tag 1.28.0; the editor has no 1.28 release, so it comes
#        from one reviewed commit (D-022).
# Spec:  H5P-001
# Tests: tools/h5p-core/test/verifyClientFiles.test.mjs (verification); CI runs this script and then the
#        boot check, which refuses to start on any other core version.
# SECURITY: a commit hash mismatch or any changed, missing or extra file aborts before anything is copied.
#
# Usage: fetchCoreClients.sh [--record-editor-hashes]
#   --record-editor-hashes  write the editor hash list when the pinned commit changes (review it, then commit it)
# Env:   H5P_DEST (default <repo>/apps/server/h5p)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REF="$ROOT/docs/reference/h5p-core-1.28-seed-packages"
DEST="${H5P_DEST:-$ROOT/apps/server/h5p}"
VERIFY="node $ROOT/tools/h5p-core/verifyClientFiles.mjs"

CORE_REPO="https://github.com/h5p/h5p-php-library.git"
CORE_TAG="1.28.0"
CORE_COMMIT="2aeb0b83fa603e331381b3a6b8bf42c3773ba140"
CORE_HASHES="$REF/h5p-php-library-1.28.0.files.sha256"

EDITOR_REPO="https://github.com/h5p/h5p-editor-php-library.git"
EDITOR_COMMIT="ab2daa18bd61b19e7f8729e22eec88f3b637a868"
EDITOR_HASHES="$REF/h5p-editor-php-library-ab2daa18.files.sha256"

editor_mode=verify
[[ "${1:-}" == "--record-editor-hashes" ]] && editor_mode=record

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# fetch_commit <repo> <ref> <expected-commit> <dir>: shallow fetch of one ref, then prove its commit hash.
fetch_commit() {
  git init --quiet "$4"
  git -C "$4" fetch --quiet --depth 1 "$1" "$2"
  git -C "$4" -c advice.detachedHead=false checkout --quiet FETCH_HEAD
  local actual
  actual="$(git -C "$4" rev-parse HEAD)"
  if [[ "$actual" != "$3" ]]; then
    echo "✗ $1 $2 resolved to $actual, expected $3" >&2
    exit 1
  fi
  rm -rf "$4/.git"
}

echo "Fetching H5P core $CORE_TAG ($CORE_COMMIT)…"
fetch_commit "$CORE_REPO" "refs/tags/$CORE_TAG" "$CORE_COMMIT" "$work/core"
$VERIFY verify "$work/core" "$CORE_HASHES" --prefix=h5p-php-library-1.28.0/

echo "Fetching H5P editor at pinned commit $EDITOR_COMMIT (D-022)…"
fetch_commit "$EDITOR_REPO" "$EDITOR_COMMIT" "$EDITOR_COMMIT" "$work/editor"
$VERIFY "$editor_mode" "$work/editor" "$EDITOR_HASHES" --prefix=h5p-editor-php-library-ab2daa18/

rm -rf "$DEST/core" "$DEST/editor"
mkdir -p "$DEST"
cp -R "$work/core" "$DEST/core"
cp -R "$work/editor" "$DEST/editor"
echo "✓ H5P core $CORE_TAG and editor ${EDITOR_COMMIT:0:8} are in $DEST"
