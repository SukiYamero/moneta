# src/features/movimientos

The movement sheet — creating, viewing, editing and deleting a `Movimiento`
(Track F, Wave 4 stage 2; UI rebuilt by Track AJ-C, Ajustes 1, 2026-08-25).
Spec: `specs.md` §10.23 (Decisions) + §10.41 (the current UI — supersedes
§10.23's own UI subsection). One form, two sheets, no third copy of the
fields (Decision 1):

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
  entirely by the hook's return value. Field order/layout follows
  `docs/ui/design-export-add-sheet.md` §2 (specs.md §10.41): type toggle,
  a centered date chip, the centered amount, categories, then the note
  field behind a "ver más ⇄ ver menos" disclosure. Owns only that
  disclosure's open flag and the "create category from query" modal's
  local open/prefill state — both UI concerns, not validation; both reset
  for free when the sheet closes (this component unmounts with it).
  Composes existing primitives (`DateChipPicker`, `SegmentedControl`,
  `TextField`, `CategoryPicker`/`CategoryFormModal` from `@/features/tags`)
  plus this track's own `MovimientoAmountInput` — see below for why that
  one isn't `AmountField`.
- `MovimientoAmountInput.tsx` — the centered, borderless, auto-sizing
  amount display (specs.md §10.41), deliberately not `AmountField.tsx`
  (shared, read-only for this track): that component's bordered/labelled
  `Input` has no adornment slot for an external currency-symbol sibling.
  Reuses `parseAmountForInput`/`formatAmountForInput` directly — same
  parsing rule, new markup only — and `isAmountInputInvalid` for its
  `aria-invalid` check, shared with `AmountField.tsx` (both used to
  re-derive that check independently from the same parser's result;
  extracted into `amountFormat.ts` so the two can't drift, specs.md
  §10.41.1/§12). Colors its digits by `tipo`, mirroring
  `movimientoView.ts`'s (unexported) `AMOUNT_COLOR_CLASS`. Uses
  `field-sizing: content` for the auto-width, with a `w-40` fallback
  overridden via `supports-[field-sizing:content]:w-auto` — **not** an
  implicit override; verified live (Chrome 151) that pairing
  `field-sizing: content` with a plain fallback `width` does not make a
  supporting browser disregard that width the way it's commonly described,
  only an explicit `@supports` gate does.
- `AddMovimientoSheet.tsx` — `BottomSheet` + the form in create mode,
  opened by the `BottomNav` FAB via `movimientoSheetStore`. **No visible
  heading** (the grab handle is the header the design draws; `ariaLabel`
  still names the dialog) and **no Cancel button** — the design's action
  row is camera + primary + mic; with the camera/mic not rendered (specs.md
  §10.23 Decision 5), the one remaining button takes the full row.
  Dismissing without saving is the sheet's existing backdrop-tap/Escape/
  drag-to-dismiss, all routed through one `handleClose` that also resets
  the draft, so a cancelled create never resurfaces next time the sheet
  opens. Judged correct on review (specs.md §10.41.1): drag-handle,
  backdrop-tap and Escape each carry a visible cue and none needs hover, so
  this isn't the hover-only problem `AGENTS.md` warns against. **The
  primary button's label follows the type toggle** (`form.addCta.gasto`/
  `.ingreso` — "Agregar gasto"/"Agregar ingreso"), not a generic "Guardar":
  the artboard's `{{addLabel}}` names the action being created, and only
  create's toggle picks what that is (edit's toggle changes an existing
  movement instead, so it keeps the generic `form.saveCta`).
- `MovimientoSheet.tsx` — `BottomSheet` hosting view ⇄ edit for an existing
  movement, driven by `movimientoSheetStore`'s `viewId`. View mode resolves
  category/section for display (never a raw id — specs.md §10.22), starts
  flush under the grab handle like every other sheet (its old extra `pt-2`
  was removed, specs.md §10.41); Editar swaps to `MovimientoFormFields`
  pre-filled via `formatAmountForInput` — **edit keeps a two-button
  Cancel/Save row**, unlike the create sheet, because edit's Cancel returns
  to _view_ mode without writing, a distinct affordance a backdrop dismiss
  can't provide. Eliminar opens a `ConfirmDialog` (a sibling of the
  `BottomSheet`, so it correctly nests as the topmost overlay — the exact
  case `useOverlay`'s own docs cite). **If the id it's showing stops
  resolving** (deleted elsewhere), the sheet closes itself and raises a
  toast instead of rendering blank or throwing on `undefined`.
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
- No gear/settings button on the create sheet, even though
  `docs/ui/design-export-add-sheet.md` §2 draws one — navigating to
  `/settings` from inside this sheet would unmount `AppShell` mid-entry and
  silently discard the draft (`/settings` is a sibling top-level route, not
  nested under the layout route hosting `AppShell` — `src/router.tsx`).
  Escalated to specs.md §12/§10.41 for a product decision, not resolved
  here.
- No new primitive under `src/components/shared` beyond what already
  existed before this track — `MovimientoAmountInput.tsx` lives in this
  folder instead, deliberately (see above).
