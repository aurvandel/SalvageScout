import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Link } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import { fetchListings } from '../api/client'
import type { ListingOut } from '../api/types'
import { formatPrice, latestScore } from '../api/listingHelpers'
import { scoreTier } from '../components/ListingCard'
import './MapView.css'

const MAP_FETCH_LIMIT = 1000
const DEFAULT_CENTER: [number, number] = [39.5, -98.35]
const DEFAULT_ZOOM = 4

type MarkerTier = 'high' | 'mid' | 'low' | 'none'
type LocatedListing = ListingOut & { latitude: number; longitude: number }

function markerIcon(tier: MarkerTier) {
  return L.divIcon({
    className: '',
    html: `<span class="map-pin map-pin-${tier}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -20],
  })
}

const ICONS: Record<MarkerTier, L.DivIcon> = {
  high: markerIcon('high'),
  mid: markerIcon('mid'),
  low: markerIcon('low'),
  none: markerIcon('none'),
}

// Recenters/zooms the map whenever the set of located listings changes, so the
// view frames exactly what's plotted. Keyed on a value signature rather than
// the `points` array identity, so a re-render with the same coordinates (e.g.
// an unrelated parent state update) doesn't stomp a user's in-progress pan/zoom.
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  const signature = points.map((p) => p.join(',')).join(';')

  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 12)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 })
    // points/signature carry the same information; signature is the stable dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature])

  return null
}

export default function MapView() {
  const [listings, setListings] = useState<ListingOut[]>([])
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchListings({ view: 'active', limit: MAP_FETCH_LIMIT, offset: 0 })
      .then((page) => {
        setListings(page.items)
        setTruncated(page.has_more)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const located = useMemo(
    () => listings.filter((l): l is LocatedListing => l.latitude != null && l.longitude != null),
    [listings],
  )

  const points = useMemo<[number, number][]>(
    () => located.map((l) => [l.latitude, l.longitude]),
    [located],
  )

  const missingCount = listings.length - located.length

  return (
    <div className="map-view">
      <div className="feed-toolbar">
        <h1>Map</h1>
        {!loading && !error && (
          <p className="map-summary">
            {located.length} listing{located.length === 1 ? '' : 's'} located
            {missingCount > 0 && ` · ${missingCount} without location data`}
            {truncated && ` · showing first ${MAP_FETCH_LIMIT}`}
          </p>
        )}
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">Failed to load listings: {error}</p>}
      {!loading && !error && listings.length === 0 && <p>No listings yet.</p>}

      {!loading && !error && listings.length > 0 && (
        <div className="map-container">
          <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={points} />
            {located.map((listing) => {
              const score = latestScore(listing)
              const tier: MarkerTier = score ? scoreTier(score.match_score) : 'none'
              const cover = listing.images[0]
              return (
                <Marker key={listing.id} position={[listing.latitude, listing.longitude]} icon={ICONS[tier]}>
                  <Popup>
                    <Link to={`/listings/${listing.id}`} className="map-popup">
                      {cover && <img src={cover.image_url} alt={listing.title} />}
                      <div className="map-popup-body">
                        <div className="map-popup-title">{listing.title}</div>
                        <div className="map-popup-price">{formatPrice(listing.price_amount, listing.currency)}</div>
                        {listing.location_text && <div className="map-popup-location">{listing.location_text}</div>}
                        {score && <span className={`score-badge map-popup-score score-${tier}`}>{score.match_score}</span>}
                      </div>
                    </Link>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </div>
      )}
    </div>
  )
}
