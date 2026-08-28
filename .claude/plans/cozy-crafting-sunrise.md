# Manual Search: Live Status Indicator + Completion Notifications

## Context

The "Run Now" manual search button (Admin > Schedule tab) fires a FastAPI background task and returns instantly — there is no way to know the job is still running, how many listings it found, or how many were new. The button's local "Triggering..." state only covers the ~instant HTTP round-trip, not the actual multi-minute pipeline run. There's also no distinction anywhere between "listing already existed" and "listing is new" — `ingest_listings` computes that internally but discards it.

The user wants: (1) a visual indicator that a search is running, visible **app-wide** (not just on the Schedule tab, so it's visible even after navigating away), and (2) a completion notification that's **both an in-app toast and a native browser Notification**, showing total items found and how many were new.

Confirmed: backend runs as a single uvicorn worker with no `--workers` flag (Dockerfile/docker-compose), so an in-memory module-level status store in the API process is safe and sufficient — no DB table or job queue needed. The separate `scheduler.py` process is untouched; this feature only covers the manual trigger.

## Backend changes

**New module `backend/app/search_status.py`** — module-level `SearchStatus` dataclass (`status: idle|running|completed|error`, `run_id`, `started_at`, `finished_at`, `filters_triggered`, `total_listings`, `new_listings`, `error_message`), guarded by a `threading.Lock`. Functions: `try_start(filters_triggered)` (atomic idle/completed/error → running transition, returns `False` if already running), `mark_completed(...)`, `mark_error(...)`, `get_status()`.

**`backend/app/scraper/ingest.py`** — add `IngestResult` dataclass (`listings`, `new_count`, `existing_count`). `ingest_listings` tallies `new_count`/`existing_count` using the existing `existing is None` check (line 24) and returns `IngestResult` instead of a bare list.

**`backend/app/scraper/service.py`** — `run_scrape` return type becomes `IngestResult` (pass-through, no logic change).

**`backend/app/pipeline.py`** — `PipelineResult` gains `new_listings: int = 0`. `run_pipeline_for_filter` unpacks `IngestResult` (`listings = ingest_result.listings`) and sets `new_listings=ingest_result.new_count` on the returned `PipelineResult`.

**`backend/app/schemas/pipeline.py`** — add `new_listings: int = 0` to `PipelineRunOut` for consistency with the dataclass (used by the pre-existing sync `/api/pipeline/run/{id}` endpoint).

**`backend/app/api/admin.py`**:
- `trigger_search`: after the existing "no active filters" early return, call `search_status.try_start(len(active_filters))`; if it returns `False`, return `TriggerSearchResponse(message="A search is already running")` without scheduling a task (same 200-shaped-message convention as the "no filters" case — no new HTTPException handling needed on the frontend).
- `_run_pipeline_background`: wrap the per-filter loop in an outer try/except (calls `search_status.mark_error` on unexpected top-level failure, guaranteeing the status can't get stuck at `running`); accumulate `total_listings`/`total_new` across filters; on normal completion call `search_status.mark_completed(total_listings, total_new, error_message=joined per-filter errors or None)` — a bad filter still resolves to `completed` with a non-null `error_message`, matching the existing "one bad filter doesn't stop others" tolerance.
- Add `GET /admin/search-status` returning `search_status.get_status()` via a new `SearchStatusOut` pydantic model.
- Delete the dead unused `TriggerSearchResultResponse` class.

**Tests**: update `tests/test_ingest.py` (return shape + new `new_count`/`existing_count` assertions), `tests/test_pipeline.py` (assert `new_listings` on first vs. repeat scrape), `tests/test_api_pipeline.py` (include `new_listings` in the `PipelineResult`/`PipelineRunOut` equality check). New `tests/test_search_status.py` (state machine unit tests) and `tests/test_api_admin_search_status.py` (idle default, already-running message path via directly calling `try_start` first, status reflects a mocked `_run_pipeline_background`).

## Frontend changes

**`frontend/src/api/types.ts`** — add `SearchStatusValue` and `SearchStatusOut` types.

**`frontend/src/api/client.ts`** — add `fetchSearchStatus()`.

**New `frontend/src/context/SearchStatusContext.tsx`** (first context in this app — no existing context pattern). Provider polls `GET /api/admin/search-status` every 3s via `setInterval` in a `useEffect` with proper `clearInterval` cleanup (StrictMode-safe). Tracks previous `{run_id, status}` in a `useRef` and fires exactly one toast + one browser Notification only on an observed `running → completed|error` transition for the *same* `run_id` (never toasts on first poll after mount, so reopening a tab after a run already finished shows correct static state without a spurious toast). Exposes `status`, `toasts`, `dismissToast`, and a `triggerSearch()` wrapper that also lazily requests `Notification` permission on first use (feature-detected via `'Notification' in window`, since the LAN bare-IP URL in CLAUDE.md is an insecure context where it won't exist — falls back to toast-only silently).

**New `frontend/src/components/ToastHost.tsx`** — minimal dependency-free toast list, styled via new rules appended to `App.css` (reusing the existing success/error color language from `AdminPanel.css`, plus a dark-mode variant matching the existing `@media` block there).

**`frontend/src/App.tsx`** — wrap the app in `SearchStatusProvider`, render `<ToastHost />`, add a `SearchStatusBadge` (shows "Search running…" pill) inside `.nav-links` so it's visible on every route.

**`frontend/src/pages/admin/ScheduleTab.tsx`** — `handleRunSearch` uses the shared context's `triggerSearch()` and derives `isRunning` from `status.status === 'running'` (real, server-polled, cross-tab state) instead of a local flag that only lasted until the 202 response. The existing instant `runMessage`/`runError` divs stay for the immediate ack; the completion toast is delivered separately by the shared context.

## Edge cases handled

- Concurrent trigger clicks: `try_start` is lock-guarded and checked before scheduling, so no duplicate background task ever runs.
- Partial failure (one filter throws): status still resolves to `completed` with a populated `error_message`, totals reflect successful filters only.
- Total top-level failure: outer try/except guarantees status always leaves `running`.
- Tab closed/reopened mid-run: state is purely server-derived; reopened tab shows correct current state without retroactively toasting for a run it didn't watch live.
- Multiple tabs open: each polls independently and detects its own transition — no cross-tab coordination needed since state lives server-side.
- No `Notification` support/permission: feature-detected and permission-checked before every use; toast still fires regardless.

## Verification

- Backend: `cd backend && pytest` — new and updated tests above must pass; confirms no other caller depends on the old `ingest_listings`/`run_scrape` return shape.
- Frontend (no test framework present beyond `npm run lint`, so manual verification): `npm run dev`, open two tabs (one on `/admin`, one on `/`), click "Run Now", confirm the badge appears in both tabs within one poll interval, persists across navigation, and both tabs show a toast + native notification on completion with correct total/new counts. Test double-click guard, deny-permission fallback, and the "no active filters" unchanged path.
