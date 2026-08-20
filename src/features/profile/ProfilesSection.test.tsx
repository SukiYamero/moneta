import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { __clearRegistryForTests, getActiveProfile, registerProfile } from '@/lib/profiles'
import { ProfilesSection } from '@/features/profile/ProfilesSection'

afterEach(async () => {
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
})
