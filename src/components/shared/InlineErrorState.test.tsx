import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineErrorState } from '@/components/shared/InlineErrorState'

describe('InlineErrorState', () => {
  it('announces the message assertively and invokes onRetry from the retry button', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <InlineErrorState message="No pudimos cargar" retryLabel="Reintentar" onRetry={onRetry} />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar')

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(onRetry).toHaveBeenCalledOnce()
  })
})
