import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { RouterProvider } from 'react-router'

vi.mock('@/routes/Kit', () => {
  throw new Error('chunk failed to load')
})

const CHUNK_FAILURE_TIMEOUT_MS = 30_000

describe('router — /kit dev route, lazy chunk failure', () => {
  it(
    'still renders RouteErrorFallback (not a blank screen or a hang) when the lazy import rejects',
    async () => {
      const { router } = await import('@/router')

      await act(async () => {
        await router.navigate('/kit')
      })
      render(<RouterProvider router={router} />)

      expect(await screen.findByRole('alert')).toHaveTextContent('tuvo un problema inesperado')
    },
    CHUNK_FAILURE_TIMEOUT_MS,
  )
})
