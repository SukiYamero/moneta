import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LandscapeGuard } from '@/components/shared/LandscapeGuard'

afterEach(() => {
  vi.unstubAllGlobals()
})

const stubMatchMedia = (matches: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

describe('LandscapeGuard', () => {
  it('renders nothing in portrait', () => {
    stubMatchMedia(false)
    const { container } = render(<LandscapeGuard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a full-screen blocking status region in landscape', () => {
    stubMatchMedia(true)
    render(<LandscapeGuard />)
    const guard = screen.getByRole('status')
    expect(guard).toHaveTextContent('Gira tu teléfono')
    expect(guard).toHaveTextContent('Esta app está diseñada para usarse en vertical.')
    expect(guard.className).toMatch(/(^|\s)fixed(\s|$)/)
    expect(guard.className).toMatch(/inset-0/)
  })
})
