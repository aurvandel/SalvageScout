import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/react'
import SearchFiltersTab from './SearchFiltersTab'
import * as client from '../../api/client'

vi.mock('../../api/client')

const mockSearchFilters = [
  {
    id: 1,
    name: 'NY Sedans',
    is_active: true,
    search_mode: 'url' as const,
    search_url: 'https://www.facebook.com/marketplace/newyork/search/?query=sedan',
    location: null,
    query: null,
    min_price: null,
    max_price: null,
    radius_miles: null,
    days_listed: null,
    condition: null,
    results_limit: 100,
    criteria_profile_id: null,
    sort_by: null,
    delivery_method: null,
    availability: null,
    latitude: null,
    longitude: null,
  },
  {
    id: 2,
    name: 'CA Location Search',
    is_active: true,
    search_mode: 'location' as const,
    search_url: null,
    location: 'losangeles',
    query: 'pickup truck',
    min_price: 5000,
    max_price: 20000,
    radius_miles: 50,
    days_listed: 30,
    condition: 'used',
    results_limit: 150,
    criteria_profile_id: null,
    sort_by: null,
    delivery_method: null,
    availability: null,
    latitude: null,
    longitude: null,
  },
]

function mockSettings(provider: string) {
  vi.mocked(client.fetchSettings).mockResolvedValue({
    llm: {} as never,
    apify: {} as never,
    scraper: { provider, available_providers: ['apify', 'scrape_creators'], bright_data_api_key_masked: null, bright_data_enrichment_enabled: false, scrape_creators_api_key_masked: null, incompatible_filter_names: [] },
    notifications: {} as never,
  })
}

describe('SearchFiltersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(client.fetchCriteriaProfiles).mockResolvedValue([])
    mockSettings('apify')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('renders and loads search filters', async () => {
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce(mockSearchFilters)

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByText('Search Filters')).toBeInTheDocument()
    })

    expect(vi.mocked(client.fetchSearchFilters)).toHaveBeenCalledOnce()
  })

  it('displays list of search filters', async () => {
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce(mockSearchFilters)

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByText('NY Sedans')).toBeInTheDocument()
      expect(screen.getByText('CA Location Search')).toBeInTheDocument()
    })
  })

  it('shows URL for URL-mode filters and location+query for location-mode', async () => {
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce(mockSearchFilters)

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByText(/marketplace\/newyork\/search/)).toBeInTheDocument()
      expect(screen.getByText(/losangeles.*pickup truck/)).toBeInTheDocument()
    })
  })

  it('displays results limit badges', async () => {
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce(mockSearchFilters)

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByText('↓ 100')).toBeInTheDocument()
      expect(screen.getByText('↓ 150')).toBeInTheDocument()
    })
  })

  it('displays empty state when no filters exist', async () => {
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce([])

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByText('No search filters yet.')).toBeInTheDocument()
    })
  })

  it('creates new URL-mode filter', async () => {
    const newFilter = {
      id: 3,
      name: 'Test URL Filter',
      is_active: true,
      search_mode: 'url' as const,
      search_url: 'https://example.com/search',
      location: null,
      query: null,
      min_price: null,
      max_price: null,
      radius_miles: null,
      days_listed: null,
      condition: null,
      results_limit: 100,
      criteria_profile_id: null,
      sort_by: null,
      delivery_method: null,
      availability: null,
      latitude: null,
      longitude: null,
    }

    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce(mockSearchFilters)
    vi.mocked(client.createSearchFilter).mockResolvedValueOnce(newFilter)
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce([...mockSearchFilters, newFilter])

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText('Name') as HTMLInputElement
    await userEvent.type(nameInput, 'Test URL Filter')

    const modeSelect = screen.getByLabelText('Search Mode') as HTMLSelectElement
    expect(modeSelect.value).toBe('url')

    const urlInput = screen.getByLabelText('Facebook Marketplace Search URL') as HTMLInputElement
    await userEvent.type(urlInput, 'https://example.com/search')

    const addButton = screen.getByRole('button', { name: /Add Filter/ })
    await userEvent.click(addButton)

    await waitFor(() => {
      expect(vi.mocked(client.createSearchFilter)).toHaveBeenCalledWith({
        name: 'Test URL Filter',
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
        criteria_profile_id: null,
        sort_by: null,
        delivery_method: null,
        availability: null,
        latitude: null,
        longitude: null,
      })
    })
  })

  it('creates new location-mode filter with location parameters', async () => {
    const newFilter = {
      id: 3,
      name: 'Seattle Search',
      is_active: true,
      search_mode: 'location' as const,
      search_url: null,
      location: 'seattle',
      query: 'car',
      min_price: 1000,
      max_price: 10000,
      radius_miles: 25,
      days_listed: 7,
      condition: 'used',
      results_limit: 100,
      criteria_profile_id: null,
      sort_by: null,
      delivery_method: null,
      availability: null,
      latitude: null,
      longitude: null,
    }

    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce(mockSearchFilters)
    vi.mocked(client.createSearchFilter).mockResolvedValueOnce(newFilter)
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce([...mockSearchFilters, newFilter])

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText('Name') as HTMLInputElement
    await userEvent.type(nameInput, 'Seattle Search')

    const modeSelect = screen.getByLabelText('Search Mode') as HTMLSelectElement
    await userEvent.selectOptions(modeSelect, 'location')

    await waitFor(() => {
      expect(screen.getByLabelText('Location (Facebook city slug)')).toBeInTheDocument()
    })

    const locationInput = screen.getByLabelText('Location (Facebook city slug)') as HTMLInputElement
    await userEvent.type(locationInput, 'seattle')

    const queryInput = screen.getByLabelText('Search Query') as HTMLInputElement
    await userEvent.type(queryInput, 'car')

    const minPriceInput = screen.getByLabelText('Min Price') as HTMLInputElement
    await userEvent.type(minPriceInput, '1000')

    const maxPriceInput = screen.getByLabelText('Max Price') as HTMLInputElement
    await userEvent.type(maxPriceInput, '10000')

    const radiusInput = screen.getByLabelText('Radius (miles)') as HTMLInputElement
    await userEvent.type(radiusInput, '25')

    const daysInput = screen.getByLabelText('Days Listed') as HTMLInputElement
    await userEvent.type(daysInput, '7')

    const conditionInput = screen.getByLabelText('Condition') as HTMLInputElement
    await userEvent.type(conditionInput, 'used')

    const addButton = screen.getByRole('button', { name: /Add Filter/ })
    await userEvent.click(addButton)

    await waitFor(() => {
      expect(vi.mocked(client.createSearchFilter)).toHaveBeenCalledWith({
        name: 'Seattle Search',
        is_active: true,
        search_mode: 'location',
        search_url: null,
        location: 'seattle',
        query: 'car',
        min_price: 1000,
        max_price: 10000,
        radius_miles: 25,
        days_listed: 7,
        condition: 'used',
        results_limit: 100,
        criteria_profile_id: null,
        sort_by: null,
        delivery_method: null,
        availability: null,
        latitude: null,
        longitude: null,
      })
    })
  })

  it('hides location fields when switching to URL mode', async () => {
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce([])

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    const modeSelect = screen.getByLabelText('Search Mode') as HTMLSelectElement
    await userEvent.selectOptions(modeSelect, 'location')

    await waitFor(() => {
      expect(screen.getByLabelText('Location (Facebook city slug)')).toBeInTheDocument()
    })

    await userEvent.selectOptions(modeSelect, 'url')

    await waitFor(() => {
      expect(screen.queryByLabelText('Location (Facebook city slug)')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Facebook Marketplace Search URL')).toBeInTheDocument()
    })
  })

  it('shows location fields when switching to location mode', async () => {
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce([])

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    const modeSelect = screen.getByLabelText('Search Mode') as HTMLSelectElement
    expect(modeSelect.value).toBe('url')

    await userEvent.selectOptions(modeSelect, 'location')

    await waitFor(() => {
      expect(screen.getByLabelText('Location (Facebook city slug)')).toBeInTheDocument()
      expect(screen.getByLabelText('Search Query')).toBeInTheDocument()
      expect(screen.getByLabelText('Min Price')).toBeInTheDocument()
      expect(screen.getByLabelText('Condition')).toBeInTheDocument()
    })
  })

  it('shows ScrapeCreators-only fields as enum selects when that provider is active', async () => {
    mockSettings('scrape_creators')
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce([])

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    const modeSelect = screen.getByLabelText('Search Mode') as HTMLSelectElement
    await userEvent.selectOptions(modeSelect, 'location')

    await waitFor(() => {
      expect(screen.getByLabelText('Location (city, state)')).toBeInTheDocument()
      expect(screen.getByLabelText('Sort By')).toBeInTheDocument()
      expect(screen.getByLabelText('Delivery Method')).toBeInTheDocument()
      expect(screen.getByLabelText('Availability')).toBeInTheDocument()
    })

    expect((screen.getByLabelText('Condition') as HTMLSelectElement).tagName).toBe('SELECT')
    expect((screen.getByLabelText('Date Listed') as HTMLSelectElement).tagName).toBe('SELECT')
  })

  it('blanks an out-of-enum condition when editing an Apify-era filter under ScrapeCreators', async () => {
    // mockSearchFilters[1] carries condition='used' (the Apify-era admin UI
    // placeholder), which matches no ScrapeCreators <option>. With the old
    // startEdit the select would silently display "Any condition" while form
    // state (and thus the eventual save) still held 'used'. days_listed=30 is
    // a valid ScrapeCreators bucket, so it should survive unchanged —
    // asserting that guards against over-blanking valid values too.
    mockSettings('scrape_creators')
    vi.mocked(client.fetchSearchFilters)
      .mockResolvedValueOnce(mockSearchFilters)
      .mockResolvedValueOnce(mockSearchFilters)
    vi.mocked(client.updateSearchFilter).mockResolvedValueOnce(mockSearchFilters[1])

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByText('CA Location Search')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: /Edit/ })
    await userEvent.click(editButtons[1])

    const conditionSelect = await screen.findByLabelText('Condition') as HTMLSelectElement
    expect(conditionSelect.value).toBe('')
    const dateSelect = screen.getByLabelText('Date Listed') as HTMLSelectElement
    expect(dateSelect.value).toBe('30')

    const updateButton = screen.getByRole('button', { name: /Update Filter/ })
    await userEvent.click(updateButton)

    await waitFor(() => {
      const payload = vi.mocked(client.updateSearchFilter).mock.calls[0][1]
      expect(payload.condition).toBeNull()
      expect(payload.days_listed).toBe(30)
    })
  })

  it('hides ScrapeCreators-only fields and uses free-form condition/days for Apify', async () => {
    mockSettings('apify')
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce([])

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    const modeSelect = screen.getByLabelText('Search Mode') as HTMLSelectElement
    await userEvent.selectOptions(modeSelect, 'location')

    await waitFor(() => {
      expect(screen.getByLabelText('Location (Facebook city slug)')).toBeInTheDocument()
    })

    expect(screen.queryByLabelText('Sort By')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Delivery Method')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Availability')).not.toBeInTheDocument()
    expect((screen.getByLabelText('Condition') as HTMLInputElement).tagName).toBe('INPUT')
    expect((screen.getByLabelText('Days Listed') as HTMLInputElement).tagName).toBe('INPUT')
    expect(screen.queryByLabelText('Latitude')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Longitude')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Use My Location/ })).not.toBeInTheDocument()
  })

  it('fills latitude/longitude from geolocation when "Use My Location" is clicked', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({ coords: { latitude: 30.267153, longitude: -97.743057 } } as GeolocationPosition)
    })
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } })

    mockSettings('scrape_creators')
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce([])

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    const modeSelect = screen.getByLabelText('Search Mode') as HTMLSelectElement
    await userEvent.selectOptions(modeSelect, 'location')

    const useLocationButton = await screen.findByRole('button', { name: /Use My Location/ })
    await userEvent.click(useLocationButton)

    await waitFor(() => {
      expect((screen.getByLabelText('Latitude') as HTMLInputElement).value).toBe('30.267153')
      expect((screen.getByLabelText('Longitude') as HTMLInputElement).value).toBe('-97.743057')
    })

    vi.unstubAllGlobals()
  })

  it('shows an error when geolocation is denied', async () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError)
    })
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } })

    mockSettings('scrape_creators')
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce([])

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    const modeSelect = screen.getByLabelText('Search Mode') as HTMLSelectElement
    await userEvent.selectOptions(modeSelect, 'location')

    const useLocationButton = await screen.findByRole('button', { name: /Use My Location/ })
    await userEvent.click(useLocationButton)

    await waitFor(() => {
      expect(screen.getByText(/Couldn't get your location: User denied Geolocation/)).toBeInTheDocument()
    })

    vi.unstubAllGlobals()
  })

  it('shows an error when the browser has no geolocation support', async () => {
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined })

    mockSettings('scrape_creators')
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce([])

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    const modeSelect = screen.getByLabelText('Search Mode') as HTMLSelectElement
    await userEvent.selectOptions(modeSelect, 'location')

    const useLocationButton = await screen.findByRole('button', { name: /Use My Location/ })
    await userEvent.click(useLocationButton)

    await waitFor(() => {
      expect(screen.getByText(/doesn't support geolocation/)).toBeInTheDocument()
    })

    vi.unstubAllGlobals()
  })

  it('sends latitude/longitude in the create payload for ScrapeCreators', async () => {
    const createdFilter = {
      id: 5,
      name: 'Near Me',
      is_active: true,
      search_mode: 'location' as const,
      search_url: null,
      location: null,
      query: null,
      min_price: null,
      max_price: null,
      radius_miles: null,
      days_listed: null,
      condition: null,
      results_limit: 100,
      criteria_profile_id: null,
      sort_by: null,
      delivery_method: null,
      availability: null,
      latitude: 30.267153,
      longitude: -97.743057,
    }
    mockSettings('scrape_creators')
    vi.mocked(client.fetchSearchFilters)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([createdFilter])
    vi.mocked(client.createSearchFilter).mockResolvedValueOnce(createdFilter)

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText('Name'), 'Near Me')
    await userEvent.selectOptions(screen.getByLabelText('Search Mode'), 'location')

    const latInput = await screen.findByLabelText('Latitude')
    await userEvent.type(latInput, '30.267153')
    await userEvent.type(screen.getByLabelText('Longitude'), '-97.743057')

    await userEvent.click(screen.getByRole('button', { name: /Add Filter/ }))

    await waitFor(() => {
      const payload = vi.mocked(client.createSearchFilter).mock.calls[0][0]
      expect(payload.latitude).toBe(30.267153)
      expect(payload.longitude).toBe(-97.743057)
    })
  })

  it('edits existing filter', async () => {
    const updatedFilter = {
      ...mockSearchFilters[1],
      min_price: 7000,
    }

    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce(mockSearchFilters)
    vi.mocked(client.updateSearchFilter).mockResolvedValueOnce(updatedFilter)
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce(mockSearchFilters.map(f => f.id === 2 ? updatedFilter : f))

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByText('CA Location Search')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: /Edit/ })
    await userEvent.click(editButtons[1])

    await waitFor(() => {
      expect(screen.getByDisplayValue('CA Location Search')).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('5000')).toBeInTheDocument()

    const minPriceInput = screen.getByDisplayValue('5000') as HTMLInputElement
    await userEvent.clear(minPriceInput)
    await userEvent.type(minPriceInput, '7000')

    const updateButton = screen.getByRole('button', { name: /Update Filter/ })
    await userEvent.click(updateButton)

    await waitFor(() => {
      expect(vi.mocked(client.updateSearchFilter)).toHaveBeenCalled()
    })
  })

  it('deletes filter with confirmation', async () => {
    vi.mocked(client.fetchSearchFilters)
      .mockResolvedValueOnce(mockSearchFilters)
      .mockResolvedValueOnce(mockSearchFilters.filter(f => f.id !== 1))

    vi.mocked(client.deleteSearchFilter).mockResolvedValueOnce()

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByText('NY Sedans')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /Delete/ })
    await userEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(vi.mocked(client.deleteSearchFilter)).toHaveBeenCalledWith(1)
    })
  })

  it('does not delete filter if confirm is cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false)

    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce(mockSearchFilters)

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByText('NY Sedans')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /Delete/ })
    await userEvent.click(deleteButtons[0])

    expect(confirmSpy).toHaveBeenCalledWith('Delete this search filter?')
    expect(vi.mocked(client.deleteSearchFilter)).not.toHaveBeenCalled()
  })

  it('toggles filter active status', async () => {
    const toggledFilter = { ...mockSearchFilters[0], is_active: false }

    vi.mocked(client.fetchSearchFilters)
      .mockResolvedValueOnce(mockSearchFilters)
      .mockResolvedValueOnce(mockSearchFilters.map(f => f.id === 1 ? toggledFilter : f))

    vi.mocked(client.updateSearchFilter).mockResolvedValueOnce(toggledFilter)

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByText('NY Sedans')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])

    await waitFor(() => {
      expect(vi.mocked(client.updateSearchFilter)).toHaveBeenCalledWith(1, {
        ...mockSearchFilters[0],
        is_active: false,
      })
    })
  })

  it('sends full object to updateSearchFilter on toggle', async () => {
    const toggledFilter = { ...mockSearchFilters[0], is_active: false }

    vi.mocked(client.fetchSearchFilters)
      .mockResolvedValueOnce(mockSearchFilters)
      .mockResolvedValueOnce(mockSearchFilters.map(f => f.id === 1 ? toggledFilter : f))

    vi.mocked(client.updateSearchFilter).mockResolvedValueOnce(toggledFilter)

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByText('NY Sedans')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])

    await waitFor(() => {
      const callArg = vi.mocked(client.updateSearchFilter).mock.calls[0][1]
      expect(callArg.id).toBe(1)
      expect(callArg.is_active).toBe(false)
      expect(callArg.search_url).toBe(mockSearchFilters[0].search_url)
    })
  })

  it('resets form after save', async () => {
    const newFilter = {
      id: 3,
      name: 'New Filter',
      is_active: true,
      search_mode: 'url' as const,
      search_url: 'https://example.com',
      location: null,
      query: null,
      min_price: null,
      max_price: null,
      radius_miles: null,
      days_listed: null,
      condition: null,
      results_limit: 100,
      criteria_profile_id: null,
      sort_by: null,
      delivery_method: null,
      availability: null,
      latitude: null,
      longitude: null,
    }

    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce(mockSearchFilters)
    vi.mocked(client.createSearchFilter).mockResolvedValueOnce(newFilter)
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce([...mockSearchFilters, newFilter])

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText('Name') as HTMLInputElement
    await userEvent.type(nameInput, 'New Filter')

    const urlInput = screen.getByLabelText('Facebook Marketplace Search URL') as HTMLInputElement
    await userEvent.type(urlInput, 'https://example.com')

    const addButton = screen.getByRole('button', { name: /Add Filter/ })
    await userEvent.click(addButton)

    await waitFor(() => {
      expect(nameInput.value).toBe('')
      expect(urlInput.value).toBe('')
    })
  })

  it('disables add button when name is empty', async () => {
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce([])

    render(<SearchFiltersTab />)

    await waitFor(() => {
      const addButton = screen.getByRole('button', { name: /Add Filter/ }) as HTMLButtonElement
      expect(addButton.disabled).toBe(true)
    })
  })

  it('enables add button when name is filled', async () => {
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce([])

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText('Name') as HTMLInputElement
    await userEvent.type(nameInput, 'Test')

    const addButton = screen.getByRole('button', { name: /Add Filter/ }) as HTMLButtonElement
    await waitFor(() => {
      expect(addButton.disabled).toBe(false)
    })
  })

  it('shows cancel button only when editing', async () => {
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce(mockSearchFilters)

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByText('NY Sedans')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument()

    const editButtons = screen.getAllByRole('button', { name: /Edit/ })
    await userEvent.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument()
    })
  })

  it('resets form when cancel is clicked', async () => {
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce(mockSearchFilters)

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByText('NY Sedans')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole('button', { name: /Edit/ })
    await userEvent.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByDisplayValue('NY Sedans')).toBeInTheDocument()
    })

    const cancelButton = screen.getByRole('button', { name: /Cancel/ })
    await userEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument()
    })
  })

  it('handles delete errors', async () => {
    vi.mocked(client.fetchSearchFilters).mockResolvedValueOnce(mockSearchFilters)
    vi.mocked(client.deleteSearchFilter).mockRejectedValueOnce(new Error('Delete failed'))

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByText('NY Sedans')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /Delete/ })
    await userEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Delete failed')).toBeInTheDocument()
    })
  })

  it('handles load errors', async () => {
    vi.mocked(client.fetchSearchFilters).mockRejectedValueOnce(new Error('Load failed'))

    render(<SearchFiltersTab />)

    await waitFor(() => {
      expect(screen.getByText('Load failed')).toBeInTheDocument()
    })
  })
})
