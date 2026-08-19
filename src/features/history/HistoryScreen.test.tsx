import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { HistoryScreen } from '@/features/history/HistoryScreen'

describe('HistoryScreen', () => {
  it('renders a title and a back link to Home', () => {
    render(
      <MemoryRouter initialEntries={['/history']}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/history" element={<HistoryScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /historial/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /volver/i })).toHaveAttribute('href', '/')
  })
})
