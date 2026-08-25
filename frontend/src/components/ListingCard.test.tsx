import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ListingCard, { scoreTier } from './ListingCard'
import { renderWithRouter } from '../test/testUtils'
import { makeListing, makeScore } from '../test/fixtures'
import * as client from '../api/client'

vi.mock('../api/client', () => ({
  setFavorite: vi.fn(),
  setHidden: vi.fn(),
  deleteListing: vi.fn(),
}))

describe('ListingCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('renders listing title', () => {
      const listing = makeListing({ title: '2015 Honda Civic' })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      expect(screen.getByRole('heading', { name: '2015 Honda Civic' })).toBeInTheDocument()
    })

    it('renders formatted price', () => {
      const listing = makeListing({ price_amount: 8500, currency: 'USD' })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      expect(screen.getByText('$8,500')).toBeInTheDocument()
    })

    it('renders year, make, model, and mileage', () => {
      const listing = makeListing({
        year: 2015,
        make: 'Honda',
        model: 'Civic',
        mileage: 62000,
      })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      expect(screen.getByText(/2015 Honda Civic · 62,000 mi/)).toBeInTheDocument()
    })

    it('renders location text', () => {
      const listing = makeListing({ location_text: 'Portland, OR' })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      expect(screen.getByText('Portland, OR')).toBeInTheDocument()
    })
  })

  describe('image handling', () => {
    it('renders image when available', () => {
      const listing = makeListing({
        title: 'Test Vehicle',
        images: [{ id: 1, image_url: 'https://example.com/image.jpg', local_path: '', position: 0 }],
      })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      expect(screen.getByAltText('Test Vehicle')).toBeInTheDocument()
      expect(screen.getByAltText('Test Vehicle')).toHaveAttribute('src', 'https://example.com/image.jpg')
    })

    it('shows placeholder when no images', () => {
      const listing = makeListing({ images: [] })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      const placeholder = document.querySelector('.listing-card-image-placeholder')
      expect(placeholder).toBeInTheDocument()
    })
  })

  describe('score badge', () => {
    it('shows score badge with high tier class for score >= 75', () => {
      const listing = makeListing({
        scores: [makeScore({ match_score: 80 })],
      })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      const badge = screen.getByText('80')
      expect(badge).toHaveClass('score-badge', 'score-high')
    })

    it('shows score badge with mid tier class for 50 <= score < 75', () => {
      const listing = makeListing({
        scores: [makeScore({ match_score: 60 })],
      })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      const badge = screen.getByText('60')
      expect(badge).toHaveClass('score-badge', 'score-mid')
    })

    it('shows score badge with low tier class for score < 50', () => {
      const listing = makeListing({
        scores: [makeScore({ match_score: 30 })],
      })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      const badge = screen.getByText('30')
      expect(badge).toHaveClass('score-badge', 'score-low')
    })

    it('does not show score badge when scores is empty', () => {
      const listing = makeListing({
        scores: [],
      })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      expect(document.querySelector('.score-badge')).toBeNull()
    })
  })

  describe('status line', () => {
    it('shows "Sold" status when is_sold is true', () => {
      const listing = makeListing({ is_sold: true })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      expect(screen.getByText('Sold')).toBeInTheDocument()
    })

    it('shows "Pending" status when is_pending is true', () => {
      const listing = makeListing({ is_pending: true, is_sold: false })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      expect(screen.getByText('Pending')).toBeInTheDocument()
    })

    it('shows "Removed" status when is_live is false', () => {
      const listing = makeListing({ is_live: false, is_sold: false, is_pending: false })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      expect(screen.getByText('Removed')).toBeInTheDocument()
    })

    it('does not show status line when active', () => {
      const listing = makeListing({ is_sold: false, is_pending: false, is_live: true })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      expect(screen.queryByText('Sold')).not.toBeInTheDocument()
      expect(screen.queryByText('Pending')).not.toBeInTheDocument()
      expect(screen.queryByText('Removed')).not.toBeInTheDocument()
    })
  })

  describe('favorite button', () => {
    it('toggles favorite state optimistically and calls setFavorite', async () => {
      const listing = makeListing({ id: 1, is_favorite: false })
      const onChange = vi.fn()
      const onActionError = vi.fn()
      vi.mocked(client.setFavorite).mockResolvedValue(makeListing({ id: 1, is_favorite: true }))

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      const favoriteButton = screen.getByTitle('Favorite')
      await userEvent.click(favoriteButton)

      expect(onChange).toHaveBeenCalledWith(1, { is_favorite: true })
      await waitFor(() => {
        expect(client.setFavorite).toHaveBeenCalledWith(1, true)
      })
    })

    it('calls onActionError when setFavorite fails', async () => {
      const listing = makeListing({ id: 1, is_favorite: false })
      const onChange = vi.fn()
      const onActionError = vi.fn()
      vi.mocked(client.setFavorite).mockRejectedValue(new Error('Network error'))

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      const favoriteButton = screen.getByTitle('Favorite')
      await userEvent.click(favoriteButton)

      await waitFor(() => {
        expect(onActionError).toHaveBeenCalledWith('Failed to update favorite. Refreshing list.')
      })
    })

    it('shows filled star when is_favorite is true', () => {
      const listing = makeListing({ is_favorite: true })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      expect(screen.getByTitle('Unfavorite')).toHaveTextContent('★')
    })

    it('shows empty star when is_favorite is false', () => {
      const listing = makeListing({ is_favorite: false })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      expect(screen.getByTitle('Favorite')).toHaveTextContent('☆')
    })
  })

  describe('hide button', () => {
    it('toggles hidden state optimistically and calls setHidden', async () => {
      const listing = makeListing({ id: 1, is_hidden: false })
      const onChange = vi.fn()
      const onActionError = vi.fn()
      vi.mocked(client.setHidden).mockResolvedValue(makeListing({ id: 1, is_hidden: true }))

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      const hideButton = screen.getByTitle('Hide')
      await userEvent.click(hideButton)

      expect(onChange).toHaveBeenCalledWith(1, { is_hidden: true })
      await waitFor(() => {
        expect(client.setHidden).toHaveBeenCalledWith(1, true)
      })
    })

    it('calls onActionError when setHidden fails', async () => {
      const listing = makeListing({ id: 1, is_hidden: false })
      const onChange = vi.fn()
      const onActionError = vi.fn()
      vi.mocked(client.setHidden).mockRejectedValue(new Error('Network error'))

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      const hideButton = screen.getByTitle('Hide')
      await userEvent.click(hideButton)

      await waitFor(() => {
        expect(onActionError).toHaveBeenCalledWith('Failed to update hidden state. Refreshing list.')
      })
    })

    it('shows filled circle when is_hidden is true', () => {
      const listing = makeListing({ is_hidden: true })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      expect(screen.getByTitle('Unhide')).toHaveTextContent('◉')
    })

    it('shows empty circle when is_hidden is false', () => {
      const listing = makeListing({ is_hidden: false })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      expect(screen.getByTitle('Hide')).toHaveTextContent('◎')
    })
  })

  describe('delete button', () => {
    it('calls window.confirm and deletes on confirm', async () => {
      const listing = makeListing({ id: 1 })
      const onChange = vi.fn()
      const onActionError = vi.fn()
      vi.mocked(client.deleteListing).mockResolvedValue(makeListing({ id: 1, is_deleted: true }))

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      const deleteButton = screen.getByTitle('Delete')
      await userEvent.click(deleteButton)

      expect(confirmSpy).toHaveBeenCalledWith('Delete this listing? It will not reappear in future searches.')
      expect(onChange).toHaveBeenCalledWith(1, { is_deleted: true })
      await waitFor(() => {
        expect(client.deleteListing).toHaveBeenCalledWith(1)
      })

      confirmSpy.mockRestore()
    })

    it('does not delete when window.confirm is cancelled', async () => {
      const listing = makeListing({ id: 1 })
      const onChange = vi.fn()
      const onActionError = vi.fn()

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      const deleteButton = screen.getByTitle('Delete')
      await userEvent.click(deleteButton)

      expect(confirmSpy).toHaveBeenCalled()
      expect(onChange).not.toHaveBeenCalled()
      expect(client.deleteListing).not.toHaveBeenCalled()

      confirmSpy.mockRestore()
    })

    it('calls onActionError when deleteListing fails', async () => {
      const listing = makeListing({ id: 1 })
      const onChange = vi.fn()
      const onActionError = vi.fn()
      vi.mocked(client.deleteListing).mockRejectedValue(new Error('Network error'))

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      renderWithRouter(
        <ListingCard listing={listing} onChange={onChange} onActionError={onActionError} />,
      )

      const deleteButton = screen.getByTitle('Delete')
      await userEvent.click(deleteButton)

      await waitFor(() => {
        expect(onActionError).toHaveBeenCalledWith('Failed to delete listing. Refreshing list.')
      })

      confirmSpy.mockRestore()
    })
  })
})

describe('scoreTier', () => {
  it('returns "high" for score >= 75', () => {
    expect(scoreTier(75)).toBe('high')
    expect(scoreTier(76)).toBe('high')
    expect(scoreTier(100)).toBe('high')
  })

  it('returns "mid" for 50 <= score < 75', () => {
    expect(scoreTier(50)).toBe('mid')
    expect(scoreTier(74)).toBe('mid')
  })

  it('returns "low" for score < 50', () => {
    expect(scoreTier(0)).toBe('low')
    expect(scoreTier(49)).toBe('low')
    expect(scoreTier(1)).toBe('low')
  })

  it('handles boundary values correctly', () => {
    expect(scoreTier(74)).toBe('mid')
    expect(scoreTier(75)).toBe('high')
    expect(scoreTier(49)).toBe('low')
    expect(scoreTier(50)).toBe('mid')
  })
})
