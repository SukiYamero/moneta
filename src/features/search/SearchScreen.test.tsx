import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { SearchScreen } from '@/features/search/SearchScreen'

describe('SearchScreen', () => {
  it('renders a title and a back link to Home', () => {
    render(
      <MemoryRouter initialEntries={['/search']}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/search" element={<SearchScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /buscar/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /volver/i })).toHaveAttribute('href', '/')
  })
})
