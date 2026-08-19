import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { RouterProvider } from 'react-router'

// A dedicated file: `vi.mock` is hoisted and file-scoped, so mocking
// `@/routes/Kit` here can't leak into router.kit.test.tsx's real-import
// success-path test.
vi.mock('@/routes/Kit', () => {
  throw new Error('chunk failed to load')
})

// Vitest's default 5s budget is not enough for this one: the dynamic
// `import('@/router')` below pulls and transforms the whole route module
// graph inside the test itself, and three Wave 3 tracks independently hit a
// timeout here while sibling agent worktrees ran their own suites on the
// same machine. The assertion is event-based (`findByRole`), so the budget
// bounds transform time under CPU contention, not a race — raising it does
// not weaken what the test proves.
const CHUNK_FAILURE_TIMEOUT_MS = 30_000

describe('router — /kit dev route, lazy chunk failure', () => {
  it('still renders RouteErrorFallback (not a blank screen or a hang) when the lazy import rejects', async () => {
    const { router } = await import('@/router')

    await act(async () => {
      await router.navigate('/kit')
    })
    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('tuvo un problema inesperado')
  }, CHUNK_FAILURE_TIMEOUT_MS)
})
