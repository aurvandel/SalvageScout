---
name: screenshot
description: Take a screenshot of the SalvageScout frontend for visual validation. Use when asked to screenshot the app, show what a UI change looks like, or visually verify a frontend change before calling it done.
type: interactive
---

# Screenshot Skill

There is no browser tool available directly to Claude Code in this
environment, and this session's shell can't reach the docker-compose
stack's published ports or container IPs (Docker-outside-of-Docker —
confirmed empirically: `curl localhost:3000` and `curl <bridge-ip>` both
fail from here). So screenshots are taken by a headless Chromium running
*inside* a container attached to the same docker network as the `backend`
service.

It screenshots the **vite dev server on live source**, not the prod
`frontend` nginx container — that container only serves whatever was last
`docker compose build`-ed, which would show stale UI, not your change.

## Prerequisites

The compose stack must be running (`docker-compose up`), specifically
`db` and `backend` — the screenshot container proxies `/api` and `/media`
requests to `backend` by its container DNS name.

## Usage

From the repo (or worktree) whose frontend you want to see:

```bash
.claude/skills/screenshot/screenshot.sh run <path> <outfile.png> [waitForSelector]
```

- `<path>` — a route, e.g. `/` or `/listings/42`.
- `<outfile.png>` — where to write the PNG on the host (e.g. into your
  scratchpad dir), then use the Read tool on it to actually look.
- `[waitForSelector]` — optional CSS selector to wait for before
  screenshotting (useful if content loads async).

Example:

```bash
.claude/skills/screenshot/screenshot.sh run /listings/42 /tmp/shot.png
```

`run` prints `TITLE`, a `BODY_TEXT_SNIPPET`, and any `CONSOLE_ERRORS` from
the page — check `CONSOLE_ERRORS` before trusting the screenshot; a page
can render its shell fine while every data fetch 500s.

`run` is idempotent to call repeatedly: it re-syncs the current frontend
source into the container and restarts the dev server each time, so it
always reflects your latest edits (including uncommitted changes in a
worktree).

When done, you can tear the container down to reclaim disk (it dipped to
~455MB free during first-time setup on this host before more was freed
up):

```bash
.claude/skills/screenshot/screenshot.sh teardown
```

## How it works

1. `ensure_container` — creates (if missing) a long-lived `node:22-slim`
   container named `salvagescout-screenshot`, attached to whatever docker
   network `salvagescout-backend-1` is on. Installs `playwright` +
   Chromium into it once (`npm install playwright` + `playwright install
   --with-deps chromium`, ~300MB — NOT the full `mcr.microsoft.com/playwright`
   image, which didn't fit in the disk budget here).
2. `sync_frontend` — `docker cp`s the frontend source in via a tar
   pipe (bind mounts don't work from this session — DooD paths resolve
   host-side, not against this session's filesystem), runs `npm ci`,
   and (re)starts `vite --host 0.0.0.0 --port 5173` with
   `VITE_DEV_API_PROXY_TARGET=http://backend:8000` so `/api` and `/media`
   proxy to the real backend over the compose network.
3. `take_screenshot` — runs `driver.cjs` (Playwright) inside the
   container against `http://localhost:5173<path>` (same container as
   the dev server, so plain `localhost` works), then `docker cp`s the
   resulting PNG back out to the host.

## Gotchas

- **`frontend/vite.config.ts` has a dev-only API proxy** added for this
  (`server.proxy` for `/api` and `/media`, target from
  `VITE_DEV_API_PROXY_TARGET`, defaulting to `http://localhost:8000` for
  normal local `npm run dev`). Without it, `npm run dev` can't reach the
  API at all — this was a pre-existing gap, not screenshot-specific.
- **No `curl` in `node:22-slim`.** Readiness polling uses Node's
  `fetch()`, not `curl`.
- **Disk is razor-thin on this host** (was 96% full before any of this
  was set up). The full `mcr.microsoft.com/playwright:*-jammy` image
  (~2-3GB, all three browsers) does not fit — that's why this uses a bare
  `node:22-slim` + chromium-only install instead. If disk pressure
  returns, `docker system df` / `docker builder prune` / removing stale
  `*-test` images are the first things to check.
