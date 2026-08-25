import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminPanel from './AdminPanel'

// vitest.config.ts does not set test.globals, so @testing-library/react's
// automatic afterEach cleanup (which relies on a global `afterEach`) is a
// no-op here; clean up explicitly to avoid renders leaking across tests.
afterEach(cleanup)

vi.mock('./admin/LLMTab', () => ({ default: () => <div>LLM Stub</div> }))
vi.mock('./admin/ApifyTab', () => ({ default: () => <div>Apify Stub</div> }))
vi.mock('./admin/NotificationsTab', () => ({ default: () => <div>Notifications Stub</div> }))
vi.mock('./admin/SearchFiltersTab', () => ({ default: () => <div>Search Filters Stub</div> }))
vi.mock('./admin/ScheduleTab', () => ({ default: () => <div>Schedule Stub</div> }))
vi.mock('./admin/ArenaTab', () => ({ default: () => <div>Arena Stub</div> }))

const TAB_STUBS = [
  { label: 'LLM', stub: 'LLM Stub' },
  { label: 'Apify', stub: 'Apify Stub' },
  { label: 'Notifications', stub: 'Notifications Stub' },
  { label: 'Search Filters', stub: 'Search Filters Stub' },
  { label: 'Schedule', stub: 'Schedule Stub' },
  { label: 'Arena', stub: 'Arena Stub' },
]

describe('AdminPanel', () => {
  it('renders the default active tab (llm) on mount', () => {
    render(<AdminPanel />)

    expect(screen.getByText('LLM Stub')).toBeInTheDocument()
    for (const { stub } of TAB_STUBS.filter(t => t.stub !== 'LLM Stub')) {
      expect(screen.queryByText(stub)).not.toBeInTheDocument()
    }
  })

  it('marks the default llm tab button as active', () => {
    render(<AdminPanel />)

    expect(screen.getByRole('button', { name: 'LLM' })).toHaveClass('active')
    for (const { label } of TAB_STUBS.filter(t => t.label !== 'LLM')) {
      expect(screen.getByRole('button', { name: label })).not.toHaveClass('active')
    }
  })

  it.each(TAB_STUBS)('clicking the $label tab shows only its stub and marks it active', async ({ label, stub }) => {
    const user = userEvent.setup()
    render(<AdminPanel />)

    await user.click(screen.getByRole('button', { name: label }))

    expect(screen.getByText(stub)).toBeInTheDocument()
    for (const other of TAB_STUBS.filter(t => t.stub !== stub)) {
      expect(screen.queryByText(other.stub)).not.toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: label })).toHaveClass('active')
  })

  it('switches away from a previously active tab when a new tab is clicked', async () => {
    const user = userEvent.setup()
    render(<AdminPanel />)

    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(screen.getByText('Schedule Stub')).toBeInTheDocument()
    expect(screen.queryByText('LLM Stub')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'LLM' })).not.toHaveClass('active')

    await user.click(screen.getByRole('button', { name: 'Arena' }))
    expect(screen.getByText('Arena Stub')).toBeInTheDocument()
    expect(screen.queryByText('Schedule Stub')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Schedule' })).not.toHaveClass('active')
  })
})
