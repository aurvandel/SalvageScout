import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchFiltersTab from './SearchFiltersTab'
import { createSearchFilter, deleteSearchFilter, fetchSearchFilters, updateSearchFilter } from '../../api/client'
import type { SearchFilterOut } from '../../api/types'

vi.mock('../../api/client')

const mockedFetchSearchFilters = vi.mocked(fetchSearchFilters)
const mockedCreateSearchFilter = vi.mocked(createSearchFilter)
const mockedUpdateSearchFilter = vi.mocked(updateSearchFilter)
const mockedDeleteSearchFilter = vi.mocked(deleteSearchFilter)

function makeSearchFilter(overrides: Partial<SearchFilterOut> = {}): SearchFilterOut {
  return {
    id: 1,
    name: 'Sedans near me',
    is_active: true,
    search_mode: 'url',
    search_url: 'https://www.facebook.com/marketplace/newyork/search/?query=sedan',
    location: null,
    query: null,
    min_price: null,
    max_price: null,
    radius_miles: null,
    days_listed: null,
    condition: null,
    results_limit: 100,
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
})

// This project's vitest.config.ts does not set `test.globals: true`, so React Testing
// Library's automatic afterEach(cleanup) never registers itself. Without this, DOM nodes
// from one test leak into the next within the same file. See final report for details.
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SearchFiltersTab', () => {
  it('renders the existing filters, showing url or location details based on search_mode', async () => {
    mockedFetchSearchFilters.mockResolvedValue([
      makeSearchFilter({ id: 1, name: 'URL filter', search_mode: 'url', search_url: 'https://fb.com/x' }),
      makeSearchFilter({
        id: 2,
        name: 'Location filter',
        search_mode: 'location',
        search_url: null,
        location: 'newyork',
        query: 'sedan',
        results_limit: 50,
      }),
    ])

    render(<SearchFiltersTab />)

    await waitFor(() => expect(screen.getByText('URL filter')).toBeInTheDocument())
    expect(screen.getByText('https://fb.com/x')).toBeInTheDocument()

    expect(screen.getByText('Location filter')).toBeInTheDocument()
    expect(screen.getByText('newyork · sedan')).toBeInTheDocument()

    expect(screen.getByText('↓ 100')).toBeInTheDocument()
    expect(screen.getByText('↓ 50')).toBeInTheDocument()
  })

  it('shows a placeholder message when there are no filters', async () => {
    mockedFetchSearchFilters.mockResolvedValue([])

    render(<SearchFiltersTab />)

    await waitFor(() => expect(screen.getByText('No search filters yet.')).toBeInTheDocument())
  })

  it('creates a new filter in url mode with the location-only fields nulled out', async () => {
    mockedFetchSearchFilters.mockResolvedValue([])
    mockedCreateSearchFilter.mockResolvedValue(makeSearchFilter())
    const user = userEvent.setup()

    render(<SearchFiltersTab />)
    await waitFor(() => expect(mockedFetchSearchFilters).toHaveBeenCalledTimes(1))

    await user.type(screen.getByLabelText('Name'), 'New Search')
    await user.type(screen.getByLabelText('Facebook Marketplace Search URL'), 'https://example.com/search')
    await user.click(screen.getByRole('button', { name: 'Add Filter' }))

    await waitFor(() =>
      expect(mockedCreateSearchFilter).toHaveBeenCalledWith({
        name: 'New Search',
        is_active: true,
        search_mode: 'url',
        search_url: 'https://example.com/search',
        location: null,
        query: null,
        min_price: null,
        max_price: null,
        radius_miles: null,
        days_listed: null,
        condition: null,
        results_limit: 100,
      }),
    )
    // Reloads the list after a successful save.
    await waitFor(() => expect(mockedFetchSearchFilters).toHaveBeenCalledTimes(2))
  })

  it('switches between url and location fields based on search_mode, and creates a location-mode filter', async () => {
    mockedFetchSearchFilters.mockResolvedValue([])
    mockedCreateSearchFilter.mockResolvedValue(makeSearchFilter())
    const user = userEvent.setup()

    render(<SearchFiltersTab />)
    await waitFor(() => expect(mockedFetchSearchFilters).toHaveBeenCalledTimes(1))

    // Starts in url mode: url field visible, location fields absent.
    expect(screen.getByLabelText('Facebook Marketplace Search URL')).toBeInTheDocument()
    expect(screen.queryByLabelText('Location (Facebook city slug)')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Search Mode'), 'location')

    expect(screen.queryByLabelText('Facebook Marketplace Search URL')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Location (Facebook city slug)')).toBeInTheDocument()
    expect(screen.getByLabelText('Search Query')).toBeInTheDocument()
    expect(screen.getByLabelText('Min Price')).toBeInTheDocument()
    expect(screen.getByLabelText('Max Price')).toBeInTheDocument()
    expect(screen.getByLabelText('Radius (miles)')).toBeInTheDocument()
    expect(screen.getByLabelText('Days Listed')).toBeInTheDocument()
    expect(screen.getByLabelText('Condition')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Name'), 'Location Search')
    await user.type(screen.getByLabelText('Location (Facebook city slug)'), 'chicago')
    await user.type(screen.getByLabelText('Search Query'), 'truck')
    await user.type(screen.getByLabelText('Min Price'), '1000')
    await user.type(screen.getByLabelText('Max Price'), '9000')

    await user.click(screen.getByRole('button', { name: 'Add Filter' }))

    await waitFor(() =>
      expect(mockedCreateSearchFilter).toHaveBeenCalledWith({
        name: 'Location Search',
        is_active: true,
        search_mode: 'location',
        search_url: null,
        location: 'chicago',
        query: 'truck',
        min_price: 1000,
        max_price: 9000,
        radius_miles: null,
        days_listed: null,
        condition: null,
        results_limit: 100,
      }),
    )
  })

  it('disables the submit button until a name is entered', async () => {
    mockedFetchSearchFilters.mockResolvedValue([])
    const user = userEvent.setup()

    render(<SearchFiltersTab />)
    await waitFor(() => expect(mockedFetchSearchFilters).toHaveBeenCalledTimes(1))

    expect(screen.getByRole('button', { name: 'Add Filter' })).toBeDisabled()
    await user.type(screen.getByLabelText('Name'), 'x')
    expect(screen.getByRole('button', { name: 'Add Filter' })).not.toBeDisabled()
  })

  it('populates the form for editing an existing filter and calls updateSearchFilter with the edited payload', async () => {
    const existing = makeSearchFilter({ id: 7, name: 'Edit me', search_mode: 'url', search_url: 'https://fb.com/orig', results_limit: 25 })
    mockedFetchSearchFilters.mockResolvedValue([existing])
    mockedUpdateSearchFilter.mockResolvedValue(existing)
    const user = userEvent.setup()

    render(<SearchFiltersTab />)
    await waitFor(() => expect(screen.getByText('Edit me')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByText('Edit Filter')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Edit me')
    expect(screen.getByLabelText('Facebook Marketplace Search URL')).toHaveValue('https://fb.com/orig')
    expect(screen.getByLabelText('Results Limit (per scrape)')).toHaveValue(25)

    const nameInput = screen.getByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Edited name')

    await user.click(screen.getByRole('button', { name: 'Update Filter' }))

    await waitFor(() =>
      expect(mockedUpdateSearchFilter).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ name: 'Edited name', search_mode: 'url', search_url: 'https://fb.com/orig' }),
      ),
    )
  })

  it('cancels an in-progress edit and resets the form', async () => {
    const existing = makeSearchFilter({ id: 7, name: 'Edit me' })
    mockedFetchSearchFilters.mockResolvedValue([existing])
    const user = userEvent.setup()

    render(<SearchFiltersTab />)
    await waitFor(() => expect(screen.getByText('Edit me')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByText('Edit Filter')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Add New Filter')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('')
  })

  it('deletes a filter only after the user confirms the browser dialog', async () => {
    const existing = makeSearchFilter({ id: 3, name: 'Delete candidate' })
    mockedFetchSearchFilters.mockResolvedValue([existing])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()

    render(<SearchFiltersTab />)
    await waitFor(() => expect(screen.getByText('Delete candidate')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(confirmSpy).toHaveBeenCalledWith('Delete this search filter?')
    expect(mockedDeleteSearchFilter).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    mockedDeleteSearchFilter.mockResolvedValue(undefined)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(mockedDeleteSearchFilter).toHaveBeenCalledWith(3))
    // Reloads after a successful delete.
    await waitFor(() => expect(mockedFetchSearchFilters).toHaveBeenCalledTimes(2))
  })

  it('shows an error message when delete fails', async () => {
    const existing = makeSearchFilter({ id: 3, name: 'Delete candidate' })
    mockedFetchSearchFilters.mockResolvedValue([existing])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockedDeleteSearchFilter.mockRejectedValue(new Error('cannot delete'))
    const user = userEvent.setup()

    render(<SearchFiltersTab />)
    await waitFor(() => expect(screen.getByText('Delete candidate')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.getByText('cannot delete')).toBeInTheDocument())
  })

  it('toggles is_active by sending the full filter with is_active flipped', async () => {
    const existing = makeSearchFilter({ id: 9, name: 'Togglable', is_active: true })
    mockedFetchSearchFilters.mockResolvedValue([existing])
    mockedUpdateSearchFilter.mockResolvedValue({ ...existing, is_active: false })
    const user = userEvent.setup()

    render(<SearchFiltersTab />)
    await waitFor(() => expect(screen.getByText('Togglable')).toBeInTheDocument())

    // "Active" also labels the checkbox in the create/edit form below, so scope to the filter row.
    const filterRow = screen.getByText('Togglable').closest('.filter-row') as HTMLElement
    await user.click(within(filterRow).getByRole('checkbox', { name: 'Active' }))

    await waitFor(() =>
      expect(mockedUpdateSearchFilter).toHaveBeenCalledWith(9, { ...existing, is_active: false }),
    )
    await waitFor(() => expect(mockedFetchSearchFilters).toHaveBeenCalledTimes(2))
  })

  it('shows an error message when the initial load fails', async () => {
    mockedFetchSearchFilters.mockRejectedValue(new Error('failed to reach server'))

    render(<SearchFiltersTab />)

    await waitFor(() => expect(screen.getByText('failed to reach server')).toBeInTheDocument())
  })
})
