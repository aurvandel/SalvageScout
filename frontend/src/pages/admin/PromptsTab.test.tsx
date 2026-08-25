import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/react'
import PromptsTab from './PromptsTab'
import * as client from '../../api/client'

vi.mock('../../api/client')

const mockProfiles = [
  {
    id: 1,
    name: 'High-End SUV Finder',
    prompt_text: 'You are a car buyer evaluating SUVs...',
    weights: { price_weight: 0.3, mileage_weight: 0.7 },
    is_active: true,
    version: 2,
    created_at: '2025-01-15T10:00:00Z',
  },
  {
    id: 2,
    name: 'Budget Sedan Finder',
    prompt_text: 'You are looking for affordable sedans...',
    weights: { price_weight: 0.8, mileage_weight: 0.2 },
    is_active: false,
    version: 1,
    created_at: '2025-01-10T10:00:00Z',
  },
]

describe('PromptsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders and loads criteria profiles', async () => {
    vi.mocked(client.fetchCriteriaProfiles).mockResolvedValueOnce(mockProfiles)

    render(<PromptsTab />)

    await waitFor(() => {
      expect(screen.getByText('Scoring Prompts')).toBeInTheDocument()
    })

    expect(vi.mocked(client.fetchCriteriaProfiles)).toHaveBeenCalledOnce()
  })

  it('displays list of criteria profiles sorted by version descending', async () => {
    vi.mocked(client.fetchCriteriaProfiles).mockResolvedValueOnce(mockProfiles)

    render(<PromptsTab />)

    await waitFor(() => {
      expect(screen.getByText('High-End SUV Finder')).toBeInTheDocument()
      expect(screen.getByText('Budget Sedan Finder')).toBeInTheDocument()
    })

    const rows = screen.getAllByText(/v\d+/)
    expect(rows[0]).toHaveTextContent('v2')
  })

  it('shows active badge for active profile', async () => {
    vi.mocked(client.fetchCriteriaProfiles).mockResolvedValueOnce(mockProfiles)

    render(<PromptsTab />)

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument()
    })
  })

  it('displays empty state when no profiles exist', async () => {
    vi.mocked(client.fetchCriteriaProfiles).mockResolvedValueOnce([])

    render(<PromptsTab />)

    await waitFor(() => {
      expect(screen.getByText('No criteria profiles yet. Create one below.')).toBeInTheDocument()
    })
  })

  it('creates new prompt profile', async () => {
    const newProfile = {
      id: 3,
      name: 'New Prompt',
      prompt_text: 'New prompt text',
      weights: {},
      is_active: false,
      version: 3,
      created_at: '2025-01-20T10:00:00Z',
    }

    vi.mocked(client.fetchCriteriaProfiles).mockResolvedValueOnce(mockProfiles)
    vi.mocked(client.createCriteriaProfile).mockResolvedValueOnce(newProfile)
    vi.mocked(client.fetchCriteriaProfiles).mockResolvedValueOnce([newProfile, ...mockProfiles])

    render(<PromptsTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Profile Name')).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText('Profile Name') as HTMLInputElement
    const promptInput = screen.getByLabelText('Scoring Prompt') as HTMLTextAreaElement

    await userEvent.type(nameInput, 'New Prompt')
    await userEvent.type(promptInput, 'New prompt text')

    const saveButton = screen.getByRole('button', { name: /Save Prompt/ })
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(vi.mocked(client.createCriteriaProfile)).toHaveBeenCalledWith({
        name: 'New Prompt',
        prompt_text: 'New prompt text',
        weights: {},
        is_active: false,
      })
    })
  })

  it('shows error when name or prompt text is empty', async () => {
    vi.mocked(client.fetchCriteriaProfiles).mockResolvedValueOnce([])

    render(<PromptsTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Profile Name')).toBeInTheDocument()
    })

    const saveButton = screen.getByRole('button', { name: /Save Prompt/ })
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Name and prompt text are required')).toBeInTheDocument()
    })
  })

  it('creates new version from existing profile', async () => {
    const newProfile = {
      id: 3,
      name: 'High-End SUV Finder',
      prompt_text: 'Updated prompt text...',
      weights: { price_weight: 0.3, mileage_weight: 0.7 },
      is_active: false,
      version: 3,
      created_at: '2025-01-20T10:00:00Z',
    }

    vi.mocked(client.fetchCriteriaProfiles).mockResolvedValueOnce(mockProfiles)
    vi.mocked(client.createCriteriaProfile).mockResolvedValueOnce(newProfile)
    vi.mocked(client.fetchCriteriaProfiles).mockResolvedValueOnce([newProfile, ...mockProfiles])

    render(<PromptsTab />)

    await waitFor(() => {
      expect(screen.getByText('High-End SUV Finder')).toBeInTheDocument()
    })

    const newVersionButtons = screen.getAllByRole('button', { name: /New Version/ })
    const firstNewVersionButton = newVersionButtons[0]
    await userEvent.click(firstNewVersionButton)

    const promptInput = screen.getByLabelText('Scoring Prompt') as HTMLTextAreaElement
    expect(promptInput.value).toContain('You are a car buyer evaluating SUVs')

    await userEvent.clear(promptInput)
    await userEvent.type(promptInput, 'Updated prompt text...')

    const saveButton = screen.getByRole('button', { name: /Save Prompt/ })
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(vi.mocked(client.createCriteriaProfile)).toHaveBeenCalledWith({
        name: 'High-End SUV Finder',
        prompt_text: 'Updated prompt text...',
        weights: { price_weight: 0.3, mileage_weight: 0.7 },
        is_active: false,
      })
    })
  })

  it('activates a criteria profile', async () => {
    const updatedProfile = { ...mockProfiles[1], is_active: true }

    vi.mocked(client.fetchCriteriaProfiles).mockResolvedValueOnce(mockProfiles)
    vi.mocked(client.activateCriteriaProfile).mockResolvedValueOnce(updatedProfile)
    vi.mocked(client.fetchCriteriaProfiles).mockResolvedValueOnce([
      { ...mockProfiles[0], is_active: false },
      updatedProfile,
    ])

    render(<PromptsTab />)

    await waitFor(() => {
      expect(screen.getByText('Budget Sedan Finder')).toBeInTheDocument()
    })

    const activateButtons = screen.getAllByRole('button', { name: /Activate/ })
    await userEvent.click(activateButtons[0])

    await waitFor(() => {
      expect(vi.mocked(client.activateCriteriaProfile)).toHaveBeenCalledWith(2)
    })
  })

  it('disables activate button for active profile', async () => {
    vi.mocked(client.fetchCriteriaProfiles).mockResolvedValueOnce(mockProfiles)

    render(<PromptsTab />)

    await waitFor(() => {
      expect(screen.getByText('High-End SUV Finder')).toBeInTheDocument()
    })

    const activateButtons = screen.queryAllByRole('button', { name: /Activate/ })
    expect(activateButtons).toHaveLength(1)
  })

  it('sets is_active flag when checkbox is checked', async () => {
    const newProfile = {
      id: 3,
      name: 'New Prompt',
      prompt_text: 'New prompt text',
      weights: {},
      is_active: true,
      version: 3,
      created_at: '2025-01-20T10:00:00Z',
    }

    vi.mocked(client.fetchCriteriaProfiles).mockResolvedValueOnce(mockProfiles)
    vi.mocked(client.createCriteriaProfile).mockResolvedValueOnce(newProfile)
    vi.mocked(client.fetchCriteriaProfiles).mockResolvedValueOnce([newProfile, ...mockProfiles])

    render(<PromptsTab />)

    await waitFor(() => {
      expect(screen.getByLabelText('Profile Name')).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText('Profile Name') as HTMLInputElement
    const promptInput = screen.getByLabelText('Scoring Prompt') as HTMLTextAreaElement
    const activeCheckbox = screen.getByLabelText(/Set as active immediately/) as HTMLInputElement

    await userEvent.type(nameInput, 'New Prompt')
    await userEvent.type(promptInput, 'New prompt text')
    await userEvent.click(activeCheckbox)

    const saveButton = screen.getByRole('button', { name: /Save Prompt/ })
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(vi.mocked(client.createCriteriaProfile)).toHaveBeenCalledWith({
        name: 'New Prompt',
        prompt_text: 'New prompt text',
        weights: {},
        is_active: true,
      })
    })
  })
})
