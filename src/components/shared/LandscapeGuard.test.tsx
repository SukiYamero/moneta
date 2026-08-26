import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LandscapeGuard } from '@/components/shared/LandscapeGuard'
import { useLandscapeGateStore } from '@/lib/landscapeGateStore'

afterEach(() => {
  vi.unstubAllGlobals()
  useLandscapeGateStore.setState({ skippedThisSession: false })
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

  it('blocks immediately in landscape, with no async resolution delay', () => {
    stubMatchMedia(true)
    render(<LandscapeGuard />)

    const guard = screen.getByRole('status')
    expect(guard).toHaveTextContent('Gira tu teléfono')
    expect(guard).toHaveTextContent(
      'Esta app está pensada para usarse en vertical. Vuelve a ese modo para la mejor experiencia.',
    )
    expect(guard.className).toMatch(/(^|\s)fixed(\s|$)/)
    expect(guard.className).toMatch(/inset-0/)
  })

  it('skip dismisses the gate for the rest of the session', async () => {
    const user = userEvent.setup()
    stubMatchMedia(true)
    render(<LandscapeGuard />)

    await user.click(screen.getByRole('button', { name: 'Omitir y continuar' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('stays dismissed for further rotations in the same session', async () => {
    const user = userEvent.setup()
    stubMatchMedia(true)
    const { rerender } = render(<LandscapeGuard />)

    await user.click(screen.getByRole('button', { name: 'Omitir y continuar' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    stubMatchMedia(false)
    rerender(<LandscapeGuard />)
    stubMatchMedia(true)
    rerender(<LandscapeGuard />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('a fresh session (module state reset) shows the gate again', () => {
    stubMatchMedia(true)
    useLandscapeGateStore.setState({ skippedThisSession: true })
    const { rerender } = render(<LandscapeGuard />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    useLandscapeGateStore.setState({ skippedThisSession: false })
    rerender(<LandscapeGuard />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
