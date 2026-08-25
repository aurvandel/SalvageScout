import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

export function renderWithRouter(
  ui: ReactElement,
  { route = '/', path = '/' }: { route?: string; path?: string } = {},
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={path} element={ui} />
      </Routes>
    </MemoryRouter>,
  )
}
