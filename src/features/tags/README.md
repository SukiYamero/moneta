# src/features/tags

The category picker and taxonomy editor. `index.ts` re-exports `CategoryPicker`
and `CategoryFormModal` as this folder's public surface; both are consumed by
`src/features/movimientos` (via `MovimientoFormFields`) and
`CategoryFormModal` is also used directly by
`src/features/settings/CategoriesSection.tsx` — one editor for both flows.

The curated icon allowlist (`CATEGORY_ICONS`, `CategoryIconKey` → `LucideIcon`)
lives in `src/components/shared/categoryIcons.ts`, not here — it's shared by
every movement-rendering screen via `movimientoView.ts`. The plain key
type/list one layer further down, in `src/lib/categoryIconKeys.ts`, is what
`schema.ts` depends on. This folder imports both rather than owning either.

- `categorySuggest.ts` — offline icon/color suggestion for a typed category
  name. `suggestCategoryVisual(query, existingCategorias)` matches whole
  normalized words (via `searchMatch.normalizeForSearch`) against a table of
  concepts, each with one multilingual keyword bag (so "gimnasio"/"gym"/
  "academia" resolve the same regardless of input language). No match:
  `icono` stays `undefined` (caller falls back by `tipo`), `color` falls
  back to `leastUsedTint()`.
- `categoryOrder.ts` — `orderForPicker(categorias, tipo)`: non-archived
  categories, matching `tipo` sorted first via a stable partition. Shared by
  `CategoryPicker` and `TagPickerSheet` so both apply the identical order.
- `CategoryPicker.tsx` — rendered inline inside a sheet (Add/Edit movement),
  never its own overlay. A fixed left column (count button opening
  `TagPickerSheet`, plus a dashed "Custom" chip opening `CategoryFormModal`
  directly) beside a horizontally-scrolling carousel of `TagChip`s
  (single-select). Filters out `archivado` categories; orders via
  `categoryOrder.ts`. Props: `categorias`/`tipo`/`selectedId`/`onSelect`/`onCreateRequested`.
- `TagPickerSheet.tsx` — the full, searchable picker, a `BottomSheet` opened
  by `CategoryPicker`'s count button: a search input over a grid of
  `IconAvatar` + name rows. Selecting a category closes the sheet; a
  "crear «query»" row (shown only when the query matches nothing) hands the
  query to the caller, which closes this sheet and opens `CategoryFormModal`.
- `CategoryFormModal.tsx` — a `CenterModal`, create and edit in one
  component: name/section/icon grid/color grid + a live `TagChip` preview.
  The section control is hidden when only one section exists. Duplicate name
  is blocked inline, scoped to the chosen section. Calls
  `useDataStore().upsertCategoria` and closes immediately (optimistic write,
  doesn't wait for it to settle).

The taxonomy reference itself (`Movimiento.categoria` holding `Categoria.id`,
resolved for display via `movimientoView.ts`'s `resolveCategoria`) lives
outside this folder.
