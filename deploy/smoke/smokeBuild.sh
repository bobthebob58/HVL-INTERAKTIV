# smokeBuild.sh — the smoke test's build half: preflight, the content-type bundle, a builder of its own, the image
# build, and the stack's throwaway secrets. Sourced by ./dockerSmoke.sh, never run alone.
#
# Why:   the image is built with its own buildx builder, so the smoke can remove exactly its own build cache and no
#        other session's (D-110 P3 amendment, Disk), and the sandbox's extras are passed only behind
#        HVLI_DOCKER_SANDBOX=1 (D-110 P3 amendment, dockerd here).
# Spec:  NFR-007, MAPPE-004
# Tests: .github/workflows/docker.yml and a run here (D-110 amendment of 2026-11-05) run it through ./dockerSmoke.sh.
# SECURITY: the proxy CA goes only into a BuildKit secret and the builder's registry configuration, and the built image
#           is searched for it; the stack's keys and passwords are random, written only to a 0600 file in the smoke's
#           temporary folder, and never printed.

# moby/buildkit by digest: the builder's own BuildKit (the version the daemon here embeds).
BUILDKIT_IMAGE="moby/buildkit:v0.33.1@sha256:cec9f139f45e93c5c69c60f8b07cfad9f43f4ef6b6a6cd917527fea5ff2e3dea"

sandbox() { [[ "${HVLI_DOCKER_SANDBOX:-0}" == 1 ]]; }

disk() { echo "disk $1: $(df -h / | awk 'NR==2 {print $4 " free of " $2 " (" $5 " used)"}')"; }

preflight() {
  if ! docker info >/dev/null 2>&1; then
    echo "✗ Docker does not answer. Start dockerd first; in the development sandbox:" >&2
    echo "  setsid nohup dockerd --registry-mirror=https://mirror.gcr.io >dockerd.log 2>&1 &  (docs/ops/docker.md)" >&2
    return 1
  fi
  local tool
  for tool in node pdftotext pdffonts pdfinfo curl; do
    command -v "$tool" >/dev/null || { echo "✗ $tool is missing (poppler-utils, curl, Node 24)" >&2; return 1; }
  done
  docker buildx version >/dev/null && docker compose version >/dev/null
  if sandbox; then
    [[ -r "$PROXY_CA" ]] || { echo "✗ HVLI_DOCKER_SANDBOX=1 but the proxy CA $PROXY_CA is not readable" >&2; return 1; }
    [[ -x "$PW_BROWSERS/chromium-1194/chrome-linux/chrome" ]] ||
      { echo "✗ HVLI_DOCKER_SANDBOX=1 but $PW_BROWSERS has no chromium-1194" >&2; return 1; }
    docker info --format '{{.RegistryConfig.Mirrors}}' | grep -q mirror.gcr.io ||
      echo "! dockerd runs without --registry-mirror=https://mirror.gcr.io; Docker Hub may answer 429 here" >&2
  fi
  echo "docker $(docker version --format '{{.Server.Version}}'), $(docker compose version --short), sandbox extras: $(sandbox && echo on || echo off)"
}

make_bundle() {
  [[ -f "$CORE_DIR/core/js/h5p.js" && -d "$CORE_DIR/editor" ]] ||
    { echo "✗ no H5P core and editor in $CORE_DIR: run npm run h5p:fetch-core" >&2; return 1; }
  node "$ROOT/tools/h5p-bundle/bundleCli.mjs" build --from "$PACKAGES_DIR" --out "$WORK/h5p-bundle"
}

create_builder() {
  local config=()
  if sandbox; then
    # WHY: a BuildKit container resolves images itself, not through the daemon, so it needs the mirror and the
    # proxy's CA in its own configuration (D-110 amendment of 2026-11-05).
    cat >"$WORK/buildkitd.toml" <<EOF
[registry."docker.io"]
  mirrors = ["mirror.gcr.io"]
[registry."mirror.gcr.io"]
  ca = ["$PROXY_CA"]
[registry."registry-1.docker.io"]
  ca = ["$PROXY_CA"]
EOF
    config=(--buildkitd-config "$WORK/buildkitd.toml")
  fi
  docker buildx create --name "$BUILDER" --driver docker-container --driver-opt "image=$BUILDKIT_IMAGE" \
    "${config[@]}" --bootstrap >/dev/null
  echo "builder $BUILDER ($BUILDKIT_IMAGE)"
}

build_image() {
  local extra=()
  if sandbox; then
    extra=(--secret "id=proxy_ca,src=$PROXY_CA" --build-context "pwbrowsers=$PW_BROWSERS")
  fi
  if ! docker buildx build --builder "$BUILDER" --load --progress plain --target runtime \
    -f "$ROOT/deploy/Dockerfile" -t "$HVLI_IMAGE" \
    --build-context "h5pcore=$CORE_DIR" --build-context "h5pbundle=$WORK/h5p-bundle" "${extra[@]}" \
    "$ROOT" >"$WORK/build.log" 2>&1; then
    tail -n 80 "$WORK/build.log" >&2
    return 1
  fi
  grep -E '✓ |content-type bundle|v24\.' "$WORK/build.log" | sed 's/^/  build: /' | head -n 8 || true
  local size
  size=$(docker image inspect -f '{{.Size}}' "$HVLI_IMAGE")
  echo "image $HVLI_IMAGE: $((size / 1000000)) MB"
  if sandbox; then check_no_proxy_ca; fi
}

# SECURITY: the proxy CA was only a BuildKit secret; no file of the image may hold one of its own certificates.
# `docker history` shows instructions, not files, so every file is searched (./proxyCaLines.mjs picks the lines).
check_no_proxy_ca() {
  docker run --rm --network none --entrypoint node "$HVLI_IMAGE" -e \
    'process.stdout.write(require("tls").rootCertificates.join("\n"))' >"$WORK/image-roots.pem"
  node "$HERE/proxyCaLines.mjs" "$PROXY_CA" "$WORK/image-roots.pem" >"$WORK/proxy-ca.lines"
  [[ -s "$WORK/proxy-ca.lines" ]] || { echo "✗ found no certificate of the proxy's own to look for" >&2; return 1; }
  local hits
  hits=$(docker run --rm -i --network none --user 0 --entrypoint sh "$HVLI_IMAGE" -c \
    'cat >/dev/shm/lines && grep -rlsF -f /dev/shm/lines --exclude-dir=proc --exclude-dir=sys --exclude-dir=dev /' \
    <"$WORK/proxy-ca.lines" || true)
  [[ -z "$hits" ]] || { echo "✗ the proxy CA reached the image: $hits" >&2; return 1; }
  echo "✓ proxy CA: none of its own certificates is in any file of the image"
}

random_key() { head -c 32 /dev/urandom | base64 | tr -d '\n'; }

write_stack_env() {
  local year
  year=$(date +%Y)
  (
    umask 077
    cat >"$WORK/stack.env" <<EOF
HVLI_APP_PORT=$APP_PORT
HVLI_DB_PASSWORD=$(random_key | tr -dc 'A-Za-z0-9')
HVLI_S3_ACCESS_KEY_ID=smoke
HVLI_S3_SECRET_ACCESS_KEY=$(random_key | tr -dc 'A-Za-z0-9')
PSEUDONYM_SECRETS=$((year - 1))=$(random_key),$year=$(random_key)
IDENTITY_HASH_KEYS=smoke1=$(random_key)
DATA_ENCRYPTION_KEYS=smoke1=$(random_key)
URL_SIGNING_KEYS=smoke1=$(random_key)
FEIDE_CLIENT_ID=hvli-smoke
FEIDE_CLIENT_SECRET=$(random_key | tr -dc 'A-Za-z0-9')
EOF
  )
}
