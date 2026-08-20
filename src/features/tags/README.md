# src/features/tags

The category picker and taxonomy — spec: `specs.md` §10.22.

- `categoryIcons.ts` — the curated `CATEGORY_ICONS` allowlist (`CategoryIconKey`
  → `LucideIcon`, ~34 icons) and `CATEGORY_ICON_KEYS` (its stable iteration
  order). This is the only set a `Categoria.icono` value may resolve to; an
  unknown key (older/newer build, hand-edited Drive file) falls back rather
  than throwing, via `movimientoView.ts`'s `getMovimientoVisual`.
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
- `CategoryPicker.tsx` — rendered _inline_ inside a sheet (Add/Edit
  movement, reusable by the Filter sheet), never its own overlay: a
  `TextField` search + a wrapping `TagChip` grid, single-select. Filters out
  `archivado` categories itself (one rule every caller shares); orders
  categories matching the sheet's current `tipo` first without hiding the
  rest (`tipo` is a default, not a constraint) and never flips the sheet's
  toggle on selection. A "crear «query»" chip appears only when the query
  matches nothing; tapping it hands the query to the caller
  (`onCreateRequested`), which opens `CategoryFormModal` pre-filled — never
  a silent instant-create.
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

**Not wired into a real screen yet.** Track F (the movement Add/Edit sheet)
doesn't exist in this codebase — both components are built, tested, and
demoed in `/kit` (dev-only), ready for Track F/G2 to consume. `CategoryPicker`'s
`onSelect` hands back the full `Categoria`, so a consuming sheet derives both
`categoria`/`seccionId` from one tap without a second lookup.
