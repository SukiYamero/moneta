import { beforeEach, describe, expect, it } from 'vitest'
import { useMovimientoSheetStore } from '@/features/movimientos/movimientoSheetStore'

beforeEach(() => {
  useMovimientoSheetStore.setState({ addOpen: false, viewId: null })
})

describe('useMovimientoSheetStore', () => {
  it('starts closed', () => {
    const s = useMovimientoSheetStore.getState()
    expect(s.addOpen).toBe(false)
    expect(s.viewId).toBeNull()
  })

  it('openAdd/closeAdd toggle addOpen without touching viewId', () => {
    useMovimientoSheetStore.getState().openAdd()
    expect(useMovimientoSheetStore.getState().addOpen).toBe(true)
    expect(useMovimientoSheetStore.getState().viewId).toBeNull()

    useMovimientoSheetStore.getState().closeAdd()
    expect(useMovimientoSheetStore.getState().addOpen).toBe(false)
  })

  it('openMovimiento/closeMovimiento set and clear viewId without touching addOpen', () => {
    useMovimientoSheetStore.getState().openMovimiento('mov_1')
    expect(useMovimientoSheetStore.getState().viewId).toBe('mov_1')
    expect(useMovimientoSheetStore.getState().addOpen).toBe(false)

    useMovimientoSheetStore.getState().closeMovimiento()
    expect(useMovimientoSheetStore.getState().viewId).toBeNull()
  })

  it('opening a second movement while one is already open switches the id', () => {
    useMovimientoSheetStore.getState().openMovimiento('mov_1')
    useMovimientoSheetStore.getState().openMovimiento('mov_2')
    expect(useMovimientoSheetStore.getState().viewId).toBe('mov_2')
  })
})
