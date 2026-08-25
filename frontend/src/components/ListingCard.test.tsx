import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import ListingCard, { scoreTier } from './ListingCard'
import { makeListing, makeScore } from '../test/fixtures'
import { renderWithRouter } from '../test/testUtils'
import { deleteListing, setFavorite, setHidden } from '../api/client'

vi.mock('../api/client', () => ({
  setFavorite: vi.fn(),
  setHidden: vi.fn(),
  deleteListing: vi.fn(),
}))

const mockSetFavorite = vi.mocked(setFavorite)
const mockSetHidden = vi.mocked(setHidden)
const mockDeleteListing = vi.mocked(deleteListing)

function renderCard(overrides: Parameters<typeof makeListing>[0] = {}) {
  const listing = makeListing(overrides)
  const onChange = vi.fn()
  const onActionError = vi.fn()
  renderWithRouter(<ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />, {
    route: '/',
    path: '/',
  })
  return { listing, onChange, onActionError }
}

describe('scoreTier', () => {
  it('returns "high" at and above 75', () => {
    expect(scoreTier(75)).toBe('high')
    expect(scoreTier(100)).toBe('high')
  })

  it('returns "mid" just below the high boundary', () => {
    expect(scoreTier(74)).toBe('mid')
  })

  it('returns "mid" at and above 50', () => {
    expect(scoreTier(50)).toBe('mid')
  })

  it('returns "low" just below the mid boundary', () => {
    expect(scoreTier(49)).toBe('low')
  })

  it('returns "low" at 0', () => {
    expect(scoreTier(0)).toBe('low')
  })
})

describe('ListingCard', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    mockSetFavorite.mockResolvedValue(makeListing())
    mockSetHidden.mockResolvedValue(makeListing())
    mockDeleteListing.mockResolvedValue(makeListing())
  })

  it('renders title, price, location, year/make/model, and mileage', () => {
    renderCard({
      title: '2015 Honda Civic',
      price_amount: 8500,
      currency: 'USD',
      location_text: 'Portland, OR',
      year: 2015,
      make: 'Honda',
      model: 'Civic',
      mileage: 62000,
    })

    expect(screen.getByRole('heading', { name: '2015 Honda Civic' })).toBeInTheDocument()
    expect(screen.getByText('$8,500')).toBeInTheDocument()
    expect(screen.getByText('Portland, OR')).toBeInTheDocument()
    expect(screen.getByText('2015 Honda Civic · 62,000 mi')).toBeInTheDocument()
  })

  it('shows a placeholder when there are no images', () => {
    renderCard({ images: [] })
    expect(document.querySelector('.listing-card-image-placeholder')).toBeInTheDocument()
    expect(document.querySelector('img')).not.toBeInTheDocument()
  })

  it('renders the cover image when images exist', () => {
    renderCard()
    const img = document.querySelector('img')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/images/1.jpg')
  })

  it('shows a score badge with the correct tier class when a score exists', () => {
    renderCard({ scores: [makeScore({ match_score: 80 })] })
    const badge = screen.getByText('80')
    expect(badge).toHaveClass('score-high')
  })

  it('shows a mid-tier score badge class', () => {
    renderCard({ scores: [makeScore({ match_score: 60 })] })
    expect(screen.getByText('60')).toHaveClass('score-mid')
  })

  it('shows a low-tier score badge class', () => {
    renderCard({ scores: [makeScore({ match_score: 20 })] })
    expect(screen.getByText('20')).toHaveClass('score-low')
  })

  it('shows no score badge when scores is empty', () => {
    renderCard({ scores: [] })
    expect(document.querySelector('.score-badge')).not.toBeInTheDocument()
  })

  it('does not show a status line for a live, non-sold, non-pending listing', () => {
    renderCard({ is_live: true, is_sold: false, is_pending: false })
    expect(document.querySelector('.listing-card-status')).not.toBeInTheDocument()
  })

  it('shows "Sold" when the listing is sold', () => {
    renderCard({ is_sold: true })
    expect(screen.getByText('Sold')).toBeInTheDocument()
  })

  it('shows "Pending" when the listing is pending', () => {
    renderCard({ is_sold: false, is_pending: true })
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('shows "Removed" when the listing is not live and not sold/pending', () => {
    renderCard({ is_sold: false, is_pending: false, is_live: false })
    expect(screen.getByText('Removed')).toBeInTheDocument()
  })

  it('prioritizes "Sold" over "Pending" when both are true', () => {
    renderCard({ is_sold: true, is_pending: true })
    expect(screen.getByText('Sold')).toBeInTheDocument()
    expect(screen.queryByText('Pending')).not.toBeInTheDocument()
  })

  it('toggles favorite: calls onChange optimistically and the api client', async () => {
    const { onChange, listing } = renderCard({ is_favorite: false, title: '2015 Honda Civic' })
    fireEvent.click(screen.getByTitle('Favorite'))

    expect(onChange).toHaveBeenCalledWith(listing.id, { is_favorite: true })
    await waitFor(() => expect(mockSetFavorite).toHaveBeenCalledWith(listing.id, true))
    // The card is rendered at a single "/" route; if the click had navigated via
    // the wrapping Link, the route would no longer match and this would unmount.
    expect(screen.getByRole('heading', { name: '2015 Honda Civic' })).toBeInTheDocument()
  })

  it('toggles favorite off when already favorited', async () => {
    const { onChange, listing } = renderCard({ is_favorite: true })
    fireEvent.click(screen.getByTitle('Unfavorite'))

    expect(onChange).toHaveBeenCalledWith(listing.id, { is_favorite: false })
    await waitFor(() => expect(mockSetFavorite).toHaveBeenCalledWith(listing.id, false))
  })

  it('calls onActionError when setFavorite rejects', async () => {
    mockSetFavorite.mockRejectedValueOnce(new Error('network error'))
    const { onActionError } = renderCard({ is_favorite: false })
    fireEvent.click(screen.getByTitle('Favorite'))

    await waitFor(() =>
      expect(onActionError).toHaveBeenCalledWith('Failed to update favorite. Refreshing list.'),
    )
  })

  it('toggles hidden: calls onChange optimistically and the api client', async () => {
    const { onChange, listing } = renderCard({ is_hidden: false, title: '2015 Honda Civic' })
    fireEvent.click(screen.getByTitle('Hide'))

    expect(onChange).toHaveBeenCalledWith(listing.id, { is_hidden: true })
    await waitFor(() => expect(mockSetHidden).toHaveBeenCalledWith(listing.id, true))
    expect(screen.getByRole('heading', { name: '2015 Honda Civic' })).toBeInTheDocument()
  })

  it('toggles hidden off when already hidden', async () => {
    const { onChange, listing } = renderCard({ is_hidden: true })
    fireEvent.click(screen.getByTitle('Unhide'))

    expect(onChange).toHaveBeenCalledWith(listing.id, { is_hidden: false })
    await waitFor(() => expect(mockSetHidden).toHaveBeenCalledWith(listing.id, false))
  })

  it('calls onActionError when setHidden rejects', async () => {
    mockSetHidden.mockRejectedValueOnce(new Error('network error'))
    const { onActionError } = renderCard({ is_hidden: false })
    fireEvent.click(screen.getByTitle('Hide'))

    await waitFor(() =>
      expect(onActionError).toHaveBeenCalledWith('Failed to update hidden state. Refreshing list.'),
    )
  })

  it('deletes only when window.confirm is accepted', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { onChange, listing } = renderCard()
    fireEvent.click(screen.getByTitle('Delete'))

    expect(window.confirm).toHaveBeenCalledWith(
      'Delete this listing? It will not reappear in future searches.',
    )
    expect(onChange).toHaveBeenCalledWith(listing.id, { is_deleted: true })
    await waitFor(() => expect(mockDeleteListing).toHaveBeenCalledWith(listing.id))
  })

  it('does not delete when window.confirm is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { onChange } = renderCard({ title: '2015 Honda Civic' })
    fireEvent.click(screen.getByTitle('Delete'))

    expect(window.confirm).toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    expect(mockDeleteListing).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: '2015 Honda Civic' })).toBeInTheDocument()
  })

  it('calls onActionError when deleteListing rejects', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockDeleteListing.mockRejectedValueOnce(new Error('network error'))
    const { onActionError } = renderCard()
    fireEvent.click(screen.getByTitle('Delete'))

    await waitFor(() =>
      expect(onActionError).toHaveBeenCalledWith('Failed to delete listing. Refreshing list.'),
    )
  })
})
