# Browser-automation backup scraper — implementation plan

Backup `ScraperBackend` for Facebook Marketplace, selectable via the existing
`scraper_provider` admin setting alongside `apify` / `scrape_creators`. Single
manually-logged-in FB account, low cadence (the existing daily scheduler run,
paced human-like *within* that run), no proxy, no auto account recovery —
detect a dead session and alert, nothing more.

## Assumptions to confirm with the user (not blockers, but should be said out loud)

- **No proxy planned.** Self-hosted at home (192.168.86.35), egress is almost
  certainly a residential IP already. If FB still flags the account, a proxy
  is a later addition, not part of this plan.
- **Headless Chromium in the container.** Modern Playwright's default
  "new" headless mode is harder to fingerprint than old headless, but whether
  it draws more scrutiny than a headful browser on this specific account is
  unknown until tried — Phase 0's spike should keep this in mind, not assume
  it's fine.
- **FB's ToS is being knowingly set aside** for this one account, same as any
  browser-automation scraper — not something this plan tries to mitigate
  beyond "look as human as reasonably possible."
- **Page structure will drift over time.** Unlike Apify, nobody upstream
  absorbs FB's markup/JSON changes — this is an accepted ongoing maintenance
  cost of a backup path, not a one-time build.

## Key design decisions

1. **Session bootstrap: local Playwright script + pasted `storage_state`
   JSON, not an in-container interactive browser.**
   Rejected alternatives: noVNC/VNC-in-a-container (new long-running service,
   worse fit for remote iPad/Coder access than the problem it solves);
   Playwright CDP connect to the user's own local Chrome over the network
   (means exposing a debugging port — a real security smell); manual
   devtools cookie copy-paste (misses `localStorage`/`sessionStorage` FB's
   session relies on, easy to get subtly wrong).
   Recommendation: a small standalone script the user runs **on their own
   machine** (not in Docker, not checked into backend deps) that launches a
   real Chromium via Playwright, lets the user log in by hand, confirms
   login succeeded, then writes `context.storage_state()` to a local JSON
   file. The user pastes that file's contents into a new Admin UI field.
   Same script is reused verbatim after a ban/checkpoint — no separate
   "recovery" tooling.
   This script does double duty for Phase 0 below: it's also the only place
   a real logged-in session exists, so it's the natural place to dump 1-2
   raw Marketplace pages for fixtures.

2. **Storage: raw `Text` column, not the `mask_secret` pattern.**
   `apify_token`'s masked-string approach (`"****" + secret[-4:]`) fits a
   short opaque credential; a multi-KB JSON blob doesn't benefit from it and
   showing a fake "last 4 chars" of a JSON blob on GET is noise, not
   security. Instead: store the raw blob in a `Text` column, never echo it
   back on GET, and expose a **derived status object** instead (configured
   bool, last-updated timestamp, last-known status). This is more honest
   about what "configured" even means for a session vs. a static key.

3. **`storage_state` gets refreshed after every successful run, not just
   read.** FB rotates session cookies; if the backend only ever reads what
   the user pasted once, the session goes stale far sooner than necessary.
   `browser_backend.py` writes `context.storage_state()` back to
   `AppSettings.browser_session_state` (+ `updated_at`) at the end of a
   successful scrape, before closing the context.

4. **Ban/checkpoint detection raises, it doesn't return `[]`.** A typed
   `BrowserSessionInvalid` exception propagates out of the backend. Both
   callers that matter already isolate a failing filter without crashing
   the pipeline: `scheduler.py:run_all_active_filters` (per-filter
   try/except + log) and `admin.py:_run_pipeline_background` (same
   pattern). Returning `[]` instead would be worse — it flows into
   `filter_listings_by_query`'s batch LLM call and reports a false "0
   listings" success instead of a visible failure. Confirmed by reading
   `backend/app/pipeline.py` (no exception handling of its own — it's a
   thin orchestrator) and both call sites above.

5. **System alert needs a new, narrower path — the existing `Notifier`
   protocol doesn't fit.** `Notifier.__call__(listing, score, config)` and
   `notify_if_above_threshold`'s dedup are both keyed on a scored `Listing`
   (`NotificationLog.listing_id`/`score_id` FKs) — there's no listing/score
   here, just "the session is dead." Add
   `backend/app/notifier/system_alerts.py::send_system_alert(config, text)`
   that posts directly to `config.discord_webhook_url` / Telegram using
   `enabled_channels(config)` from `notifier/registry.py` to know which
   channels are on, bypassing `compose_message`/`NotificationLog` entirely.
   Throttling: don't add a new table — reuse the persisted
   `browser_session_status` column (design #6) as the throttle. Only fire
   when status transitions *into* `"invalid"`; skip if it's already
   `"invalid"` from a prior run. Resets to alert-again-eligible the next
   time the user pastes a fresh session.

6. **Persist session status on `AppSettings`, don't just detect it
   transiently.** Add `browser_session_status` (`"not_configured"` /
   `"active"` / `"invalid"`) and `browser_session_updated_at`. This backs
   both the alert throttle (#5) and the Admin/Status UI, which otherwise
   would only ever reflect the truth immediately after a run.

7. **Registry name: `"browser"`, not `"playwright"`.** The two existing
   provider keys (`apify`, `scrape_creators`) happen to be vendor names, but
   there's no vendor here — it's self-built. `"browser"` names the
   capability ("the one you log into yourself"), reads clearly in the admin
   dropdown, and doesn't tie the config value to an implementation detail
   that might change later (e.g. if Playwright were ever swapped for
   something else).

8. **Reuse `url_builder.build_search_url()` as-is.** It's already
   provider-agnostic FB-URL construction (used today for Apify's
   `startUrls`), not Apify-specific. The browser backend calls the same
   function for both `location` and `url` search modes — this is also why
   `"browser"` belongs in `_SUPPORTS_URL_MODE`.

9. **No env-var seeding for the session blob.** `settings_service.py`'s
   first-read seeding from `env_settings` stays untouched — there's no
   sane env-var shape for a multi-KB JSON blob, and this is an inherently
   manual, paste-only bootstrap step regardless.

## Phased implementation order

### Phase 0 — Spike (no code merged into the app itself)
- Write the local helper script (see decision #1). Run it against the real
  account.
- Confirm, live: what a normal Marketplace search results page's HTML
  actually contains (embedded JSON blob vs. server-rendered DOM), and what a
  single listing's data looks like in that structure. **Do not guess
  selectors/JSON paths in this plan or in code before this step.**
- Save 2-3 anonymized fixture captures (search results page, single listing)
  into what will become `backend/tests/fixtures/browser_scraper/`.
- If a checkpoint/login-challenge page can be captured (e.g. from a prior
  incidental flag), save that too — otherwise note it's synthesized from the
  known redirect-URL pattern for now and revisit if the account ever
  actually gets flagged.
- Output of this phase: the fixtures, plus a short written note (in the PR
  description, not necessarily this plan) on where the data actually lives
  in the page. This determines Phase 2's real shape — treat everything
  below about "extraction" as provisional until this is done.

### Phase 1 — Schema, settings plumbing, admin API
- New Alembic revision (`backend/alembic/versions/`, following existing
  naming/style) adding to `app_settings`:
  - `browser_session_state: Text | None`
  - `browser_session_status: String, default "not_configured"`
  - `browser_session_updated_at: DateTime | None`
- `backend/app/models/app_settings.py`: add the three columns, mirroring the
  existing style/comments.
- `backend/app/schemas/app_settings.py`: add
  `BrowserSettingsOut { configured: bool, status: str, updated_at: datetime | None }`
  and `BrowserSettingsIn { session_state: str | None }`. Add a `browser:
  BrowserSettingsOut` field to the composite `AppSettingsOut`, alongside the
  existing `llm`/`apify`/`scraper`/`notifications`.
- `backend/app/api/admin.py`:
  - New `PATCH /admin/settings/browser-session` (mirrors the dedicated
    `/admin/settings/apify` endpoint, not folded into
    `/admin/settings/scraper`, since it's a different shape/semantics).
    Validates the pasted text parses as JSON with `cookies`/`origins` keys
    before accepting — reject with a clear 400 on a bad paste rather than
    letting it surface as a mysterious failure a day later. On accept, sets
    `browser_session_status = "active"` and clears any prior `"invalid"`
    (re-arms the alert throttle from decision #5).
  - `_settings_out()` (line ~114) gains the `browser` field.
  - `system-status` endpoint (line ~403): the existing `scraper_checks`
    list is `(provider, api_key, check_fn)` tuples that ping a real
    usage/balance endpoint — there's nothing to ping for a session (no API
    key, and triggering a real scrape just to render a status dot is the
    wrong tradeoff). Add a separate branch after that loop that appends one
    more `ScraperStatusOut` for `"browser"` built directly from
    `config.browser_session_status`/`configured`, mapped onto the existing
    `not_configured`/`connected`/`error` vocabulary (`active`→`connected`,
    `invalid`→`error`).
- Nothing wired into the registry yet — this phase only makes the setting
  storable and visible.

### Phase 2 — Backend module core (extraction + normalization)
- New `backend/app/scraper/browser_backend.py`:
  - `fetch_listings(db, search_filter, results_limit, config) ->
    list[dict[str, Any]]` — the `ScraperBackend` signature.
  - Guard: no `browser_session_state` configured → raise
    `BrowserSessionNotConfigured` (defined at the top of this file) with an
    actionable message pointing at the admin field.
  - `launch chromium (headless) -> new_context(storage_state=json.loads(...),
    viewport=<from a small realistic pool>, user_agent=<matching pool>) ->
    page.goto(build_search_url(search_filter))`.
    Uses `new_context(storage_state=...)`, not
    `launch_persistent_context(user_data_dir=...)` — the two are
    alternatives, and with the session stored as a DB blob (not a host
    directory the container can't bind-mount anyway, per the DooD
    constraint), `new_context` is the only one that fits.
  - Human-like pacing: randomized delays between actions, a few randomized
    scroll increments with pauses in between to trigger lazy-loaded
    results, up to `results_limit` or a sane max-scroll cap. Constants
    live at the top of the module (not admin-configurable in v1 — flag as a
    later nice-to-have, not now).
  - Extraction: shape determined by Phase 0's findings — likely parsing an
    embedded JSON blob out of the page rather than scraping rendered DOM,
    but this plan intentionally does not commit to selectors/paths.
  - Normalization: add `normalize_listing_browser(raw) -> dict` to
    `backend/app/scraper/normalize.py`, following the
    `normalize_listing_curious_coder` precedent for a differently-shaped
    source. Must call the existing shared helpers in
    `backend/app/scraper/parser.py` (`parse_vehicle_specs`,
    `parse_year_make_model`, `parse_mileage_from_text`) rather than
    reimplementing spec parsing, and must produce the same key set every
    other backend produces (`fb_listing_id`, `url`, `title`, ...,
    `raw_scraper_data`, `photo_urls`, `year`/`make`/`model`/`mileage`).
  - On success: write `context.storage_state()` back to
    `config.browser_session_state` / `browser_session_updated_at`, commit,
    before returning (decision #3).
  - `try/finally` around the browser/context lifetime so a mid-run
    exception (including the ban-detection raise in Phase 3) still closes
    cleanly.
- At this point the module is buildable and testable against Phase 0's
  fixtures, but not yet reachable from the app (no registry entry).

### Phase 3 — Ban/checkpoint detection + system alert
- Detection lives in `browser_backend.py` as a small pure-ish function
  taking the page's current URL/content and returning a reason string or
  `None` — checked right after navigation and again after scrolling.
  Heuristics (to be confirmed against Phase 0 fixtures / a real flag if one
  occurs, not hardcoded blind here): final URL containing
  `checkpoint`/`login`/`two_step_verification`/`recover`; expected
  marketplace content markers missing after a normal wait+retry.
  On detection: raise `BrowserSessionInvalid(reason)`.
- `fetch_listings` catches `BrowserSessionInvalid` internally (it already
  has `db`/`config` in scope), before re-raising: sets
  `config.browser_session_status = "invalid"`, commits, and calls
  `send_system_alert(config, ...)` from the new
  `backend/app/notifier/system_alerts.py` — but only if the status was not
  already `"invalid"` (throttle, decision #5). Then re-raises so the caller
  (pipeline/scheduler) still sees a clean failure and ingests nothing that
  run.
- `backend/app/notifier/system_alerts.py`: `send_system_alert(config,
  text)`, posting directly via `config.discord_webhook_url` /
  `config.telegram_bot_token`+`chat_id`, gated by `enabled_channels(config)`.
  No `NotificationLog` row — this isn't a per-listing notification.

### Phase 4 — Registry, admin UI, status wiring
- `backend/app/scraper/registry.py`:
  `_SCRAPERS["browser"] = browser_backend.fetch_listings`;
  `_SUPPORTS_URL_MODE.add("browser")` (set becomes `{"apify", "browser"}`).
  `get_available_scraper_providers()` and `supports_search_mode()` pick this
  up automatically — no change needed there.
- Frontend (`frontend/src/pages/admin/ScraperTab.tsx`):
  - `PROVIDER_LABELS` gains `browser: 'Browser (backup)'`.
  - New section: textarea to paste `storage_state` JSON + save button
    hitting the new `PATCH /admin/settings/browser-session`, displaying
    configured/status/updated_at from the response. Short inline note
    pointing at the local helper script for how to produce that JSON
    (initial login and post-ban re-login use the same instructions).
- `frontend/src/pages/admin/StatusTab.tsx`: `SCRAPER_LABELS` gains
  `browser: 'Browser (backup)'` so the new system-status row renders a
  label instead of the raw key.
- `frontend/src/api/types.ts` / `frontend/src/api/client.ts`: add
  `BrowserSettingsOut`/`In` types, `updateBrowserSettings()` client call,
  extend the `AppSettingsOut` type with `browser`.

### Phase 5 — Deploy changes
- `backend/requirements.txt`: add `playwright`.
- `backend/Dockerfile`: add a `playwright install --with-deps chromium`
  step after `pip install`. Note explicitly: this is a real image-size
  (+300-500MB class) and build-time increase (apt-installs system libs via
  `--with-deps`) — accepted cost for a self-hosted, infrequently-rebuilt
  stack, not something to optimize away here.
- `docker-compose.yml`: **no change needed.** Confirmed both `backend` and
  `scheduler` services build from `./backend` (same Dockerfile), so one
  Dockerfile change covers the container that actually runs scrapes
  (`scheduler`) as well as the API container.

### Phase 6 — Live verification (manual, not automatable)
- Build the updated image, confirm Chromium actually launches inside it
  (one throwaway-container sanity check, per the project's existing
  Docker-testing recipe — host can't reach the compose network directly).
- Run the local helper script for real, paste the session, trigger a manual
  scrape via the admin panel's existing trigger-search endpoint, confirm
  listings ingest correctly end-to-end.
- No automated CI test exercises a live FB login or a live scrape — that's
  inherent to this being a reverse-engineered, unofficial integration.

## Testing approach

**Unit-testable (no live browser, no live FB):**
- `normalize_listing_browser()` mapping logic against Phase 0's saved
  fixture JSON — same style as existing normalize tests.
- Ban/checkpoint detector as a pure function against saved fixture
  pages/URLs (a normal success page, a checkpoint-pattern page) — doesn't
  need a real Playwright browser to run, just string/URL matching.
- `send_system_alert()` with `httpx` mocked via `respx` (already a dev
  dependency), same pattern presumably used for `discord.py`/`telegram.py`.
- Status/throttle transition logic (`"not_configured"` →`"active"`→
  `"invalid"`, alert fires once per transition) as a plain unit test against
  the `AppSettings` model, no browser involved.

**Needs manual/live verification, not CI-automatable:**
- The actual login flow via the local helper script.
- A real scrape against live FB — and ongoing spot-checks over time, since
  FB's page structure can drift without warning (this is the standing
  maintenance cost noted at the top of this plan).
- The Docker image build + Chromium actually launching inside the
  container. Given the project's existing constraint that the host can't
  reach the compose network at all, any test that spins up a real browser
  (as opposed to the pure fixture-based tests above) needs to run inside a
  throwaway sibling container built from the updated backend image, not a
  bare Python container — most of the new tests avoid this cost by not
  needing a real browser at all.

## Files touched, by phase

**Phase 1:** new file under `backend/alembic/versions/`;
`backend/app/models/app_settings.py`;
`backend/app/schemas/app_settings.py`; `backend/app/api/admin.py`.

**Phase 2:** new `backend/app/scraper/browser_backend.py`;
`backend/app/scraper/normalize.py` (add
`normalize_listing_browser`); new fixtures under
`backend/tests/fixtures/browser_scraper/` (from Phase 0).

**Phase 3:** `backend/app/scraper/browser_backend.py` (detection +
exceptions, same file); new `backend/app/notifier/system_alerts.py`.

**Phase 4:** `backend/app/scraper/registry.py`;
`frontend/src/pages/admin/ScraperTab.tsx`;
`frontend/src/pages/admin/StatusTab.tsx`; `frontend/src/api/types.ts`;
`frontend/src/api/client.ts`.

**Phase 5:** `backend/requirements.txt`; `backend/Dockerfile`.

**Not part of the app repo proper (but should live somewhere versioned,
e.g. `scripts/`):** the local login/export helper script from decision #1 /
Phase 0.
