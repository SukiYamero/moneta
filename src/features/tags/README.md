# src/features/tags

Category selection and the taxonomy editor. `index.ts` re-exports
`CategoryField`, `CategorySheet` and `CategoryFormModal` as this folder's
public surface. `CategoryField`/`CategorySheet` are consumed by
`src/features/movimientos` (via `MovimientoFormFields`); `CategoryFormModal`
is also used directly by `src/features/settings/CategoriesSection.tsx` — one
editor for both flows.

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
  back to `leastUsedTint()`. `rankCategoryIcons(query)` reorders the full
  icon grid so a matched icon leads — never a filter.
- `CategoryField.tsx` — the collapsed field rendered inline inside a sheet
  (Add/Edit movement): icon swatch, picked name or a placeholder, a chevron.
  Tapping it opens `CategorySheet`. Props: `categoria`/`tipo`/`onOpen`.
- `CategorySheet.tsx` — the full picker, a `BottomSheet`. Two levels: level 1
  is every top-level category plus a "Custom" tile; a tile with children
  drills into level 2 (that category itself, general, plus its children); a
  childless tile selects and closes the sheet. A search field is flat across
  both levels and exits any drill-in. Archived categories never appear, and a
  category whose own parent is archived renders at level 1. A fresh open
  always starts at level 1. The "Custom" tile at either level, and the
  "crear «query»" affordance shown on an empty search, both open
  `CategoryFormModal` pre-filled — creating never auto-selects.
- `CategoryFormModal.tsx` — a `CenterModal`, create and edit in one
  component: name/icon grid/color grid + a live `TagChip` preview, and the
  parent's name/icon shown read-only when creating a child. Opens with the
  panel focused, never the name input. Duplicate name is blocked inline,
  scoped to siblings under the same `padreId`. Calls
  `useDataStore().upsertCategoria`, which returns a boolean the modal waits
  on before closing.

The taxonomy reference itself (`Movimiento.categoria` holding `Categoria.id`,
resolved for display via `movimientoView.ts`'s `resolveCategoria`) lives
outside this folder.
