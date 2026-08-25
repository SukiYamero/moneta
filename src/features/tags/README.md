# src/features/tags

The category picker and taxonomy — spec: `specs.md` §10.22 (Decisions,
unchanged) + §10.41 (the picker's current inline/full-picker split, Ajustes
1, Track AJ-C, 2026-08-25).

The curated `CATEGORY_ICONS` allowlist (`CategoryIconKey` → `LucideIcon`,
~34 icons) and `CATEGORY_ICON_KEYS` live in
`src/components/shared/categoryIcons.ts`, not in this folder: it's what
`movimientoView.ts`'s `getMovimientoVisual` resolves a `Categoria.icono`
through, and that module is shared by every movement-rendering screen, not
just this feature — a shared, foundational module can't depend on one
feature's folder without inverting `ARCHITECTURE.md`'s layering (specs.md
§11, 2026-08-20). The plain key type/list one layer further down, in
`src/lib/categoryIconKeys.ts`, is what `schema.ts` itself depends on. This
folder imports both rather than owning either.

- `categorySuggest.ts` — offline icon/color suggestion for a typed category
  name (Decision 7). `suggestCategoryVisual(query, existingCategorias)`
  matches whole normalized words (via `searchMatch.normalizeForSearch`, never
  a second normalizer) against ~30 concepts, each carrying **one
  multilingual keyword bag** rather than one list per locale — "gimnasio"/
  "gym"/"academia" all resolve to the same icon/tint with no notion of which
  language was typed. A matched concept's color is always its own semantic
  tint, even colliding with a color already in use (user decision). No
  match: `icono` stays `undefined` (the caller's `tipo`-based fallback
  applies) and `color` falls back to `leastUsedTint()` — deterministic,
  never colorless.
- `categoryOrder.ts` — `orderForPicker(categorias, tipo)`: non-archived
  categories, matching `tipo` sorted first (a stable partition, never a
  resort). Extracted so `CategoryPicker`'s inline carousel and
  `TagPickerSheet`'s full grid apply the identical rule instead of each
  re-deriving it.
- `CategoryPicker.tsx` — rendered _inline_ inside a sheet (Add/Edit
  movement), never its own overlay. **No search box of its own any more**
  (specs.md §10.41 — moved into `TagPickerSheet`, per
  `docs/ui/design-export-add-sheet.md` §2): a fixed left column (a count
  button opening `TagPickerSheet`, plus a dashed "Custom" chip that opens
  `CategoryFormModal` directly with an empty query) beside a
  horizontally-scrolling 2-row carousel of `TagChip`s (single-select,
  `touch-pan-x` + hidden-scrollbar utilities matching
  `history/PeriodPickerRow.tsx`'s existing horizontal-scroll pattern, not a
  new one). Filters out `archivado` categories itself (one rule every
  caller shares); orders via `categoryOrder.ts` without hiding the rest
  (`tipo` is a default, not a constraint) and never flips the sheet's
  toggle on selection. Public prop contract unchanged from before this
  track (`categorias`/`tipo`/`selectedId`/`onSelect`/`onCreateRequested`),
  so `src/routes/Kit.tsx`'s existing demo needed no edits.
- `TagPickerSheet.tsx` — the full, searchable picker (specs.md §10.41,
  `docs/ui/design-export-add-sheet.md` §3), a `BottomSheet` opened by
  `CategoryPicker`'s count button: a search input (a raw `Input` + `Search`
  icon — the export's field carries no visible label, so not `TextField`)
  over a 2-column grid of `IconAvatar` + name rows (not `TagChip` — the
  export's full-picker rows are a visually distinct, wider layout from the
  inline carousel's pills). Selecting a category closes the sheet; tapping
  "crear «query»" (shown only when the query matches nothing) hands the
  query to the caller, which closes this sheet and opens
  `CategoryFormModal` — creating never auto-selects, matching the inline
  carousel's own "Custom" chip behavior. Stacks correctly above the
  Add/Edit sheet via `useOverlay`'s render-order stack (§10.5.1), the same
  mechanism `MovimientoSheet`'s delete `ConfirmDialog` already relies on —
  driven live with both sheets open (specs.md §10.41.1): Escape and a
  backdrop tap each closed only this sheet, left the Add sheet's draft
  intact, and returned focus to the count button; also pinned by an
  `AddMovimientoSheet.test.tsx` case, since no test previously exercised
  this exact two-sheet composition.
- `CategoryFormModal.tsx` — a `CenterModal`, create and edit in one
  component. Name/section/icon grid/color grid + a live `TagChip` preview.
  The section control (`SegmentedControl`) is hidden when only one section
  exists; a new category's `tipo` is inherited from the sheet's toggle
  (ignored when editing — the existing category's own `tipo` wins, never
  reassigned by re-opening the modal from a sheet in the other mode).
  Duplicate name is blocked inline (`TextField`'s `error`, scoped to the
  chosen section, never a toast); the name is capped at `MAX_NAME_LENGTH`
  enforced on the value, not just `maxlength`. Calls
  `useDataStore().upsertCategoria` directly — the one write path (specs.md
  §10.13) — and closes immediately, matching every other write's optimistic
  convention; it does not wait for the write to settle.

The taxonomy-reference migration underneath the picker (`Movimiento.categoria`
holding `Categoria.id`, resolved for display via
`src/components/shared/movimientoView.ts`'s `resolveCategoria`) lives outside
this folder — see `specs.md` §10.22 Decision 1 for what changed and where.

**Wired into a real screen as of Track F.** Both `AddMovimientoSheet` and
`MovimientoSheet`'s edit form (`src/features/movimientos`, `specs.md` §10.23)
render `CategoryPicker` inline via `MovimientoFormFields`, and its "crear
«query»" chip opens `CategoryFormModal` above the sheet.
`CategoryPicker`'s `onSelect` hands back the full `Categoria`, so the
consuming form derives both `categoria`/`seccionId` from one tap without a
second lookup. `index.ts` (added by Track F) re-exports both components as
this folder's public surface. `CategoryFormModal` has a second real
consumer as of Track G2: `src/features/settings/CategoriesSection.tsx`
(`specs.md` §10.24) uses it for the settings screen's category list, so the
same editor serves both the create-from-picker flow and the settings CRUD —
there is deliberately no second editor.
