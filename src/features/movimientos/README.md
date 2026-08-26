# src/features/movimientos

The movement sheet — creating, viewing, editing and deleting a `Movimiento`. One form, two sheets, no duplicate field set.

- `useMovimientoForm.ts` — field state, validation and submit; the only place either sheet writes. Validation errors only appear after a submit is attempted. `submitAttempts` counts every submit call (blocked or not) so a repeated tap in the same invalid state can still re-trigger UI feedback. `applyParsedFields(patch)` is the seam a future scan/voice parser would use.
- `MovimientoFormFields.tsx` — the field set, presentational, driven entirely by the hook's return value: type toggle, date chip, amount, categories, then a note field behind a "ver más" disclosure. Composes `DateChipPicker`, `SegmentedControl`, `TextField`, `CategoryPicker`/`CategoryFormModal` (from `@/features/tags`) and `MovimientoAmountInput`. On a blocked submit, scrolls/focuses the field that blocked it.
- `MovimientoAmountInput.tsx` — the centered, borderless, auto-sizing amount input with a live-formatted digit display. Colors its digits by `tipo`.
- `keypadDebugLog.ts` — a read-only `?debugKeypad=1` probe `MovimientoAmountInput` arms while its on-screen keypad is open.
- `AddMovimientoSheet.tsx` — `BottomSheet` + the form in create mode, opened by the `BottomNav` FAB via `movimientoSheetStore`. No visible heading, no Cancel button (dismiss is backdrop-tap/Escape/drag). Primary button label follows the type toggle ("Agregar gasto"/"Agregar ingreso").
- `movimientoPrimaryCta.ts` — `MOVIMIENTO_PRIMARY_CTA_CLASS`, the shared class string sizing the primary commit button in both sheets.
- `MovimientoSheet.tsx` — `BottomSheet` hosting view ⇄ edit for an existing movement, driven by `movimientoSheetStore`'s `viewId`. Edit mode keeps a two-button Cancel/Save row (Cancel returns to view mode without writing). Eliminar opens a `ConfirmDialog`. If the shown id stops resolving, the sheet closes itself and raises a toast.
- `movimientoSheetStore.ts` — one zustand store, `{ addOpen, viewId }`, shared by all entry points instead of each screen owning its own open state.

Both sheets are mounted once in `src/routes/AppShell.tsx`.

## Entry points

- `src/components/shared/BottomNav.tsx` — the center FAB; feature-agnostic (`addOpen`/`onOpenAdd` props), wired by `AppShell`.
- `src/features/home/RecentMovimientos.tsx`, `src/features/history/HistoryScreen.tsx`, `src/features/search/SearchScreen.tsx` — each row's `onClick` calls `useMovimientoSheetStore().openMovimiento(id)` directly.
