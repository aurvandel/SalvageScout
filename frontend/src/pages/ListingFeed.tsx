import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchListings, fetchSearchFilters } from '../api/client'
import type { ListingOut, ListingView, SearchFilterOut } from '../api/types'
import ListingCard from '../components/ListingCard'

const PAGE_SIZE = 24

const VIEWS: { value: ListingView; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'hidden', label: 'Hidden' },
]

// Whether a listing (after a local patch) still belongs in the given view —
// keeps view-membership rules in one place instead of scattered across card handlers.
function belongsInView(listing: ListingOut, view: ListingView): boolean {
  if (listing.is_deleted) return false
  if (view === 'hidden') return listing.is_hidden
  if (view === 'favorites') return listing.is_favorite && !listing.is_hidden
  return !listing.is_hidden
}

export default function ListingFeed() {
  const [listings, setListings] = useState<ListingOut[]>([])
  const [minScore, setMinScore] = useState<number | ''>('')
  const [view, setView] = useState<ListingView>('active')
  const [searchFilters, setSearchFilters] = useState<SearchFilterOut[]>([])
  const [searchFilterId, setSearchFilterId] = useState<number | ''>('')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSearchFilters().then(setSearchFilters).catch(() => {})
  }, [])

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchListings({
      minScore: minScore === '' ? undefined : minScore,
      view,
      searchFilterId: searchFilterId === '' ? undefined : searchFilterId,
      limit: PAGE_SIZE,
      offset: 0,
    })
      .then((page) => {
        setListings(page.items)
        setHasMore(page.has_more)
        setOffset(page.items.length)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [minScore, view, searchFilterId])

  useEffect(() => {
    reload()
  }, [reload])

  const loadMore = useCallback(() => {
    setLoadingMore(true)
    fetchListings({
      minScore: minScore === '' ? undefined : minScore,
      view,
      searchFilterId: searchFilterId === '' ? undefined : searchFilterId,
      limit: PAGE_SIZE,
      offset,
    })
      .then((page) => {
        setListings((prev) => [...prev, ...page.items])
        setHasMore(page.has_more)
        setOffset((prev) => prev + page.items.length)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingMore(false))
  }, [minScore, view, searchFilterId, offset])

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          loadMore()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadMore])

  function handleListingChange(id: number, patch: Partial<ListingOut>) {
    setListings((prev) =>
      prev
        .map((listing) => (listing.id === id ? { ...listing, ...patch } : listing))
        .filter((listing) => listing.id !== id || belongsInView(listing, view)),
    )
  }

  function handleActionError(message: string) {
    window.alert(message)
    reload()
  }

  return (
    <div className="feed">
      <div className="feed-toolbar">
        <h1>Listings</h1>
        <div className="feed-toolbar-controls">
          <div className="view-tabs">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                className={`view-tab${view === v.value ? ' active' : ''}`}
                onClick={() => setView(v.value)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <label>
            Search
            <select
              value={searchFilterId}
              onChange={(e) => setSearchFilterId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">All Searches</option>
              {searchFilters.map((sf) => (
                <option key={sf.id} value={sf.id}>{sf.name}</option>
              ))}
            </select>
          </label>
          <label>
            Min score
            <input
              type="number"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="any"
            />
          </label>
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">Failed to load listings: {error}</p>}
      {!loading && !error && listings.length === 0 && <p>No listings yet.</p>}

      <div className="listing-grid">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            onChange={handleListingChange}
            onActionError={handleActionError}
          />
        ))}
      </div>

      {!loading && hasMore && <div ref={sentinelRef} className="feed-sentinel" />}
      {loadingMore && <p>Loading more...</p>}
    </div>
  )
}
