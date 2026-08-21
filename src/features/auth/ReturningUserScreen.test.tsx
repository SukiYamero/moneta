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

  it('calls login() from "use another account" too', async () => {
    const login = vi.fn()
    useAuthStore.setState({ login })
    render(<ReturningUserScreen />)
    await userEvent.click(await screen.findByRole('button', { name: /usar otra cuenta/i }))
    expect(login).toHaveBeenCalledOnce()
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
  // data actually survived — worded conditionally rather than asserted
  // unconditionally (the export's own dishonest-UI gap).
  it('words the reassurance line conditionally rather than asserting data is present', async () => {
    render(<ReturningUserScreen />)
    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument())
    expect(screen.getByText(/si tenías datos guardados/i)).toBeInTheDocument()
  })
})
