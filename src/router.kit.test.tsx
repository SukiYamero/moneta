import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { RouterProvider } from 'react-router'
import { router } from '@/router'

// Real (unmocked) dynamic import of src/routes/Kit.tsx, exercising the
// actual `React.lazy` + `<Suspense fallback={<ScreenLoading />}>` wiring
// (src/router.tsx, src/routes/KitLazy.tsx) rather than a stand-in — proves
// the swap from react-router's own route-level `lazy` field still produces
// a real fallback-then-content transition for the dev-only route.
describe('router — /kit dev route', () => {
  it('renders the Tier 1 ScreenLoading fallback while the lazy chunk resolves, then the real Kit content', async () => {
    await act(async () => {
      await router.navigate('/kit')
    })
    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('heading', { name: 'Shared UI kit' })).toBeInTheDocument()
  })
})
