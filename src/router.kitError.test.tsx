import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { RouterProvider } from 'react-router'

// A dedicated file: `vi.mock` is hoisted and file-scoped, so mocking
// `@/routes/Kit` here can't leak into router.kit.test.tsx's real-import
// success-path test.
vi.mock('@/routes/Kit', () => {
  throw new Error('chunk failed to load')
})

describe('router — /kit dev route, lazy chunk failure', () => {
  it('still renders RouteErrorFallback (not a blank screen or a hang) when the lazy import rejects', async () => {
    const { router } = await import('@/router')

    await act(async () => {
      await router.navigate('/kit')
    })
    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('tuvo un problema inesperado')
  })
})
