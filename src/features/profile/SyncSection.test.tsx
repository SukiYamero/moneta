import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAuthStore } from '@/lib/authStore'
import { useNetworkStore } from '@/lib/networkStore'
import { useOutboxStore } from '@/lib/outbox'
import { useSyncStore } from '@/lib/sync/engine'
import { SyncSection } from '@/features/profile/SyncSection'

vi.mock('@/lib/repoProvider', () => ({ getActiveProfileBinding: vi.fn(() => null) }))

const originalAuthState = useAuthStore.getState()

afterEach(() => {
  useAuthStore.setState(originalAuthState, true)
  useNetworkStore.setState({ online: true })
  useOutboxStore.setState({ dirty: false })
  useSyncStore.setState({
    phase: 'idle',
    pullProgress: null,
    lastError: null,
    lastPullSummary: null,
  })
})

describe('SyncSection', () => {
  it('renders nothing for a guest — no status row promising sync', () => {
    useAuthStore.setState({ status: 'guest', drive: null })
    const { container } = render(<SyncSection />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for a signed-in user who never connected Drive', () => {
    useAuthStore.setState({ status: 'authenticated', drive: null })
    const { container } = render(<SyncSection />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows "up to date" for a Drive-linked account with nothing pending', () => {
    useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
    render(<SyncSection />)
    expect(screen.getByText('Al día')).toBeInTheDocument()
  })

  it('shows "pending" when the outbox is dirty', () => {
    useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
    useOutboxStore.setState({ dirty: true })
    render(<SyncSection />)
    expect(screen.getByText('Cambios pendientes por sincronizar')).toBeInTheDocument()
  })

  it('shows "syncing" while a pull/push is in flight', () => {
    useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
    useSyncStore.setState({ phase: 'pulling' })
    render(<SyncSection />)
    expect(screen.getByText('Sincronizando…')).toBeInTheDocument()
  })

  it('shows the offline state, overriding whatever the sync indicator would otherwise say', () => {
    useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
    useNetworkStore.setState({ online: false })
    render(<SyncSection />)
    expect(screen.getByText('Sin conexión — se sincronizará al reconectar')).toBeInTheDocument()
  })

  it('shows "never synced" when the profile has no watermark yet', () => {
    useAuthStore.setState({ status: 'authenticated', drive: { folderId: 'F' } })
    render(<SyncSection />)
    expect(screen.getByText('Todavía no se sincronizó')).toBeInTheDocument()
  })
})
