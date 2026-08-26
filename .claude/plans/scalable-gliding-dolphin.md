# Per-search scoring prompts + search switcher

## Context

Today `SearchFilter` rows already support multiple independent searches — the scheduler loops over every `is_active` filter (`backend/app/scheduler.py:20-32`). But scoring is wired to a single global "active" `CriteriaProfile`: `pipeline.py:18-19` fetches `CriteriaProfile.filter_by(is_active=True)` and applies it to *every* search. There's no way to run a "cars" search with a car-buying prompt and an "iPhone" search with a phone-buying prompt at the same time — activating one profile deactivates all others. The frontend mirrors this: `ListingFeed` shows every listing from every search mixed together with no way to switch between searches, and `SearchFiltersTab` has no way to pick which prompt a search uses.

Goal: let each `SearchFilter` link to a specific `CriteriaProfile`, and let the feed be scoped to one search at a time.

## Backend changes

**Model** (`backend/app/models/search_filter.py`): add nullable FK
```python
criteria_profile_id: Mapped[int | None] = mapped_column(ForeignKey("criteria_profiles.id"), nullable=True)
criteria_profile: Mapped["CriteriaProfile | None"] = relationship()
```
(mirrors the `Listing.search_filter_id` FK pattern already in the codebase). No changes needed to `CriteriaProfile` — its existing versioning/`is_active` behavior is preserved and reused as the **fallback default** for searches that don't specify a link, so existing filters keep working unmodified.

**Migration**: new file `backend/alembic/versions/006_add_criteria_profile_link_to_search_filter.py`, `down_revision = '005_add_viewed_at'`, adds nullable `criteria_profile_id` column + FK constraint to `search_filters`.

**Pipeline** (`backend/app/pipeline.py`): replace the hard-coded lookup with a resolver that prefers the search's own link:
```python
def resolve_criteria_profile(db: Session, search_filter: SearchFilter) -> CriteriaProfile | None:
    if search_filter.criteria_profile_id is not None:
        return db.get(CriteriaProfile, search_filter.criteria_profile_id)
    return get_active_criteria_profile(db)
```
`run_pipeline_for_filter` calls this instead of `get_active_criteria_profile(db)` directly; error message on `None` includes the search filter name so a misconfigured search is easy to diagnose. No change to `scheduler.py` — it already loops per-filter and calls `run_pipeline_for_filter`, so each search now naturally scores against its own linked prompt in the same loop.

**Schemas** (`backend/app/schemas/search_filter.py`): add `criteria_profile_id: int | None = None` to `SearchFilterIn` (flows through to `SearchFilterOut` automatically).

**API** (`backend/app/api/search_filters.py`): in `create_search_filter`/`update_search_filter`, if `criteria_profile_id` is set, validate it references an existing `CriteriaProfile` (404 if not) before saving — same defensive pattern already used for the row itself.

**Listings API** (`backend/app/api/listings.py`): add optional `search_filter_id: int | None = None` query param to `list_listings`; when set, filter `Listing.search_filter_id == search_filter_id`.

## Frontend changes

**Types/client** (`frontend/src/api/types.ts`, `frontend/src/api/client.ts`): add `criteria_profile_id: number | null` to `SearchFilterOut`; add `searchFilterId` param to `fetchListings`.

**SearchFiltersTab** (`frontend/src/pages/admin/SearchFiltersTab.tsx`): fetch `CriteriaProfileOut[]` alongside filters (reuse `fetchCriteriaProfiles`, already used by `PromptsTab`). Add a "Scoring Prompt" `<select>` to the form (options: "Use default active prompt" + each profile labeled `name (vN)`, most recent version per name deduplicated... actually simplest: list all profiles sorted by version desc, same as `PromptsTab` does — user picks the exact version). Show the linked profile name as a badge in each filter row, next to the existing mode/results badges.

**ListingFeed** (`frontend/src/pages/ListingFeed.tsx`): add a search selector to the toolbar — fetch `SearchFilterOut[]` on mount, render a `<select>` (options: "All Searches" + each filter's `name`), store as state, include in `reload`/`loadMore`'s `fetchListings` call as `searchFilterId`. This is the "load different searches instead of one combined list" ask — default stays "All Searches" so existing behavior is unchanged until the user picks one.

## Verification

- `cd backend && alembic upgrade head` applies cleanly; `alembic downgrade -1` reverts cleanly.
- `pytest` in `backend/` — existing pipeline/API tests should still pass since the fallback preserves current single-profile behavior when no link is set.
- Manually: create two search filters ("Cars", "iPhones") and two criteria profiles with distinct prompts; link each filter to its own profile via the admin UI; trigger a manual run for each; confirm `Score.criteria_profile_id` on resulting listings matches the linked profile, not a shared global one. In `ListingFeed`, switch the search selector and confirm only that search's listings appear.
- Run the frontend dev server and click through `SearchFiltersTab` (link picker shows/saves) and `ListingFeed` (selector filters correctly) per the `run` skill.
