import { create } from 'zustand'

interface MovimientoSheetState {
  /** Whether `AddMovimientoSheet` is open — one instance, mounted once in `AppShell`. */
  addOpen: boolean
  /**
   * The id of the movement `MovimientoSheet` is viewing/editing, or `null`
   * when closed. **An id, never a `Movimiento` snapshot** (specs.md §10.23
   * Decision 2) — the sheet derives the record from `dataStore` on every
   * render, so a concurrent edit (or, once sync lands, a pull from another
   * device) is never read from a copy that has already gone stale.
   */
  viewId: string | null
  openAdd: () => void
  closeAdd: () => void
  /** The single entry point every consumer (FAB aside) opens a movement through — Home's recent list, History's list, Search's results. */
  openMovimiento: (id: string) => void
  closeMovimiento: () => void
}

/**
 * Which movement sheet is open, and for which id (specs.md §10.23 Decision
 * 2). One store instead of per-screen open state: four call sites need to
 * open a movement (the FAB for create; Home/History/Search for view), and
 * giving each its own state would mean four wirings and four bugs instead
 * of one.
 */
export const useMovimientoSheetStore = create<MovimientoSheetState>((set) => ({
  addOpen: false,
  viewId: null,
  openAdd: () => set({ addOpen: true }),
  closeAdd: () => set({ addOpen: false }),
  openMovimiento: (id) => set({ viewId: id }),
  closeMovimiento: () => set({ viewId: null }),
}))
