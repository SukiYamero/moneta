import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReturningUserScreen } from '@/features/auth/ReturningUserScreen'
import { useAuthStore } from '@/lib/authStore'
import { __clearRegistryForTests, registerProfile } from '@/lib/profiles'

beforeEach(async () => {
  await __clearRegistryForTests()
  useAuthStore.setState({ status: 'idle', user: null, session: null, drive: null, error: null })
})

afterEach(async () => {
  await __clearRegistryForTests()
})

describe('ReturningUserScreen', () => {
  it('greets by first name once the registry resolves a known google profile', async () => {
    await registerProfile({
      id: 'g1',
      label: 'Alex Rivera',
      kind: 'google',
      databaseName: 'kurobello-g1',
      accountKey: 'sub-123',
    })
    render(<ReturningUserScreen />)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /hola de nuevo, alex/i })).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /continuar como alex/i })).toBeInTheDocument()
  })

  it('degrades to a generic greeting and CTA when the registry has no google profile', async () => {
    render(<ReturningUserScreen />)
    await waitFor(() => expect(screen.getByRole('heading')).toHaveTextContent(/hola de nuevo/i))
    expect(screen.queryByText(/hola de nuevo, /i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument()
  })

  it('shows the account name and an expired chip, never a fake email for a non-email accountKey', async () => {
    await registerProfile({
      id: 'g1',
      label: 'Alex Rivera',
      kind: 'google',
      databaseName: 'kurobello-g1',
      // A real GoogleUser.sub, not an email — authStore.ts prefers sub.
      accountKey: '10983475619872341',
    })
    render(<ReturningUserScreen />)
    await waitFor(() => expect(screen.getByText('Alex Rivera')).toBeInTheDocument())
    expect(screen.getByText(/caducada/i)).toBeInTheDocument()
    expect(screen.queryByText('10983475619872341')).not.toBeInTheDocument()
  })

  it('shows the email when the accountKey happens to look like one', async () => {
    await registerProfile({
      id: 'g1',
      label: 'Alex Rivera',
      kind: 'google',
      databaseName: 'kurobello-g1',
      accountKey: 'alex.rivera@gmail.com',
    })
    render(<ReturningUserScreen />)
    await waitFor(() => expect(screen.getByText('alex.rivera@gmail.com')).toBeInTheDocument())
  })

  it('ignores a more-recently-used local/guest profile and names the google account instead', async () => {
    await registerProfile({
      id: 'g1',
      label: 'Alex Rivera',
      kind: 'google',
      databaseName: 'kurobello-g1',
      accountKey: 'sub-123',
    })
    await registerProfile({ id: 'local-2', label: 'Local', kind: 'local', databaseName: 'x' })
    render(<ReturningUserScreen />)
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /hola de nuevo, alex/i })).toBeInTheDocument(),
    )
  })

  it('calls login() from the primary CTA', async () => {
    const login = vi.fn()
    useAuthStore.setState({ login })
    render(<ReturningUserScreen />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /continuar con google/i }))
    expect(login).toHaveBeenCalledOnce()
  })

  // §10.36 removed "Usar otra cuenta" because it called the identical
  // login() as the primary CTA — one control, two labels. §10.37 adds a
  // second action back, but a genuinely distinct one: guest entry, gated
  // behind a confirm dialog rather than a bare button, so the visible
  // action count stays at two honest, differently-behaving controls.
  it('renders exactly two actions — the primary CTA and the gated guest entry', async () => {
    render(<ReturningUserScreen />)
    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument())
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /otra cuenta/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /invitado/i })).toBeInTheDocument()
  })

  it('shows a busy state on the primary button while authenticating', async () => {
    useAuthStore.setState({ status: 'authenticating' })
    render(<ReturningUserScreen />)
    const button = await screen.findByRole('button', { name: /conectando/i })
    expect(button).toBeDisabled()
  })

  it('shows a Spanish, actionable error when the re-login fails — never the raw message', async () => {
    useAuthStore.setState({ status: 'error', error: 'auth: access_denied' })
    render(<ReturningUserScreen />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/cancelaste el inicio de sesión/i)
    expect(screen.queryByText(/access_denied/i)).not.toBeInTheDocument()
  })

  // specs.md §10.37: the user overruled §10.21's blanket "no guest option"
  // for this specific case (Google's own chooser already covers "use
  // another account"), on condition that the escape hatch is honest about
  // what it does — never a bare button that silently switches profiles.
  it('does not enter guest mode from a bare tap — it opens a confirm dialog first', async () => {
    const continueAsGuest = vi.fn()
    useAuthStore.setState({ continueAsGuest })
    render(<ReturningUserScreen />)
    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /invitado/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(continueAsGuest).not.toHaveBeenCalled()
  })

  it('calls continueAsGuest() only after the dialog is confirmed', async () => {
    const continueAsGuest = vi.fn()
    useAuthStore.setState({ continueAsGuest })
    render(<ReturningUserScreen />)
    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /invitado/i }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.click(within(dialog).getByRole('button', { name: /invitado/i }))

    expect(continueAsGuest).toHaveBeenCalledOnce()
  })

  it('cancelling the guest dialog closes it without entering guest mode', async () => {
    const continueAsGuest = vi.fn()
    useAuthStore.setState({ continueAsGuest })
    render(<ReturningUserScreen />)
    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /invitado/i }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.click(within(dialog).getByRole('button', { name: /^cancelar$/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(continueAsGuest).not.toHaveBeenCalled()
  })

  // The dialog is the one honest place left to say what guest mode does —
  // but §10.21's ban on repeating the first-run pitch/legal copy still
  // holds (§10.37): this is a warning about a consequence, not a second
  // welcome screen.
  it('the guest dialog explains the consequence without repeating first-run legal copy', async () => {
    render(<ReturningUserScreen />)
    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /invitado/i }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByRole('heading', { name: /invitado/i })).toBeInTheDocument()
    expect(screen.queryByText(/términos/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/política de privacidad/i)).not.toBeInTheDocument()
  })

  // specs.md §10.21: the reassurance line must be true whether or not local
  // data actually survived. "If you had data, it's still here" is not safe
  // wording — the login marker only proves a session once existed, so that
  // claim is false in exactly the eviction case the spec warns about. What
  // signing back in does to local data is verifiable without checking the
  // store at all: it never touches it.
  it('reassures with a claim that is true regardless of whether local data survived', async () => {
    render(<ReturningUserScreen />)
    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument())
    expect(screen.getByText(/no toca lo que ya está guardado/i)).toBeInTheDocument()
  })
})
