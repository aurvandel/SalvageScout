import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

vi.mock('./pages/ListingFeed', () => ({ default: () => <div>Feed Stub</div> }))
vi.mock('./pages/ListingDetail', () => ({ default: () => <div>Detail Stub</div> }))
vi.mock('./pages/AdminPanel', () => ({ default: () => <div>Admin Stub</div> }))

afterEach(() => {
  cleanup()
})

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

  it('renders the ListingDetail stub at /listings/:id', () => {
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

  it('renders the nav brand and links', () => {
    renderApp(['/'])
    expect(screen.getByRole('link', { name: 'SalvageScout' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Listings' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin')
  })

  it('navigates from Listings to Admin via nav links', () => {
    renderApp(['/'])
    expect(screen.getByText('Feed Stub')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Admin' }))

    expect(screen.getByText('Admin Stub')).toBeInTheDocument()
    expect(screen.queryByText('Feed Stub')).not.toBeInTheDocument()
  })

  it('navigates back to Listings via the brand link', () => {
    renderApp(['/admin'])
    expect(screen.getByText('Admin Stub')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'SalvageScout' }))

    expect(screen.getByText('Feed Stub')).toBeInTheDocument()
    expect(screen.queryByText('Admin Stub')).not.toBeInTheDocument()
  })

  it('navigates from Admin to Listings via the Listings nav link', () => {
    renderApp(['/admin'])
    expect(screen.getByText('Admin Stub')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Listings' }))

    expect(screen.getByText('Feed Stub')).toBeInTheDocument()
    expect(screen.queryByText('Admin Stub')).not.toBeInTheDocument()
  })
})
