# SalvageScout — Architecture & Build Plan

## Context

SalvageScout is greenfield — the repo currently has only `README.md`, `LICENSE`, `CLAUDE.md`, and `PROJECT_CONTEXT.md`; no code exists yet. `PROJECT_CONTEXT.md` already commits to several decisions (Apify for scraping — originally `parseforge/facebook-marketplace-scraper`, since replaced with the official actor per the spike below — Python backend, Postgres-family DB, an LLM scoring engine with a specific JSON output shape, Discord/Telegram alerts, and a React-ish web app with an admin panel). This plan turns those decisions into a concrete stack, data model, and build order, resolves the open "DB choice" question, and flags gaps the existing docs don't cover — per the user's ask to point out what's obviously missing.

Deployment answer from the user: Docker Compose everywhere — developed on this Coder box, production runs Compose on a separate on-prem server. No cloud hosting. Notifications: both Discord and Telegram from the start. Access: no auth for MVP (private network only).

## Stack Decision

- **Backend:** Python + **FastAPI** — async, and its Pydantic models map directly onto the structured LLM JSON output (`match_score`, `summary`, `pros`, `cons`, `dealbreaker_flags`), so the same schema validates both the API responses and the LLM's structured output.
- **Database: PostgreSQL**, self-hosted via the official `postgres` Docker image (not Supabase — that's a cloud product and prod is on-prem). This is the answer to the Postgres-vs-Mongo question:
  - The data is fundamentally relational (listings → scores → notifications → search filters → prompt versions), and you need joins/aggregates like "top-scoring active listings under my active criteria profile."
  - Postgres's `JSONB` columns absorb the semi-structured parts (raw Apify payload, LLM `pros`/`cons`/`dealbreaker_flags` arrays) without giving up relational integrity elsewhere — you don't have to choose between "structured" and "flexible."
  - Mongo would buy nothing here and would cost you joins for the parts of the schema that are genuinely relational.
- **Frontend:** React + Vite + TypeScript, served by nginx in its own container (static build), calling the FastAPI backend over REST.
- **LLM:** Multi-provider by design, not locked to Anthropic. The scorer module sits behind a provider-agnostic interface (one `score_listing(listing) -> ScoreResult` function per provider, same Pydantic output schema) so Claude, OpenAI, and Gemini implementations are interchangeable via config, not a rewrite. Build the Claude implementation first (`claude-haiku-4-5` via the `anthropic` SDK) since it unblocks the rest of the pipeline; add OpenAI (`gpt-5-nano`/`gpt-5-mini`) and Gemini (`gemini-3-flash-lite`) implementations later for a head-to-head quality spike — see "Open Items" below. At this volume (~200 listings once, ~15/day after — ~450/month) the cost delta between all of these is under $1.50/month regardless of which wins, so the spike is about scoring *quality* (consistency of `match_score`, usefulness of `pros`/`cons`, reliability of `dealbreaker_flags`), not cost. Every provider's call uses that provider's structured-output mechanism against the same Pydantic schema so responses are validated automatically instead of hand-parsed. `year`/`make`/`model`/`mileage` are parsed at ingest time by regex (see Data Model below), not by the LLM — the scorer only fills gaps regex misses, and that logic is provider-independent.
- **Scraper actor: `apify/facebook-marketplace-scraper`** (official, first-party) — confirmed via a live spike, **not** `parseforge/facebook-marketplace-scraper` as originally noted in `PROJECT_CONTEXT.md`. The spike found:
  - `parseforge`'s actor charges for "listing-enrichment" ($0.051/item total across its three events) but silently falls back to search-only data with no `description` field when Facebook requires a login it has no way to accept — a real $0.51 charge for 10 items that delivered no enrichment. Its neither has a cookie/session input field, by design ("reads public Marketplace feeds without requiring a login").
  - `apify/facebook-marketplace-scraper` returns full `description.text`, all listing photos, and lat/long location with `includeListingDetails: true`, needs no login, and is cheaper (~$0.0124/item max at listed rates; the spike run was billed $0.00, which should be treated as a possible free-tier/quota quirk, not assumed to hold at volume).
  - Its input is a real Facebook Marketplace search URL (e.g. `https://www.facebook.com/marketplace/newyork/search/?query=sedan`), not a city+keyword pair — FB's own URL query params (price range, radius, days-listed, condition) can be appended for server-side filtering, which the originally-planned actor did not support at all.
  - Trade-off: it has no structured `vehicleMake`/`vehicleModel`/`vehicleYear`/`vehicleMileage` fields — year/make/model appear only in the listing title (e.g. `"2003 Ford Crown Victoria · LX Sedan 4D"`) and mileage in a subtitle (e.g. `"215K miles"`). These get parsed out by the scorer's LLM call rather than arriving as structured Apify fields.
- **Scheduler:** a small dedicated `scheduler` service in Compose (APScheduler or plain cron) that triggers the scrape→score→notify pipeline daily, plus a manual "run now" endpoint on the API for on-demand runs from the admin panel.

## Repo / Service Layout

```
/backend
  /app
    /api          # FastAPI routers: listings, scores, criteria, filters, notifications, admin
    /scraper       # Apify client + normalization
    /scorer        # provider-agnostic interface + prompt templates + structured-output schema;
                   #   anthropic.py, openai.py, gemini.py implementations behind it
    /notifier      # notifier interface + discord.py, telegram.py
    /models        # SQLAlchemy models
    /schemas       # Pydantic schemas (shared with LLM structured output)
  /alembic          # migrations
/frontend           # React + Vite app (listing feed, detail view, admin panel)
docker-compose.yml          # dev (this Coder box)
docker-compose.prod.yml     # overrides for the on-prem server
.env.example
```

## Data Model (Postgres)

- `search_filters` — id, name, search_url (the real Facebook Marketplace search URL, e.g. `.../marketplace/newyork/search/?query=sedan&minPrice=...`), is_active
- `listings` — id, fb_listing_id (unique, Apify's `id`), url (`itemUrl`), title (`listingTitle`), description, price_amount (numeric(10,2), from `listingPrice.amount`), currency, strikethrough_price_amount (nullable), condition, is_live, is_pending, is_sold (Apify's actual field names — not `isAvailable`), location_text, latitude, longitude, postal_code, posted_at (Apify's `timestamp` — when the listing went up on FB, distinct from `first_seen_at` below), year, make, model, mileage (last four nullable, parsed at ingest time by regex from `listingTitle`/`customTitle` and the `customSubTitlesWithRenderingFlags` mileage subtitle — not by the LLM; the scorer only fills gaps regex misses, so a prompt edit can never silently change a stored vehicle spec), raw_apify_data (JSONB, source of truth), first_seen_at, last_seen_at
- `listing_images` — id, listing_id FK, local_path, position — the new actor's photo URLs still carry an `oe=` expiry param (signed FB CDN URLs), so the original "download at ingest, don't hot-link" plan still applies regardless of actor.
- `criteria_profiles` — id, name, prompt_text, weights (JSONB), version, is_active, created_at (admin-editable, versioned so old scores stay interpretable)
- `scores` — id, listing_id FK, criteria_profile_id FK, match_score, summary, pros (JSONB), cons (JSONB), dealbreaker_flags (JSONB), model_used, created_at
- `notifications_log` — id, listing_id FK, score_id FK, channel (discord/telegram), sent_at, status

Treat `raw_apify_data` as the source of truth and every normalized column as derived from it — see "Build order" below on why the schema itself is provisional until the first real Apify pull.

## Pipeline Flow

1. Scheduler (daily cron + manual trigger) invokes the scraper for each active `search_filters` row (its `search_url`, passed as `startUrls` to the actor).
2. Scraper calls the `apify/facebook-marketplace-scraper` actor with `includeListingDetails: true`, gets raw listings back (title, description, price, photos, location, status flags — no login needed).
3. Processor dedupes by `fb_listing_id`, upserts `listings`, downloads listing images to the volume immediately (same run — FB CDN image URLs are signed/expiring, so caching the URL for later is not sufficient).
4. Scorer sends new/changed listings + the active `criteria_profile.prompt_text` to Claude (structured output), which returns both the score fields and the parsed `year`/`make`/`model`/`mileage`; the latter get written back onto `listings`.
5. Notifier checks `match_score` against the configured threshold; if above threshold and not already logged in `notifications_log` for this listing, sends to Discord and Telegram via a generic `Notifier` interface (one implementation per channel).
6. Frontend reads from the FastAPI backend: listing feed sorted by score, listing detail, and an admin section to edit `criteria_profiles`, `search_filters`, and notification settings.

## Deployment & Access

- Two Compose files: `docker-compose.yml` for local/dev on this box, `docker-compose.prod.yml` as an override for the on-prem server (volumes, restart policies, resource limits).
- Secrets via `.env` (gitignored), `.env.example` checked in with placeholder keys: `APIFY_TOKEN`, `ANTHROPIC_API_KEY`, `DATABASE_URL`, `DISCORD_WEBHOOK_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
- No auth for MVP, per your answer — but the admin panel can trigger paid actions (Apify runs, Claude calls). The mitigation is entirely deployment-side: don't publish the app's port past the LAN/reverse proxy on the on-prem box. Don't build an auth system for this — it wasn't asked for and isn't needed if the port stays private.

## Open Items / Gaps Not Covered by the Existing Docs

1. ~~Apify spike~~ — **done**, including follow-up verification. Ran both the originally-planned actor and the official one live (see Stack Decision above); switched to `apify/facebook-marketplace-scraper`. Confirmed live:
   - City targeting works: a `la`/`sedan` pull returned 5/5 Los Angeles, CA listings. The earlier `newyork`/`sedan` pull landing entirely in North Carolina was most likely Facebook's own local-search radius auto-expanding when too few nearby matches exist — not a broken filter — but a narrow real-world filter (specific make/price range) can trigger the same expansion, so spot-check once real `search_filters` are defined.
   - Repeat-pull dedup risk is lower than feared: two consecutive identical `newyork`/`sedan` pulls (5 items each) had **zero** ID overlap. Re-verify at production result-set size, but this is a good early signal against the "you pay per item returned, not per new item" cost risk.
   - Direct listing URLs work in `startUrls` (`.../marketplace/item/<id>/`) — confirmed via a live pull. This enables a two-phase ingest: a cheap list-only pass (`includeListingDetails: false`, $0.0062/item) to discover IDs, anti-joined against existing `listings.fb_listing_id`, then a detail-fetch (`includeListingDetails: true`) only for the new ones. Worth doing once volume grows past what a single detailed pull can absorb in budget.
   - Cost: every spike run (7 total) was billed **$0.00** despite the documented rate being ~$0.0062–0.0124/item — treat this as a free-tier/quota quirk to re-verify once real production volume hits, not a permanent $0 rate.
2. **Relists break the dedup key.** Marketplace sellers relist the same car under a new listing ID constantly. `fb_listing_id UNIQUE` only catches the exact-same-listing case. Decide a soft-dedupe policy (e.g. normalized title + price + location/seller) before this silently produces duplicate cards and duplicate alerts.
3. **Prompt-edit re-score policy.** `criteria_profiles` versioning (above) covers *storage*, but not the trigger: during development you'll tweak the prompt repeatedly. If editing a prompt automatically re-scores all ~200 stored listings, that's where LLM spend actually goes (still cheap in absolute terms on Haiku, but avoidable). Make re-scoring an explicit, manual, targeted action — never a side effect of saving a prompt.
4. **Stale/removed listings.** Partially resolved by the actor switch — it returns `isLive`/`isSold`/`isPending` directly per listing, so `listings.is_available`/`is_pending`/`is_sold` can be kept in sync on every re-scrape without a separate diff step. Still decide: a listing that simply stops appearing in a fresh pull (removed by seller, not marked sold) won't get an updated status at all — decide whether `last_seen_at` aging past some threshold should also flip it to `removed`.
5. **Backups.** A single on-prem Postgres container is a single point of failure for all scoring history. A simple `pg_dump` cron to another disk/location is worth having even for a one-user project.
6. **LLM output isn't guaranteed well-formed** even with structured outputs — build a validation/retry path in the scorer rather than assuming the first response always parses.
7. **Basic observability.** Since the whole point is "real-time notifications," you also want to know when the *pipeline itself* breaks (Apify run failed, Claude call errored) — log failures somewhere visible (even just a `pipeline_runs` table with status + error, surfaced in the admin panel) rather than failing silently.
8. **CI.** None exists yet; even a minimal GitHub Actions job (lint + backend tests) is worth adding once there's code to check, especially since most implementation will be AI-assisted.
9. **LLM provider comparison spike.** Once the Claude scorer implementation is working end-to-end, add OpenAI (`gpt-5-nano`, `gpt-5-mini`) and Gemini (`gemini-3-flash-lite`) implementations and run the same batch of real listings through all three. Compare `match_score` consistency, `pros`/`cons` usefulness, and `dealbreaker_flags` reliability — not cost, since the gap between providers is under $1.50/month at this volume. Pick the default provider from that evidence, keep the others available behind the same interface via config.

## Build Order

1. ~~Apify spike~~ — done.
2. ~~Postgres schema + Alembic migrations~~ — done. SQLAlchemy models in `backend/app/models/`, initial migration in `backend/alembic/versions/`, verified against a real local Postgres instance (apply, inspect, downgrade, re-apply all confirmed clean).
3. FastAPI backend: ~~scraper module + processor/dedupe~~ done (`backend/app/scraper/` — Apify wrapper, regex vehicle-spec parser, image downloader, upsert/dedupe by `fb_listing_id`, verified end-to-end against a real local Postgres using the spike data) → ~~scorer module~~ done (`backend/app/scorer/` — provider-agnostic `Scorer` protocol + registry, Claude implementation on `claude-haiku-4-5` via `messages.parse()`/structured outputs, verified with a real live call) → ~~notifier module~~ done (`backend/app/notifier/` — same protocol+registry pattern, Discord webhook + Telegram bot implementations, dedup by listing+channel against `notifications_log` so a re-score never double-alerts, per-channel failure isolation so one bad channel doesn't block the other, verified with real live sends to both) → ~~API routes~~ done (`backend/app/api/` — `listings` read endpoints sorted by best score via a subquery, `search-filters` and `criteria-profiles` CRUD, `pipeline` manual-trigger endpoint; `app/pipeline.py` holds the reusable scrape→score→notify orchestration so the future scheduler can call the same code path instead of duplicating it; skips scoring listings already scored under the active criteria profile so a daily re-scrape doesn't re-spend LLM calls on unchanged listings).
   - Full test suite: 90 tests in `backend/tests/` (pytest + a real local Postgres test DB `salvagescout_test`, `respx` for HTTP mocking, `unittest.mock`/`pytest-mock` for the Apify/Anthropic SDKs, FastAPI `TestClient` wired to the same rolled-back-per-test DB session for API tests). Run with `cd backend && ../.venv/bin/pytest`.
   - **Real bug found via live verification, not caught by mocked tests:** ran the full pipeline through the actual HTTP API against real Apify/Anthropic/Discord/Telegram — one of two real listings triggered a genuine Discord delivery failure. Cause: the composed notification message (LLM summary + pros/cons) was 2047 characters, over Discord's 2000-char webhook `content` limit (Telegram's 4096 limit absorbed it fine, which is why only one channel failed). Fixed with `truncate_for_limit()` in `notifier/base.py`, applied per-channel with each platform's real limit, always preserving the listing URL at the end even when the body is cut. Also added logging on notification failures — the failure was previously silent (just `status="failed"` in `notifications_log` with no reason recorded), which cost a debugging round-trip to diagnose.
   - Fixed a real bug found along the way: `.env`'s `DATABASE_URL` used the bare `postgresql://` scheme, which defaults to `psycopg2` — not installed (the project uses `psycopg[binary]`, i.e. psycopg3). Both `.env` and `.env.example` now use `postgresql+psycopg://`. This would have broken the app in Docker Compose too, not just locally.
4. ~~Docker Compose (dev)~~ done, but **build/run itself is unverified** — see note below. `docker-compose.yml` wires `db` (Postgres 16), `backend` (FastAPI + `--reload`, migrations run automatically via `entrypoint.sh`), and `scheduler` (APScheduler, daily 06:00 UTC run across all active `search_filters`, calling the same `app/pipeline.py` orchestration the API uses — `RUN_MIGRATIONS=false` on this service so it doesn't race `backend` on `alembic upgrade head`). Added a `/health` endpoint for the backend healthcheck the scheduler's `depends_on: condition: service_healthy` relies on.
   - **This sandbox cannot run Docker**: the daemon fails to start (`iptables --wait -t nat -N DOCKER: ... Permission denied`) — no NAT chain capability in this nested container. This was hit and confirmed twice, and a reconfiguration workaround (`iptables: false` in daemon.json + restart) was correctly blocked by the auto-mode classifier as a system-level change, so it was not attempted further.
   - What *was* verified: `docker compose config` fully resolves the file (services, healthchecks, volumes, networks all structurally valid) and `entrypoint.sh` passes a shell syntax check. What was **not** verified: that the image actually builds, that `alembic upgrade head` runs correctly inside the container, that the healthcheck passes, or that the scheduler starts and imports cleanly in the container environment.
   - **Action needed from you**: run `docker compose up --build` on a machine with a working Docker daemon (this Coder box's daemon is broken the same way, so it likely needs to be your on-prem server or another machine) and confirm the backend comes up healthy and `GET /health` responds. Report back anything that fails — first-run container issues (missing system packages for `psycopg[binary]`, etc.) are the most likely failure mode for an unverified Dockerfile.
5. LLM provider comparison spike (gap #9) — add OpenAI/Gemini scorer implementations, compare against Claude, pick the default.
6. React frontend: listing feed + detail view, then admin panel (criteria/filters/notifications).
7. `docker-compose.prod.yml` override and deploy to the on-prem server.

## Verification

- Backend: `pytest` for scorer JSON-schema validation/retry logic and dedupe logic; manually trigger the pipeline end-to-end against real Apify + Claude calls for one filter and confirm a listing flows through to a Discord/Telegram alert.
- Frontend: `npm run dev`, confirm the listing feed renders real scored listings and the admin panel can edit a criteria profile and a search filter.
- Full stack: `docker compose up` on this box reproduces the same result before trying the on-prem override.
