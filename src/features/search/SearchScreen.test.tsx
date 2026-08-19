import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SearchScreen } from '@/features/search/SearchScreen'

describe('SearchScreen', () => {
  it('renders a title', () => {
    render(<SearchScreen />)
    expect(screen.getByRole('heading', { name: /buscar/i })).toBeInTheDocument()
  })
})
