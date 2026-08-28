# Multi-account Apify failover

## Context

Apify usage is currently a single token on the `app_settings` singleton row (`AppSettings.apify_token`). Each Apify account has its own monthly usage cap, so one household is capped at one account's spend. The user and their wife each want their own Apify account, with the pipeline automatically using whichever account still has headroom — no manual switching, and no artificial limit on how many accounts can be added later.

Because the run cadence is "one Apify actor call per active `SearchFilter` per pipeline run" (`pipeline.py` → `apify_backend.fetch_listings` → `apify_client.fetch_listings`, one call each), failover is naturally an ordered try-next-account loop around that one call: try account 1's token, and only move to account 2 on an error attributable to *that account* (bad token, forbidden, over quota, rate-limited). Since Apify's usage cap resets monthly, this ordered strategy self-balances over time with no rotation logic needed: once account 1 is exhausted, every run automatically uses account 2 until account 1's cycle resets.

## Data model

New table `apify_accounts`, modeled on `SearchFilter`'s CRUD shape (`backend/app/models/search_filter.py`, `backend/app/api/search_filters.py`):

- `id`, `label` (str, required — "Parker's account", "Wife's account"), `api_token` (str, required)
- `priority` (int, default 100) — tried in `(priority, id)` order, lower first. A plain editable integer; no drag-reorder UI needed for v1.
- `is_active` (bool, default True)
- `last_used_at`, `last_error`, `last_error_at` — write-only observability, no auto-disable logic. Quota resets monthly, so a `consecutive_failures`-based disable would permanently drop a key that would come back.
- `created_at`

Migration `backend/alembic/versions/014_add_apify_accounts.py` (chained off `013_add_log_entries`, following that file's `op.create_table` + docstring style):
1. `create_table('apify_accounts', ...)`
2. Data migration: if `app_settings.apify_token` is set, insert it as one `apify_accounts` row (`label='Migrated from settings'`, `priority=100`) so existing installs keep working without re-entering the key.
3. `drop_column('app_settings', 'apify_token')`
4. `downgrade()` reverses all three (re-add column, copy first account's token back, drop table).

`AppSettings.apify_actor_id` stays where it is — the actor choice is a scraper setting, not a property of any one account.

## Backend: model, schema, router

- `backend/app/models/apify_account.py` — `ApifyAccount` model as above; register in `backend/app/models/__init__.py`.
- `backend/app/schemas/apify_account.py` — `ApifyAccountIn` (label, `api_token: str | None = None` so PATCH can omit it to keep the existing token — this is the fix for the bug the `SearchFilter` template doesn't have to deal with: never round-trip a masked value back into storage), `ApifyAccountOut` (adds `api_token_masked` via the existing `mask_secret()` helper from `app/schemas/app_settings.py`, never the raw token).
- `backend/app/api/apify_accounts.py` — CRUD router mirroring `search_filters.py` exactly (list ordered by `priority, id`; create requires `api_token`; update only overwrites `api_token` when non-empty in the payload; delete). Register in `main.py`: `app.include_router(apify_accounts.router, prefix="/api/apify-accounts", tags=["apify-accounts"])`.
- `backend/app/settings_service.py` — add `get_apify_accounts(db)`: returns accounts ordered by `(priority, id)`; if the table is empty and `env_settings.apify_token` is set, seeds one row from it first (fresh-install bootstrap path — the alembic migration already handles the upgrade-existing-install path).
- `backend/app/config.py` — relax `apify_token: str` (required) to `apify_token: str | None = None`, since it's now only a first-boot seed, not a hard runtime requirement.

## Backend: failover logic

`backend/app/scraper/apify_client.py`:
- After `run = client.actor(actor_id).call(...)`, check `run.status`. The SDK returns `SUCCEEDED` on success and `FAILED`/`ABORTED`/`TIMED-OUT`/etc. on failure *without raising* — today this silently returns zero listings. Raise a new `ApifyRunFailedError(status, status_message)` when `run.status != "SUCCEEDED"`, carrying both fields for logging.
- Add `fetch_listings_with_failover(search_url, results_limit, accounts, include_details, actor_id)`, where `accounts` is `list[tuple[account_id, token]]` already ordered by the caller (keeps this module free of ORM imports). Loop the accounts:
  - On success, return `(items, succeeded_account_id, attempts)`.
  - On `apify_client.errors.ApifyApiError` whose `status_code` is in `{401, 402, 403, 429}` (auth/payment-required/forbidden/rate-limited — i.e. account-attributable), or on `ApifyRunFailedError`, log a warning and try the next account.
  - On any other `ApifyApiError` (400 bad request, 404 unknown actor, 5xx after the SDK's own retries) — **re-raise immediately, do not fail over.** These indicate a broken request/actor, not an exhausted account; retrying them across every configured account would silently re-bill each one for the same broken run.
  - If every account is exhausted, raise `RuntimeError` summarizing the last error.
  - `attempts` is `list[tuple[account_id, error_or_None]]` for every account tried, letting the caller record per-account outcomes without this module touching the DB.

`backend/app/scraper/apify_backend.py`:
- Replace the single `config.apify_token` use with `get_apify_accounts(db)` filtered to `is_active=True` (order already correct from the query), call `fetch_listings_with_failover(...)`, then write `last_used_at`/`last_error`/`last_error_at` back onto the `ApifyAccount` rows from `attempts` and commit.
- Empty active-accounts list → raise a clear `RuntimeError("No active Apify accounts configured")` (surfaces through the existing scheduler/manual-trigger try/except exactly like today's "token not configured" error).

## Backend: Usage and Status tabs (forced by dropping `apify_token`, not scope creep)

Both `GET /admin/usage` and `GET /admin/system-status` currently call `get_account_usage(config.apify_token)` once — that call site breaks the moment `apify_token` is gone, so both need to loop `get_apify_accounts(db)` (active only) instead. Keep this to a loop, not a new dashboard:

- `schemas/usage.py`: replace the single `apify: ApifyUsageOut` field with `apify: list[ApifyAccountUsageOut]`, where `ApifyAccountUsageOut` adds `account_id: int, label: str` to today's existing fields. This mirrors the list-of-cards shape `llm_this_month`/`llm_all_time` already use — no new pattern.
- `schemas/system_status.py`: add optional `label: str | None` to `ScraperStatusOut`. `admin.py`'s status check emits one row per active Apify account (provider="apify", label=account.label) instead of one combined row; other providers keep a single row with `label=None`.
- Frontend `UsageTab.tsx`: map the existing Apify card markup over `usage.apify` (one card per account) instead of rendering it once.
- Frontend `StatusTab.tsx`: `key={`${row.provider}-${row.label ?? ''}`}`, append `— {row.label}` to the displayed name when present.

## Backend: settings endpoint cleanup

- `schemas/app_settings.py`: `ApifySettingsOut`/`ApifySettingsIn` drop `apify_token`/`apify_token_masked`, keep only `actor_id`.
- `admin.py`'s `update_apify_settings` (`PATCH /admin/settings/apify`) drops the `apify_token` branch, keeps the `actor_id` one.

## Frontend: new Apify Accounts tab

New `frontend/src/pages/admin/ApifyAccountsTab.tsx`, structurally a smaller version of `SearchFiltersTab.tsx` (list with inline active-toggle/edit/delete + an add/edit form below): fields are label, API token (password input, masked-value placeholder like the current Apify token field), priority (number input), active (checkbox). Register in `AdminPanel.tsx`'s `TABS` array (next to "Scraper") and render block.

New API client functions in `frontend/src/api/client.ts` (mirroring `fetchSearchFilters`/`createSearchFilter`/`updateSearchFilter`/`deleteSearchFilter`): `fetchApifyAccounts`, `createApifyAccount`, `updateApifyAccount`, `deleteApifyAccount` against `/api/apify-accounts`.

New `ApifyAccountOut` type in `frontend/src/api/types.ts`; trim `apify_token`/`apify_token_masked` off `ApifySettingsOut`/`In`.

`ScraperTab.tsx`: remove the Apify API Token input and its state (`apifyToken`, the token branch in `handleSaveApify`) — token management moves entirely to the new tab. Keep the Actor ID field as-is.

## Verification

- `alembic upgrade head` against the dev DB (via the existing throwaway-sibling-container recipe, per project memory) — confirm the migration runs clean both directions (`upgrade` then `downgrade` then `upgrade` again) and that an existing `apify_token` value lands correctly in the new table.
- `pytest` (backend) — add/extend tests for: `fetch_listings_with_failover` trying account 2 on a 401/403/429/`ApifyRunFailedError` from account 1, *not* failing over on a 400/404, and raising once all accounts are exhausted; the CRUD router; the masked-token-not-overwritten-on-update behavior.
- Screenshot skill against the new Apify Accounts tab and the updated Usage/Status tabs (per-account cards/rows) to confirm the UI renders correctly.
- Manual: with two accounts configured, `POST /admin/trigger-search` and confirm `last_used_at` updates on the account actually used.
