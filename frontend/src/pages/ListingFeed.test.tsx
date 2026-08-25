import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ListingFeed from './ListingFeed'
import { fetchListings, setFavorite, setHidden } from '../api/client'
import { makeListing } from '../test/fixtures'
import type { ListingPage } from '../api/types'

vi.mock('../api/client')

const mockedFetchListings = vi.mocked(fetchListings)
const mockedSetFavorite = vi.mocked(setFavorite)
const mockedSetHidden = vi.mocked(setHidden)

function renderFeed() {
  return render(
    <MemoryRouter>
      <ListingFeed />
    </MemoryRouter>,
  )
}

function page(items = [makeListing()], hasMore = false): ListingPage {
  return { items, has_more: hasMore }
}

describe('ListingFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
  })

  it('renders listings from the API on initial load', async () => {
    mockedFetchListings.mockResolvedValue(
      page([makeListing({ id: 1, title: 'Civic' }), makeListing({ id: 2, title: 'Accord' })]),
    )

    renderFeed()

    expect(await screen.findByText('Civic')).toBeInTheDocument()
    expect(screen.getByText('Accord')).toBeInTheDocument()
  })

  it('shows a loading state while the fetch is pending', async () => {
    let resolveFn!: (p: ListingPage) => void
    mockedFetchListings.mockReturnValue(
      new Promise((resolve) => {
        resolveFn = resolve
      }),
    )

    renderFeed()
    expect(screen.getByText('Loading...')).toBeInTheDocument()

    resolveFn(page([]))
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
  })

  it('shows an error message when the fetch rejects', async () => {
    mockedFetchListings.mockRejectedValue(new Error('network down'))

    renderFeed()

    expect(await screen.findByText('Failed to load listings: network down')).toBeInTheDocument()
  })

  it('shows the empty state when the API returns no items', async () => {
    mockedFetchListings.mockResolvedValue(page([]))

    renderFeed()

    expect(await screen.findByText('No listings yet.')).toBeInTheDocument()
  })

  it('switching view tabs refetches with the new view and offset 0', async () => {
    mockedFetchListings.mockResolvedValue(page([]))
    renderFeed()
    await waitFor(() => expect(mockedFetchListings).toHaveBeenCalledTimes(1))
    expect(mockedFetchListings).toHaveBeenLastCalledWith({
      minScore: undefined,
      view: 'active',
      limit: 24,
      offset: 0,
    })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Favorites' }))

    await waitFor(() => expect(mockedFetchListings).toHaveBeenCalledTimes(2))
    expect(mockedFetchListings).toHaveBeenLastCalledWith({
      minScore: undefined,
      view: 'favorites',
      limit: 24,
      offset: 0,
    })
  })

  it('typing a min score refetches with minScore set, and clearing it omits minScore', async () => {
    mockedFetchListings.mockResolvedValue(page([]))
    renderFeed()
    await waitFor(() => expect(mockedFetchListings).toHaveBeenCalledTimes(1))

    const input = screen.getByLabelText('Min score')
    fireEvent.change(input, { target: { value: '50' } })

    await waitFor(() =>
      expect(mockedFetchListings).toHaveBeenLastCalledWith({
        minScore: 50,
        view: 'active',
        limit: 24,
        offset: 0,
      }),
    )

    fireEvent.change(input, { target: { value: '' } })

    await waitFor(() =>
      expect(mockedFetchListings).toHaveBeenLastCalledWith({
        minScore: undefined,
        view: 'active',
        limit: 24,
        offset: 0,
      }),
    )
  })

  it('shows an alert and reloads when a card action fails', async () => {
    const listing = makeListing({ id: 1, title: 'Civic', is_favorite: false })
    mockedFetchListings.mockResolvedValue(page([listing]))
    mockedSetFavorite.mockRejectedValue(new Error('boom'))

    renderFeed()
    await screen.findByText('Civic')

    const user = userEvent.setup()
    await user.click(screen.getByTitle('Favorite'))

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith('Failed to update favorite. Refreshing list.'),
    )
    await waitFor(() => expect(mockedFetchListings).toHaveBeenCalledTimes(2))
  })

  it('optimistically removes a listing from the Active view once it is hidden (belongsInView: active requires !is_hidden)', async () => {
    const listing = makeListing({ id: 7, title: 'Ridge Runner', is_hidden: false })
    mockedFetchListings.mockResolvedValue(page([listing]))
    mockedSetHidden.mockResolvedValue(listing)

    renderFeed()
    await screen.findByText('Ridge Runner')

    const user = userEvent.setup()
    await user.click(screen.getByTitle('Hide'))

    await waitFor(() => expect(screen.queryByText('Ridge Runner')).not.toBeInTheDocument())
  })

  it('renders a load-more sentinel when hasMore is true and omits it when false', async () => {
    mockedFetchListings.mockResolvedValue(page([makeListing({ id: 1 })], true))
    const { container } = renderFeed()
    await screen.findByText(makeListing().title)

    // Real IntersectionObserver-triggered infinite scroll isn't exercised here since
    // jsdom's IntersectionObserver polyfill (src/test/setup.ts) is a no-op stub — we only
    // assert the sentinel renders/doesn't render based on the hasMore state derived from
    // the mocked response.
    expect(container.querySelector('.feed-sentinel')).not.toBeNull()
    cleanup()

    mockedFetchListings.mockResolvedValue(page([makeListing({ id: 1 })], false))
    const { container: container2 } = renderFeed()
    await screen.findByText(makeListing().title)
    expect(container2.querySelector('.feed-sentinel')).toBeNull()
  })
})
