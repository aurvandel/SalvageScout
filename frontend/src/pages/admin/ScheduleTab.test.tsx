import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScheduleTab from './ScheduleTab'
import { fetchSchedulerConfig, updateSchedulerConfig, triggerSearch } from '../../api/client'
import type { SchedulerConfigOut } from '../../api/types'

vi.mock('../../api/client', () => ({
  fetchSchedulerConfig: vi.fn(),
  updateSchedulerConfig: vi.fn(),
  triggerSearch: vi.fn(),
}))

// vitest.config.ts does not set test.globals, so @testing-library/react's
// automatic afterEach cleanup (which relies on a global `afterEach`) is a
// no-op here; clean up explicitly to avoid renders leaking across tests.
afterEach(cleanup)

function makeConfig(overrides: Partial<SchedulerConfigOut> = {}): SchedulerConfigOut {
  return {
    id: 1,
    is_enabled: true,
    run_hour: 6,
    run_minute: 30,
    updated_at: '2026-08-01T12:00:00Z',
    ...overrides,
  }
}

const mockedFetchSchedulerConfig = vi.mocked(fetchSchedulerConfig)
const mockedUpdateSchedulerConfig = vi.mocked(updateSchedulerConfig)
const mockedTriggerSearch = vi.mocked(triggerSearch)

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})

describe('ScheduleTab', () => {
  it('shows a loading state before the config resolves', () => {
    mockedFetchSchedulerConfig.mockReturnValue(new Promise(() => {}))

    render(<ScheduleTab />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders the loaded config values', async () => {
    mockedFetchSchedulerConfig.mockResolvedValue(makeConfig())

    render(<ScheduleTab />)

    expect(await screen.findByLabelText('Hour (UTC)')).toHaveValue(6)
    expect(screen.getByLabelText('Minute')).toHaveValue(30)
    expect(screen.getByRole('checkbox', { name: /Enable Scheduler/ })).toBeChecked()
    expect(screen.getByText('Run time: 06:30 UTC')).toBeInTheDocument()
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
  })

  it('hides the time picker when the scheduler is disabled', async () => {
    const user = userEvent.setup()
    mockedFetchSchedulerConfig.mockResolvedValue(makeConfig({ is_enabled: true }))

    render(<ScheduleTab />)

    await screen.findByLabelText('Hour (UTC)')
    await user.click(screen.getByRole('checkbox', { name: /Enable Scheduler/ }))

    expect(screen.queryByLabelText('Hour (UTC)')).not.toBeInTheDocument()
    expect(screen.getByText(/Scheduler is disabled/)).toBeInTheDocument()
  })

  it('toggling enabled or changing the time does not save automatically', async () => {
    mockedFetchSchedulerConfig.mockResolvedValue(makeConfig())

    render(<ScheduleTab />)

    const hourInput = await screen.findByLabelText('Hour (UTC)')
    fireEvent.change(hourInput, { target: { value: '9' } })

    expect(mockedUpdateSchedulerConfig).not.toHaveBeenCalled()
  })

  it('saving calls updateSchedulerConfig with the edited form data', async () => {
    const user = userEvent.setup()
    mockedFetchSchedulerConfig.mockResolvedValue(makeConfig())
    mockedUpdateSchedulerConfig.mockResolvedValue(makeConfig({ run_hour: 9, run_minute: 15 }))

    render(<ScheduleTab />)

    const hourInput = await screen.findByLabelText('Hour (UTC)')
    fireEvent.change(hourInput, { target: { value: '9' } })

    const minuteInput = screen.getByLabelText('Minute')
    fireEvent.change(minuteInput, { target: { value: '15' } })

    await user.click(screen.getByRole('button', { name: /save configuration/i }))

    await waitFor(() => {
      expect(mockedUpdateSchedulerConfig).toHaveBeenCalledWith({
        is_enabled: true,
        run_hour: 9,
        run_minute: 15,
      })
    })
    expect(window.alert).toHaveBeenCalledWith('Scheduler configuration updated successfully!')
  })

  it('ignores out-of-range hour input and keeps the previous value', async () => {
    mockedFetchSchedulerConfig.mockResolvedValue(makeConfig({ run_hour: 6 }))

    render(<ScheduleTab />)

    const hourInput = await screen.findByLabelText('Hour (UTC)')
    // 99 is out of the 0-23 range, so the change handler should reject it and
    // the controlled input should keep displaying the last valid value.
    fireEvent.change(hourInput, { target: { value: '99' } })

    expect(hourInput).toHaveValue(6)
  })

  it('shows an error message when saving the config fails', async () => {
    const user = userEvent.setup()
    mockedFetchSchedulerConfig.mockResolvedValue(makeConfig())
    mockedUpdateSchedulerConfig.mockRejectedValue(new Error('save failed'))

    render(<ScheduleTab />)

    await screen.findByLabelText('Hour (UTC)')
    await user.click(screen.getByRole('button', { name: /save configuration/i }))

    expect(await screen.findByText('save failed')).toBeInTheDocument()
    expect(window.alert).not.toHaveBeenCalled()
  })

  it('shows an error message when loading the config fails', async () => {
    mockedFetchSchedulerConfig.mockRejectedValue(new Error('load failed'))

    render(<ScheduleTab />)

    expect(await screen.findByText('load failed')).toBeInTheDocument()
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('triggering a manual search calls triggerSearch and shows the success message', async () => {
    const user = userEvent.setup()
    mockedFetchSchedulerConfig.mockResolvedValue(makeConfig())
    mockedTriggerSearch.mockResolvedValue({ message: 'Search triggered across 3 filters' })

    render(<ScheduleTab />)

    await screen.findByLabelText('Hour (UTC)')
    await user.click(screen.getByRole('button', { name: /run now/i }))

    expect(await screen.findByText('✓ Search triggered across 3 filters')).toBeInTheDocument()
    expect(mockedTriggerSearch).toHaveBeenCalled()
  })

  it('shows an error message when triggering a manual search fails', async () => {
    const user = userEvent.setup()
    mockedFetchSchedulerConfig.mockResolvedValue(makeConfig())
    mockedTriggerSearch.mockRejectedValue(new Error('trigger failed'))

    render(<ScheduleTab />)

    await screen.findByLabelText('Hour (UTC)')
    await user.click(screen.getByRole('button', { name: /run now/i }))

    expect(await screen.findByText('trigger failed')).toBeInTheDocument()
  })
})
