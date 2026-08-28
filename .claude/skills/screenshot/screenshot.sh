#!/usr/bin/env bash
# Screenshot tool for SalvageScout's frontend.
#
# Why this exists: this dev environment is Docker-outside-of-Docker — the
# session's shell can't reach the compose stack's published ports or
# container IPs directly (confirmed empirically: curl to localhost:3000 and
# to the bridge-subnet IPs both fail). So the browser has to run *inside* a
# container on the same docker network as the `backend` service. It also
# screenshots the vite dev server (live source), not the prod `frontend`
# nginx container, which only ever serves whatever was last `docker compose
# build`-ed — screenshotting that would validate stale UI, not your change.
#
# Usage:
#   screenshot.sh run <path> <outfile.png> [waitForSelector]
#     One-shot: ensure the container exists, sync current frontend source
#     into it, (re)start the vite dev server, screenshot <path>, copy the
#     PNG to <outfile.png> on the host. <path> is a route like "/" or
#     "/listings/42". Run this from the worktree/checkout whose frontend
#     you want to see — it syncs from $(git rev-parse --show-toplevel)/frontend.
#
#   screenshot.sh teardown
#     Stop and remove the container. Disk on this host runs very tight
#     (was ~455MB free after initial setup) — tear down when done with a
#     screenshot session rather than leaving it running indefinitely.
#
# Requires: the docker-compose stack's `backend` + `db` services already
# running (docker-compose up), since the screenshot container proxies
# /api and /media to the `backend` service by container DNS name.

set -euo pipefail

CONTAINER=salvagescout-screenshot
IMAGE=node:22-slim

resolve_network() {
  docker inspect salvagescout-backend-1 --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null || true
}

ensure_container() {
  local network
  network="$(resolve_network)"
  if [ -z "$network" ]; then
    echo "ERROR: salvagescout-backend-1 is not running. Start the stack first (docker-compose up)." >&2
    exit 1
  fi

  if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
    echo "Creating $CONTAINER on network $network..."
    docker run -d --name "$CONTAINER" --network "$network" "$IMAGE" sleep infinity >/dev/null
  elif [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" != "true" ]; then
    docker start "$CONTAINER" >/dev/null
  fi

  if ! docker exec "$CONTAINER" test -d /tools/node_modules/playwright >/dev/null 2>&1; then
    echo "Installing playwright + chromium in container (one-time, ~300MB)..."
    docker exec "$CONTAINER" mkdir -p /tools
    docker exec -w /tools "$CONTAINER" npm init -y >/dev/null
    docker exec -w /tools "$CONTAINER" npm install playwright >/dev/null
    docker exec -w /tools "$CONTAINER" npx playwright install --with-deps chromium
  fi

  docker cp "$(dirname "${BASH_SOURCE[0]}")/driver.cjs" "$CONTAINER:/tools/driver.cjs"
}

sync_frontend() {
  local repo_root frontend_dir
  repo_root="$(git rev-parse --show-toplevel)"
  frontend_dir="$repo_root/frontend"
  echo "Syncing $frontend_dir into $CONTAINER:/app ..."
  docker exec "$CONTAINER" mkdir -p /app
  tar --exclude='node_modules' --exclude='dist' -C "$frontend_dir" -cf - . \
    | docker exec -i "$CONTAINER" tar -xf - -C /app
  docker exec -w /app "$CONTAINER" npm ci

  # Restart the dev server so it picks up the freshly synced source.
  docker exec "$CONTAINER" bash -c "pkill -f 'vite' 2>/dev/null || true"
  docker exec -d -w /app -e VITE_DEV_API_PROXY_TARGET=http://backend:8000 "$CONTAINER" \
    npm run dev -- --host 0.0.0.0 --port 5173

  echo "Waiting for vite dev server..."
  docker exec "$CONTAINER" node -e "
    (async () => {
      for (let i = 0; i < 30; i++) {
        try { const r = await fetch('http://localhost:5173/'); if (r.ok) { console.log('READY'); return; } }
        catch (e) {}
        await new Promise(r => setTimeout(r, 1000));
      }
      console.error('TIMEOUT waiting for vite dev server');
      process.exit(1);
    })();
  "
}

take_screenshot() {
  local path="$1" outfile="$2" selector="${3:-}"
  local url="http://localhost:5173${path}"
  local container_out=/tmp/screenshot-out.png
  docker exec "$CONTAINER" node /tools/driver.cjs "$url" "$container_out" "$selector"
  docker cp "$CONTAINER:$container_out" "$outfile"
  echo "Saved screenshot to $outfile"
}

case "${1:-}" in
  run)
    path="${2:-/}"
    outfile="${3:?usage: screenshot.sh run <path> <outfile.png> [waitForSelector]}"
    selector="${4:-}"
    ensure_container
    sync_frontend
    take_screenshot "$path" "$outfile" "$selector"
    ;;
  teardown)
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    echo "Removed $CONTAINER"
    ;;
  *)
    echo "usage: $0 run <path> <outfile.png> [waitForSelector]" >&2
    echo "       $0 teardown" >&2
    exit 1
    ;;
esac
