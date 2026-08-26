# Infinite scroll + favorite/hide/delete listings

## Context

The listing feed currently fetches every listing in one request (`GET /api/listings`) and renders a static grid, already sorted server-side by best score descending. There's no way for a user to act on a listing (favorite it, hide it, or remove it), and nothing stops a deleted listing from reappearing the next time the scraper re-ingests the same `fb_listing_id`. This plan adds user-facing listing actions with a soft-delete that survives re-scraping, plus converts the feed to paginated infinite scroll so it stays fast as the listing count grows.

Confirmed product decisions:
- **Hidden** listings are excluded from the main feed by default, but there's a filterable "Hidden" view to see and unhide them.
- **Favorites** show as a star badge inline in the normal feed, plus a favorites-only filter toggle.
- **Pagination** is offset-based (`limit`/`offset`), not keyset — simpler given sorting is on an aggregated `MAX(score)` subquery, and fine at this data scale.

## Backend

### 1. Model — `backend/app/models/listing.py`

Add three columns to `Listing` (do not reuse `is_live`/`is_pending`/`is_sold` — those describe Marketplace-side state and get overwritten every re-scrape):

```python
is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
is_hidden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
```

`normalize_listing()` (`backend/app/scraper/normalize.py`) doesn't produce these fields, so the upsert loop in `ingest.py` (`for key, value in fields.items(): setattr(existing, key, value)`) won't clobber them on re-scrape — no changes needed there. "Deleted listings don't reappear" is enforced entirely on the read side (below).

### 2. Migration — `backend/alembic/versions/003_add_listing_status_flags.py`

Follow the `002_add_arena_runs.py` convention: `revision = '003_add_listing_status_flags'`, `down_revision = '002_add_arena_runs'`. Use `op.add_column` for the four columns above, booleans with `server_default='false'` so existing rows backfill without a data migration. Add an index on `is_deleted` (and `is_hidden`) since the read query filters on these on every feed request.

### 3. Schema — `backend/app/schemas/listing.py`

Add `is_favorite: bool`, `is_hidden: bool`, `is_deleted: bool` to `ListingOut`. Add a new `ListingPage` schema:

```python
class ListingPage(BaseModel):
    items: list[ListingOut]
    has_more: bool
```

`has_more` computed by fetching `limit + 1` rows and checking if the extra row exists — avoids a separate `COUNT(*)` query.

### 4. API — `backend/app/api/listings.py`

Rewrite `list_listings`:

```python
@router.get("", response_model=ListingPage)
def list_listings(
    min_score: int | None = None,
    view: Literal["active", "hidden", "favorites"] = "active",
    limit: int = 24,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    best_score = (...)  # unchanged subquery
    query = db.query(Listing).outerjoin(best_score, Listing.id == best_score.c.listing_id)
    query = query.filter(Listing.is_deleted.is_(False))

    if view == "hidden":
        query = query.filter(Listing.is_hidden.is_(True))
    elif view == "favorites":
        query = query.filter(Listing.is_hidden.is_(False), Listing.is_favorite.is_(True))
    else:
        query = query.filter(Listing.is_hidden.is_(False))

    if min_score is not None:
        query = query.filter(best_score.c.best_score >= min_score)

    query = query.order_by(best_score.c.best_score.desc().nullslast(), Listing.id.desc())
    rows = query.offset(offset).limit(limit + 1).all()
    return ListingPage(items=rows[:limit], has_more=len(rows) > limit)
```

Using `view` as a single enum (rather than separate `favorites_only`/`include_hidden` booleans) keeps "active vs hidden vs favorites" mutually exclusive and matches how the frontend will actually use it (three tabs, not independent toggles). Added `Listing.id.desc()` as a secondary sort key — the previous tiebreak (`last_seen_at`) can tie across many rows, and offset pagination needs a fully deterministic order to avoid skipped/duplicated rows between page fetches.

Add action endpoints, all `response_model=ListingOut`:

```python
@router.patch("/{listing_id}/favorite", response_model=ListingOut)
def set_favorite(listing_id: int, favorite: bool, db: Session = Depends(get_db)): ...

@router.patch("/{listing_id}/hide", response_model=ListingOut)
def set_hidden(listing_id: int, hidden: bool, db: Session = Depends(get_db)): ...

@router.delete("/{listing_id}", response_model=ListingOut)
def delete_listing(listing_id: int, db: Session = Depends(get_db)):
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(404)
    listing.is_deleted = True
    listing.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return listing
```

`favorite`/`hidden` as query params on PATCH keeps each action a single explicit toggle (matches "favorite/hide" as verbs) rather than a generic partial-update body — simpler client calls (`PATCH .../favorite?favorite=true`) and no risk of accidentally patching unrelated fields. `DELETE` returns the updated row (200, not 204) so the frontend's existing `request<T>()` helper doesn't need a no-body special case.

### 5. Tests — `backend/tests/`

Add `test_listings_api.py` (new file, no existing one covers this router) following the fixture/style of `test_scorer_service.py` / `test_anthropic_scorer.py` (in-memory/test DB session fixture, direct `Listing`/`Score` construction). Cover:
- `view=active` excludes `is_deleted` and `is_hidden` rows.
- `view=hidden` returns only hidden, non-deleted rows.
- `view=favorites` returns only favorited, non-hidden, non-deleted rows.
- Pagination: `limit`/`offset` returns the right slice and correct `has_more`.
- Sort order: highest `MAX(match_score)` first.
- `PATCH .../favorite`, `PATCH .../hide`, `DELETE` mutate the right flags and the deleted listing subsequently disappears from `view=active`.
- Re-ingest simulation: after soft-delete, calling `ingest_listings` again with the same `fb_listing_id` doesn't reset `is_deleted` (the upsert loop already excludes it, but a regression test locks this in — this is the core requirement from the user, worth a dedicated test even though no ingest.py code change is needed).

## Frontend

### 1. Types — `frontend/src/api/types.ts`

Add `is_favorite: boolean`, `is_hidden: boolean`, `is_deleted: boolean` to `ListingOut`. Add:

```ts
export interface ListingPage {
  items: ListingOut[]
  has_more: boolean
}
```

### 2. Client — `frontend/src/api/client.ts`

Replace `fetchListings` with a paginated version and add action calls:

```ts
export function fetchListings(params: { minScore?: number; view?: 'active' | 'hidden' | 'favorites'; limit?: number; offset?: number }): Promise<ListingPage> { ... }
export function setFavorite(id: number, favorite: boolean): Promise<ListingOut> {
  return request<ListingOut>(`/api/listings/${id}/favorite?favorite=${favorite}`, { method: 'PATCH' })
}
export function setHidden(id: number, hidden: boolean): Promise<ListingOut> {
  return request<ListingOut>(`/api/listings/${id}/hide?hidden=${hidden}`, { method: 'PATCH' })
}
export function deleteListing(id: number): Promise<ListingOut> {
  return request<ListingOut>(`/api/listings/${id}`, { method: 'DELETE' })
}
```

Follows the existing `updateSchedulerConfig` PATCH pattern.

### 3. `frontend/src/pages/ListingFeed.tsx` — infinite scroll + view tabs

- State: `listings: ListingOut[]`, `offset`, `hasMore`, `loading`, `loadingMore`, `minScore`, `view: 'active' | 'hidden' | 'favorites'`, `error`.
- Changing `minScore` or `view` resets `listings`/`offset` and refetches page 0 (same reset pattern as today's `minScore`-triggered `useEffect`, extended to also depend on `view`).
- Add a sentinel `<div ref={sentinelRef} />` after the grid; `IntersectionObserver` on it triggers `loadMore()` (fetch next `offset`, append, bump `offset`, update `hasMore`) when it's visible and `hasMore && !loadingMore`. Disconnect/reconnect the observer in a `useEffect` keyed on the sentinel ref and `hasMore`.
- Add a small tab/segmented control for `view` (Active / Hidden / Favorites) next to the existing min-score input.
- On a card action (favorite/hide/delete) that removes the listing from the current view (hide or delete while in `active` view; unhide while in `hidden` view; unfavorite while in `favorites` view), splice it out of local `listings` state immediately rather than refetching the whole page — cheaper and avoids a layout jump. Favoriting/unfavoriting while in `active` or `hidden` view just flips the star badge in place, no removal.

### 4. `frontend/src/components/ListingCard.tsx` — action buttons

Add a small action row (star / eye-off / trash icons or plain buttons) overlaid on or below the card. Each handler must call `e.preventDefault(); e.stopPropagation()` before the API call, since the card is a `<Link>` wrapper. Use optimistic local state update on click (flip the star immediately / fade out on hide-delete) rather than waiting on the response, with rollback on error — matches the immediate, low-latency feel these actions should have; the component already receives the listing as a prop from `ListingFeed`, so lift the actual state mutation up via an `onAction` callback prop rather than duplicating fetch logic in the card.

### 5. `frontend/src/pages/ListingDetail.tsx` — same actions

Add the same three action buttons near the title/score panel for consistency, using the same client functions; on delete, navigate back to `/` (the listing no longer exists in any view the user is likely on).

### 6. `listingHelpers.ts` score mismatch — leave out of scope

`latestScore()` picks by max `created_at`, while the feed sorts by max `match_score`. This preexisting inconsistency is unrelated to this feature (it doesn't affect pagination or the new actions) — not fixing it here to keep this change scoped, but noting it because a listing with multiple criteria-profile scores could show a badge that doesn't match the sort position.

## Rollout / verification

1. `cd backend && alembic upgrade head` — apply migration 003, confirm `listings` table has the four new columns with existing rows backfilled to `false`/`NULL`.
2. `cd backend && pytest` — run full suite including new `test_listings_api.py`.
3. Start backend + frontend (`/run` skill or existing dev commands), open the feed:
   - Confirm initial page loads ~24 listings sorted score-desc; scroll to bottom triggers loading more, no duplicates/gaps.
   - Favorite a listing → star shows; switch to Favorites tab → it appears; unfavorite from there → disappears.
   - Hide a listing from Active view → disappears from Active; switch to Hidden tab → appears; unhide → returns to Active.
   - Delete a listing → disappears from Active and does not appear in Hidden or Favorites.
   - Trigger a manual pipeline run (existing scheduler/admin trigger) for a search filter that would re-scrape the deleted listing's `fb_listing_id` → confirm it stays deleted (still `is_deleted=True`, still absent from `view=active`).
