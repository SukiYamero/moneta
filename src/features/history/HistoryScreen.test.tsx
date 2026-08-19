import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HistoryScreen } from '@/features/history/HistoryScreen'

describe('HistoryScreen', () => {
  it('renders a title', () => {
    render(<HistoryScreen />)
    expect(screen.getByRole('heading', { name: /historial/i })).toBeInTheDocument()
  })
})
