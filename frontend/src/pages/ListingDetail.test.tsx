import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ListingDetail from './ListingDetail'
import { renderWithRouter } from '../test/testUtils'
import { fetchListing, deleteListing, setFavorite, setHidden } from '../api/client'
import { makeListing, makeScore, makeImage } from '../test/fixtures'

const navigateMock = vi.fn()

vi.mock('../api/client')

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

const mockedFetchListing = vi.mocked(fetchListing)
const mockedDeleteListing = vi.mocked(deleteListing)
const mockedSetFavorite = vi.mocked(setFavorite)
const mockedSetHidden = vi.mocked(setHidden)

function renderDetail() {
  return renderWithRouter(<ListingDetail />, { route: '/listings/42', path: '/listings/:id' })
}

describe('ListingDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
  })

  it('shows a loading state before the fetch resolves', () => {
    mockedFetchListing.mockReturnValue(new Promise(() => {}))

    renderDetail()

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows an error message when the fetch rejects', async () => {
    mockedFetchListing.mockRejectedValue(new Error('not found'))

    renderDetail()

    expect(await screen.findByText('Failed to load listing: not found')).toBeInTheDocument()
  })

  it('renders title, price, specs, gallery sorted by position, and description', async () => {
    const listing = makeListing({
      title: 'Solid Civic',
      price_amount: 9000,
      currency: 'USD',
      year: 2015,
      make: 'Honda',
      model: 'Civic',
      mileage: 62000,
      condition: 'Used - good',
      location_text: 'Portland, OR',
      description: 'Great little car.',
      images: [
        makeImage({ id: 1, position: 2, image_url: 'https://example.com/2.jpg' }),
        makeImage({ id: 2, position: 0, image_url: 'https://example.com/0.jpg' }),
        makeImage({ id: 3, position: 1, image_url: 'https://example.com/1.jpg' }),
      ],
    })
    mockedFetchListing.mockResolvedValue(listing)

    const { container } = renderDetail()

    expect(await screen.findByText('Solid Civic')).toBeInTheDocument()
    expect(screen.getByText('$9,000')).toBeInTheDocument()
    expect(screen.getByText('2015')).toBeInTheDocument()
    expect(screen.getByText('Honda')).toBeInTheDocument()
    expect(screen.getByText('Civic')).toBeInTheDocument()
    expect(screen.getByText('62,000 mi')).toBeInTheDocument()
    expect(screen.getByText('Used - good')).toBeInTheDocument()
    expect(screen.getByText('Portland, OR')).toBeInTheDocument()
    expect(screen.getByText('Great little car.')).toBeInTheDocument()

    // Images have alt="" (decorative), which removes them from the accessibility tree's
    // "img" role, so query the DOM directly rather than via getAllByRole('img').
    const images = Array.from(container.querySelectorAll('img')) as HTMLImageElement[]
    expect(images.map((img) => img.src)).toEqual([
      'https://example.com/0.jpg',
      'https://example.com/1.jpg',
      'https://example.com/2.jpg',
    ])
  })

  it('omits optional spec fields when they are null', async () => {
    const listing = makeListing({
      year: null,
      make: null,
      model: null,
      mileage: null,
      condition: null,
      location_text: null,
    })
    mockedFetchListing.mockResolvedValue(listing)

    renderDetail()
    await screen.findByText(listing.title)

    expect(screen.queryByText('Year')).not.toBeInTheDocument()
    expect(screen.queryByText('Make')).not.toBeInTheDocument()
    expect(screen.queryByText('Model')).not.toBeInTheDocument()
    expect(screen.queryByText('Mileage')).not.toBeInTheDocument()
    expect(screen.queryByText('Condition')).not.toBeInTheDocument()
    expect(screen.queryByText('Location')).not.toBeInTheDocument()
  })

  it('does not render score subsections when pros/cons/dealbreakers are empty', async () => {
    const listing = makeListing({
      scores: [makeScore({ pros: [], cons: [], dealbreaker_flags: [] })],
    })
    mockedFetchListing.mockResolvedValue(listing)

    renderDetail()
    await screen.findByText(listing.title)

    expect(screen.queryByText('Pros')).not.toBeInTheDocument()
    expect(screen.queryByText('Cons')).not.toBeInTheDocument()
    expect(screen.queryByText('Dealbreakers')).not.toBeInTheDocument()
  })

  it('omits the description section when null', async () => {
    const listing = makeListing({ description: null })
    mockedFetchListing.mockResolvedValue(listing)

    renderDetail()
    await screen.findByText(listing.title)

    expect(screen.queryByText('Description')).not.toBeInTheDocument()
  })

  it('toggles favorite and calls the client with the flipped value', async () => {
    const listing = makeListing({ is_favorite: false })
    mockedFetchListing.mockResolvedValue(listing)
    mockedSetFavorite.mockResolvedValue(listing)

    renderDetail()
    await screen.findByText(listing.title)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '☆ Favorite' }))

    expect(mockedSetFavorite).toHaveBeenCalledWith(listing.id, true)
    expect(await screen.findByRole('button', { name: '★ Favorited' })).toBeInTheDocument()
  })

  it('toggles hidden and calls the client with the flipped value', async () => {
    const listing = makeListing({ is_hidden: false })
    mockedFetchListing.mockResolvedValue(listing)
    mockedSetHidden.mockResolvedValue(listing)

    renderDetail()
    await screen.findByText(listing.title)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '◎ Hide' }))

    expect(mockedSetHidden).toHaveBeenCalledWith(listing.id, true)
    expect(await screen.findByRole('button', { name: '◉ Unhide' })).toBeInTheDocument()
  })

  it('does nothing when the delete confirmation is cancelled', async () => {
    const listing = makeListing()
    mockedFetchListing.mockResolvedValue(listing)
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderDetail()
    await screen.findByText(listing.title)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '✕ Delete' }))

    expect(mockedDeleteListing).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('deletes and navigates to / when the confirmed delete succeeds', async () => {
    const listing = makeListing()
    mockedFetchListing.mockResolvedValue(listing)
    mockedDeleteListing.mockResolvedValue(listing)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderDetail()
    await screen.findByText(listing.title)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '✕ Delete' }))

    await waitFor(() => expect(mockedDeleteListing).toHaveBeenCalledWith(listing.id))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'))
  })

  it('shows an alert and does not navigate when delete fails', async () => {
    const listing = makeListing()
    mockedFetchListing.mockResolvedValue(listing)
    mockedDeleteListing.mockRejectedValue(new Error('boom'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderDetail()
    await screen.findByText(listing.title)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '✕ Delete' }))

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to delete listing.'))
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
