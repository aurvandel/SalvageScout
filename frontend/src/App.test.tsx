import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

vi.mock('./pages/ListingFeed', () => ({ default: () => <div>Feed Stub</div> }))
vi.mock('./pages/ListingDetail', () => ({ default: () => <div>Detail Stub</div> }))
vi.mock('./pages/AdminPanel', () => ({ default: () => <div>Admin Stub</div> }))

function renderApp(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  )
}

describe('App routing', () => {
  it('renders the ListingFeed stub at /', () => {
    renderApp(['/'])

    expect(screen.getByText('Feed Stub')).toBeInTheDocument()
    expect(screen.queryByText('Detail Stub')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin Stub')).not.toBeInTheDocument()
  })

  it('renders the ListingDetail stub at /listings/123', () => {
    renderApp(['/listings/123'])

    expect(screen.getByText('Detail Stub')).toBeInTheDocument()
    expect(screen.queryByText('Feed Stub')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin Stub')).not.toBeInTheDocument()
  })

  it('renders the AdminPanel stub at /admin', () => {
    renderApp(['/admin'])

    expect(screen.getByText('Admin Stub')).toBeInTheDocument()
    expect(screen.queryByText('Feed Stub')).not.toBeInTheDocument()
    expect(screen.queryByText('Detail Stub')).not.toBeInTheDocument()
  })

  it('renders the nav bar with brand and links on every route', () => {
    renderApp(['/'])

    expect(screen.getByText('SalvageScout')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Listings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument()
  })

  it('navigates from Listings to Admin when the Admin nav link is clicked', async () => {
    renderApp(['/'])

    expect(screen.getByText('Feed Stub')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Admin' }))

    expect(screen.getByText('Admin Stub')).toBeInTheDocument()
    expect(screen.queryByText('Feed Stub')).not.toBeInTheDocument()
  })

  it('navigates from Admin back to Listings when the Listings nav link is clicked', async () => {
    renderApp(['/admin'])

    expect(screen.getByText('Admin Stub')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Listings' }))

    expect(screen.getByText('Feed Stub')).toBeInTheDocument()
    expect(screen.queryByText('Admin Stub')).not.toBeInTheDocument()
  })

  it('navigates to Listings via the brand link', async () => {
    renderApp(['/admin'])

    expect(screen.getByText('Admin Stub')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'SalvageScout' }))

    expect(screen.getByText('Feed Stub')).toBeInTheDocument()
  })
})
