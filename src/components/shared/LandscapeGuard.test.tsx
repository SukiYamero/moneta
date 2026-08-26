import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LandscapeGuard } from '@/components/shared/LandscapeGuard'

vi.mock('@/lib/deviceStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/deviceStore')>()
  return { ...actual, hasSkippedLandscapeGate: vi.fn(), markLandscapeGateSkipped: vi.fn() }
})

import { hasSkippedLandscapeGate, markLandscapeGateSkipped } from '@/lib/deviceStore'

const mHasSkipped = vi.mocked(hasSkippedLandscapeGate)
const mMarkSkipped = vi.mocked(markLandscapeGateSkipped)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
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
  it('renders nothing in portrait', async () => {
    stubMatchMedia(false)
    mHasSkipped.mockResolvedValue(false)
    const { container } = render(<LandscapeGuard />)
    await waitFor(() => expect(mHasSkipped).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('blocks in landscape once the device has never dismissed it', async () => {
    stubMatchMedia(true)
    mHasSkipped.mockResolvedValue(false)
    render(<LandscapeGuard />)

    const guard = await screen.findByRole('status')
    expect(guard).toHaveTextContent('Gira tu teléfono')
    expect(guard).toHaveTextContent(
      'Esta app está pensada para usarse en vertical. Vuelve a ese modo para la mejor experiencia.',
    )
    expect(guard.className).toMatch(/(^|\s)fixed(\s|$)/)
    expect(guard.className).toMatch(/inset-0/)
  })

  it('renders nothing while the stored dismissal is still resolving, to avoid a flash', () => {
    stubMatchMedia(true)
    mHasSkipped.mockReturnValue(new Promise(() => {}))
    const { container } = render(<LandscapeGuard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('skip dismisses the gate immediately and persists the dismissal', async () => {
    const user = userEvent.setup()
    stubMatchMedia(true)
    mHasSkipped.mockResolvedValue(false)
    render(<LandscapeGuard />)

    await screen.findByRole('status')
    await user.click(screen.getByRole('button', { name: 'Omitir y continuar' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(mMarkSkipped).toHaveBeenCalledOnce()
  })

  it('stays dismissed on a device that already skipped, without waiting for a fresh tap', async () => {
    stubMatchMedia(true)
    mHasSkipped.mockResolvedValue(true)
    const { container } = render(<LandscapeGuard />)

    await waitFor(() => expect(mHasSkipped).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
