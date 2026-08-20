import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { __clearRegistryForTests, getActiveProfile, registerProfile } from '@/lib/profiles'
import { ProfilesSection } from '@/features/profile/ProfilesSection'
import { useProfiles } from '@/features/profile/useProfiles'

// Defaults to the real hook (`importOriginal`) so the existing registry-backed
// tests below are untouched; only the anti-flash tests below reassign the
// mock's implementation to a fixed 'loading' return for their own render —
// never `mockReturnValueOnce`, which would fall through to the real
// (unmocked) hook mid-render and violate React's stable-hook-order rule.
const { realUseProfiles } = vi.hoisted(() => ({ realUseProfiles: vi.fn() }))
vi.mock('@/features/profile/useProfiles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/profile/useProfiles')>()
  realUseProfiles.mockImplementation(actual.useProfiles)
  return { ...actual, useProfiles: vi.fn(actual.useProfiles) }
})
const mUseProfiles = vi.mocked(useProfiles)

afterEach(async () => {
  mUseProfiles.mockImplementation(realUseProfiles)
  await __clearRegistryForTests()
})

describe('ProfilesSection', () => {
  it('renders the adopted default profile even when it is the only one', async () => {
    render(<ProfilesSection />)
    expect(await screen.findByText('Local')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('lists every profile and marks only the active one', async () => {
    await getActiveProfile()
    await registerProfile({
      id: 'p2',
      label: 'alex@example.com',
      kind: 'google',
      databaseName: 'kurobello-p2',
    })

    render(<ProfilesSection />)
    expect(await screen.findByText('alex@example.com')).toBeInTheDocument()
    expect(screen.getByText('Local')).toBeInTheDocument()
    // Only the most-recently-registered profile (p2) is marked active.
    expect(screen.getAllByText('Activo')).toHaveLength(1)
  })

  // Anti-flash gate (specs.md §10.9), same convention as SearchScreen's own
  // loading tests — `useProfiles` is mocked here because its real 'loading'
  // window (an IndexedDB read) is too brief to hold open under fake timers.
  it('shows nothing yet immediately while the registry read is pending, before the anti-flash delay elapses', () => {
    mUseProfiles.mockImplementation(() => ({
      status: 'loading',
      profiles: [],
      activeProfileId: null,
    }))
    vi.useFakeTimers()
    render(<ProfilesSection />)
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('shows the skeleton once the anti-flash delay elapses while the registry read is still pending', () => {
    mUseProfiles.mockImplementation(() => ({
      status: 'loading',
      profiles: [],
      activeProfileId: null,
    }))
    vi.useFakeTimers()
    render(<ProfilesSection />)
    act(() => vi.advanceTimersByTime(150))
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
    vi.useRealTimers()
  })
})
