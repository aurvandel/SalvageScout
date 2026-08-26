# Add Bright Data and ScrapeCreators as Pluggable Scraper Backends

## Context

Apify's free tier is capped at $5/month; going higher requires the $49/month Starter plan (the user recalled ~$30 — worth reconciling against that actual quote, but Apify's own pricing page lists Starter at $49/mo). That's more than the user wants to spend on a personal project. After researching alternatives (open-source GitHub scrapers, self-hosted Playwright, and managed pay-per-success APIs), the user decided: keep Apify wired in as-is, and add **Bright Data** and **ScrapeCreators** as additional scraper backends the admin panel can switch between — mirroring the existing pluggable LLM-scorer architecture rather than hard-coding a single provider.

At the user's actual usage pattern (a larger one-time backfill, then ~20 new listings/day steady state), both providers are cheap: Bright Data gives 5,000 free records/month (no card required), and ScrapeCreators is pay-as-you-go pennies-per-request after 100 free credits. Neither is free forever at meaningful detail-fetching volume (see Cost notes below), but both are far cheaper than Apify's paid tier.

## Existing pattern to mirror: the pluggable scorer architecture

`app/scorer/` already solves "swap between N providers, admin-selectable, DB-backed keys" for LLM scoring:
- `app/scorer/base.py` — a `Protocol` defining `score_listing(listing, criteria_profile, model, api_key) -> ScoreResult`
- `app/scorer/{anthropic,openai,gemini}_scorer.py` — one module per provider, each implementing that signature
- `app/scorer/registry.py` — a `_SCORERS: dict[str, Scorer]` lookup + `get_scorer(provider)`
- `app/scorer/service.py` — reads `config.llm_provider` from `AppSettings`, looks up the scorer, calls it
- `AppSettings` (`app/models/app_settings.py`) — one column per provider's API key, plus `llm_provider`
- `PATCH /admin/settings/llm` (`app/api/admin.py:129-160`) — lets the admin switch provider/model and set keys, validated against `get_available_providers()`/`get_available_models()`

The scraper side gets the same shape, with one key difference: scorers all take a normalized `Listing` as input, so their outputs are naturally uniform (`ScoreResult`). Scrapers each return **raw, provider-shaped data**, and today that raw shape leaks into two places, not one:
- `app/scraper/normalize.py:19-47` (`normalize_listing`) parses Apify's exact field names (`listingTitle`, `listingPrice.amount`, `customSubTitlesWithRenderingFlags`, `listingPhotos`, `reverse_geocode_detailed`, …)
- `app/scraper/query_filter.py:127` *also* reads `raw.get("listingTitle")` directly, independent of `normalize.py`

Adding two more raw shapes without fixing this would mean per-provider branches in two files. Instead, move normalization **into** each backend, so everything downstream of the scraper only ever sees the common normalized shape.

## Design

### 1. New interface — `app/scraper/base.py`
```python
class ScraperBackend(Protocol):
    def fetch_listings(
        self, search_filter: SearchFilter, results_limit: int, config: AppSettings
    ) -> list[dict[str, Any]]:  # already normalized — same keys normalize_listing() produces today
        ...
```
Each backend module owns its own HTTP/SDK call *and* its own raw→normalized mapping internally (fetch + normalize as one step, not two).

### 2. Registry — `app/scraper/registry.py`
```python
_SCRAPERS = {
    "apify": apify_backend.fetch_listings,
    "bright_data": bright_data_backend.fetch_listings,
    "scrape_creators": scrape_creators_backend.fetch_listings,
}
```
Mirrors `app/scorer/registry.py` exactly (`get_scraper(provider)`, `get_available_scraper_providers()`).

### 3. Refactor the pipeline to pass normalized dicts, not raw dicts
- `query_filter.filter_listings_by_query`: read `item["title"]` (normalized) instead of `raw.get("listingTitle")`.
- `ingest.ingest_listings`: accept already-normalized dicts; drop its internal `normalize_listing(raw)` call; get photo URLs from a `photo_urls` key each backend includes in its normalized dict (folding in what `extract_photo_urls` does today) instead of calling `extract_photo_urls(raw)` separately.
- `scraper/service.run_scrape`: dispatch via the registry using `config.scraper_provider` instead of hard-coding `apify_client.fetch_listings` + `build_search_url`.

### 4. Per-backend implementation

**`apify_backend.py`** — thin wrapper: calls `build_search_url` + existing `apify_client.fetch_listings`, then runs today's `normalize_listing`/`extract_photo_urls` logic inline. Behavior-preserving; existing tests (`test_apify_client.py`, `test_normalize.py`) should keep passing with minimal adjustment.

**`bright_data_backend.py`** — **unverified contract, flagged explicitly below.** Based on secondhand search results (direct fetches to `docs.brightdata.com` were connection-refused from this sandbox, so this is not primary-source-confirmed): trigger a dataset job (`POST https://api.brightdata.com/datasets/v3/trigger` or their "discover by keyword" endpoint, Bearer token auth), poll `.../progress/{snapshot_id}` until ready, download `.../snapshot/{snapshot_id}`. Response fields seen in examples: `title`, `initial_price`/`final_price`, `currency`, flat `location` string, `images[]`, `description`, `condition`. **Before writing the real field mapping, confirm with a live API key**: the exact endpoint/dataset_id requirement, whether keyword-discovery accepts location/radius/price constraints at all (if it's keyword-only with no geo/price filtering, it can't fully express a `SearchFilter` and is a materially weaker fit than ScrapeCreators), and what "page load" means for the free-tier count.

**`scrape_creators_backend.py`** — better-documented contract (`x-api-key` header, plain REST):
1. Resolve `SearchFilter.location` (a city/zip string) → lat/lng via their `/v1/facebook/marketplace/location/search` endpoint. Cache the result on new `SearchFilter.latitude`/`longitude` columns so this only costs a credit once per filter, not every run.
2. Call `/v1/facebook/marketplace/search` with `query`, `lat`, `lng`, `radius_km` (= `radius_miles * 1.60934`), `min_price`, `max_price`, `condition` — maps almost 1:1 onto existing `SearchFilter` fields.
3. If `include_details` is on (admin-configurable, default True — needed for `description`/`condition`/mileage-bearing text that scoring depends on), call `/v1/facebook/marketplace/item` per result for full detail. This is where most of the credit cost comes from (see Cost notes).

### 5. Parser fix needed for non-Apify title formats
`app/scraper/parser.py`'s `_TITLE_RE` and `parse_mileage` are Apify-shaped: mileage is only ever read from a separate `subtitles` list (Apify's `customSubTitlesWithRenderingFlags`), never from the title itself. Bright Data's example title is `"2018 Mercedes-Benz C 300 Convertible 27k miles"` — no separate subtitle field, and the mileage text is *inline* in the title, which today's `_TITLE_RE` (anchored on a `·` separator) would swallow into the `model` field as `"C 300 Convertible 27k miles"`.

This needs one parser change, not two: extend mileage extraction to also search title/description text as a fallback when no subtitle list is present, **and** strip a trailing mileage phrase from the title before/while extracting `model`, so `model` doesn't end up contaminated with mileage text. Add test cases using the real Bright Data example title, not just synthetic ones.

### 6. Behavior change to decide explicitly: re-seen listings with sparser data
`ingest.py`'s update branch (`ingest.py:33-36`) does `setattr(existing, key, value)` for every normalized field, unconditionally. Today all listings come from one provider, so this is safe. Once providers can differ per run (e.g. an Apify-seen listing later re-seen via a provider that doesn't return `postal_code` or a separate mileage subtitle), this would silently null out previously-good columns on the same `fb_listing_id`. **Decision for this plan: skip `None` values in the update loop** (only overwrite a column when the new provider actually returned a value for it) — cheap, avoids silent data loss, and matches the principle that a provider's absence of a field shouldn't erase another provider's earlier answer.

### 7. `search_mode="url"` filters and non-Apify providers
`SearchFilter.search_mode == "url"` filters store a raw pasted FB search URL, which only Apify's backend can consume directly (Bright Data/ScrapeCreators need structured fields: query, location, price range, etc.). Building a full FB-URL → structured-params reverse-parser is unnecessary scope for now — `resolve_query` already extracts the `query` param, but radius/price/condition are not currently recovered from a URL.

Instead of failing silently at 6am when the cron runs: when the admin switches `scraper_provider` to a non-Apify backend, have that settings-update endpoint check `is_active` search filters and report back which ones are `search_mode="url"` (and therefore incompatible), so the mismatch surfaces at switch-time in the admin UI, not as a silent empty run the next morning.

## Database migrations (two separate ones, not bundled)

1. **Provider support** (new migration): `AppSettings.scraper_provider` (String, default `"apify"`), `AppSettings.bright_data_api_key` (String, nullable), `AppSettings.scrape_creators_api_key` (String, nullable), `SearchFilter.latitude`/`longitude` (Numeric, nullable — geocode cache for ScrapeCreators).
2. **Column rename, kept separate and lower-risk**: `Listing.raw_apify_data` → `raw_scraper_data`. Confirmed by grep that this column is only referenced in `app/models/listing.py`, `app/scraper/normalize.py`, one Alembic migration, and backend test fixtures — nothing in `frontend/` or any API response schema reads it, so the rename is safe but still gets its own migration + a pass updating the ~10 test fixtures that pass `raw_apify_data=...`. If this feels like unnecessary churn, it can be dropped from scope entirely and the column keeps its (slightly misleading) name — the feature works either way.

## Admin API/UI

Mirror `PATCH /admin/settings/llm`: add `PATCH /admin/settings/scraper` to set `scraper_provider` + the relevant API key(s), validated against `get_available_scraper_providers()`. Extend `GET /admin/settings` with `available_scraper_providers`. Surface the `search_mode="url"` incompatibility warning (item 7 above) in this same endpoint's response.

## Cost notes to carry forward (corrects earlier framing)

- **ScrapeCreators**: 1 credit per search call + 1 credit per item-detail call. With `include_details` on at ~20 results/day/filter, that's ~21 credits/day/filter — the 100 free credits cover roughly the first 5 days per filter, not months. Still cheap after that (~$1-2/month per filter at the $47/25K tier), just not "free indefinitely."
- **Bright Data**: 5,000 free records/month, pay-per-success $0.75/1K after. If its keyword-discovery endpoint returns full detail in one call (as its example response suggests — title, price, description, condition all present), it needs far fewer calls per listing than ScrapeCreators, which could make it the cheaper of the two in practice — but this is exactly the part that's unverified from this session (see Design section 4).

## Tests to add

- `test_bright_data_backend.py` / `test_scrape_creators_backend.py` mirroring `test_apify_client.py`'s pattern (mock the HTTP layer, assert request shape and normalized output shape).
- `test_scraper_registry.py` mirroring the scorer registry test.
- Extend `test_parser.py` with the Bright Data-style inline-mileage title case.
- Update `ingest.py` tests to cover the "don't null out existing fields on a sparser re-seen listing" behavior from item 6.

## MCP servers for both providers (dev-time tooling, separate from the app itself)

Both providers ship an official MCP server, which is worth adding to this Claude Code session so their APIs can be called/tested directly (e.g. to confirm real request/response shapes per the Bright Data unverified-contract note above) without hand-rolling `curl` calls. This is a Claude Code environment config change, not a SalvageScout application code change — done via `claude mcp add`, not by editing the plan/repo.

- **ScrapeCreators**: `claude mcp add --transport http scrape-creators https://api.scrapecreators.com/mcp`, then run `/mcp` and choose **Authenticate** to complete its OAuth flow (enter the ScrapeCreators API key in the browser prompt). This needs an interactive session — it can't be completed headlessly.
- **Bright Data** (confirmed from the official `brightdata/brightdata-mcp` README, org-verified via github.com/brightdata): `claude mcp add --transport http brightdata "https://mcp.brightdata.com/mcp?token=YOUR_API_TOKEN"` — token from `brightdata.com/cp/setting/users` after signup, no separate OAuth step, no manual zone setup required (the server auto-provisions Web Unlocker/Browser zones behind the token). A local stdio alternative also exists via `npx @brightdata/mcp` with `API_TOKEN` in `env`; optional env vars (`GROUPS`, `TOOLS`, `RATE_LIMIT`, `WEB_UNLOCKER_ZONE`, `BROWSER_ZONE`, `POLLING_TIMEOUT`, `BASE_TIMEOUT`, `BASE_MAX_RETRIES`) are only needed for narrowing the tool set or tuning timeouts — none required to get started.

Both require the user to actually sign up for each service and get real keys/tokens first — this can happen in parallel with the rest of implementation, not as a blocker to starting the code changes above.

## Verification plan

1. Get real API keys for both providers (user already has ScrapeCreators docs confirmed; Bright Data needs a live-docs check first, per the unverified-contract note above).
2. Run one real call through each new backend against an existing `SearchFilter`, compare the normalized output to what Apify currently produces for a similar listing, and confirm nothing needed by scoring (`description`, `condition`, `mileage`, photos) is silently missing.
3. Run `pytest` in `backend/` — full suite, not just the new tests, since `ingest.py`/`query_filter.py` are shared code paths every provider now goes through.
4. Flip `scraper_provider` to each new value in the admin panel and trigger one on-demand pipeline run (`POST /api/pipeline/run`) per provider, watching logs for the `search_mode="url"` warning path and for real listings landing in the feed.
5. Leave `scraper_provider` defaulted to `"apify"` until both new backends have been validated this way — don't flip the daily cron over automatically as part of this change.
