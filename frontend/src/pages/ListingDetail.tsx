import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchListing } from '../api/client'
import type { ListingOut } from '../api/types'
import { formatPrice, latestScore } from '../api/listingHelpers'
import { scoreTier } from '../components/ListingCard'

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>()
  const [listing, setListing] = useState<ListingOut | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setListing(null)
    setError(null)
    fetchListing(Number(id))
      .then(setListing)
      .catch((err) => setError(err.message))
  }, [id])

  if (error) return <p className="error">Failed to load listing: {error}</p>
  if (!listing) return <p>Loading...</p>

  const score = latestScore(listing)

  return (
    <div className="listing-detail">
      <Link to="/" className="back-link">
        ← Back to listings
      </Link>

      <h1>{listing.title}</h1>
      <p className="listing-detail-price">{formatPrice(listing.price_amount, listing.currency)}</p>

      {listing.images.length > 0 && (
        <div className="listing-detail-gallery">
          {listing.images
            .sort((a, b) => a.position - b.position)
            .map((image) => (
              <img key={image.id} src={image.image_url} alt="" loading="lazy" />
            ))}
        </div>
      )}

      <dl className="listing-detail-specs">
        {listing.year && <Spec label="Year" value={listing.year} />}
        {listing.make && <Spec label="Make" value={listing.make} />}
        {listing.model && <Spec label="Model" value={listing.model} />}
        {listing.mileage != null && <Spec label="Mileage" value={`${listing.mileage.toLocaleString()} mi`} />}
        {listing.condition && <Spec label="Condition" value={listing.condition} />}
        {listing.location_text && <Spec label="Location" value={listing.location_text} />}
      </dl>

      {score && (
        <section className={`score-panel score-${scoreTier(score.match_score)}`}>
          <h2>Match score: {score.match_score}</h2>
          <p>{score.summary}</p>
          {score.pros.length > 0 && (
            <div>
              <h3>Pros</h3>
              <ul>
                {score.pros.map((pro, i) => (
                  <li key={i}>{pro}</li>
                ))}
              </ul>
            </div>
          )}
          {score.cons.length > 0 && (
            <div>
              <h3>Cons</h3>
              <ul>
                {score.cons.map((con, i) => (
                  <li key={i}>{con}</li>
                ))}
              </ul>
            </div>
          )}
          {score.dealbreaker_flags.length > 0 && (
            <div className="dealbreakers">
              <h3>Dealbreakers</h3>
              <ul>
                {score.dealbreaker_flags.map((flag, i) => (
                  <li key={i}>{flag}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {listing.description && (
        <section>
          <h2>Description</h2>
          <p className="listing-detail-description">{listing.description}</p>
        </section>
      )}

      <a href={listing.url} target="_blank" rel="noreferrer" className="fb-link">
        View on Facebook Marketplace
      </a>
    </div>
  )
}

function Spec({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="spec">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
