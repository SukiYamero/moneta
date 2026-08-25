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
  - `submitAttempts` counts every `submit()` call, blocked or not (specs.md
    §10.48) — unlike `amountErrorReason`/`categoriaMissing`, it changes on
    a repeated tap that hits the same already-invalid state, which is what
    `MovimientoFormFields` needs to re-trigger its scroll-to-error effect
    on a second blocked tap.
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
  plus this track's own `MovimientoAmountInput` — see below for why it
  isn't a bordered/labelled `TextField`-style field. On a submit blocked by
  an invalid amount or a missing category, blurs whatever currently holds
  focus (dismissing the software keyboard, which is what was hiding the
  category error below the fold — Ajustes 3, `docs/ajustes-3-plan.md`
  item 3, specs.md §10.48) and scrolls the offending field's section into
  view, keyed on `useMovimientoForm`'s `submitAttempts` counter rather than
  the error flags themselves (a repeated tap in the same invalid state
  doesn't change those flags, but must still re-trigger the scroll).
- `MovimientoAmountInput.tsx` — the centered, borderless, auto-sizing
  amount display (specs.md §10.41/§10.45): a bordered/labelled `TextField`
  has no adornment slot for an external currency-symbol sibling, which this
  needs. (This replaced the shared `AmountField.tsx` primitive in the one
  form it served — Ajustes 3 deleted `AmountField.tsx` once nothing else
  used it, specs.md §10.48.) Reuses `isAmountInputInvalid` for its
  `aria-invalid` check — extracted into `amountFormat.ts` when a second
  consumer (`AmountField`) read the same parser's result independently and
  could drift from it (specs.md §10.41.1/§12); `AmountField` is gone
  (specs.md §10.48), so this is the helper's only caller today, kept
  separate as a property of the parse result rather than inlined. Also uses
  `formatAmountLive` for
  live-grouping the typed digits under the locale's own convention on
  every keystroke (specs.md §10.45).
  Colors its digits by `tipo`, mirroring `movimientoView.ts`'s (unexported)
  `AMOUNT_COLOR_CLASS`. **Centers the digits alone, not the
  `[symbol, digits]` pair** — a deliberate divergence from the design
  export the user asked for directly (specs.md §10.45, §11 2026-08-25): the
  currency symbol is balanced by an invisible mirror of itself on the
  input's other side rather than pulled out of flow, since a flex row
  symmetric around the input keeps its true center pinned regardless of the
  symbol's own (locale-dependent) rendered width or how wide
  `field-sizing: content` makes the input on any given keystroke. The row
  itself carries `w-full` — without it, the row (a child of a `flex-col
items-center` parent) is shrink-to-fit, and the input's
  `max-w-[calc(100%-3rem)]` resolves against that unbounded content width
  instead of the sheet's real one; a review pass reproduced this in a real
  browser (a six-digit `PEN` amount overflowing the sheet with the clamp
  doing nothing) before adding `w-full` (specs.md §10.45.1). Its
  `onChange` handler reformats and repositions the caret **synchronously on
  the native DOM node**, not via an effect keyed on the `value` prop — a
  real bug found building this: React bails out of the whole render+effects
  cycle whenever a state update is `Object.is`-equal to the current state,
  which a live reformatter that regenerates the same string (e.g.
  backspacing a grouping separator that just reappears) does routinely
  (specs.md §10.45, §11 2026-08-25). Uses `field-sizing: content` for the
  auto-width, with a `w-40` fallback overridden via
  `supports-[field-sizing:content]:w-auto` — **not** an implicit override;
  verified live (Chrome 151) that pairing `field-sizing: content` with a
  plain fallback `width` does not make a supporting browser disregard that
  width the way it's commonly described, only an explicit `@supports` gate
  does. Bounded by `max-w-[calc(100%-3rem)]`, a flex item's percentage
  `max-width` (resolves against the container's already-definite size) —
  deliberately not the same percentage on a CSS Grid `auto`-track item,
  which was considered and rejected (specs.md §10.45) since that track's
  contribution to grid sizing ignores an indefinite percentage max-width.
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
- `movimientoPrimaryCta.ts` — the one class string
  (`MOVIMIENTO_PRIMARY_CTA_CLASS`) sizing the commit action in both sheets
  to the design export's 54px/18px-radius/15px/800 instead of `Button`'s
  `size="touch"` typography, which is a touch-target minimum and nothing
  more (specs.md §10.46). Its own module rather than an export off either
  sheet, so neither becomes the other's dependency for a value they own
  equally (§10.46.1). Edit's Cancel takes the height/radius half only — a
  flex row of two explicit-height buttons has to match, but Cancel is not
  the commit action the heavier type calls out.
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
