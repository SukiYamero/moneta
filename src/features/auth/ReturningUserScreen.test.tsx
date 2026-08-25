import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
      expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument(),
    )
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }))
    expect(login).toHaveBeenCalledOnce()
  })

  // Regression test for the defect the user found: this screen used to render
  // a second, differently-labeled button ("Usar otra cuenta") that called the
  // exact same login() as the primary CTA — a control promising a different
  // outcome and delivering the identical one. specs.md §10.36 removed it
  // rather than reproduce the guest cliff (§10.25/§10.31/§10.32/§10.33) by
  // routing it into guest mode instead. This would have failed on `main`.
  it('renders exactly one action — no second control duplicating the primary CTA', async () => {
    render(<ReturningUserScreen />)
    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument())
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /otra cuenta/i })).not.toBeInTheDocument()
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

  it('never offers a guest option', async () => {
    render(<ReturningUserScreen />)
    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /invitado/i })).not.toBeInTheDocument()
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
