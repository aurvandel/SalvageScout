# Browser-automation backup scraper for Facebook Marketplace

## Context

Apify is the primary scraper today and handles anti-bot measures for us. The
user wants a backup path in case Apify becomes unavailable, unaffordable, or
FB changes something Apify can't keep up with — a custom scraper they control
directly.

The original ask included automated Facebook account creation to replace
banned accounts. That specific piece was intentionally **descoped during
planning**: automated creation of accounts to evade platform bans is a step
beyond scraping past anti-bot measures (which Apify already does on the
user's behalf) — it's infrastructure whose purpose is enforcement evasion,
and building that wasn't something to do even at low, personal-use volume.
The user agreed to a narrower scope instead: **a single, manually-logged-in
FB account, with manual re-login if it ever gets banned.** No account
rotation, no auto-creation, no proxy farm.

On the underlying technical question — will FB ban the IP — at this
project's cadence (roughly once/day or less) IP-level blocking is the
smaller risk. Datacenter IPs get flagged fast regardless of frequency, but
this stack is self-hosted at the user's home (192.168.86.35), so egress is
almost certainly already a residential IP. The bigger risk is account-level
signals (fingerprint, session age, behavioral patterns), which is why this
plan leans on realistic pacing and a persistent, cookie-refreshing session
rather than a proxy.

This is a **backup**, not a replacement — it slots into the existing
pluggable scraper architecture as a third provider option, selected the same
way `apify` / `scrape_creators` are today.

## Existing architecture (confirmed against the code)

- Scrapers implement `ScraperBackend` — [base.py](backend/app/scraper/base.py#L8-L21):
  `__call__(db, search_filter, results_limit, config) -> list[dict[str, Any]]`.
  Each backend normalizes its own raw data internally; there's no separate
  raw-to-normalized boundary to hook into.
- Two backends exist: [apify_backend.py](backend/app/scraper/apify_backend.py),
  [scrape_creators_backend.py](backend/app/scraper/scrape_creators_backend.py).
- [registry.py](backend/app/scraper/registry.py#L8-L15) maps provider name →
  backend callable in `_SCRAPERS`, plus a `_SUPPORTS_URL_MODE` set for
  backends that can consume a raw pasted FB search URL (currently just
  `apify`) — confirmed by direct read, matches exactly.
- Selection is `config.scraper_provider` on the `AppSettings` singleton,
  settable via `PATCH /admin/settings/scraper` in [admin.py](backend/app/api/admin.py#L204-L216).
- Secrets on `AppSettings` are masked on GET (see `apify_token_masked` in
  [schemas/app_settings.py](backend/app/schemas/app_settings.py#L4-L59)).
- Vehicle spec extraction (year/make/model/mileage) has shared helpers in
  [parser.py](backend/app/scraper/parser.py) — reuse, don't reimplement.
- Scheduler → [service.py](backend/app/scraper/service.py#L11-L32)
  `run_scrape()`: `get_scraper(provider)` → call it → batch LLM query-match
  → optional Bright Data enrichment → `ingest_listings` (upsert by
  `fb_listing_id`, null-safe merge).
- `Notifier` ([notifier/registry.py](backend/app/notifier/registry.py),
  confirmed by read) is tightly coupled to `Listing`/`Score`/
  `compose_message` — [discord.py](backend/app/notifier/discord.py) shows
  `send()` takes a `Listing` and `Score` directly. A "session is dead" alert
  doesn't fit this shape and needs its own narrow path, not a fake listing
  shoehorned through it.
- No browser automation library exists in `requirements.txt` yet — new
  dependency, needs a Dockerfile change (system Chromium install).
- Docker constraint: host can't `-v` bind-mount into containers (DooD) —
  anything that needs to get into the running container goes through
  `docker cp` or an in-app upload/paste flow, not a mounted path.

## Key design decisions

1. **Session bootstrap: local Playwright script + pasted `storage_state`
   JSON**, not an in-container interactive browser. The backend container
   can't practically show the user a real browser window (remote Coder/iPad
   access, DooD constraints). Instead: a small standalone script the user
   runs **on their own machine** (not part of backend deps, lives under
   `scripts/`) launches real Chromium via Playwright, the user logs in by
   hand, the script confirms success and writes `context.storage_state()` to
   a local JSON file. The user pastes that into a new Admin UI field. Same
   script is reused verbatim for the post-ban re-login — no separate
   recovery tooling needed.
   Rejected: VNC-in-container (new long-running service, worse fit than the
   problem it solves), CDP-connect to the user's local Chrome over the
   network (exposes a debug port), manual devtools cookie copy-paste (misses
   `localStorage` FB's session relies on).

2. **Storage: raw `Text` column on `AppSettings`, not the `mask_secret`
   pattern.** A multi-KB JSON blob doesn't benefit from "show last 4 chars"
   masking — store it raw, never echo it back on GET, and expose a derived
   status object instead (`configured`, `status`, `updated_at`).

3. **`storage_state` is refreshed after every successful run, not just
   read once.** FB rotates session cookies; `browser_backend.py` writes
   `context.storage_state()` back to `AppSettings` at the end of a
   successful scrape, before closing the context. Without this the session
   would go stale far sooner than necessary.

4. **Ban/checkpoint detection raises, it doesn't return `[]`.** A typed
   `BrowserSessionInvalid` propagates out of the backend. Both real callers
   (`scheduler.py`'s per-filter loop, `admin.py`'s background trigger)
   already isolate a failing filter without crashing the pipeline. Returning
   `[]` instead would silently report a false "0 listings" success rather
   than a visible failure.

5. **A new, narrow system-alert path**, not the existing `Notifier`
   protocol (confirmed above it doesn't fit). Add
   `backend/app/notifier/system_alerts.py::send_system_alert(config, text)`
   posting directly to the configured webhook(s) via
   `enabled_channels(config)`, bypassing `compose_message`/`NotificationLog`
   entirely. Throttled via the persisted status column (decision 6) — only
   fires on the transition *into* `"invalid"`.

6. **Persist session status on `AppSettings`**: `browser_session_status`
   (`not_configured` / `active` / `invalid`) and
   `browser_session_updated_at`. Backs both the alert throttle and the
   admin Status tab.

7. **Registry key: `"browser"`**, not a vendor name — it's self-built, and
   the name shouldn't tie the config value to Playwright specifically.

8. **Reuse `url_builder.build_search_url()` as-is** — already
   provider-agnostic. `"browser"` joins `_SUPPORTS_URL_MODE` alongside
   `"apify"`.

9. **No env-var seeding for the session blob** — this is an inherently
   manual, paste-only bootstrap step; `settings_service.py`'s env-seeding
   stays untouched.

## Phased implementation

**Phase 0 — Spike (no app code merged).** Write the local helper script.
Run it against the real account. Confirm live what a Marketplace search
results page actually contains (embedded JSON vs. rendered DOM) and what a
single listing looks like in that structure — do not guess selectors ahead
of this. Save 2-3 anonymized fixture captures under
`backend/tests/fixtures/browser_scraper/`. This determines Phase 2's real
shape.

**Phase 1 — Schema, settings, admin API.**
- New Alembic revision adding `browser_session_state` (`Text`),
  `browser_session_status` (`String`, default `"not_configured"`),
  `browser_session_updated_at` (`DateTime`) to `app_settings`.
- [models/app_settings.py](backend/app/models/app_settings.py): add the
  three columns.
- [schemas/app_settings.py](backend/app/schemas/app_settings.py): add
  `BrowserSettingsOut { configured, status, updated_at }` and
  `BrowserSettingsIn { session_state }`; add `browser` field to
  `AppSettingsOut`.
- [api/admin.py](backend/app/api/admin.py): new
  `PATCH /admin/settings/browser-session` (mirrors the dedicated
  `/admin/settings/apify` endpoint — different shape from
  `/admin/settings/scraper`). Validates the paste parses as JSON with
  `cookies`/`origins` keys, rejects with 400 otherwise. On accept, sets
  status to `"active"` (re-arms the alert throttle). `system-status`
  endpoint gains a `"browser"` row built from `browser_session_status`
  directly (no live ping — there's nothing to ping for a session).

**Phase 2 — Backend module core.** New
`backend/app/scraper/browser_backend.py`:
- `fetch_listings(db, search_filter, results_limit, config)` — the
  `ScraperBackend` signature. Raises `BrowserSessionNotConfigured` if unset.
- `launch chromium (headless) → new_context(storage_state=..., viewport/UA
  from a small realistic pool) → page.goto(build_search_url(search_filter))`.
  Uses `new_context(storage_state=...)`, not `launch_persistent_context` —
  the session is a DB blob, not a host directory the container could
  bind-mount anyway.
- Human-like pacing: randomized delays, a few randomized scroll increments
  to trigger lazy-loaded results, up to `results_limit`.
- Extraction shape determined by Phase 0's findings.
- `normalize_listing_browser()` added to
  [normalize.py](backend/app/scraper/normalize.py), following the existing
  per-source precedent, using the shared `parser.py` helpers, producing the
  same key set every other backend produces.
- On success: write `context.storage_state()` back to `AppSettings`, commit,
  before returning. `try/finally` around browser lifetime.

**Phase 3 — Ban/checkpoint detection + alert.** Detector in
`browser_backend.py`: checked after navigation and after scrolling, looking
at final URL / page content for checkpoint/login-challenge patterns
(confirmed against Phase 0 fixtures, not hardcoded blind). On detection:
sets status to `"invalid"`, commits, calls `send_system_alert()` (only if
not already `"invalid"` — throttle), then re-raises so the run ingests
nothing and the failure is visible.
`backend/app/notifier/system_alerts.py::send_system_alert(config, text)`.

**Phase 4 — Registry, admin UI, status wiring.**
- [registry.py](backend/app/scraper/registry.py): add `"browser"` to
  `_SCRAPERS` and `_SUPPORTS_URL_MODE`.
- `frontend/src/pages/admin/ScraperTab.tsx`: `browser: 'Browser (backup)'`
  label; new section with a textarea to paste `storage_state` JSON, hitting
  the new endpoint, showing configured/status/updated_at; inline pointer to
  the local helper script.
- `frontend/src/pages/admin/StatusTab.tsx`: label for the new status row.
- `frontend/src/api/types.ts` / `client.ts`: matching types and client call.

**Phase 5 — Deploy.**
- `backend/requirements.txt`: add `playwright`.
- `backend/Dockerfile`: add `playwright install --with-deps chromium` after
  `pip install`. Expect a real image-size (+300-500MB) and build-time
  increase — accepted for a self-hosted, infrequently-rebuilt stack.
- `docker-compose.yml`: no change — `backend` and `scheduler` share the same
  Dockerfile, so one change covers both.

**Phase 6 — Live verification (manual).** Build the image, confirm Chromium
launches inside it (via a throwaway sibling container, per this project's
existing Docker-testing approach — the host can't reach the compose network
directly). Run the local helper script for real, paste the session, trigger
a manual scrape via the admin panel, confirm end-to-end ingestion.

## Testing

**Unit-testable (no live browser/FB):**
- `normalize_listing_browser()` against Phase 0's fixtures.
- Ban/checkpoint detector as a pure function against fixture pages/URLs.
- `send_system_alert()` with `httpx` mocked (`respx`, already a dev dep).
- Status/throttle transitions (`not_configured` → `active` → `invalid`,
  alert fires once per transition) against the `AppSettings` model.

**Manual/live only:** the actual login flow, a real scrape against live FB
(plus ongoing spot-checks, since FB's markup can drift without warning —
unlike Apify, nobody upstream absorbs that for us), and confirming Chromium
runs inside the built container image.

## Files touched, by phase

- **Phase 1:** new Alembic revision; `app/models/app_settings.py`;
  `app/schemas/app_settings.py`; `app/api/admin.py`.
- **Phase 2:** new `app/scraper/browser_backend.py`;
  `app/scraper/normalize.py`; new fixtures under
  `backend/tests/fixtures/browser_scraper/`.
- **Phase 3:** `app/scraper/browser_backend.py` (same file); new
  `app/notifier/system_alerts.py`.
- **Phase 4:** `app/scraper/registry.py`;
  `frontend/src/pages/admin/ScraperTab.tsx`;
  `frontend/src/pages/admin/StatusTab.tsx`; `frontend/src/api/types.ts`;
  `frontend/src/api/client.ts`.
- **Phase 5:** `backend/requirements.txt`; `backend/Dockerfile`.
- **Not in the app repo proper** (should still be versioned, e.g.
  `scripts/`): the local login/export helper script.

## Assumptions to confirm

- No proxy — home egress IP is assumed residential; add later if FB still
  flags the account.
- Headless Chromium in the container — modern "new" headless mode is harder
  to fingerprint than old headless, but whether it draws more scrutiny than
  headful on this specific account is unknown until tried.
- Page structure will drift over time — this is an accepted ongoing
  maintenance cost of a backup path, not a one-time build.
