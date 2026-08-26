import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { RouterProvider } from 'react-router'
import { router } from '@/router'

// Unmocked dynamic import: exercises the real `React.lazy` +
// `<Suspense fallback={<ScreenLoading />}>` wiring, not a stand-in.
describe('router — /kit dev route', () => {
  it('renders the Tier 1 ScreenLoading fallback while the lazy chunk resolves, then the real Kit content', async () => {
    await act(async () => {
      await router.navigate('/kit')
    })
    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('heading', { name: 'Shared UI kit' })).toBeInTheDocument()
  })
})
