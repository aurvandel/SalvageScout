import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithRouter } from '../test/testUtils'
import ListingFeed from './ListingFeed'
import * as client from '../api/client'
import { makeListing } from '../test/fixtures'

vi.mock('../api/client')

describe('ListingFeed', () => {
  const mockFetchListings = vi.mocked(client.fetchListings)
  const mockFetchSearchFilters = vi.mocked(client.fetchSearchFilters)
  let alertSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSearchFilters.mockResolvedValue([])
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    alertSpy.mockRestore()
  })

  describe('initial load', () => {
    it('renders loading state on mount', () => {
      mockFetchListings.mockImplementation(
        () => new Promise(() => {}), // never resolves
      )

      renderWithRouter(<ListingFeed />, { route: "/", path: "/" })
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders listings from API on successful load', async () => {
      const listing1 = makeListing({ id: 1, title: 'Honda Civic' })
      const listing2 = makeListing({ id: 2, title: 'Toyota Corolla' })

      mockFetchListings.mockResolvedValue({
        items: [listing1, listing2],
        has_more: false,
      })

      renderWithRouter(<ListingFeed />, { route: "/", path: "/" })

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      expect(screen.getByText('Honda Civic')).toBeInTheDocument()
      expect(screen.getByText('Toyota Corolla')).toBeInTheDocument()
    })

    it('calls fetchListings with correct initial parameters', async () => {
      mockFetchListings.mockResolvedValue({ items: [], has_more: false })

      renderWithRouter(<ListingFeed />, { route: "/", path: "/" })

      await waitFor(() => {
        expect(mockFetchListings).toHaveBeenCalledWith({
          minScore: undefined,
          view: 'active',
          limit: 24,
          offset: 0,
        })
      })
    })
  })

  describe('error state', () => {
    it('renders error message on fetch rejection', async () => {
      mockFetchListings.mockRejectedValue(new Error('Network error'))

      renderWithRouter(<ListingFeed />, { route: "/", path: "/" })

      await waitFor(() => {
        expect(screen.getByText(/Failed to load listings: Network error/)).toBeInTheDocument()
      })
    })

    it('does not render loading state when error occurs', async () => {
      mockFetchListings.mockRejectedValue(new Error('API error'))

      renderWithRouter(<ListingFeed />, { route: "/", path: "/" })

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
        expect(screen.getByText(/Failed to load listings/)).toBeInTheDocument()
      })
    })
  })

  describe('empty state', () => {
    it('renders empty message when API returns no items', async () => {
      mockFetchListings.mockResolvedValue({ items: [], has_more: false })

      renderWithRouter(<ListingFeed />, { route: "/", path: "/" })

      await waitFor(() => {
        expect(screen.getByText('No listings yet.')).toBeInTheDocument()
      })
    })

    it('does not render empty message when listings present', async () => {
      const listing = makeListing({ title: 'Car Title' })
      mockFetchListings.mockResolvedValue({ items: [listing], has_more: false })

      renderWithRouter(<ListingFeed />, { route: "/", path: "/" })

      await waitFor(() => {
        expect(screen.queryByText('No listings yet.')).not.toBeInTheDocument()
        expect(screen.getByText('Car Title')).toBeInTheDocument()
      })
    })
  })

  describe('view tabs', () => {
    it('renders all three view tabs', async () => {
      mockFetchListings.mockResolvedValue({ items: [], has_more: false })

      renderWithRouter(<ListingFeed />, { route: "/", path: "/" })

      expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Favorites' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Hidden' })).toBeInTheDocument()
    })

    it('fetches with correct view param on tab click', async () => {
      mockFetchListings.mockResolvedValue({ items: [], has_more: false })
      const user = userEvent.setup()

      renderWithRouter(<ListingFeed />, { route: "/", path: "/" })

      await waitFor(() => {
        expect(mockFetchListings).toHaveBeenCalled()
      })

      mockFetchListings.mockClear()

      const favoritesButton = screen.getByRole('button', { name: 'Favorites' })
      await user.click(favoritesButton)

      await waitFor(() => {
        expect(mockFetchListings).toHaveBeenCalledWith({
          minScore: undefined,
          view: 'favorites',
          limit: 24,
          offset: 0,
        })
      })
    })

    it('resets offset to 0 when switching views', async () => {
      const listing = makeListing()
      mockFetchListings.mockResolvedValue({ items: [listing], has_more: true })
      const user = userEvent.setup()

      renderWithRouter(<ListingFeed />, { route: "/", path: "/" })

      await waitFor(() => {
        expect(mockFetchListings).toHaveBeenCalled()
      })

      mockFetchListings.mockClear()

      const hiddenButton = screen.getByRole('button', { name: 'Hidden' })
      await user.click(hiddenButton)

      await waitFor(() => {
        const calls = mockFetchListings.mock.calls
        expect(calls[calls.length - 1][0].offset).toBe(0)
      })
    })

    it('marks active view tab with active class', async () => {
      mockFetchListings.mockResolvedValue({ items: [], has_more: false })
      const user = userEvent.setup()

      renderWithRouter(<ListingFeed />, { route: "/", path: "/" })

      let activeButton = screen.getByRole('button', { name: 'Active' })
      expect(activeButton).toHaveClass('active')

      await user.click(screen.getByRole('button', { name: 'Favorites' }))

      await waitFor(() => {
        const favoritesButton = screen.getByRole('button', { name: 'Favorites' })
        expect(favoritesButton).toHaveClass('active')
        activeButton = screen.getByRole('button', { name: 'Active' })
        expect(activeButton).not.toHaveClass('active')
      })
    })
  })

  describe('min score filter', () => {
    it('includes minScore in fetch when value entered', async () => {
      mockFetchListings.mockResolvedValue({ items: [], has_more: false })
      const user = userEvent.setup()

      renderWithRouter(<ListingFeed />, { route: "/", path: "/" })

      await waitFor(() => {
        expect(mockFetchListings).toHaveBeenCalled()
      })

      mockFetchListings.mockClear()

      const input = screen.getByRole('spinbutton', { name: /Min score/i })
      await user.type(input, '75')

      await waitFor(() => {
        const lastCall = mockFetchListings.mock.calls.at(-1)
        expect(lastCall?.[0].minScore).toBe(75)
      })
    })

    it('omits minScore when input cleared', async () => {
      mockFetchListings.mockResolvedValue({ items: [], has_more: false })
      const user = userEvent.setup()

      renderWithRouter(<ListingFeed />, { route: "/", path: "/" })

      await waitFor(() => {
        expect(mockFetchListings).toHaveBeenCalled()
      })

      const input = screen.getByRole('spinbutton', { name: /Min score/i }) as HTMLInputElement
      await user.type(input, '50')

      await waitFor(() => {
        expect(input.value).toBe('50')
      })

      mockFetchListings.mockClear()

      await user.clear(input)

      await waitFor(() => {
        const lastCall = mockFetchListings.mock.calls.at(-1)
        expect(lastCall?.[0].minScore).toBeUndefined()
      })
    })

    it('keeps minScore when view changes', async () => {
      mockFetchListings.mockResolvedValue({ items: [], has_more: false })
      const user = userEvent.setup()

      renderWithRouter(<ListingFeed />, { route: "/", path: "/" })

      await waitFor(() => {
        expect(mockFetchListings).toHaveBeenCalled()
      })

      const input = screen.getByRole('spinbutton', { name: /Min score/i })
      await user.type(input, '60')

      mockFetchListings.mockClear()

      const favoritesButton = screen.getByRole('button', { name: 'Favorites' })
      await user.click(favoritesButton)

      await waitFor(() => {
        const lastCall = mockFetchListings.mock.calls.at(-1)
        expect(lastCall?.[0].minScore).toBe(60)
        expect(lastCall?.[0].view).toBe('favorites')
      })
    })
  })

  describe('infinite scroll', () => {
    it('renders sentinel when has_more is true', async () => {
      mockFetchListings.mockResolvedValue({
        items: [makeListing()],
        has_more: true,
      })

      renderWithRouter(<ListingFeed />, { route: "/", path: "/" })

      await waitFor(() => {
        const sentinel = document.querySelector('.feed-sentinel')
        expect(sentinel).toBeInTheDocument()
      })
    })

    it('does not render sentinel when has_more is false', async () => {
      mockFetchListings.mockResolvedValue({
        items: [makeListing()],
        has_more: false,
      })

      renderWithRouter(<ListingFeed />, { route: "/", path: "/" })

      await waitFor(() => {
        const sentinel = document.querySelector('.feed-sentinel')
        expect(sentinel).not.toBeInTheDocument()
      })
    })
  })
})
