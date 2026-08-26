import { create } from 'zustand'

interface MovimientoSheetState {
  addOpen: boolean
  viewId: string | null
  openAdd: () => void
  closeAdd: () => void
  openMovimiento: (id: string) => void
  closeMovimiento: () => void
}

export const useMovimientoSheetStore = create<MovimientoSheetState>((set) => ({
  addOpen: false,
  viewId: null,
  openAdd: () => set({ addOpen: true }),
  closeAdd: () => set({ addOpen: false }),
  openMovimiento: (id) => set({ viewId: id }),
  closeMovimiento: () => set({ viewId: null }),
}))
