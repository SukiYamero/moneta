# src/features/movimientos

The movement sheet — creating, viewing, editing and deleting a `Movimiento`
(Track F, Wave 4 stage 2). Spec: `specs.md` §10.23. One form, two sheets, no
third copy of the fields (Decision 1):

- `useMovimientoForm.ts` — field state, validation and submit; the only
  place either sheet writes. Money-adjacent, covered by TDD. Key behaviors:
  - Validation (`amountErrorReason`/`categoriaMissing`) only appears after a
    submit is actually attempted — not on first render.
  - **The sheet is opened by id, never a snapshot** (specs.md §10.23
    Decision 2) — `MovimientoSheet` derives the record from `dataStore` on
    every render and this hook is handed that record via `initial`, not a
    copy it owns.
  - **A category id that no longer resolves against `categorias` is kept
    as-is on edit**, never silently reassigned — `selectCategoria` is the
    only thing that changes it. `categoriaId`/`seccionId` track the ids to
    write, independent of whether the picker can currently highlight them.
  - A `submitting` flag blocks a second concurrent submit (the double-tap
    guard specs.md calls out by name).
  - A refused or failed write (`dataStore`'s mutations return `boolean` —
    specs.md §10.23 Decision 3) never calls `onSaved` and never clears the
    typed fields — the caller decides what "may I close?" means.
  - `applyParsedFields(patch)` is the seam stage 3 (voice) wires a parser
    into, per Decision 5 — no scan/voice button is rendered by this track.
- `MovimientoFormFields.tsx` — the field set, presentational, driven
  entirely by the hook's return value. Owns only the "create category from
  query" modal's local open/prefill state (a UI concern, not validation).
  Composes existing primitives only (`AmountField`, `DateChipPicker`,
  `SegmentedControl`, `TextField`, `CategoryPicker`/`CategoryFormModal`
  from `@/features/tags`) — this track adds no new shared primitive.
- `AddMovimientoSheet.tsx` — `BottomSheet` + the form in create mode,
  opened by the `BottomNav` FAB via `movimientoSheetStore`. Every dismissal
  path (backdrop, Escape, drag, Cancel) routes through one `handleClose`
  that also resets the draft, so a cancelled create never resurfaces next
  time the sheet opens.
- `MovimientoSheet.tsx` — `BottomSheet` hosting view ⇄ edit for an existing
  movement, driven by `movimientoSheetStore`'s `viewId`. View mode resolves
  category/section for display (never a raw id — specs.md §10.22); Editar
  swaps to `MovimientoFormFields` pre-filled via `formatAmountForInput`;
  Eliminar opens a `ConfirmDialog` (a sibling of the `BottomSheet`, so it
  correctly nests as the topmost overlay — the exact case
  `useOverlay`'s own docs cite). **If the id it's showing stops resolving**
  (deleted elsewhere), the sheet closes itself and raises a toast instead of
  rendering blank or throwing on `undefined`.
- `movimientoSheetStore.ts` — one zustand store, `{ addOpen, viewId }`, for
  all four entry points (the FAB plus Home/History/Search's row taps) to
  share instead of each screen inventing its own open state.

Both sheets are mounted once in `src/routes/AppShell.tsx`, beside
`ProfileSheet`.

## Wiring at the four entry points

- `src/components/shared/BottomNav.tsx` — the centre FAB, enabled, with the
  same `aria-haspopup="dialog"`/`aria-expanded` pattern the Profile slot
  already used. Stays feature-agnostic (`addOpen`/`onOpenAdd` props, no
  import of this folder) — `AppShell` wires it to the store.
- `src/features/home/RecentMovimientos.tsx`,
  `src/features/history/HistoryScreen.tsx`,
  `src/features/search/SearchScreen.tsx` — each row's `onClick` calls
  `useMovimientoSheetStore().openMovimiento(id)` directly (a legitimate
  cross-feature import: this store is the one shared entry point by
  design, unlike a screen reaching into another screen's own internals).

## What this track does not add

- No scan/voice button (Decision 5) — see `applyParsedFields` above.
- No `metodo` control — the field has no writer anywhere and is filed as a
  backlog item (specs.md §12, 2026-08-20) rather than a control invented
  outside what the design specifies.
- No new shared primitive under `src/components/shared` — this folder only
  composes what already existed before this track.
