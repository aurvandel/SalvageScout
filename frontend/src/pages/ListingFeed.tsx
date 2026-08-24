import { useEffect, useState } from 'react'
import { fetchListings } from '../api/client'
import type { ListingOut } from '../api/types'
import ListingCard from '../components/ListingCard'

export default function ListingFeed() {
  const [listings, setListings] = useState<ListingOut[]>([])
  const [minScore, setMinScore] = useState<number | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchListings(minScore === '' ? undefined : minScore)
      .then(setListings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [minScore])

  return (
    <div className="feed">
      <div className="feed-toolbar">
        <h1>Listings</h1>
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

      {loading && <p>Loading...</p>}
      {error && <p className="error">Failed to load listings: {error}</p>}
      {!loading && !error && listings.length === 0 && <p>No listings yet.</p>}

      <div className="listing-grid">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  )
}
