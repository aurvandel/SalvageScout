import { Link } from 'react-router-dom'
import type { ListingOut } from '../api/types'
import { formatPrice, latestScore } from '../api/listingHelpers'
import { deleteListing, setFavorite, setHidden } from '../api/client'

export default function ListingCard({
  listing,
  onChange,
  onActionError,
}: {
  listing: ListingOut
  onChange: (id: number, patch: Partial<ListingOut>) => void
  onActionError: (message: string) => void
}) {
  const score = latestScore(listing)
  const cover = listing.images[0]

  function stop(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function toggleFavorite(e: React.MouseEvent) {
    stop(e)
    const favorite = !listing.is_favorite
    onChange(listing.id, { is_favorite: favorite })
    setFavorite(listing.id, favorite).catch(() => onActionError('Failed to update favorite. Refreshing list.'))
  }

  function toggleHidden(e: React.MouseEvent) {
    stop(e)
    const hidden = !listing.is_hidden
    onChange(listing.id, { is_hidden: hidden })
    setHidden(listing.id, hidden).catch(() => onActionError('Failed to update hidden state. Refreshing list.'))
  }

  function remove(e: React.MouseEvent) {
    stop(e)
    if (!window.confirm('Delete this listing? It will not reappear in future searches.')) return
    onChange(listing.id, { is_deleted: true })
    deleteListing(listing.id).catch(() => onActionError('Failed to delete listing. Refreshing list.'))
  }

  return (
    <Link to={`/listings/${listing.id}`} className="listing-card">
      <div className="listing-card-image">
        {cover ? (
          <img src={cover.image_url} alt={listing.title} loading="lazy" />
        ) : (
          <div className="listing-card-image-placeholder" />
        )}
        <div className="listing-card-badges">
          {score && (
            <span className={`score-badge score-${scoreTier(score.match_score)}`}>
              {score.match_score}
            </span>
          )}
          {listing.viewed_at === null && (
            <span className="new-badge">NEW</span>
          )}
        </div>
        <div className="listing-card-actions">
          <button
            type="button"
            className={`icon-button${listing.is_favorite ? ' active' : ''}`}
            title={listing.is_favorite ? 'Unfavorite' : 'Favorite'}
            onClick={toggleFavorite}
          >
            {listing.is_favorite ? '★' : '☆'}
          </button>
          <button
            type="button"
            className={`icon-button${listing.is_hidden ? ' active' : ''}`}
            title={listing.is_hidden ? 'Unhide' : 'Hide'}
            onClick={toggleHidden}
          >
            {listing.is_hidden ? '◉' : '◎'}
          </button>
          <button type="button" className="icon-button" title="Delete" onClick={remove}>
            ✕
          </button>
        </div>
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
