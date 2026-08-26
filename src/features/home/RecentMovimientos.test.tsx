import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import type { Movimiento } from '@/lib/schema'
import { RecentMovimientos } from '@/features/home/RecentMovimientos'
import { useMovimientoSheetStore } from '@/features/movimientos'

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: 'mov_1',
  fecha: '2026-08-10',
  seccion: 'sec_personal',
  categoria: 'cat_sueldo',
  tipo: 'ingreso',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-10T00:00:00.000Z',
  ...overrides,
})

beforeEach(() => {
  useMovimientoSheetStore.setState({ addOpen: false, viewId: null })
})

describe('RecentMovimientos', () => {
  it('gives the "Ver todo" link a real 44px touch target', () => {
    render(<RecentMovimientos movimientos={[]} categorias={[]} />, { wrapper: MemoryRouter })

    expect(screen.getByRole('link', { name: /ver todo/i })).toHaveClass('min-h-11')
  })

  it('tapping a row opens the movement sheet for that id', async () => {
    const user = userEvent.setup()
    render(<RecentMovimientos movimientos={[movimiento()]} categorias={[]} />, {
      wrapper: MemoryRouter,
    })

    await user.click(screen.getByRole('button'))
    expect(useMovimientoSheetStore.getState().viewId).toBe('mov_1')
  })
})
