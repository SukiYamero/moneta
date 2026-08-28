import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RepoErrorCode } from '@/lib/repo'

vi.mock('@/lib/bootRecovery', () => ({ clearLocalDatabaseAndReload: vi.fn() }))

import { clearLocalDatabaseAndReload } from '@/lib/bootRecovery'
import { BootErrorScreen } from '@/features/boot/BootErrorScreen'

const mClearLocalDatabaseAndReload = vi.mocked(clearLocalDatabaseAndReload)

const NON_RECOVERABLE_CODES: RepoErrorCode[] = [
  'not_found',
  'invalid_input',
  'network',
  'unknown',
]

describe('BootErrorScreen', () => {
  beforeEach(() => {
    mClearLocalDatabaseAndReload.mockReset()
  })

  it('shows the recovery button only for a schema_mismatch failure', () => {
    render(<BootErrorScreen code="schema_mismatch" onRetry={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: 'Borrar datos locales y reintentar' }),
    ).toBeInTheDocument()
  })

  it.each(NON_RECOVERABLE_CODES)('hides the recovery button for a "%s" failure', (code) => {
    render(<BootErrorScreen code={code} onRetry={vi.fn()} />)
    expect(
      screen.queryByRole('button', { name: 'Borrar datos locales y reintentar' }),
    ).not.toBeInTheDocument()
  })

  it('gates the destructive action behind a confirm dialog — tapping the button alone deletes nothing', async () => {
    const user = userEvent.setup()
    render(<BootErrorScreen code="schema_mismatch" onRetry={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Borrar datos locales y reintentar' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(mClearLocalDatabaseAndReload).not.toHaveBeenCalled()
  })

  it('runs the delete-and-reload recovery only after the confirm dialog is accepted', async () => {
    const user = userEvent.setup()
    render(<BootErrorScreen code="schema_mismatch" onRetry={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Borrar datos locales y reintentar' }))
    await user.click(screen.getByRole('button', { name: 'Borrar y reintentar' }))

    expect(mClearLocalDatabaseAndReload).toHaveBeenCalledOnce()
  })

  it('cancelling the confirm dialog leaves the recovery action unrun', async () => {
    const user = userEvent.setup()
    render(<BootErrorScreen code="schema_mismatch" onRetry={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Borrar datos locales y reintentar' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mClearLocalDatabaseAndReload).not.toHaveBeenCalled()
  })
})
