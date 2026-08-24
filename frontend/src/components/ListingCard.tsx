import { Link } from 'react-router-dom'
import type { ListingOut } from '../api/types'
import { formatPrice, latestScore } from '../api/listingHelpers'

export default function ListingCard({ listing }: { listing: ListingOut }) {
  const score = latestScore(listing)
  const cover = listing.images[0]

  return (
    <Link to={`/listings/${listing.id}`} className="listing-card">
      <div className="listing-card-image">
        {cover ? (
          <img src={cover.image_url} alt={listing.title} loading="lazy" />
        ) : (
          <div className="listing-card-image-placeholder" />
        )}
        {score && (
          <span className={`score-badge score-${scoreTier(score.match_score)}`}>
            {score.match_score}
          </span>
        )}
      </div>
      <div className="listing-card-body">
        <h3>{listing.title}</h3>
        <p className="listing-card-price">{formatPrice(listing.price_amount, listing.currency)}</p>
        <p className="listing-card-meta">
          {[listing.year, listing.make, listing.model].filter(Boolean).join(' ')}
          {listing.mileage != null && ` · ${listing.mileage.toLocaleString()} mi`}
        </p>
        <p className="listing-card-location">{listing.location_text}</p>
        {(listing.is_sold || listing.is_pending || !listing.is_live) && (
          <p className="listing-card-status">
            {listing.is_sold ? 'Sold' : listing.is_pending ? 'Pending' : 'Removed'}
          </p>
        )}
      </div>
    </Link>
  )
}

export function scoreTier(score: number): 'high' | 'mid' | 'low' {
  if (score >= 75) return 'high'
  if (score >= 50) return 'mid'
  return 'low'
}
