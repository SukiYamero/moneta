import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuestAdoptionPrompt } from '@/features/auth/GuestAdoptionPrompt'
import { useAuthStore } from '@/lib/authStore'

const originalState = useAuthStore.getState()

afterEach(() => {
  useAuthStore.setState(originalState, true)
})

describe('GuestAdoptionPrompt', () => {
  it('renders nothing when there is no pending offer — the overwhelmingly common case', () => {
    useAuthStore.setState({ pendingAdoption: null })
    render(<GuestAdoptionPrompt />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('names the real count, not a vague "your data"', () => {
    useAuthStore.setState({ pendingAdoption: { profileId: 'p1', count: 12 } })
    render(<GuestAdoptionPrompt />)
    expect(screen.getByText(/12/)).toBeInTheDocument()
  })

  it('says what "no" means before any choice is made', () => {
    useAuthStore.setState({ pendingAdoption: { profileId: 'p1', count: 3 } })
    render(<GuestAdoptionPrompt />)
    expect(screen.getByText(/propio perfil/i)).toBeInTheDocument()
  })

  it('accepting calls acceptGuestAdoption', async () => {
    const acceptGuestAdoption = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ pendingAdoption: { profileId: 'p1', count: 3 }, acceptGuestAdoption })
    render(<GuestAdoptionPrompt />)
    await userEvent.click(screen.getByRole('button', { name: /sí, agregarlos/i }))
    expect(acceptGuestAdoption).toHaveBeenCalledOnce()
  })

  it('declining calls declineGuestAdoption and never touches acceptGuestAdoption', async () => {
    const acceptGuestAdoption = vi.fn()
    const declineGuestAdoption = vi.fn()
    useAuthStore.setState({
      pendingAdoption: { profileId: 'p1', count: 3 },
      acceptGuestAdoption,
      declineGuestAdoption,
    })
    render(<GuestAdoptionPrompt />)
    await userEvent.click(screen.getByRole('button', { name: /no, dejarlos/i }))
    expect(declineGuestAdoption).toHaveBeenCalledOnce()
    expect(acceptGuestAdoption).not.toHaveBeenCalled()
  })

  it('shows a busy state and disables both actions while adding', () => {
    useAuthStore.setState({
      pendingAdoption: { profileId: 'p1', count: 3 },
      adoptionBusy: true,
    })
    render(<GuestAdoptionPrompt />)
    expect(screen.getByRole('button', { name: /agregando/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /no, dejarlos/i })).toBeDisabled()
  })

  it('shows an error message without dismissing the prompt, so the offer stays available to retry', () => {
    useAuthStore.setState({
      pendingAdoption: { profileId: 'p1', count: 3 },
      adoptionError: 'boom',
    })
    render(<GuestAdoptionPrompt />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('clicking the backdrop does not dismiss the prompt — only its own two buttons can', async () => {
    const user = userEvent.setup()
    const declineGuestAdoption = vi.fn()
    useAuthStore.setState({ pendingAdoption: { profileId: 'p1', count: 3 }, declineGuestAdoption })
    render(<GuestAdoptionPrompt />)

    const backdrop = document.querySelector('[aria-hidden="true"]') as Element
    await user.click(backdrop)

    expect(declineGuestAdoption).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('pressing Escape does not dismiss the prompt — only its own two buttons can', async () => {
    const declineGuestAdoption = vi.fn()
    useAuthStore.setState({ pendingAdoption: { profileId: 'p1', count: 3 }, declineGuestAdoption })
    render(<GuestAdoptionPrompt />)

    await userEvent.keyboard('{Escape}')

    expect(declineGuestAdoption).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
